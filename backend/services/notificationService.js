const Notification = require("../models/Notification");
const { invalidatePrefix } = require("./cacheService");

const createNotificationForUsers = async ({ userIds, message, type }) => {
  const filteredUserIds = [...new Set((userIds || []).filter(Boolean).map((id) => String(id?._id || id?.id || id)))];

  if (!filteredUserIds.length) {
    return [];
  }

  const docs = filteredUserIds.map((userId) => ({
    userId,
    message,
    type,
  }));

  const inserted = await Notification.insertMany(docs);
  filteredUserIds.forEach((userId) => invalidatePrefix(`notifications:${userId}`));
  return inserted;
};

module.exports = {
  createNotificationForUsers,
};
