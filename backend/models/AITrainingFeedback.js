const { getSupabase, isTestMode } = require("../config/supabase");
const store = require("./_store");

const rowToDoc = (row) => {
  if (!row) {
    return null;
  }
  return {
    _id: row.id,
    id: row.id,
    issueId: row.issue_id,
    predictedCategory: row.predicted_category || null,
    predictedSeverity: row.predicted_severity || null,
    correctedCategory: row.corrected_category,
    correctedSeverity: row.corrected_severity,
    trainingNotes: row.training_notes || null,
    confidenceOverride: row.confidence_override ?? null,
    correctedBy: row.corrected_by,
    status: row.status,
    appliedAt: row.applied_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const upsertByIssue = async (data) => {
  const payload = {
    issue_id: String(data.issueId?._id || data.issueId?.id || data.issueId),
    predicted_category: data.predictedCategory || null,
    predicted_severity: data.predictedSeverity || null,
    corrected_category: data.correctedCategory,
    corrected_severity: data.correctedSeverity,
    training_notes: data.trainingNotes || "",
    confidence_override: data.confidenceOverride ?? null,
    corrected_by: String(data.correctedBy?._id || data.correctedBy?.id || data.correctedBy),
    status: "approved",
    applied_at: new Date().toISOString(),
  };

  if (isTestMode()) {
    let row = store.tables.feedback.find((f) => String(f.issue_id) === String(payload.issue_id));
    const timestamp = store.nowIso();
    if (row) {
      Object.assign(row, payload, { updated_at: timestamp });
    } else {
      row = { id: store.uid(), ...payload, created_at: timestamp, updated_at: timestamp };
      store.tables.feedback.push(row);
    }
    return rowToDoc(row);
  }

  const { data: row, error } = await getSupabase()
    .from("ai_training_feedback")
    .upsert(payload, { onConflict: "issue_id" })
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  return rowToDoc(row);
};

const counts = async () => {
  if (isTestMode()) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return {
      total: store.tables.feedback.length,
      recent: store.tables.feedback.filter((f) => new Date(f.applied_at) >= sevenDaysAgo).length,
    };
  }
  const supabase = getSupabase();
  const { count: total } = await supabase.from("ai_training_feedback").select("id", { head: true, count: "exact" });
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { count: recent } = await supabase
    .from("ai_training_feedback")
    .select("id", { head: true, count: "exact" })
    .gte("applied_at", sevenDaysAgo.toISOString());
  return { total: total || 0, recent: recent || 0 };
};

const recentList = async (limit = 8) => {
  if (isTestMode()) {
    const User = require("./User");
    const Issue = require("./Issue");
    const rows = [...store.tables.feedback]
      .sort((a, b) => new Date(b.applied_at) - new Date(a.applied_at))
      .slice(0, limit);
    return Promise.all(
      rows.map(async (row) => {
        const doc = rowToDoc(row);
        const [issue, user] = await Promise.all([Issue.findById(row.issue_id), User.findById(row.corrected_by)]);
        return {
          ...doc,
          issueId: issue
            ? { _id: issue.id, id: issue.id, title: issue.title, category: issue.category, severity: issue.severity, status: issue.status, address: issue.address }
            : row.issue_id,
          correctedBy: user ? { _id: user.id, id: user.id, name: user.name, email: user.email } : row.corrected_by,
        };
      })
    );
  }

  const { data, error } = await getSupabase()
    .from("ai_training_feedback")
    .select(
      "*, issues!ai_training_feedback_issue_id_fkey (id, title, category, severity, status, address), users!ai_training_feedback_corrected_by_fkey (id, name, email)"
    )
    .order("applied_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw error;
  }
  return (data || []).map((row) => {
    const doc = rowToDoc(row);
    return {
      ...doc,
      issueId: row.issues
        ? { _id: row.issues.id, id: row.issues.id, title: row.issues.title, category: row.issues.category, severity: row.issues.severity, status: row.issues.status, address: row.issues.address }
        : row.issue_id,
      correctedBy: row.users
        ? { _id: row.users.id, id: row.users.id, name: row.users.name, email: row.users.email }
        : row.corrected_by,
    };
  });
};

const reviewedForCategory = async (category, limit = 30) => {
  if (isTestMode()) {
    const Issue = require("./Issue");
    const rows = store.tables.feedback
      .filter((f) => !category || category === "other" || f.corrected_category === category)
      .sort((a, b) => new Date(b.applied_at) - new Date(a.applied_at))
      .slice(0, limit);
    const out = [];
    for (const row of rows) {
      const issue = await Issue.findById(row.issue_id);
      out.push({
        correctedCategory: row.corrected_category,
        correctedSeverity: row.corrected_severity,
        confidenceOverride: row.confidence_override,
        issueId: issue
          ? { _id: issue.id, id: issue.id, title: issue.title, description: issue.description, address: issue.address, status: issue.status }
          : null,
      });
    }
    return out;
  }

  let query = getSupabase()
    .from("ai_training_feedback")
    .select("corrected_category, corrected_severity, confidence_override, issues!ai_training_feedback_issue_id_fkey (id, title, description, address, status)")
    .eq("status", "approved")
    .order("applied_at", { ascending: false })
    .limit(limit);
  if (category && category !== "other") {
    query = query.eq("corrected_category", category);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data || []).map((row) => ({
    correctedCategory: row.corrected_category,
    correctedSeverity: row.corrected_severity,
    confidenceOverride: row.confidence_override,
    issueId: row.issues
      ? { _id: row.issues.id, id: row.issues.id, title: row.issues.title, description: row.issues.description, address: row.issues.address, status: row.issues.status }
      : null,
  }));
};

const deleteByIssue = async (issueId) => {
  if (isTestMode()) {
    store.tables.feedback = store.tables.feedback.filter((f) => String(f.issue_id) !== String(issueId));
    return true;
  }
  const { error } = await getSupabase().from("ai_training_feedback").delete().eq("issue_id", issueId);
  if (error) {
    throw error;
  }
  return true;
};

module.exports = {
  upsertByIssue,
  counts,
  recentList,
  reviewedForCategory,
  deleteByIssue,
};
