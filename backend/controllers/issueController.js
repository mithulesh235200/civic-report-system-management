const { StatusCodes } = require("http-status-codes");
const { validationResult } = require("express-validator");

const asyncHandler = require("../middleware/asyncHandler");
const Issue = require("../models/Issue");
const Comment = require("../models/Comment");
const User = require("../models/User");
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

const userIdOf = (user) => String(user?._id || user?.id);

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
    longitude: Number(longitude),
    latitude: Number(latitude),
    reportedBy: userIdOf(req.user),
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

  const populatedIssue = await Issue.findByIdPopulated(issue._id || issue.id);

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
  const issues = await Issue.listByReporter(userIdOf(req.user));

  res.status(StatusCodes.OK).json({
    success: true,
    issues,
  });
});

const getIssueById = asyncHandler(async (req, res) => {
  const issue = await Issue.findByIdPopulated(req.params.id);

  if (!issue) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: "Issue not found",
    });
  }

  const reporterId = String(issue.reportedBy?._id || issue.reportedBy?.id || issue.reportedBy);
  const isOwner = reporterId === userIdOf(req.user);
  const isSupporter = (issue.supporters || []).some(
    (supporter) => String(supporter?._id || supporter?.id || supporter) === userIdOf(req.user)
  );
  if (!isOwner && !isSupporter) {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: "You can only access issues you reported or joined",
    });
  }

  const comments = await Comment.listByIssue(issue._id || issue.id);

  res.status(StatusCodes.OK).json({
    success: true,
    issue,
    comments,
  });
});

const joinIssue = asyncHandler(async (req, res) => {
  const issue = await Issue.findById(req.params.id);

  if (!issue) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: "Issue not found",
    });
  }

  const reporterId = String(issue.reportedBy?._id || issue.reportedBy?.id || issue.reportedBy);
  if (reporterId === userIdOf(req.user)) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "You already reported this issue",
    });
  }

  const alreadySupporting = (issue.supporters || []).some(
    (supporter) => String(supporter?._id || supporter?.id || supporter) === userIdOf(req.user)
  );
  if (alreadySupporting) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "You already joined this issue",
    });
  }

  await Issue.addSupporter(issue._id || issue.id, userIdOf(req.user));
  invalidatePrefix("admin:");

  await createNotificationForUsers({
    userIds: [reporterId],
    message: `${req.user.name} also reported concern for issue "${issue.title}"`,
    type: "system",
  });

  emitToUsers(req.app, [reporterId], "issue:joined", {
    issueId: issue._id || issue.id,
    joinedBy: {
      id: userIdOf(req.user),
      name: req.user.name,
      email: req.user.email,
    },
  });

  const updatedIssue = await Issue.findByIdPopulated(issue._id || issue.id);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "You joined the existing issue successfully",
    issue: updatedIssue,
  });
});

const getMapIssues = asyncHandler(async (req, res) => {
  const { category, severity, status } = req.query;

  const issues = await Issue.listMap({ category, severity, status });

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

  const reporterId = String(issue.reportedBy?._id || issue.reportedBy?.id || issue.reportedBy);
  if (reporterId !== userIdOf(req.user)) {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: "You can only comment on your own issues from the citizen portal",
    });
  }

  const comment = await Comment.create({
    issueId: issue._id || issue.id,
    userId: userIdOf(req.user),
    message,
  });
  invalidatePrefix("admin:");

  const commenter = await User.findById(userIdOf(req.user));
  const populatedComment = {
    ...comment,
    userId: commenter
      ? { _id: commenter.id, id: commenter.id, name: commenter.name, role: commenter.role }
      : comment.userId,
  };

  await createNotificationForUsers({
    userIds: [userIdOf(req.user)],
    message: `Comment added to issue ${issue.title}`,
    type: "system",
  });

  emitToUsers(req.app, [userIdOf(req.user)], "issue:commented", {
    issueId: issue._id || issue.id,
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

  const issues = await Issue.listNearby({ longitude, latitude, radiusKm: radiusInKm });

  res.status(StatusCodes.OK).json({
    success: true,
    issues,
  });
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
