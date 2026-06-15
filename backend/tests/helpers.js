const User = require("../models/User");

const createUserAndToken = async (overrides = {}) => {
  const user = await User.create({
    name: overrides.name || "Test User",
    email: overrides.email || `user${Date.now()}@example.com`,
    password: overrides.password || "Password@123",
    role: overrides.role || "user",
    phone: overrides.phone || "",
  });

  const tokenPayload = {
    email: user.email,
    password: overrides.password || "Password@123",
    portal: user.role,
  };

  return { user, tokenPayload };
};

module.exports = {
  createUserAndToken,
};
