const ROLES = {
  USER: "user",
  ADMIN: "admin",
  WORKER: "worker",
};

const ISSUE_CATEGORIES = [
  "pothole",
  "garbage",
  "water-leakage",
  "streetlight",
  "road-damage",
  "other",
];

const ISSUE_SEVERITY = {
  LOW: "low",
  MEDIUM: "medium",
  CRITICAL: "critical",
};

const ISSUE_STATUS = {
  REPORTED: "reported",
  VERIFIED: "verified",
  ASSIGNED: "assigned",
  IN_PROGRESS: "in-progress",
  RESOLVED: "resolved",
  REJECTED: "rejected",
};

module.exports = {
  ROLES,
  ISSUE_CATEGORIES,
  ISSUE_SEVERITY,
  ISSUE_STATUS,
};
