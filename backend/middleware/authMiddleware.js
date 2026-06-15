const jwt = require("jsonwebtoken");
const { StatusCodes } = require("http-status-codes");

const User = require("../models/User");
const asyncHandler = require("./asyncHandler");

const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies.accessToken;
  const bearerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!cookieToken && !bearerToken) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: "Authentication token is required",
    });
  }

  const token = bearerToken || cookieToken;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "User no longer exists",
      });
    }

    if (typeof user.getPortalRole === "function") {
      user.role = user.getPortalRole();
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
});

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(StatusCodes.FORBIDDEN).json({
      success: false,
      message: "You are not authorized to access this resource",
    });
  }

  next();
};

module.exports = {
  protect,
  authorize,
};
