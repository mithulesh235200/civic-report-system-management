const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const workerProfileSchema = new mongoose.Schema(
  {
    availability: {
      type: String,
      enum: ["available", "busy", "offline"],
      default: "offline",
    },
    lastKnownLocation: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
      },
    },
    lastLocationUpdatedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const notificationPreferencesSchema = new mongoose.Schema(
  {
    statusUpdates: {
      type: Boolean,
      default: true,
    },
    nearbyAlerts: {
      type: Boolean,
      default: true,
    },
    assistantTips: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    passwordHash: {
      type: String,
      select: false,
    },
    role: {
      type: String,
      enum: ["user", "citizen", "admin", "worker"],
      default: "user",
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 280,
    },
    preferredLanguage: {
      type: String,
      enum: ["english", "hinglish"],
      default: "english",
    },
    notificationPreferences: {
      type: notificationPreferencesSchema,
      default: () => ({
        statusUpdates: true,
        nearbyAlerts: true,
        assistantTips: true,
      }),
    },
    refreshTokenHash: {
      type: String,
      select: false,
      default: null,
    },
    workerProfile: {
      type: workerProfileSchema,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ "workerProfile.lastKnownLocation": "2dsphere" });

userSchema.pre("save", async function encryptPassword(next) {
  if (this.role === "citizen") {
    this.role = "user";
  }

  if (!this.password && this.passwordHash) {
    this.password = this.passwordHash;
  }

  if (this.role !== "worker") {
    this.workerProfile = undefined;
  } else if (!this.workerProfile) {
    this.workerProfile = {
      availability: "offline",
      lastLocationUpdatedAt: null,
    };
  }

  const coordinates = this.workerProfile?.lastKnownLocation?.coordinates;
  const hasValidCoordinates = Array.isArray(coordinates) && coordinates.length === 2;

  if (!hasValidCoordinates && this.workerProfile) {
    this.workerProfile.lastKnownLocation = null;
    this.workerProfile.lastLocationUpdatedAt = null;
  }

  if (!this.isModified("password")) {
    if (this.password && this.passwordHash !== this.password) {
      this.passwordHash = this.password;
    }
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordHash = this.password;
  next();
});

userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password || this.passwordHash);
};

userSchema.methods.getPortalRole = function getPortalRole() {
  return this.role === "citizen" ? "user" : this.role;
};

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.getPortalRole(),
    phone: this.phone,
    avatar: this.avatar,
    address: this.address,
    bio: this.bio,
    preferredLanguage: this.preferredLanguage,
    notificationPreferences: this.notificationPreferences,
    workerProfile: this.getPortalRole() === "worker" ? this.workerProfile : undefined,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model("User", userSchema);
