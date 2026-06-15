const { StatusCodes } = require("http-status-codes");
const { validationResult } = require("express-validator");

const asyncHandler = require("../middleware/asyncHandler");
const Issue = require("../models/Issue");
const Assignment = require("../models/Assignment");
const Comment = require("../models/Comment");
const User = require("../models/User");
const AITrainingFeedback = require("../models/AITrainingFeedback");
const { buildHotspotForecast } = require("../services/aiService");
const { getOrSet, invalidatePrefix } = require("../services/cacheService");
const { createNotificationForUsers } = require("../services/notificationService");
const { emitToUsers } = require("../services/socketService");
const { ISSUE_STATUS, ROLES } = require("../utils/constants");

const buildWorkerLoadMap = async () => {
  const assignments = await Assignment.aggregate([
    {
      $match: {
        status: { $in: ["assigned", "accepted"] },
      },
    },
    {
      $group: {
        _id: "$workerId",
        activeAssignments: { $sum: 1 },
      },
    },
  ]);

  return new Map(assignments.map((item) => [String(item._id), item.activeAssignments]));
};

const enrichWorkers = async (workers) => {
  const loadMap = await buildWorkerLoadMap();

  return workers.map((worker) => ({
    id: worker._id,
    name: worker.name,
    email: worker.email,
    role: worker.role === "citizen" ? "user" : worker.role,
    phone: worker.phone,
    avatar: worker.avatar,
    address: worker.address,
    bio: worker.bio,
    preferredLanguage: worker.preferredLanguage,
    notificationPreferences: worker.notificationPreferences,
    workerProfile: worker.role === "worker" ? worker.workerProfile : undefined,
    createdAt: worker.createdAt,
    updatedAt: worker.updatedAt,
    activeAssignments: loadMap.get(String(worker._id)) || 0,
  }));
};

const csvEscape = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value).replace(/"/g, "\"\"");
  return /[",\n]/.test(stringValue) ? `"${stringValue}"` : stringValue;
};

const buildIssueCsv = (issues) => {
  const headers = [
    "Issue ID",
    "Title",
    "Category",
    "Severity",
    "Status",
    "Address",
    "Reported By",
    "Assigned Worker",
    "Priority Band",
    "Likely Department",
    "Learning Mode",
    "Adaptive Strategy",
    "Supervised Label",
    "Unsupervised Pattern",
    "SemiSupervised Confidence",
    "Retrieval Confidence",
    "Historical Pattern Summary",
    "Similar Learned Cases",
    "Created At",
  ];

  const rows = issues.map((issue) => [
    issue._id,
    issue.title,
    issue.category,
    issue.severity,
    issue.status,
    issue.address || "",
    issue.reportedBy?.name || "",
    issue.assignedWorker?.name || "",
    issue.aiAnalysis?.priorityBand || "",
    issue.aiAnalysis?.likelyDepartment || "",
    issue.aiAnalysis?.learningMode || "",
    issue.aiAnalysis?.adaptiveStrategy || "",
    issue.aiAnalysis?.supervisedLabel || "",
    issue.aiAnalysis?.unsupervisedPattern || "",
    issue.aiAnalysis?.semisupervisedConfidence ?? "",
    issue.aiAnalysis?.retrievalConfidence ?? "",
    issue.aiAnalysis?.historicalPatternSummary || "",
    (issue.aiAnalysis?.similarIssueTitles || []).join(" | "),
    issue.createdAt ? new Date(issue.createdAt).toISOString() : "",
  ]);

  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
};

const buildIssueQuery = ({ search, status, severity, category }) => {
  const query = {};

  if (status && status !== "all") {
    query.status = status;
  }

  if (severity && severity !== "all") {
    query.severity = severity;
  }

  if (category && category !== "all") {
    query.category = category;
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { address: { $regex: search, $options: "i" } },
    ];
  }

  return query;
};

const buildAdminIssueCacheKey = (query = {}) =>
  `admin:issues:${query.search || ""}:${query.status || "all"}:${query.severity || "all"}:${query.category || "all"}`;

const buildRecentDays = (days) => {
  const labels = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - index);
    labels.push(date);
  }
  return labels;
};

const getAllIssues = asyncHandler(async (req, res) => {
  const issues = await getOrSet(buildAdminIssueCacheKey(req.query), 20000, async () =>
    Issue.find(buildIssueQuery(req.query))
      .populate("reportedBy", "name email")
      .populate("assignedWorker", "name email")
      .sort({ createdAt: -1 })
      .lean()
  );

  res.status(StatusCodes.OK).json({
    success: true,
    issues,
  });
});

const exportIssuesCsv = asyncHandler(async (req, res) => {
  const issues = await getOrSet(`${buildAdminIssueCacheKey(req.query)}:csv-source`, 20000, async () =>
    Issue.find(buildIssueQuery(req.query))
      .populate("reportedBy", "name email")
      .populate("assignedWorker", "name email")
      .sort({ createdAt: -1 })
      .lean()
  );

  const csv = buildIssueCsv(issues);
  const stamp = new Date().toISOString().slice(0, 10);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"civictrack-issues-${stamp}.csv\"`);
  res.status(StatusCodes.OK).send(csv);
});

const assignIssue = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      errors: errors.array(),
    });
  }

  const { issueId, workerId, notes } = req.body;

  const [issue, worker] = await Promise.all([
    Issue.findById(issueId),
    User.findOne({ _id: workerId, role: ROLES.WORKER }),
  ]);

  if (!issue || !worker) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: "Issue or worker not found",
    });
  }

  issue.assignedWorker = worker._id;
  issue.status = ISSUE_STATUS.ASSIGNED;
  issue.verifiedBy = req.user._id;
  await issue.save();
  invalidatePrefix("admin:");

  const assignment = await Assignment.create({
    issueId: issue._id,
    workerId: worker._id,
    assignedBy: req.user._id,
    notes,
    status: "assigned",
  });

  await createNotificationForUsers({
    userIds: [worker._id, issue.reportedBy],
    message: `Issue "${issue.title}" has been assigned to ${worker.name}`,
    type: "assignment",
  });

  emitToUsers(req.app, [worker._id, issue.reportedBy], "issue:assigned", {
    issueId: issue._id,
    worker: {
      id: worker._id,
      name: worker.name,
      email: worker.email,
    },
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Issue assigned successfully",
    assignment,
  });
});

const updateIssueStatus = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      errors: errors.array(),
    });
  }

  const { issueId, status } = req.body;

  const issue = await Issue.findById(issueId);
  if (!issue) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: "Issue not found",
    });
  }

  issue.status = status;
  issue.verifiedBy = req.user._id;
  await issue.save();
  invalidatePrefix("admin:");

  await createNotificationForUsers({
    userIds: [issue.reportedBy, issue.assignedWorker].filter(Boolean),
    message: `Issue "${issue.title}" status updated to ${status}`,
    type: "issue-status",
  });

  emitToUsers(req.app, [issue.reportedBy, issue.assignedWorker].filter(Boolean), "issue:status-updated", {
    issueId: issue._id,
    status,
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Issue status updated successfully",
    issue,
  });
});

const getDashboardStats = asyncHandler(async (req, res) => {
  const stats = await getOrSet("admin:dashboard", 30000, async () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setHours(0, 0, 0, 0);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [
      totalIssues,
      pendingIssues,
      resolvedIssues,
      categoryBreakdown,
      severityBreakdown,
      workers,
      dailyTrendRaw,
      hotspotRaw,
      topSupportedIssues,
    ] = await Promise.all([
      Issue.countDocuments({}),
      Issue.countDocuments({ status: { $in: [ISSUE_STATUS.REPORTED, ISSUE_STATUS.VERIFIED, ISSUE_STATUS.ASSIGNED] } }),
      Issue.countDocuments({ status: ISSUE_STATUS.RESOLVED }),
      Issue.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]),
      Issue.aggregate([{ $group: { _id: "$severity", count: { $sum: 1 } } }]),
      User.find({ role: ROLES.WORKER }).sort({ name: 1 }).lean(),
      Issue.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      ]),
      Issue.aggregate([
        {
          $group: {
            _id: "$address",
            count: { $sum: 1 },
            categories: { $addToSet: "$category" },
          },
        },
        { $match: { _id: { $nin: [null, ""] } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      Issue.aggregate([
        {
          $project: {
            title: 1,
            address: 1,
            status: 1,
            supportersCount: { $size: { $ifNull: ["$supporters", []] } },
          },
        },
        { $sort: { supportersCount: -1, createdAt: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const trendMap = new Map(
      dailyTrendRaw.map((item) => [
        `${item._id.year}-${item._id.month}-${item._id.day}`,
        item.count,
      ])
    );

    const dailyTrend = buildRecentDays(7).map((date) => ({
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: trendMap.get(`${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`) || 0,
    }));

    const enrichedWorkers = await enrichWorkers(workers);
    const hotspots = hotspotRaw.map((item) => ({
      address: item._id,
      count: item.count,
      categories: item.categories,
    }));
    const hotspotForecasts = hotspots
      .filter((item) => item.address)
      .map((item) => buildHotspotForecast(item))
      .sort((left, right) => {
        const rank = { critical: 0, high: 1, emerging: 2 };
        return rank[left.riskBand] - rank[right.riskBand];
      })
      .slice(0, 5);

    return {
      totalIssues,
      pendingIssues,
      resolvedIssues,
      categoryBreakdown,
      severityBreakdown,
      dailyTrend,
      hotspots,
      hotspotForecasts,
      topSupportedIssues,
      workers: enrichedWorkers,
    };
  });

  res.status(StatusCodes.OK).json({
    success: true,
    stats,
  });
});

const getWorkers = asyncHandler(async (req, res) => {
  const enrichedWorkers = await getOrSet("admin:workers", 30000, async () => {
    const workers = await User.find({ role: ROLES.WORKER }).sort({ name: 1 }).lean();
    return enrichWorkers(workers);
  });

  res.status(StatusCodes.OK).json({
    success: true,
    workers: enrichedWorkers,
  });
});

const getAiTrainingCenter = asyncHandler(async (req, res) => {
  const training = await getOrSet("admin:ai-training", 20000, async () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [feedbackCount, recentFeedbackCount, feedbackItems, lowConfidenceIssues] = await Promise.all([
      AITrainingFeedback.countDocuments({}),
      AITrainingFeedback.countDocuments({ appliedAt: { $gte: sevenDaysAgo } }),
      AITrainingFeedback.find({})
        .populate("issueId", "title category severity status address")
        .populate("correctedBy", "name email")
        .sort({ appliedAt: -1 })
        .limit(8)
        .lean(),
      Issue.find({
        $or: [
          { "aiAnalysis.confidenceScore": { $lt: 0.78 } },
          { "aiAnalysis.semisupervisedConfidence": { $lt: 0.72 } },
          { "aiAnalysis.retrievalConfidence": { $lt: 0.4 } },
        ],
        status: { $ne: ISSUE_STATUS.REJECTED },
      })
        .select("title category severity status address aiAnalysis createdAt")
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const reviewQueue = lowConfidenceIssues.map((issue) => ({
      id: issue._id,
      title: issue.title,
      currentCategory: issue.category,
      currentSeverity: issue.severity,
      status: issue.status,
      address: issue.address,
      predictedCategory: issue.aiAnalysis?.predictedCategory || issue.category,
      predictedSeverity: issue.aiAnalysis?.predictedSeverity || issue.severity,
      confidenceScore: issue.aiAnalysis?.confidenceScore || 0,
      semisupervisedConfidence: issue.aiAnalysis?.semisupervisedConfidence || 0,
      retrievalConfidence: issue.aiAnalysis?.retrievalConfidence || 0,
      historicalPatternSummary: issue.aiAnalysis?.historicalPatternSummary || "",
    }));

    return {
      stats: {
        totalFeedback: feedbackCount,
        recentFeedback: recentFeedbackCount,
        reviewQueueCount: reviewQueue.length,
      },
      reviewQueue,
      feedbackItems,
    };
  });

  res.status(StatusCodes.OK).json({
    success: true,
    training,
  });
});

const submitAiTrainingFeedback = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      errors: errors.array(),
    });
  }

  const { issueId, correctedCategory, correctedSeverity, trainingNotes, confidenceOverride } = req.body;

  const issue = await Issue.findById(issueId);
  if (!issue) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: "Issue not found",
    });
  }

  const feedback = await AITrainingFeedback.findOneAndUpdate(
    { issueId: issue._id },
    {
      $set: {
        issueId: issue._id,
        predictedCategory: issue.aiAnalysis?.predictedCategory || issue.category,
        predictedSeverity: issue.aiAnalysis?.predictedSeverity || issue.severity,
        correctedCategory,
        correctedSeverity,
        trainingNotes: trainingNotes || "",
        confidenceOverride:
          confidenceOverride === undefined || confidenceOverride === null || confidenceOverride === ""
            ? null
            : Number(confidenceOverride),
        correctedBy: req.user._id,
        status: "approved",
        appliedAt: new Date(),
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  )
    .populate("issueId", "title category severity status address")
    .populate("correctedBy", "name email");

  issue.category = correctedCategory;
  issue.severity = correctedSeverity;
  issue.aiAnalysis = {
    ...issue.aiAnalysis,
    trainingFeedbackCount: 1,
    manualReviewApplied: true,
    lastTrainingUpdateAt: new Date(),
  };
  await issue.save();
  invalidatePrefix("admin:");
  invalidatePrefix("ai:");

  res.status(StatusCodes.OK).json({
    success: true,
    message: "AI training feedback saved successfully",
    feedback,
  });
});

const deleteResolvedIssue = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id);

  if (!issue) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: "Issue not found",
    });
  }

  if (issue.status !== ISSUE_STATUS.RESOLVED) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Only resolved issues can be deleted from the admin dashboard",
    });
  }

  await Promise.all([
    Assignment.deleteMany({ issueId: issue._id }),
    Comment.deleteMany({ issueId: issue._id }),
    AITrainingFeedback.deleteMany({ issueId: issue._id }),
    Issue.deleteOne({ _id: issue._id }),
  ]);

  invalidatePrefix("admin:");
  invalidatePrefix("ai:");

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Resolved issue deleted successfully",
  });
});

const createWorker = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      errors: errors.array(),
    });
  }

  const { name, email, password, phone } = req.body;
  const existingUser = await User.findOne({ email: email.toLowerCase() });

  if (existingUser) {
    return res.status(StatusCodes.CONFLICT).json({
      success: false,
      message: "Email is already registered",
    });
  }

  const worker = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    phone,
    role: ROLES.WORKER,
  });
  invalidatePrefix("admin:");

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Worker account created successfully",
    worker: worker.toSafeObject(),
  });
});

module.exports = {
  getAllIssues,
  assignIssue,
  updateIssueStatus,
  getDashboardStats,
  getWorkers,
  createWorker,
  exportIssuesCsv,
  getAiTrainingCenter,
  submitAiTrainingFeedback,
  deleteResolvedIssue,
};
