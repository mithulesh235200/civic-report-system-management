const { StatusCodes } = require("http-status-codes");

const asyncHandler = require("../middleware/asyncHandler");
const Notification = require("../models/Notification");
const { getOrSet, invalidatePrefix } = require("../services/cacheService");

const userIdOf = (value) => String(value?._id || value?.id || value);

const getMyNotifications = asyncHandler(async (req, res) => {
  const userId = userIdOf(req.user);
  const notifications = await getOrSet(`notifications:${userId}`, 15000, async () =>
    Notification.listByUser(userId, 100)
  );

  res.status(StatusCodes.OK).json({
    success: true,
    notifications,
  });
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.markRead(req.params.id, userIdOf(req.user));

  if (!notification) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: "Notification not found",
    });
  }

  invalidatePrefix(`notifications:${userIdOf(req.user)}`);

  res.status(StatusCodes.OK).json({
    success: true,
    notification,
  });
});

module.exports = {
  getMyNotifications,
  markNotificationRead,
};
