const { StatusCodes } = require("http-status-codes");
const { validationResult } = require("express-validator");

const asyncHandler = require("../middleware/asyncHandler");
const Assignment = require("../models/Assignment");
const Issue = require("../models/Issue");
const User = require("../models/User");
const { createNotificationForUsers } = require("../services/notificationService");
const { invalidatePrefix } = require("../services/cacheService");
const { emitToUsers } = require("../services/socketService");
const { uploadImage } = require("../services/imageService");
const { buildWorkerBrief, verifyResolutionProof } = require("../services/aiService");
const { ISSUE_STATUS } = require("../utils/constants");

const userIdOf = (value) => String(value?._id || value?.id || value);

const calculateDistanceMeters = (longitudeA, latitudeA, longitudeB, latitudeB) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);
  const lat1 = toRadians(latitudeA);
  const lat2 = toRadians(latitudeB);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLongitude / 2) ** 2;

  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const getWorkerTasks = asyncHandler(async (req, res) => {
  const currentLatitude = req.query.latitude ? Number(req.query.latitude) : null;
  const currentLongitude = req.query.longitude ? Number(req.query.longitude) : null;

  const assignments = await Assignment.listByWorker(userIdOf(req.user));

  const tasks = [];
  for (const assignment of assignments) {
    const issue = await Issue.findByIdPopulated(assignment.issueId);
    if (!issue) {
      continue;
    }
    const reporter = issue.reportedBy;
    const coordinates = issue.location?.coordinates || [];
    const hasLocation = coordinates.length === 2;
    const distanceMeters =
      hasLocation && currentLatitude !== null && currentLongitude !== null
        ? calculateDistanceMeters(currentLongitude, currentLatitude, coordinates[0], coordinates[1])
        : null;

    tasks.push({
      ...assignment,
      issueId: issue,
      distanceMeters,
      aiBrief:
        issue.aiAnalysis?.workerBrief ||
        buildWorkerBrief(issue.category, issue.severity),
    });
  }

  tasks.sort((left, right) => {
    if (left.distanceMeters === null && right.distanceMeters === null) {
      return new Date(right.createdAt) - new Date(left.createdAt);
    }
    if (left.distanceMeters === null) {
      return 1;
    }
    if (right.distanceMeters === null) {
      return -1;
    }
    return left.distanceMeters - right.distanceMeters;
  });

  const stats = {
    totalTasks: tasks.length,
    completedTasks: tasks.filter((task) => task.status === "completed").length,
    activeTasks: tasks.filter((task) => task.status !== "completed").length,
    nearestTaskDistanceMeters: tasks.find((task) => task.distanceMeters !== null)?.distanceMeters || null,
  };

  res.status(StatusCodes.OK).json({
    success: true,
    tasks,
    stats,
  });
});

const completeTask = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      errors: errors.array(),
    });
  }

  const { issueId, proofImage, resolutionNotes } = req.body;
  const storedProofImage = await uploadImage(proofImage, "civictrack/resolutions");

  const assignment = await Assignment.findOne({ issueId, workerId: userIdOf(req.user) });
  if (!assignment) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: "Assigned task not found",
    });
  }

  const issue = await Issue.findById(issueId);
  if (!issue) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: "Issue not found",
    });
  }

  await Assignment.updateStatus(assignment._id || assignment.id, "completed");

  const verification = {
    ...(await verifyResolutionProof({
      issue: {
        title: issue.title,
        description: issue.description,
        category: issue.category,
        severity: issue.severity,
        image: issue.image,
        proofImage: storedProofImage,
        resolutionNotes,
      },
    })),
    reviewedAt: new Date().toISOString(),
  };

  const updatedIssue = await Issue.updateById(issue._id || issue.id, {
    status: ISSUE_STATUS.RESOLVED,
    proofImage: storedProofImage,
    resolutionNotes,
    resolutionVerification: verification,
  });
  invalidatePrefix("admin:");
  invalidatePrefix("ai:");

  const adminIds = await User.listAdminIds();
  const needsManualReview = verification?.verificationStatus !== "verified";
  const reporterId = userIdOf(updatedIssue.reportedBy);

  await createNotificationForUsers({
    userIds: [reporterId],
    message: `Issue "${updatedIssue.title}" has been marked resolved by the field worker`,
    type: "issue-status",
  });

  if (needsManualReview) {
    await createNotificationForUsers({
      userIds: adminIds,
      message: `Issue "${updatedIssue.title}" was resolved, but AI recommends manual proof review`,
      type: "proof-review",
    });
  }

  emitToUsers(req.app, [reporterId], "issue:resolved", {
    issueId: updatedIssue._id || updatedIssue.id,
    status: updatedIssue.status,
    proofImage: storedProofImage,
    resolutionNotes,
    resolutionVerification: verification,
  });

  if (needsManualReview) {
    emitToUsers(req.app, adminIds, "issue:proof-review-required", {
      issueId: updatedIssue._id || updatedIssue.id,
      verificationStatus: verification?.verificationStatus,
      confidenceScore: verification?.confidenceScore,
    });
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Task marked as resolved",
    issue: updatedIssue,
  });
});

const updateWorkerPresence = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      errors: errors.array(),
    });
  }

  const { availability, latitude, longitude } = req.body;
  const worker = await User.findById(userIdOf(req.user));

  if (!worker) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: "Worker account not found",
    });
  }

  const patch = {};
  if (availability) {
    patch.workerAvailability = availability;
  }

  if (latitude !== undefined && longitude !== undefined) {
    patch.workerLng = Number(longitude);
    patch.workerLat = Number(latitude);
    patch.workerLocationAt = new Date().toISOString();
  }

  const updated = await User.updateById(userIdOf(req.user), patch);
  invalidatePrefix("admin:workers");
  invalidatePrefix("admin:dashboard");

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Worker presence updated",
    worker: updated.toSafeObject(),
  });
});

module.exports = {
  getWorkerTasks,
  completeTask,
  updateWorkerPresence,
};
