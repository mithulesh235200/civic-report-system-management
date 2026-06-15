const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const parseDurationToMs = (value, fallback) => {
  const duration = value || fallback;
  const match = /^(\d+)([smhd])$/.exec(duration);

  if (!match) {
    return fallback;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  }[unit];

  return amount * multiplier;
};

const generateAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
  });

const generateRefreshToken = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
  });

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const getCookieOptions = (maxAge) => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.COOKIE_SECURE === "true",
  maxAge,
});

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie(
    "accessToken",
    accessToken,
    getCookieOptions(parseDurationToMs(process.env.ACCESS_TOKEN_EXPIRES_IN, "15m"))
  );
  res.cookie(
    "refreshToken",
    refreshToken,
    getCookieOptions(parseDurationToMs(process.env.REFRESH_TOKEN_EXPIRES_IN, "7d"))
  );
};

const clearAuthCookies = (res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  setAuthCookies,
  clearAuthCookies,
};
