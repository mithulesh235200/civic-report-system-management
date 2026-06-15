const { StatusCodes } = require("http-status-codes");

const asyncHandler = require("../middleware/asyncHandler");
const Notification = require("../models/Notification");
const { getOrSet, invalidatePrefix } = require("../services/cacheService");

const getMyNotifications = asyncHandler(async (req, res) => {
  const notifications = await getOrSet(`notifications:${req.user._id}`, 15000, async () =>
    Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
  );

  res.status(StatusCodes.OK).json({
    success: true,
    notifications,
  });
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({ _id: req.params.id, userId: req.user._id });

  if (!notification) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: "Notification not found",
    });
  }

  notification.status = "read";
  await notification.save();
  invalidatePrefix(`notifications:${req.user._id}`);

  res.status(StatusCodes.OK).json({
    success: true,
    notification,
  });
});

module.exports = {
  getMyNotifications,
  markNotificationRead,
};
