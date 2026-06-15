const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["unread", "read"],
      default: "unread",
      index: true,
    },
    type: {
      type: String,
      enum: ["issue-status", "assignment", "system", "proof-review"],
      default: "system",
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ userId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
