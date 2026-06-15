const express = require("express");
const { body } = require("express-validator");

const {
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
} = require("../controllers/adminController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(authorize("admin"));

router.get("/dashboard", getDashboardStats);
router.get("/workers", getWorkers);
router.get("/ai-training", getAiTrainingCenter);
router.get("/issues/export", exportIssuesCsv);
router.post(
  "/workers",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
    body("phone").optional().trim(),
  ],
  createWorker
);
router.get("/issues", getAllIssues);
router.delete("/issues/:id", deleteResolvedIssue);
router.put(
  "/assign",
  [
    body("issueId").notEmpty().withMessage("Issue ID is required"),
    body("workerId").notEmpty().withMessage("Worker ID is required"),
  ],
  assignIssue
);
router.put(
  "/status",
  [
    body("issueId").notEmpty().withMessage("Issue ID is required"),
    body("status")
      .isIn(["reported", "verified", "assigned", "in-progress", "resolved", "rejected"])
      .withMessage("Valid status is required"),
  ],
  updateIssueStatus
);
router.post(
  "/ai-training",
  [
    body("issueId").notEmpty().withMessage("Issue ID is required"),
    body("correctedCategory")
      .isIn(["pothole", "garbage", "water-leakage", "streetlight", "road-damage", "other"])
      .withMessage("Valid corrected category is required"),
    body("correctedSeverity")
      .isIn(["low", "medium", "critical"])
      .withMessage("Valid corrected severity is required"),
    body("trainingNotes").optional().trim().isLength({ max: 500 }).withMessage("Training notes must be under 500 characters"),
    body("confidenceOverride").optional({ values: "falsy" }).isFloat({ min: 0, max: 1 }).withMessage("Confidence override must be between 0 and 1"),
  ],
  submitAiTrainingFeedback
);

module.exports = router;
