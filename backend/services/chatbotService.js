const Issue = require("../models/Issue");

const formatDate = (value) => {
  try {
    return new Date(value).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (error) {
    return "recently";
  }
};

const summarizeIssues = (issues = []) =>
  issues
    .slice(0, 5)
    .map(
      (issue) =>
        `${issue.title} (${issue.category}, ${issue.status}, ${issue.severity}${
          issue.address ? `, ${issue.address}` : ""
        }, ${formatDate(issue.createdAt)})`
    )
    .join("; ");

const buildRoleGuidance = (role) => {
  if (role === "admin") {
    return "You help administrators triage reports, assign workers, prioritize hotspots, review AI proof signals, and plan civic operations.";
  }

  if (role === "worker") {
    return "You help field workers understand assignments, plan visits, capture strong proof, and close tasks carefully.";
  }

  return "You help citizens report issues clearly, avoid duplicates, understand statuses, and ask questions about their own issues.";
};

const buildToneGuidance = (preferredLanguage) =>
  preferredLanguage === "hinglish"
    ? "When helpful, keep the wording simple and natural for a Hinglish-speaking user, but stay professional."
    : "Use clear, professional English that is easy for civic users to follow.";

const buildSharedKnowledge = () => `
Common CivicTrack knowledge:
- Citizens can register publicly, but admin and worker accounts are protected.
- Citizens should use Smart Preview before submitting if they want severity, duplicate, and guidance signals.
- Nearby duplicate issues should usually be joined instead of re-reported.
- Admins verify reports, assign workers, and use hotspot and dispatch guidance.
- Workers should upload proof and good resolution notes before closure.
- AI outputs are guidance signals, not legal or official guarantees.
`;

const summarizeIssueContext = (issueContext) => {
  if (!issueContext) {
    return "No specific issue context was provided.";
  }

  return JSON.stringify({
    id: issueContext.id,
    title: issueContext.title,
    category: issueContext.category,
    severity: issueContext.severity,
    status: issueContext.status,
    address: issueContext.address,
    department: issueContext.likelyDepartment,
    citizenSummary: issueContext.citizenSummary,
    adminSummary: issueContext.adminSummary,
    workerBrief: issueContext.workerBrief,
    proofStatus: issueContext.resolutionVerification?.verificationStatus || null,
    learningMode: issueContext.learningMode,
    historicalPatternSummary: issueContext.historicalPatternSummary,
    retrievalConfidence: issueContext.retrievalConfidence,
    similarIssueTitles: issueContext.similarIssueTitles,
  });
};

const buildSystemPrompt = ({ user, context }) => `
You are CivicTrack Assistant, a concise civic operations chatbot inside the CivicTrack platform.
${buildRoleGuidance(user.role)}
${buildToneGuidance(user.preferredLanguage)}
Keep answers practical, specific, and under 170 words unless details are truly needed.
Never invent portal permissions, issue states, or unseen data.
Never claim that verification, assignment, deletion, training, or resolution has been completed unless that completed state is present in the provided issue/application context. If an admin asks you to perform an action, explain that the dashboard button must complete successfully first and avoid wording like "successfully completed" unless the API has already changed the data.
If a specific issue context is provided, answer with that issue as the primary grounding source.
If the user asks for actions you cannot perform directly, explain the in-app page or workflow to use.

${buildSharedKnowledge()}

Known application context:
- User role: ${user.role}
- User name: ${user.name}
- User preferred language: ${user.preferredLanguage || "english"}
- User home area: ${user.address || "not set"}
- General context summary: ${JSON.stringify(context.general)}
- Active issue context: ${summarizeIssueContext(context.issue)}
`;

const canAccessIssue = (user, issue) => {
  if (!issue) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  if (user.role === "worker") {
    return String(issue.assignedWorker?._id || issue.assignedWorker) === String(user.id || user._id);
  }

  return (
    String(issue.reportedBy?._id || issue.reportedBy) === String(user.id || user._id) ||
    (issue.supporters || []).some((supporter) => String(supporter._id || supporter) === String(user.id || user._id))
  );
};

const normalizeIssueContext = (issue) => {
  if (!issue) {
    return null;
  }

  return {
    id: String(issue._id),
    title: issue.title,
    description: issue.description,
    category: issue.category,
    severity: issue.severity,
    status: issue.status,
    address: issue.address,
    likelyDepartment: issue.aiAnalysis?.likelyDepartment || "General Civic Operations",
    citizenSummary: issue.aiAnalysis?.citizenSummary || null,
    adminSummary: issue.aiAnalysis?.adminSummary || null,
    workerBrief: issue.aiAnalysis?.workerBrief || null,
    recommendedAction: issue.aiAnalysis?.recommendedAction || null,
    learningMode: issue.aiAnalysis?.learningMode || null,
    historicalPatternSummary: issue.aiAnalysis?.historicalPatternSummary || null,
    retrievalConfidence: issue.aiAnalysis?.retrievalConfidence || null,
    similarIssueTitles: issue.aiAnalysis?.similarIssueTitles || [],
    resolutionVerification: issue.resolutionVerification || null,
  };
};

const heuristicIssueReply = ({ user, normalized, issueContext }) => {
  if (!issueContext) {
    return null;
  }

  if (normalized.includes("status") || normalized.includes("what happened") || normalized.includes("update")) {
    return {
      answer: `This issue is currently ${issueContext.status}. It is classified as ${issueContext.severity} ${issueContext.category}${
        issueContext.address ? ` near ${issueContext.address}` : ""
      }. ${issueContext.citizenSummary || ""}`.trim(),
      suggestions: ["What should happen next for this issue?", "Why is this issue marked this way?", "Who should handle this issue?"],
    };
  }

  if (normalized.includes("why") || normalized.includes("reason")) {
    return {
      answer:
        user.role === "admin"
          ? `${issueContext.adminSummary || issueContext.recommendedAction || "The AI summary for this issue is limited right now."}${
              issueContext.historicalPatternSummary ? ` ${issueContext.historicalPatternSummary}` : ""
            }`.trim()
          : `${issueContext.citizenSummary || issueContext.recommendedAction || "The AI summary for this issue is limited right now."}${
              issueContext.historicalPatternSummary ? ` ${issueContext.historicalPatternSummary}` : ""
            }`.trim(),
      suggestions: ["What department should handle it?", "What is the next action?", "Is this issue urgent?"],
    };
  }

  if (normalized.includes("model") || normalized.includes("ai decide") || normalized.includes("learning")) {
    return {
      answer: `This issue was evaluated using ${issueContext.learningMode || "the CivicTrack AI flow"}. ${
        issueContext.historicalPatternSummary || "The current description and category/severity rules were the main signals."
      }${
        issueContext.retrievalConfidence !== null && issueContext.retrievalConfidence !== undefined
          ? ` Retrieval confidence is ${Math.round(issueContext.retrievalConfidence * 100)}%.`
          : ""
      }`,
      suggestions: ["What similar issues influenced this?", "Why is this issue urgent?", "What should happen next for this issue?"],
    };
  }

  if (normalized.includes("similar issue") || normalized.includes("similar issues") || normalized.includes("examples")) {
    return {
      answer: issueContext.similarIssueTitles?.length
        ? `The strongest historical matches were: ${issueContext.similarIssueTitles.join("; ")}.`
        : "No strong historical matches were available for this issue, so the AI relied more on the current report details.",
      suggestions: ["How did the AI use those examples?", "Why is this issue marked this way?", "What should happen next for this issue?"],
    };
  }

  if (normalized.includes("department") || normalized.includes("who should handle")) {
    return {
      answer: `The likely department for this issue is ${issueContext.likelyDepartment}. ${issueContext.recommendedAction || ""}`.trim(),
      suggestions: ["Why was this department suggested?", "What should happen next?", "Is this issue urgent?"],
    };
  }

  if (normalized.includes("proof") || normalized.includes("resolved") || normalized.includes("fixed")) {
    if (!issueContext.resolutionVerification) {
      return {
        answer: "There is no AI proof verification available for this issue yet. That usually means proof has not been uploaded or reviewed yet.",
        suggestions: ["What is the current issue status?", "Who is handling this issue?", "What should happen next?"],
      };
    }

    return {
      answer: `The AI proof review for this issue is ${issueContext.resolutionVerification.verificationStatus} with ${Math.round(
        (issueContext.resolutionVerification.confidenceScore || 0) * 100
      )}% confidence. ${user.role === "admin" ? issueContext.resolutionVerification.adminRecommendation : issueContext.resolutionVerification.citizenMessage}`,
      suggestions: ["Why is proof marked uncertain?", "What should happen next?", "Can this issue be trusted as resolved?"],
    };
  }

  if (normalized.includes("next") || normalized.includes("what should happen")) {
    return {
      answer:
        issueContext.recommendedAction ||
        issueContext.workerBrief ||
        "The next step depends on verification, assignment, and closure progress for this issue.",
      suggestions: ["Who should handle this issue?", "Is this issue urgent?", "What is the current status?"],
    };
  }

  return null;
};

const heuristicReply = ({ user, message, context }) => {
  const normalized = String(message || "").toLowerCase();
  const issueReply = heuristicIssueReply({ user, normalized, issueContext: context.issue });

  if (issueReply) {
    return issueReply;
  }

  if (context.issue && (normalized.includes("explain this") || normalized.includes("this issue"))) {
    return {
      answer:
        user.role === "admin"
          ? context.issue.adminSummary || context.issue.recommendedAction || "This issue has limited AI detail right now."
          : context.issue.citizenSummary || context.issue.recommendedAction || "This issue has limited AI detail right now.",
      suggestions: ["What should happen next for this issue?", "Who should handle this issue?", "Is this issue urgent?"],
    };
  }

  if (normalized.includes("urgent") || normalized.includes("critical") || normalized.includes("priority")) {
    return user.role === "admin"
      ? {
          answer:
            "Treat flooding, dark-road, main-traffic, school-zone, and safety-risk complaints as first priority. Verify quickly, assign the nearest available worker, and watch duplicate pressure from the same hotspot.",
          suggestions: ["How do I triage critical complaints?", "What should I assign first?", "How do I use smart dispatch?"],
        }
      : user.role === "worker"
      ? {
          answer:
            "Start with tasks marked Immediate or high severity. Check public safety first, document the site clearly, and do not mark resolved until you have strong proof and notes.",
          suggestions: ["What proof is strong enough?", "How should I handle a critical task?", "When should I escalate back to admin?"],
        }
      : {
          answer:
            "If the issue is risky or urgent, include the exact location, visible danger, and a photo. Smart Preview helps flag urgency before you submit.",
          suggestions: ["Help me write an urgent report", "What makes a report critical?", "Should I upload a photo?"],
        };
  }

  if (normalized.includes("report") || normalized.includes("complaint") || normalized.includes("issue")) {
    if (user.role === "user") {
      return {
        answer:
          "Open the Report Issue page, add a title, description, category, address, and GPS, then use Auto Write or Smart Preview before submitting. If a nearby duplicate appears, join it instead of creating a new report.",
        suggestions: ["Help me write a pothole report", "How do I avoid duplicate complaints?", "What does Smart Preview do?"],
      };
    }

    if (user.role === "admin") {
      return {
        answer:
          "Use the admin dashboard to review incoming reports, verify legitimacy, assign a worker, and update status. Focus first on critical severity items and repeated hotspots.",
        suggestions: ["How should I triage critical issues?", "Show me admin best practices", "How do I assign a worker?"],
      };
    }

    return {
      answer:
        "Open Worker Tasks to review assigned issues, use the task location to navigate, upload proof once work is complete, and mark the issue resolved with notes.",
      suggestions: ["How do I close a task correctly?", "What proof image should I upload?", "How should I prioritize my tasks?"],
    };
  }

  if (normalized.includes("status") || normalized.includes("track")) {
    if (user.role === "user") {
      return {
        answer: `You currently have ${context.general.totalIssues || 0} reported issues. Recent items: ${
          context.general.recentIssuesSummary || "no recent issues found"
        }. You can track each one from the dashboard or issue details page.`,
        suggestions: ["Explain the issue statuses", "Show me how to track one issue", "Why does assigned differ from in-progress?"],
      };
    }

    if (user.role === "worker") {
      return {
        answer: `You currently have ${context.general.assignedCount || 0} assigned tasks. Recent assignments: ${
          context.general.recentIssuesSummary || "no active tasks found"
        }. ${context.general.criticalCount ? `You also have ${context.general.criticalCount} critical tasks that need extra care. ` : ""}Move tasks from assigned to resolved only after field verification and proof upload.`,
        suggestions: ["What should I do before marking resolved?", "How do I document field proof?", "How do I handle blocked access?"],
      };
    }

    return {
      answer: `There are ${context.general.totalIssues || 0} total issues in the system, with ${
        context.general.pendingIssues || 0
      } still active.${context.general.criticalIssues ? ` ${context.general.criticalIssues} of them are currently critical.` : ""} Recent issue activity: ${
        context.general.recentIssuesSummary || "no recent issue activity available"
      }.`,
      suggestions: ["Summarize pending workload", "How do I reduce backlog?", "Which issues need fast action?"],
    };
  }

  if (normalized.includes("proof") || normalized.includes("resolved") || normalized.includes("verification")) {
    return user.role === "worker"
      ? {
          answer:
            "Good proof should clearly show the completed fix, include short resolution notes, and match the same issue location. Critical issues may still require admin review even after proof upload.",
          suggestions: ["What should my proof photo show?", "How do I write better resolution notes?", "Why did AI mark proof uncertain?"],
        }
      : user.role === "admin"
      ? {
          answer:
            "Review AI proof verification for resolved issues. Verified proof can be spot-checked, but uncertain or rejected proof should be manually reviewed before you fully trust closure.",
          suggestions: ["How do I review doubtful proof?", "What does uncertain mean?", "Which resolved issues need manual review?"],
        }
      : {
          answer:
            "Once a worker marks an issue resolved, CivicTrack can review the proof and update the issue timeline. You can then check the issue detail page for the latest closure status.",
          suggestions: ["How do I know if my issue is resolved?", "What happens after worker completion?", "Where can I see proof status?"],
        };
  }

  if (normalized.includes("duplicate") || normalized.includes("same issue")) {
    return {
      answer:
        "CivicTrack checks nearby issues during Smart Preview. If a related complaint already exists nearby, the citizen should join that issue so support counts grow without creating duplicate records.",
      suggestions: ["How does duplicate detection work?", "When should I join instead?", "Can admins still verify duplicates?"],
    };
  }

  if (normalized.includes("map") || normalized.includes("heatmap")) {
    return {
      answer:
        "Use the Issue Map to explore complaints spatially. Filters let you narrow by category, severity, and status, while the heatmap highlights dense complaint zones that may need coordinated response.",
      suggestions: ["How do I use map filters?", "What does the heatmap mean?", "How can admins use hotspot data?"],
    };
  }

  if (normalized.includes("hello") || normalized.includes("hi") || normalized.includes("help")) {
    return {
      answer:
        user.role === "admin"
          ? "I can help you triage reports, explain dashboard metrics, prioritize by severity, review issue-specific AI notes, and guide assignment workflows."
          : user.role === "worker"
          ? "I can help you understand tasks, issue-specific AI briefs, proof expectations, and the best way to update field progress."
          : "I can help you write better civic reports, understand statuses, ask about a specific issue, avoid duplicates, and use the map and notifications.",
      suggestions:
        user.role === "admin"
          ? ["How should I prioritize complaints?", "Explain dashboard analytics", "How do I assign workers?"]
          : user.role === "worker"
          ? ["How do I complete a task?", "What proof should I upload?", "How do I prioritize nearby tasks?"]
          : ["Help me write a report", "Explain issue statuses", "Tell me about my current issue"],
    };
  }

  return {
    answer:
      user.role === "admin"
        ? "I can help with triage, issue-specific AI interpretation, assignments, severity prioritization, hotspot interpretation, and admin workflows."
        : user.role === "worker"
        ? "I can help with task handling, issue-specific field guidance, proof uploads, and task prioritization."
        : "I can help you report better issues, ask about a specific complaint, use Smart Preview, join duplicates, and follow updates in CivicTrack.",
    suggestions:
      user.role === "admin"
        ? ["How do I prioritize critical issues?", "What does verified mean?", "Explain this issue to me"]
        : user.role === "worker"
        ? ["How do I mark a task resolved?", "Explain my assigned issue", "What should my proof photo show?"]
        : ["Help me write a good complaint", "What happens after I submit?", "Explain this issue to me"],
  };
};

const requestOpenAIReply = async ({ user, message, history, context }) => {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.35,
      messages: [
        { role: "system", content: buildSystemPrompt({ user, context }) },
        ...history,
        { role: "user", content: message },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI chat request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const answer = payload.choices?.[0]?.message?.content?.trim();

  if (!answer) {
    throw new Error("OpenAI chat returned an empty response");
  }

  const fallback = heuristicReply({ user, message, context });

  return {
    answer,
    suggestions: fallback.suggestions,
    source: "openai",
  };
};

const buildGeneralChatContext = async (user) => {
  if (user.role === "admin") {
    const [totalIssues, pendingIssues, recentIssues, criticalIssues, categoryBreakdown] = await Promise.all([
      Issue.countDocuments(),
      Issue.countDocuments({ status: { $in: ["reported", "verified", "assigned", "in-progress"] } }),
      Issue.find().sort({ createdAt: -1 }).limit(5).select("title category status severity address createdAt").lean(),
      Issue.countDocuments({ severity: "critical", status: { $ne: "resolved" } }),
      Issue.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 4 },
      ]),
    ]);

    return {
      totalIssues,
      pendingIssues,
      recentIssuesSummary: summarizeIssues(recentIssues),
      criticalIssues,
      topCategories: categoryBreakdown.map((item) => `${item._id}: ${item.count}`),
    };
  }

  const query = user.role === "worker" ? { assignedWorker: user._id || user.id } : { reportedBy: user._id || user.id };
  const [issues, activeCount, totalIssues, criticalCount] = await Promise.all([
    Issue.find(query).sort({ createdAt: -1 }).limit(5).select("title category status severity address createdAt").lean(),
    Issue.countDocuments({
      ...query,
      status: { $in: ["reported", "verified", "assigned", "in-progress"] },
    }),
    Issue.countDocuments(query),
    Issue.countDocuments({ ...query, severity: "critical", status: { $ne: "resolved" } }),
  ]);

  return {
    totalIssues,
    assignedCount: user.role === "worker" ? activeCount : undefined,
    activeCount,
    criticalCount,
    recentIssuesSummary: summarizeIssues(issues),
  };
};

const buildIssueContext = async (user, issueId) => {
  if (!issueId) {
    return null;
  }

  const issue = await Issue.findById(issueId)
    .populate("reportedBy", "name email role")
    .populate("assignedWorker", "name email role")
    .populate("supporters", "name email")
    .lean();

  if (!canAccessIssue(user, issue)) {
    return null;
  }

  return normalizeIssueContext(issue);
};

const buildChatContext = async (user, options = {}) => {
  const [general, issue] = await Promise.all([
    buildGeneralChatContext(user),
    buildIssueContext(user, options.issueId),
  ]);

  return {
    general,
    issue,
  };
};

const generateChatResponse = async ({ user, message, history = [], context }) => {
  if (process.env.AI_PROVIDER === "openai" && process.env.OPENAI_API_KEY) {
    try {
      return await requestOpenAIReply({ user, message, history, context });
    } catch (error) {
      console.warn("OpenAI chatbot reply failed, falling back to heuristics:", error.message);
    }
  }

  return {
    ...heuristicReply({ user, message, context }),
    source: "heuristic-fallback",
  };
};

module.exports = {
  buildChatContext,
  generateChatResponse,
};
