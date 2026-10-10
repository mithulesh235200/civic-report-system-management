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

const userIdOf = (value) => String(value?._id || value?.id || value);

const buildWorkerLoadMap = async () => Assignment.activeLoadMap();

const enrichWorkers = async (workers) => {
  const loadMap = await buildWorkerLoadMap();

  return workers.map((worker) => ({
    id: worker.id || worker._id,
    _id: worker.id || worker._id,
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
    activeAssignments: loadMap.get(String(worker.id || worker._id)) || 0,
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
    issue._id || issue.id,
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
    Issue.listAdmin(req.query)
  );

  res.status(StatusCodes.OK).json({
    success: true,
    issues,
  });
});

const exportIssuesCsv = asyncHandler(async (req, res) => {
  const issues = await getOrSet(`${buildAdminIssueCacheKey(req.query)}:csv-source`, 20000, async () =>
    Issue.listAdmin(req.query)
  );

  const csv = buildIssueCsv(issues);
  const stamp = new Date().toISOString().slice(0, 10);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="civictrack-issues-${stamp}.csv"`);
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

  const [issue, worker] = await Promise.all([Issue.findById(issueId), User.findById(workerId)]);

  if (!issue || !worker || worker.role !== ROLES.WORKER) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: "Issue or worker not found",
    });
  }

  const reporterId = userIdOf(issue.reportedBy);
  await Issue.updateById(issue._id || issue.id, {
    assignedWorker: userIdOf(worker),
    status: ISSUE_STATUS.ASSIGNED,
    verifiedBy: userIdOf(req.user),
  });
  invalidatePrefix("admin:");

  const assignment = await Assignment.create({
    issueId: issue._id || issue.id,
    workerId: userIdOf(worker),
    assignedBy: userIdOf(req.user),
    notes,
    status: "assigned",
  });

  await createNotificationForUsers({
    userIds: [userIdOf(worker), reporterId],
    message: `Issue "${issue.title}" has been assigned to ${worker.name}`,
    type: "assignment",
  });

  emitToUsers(req.app, [userIdOf(worker), reporterId], "issue:assigned", {
    issueId: issue._id || issue.id,
    worker: {
      id: userIdOf(worker),
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

  const updated = await Issue.updateById(issue._id || issue.id, {
    status,
    verifiedBy: userIdOf(req.user),
  });
  invalidatePrefix("admin:");

  const notifyIds = [userIdOf(updated.reportedBy)];
  if (updated.assignedWorker) {
    notifyIds.push(userIdOf(updated.assignedWorker));
  }

  await createNotificationForUsers({
    userIds: notifyIds,
    message: `Issue "${updated.title}" status updated to ${status}`,
    type: "issue-status",
  });

  emitToUsers(req.app, notifyIds, "issue:status-updated", {
    issueId: updated._id || updated.id,
    status,
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Issue status updated successfully",
    issue: updated,
  });
});

const getDashboardStats = asyncHandler(async (req, res) => {
  const stats = await getOrSet("admin:dashboard", 30000, async () => {
    const aggregates = await Issue.dashboardStats();
    const workers = await User.listWorkers();

    const dailyTrend = buildRecentDays(7).map((date) => ({
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: aggregates.trend[`${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`] || 0,
    }));

    const enrichedWorkers = await enrichWorkers(workers);
    const hotspots = aggregates.hotspots.map((item) => ({
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
      totalIssues: aggregates.totalIssues,
      pendingIssues: aggregates.pendingIssues,
      resolvedIssues: aggregates.resolvedIssues,
      categoryBreakdown: aggregates.categoryBreakdown,
      severityBreakdown: aggregates.severityBreakdown,
      dailyTrend,
      hotspots,
      hotspotForecasts,
      topSupportedIssues: aggregates.topSupportedIssues,
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
    const workers = await User.listWorkers();
    return enrichWorkers(workers);
  });

  res.status(StatusCodes.OK).json({
    success: true,
    workers: enrichedWorkers,
  });
});

const getAiTrainingCenter = asyncHandler(async (req, res) => {
  const training = await getOrSet("admin:ai-training", 20000, async () => {
    const [feedbackCounts, feedbackItems, lowConfidenceIssues] = await Promise.all([
      AITrainingFeedback.counts(),
      AITrainingFeedback.recentList(8),
      Issue.lowConfidenceReview(10),
    ]);

    const reviewQueue = lowConfidenceIssues.map((issue) => {
      const ai = issue.ai_analysis || issue.aiAnalysis || {};
      return {
        id: issue.id || issue._id,
        title: issue.title,
        currentCategory: issue.category,
        currentSeverity: issue.severity,
        status: issue.status,
        address: issue.address,
        predictedCategory: ai.predictedCategory || issue.category,
        predictedSeverity: ai.predictedSeverity || issue.severity,
        confidenceScore: ai.confidenceScore || 0,
        semisupervisedConfidence: ai.semisupervisedConfidence || 0,
        retrievalConfidence: ai.retrievalConfidence || 0,
        historicalPatternSummary: ai.historicalPatternSummary || "",
      };
    });

    return {
      stats: {
        totalFeedback: feedbackCounts.total,
        recentFeedback: feedbackCounts.recent,
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

  const feedback = await AITrainingFeedback.upsertByIssue({
    issueId: issue._id || issue.id,
    predictedCategory: issue.aiAnalysis?.predictedCategory || issue.category,
    predictedSeverity: issue.aiAnalysis?.predictedSeverity || issue.severity,
    correctedCategory,
    correctedSeverity,
    trainingNotes: trainingNotes || "",
    confidenceOverride:
      confidenceOverride === undefined || confidenceOverride === null || confidenceOverride === ""
        ? null
        : Number(confidenceOverride),
    correctedBy: userIdOf(req.user),
  });

  await Issue.updateById(issue._id || issue.id, {
    category: correctedCategory,
    severity: correctedSeverity,
    aiAnalysis: {
      ...(issue.aiAnalysis || {}),
      trainingFeedbackCount: 1,
      manualReviewApplied: true,
      lastTrainingUpdateAt: new Date().toISOString(),
    },
  });
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

  const issueId = issue._id || issue.id;
  await Promise.all([
    Assignment.deleteByIssue(issueId),
    Comment.deleteByIssue(issueId),
    AITrainingFeedback.deleteByIssue(issueId),
    Issue.deleteById(issueId),
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
  const existingUser = await User.findByEmail(email.toLowerCase());

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
