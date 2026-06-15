const { StatusCodes } = require("http-status-codes");
const { validationResult } = require("express-validator");

const asyncHandler = require("../middleware/asyncHandler");
const Issue = require("../models/Issue");
const Comment = require("../models/Comment");
const { analyzeIssue, findNearbyDuplicate, generateIssueDraft } = require("../services/aiService");
const { invalidatePrefix } = require("../services/cacheService");
const { createNotificationForUsers } = require("../services/notificationService");
const { emitToUsers } = require("../services/socketService");
const { uploadImage } = require("../services/imageService");
const { ISSUE_STATUS } = require("../utils/constants");

const buildAiInsights = (analysis, duplicate) => ({
  predictedCategory: analysis.predictedCategory,
  predictedSeverity: analysis.predictedSeverity,
  imageSummary: analysis.imageSummary,
  categoryReason: analysis.categoryReason,
  severityReason: analysis.severityReason,
  recommendedAction: analysis.recommendedAction,
  confidenceScore: analysis.confidenceScore,
  citizenGuidance: analysis.citizenGuidance,
  workerBrief: analysis.workerBrief,
  priorityBand: analysis.priorityBand,
  suggestedSlaHours: analysis.suggestedSlaHours,
  estimatedResolutionEta: analysis.estimatedResolutionEta,
  likelyDepartment: analysis.likelyDepartment,
  citizenSummary: analysis.citizenSummary,
  adminSummary: analysis.adminSummary,
  learningMode: analysis.learningMode,
  supervisedLabel: analysis.supervisedLabel,
  unsupervisedPattern: analysis.unsupervisedPattern,
  semisupervisedConfidence: analysis.semisupervisedConfidence,
  adaptiveStrategy: analysis.adaptiveStrategy,
  historicalPatternSummary: analysis.historicalPatternSummary,
  retrievalConfidence: analysis.retrievalConfidence,
  similarIssueTitles: analysis.similarIssueTitles,
  duplicate,
});

const buildUserAiContext = (user) => ({
  preferredLanguage: user?.preferredLanguage || "english",
  homeAddress: user?.address || "",
  name: user?.name || "",
});

const isGeoIndexReadinessError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("unable to find index for $geo") ||
    message.includes("unable to find index for geo") ||
    message.includes("2dsphere index") ||
    message.includes("$near")
  );
};

const analyzeDraft = asyncHandler(async (req, res) => {
  const { title, description, image, category, latitude, longitude } = req.body;
  const storedImage = await uploadImage(image, "civictrack/draft-analysis");

  const analysis = await analyzeIssue({
    title: title || "",
    description: description || "",
    image: storedImage,
    userContext: buildUserAiContext(req.user),
  });

  const duplicate =
    latitude && longitude
      ? await findNearbyDuplicate({
          category: analysis.predictedCategory || category || "other",
          longitude: Number(longitude),
          latitude: Number(latitude),
        })
      : null;

  res.status(StatusCodes.OK).json({
    success: true,
    analysis: buildAiInsights(analysis, duplicate),
  });
});

const composeDraft = asyncHandler(async (req, res) => {
  const { category, address, image, notes, language } = req.body;
  const storedImage = await uploadImage(image, "civictrack/draft-composer");
  const draft = await generateIssueDraft({
    category,
    address,
    image: storedImage,
    notes,
    language,
    userContext: buildUserAiContext(req.user),
  });

  res.status(StatusCodes.OK).json({
    success: true,
    draft,
  });
});

const createIssue = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      errors: errors.array(),
    });
  }

  const { title, description, image, category, address, latitude, longitude } = req.body;
  const storedImage = await uploadImage(image, "civictrack/issues");

  const analysis = await analyzeIssue({
    title,
    description,
    image: storedImage,
    userContext: buildUserAiContext(req.user),
  });

  const duplicate = await findNearbyDuplicate({
    category: analysis.predictedCategory || category,
    longitude: Number(longitude),
    latitude: Number(latitude),
  });

  const issue = await Issue.create({
    title,
    description,
    image: storedImage,
    category: analysis.predictedCategory || category,
    severity: analysis.predictedSeverity || "medium",
    address,
    location: {
      type: "Point",
      coordinates: [Number(longitude), Number(latitude)],
    },
    reportedBy: req.user._id,
    aiAnalysis: {
      predictedCategory: analysis.predictedCategory,
      predictedSeverity: analysis.predictedSeverity,
      duplicateScore: duplicate?.duplicateScore ?? analysis.duplicateScore ?? 0,
      duplicateIssueId: duplicate?.issueId || null,
      imageSummary: analysis.imageSummary,
      categoryReason: analysis.categoryReason,
      severityReason: analysis.severityReason,
      recommendedAction: analysis.recommendedAction,
      confidenceScore: analysis.confidenceScore,
      citizenGuidance: analysis.citizenGuidance,
      workerBrief: analysis.workerBrief,
      priorityBand: analysis.priorityBand,
      suggestedSlaHours: analysis.suggestedSlaHours,
      estimatedResolutionEta: analysis.estimatedResolutionEta,
      likelyDepartment: analysis.likelyDepartment,
      citizenSummary: analysis.citizenSummary,
      adminSummary: analysis.adminSummary,
      learningMode: analysis.learningMode,
      supervisedLabel: analysis.supervisedLabel,
      unsupervisedPattern: analysis.unsupervisedPattern,
      semisupervisedConfidence: analysis.semisupervisedConfidence,
      adaptiveStrategy: analysis.adaptiveStrategy,
      historicalPatternSummary: analysis.historicalPatternSummary,
      retrievalConfidence: analysis.retrievalConfidence,
      similarIssueTitles: analysis.similarIssueTitles,
    },
  });
  invalidatePrefix("admin:");
  invalidatePrefix("ai:");

  const populatedIssue = await Issue.findById(issue._id)
    .populate("reportedBy", "name email role")
    .lean();

  const payload = {
    success: true,
    message: duplicate ? "Issue reported. Similar nearby issue detected." : "Issue reported successfully",
    issue: populatedIssue,
    duplicate,
    analysis: buildAiInsights(analysis, duplicate),
  };

  return res.status(StatusCodes.CREATED).json(payload);
});

const getMyIssues = asyncHandler(async (req, res) => {
  const issues = await Issue.find({ reportedBy: req.user._id })
    .populate("assignedWorker", "name email")
    .sort({ createdAt: -1 })
    .lean();

  res.status(StatusCodes.OK).json({
    success: true,
    issues,
  });
});

const getIssueById = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id)
    .populate("reportedBy", "name email role")
    .populate("assignedWorker", "name email role")
    .populate("supporters", "name email")
    .lean();

  if (!issue) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: "Issue not found",
    });
  }

  const isOwner = String(issue.reportedBy._id) === String(req.user._id);
  const isSupporter = issue.supporters.some((supporter) => String(supporter._id) === String(req.user._id));
  if (!isOwner && !isSupporter) {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: "You can only access issues you reported or joined",
    });
  }

  const comments = await Comment.find({ issueId: issue._id })
    .populate("userId", "name role")
    .sort({ createdAt: 1 })
    .lean();

  res.status(StatusCodes.OK).json({
    success: true,
    issue,
    comments,
  });
});

const joinIssue = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id)
    .populate("reportedBy", "name email")
    .populate("supporters", "name email");

  if (!issue) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: "Issue not found",
    });
  }

  if (String(issue.reportedBy._id) === String(req.user._id)) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "You already reported this issue",
    });
  }

  const alreadySupporting = issue.supporters.some((supporter) => String(supporter._id) === String(req.user._id));
  if (alreadySupporting) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "You already joined this issue",
    });
  }

  issue.supporters.push(req.user._id);
  await issue.save();
  invalidatePrefix("admin:");

  await createNotificationForUsers({
    userIds: [issue.reportedBy._id],
    message: `${req.user.name} also reported concern for issue "${issue.title}"`,
    type: "system",
  });

  emitToUsers(req.app, [issue.reportedBy._id], "issue:joined", {
    issueId: issue._id,
    joinedBy: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
    },
  });

  const updatedIssue = await Issue.findById(issue._id)
    .populate("reportedBy", "name email role")
    .populate("assignedWorker", "name email role")
    .populate("supporters", "name email")
    .lean();

  res.status(StatusCodes.OK).json({
    success: true,
    message: "You joined the existing issue successfully",
    issue: updatedIssue,
  });
});

const getMapIssues = asyncHandler(async (req, res) => {
  const { category, severity, status } = req.query;
  const query = {
    status: { $ne: ISSUE_STATUS.REJECTED },
  };

  if (category) {
    query.category = category;
  }

  if (severity) {
    query.severity = severity;
  }

  if (status && status !== "all") {
    query.status = status;
  }

  const issues = await Issue.find(
    query,
    "title category severity status location address createdAt"
  )
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  res.status(StatusCodes.OK).json({
    success: true,
    issues,
  });
});

const addComment = asyncHandler(async (req, res) => {
  const { message } = req.body;

  const issue = await Issue.findById(req.params.id);
  if (!issue) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: "Issue not found",
    });
  }

  if (String(issue.reportedBy) !== String(req.user._id)) {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: "You can only comment on your own issues from the citizen portal",
    });
  }

  const comment = await Comment.create({
    issueId: issue._id,
    userId: req.user._id,
    message,
  });
  invalidatePrefix("admin:");

  const populatedComment = await Comment.findById(comment._id).populate("userId", "name role").lean();

  await createNotificationForUsers({
    userIds: [req.user._id],
    message: `Comment added to issue ${issue.title}`,
    type: "system",
  });

  emitToUsers(req.app, [req.user._id], "issue:commented", {
    issueId: issue._id,
    comment: populatedComment,
  });

  res.status(StatusCodes.CREATED).json({
    success: true,
    comment: populatedComment,
  });
});

const getNearbyIssues = asyncHandler(async (req, res) => {
  const longitude = Number(req.query.longitude);
  const latitude = Number(req.query.latitude);
  const radiusInKm = Number(req.query.radiusInKm || 5);

  try {
    const issues = await Issue.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          $maxDistance: radiusInKm * 1000,
        },
      },
    })
      .limit(100)
      .lean();

    res.status(StatusCodes.OK).json({
      success: true,
      issues,
    });
  } catch (error) {
    if (isGeoIndexReadinessError(error)) {
      return res.status(StatusCodes.OK).json({
        success: true,
        issues: [],
      });
    }

    throw error;
  }
});

module.exports = {
  analyzeDraft,
  composeDraft,
  createIssue,
  getMyIssues,
  getIssueById,
  joinIssue,
  getMapIssues,
  addComment,
  getNearbyIssues,
};
