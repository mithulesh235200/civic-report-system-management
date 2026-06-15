import { useMemo, useState } from "react";

import { sendChatMessage } from "../services/chatbot";

const quickPromptsByRole = {
  user: [
    "Help me write a strong pothole complaint",
    "How do I track my report status?",
    "When should I join an existing issue?",
  ],
  admin: [
    "How should I prioritize critical complaints?",
    "Explain the best worker assignment workflow",
    "How can I use hotspots and analytics better?",
  ],
  worker: [
    "How do I close a task correctly?",
    "What should my proof image show?",
    "How should I prioritize nearby assignments?",
  ],
};

const issueQuickPrompts = [
  "Explain this issue to me",
  "What should happen next for this issue?",
  "Why is this issue marked this way?",
];

const welcomeByRole = {
  user:
    "I can help you write clearer issue reports, understand statuses, avoid duplicates, and use map and notification features.",
  admin:
    "I can help you triage issues, interpret analytics, prioritize by severity, and manage worker assignments.",
  worker:
    "I can help you understand tasks, field proof expectations, and the best way to complete assignments properly.",
};

const assistantTaglineByRole = {
  user: "Citizen AI guidance for reporting, tracking, and duplicate-safe action.",
  admin: "Operations AI guidance for triage, dispatch, and proof review.",
  worker: "Field AI guidance for task execution, proof quality, and safe closure.",
};

const ChatbotPanel = ({ user, issueContext = null, compact = false }) => {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: issueContext
        ? `I can answer questions about "${issueContext.title}" using its current status, AI guidance, and workflow context.`
        : welcomeByRole[user.role] || "How can I help you with CivicTrack today?",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const quickPrompts = useMemo(
    () => (issueContext ? issueQuickPrompts : quickPromptsByRole[user.role] || []),
    [issueContext, user.role]
  );

  const submitMessage = async (content) => {
    const trimmed = content.trim();
    if (!trimmed || loading) {
      return;
    }

    const nextMessages = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setDraft("");
    setError("");
    setLoading(true);

    try {
      const response = await sendChatMessage({
        message: trimmed,
        issueId: issueContext?.id,
        history: nextMessages.slice(-6).map((item) => ({
          role: item.role,
          content: item.content,
        })),
      });

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: response.reply.answer,
          suggestions: response.reply.suggestions || [],
          source: response.reply.source,
        },
      ]);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Chatbot request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await submitMessage(draft);
  };

  return (
    <div className={`grid gap-6 ${compact ? "lg:grid-cols-1" : "lg:grid-cols-[0.9fr_1.1fr]"}`}>
      <section className="rounded-[32px] bg-white p-6 shadow-card">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-civic">Civic AI Assistant</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-ink">Ask for guidance, not guesswork.</h2>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          {issueContext
            ? `Current issue context: ${issueContext.title}${issueContext.status ? ` (${issueContext.status})` : ""}`
            : welcomeByRole[user.role]}
        </p>
        <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          {issueContext ? "Issue-aware AI guidance with shared civic reasoning and role-specific context." : assistantTaglineByRole[user.role]}
        </div>
        <div className="mt-6 space-y-3">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => submitMessage(prompt)}
              className="block w-full rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-civic hover:bg-civic/5"
            >
              {prompt}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[32px] bg-white p-6 shadow-card">
        <div className="flex h-[560px] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm leading-7 ${
                  message.role === "user"
                    ? "ml-auto bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                <p>{message.content}</p>
                {message.role === "assistant" && (
                  <p className="mt-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                    {message.source === "openai" ? "AI model reply" : "CivicTrack tuned assistant"}
                  </p>
                )}
                {message.role === "assistant" && message.suggestions?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => submitMessage(suggestion)}
                        className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3 border-t border-slate-200 pt-4">
            <textarea
              className="min-h-28 w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-civic"
              placeholder="Ask about reporting, status tracking, assignment workflow, duplicate issues, maps, or field tasks..."
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {loading ? "Thinking..." : "Role-aware assistant"}
              </p>
              <button
                type="submit"
                disabled={loading || !draft.trim()}
                className="rounded-full bg-civic px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
};

export default ChatbotPanel;
