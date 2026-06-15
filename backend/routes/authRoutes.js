const express = require("express");
const { body } = require("express-validator");

const {
  register,
  login,
  getMe,
  updateProfile,
  refreshSession,
  logout,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long"),
  ],
  register
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
    body("portal")
      .optional()
      .isIn(["user", "admin", "worker"])
      .withMessage("Portal must be user, admin, or worker"),
  ],
  login
);

router.post("/refresh", refreshSession);
router.get("/me", protect, getMe);
router.put("/profile", protect, updateProfile);
router.post("/logout", logout);

module.exports = router;
