const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema(
  {
    issueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Issue",
      required: true,
      index: true,
    },
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["assigned", "accepted", "completed"],
      default: "assigned",
    },
  },
  {
    timestamps: true,
  }
);

assignmentSchema.index({ workerId: 1, status: 1, createdAt: -1 });
assignmentSchema.index({ issueId: 1, workerId: 1, createdAt: -1 });

module.exports = mongoose.model("Assignment", assignmentSchema);
