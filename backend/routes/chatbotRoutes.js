const express = require("express");

const { postMessage } = require("../controllers/chatbotController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.post("/message", postMessage);

module.exports = router;
