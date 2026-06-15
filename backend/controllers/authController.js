const { validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const { StatusCodes } = require("http-status-codes");

const User = require("../models/User");
const asyncHandler = require("../middleware/asyncHandler");
const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  setAuthCookies,
  clearAuthCookies,
} = require("../services/tokenService");

const sendAuthResponse = async (res, user, statusCode) => {
  const normalizedRole = typeof user.getPortalRole === "function" ? user.getPortalRole() : user.role;
  const tokenPayload = {
    userId: user._id,
    role: normalizedRole,
    email: user.email,
  };
  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  await User.updateOne({ _id: user._id }, { $set: { refreshTokenHash: hashToken(refreshToken) } });
  setAuthCookies(res, accessToken, refreshToken);

  return res.status(statusCode).json({
    success: true,
    message: "Authentication successful",
    token: accessToken,
    user: user.toSafeObject(),
  });
};

const register = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      errors: errors.array(),
    });
  }

  const { name, email, password, role } = req.body;

  if (role && role !== "user") {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: "Public registration is limited to citizen users",
    });
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return res.status(StatusCodes.CONFLICT).json({
      success: false,
      message: "Email is already registered",
    });
  }

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    role: "user",
  });

  return sendAuthResponse(res, user, StatusCodes.CREATED);
});

const login = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      errors: errors.array(),
    });
  }

  const { email, password, portal } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() }).select("+password +passwordHash +refreshTokenHash");
  if (!user) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  const normalizedRole = typeof user.getPortalRole === "function" ? user.getPortalRole() : user.role;

  if (portal === "admin" && normalizedRole !== "admin") {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: "This account cannot access the admin portal",
    });
  }

  if (portal === "worker" && normalizedRole !== "worker") {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: "This account cannot access the worker portal",
    });
  }

  if (portal === "user" && normalizedRole !== "user") {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: "This account cannot access the citizen portal",
    });
  }

  return sendAuthResponse(res, user, StatusCodes.OK);
});

const getMe = asyncHandler(async (req, res) => {
  return res.status(StatusCodes.OK).json({
    success: true,
    user: req.user.toSafeObject(),
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, avatar, address, bio, preferredLanguage, notificationPreferences } = req.body;

  req.user.name = name ?? req.user.name;
  req.user.phone = phone ?? req.user.phone;
  req.user.avatar = avatar ?? req.user.avatar;
  req.user.address = address ?? req.user.address;
  req.user.bio = bio ?? req.user.bio;
  req.user.preferredLanguage = preferredLanguage || req.user.preferredLanguage;

  if (notificationPreferences) {
    req.user.notificationPreferences = {
      ...req.user.notificationPreferences?.toObject?.(),
      ...req.user.notificationPreferences,
      ...notificationPreferences,
    };
  }

  await req.user.save();

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Profile updated successfully",
    user: req.user.toSafeObject(),
  });
});

const refreshSession = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: "Refresh token is required",
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("+refreshTokenHash");

    if (!user || user.refreshTokenHash !== hashToken(refreshToken)) {
      clearAuthCookies(res);
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    return sendAuthResponse(res, user, StatusCodes.OK);
  } catch (error) {
    clearAuthCookies(res);
    return res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: "Invalid or expired refresh token",
    });
  }
});

const logout = asyncHandler(async (req, res) => {
  if (req.user) {
    await User.updateOne({ _id: req.user._id }, { $set: { refreshTokenHash: null } });
  } else if (req.cookies.refreshToken) {
    try {
      const decoded = jwt.verify(req.cookies.refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
      await User.updateOne({ _id: decoded.userId }, { $set: { refreshTokenHash: null } });
    } catch (error) {
      // Ignore invalid refresh tokens during logout.
    }
  }

  clearAuthCookies(res);
  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Logged out successfully",
  });
});

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  refreshSession,
  logout,
};
