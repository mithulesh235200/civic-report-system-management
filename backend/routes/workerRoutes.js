const express = require("express");
const { body } = require("express-validator");

const { getWorkerTasks, completeTask, updateWorkerPresence } = require("../controllers/workerController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.use(authorize("worker"));

router.get("/tasks", getWorkerTasks);
router.put(
  "/presence",
  [
    body("availability")
      .optional()
      .isIn(["available", "busy", "offline"])
      .withMessage("Availability must be available, busy, or offline"),
    body("latitude").optional().isFloat().withMessage("Latitude must be valid"),
    body("longitude").optional().isFloat().withMessage("Longitude must be valid"),
  ],
  updateWorkerPresence
);
router.put(
  "/complete",
  [body("issueId").notEmpty().withMessage("Issue ID is required")],
  completeTask
);

module.exports = router;
