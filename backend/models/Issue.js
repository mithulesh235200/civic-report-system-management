const mongoose = require("mongoose");

const issueSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: ["pothole", "garbage", "water-leakage", "streetlight", "road-damage", "other"],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["low", "medium", "critical"],
      default: "medium",
      index: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    address: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["reported", "verified", "assigned", "in-progress", "resolved", "rejected"],
      default: "reported",
      index: true,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assignedWorker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    aiAnalysis: {
      predictedCategory: String,
      predictedSeverity: String,
      duplicateScore: Number,
      duplicateIssueId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Issue",
      },
      imageSummary: String,
      categoryReason: String,
      severityReason: String,
      recommendedAction: String,
      confidenceScore: Number,
      citizenGuidance: String,
      workerBrief: String,
      priorityBand: String,
      suggestedSlaHours: Number,
      estimatedResolutionEta: String,
      likelyDepartment: String,
      citizenSummary: String,
      adminSummary: String,
      learningMode: String,
      supervisedLabel: String,
      unsupervisedPattern: String,
      semisupervisedConfidence: Number,
      adaptiveStrategy: String,
      historicalPatternSummary: String,
      retrievalConfidence: Number,
      similarIssueTitles: [String],
      trainingFeedbackCount: Number,
      manualReviewApplied: Boolean,
      lastTrainingUpdateAt: Date,
    },
    proofImage: {
      type: String,
      trim: true,
    },
    resolutionNotes: {
      type: String,
      trim: true,
    },
    resolutionVerification: {
      verificationStatus: {
        type: String,
        enum: ["verified", "uncertain", "rejected"],
      },
      confidenceScore: Number,
      summary: String,
      adminRecommendation: String,
      citizenMessage: String,
      source: String,
      reviewedAt: Date,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    supporters: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  }
);

issueSchema.index({ location: "2dsphere" });
issueSchema.index({ status: 1, createdAt: -1 });
issueSchema.index({ reportedBy: 1, createdAt: -1 });
issueSchema.index({ assignedWorker: 1, status: 1, createdAt: -1 });
issueSchema.index({ category: 1, severity: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Issue", issueSchema);
