const mongoose = require("mongoose");

const aiTrainingFeedbackSchema = new mongoose.Schema(
  {
    issueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Issue",
      required: true,
      unique: true,
      index: true,
    },
    predictedCategory: {
      type: String,
      trim: true,
    },
    predictedSeverity: {
      type: String,
      trim: true,
    },
    correctedCategory: {
      type: String,
      enum: ["pothole", "garbage", "water-leakage", "streetlight", "road-damage", "other"],
      required: true,
    },
    correctedSeverity: {
      type: String,
      enum: ["low", "medium", "critical"],
      required: true,
    },
    trainingNotes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    confidenceOverride: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },
    correctedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["approved"],
      default: "approved",
      index: true,
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

aiTrainingFeedbackSchema.index({ correctedCategory: 1, correctedSeverity: 1, appliedAt: -1 });

module.exports = mongoose.model("AITrainingFeedback", aiTrainingFeedbackSchema);
