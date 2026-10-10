const Issue = require("../models/Issue");
const AITrainingFeedback = require("../models/AITrainingFeedback");
const { getOrSet } = require("./cacheService");

const categorySignals = {
  pothole: [
    "pothole",
    "crater",
    "road hole",
    "deep hole",
    "pit on road",
    "damaged patch",
  ],
  garbage: [
    "garbage",
    "trash",
    "waste",
    "dump",
    "litter",
    "dirty",
    "sanitation",
    "bin overflow",
  ],
  "water-leakage": [
    "water leak",
    "pipe leak",
    "sewage",
    "drain overflow",
    "leakage",
    "flood",
    "water flowing",
    "burst pipe",
    "waterlogging",
  ],
  streetlight: [
    "streetlight",
    "street light",
    "lamp",
    "light pole",
    "dark road",
    "no light",
    "fused light",
  ],
  "road-damage": [
    "road damage",
    "broken road",
    "crack",
    "damaged road",
    "uneven road",
    "collapsed road",
    "surface damage",
  ],
};

const severitySignals = {
  critical: [
    "accident",
    "danger",
    "dangerous",
    "urgent",
    "emergency",
    "flood",
    "injury",
    "school",
    "hospital",
    "main road",
    "traffic jam",
    "night safety",
    "spark",
    "electrical hazard",
    "overflowing",
    "blocked completely",
  ],
  medium: [
    "large",
    "broken",
    "blocked",
    "spreading",
    "multiple",
    "bad smell",
    "slippery",
    "lane",
    "junction",
    "market",
    "bus stand",
    "public area",
  ],
};

const normalizeText = (text) => String(text || "").toLowerCase().replace(/\s+/g, " ").trim();

const countMatches = (text, phrases = []) =>
  phrases.reduce((total, phrase) => total + (text.includes(phrase) ? 1 : 0), 0);

const getCategoryScoreboard = (text) => {
  const normalized = normalizeText(text);
  return Object.entries(categorySignals)
    .map(([category, phrases]) => ({ category, score: countMatches(normalized, phrases) }))
    .sort((left, right) => right.score - left.score);
};

const inferCategory = (text) => {
  const normalized = normalizeText(text);
  const ranked = getCategoryScoreboard(normalized);

  if (!ranked[0] || ranked[0].score === 0) {
    return "other";
  }

  if (ranked[0].score === ranked[1]?.score && normalized.includes("light")) {
    return "streetlight";
  }

  return ranked[0].category;
};

const buildSupervisedSignal = (text, category, severity) => {
  const ranked = getCategoryScoreboard(text);
  const top = ranked[0] || { category: "other", score: 0 };
  const runnerUp = ranked[1] || { category: "other", score: 0 };
  const severityHits = {
    critical: countMatches(normalizeText(text), severitySignals.critical),
    medium: countMatches(normalizeText(text), severitySignals.medium),
  };
  const margin = Math.max(top.score - runnerUp.score, 0);
  const confidence = Math.min(0.58 + top.score * 0.08 + margin * 0.06 + severityHits.critical * 0.03, 0.97);

  return {
    label: `${category}:${severity}`,
    confidence: Number(confidence.toFixed(2)),
    rationale:
      top.score > 0
        ? `Rule-labeled civic keywords matched ${category} most strongly with severity cues pointing to ${severity}.`
        : `Few direct civic labels were found, so the supervised rules defaulted conservatively to ${category}.`,
  };
};

const buildUnsupervisedSignal = (text, category, severity) => {
  const normalized = normalizeText(text);
  const tokens = normalized.split(" ").filter(Boolean);
  const uniqueRatio = tokens.length ? new Set(tokens).size / tokens.length : 0;
  const impactDensity = countMatches(normalized, [
    "traffic",
    "crowd",
    "junction",
    "school",
    "hospital",
    "market",
    "bus stand",
    "unsafe",
    "overflow",
    "night",
    "main road",
  ]);
  const anomalyScore = Math.min(Number((0.35 + uniqueRatio * 0.35 + impactDensity * 0.08).toFixed(2)), 0.95);
  const pattern =
    anomalyScore >= 0.78
      ? "emerging-high-impact cluster"
      : anomalyScore >= 0.6
      ? "repeat civic disruption pattern"
      : "routine localized pattern";

  return {
    pattern,
    anomalyScore,
    rationale: `Pattern discovery sees this ${category} complaint as a ${pattern} with ${severity} operational weight.`,
  };
};

const buildSemiSupervisedSignal = (supervisedSignal, unsupervisedSignal, duplicateScore = 0) => {
  const blended = Math.min(
    Number(
      (
        supervisedSignal.confidence * 0.65 +
        unsupervisedSignal.anomalyScore * 0.25 +
        Math.min(duplicateScore, 1) * 0.1
      ).toFixed(2)
    ),
    0.98
  );

  return {
    confidence: blended,
    mode:
      blended >= 0.82
        ? "high-confidence semi-supervised decision"
        : blended >= 0.65
        ? "review-aware semi-supervised decision"
        : "conservative semi-supervised fallback",
    rationale:
      blended >= 0.82
        ? "Labeled civic rules and pattern discovery are aligned strongly."
        : blended >= 0.65
        ? "Labeled rules are useful, but pattern uncertainty suggests keeping a human review mindset."
        : "Signals are mixed, so the platform should remain conservative and review-friendly.",
  };
};

const inferSeverity = (text, category = "other") => {
  const normalized = normalizeText(text);
  const criticalHits = countMatches(normalized, severitySignals.critical);
  const mediumHits = countMatches(normalized, severitySignals.medium);

  const categoryCriticalBias = {
    "water-leakage": /(flood|overflow|main road|burst pipe|school|hospital)/,
    streetlight: /(dark|night|unsafe|junction|main road)/,
    pothole: /(deep|large|two wheeler|accident|bus|main road)/,
    garbage: /(hospital|school|bad smell|mosquito|dumping)/,
    "road-damage": /(collapsed|danger|main road|traffic)/,
  };

  if (criticalHits >= 2 || categoryCriticalBias[category]?.test(normalized)) {
    return "critical";
  }

  if (mediumHits >= 1 || criticalHits === 1) {
    return "medium";
  }

  return "low";
};

const buildProofReviewReason = (result) => {
  const reasons = {
    verified: "The completion proof appears relevant and consistent with a resolved civic issue.",
    uncertain: "The proof is present, but the AI is not fully confident the issue is completely resolved.",
    rejected: "The available proof does not strongly support a completed resolution and should be reviewed manually.",
  };

  return reasons[result] || reasons.uncertain;
};

const buildCategoryReason = (category) => {
  const reasons = {
    pothole: "The wording suggests a hole or damaged patch on a road surface.",
    garbage: "The report mentions waste, trash, or public sanitation buildup.",
    "water-leakage": "The description references leaking water, flow, or flooding behavior.",
    streetlight: "The issue appears related to lighting, lamps, or visibility at night.",
    "road-damage": "The report suggests surface cracks, breakage, or wider roadway damage.",
    other: "The issue does not map strongly to a primary civic category.",
  };

  return reasons[category] || reasons.other;
};

const buildSeverityReason = (severity) => {
  const reasons = {
    critical: "The issue appears to create immediate safety or mobility risk and should be prioritized quickly.",
    medium: "The issue is disruptive and should be scheduled promptly, but it is not described as an active emergency.",
    low: "The issue appears localized or lower-risk based on the current description.",
  };

  return reasons[severity] || reasons.low;
};

const buildRecommendedAction = (category, severity) => {
  if (severity === "critical") {
    return "Escalate for rapid verification and field assignment.";
  }

  if (category === "garbage") {
    return "Route to sanitation or waste-management operations.";
  }

  if (category === "streetlight") {
    return "Route to electrical maintenance with nighttime verification if needed.";
  }

  if (category === "water-leakage") {
    return "Route to water utility or public works for leak containment.";
  }

  return "Verify on-site and assign the nearest available field worker.";
};

const buildLikelyDepartment = (category) => {
  const departments = {
    pothole: "Road Maintenance",
    garbage: "Sanitation",
    "water-leakage": "Water Works",
    streetlight: "Electrical Maintenance",
    "road-damage": "Public Works",
    other: "General Civic Operations",
  };

  return departments[category] || departments.other;
};

const buildCitizenGuidance = (category, severity) => {
  if (severity === "critical") {
    return "If the situation is causing immediate danger, include clear location details and upload a photo so the issue can be escalated faster.";
  }

  if (category === "water-leakage") {
    return "Mention whether water is continuously flowing, flooding the road, or affecting nearby homes or shops.";
  }

  if (category === "streetlight") {
    return "Mention whether the area becomes unsafe or completely dark at night so the team can prioritize it correctly.";
  }

  return "Add a clear landmark, a short impact summary, and a fresh photo to help the civic team verify it quickly.";
};

const buildPublicImpact = (category, severity) => {
  if (severity === "critical") {
    return "This report suggests an immediate public safety or access risk.";
  }

  const messages = {
    pothole: "This may disrupt traffic flow and create risk for two-wheelers and pedestrians.",
    garbage: "This may create hygiene issues, odor, and public sanitation complaints.",
    "water-leakage": "This may waste water, damage nearby roads, and make walking or driving unsafe.",
    streetlight: "This may reduce visibility and make the area feel unsafe after dark.",
    "road-damage": "This may worsen over time and create broader traffic disruption if ignored.",
    other: "This may inconvenience nearby residents and should be inspected promptly.",
  };

  return messages[category] || messages.other;
};

const personalizeCitizenGuidance = (guidance, userContext = {}) => {
  const additions = [];

  if (userContext.homeAddress) {
    additions.push(`You can mention ${userContext.homeAddress} as a familiar reference point if it helps identify the spot.`);
  }

  if (userContext.preferredLanguage === "hinglish") {
    additions.push("You may keep the wording simple and mix English with local phrasing if that helps you describe the issue faster.");
  }

  return additions.length ? `${guidance} ${additions.join(" ")}` : guidance;
};

const buildWorkerBrief = (category, severity) => {
  const severityText =
    severity === "critical"
      ? "Treat this as a high-priority stop and verify public safety conditions first."
      : severity === "medium"
      ? "Inspect the full affected area before marking work complete."
      : "Confirm the exact spot and document the completed fix clearly.";

  const categoryText = {
    pothole: "Check road depth, traffic exposure, and whether the hazard affects multiple lanes.",
    garbage: "Capture before-and-after cleanliness proof and confirm waste is fully removed.",
    "water-leakage": "Look for active flow, damaged pipe signs, and any spread into nearby traffic space.",
    streetlight: "Verify nighttime lighting functionality or note the electrical fault clearly.",
    "road-damage": "Inspect the full damaged stretch, not just the first visible crack or patch.",
    other: "Document the visible condition and the completed field action as clearly as possible.",
  };

  return `${severityText} ${categoryText[category] || categoryText.other}`;
};

const buildWorkerChecklist = (category) => {
  const checklist = {
    pothole: [
      "Confirm road width and depth of damage",
      "Capture a clear before photo from the traffic approach",
      "Upload a close after photo once patching is complete",
    ],
    garbage: [
      "Confirm full waste clearance from the spot",
      "Capture before and after proof from the same angle",
      "Note if recurring dumping signs remain nearby",
    ],
    "water-leakage": [
      "Check whether water flow is still active",
      "Capture the source area and spread zone",
      "Mention if utility team escalation is still needed",
    ],
    streetlight: [
      "Verify the exact pole or dark stretch",
      "Mention whether the light is restored or fault is pending",
      "Capture a proof photo of the fixed unit or maintenance action",
    ],
    "road-damage": [
      "Inspect the full damaged stretch, not just one patch",
      "Record whether temporary repair or full maintenance was done",
      "Upload a clear after photo of the treated surface",
    ],
    other: [
      "Capture clear before and after evidence",
      "Describe the field action taken",
      "Mention any unresolved risk left on site",
    ],
  };

  return checklist[category] || checklist.other;
};

const buildAdminPriorityBand = (severity, duplicateScore) => {
  if (severity === "critical") {
    return "Immediate";
  }

  if (severity === "medium" || duplicateScore >= 0.75) {
    return "High";
  }

  return "Routine";
};

const buildCitizenSummary = (category, severity, locationText) => {
  const severityLabel =
    severity === "critical" ? "high-priority" : severity === "medium" ? "important" : "trackable";

  return `This looks like a ${severityLabel} ${humanizeCategory(category)} report${
    locationText ? ` near ${locationText}` : ""
  }.`;
};

const buildAdminSummary = (category, severity, duplicateScore, locationText) => {
  return `${buildLikelyDepartment(category)} should review this ${severity} ${category} complaint${
    locationText ? ` near ${locationText}` : ""
  }${duplicateScore >= 0.75 ? " with duplicate pressure nearby." : "."}`;
};

const buildAdminEscalationNote = (category, severity, duplicateScore) => {
  if (severity === "critical") {
    return "Escalate immediately and assign a worker or department review without delay.";
  }

  if (duplicateScore >= 0.8) {
    return "Multiple nearby complaints may be describing the same civic condition. Consider bulk action.";
  }

  if (category === "water-leakage" || category === "streetlight") {
    return "Fast verification is recommended because the issue can worsen public inconvenience quickly.";
  }

  return "Standard verification and assignment flow is appropriate.";
};

const estimateSlaHours = (severity) => {
  if (severity === "critical") {
    return 6;
  }

  if (severity === "medium") {
    return 24;
  }

  return 72;
};

const estimateResolutionEta = (category, severity) => {
  if (severity === "critical") {
    return "Same day if verified quickly";
  }

  if (category === "streetlight") {
    return "1 to 2 maintenance visits";
  }

  if (category === "garbage") {
    return "Within the next sanitation cycle";
  }

  if (category === "water-leakage") {
    return "Priority inspection within 24 hours";
  }

  return "Typically 1 to 3 working days after verification";
};

const estimateConfidence = (text, image, category, severity) => {
  let score = 0.54;
  const normalized = text.toLowerCase();

  if (image) {
    score += 0.14;
  }

  if (normalized.length > 70) {
    score += 0.08;
  }

  if (category !== "other") {
    score += 0.1;
  }

  if (["critical", "medium"].includes(severity)) {
    score += 0.04;
  }

  if (/(near|opposite|beside|landmark|road|street|junction)/.test(normalized)) {
    score += 0.05;
  }

  if (/(photo|image|attached)/.test(normalized)) {
    score += 0.02;
  }

  if (/(shop|temple|school|hospital|market|bus stand|signal)/.test(normalized)) {
    score += 0.03;
  }

  return Math.min(Number(score.toFixed(2)), 0.96);
};

const calculateDistanceMeters = (longitudeA, latitudeA, longitudeB, latitudeB) => {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);
  const lat1 = toRadians(latitudeA);
  const lat2 = toRadians(latitudeB);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLongitude / 2) ** 2;

  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const isGeoIndexReadinessError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("unable to find index for $geo") ||
    message.includes("unable to find index for geo") ||
    message.includes("2dsphere index") ||
    message.includes("$near")
  );
};

const tokenizeText = (text) =>
  normalizeText(text)
    .split(/[^a-z0-9-]+/)
    .filter((token) => token && token.length > 2);

const computeTextSimilarity = (leftText, rightText) => {
  const leftTokens = tokenizeText(leftText);
  const rightTokens = tokenizeText(rightText);

  if (!leftTokens.length || !rightTokens.length) {
    return 0;
  }

  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const overlap = [...leftSet].filter((token) => rightSet.has(token)).length;
  const union = new Set([...leftSet, ...rightSet]).size || 1;

  return Number((overlap / union).toFixed(2));
};

const pickMajorityValue = (items, key) => {
  const counts = items.reduce((accumulator, item) => {
    const value = item?.[key];
    if (!value) {
      return accumulator;
    }
    accumulator[value] = (accumulator[value] || 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] || null;
};

const summarizeHistoricalPattern = (matches, predictedCategory, predictedSeverity) => {
  if (!matches.length) {
    return `No strong historical prototype match was found, so the AI is relying more heavily on current civic rules for this ${predictedCategory} ${predictedSeverity} issue.`;
  }

  const strongest = matches[0];
  return `Historical learning found ${matches.length} similar ${predictedCategory} cases. The closest prototype is "${strongest.title}" with ${Math.round(
    strongest.similarity * 100
  )}% textual similarity, which helps calibrate the ${predictedSeverity} severity judgment.`;
};

const buildAdvancedLearningSignals = async ({ title, description, predictedCategory, predictedSeverity, duplicateScore = 0 }) => {
  const queryText = `${title || ""} ${description || ""}`;

  const cacheSuffix = predictedCategory && predictedCategory !== "other" ? predictedCategory : "all";
  const [candidates, reviewedFeedback] = await Promise.all([
    getOrSet(`ai:memory:issues:${cacheSuffix}`, 45000, async () =>
      Issue.candidatesForMemory({ category: predictedCategory, limit: 40 })
    ),
    getOrSet(`ai:memory:feedback:${cacheSuffix}`, 45000, async () =>
      AITrainingFeedback.reviewedForCategory(predictedCategory, 30)
    ),
  ]);

  const scoredMatches = candidates
    .map((candidate) => {
      const similarity = computeTextSimilarity(
        queryText,
        `${candidate.title || ""} ${candidate.description || ""} ${candidate.address || ""}`
      );

      return {
        title: candidate.title,
        category: candidate.category,
        severity: candidate.severity,
        status: candidate.status,
        similarity,
      };
    })
    .filter((match) => match.similarity >= 0.14)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, 3);

  const feedbackMatches = reviewedFeedback
    .map((feedback) => {
      const issue = feedback.issueId;
      const similarity = computeTextSimilarity(
        queryText,
        `${issue?.title || ""} ${issue?.description || ""} ${issue?.address || ""}`
      );

      return {
        title: issue?.title || "Reviewed issue",
        category: feedback.correctedCategory,
        severity: feedback.correctedSeverity,
        status: issue?.status || "reviewed",
        similarity,
        confidenceOverride: feedback.confidenceOverride,
        source: "admin-review",
      };
    })
    .filter((match) => match.similarity >= 0.12)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, 3);

  const ensembleMatches = [...feedbackMatches, ...scoredMatches]
    .sort((left, right) => {
      const leftBoost = left.source === "admin-review" ? 0.08 : 0;
      const rightBoost = right.source === "admin-review" ? 0.08 : 0;
      return right.similarity + rightBoost - (left.similarity + leftBoost);
    })
    .slice(0, 4);

  const consensusSeverity = pickMajorityValue(ensembleMatches, "severity");
  const consensusCategory = pickMajorityValue(ensembleMatches, "category");
  const averageSimilarity = ensembleMatches.length
    ? Number(
        (
          ensembleMatches.reduce((total, match) => total + match.similarity, 0) /
          ensembleMatches.length
        ).toFixed(2)
      )
    : 0;

  const reviewedConfidenceBoost = feedbackMatches.length
    ? Math.min(
        feedbackMatches.reduce(
          (total, match) => total + (match.confidenceOverride ?? Math.min(match.similarity + 0.2, 0.92)),
          0
        ) / feedbackMatches.length,
        0.95
      )
    : 0;

  const retrievalConfidence = Math.min(
    Number((0.28 + averageSimilarity * 0.75 + reviewedConfidenceBoost * 0.14 + Math.min(duplicateScore, 1) * 0.08).toFixed(2)),
    0.96
  );

  return {
    strategy: feedbackMatches.length
      ? "admin-reviewed retrieval-augmented civic ensemble"
      : scoredMatches.length
      ? "retrieval-augmented civic ensemble"
      : "rule-first civic ensemble with sparse retrieval",
    consensusSeverity: consensusSeverity || predictedSeverity,
    consensusCategory: consensusCategory || predictedCategory,
    retrievalConfidence,
    historicalPatternSummary: feedbackMatches.length
      ? `Admin-reviewed training memory found ${feedbackMatches.length} corrected cases related to this report. ${summarizeHistoricalPattern(
          ensembleMatches,
          predictedCategory,
          predictedSeverity
        )}`
      : summarizeHistoricalPattern(ensembleMatches, predictedCategory, predictedSeverity),
    similarIssueTitles: ensembleMatches.map((match) => `${match.title} (${Math.round(match.similarity * 100)}%)`),
  };
};

const extractJsonFromText = (value) => {
  const match = value.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("No JSON object found in AI response");
  }

  return JSON.parse(match[0]);
};

const analyzeWithOpenAI = async ({ title, description, image, userContext = {} }) => {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a civic issue analysis assistant for an Indian municipal complaint platform. Classify the report conservatively and explain your reasoning. Return strict JSON with keys predictedCategory, predictedSeverity, duplicateScore, imageSummary, confidenceScore, citizenGuidance, workerBrief, priorityBand, estimatedResolutionEta, suggestedSlaHours, likelyDepartment, citizenSummary, adminSummary, categoryReason, severityReason, recommendedAction.",
        },
        {
          role: "user",
          content: `Title: ${title}\nDescription: ${description}\nImage attached: ${image ? "yes" : "no"}\nCitizen preferred language: ${
            userContext.preferredLanguage || "english"
          }\nCitizen home area: ${userContext.homeAddress || "unknown"}\nCategories: pothole, garbage, water-leakage, streetlight, road-damage, other\nSeverity: low, medium, critical`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || "{}";
  const parsed = typeof content === "string" ? extractJsonFromText(content) : content;
  const advancedLearning = await buildAdvancedLearningSignals({
    title,
    description,
    predictedCategory: parsed.predictedCategory || "other",
    predictedSeverity: parsed.predictedSeverity || "medium",
    duplicateScore: Number(parsed.duplicateScore || 0),
  });

  return {
    predictedCategory: parsed.predictedCategory || "other",
    predictedSeverity: parsed.predictedSeverity || "medium",
    duplicateScore: Number(parsed.duplicateScore || 0),
    duplicateIssueId: null,
    imageSummary: parsed.imageSummary || "AI analysis completed.",
    categoryReason: parsed.categoryReason || buildCategoryReason(parsed.predictedCategory || "other"),
    severityReason: parsed.severityReason || buildSeverityReason(parsed.predictedSeverity || "medium"),
    recommendedAction:
      parsed.recommendedAction ||
      buildRecommendedAction(parsed.predictedCategory || "other", parsed.predictedSeverity || "medium"),
    confidenceScore: Number(parsed.confidenceScore || 0.82),
    citizenGuidance:
      personalizeCitizenGuidance(
        parsed.citizenGuidance ||
          buildCitizenGuidance(parsed.predictedCategory || "other", parsed.predictedSeverity || "medium"),
        userContext
      ),
    workerBrief:
      parsed.workerBrief || buildWorkerBrief(parsed.predictedCategory || "other", parsed.predictedSeverity || "medium"),
    priorityBand:
      parsed.priorityBand ||
      buildAdminPriorityBand(parsed.predictedSeverity || "medium", Number(parsed.duplicateScore || 0)),
    suggestedSlaHours: Number(parsed.suggestedSlaHours || estimateSlaHours(parsed.predictedSeverity || "medium")),
    estimatedResolutionEta:
      parsed.estimatedResolutionEta ||
      estimateResolutionEta(parsed.predictedCategory || "other", parsed.predictedSeverity || "medium"),
    likelyDepartment: parsed.likelyDepartment || buildLikelyDepartment(parsed.predictedCategory || "other"),
    citizenSummary:
      parsed.citizenSummary ||
      buildCitizenSummary(parsed.predictedCategory || "other", parsed.predictedSeverity || "medium", userContext.homeAddress),
    adminSummary:
      parsed.adminSummary ||
      buildAdminSummary(
        parsed.predictedCategory || "other",
        parsed.predictedSeverity || "medium",
        Number(parsed.duplicateScore || 0),
        userContext.homeAddress
      ) + ` ${buildAdminEscalationNote(parsed.predictedCategory || "other", parsed.predictedSeverity || "medium", Number(parsed.duplicateScore || 0))}`,
    learningMode: `foundation-model assisted ${advancedLearning.strategy}`,
    supervisedLabel: `${parsed.predictedCategory || "other"}:${parsed.predictedSeverity || "medium"}`,
    unsupervisedPattern: Number(parsed.duplicateScore || 0) >= 0.75 ? "duplicate-pressure pattern" : "contextual issue pattern",
    semisupervisedConfidence: Number(parsed.confidenceScore || 0.82),
    adaptiveStrategy: advancedLearning.strategy,
    historicalPatternSummary: advancedLearning.historicalPatternSummary,
    retrievalConfidence: advancedLearning.retrievalConfidence,
    similarIssueTitles: advancedLearning.similarIssueTitles,
    source: "openai",
  };
};

const buildImageContentItem = (label, image) => {
  if (!image) {
    return null;
  }

  return {
    type: "image_url",
    image_url: {
      url: image,
    },
  };
};

const analyzeIssue = async ({ title, description, image, userContext = {} }) => {
  const combined = `${title} ${description}`;

  if (process.env.AI_PROVIDER === "openai" && process.env.OPENAI_API_KEY) {
    try {
      return await analyzeWithOpenAI({ title, description, image, userContext });
    } catch (error) {
      console.warn("OpenAI analysis failed, falling back to heuristics:", error.message);
    }
  }

  const predictedCategory = inferCategory(combined);
  const predictedSeverity = inferSeverity(combined, predictedCategory);
  const supervisedSignal = buildSupervisedSignal(combined, predictedCategory, predictedSeverity);
  const unsupervisedSignal = buildUnsupervisedSignal(combined, predictedCategory, predictedSeverity);
  const semiSupervisedSignal = buildSemiSupervisedSignal(supervisedSignal, unsupervisedSignal, 0);
  const advancedLearning = await buildAdvancedLearningSignals({
    title,
    description,
    predictedCategory,
    predictedSeverity,
    duplicateScore: 0,
  });

  return {
    predictedCategory,
    predictedSeverity,
    duplicateScore: 0,
    duplicateIssueId: null,
    imageSummary: image ? "Image payload received for future multimodal analysis." : "No image attached.",
    categoryReason: buildCategoryReason(predictedCategory),
    severityReason: buildSeverityReason(predictedSeverity),
    recommendedAction: buildRecommendedAction(predictedCategory, predictedSeverity),
    confidenceScore: estimateConfidence(combined, image, predictedCategory, predictedSeverity),
    citizenGuidance: personalizeCitizenGuidance(buildCitizenGuidance(predictedCategory, predictedSeverity), userContext),
    workerBrief: buildWorkerBrief(predictedCategory, predictedSeverity),
    priorityBand: buildAdminPriorityBand(predictedSeverity, 0),
    suggestedSlaHours: estimateSlaHours(predictedSeverity),
    estimatedResolutionEta: estimateResolutionEta(predictedCategory, predictedSeverity),
    likelyDepartment: buildLikelyDepartment(predictedCategory),
    citizenSummary: buildCitizenSummary(predictedCategory, predictedSeverity, userContext.homeAddress),
    adminSummary:
      buildAdminSummary(predictedCategory, predictedSeverity, 0, userContext.homeAddress) +
      ` ${buildAdminEscalationNote(predictedCategory, predictedSeverity, 0)}`,
    learningMode: `${semiSupervisedSignal.mode} with ${advancedLearning.strategy}`,
    supervisedLabel: supervisedSignal.label,
    unsupervisedPattern: unsupervisedSignal.pattern,
    semisupervisedConfidence: semiSupervisedSignal.confidence,
    adaptiveStrategy: advancedLearning.strategy,
    historicalPatternSummary: advancedLearning.historicalPatternSummary,
    retrievalConfidence: advancedLearning.retrievalConfidence,
    similarIssueTitles: advancedLearning.similarIssueTitles,
    source: "heuristic-fallback",
  };
};

const verifyProofWithOpenAI = async ({ issue }) => {
  const userContent = [
    {
      type: "text",
      text: `Issue title: ${issue.title}
Issue description: ${issue.description}
Issue category: ${issue.category}
Issue severity: ${issue.severity}
Worker resolution notes: ${issue.resolutionNotes || "none"}
Return strict JSON with keys verificationStatus, confidenceScore, summary, adminRecommendation, citizenMessage.`,
    },
    buildImageContentItem("original_issue_image", issue.image),
    buildImageContentItem("resolution_proof_image", issue.proofImage),
  ].filter(Boolean);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Evaluate whether a worker's proof image and notes support resolution of a civic issue. Be cautious with critical issues and weak proof. Return strict JSON with verificationStatus (verified|uncertain|rejected), confidenceScore, summary, adminRecommendation, citizenMessage.",
        },
        {
          role: "user",
          content: userContent,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI proof verification failed with status ${response.status}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || "{}";
  const parsed = typeof content === "string" ? extractJsonFromText(content) : content;
  const verificationStatus = ["verified", "uncertain", "rejected"].includes(parsed.verificationStatus)
    ? parsed.verificationStatus
    : "uncertain";

  return {
    verificationStatus,
    confidenceScore: Number(parsed.confidenceScore || 0.78),
    summary: parsed.summary || buildProofReviewReason(verificationStatus),
    adminRecommendation:
      parsed.adminRecommendation ||
      (verificationStatus === "verified"
        ? "Resolution proof looks acceptable. Spot-check only if the issue is high impact."
        : verificationStatus === "uncertain"
        ? "Review the before/after evidence manually before fully trusting closure."
        : "Hold this closure for manual review and request stronger proof from the worker."),
    citizenMessage:
      parsed.citizenMessage ||
      (verificationStatus === "verified"
        ? "AI review suggests the issue appears resolved."
        : verificationStatus === "uncertain"
        ? "AI review is inconclusive, so the resolution may be reviewed manually."
        : "AI review could not verify the fix confidently and the result may be reviewed again."),
    source: "openai",
  };
};

const verifyResolutionProof = async ({ issue }) => {
  if (!issue.proofImage) {
    return {
      verificationStatus: "rejected",
      confidenceScore: 0.2,
      summary: "No proof image was provided, so the resolution cannot be verified by AI.",
      adminRecommendation: "Request a proof image before treating this issue as fully verified.",
      citizenMessage: "A proof image was not provided yet, so the fix still needs review.",
      source: "heuristic-fallback",
    };
  }

  if (process.env.AI_PROVIDER === "openai" && process.env.OPENAI_API_KEY) {
    try {
      return await verifyProofWithOpenAI({ issue });
    } catch (error) {
      console.warn("OpenAI proof verification failed, falling back to heuristics:", error.message);
    }
  }

  const notes = (issue.resolutionNotes || "").toLowerCase();
  const hasActionVerb = /(cleared|repaired|fixed|removed|restored|completed|replaced|patched|sealed|cleaned)/.test(notes);
  const mentionsEvidence = /(photo|image|attached|after|before)/.test(notes);
  const noteStrength = notes.length > 40 || hasActionVerb;
  const verificationStatus =
    issue.severity === "critical"
      ? hasActionVerb && mentionsEvidence
        ? "uncertain"
        : "rejected"
      : noteStrength && mentionsEvidence
      ? "verified"
      : noteStrength
      ? "uncertain"
      : "rejected";
  const confidenceScore =
    verificationStatus === "verified" ? 0.78 : verificationStatus === "uncertain" ? 0.51 : 0.26;

  return {
    verificationStatus,
    confidenceScore,
    summary:
      verificationStatus === "verified"
        ? "Proof image and resolution notes give a reasonable signal that the issue was addressed."
        : verificationStatus === "uncertain"
        ? "The proof is present, but a stronger before/after match or clearer notes would improve confidence."
        : "The evidence is too weak to trust closure yet and should be reviewed manually.",
    adminRecommendation:
      verificationStatus === "verified"
        ? "Manual review is optional unless the issue is high visibility or safety-sensitive."
        : "Review the proof manually and request better evidence if the closure is doubtful.",
    citizenMessage:
      verificationStatus === "verified"
        ? "AI review suggests the reported issue appears resolved."
        : "AI review is not fully confident about the resolution, so it may be reviewed manually.",
    source: "heuristic-fallback",
  };
};

const buildHotspotPreventiveAction = (category, riskBand) => {
  const categoryActions = {
    pothole: "Schedule a preventive road patch inspection and check adjacent lane damage.",
    garbage: "Increase sanitation frequency and inspect for recurring dumping points.",
    "water-leakage": "Inspect nearby pipes or valves before the complaint volume grows further.",
    streetlight: "Check nearby poles and electrical lines before more outages are reported.",
    "road-damage": "Inspect the wider road segment and plan maintenance before the surface degrades further.",
    other: "Review the area manually and prepare a preventive field inspection.",
  };

  const action = categoryActions[category] || categoryActions.other;
  return riskBand === "emerging" ? `Monitor this zone closely. ${action}` : action;
};

const buildHotspotForecast = (hotspot) => {
  const primaryCategory = hotspot.categories?.[0] || "other";
  const riskBand = hotspot.count >= 5 ? "critical" : hotspot.count >= 3 ? "high" : "emerging";
  const forecastWindow = riskBand === "critical" ? "next 24 hours" : riskBand === "high" ? "next 2 days" : "next week";
  const expectedVolume = hotspot.count >= 5 ? hotspot.count + 2 : hotspot.count >= 3 ? hotspot.count + 1 : hotspot.count;

  return {
    address: hotspot.address,
    riskBand,
    primaryCategory,
    expectedVolume,
    forecastWindow,
    preventiveAction: buildHotspotPreventiveAction(primaryCategory, riskBand),
    summary: `${hotspot.address} is showing ${riskBand} repeat-complaint risk for ${primaryCategory} over the ${forecastWindow}. Preventive attention could reduce escalation and duplicate complaints.`,
    learningMode:
      riskBand === "critical"
        ? "unsupervised hotspot clustering with supervised civic labeling"
        : "semi-supervised hotspot pattern review",
  };
};

const humanizeCategory = (category) => {
  const labels = {
    pothole: "pothole",
    garbage: "garbage dump",
    "water-leakage": "water leakage",
    streetlight: "broken streetlight",
    "road-damage": "road damage",
    other: "civic issue",
  };

  return labels[category] || labels.other;
};

const localizeDraft = ({ title, description }, language) => {
  if (language === "hinglish") {
    return {
      title: title.replace("reported near", "reported near"),
      description: `${description} Kripya exact location aur recent photo bhi add karein for faster action.`,
    };
  }

  return { title, description };
};

const generateIssueDraft = async ({ category, address, image, notes, language = "english", userContext = {} }) => {
  const inferredCategory = category || inferCategory(notes || "");
  const inferredSeverity = inferSeverity(notes || inferredCategory, inferredCategory);
  const preferredLanguage = language || userContext.preferredLanguage || "english";
  const locationText = address?.trim() || userContext.homeAddress || "the reported location";
  const categoryLabel = humanizeCategory(inferredCategory);

  if (process.env.AI_PROVIDER === "openai" && process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.4,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "Write concise civic issue reports for a municipal complaint platform. Return strict JSON with title and description only. The wording should be specific, location-aware, and easy for admins to verify.",
            },
            {
              role: "user",
              content: `Category: ${inferredCategory}\nAddress: ${locationText}\nExtra notes: ${notes || "none"}\nImage attached: ${
                image ? "yes" : "no"
              }\nLanguage: ${preferredLanguage}\nCitizen home area: ${userContext.homeAddress || "unknown"}`,
            },
          ],
        }),
      });

      if (response.ok) {
        const payload = await response.json();
        const content = payload.choices?.[0]?.message?.content || "{}";
        const parsed = typeof content === "string" ? extractJsonFromText(content) : content;

        return {
          title: parsed.title || `${categoryLabel[0].toUpperCase()}${categoryLabel.slice(1)} reported near ${locationText}`,
          description:
            parsed.description ||
            `A ${categoryLabel} has been observed near ${locationText}. The issue should be inspected and addressed based on its current severity.`,
          predictedSeverity: inferredSeverity,
          likelyDepartment: buildLikelyDepartment(inferredCategory),
          citizenSummary: buildCitizenSummary(inferredCategory, inferredSeverity, locationText),
        };
      }
    } catch (error) {
      console.warn("OpenAI draft generation failed, falling back to heuristics:", error.message);
    }
  }

  const urgencyText =
    inferredSeverity === "critical"
      ? "The problem appears urgent and may create safety or mobility risks."
      : inferredSeverity === "medium"
      ? "The problem is affecting the area and should be scheduled promptly."
      : "The problem appears localized but still needs civic attention.";

  return {
    title: `${categoryLabel[0].toUpperCase()}${categoryLabel.slice(1)} reported near ${locationText}`,
    description: `A ${categoryLabel} has been noticed near ${locationText}. ${urgencyText}${
      notes ? ` Additional context: ${notes.trim()}` : ""
    }`,
    predictedSeverity: inferredSeverity,
    likelyDepartment: buildLikelyDepartment(inferredCategory),
    citizenSummary: buildCitizenSummary(inferredCategory, inferredSeverity, locationText),
  };
};

const createIssueDraft = async (payload) => {
  const draft = await generateIssueDraft(payload);
  return {
    ...draft,
    ...localizeDraft(draft, payload.language || payload.userContext?.preferredLanguage || "english"),
    workerChecklist: buildWorkerChecklist(payload.category || inferCategory(payload.notes || "")),
  };
};

const findNearbyDuplicate = async ({ category, longitude, latitude }) => {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }

  try {
    const nearbyIssue = await Issue.findDuplicate({
      category,
      longitude,
      latitude,
    });

    if (!nearbyIssue) {
      return null;
    }

    return {
      issueId: nearbyIssue.issueId,
      title: nearbyIssue.title,
      address: nearbyIssue.address,
      status: nearbyIssue.status,
      severity: nearbyIssue.severity,
      duplicateScore: nearbyIssue.duplicateScore,
      distanceMeters: nearbyIssue.distanceMeters,
    };
  } catch (error) {
    if (isGeoIndexReadinessError(error)) {
      return null;
    }

    throw error;
  }
};

module.exports = {
  analyzeIssue,
  findNearbyDuplicate,
  generateIssueDraft: createIssueDraft,
  buildWorkerBrief,
  buildWorkerChecklist,
  verifyResolutionProof,
  buildHotspotForecast,
};
