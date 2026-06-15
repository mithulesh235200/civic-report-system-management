const emitToUsers = (app, userIds, eventName, payload) => {
  const io = app.get("io");

  if (!io) {
    return;
  }

  userIds.filter(Boolean).forEach((userId) => {
    io.to(`user:${userId}`).emit(eventName, payload);
  });
};

module.exports = {
  emitToUsers,
};
