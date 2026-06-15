const express = require("express");

const { getMyNotifications, markNotificationRead } = require("../controllers/notificationController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.get("/", getMyNotifications);
router.put("/:id/read", markNotificationRead);

module.exports = router;
