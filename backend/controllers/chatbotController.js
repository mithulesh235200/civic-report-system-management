const { StatusCodes } = require("http-status-codes");

const asyncHandler = require("../middleware/asyncHandler");
const { buildChatContext, generateChatResponse } = require("../services/chatbotService");

const postMessage = asyncHandler(async (req, res) => {
  const { message, history = [], issueId = null } = req.body;
  const trimmedMessage = message?.trim();

  if (!trimmedMessage) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Message is required",
    });
  }

  const sanitizedHistory = Array.isArray(history)
    ? history
        .slice(-6)
        .filter((item) => item && ["user", "assistant", "system"].includes(item.role) && item.content)
        .map((item) => ({
          role: item.role,
          content: String(item.content).slice(0, 1000),
        }))
    : [];

  const context = await buildChatContext(req.user, { issueId });
  const reply = await generateChatResponse({
    user: req.user.toSafeObject(),
    message: trimmedMessage,
    history: sanitizedHistory,
    context,
  });

  return res.status(StatusCodes.OK).json({
    success: true,
    reply,
  });
});

module.exports = {
  postMessage,
};
