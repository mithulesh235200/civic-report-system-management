const express = require("express");
const { body, query } = require("express-validator");

const {
  analyzeDraft,
  composeDraft,
  createIssue,
  getMyIssues,
  getIssueById,
  joinIssue,
  getMapIssues,
  addComment,
  getNearbyIssues,
} = require("../controllers/issueController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.get(
  "/map",
  [
    query("longitude").optional().isFloat(),
    query("latitude").optional().isFloat(),
  ],
  getMapIssues
);
router.get(
  "/nearby",
  [
    query("longitude").isFloat().withMessage("Longitude is required"),
    query("latitude").isFloat().withMessage("Latitude is required"),
    query("radiusInKm").optional().isFloat({ min: 0.1, max: 25 }),
  ],
  getNearbyIssues
);

router.use(protect);
router.use(authorize("user"));

router.post("/compose", composeDraft);
router.post("/analyze", analyzeDraft);
router.post(
  "/",
  [
    body("title").trim().notEmpty().withMessage("Title is required"),
    body("description").trim().notEmpty().withMessage("Description is required"),
    body("category")
      .isIn(["pothole", "garbage", "water-leakage", "streetlight", "road-damage", "other"])
      .withMessage("Valid category is required"),
    body("latitude").isFloat().withMessage("Latitude is required"),
    body("longitude").isFloat().withMessage("Longitude is required"),
  ],
  createIssue
);
router.get("/my", getMyIssues);
router.post("/:id/join", joinIssue);
router.post("/:id/comments", [body("message").trim().notEmpty().withMessage("Message is required")], addComment);
router.get("/:id", getIssueById);

module.exports = router;
