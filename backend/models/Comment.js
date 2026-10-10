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
    userId: row.user_id,
    message: row.message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const create = async ({ issueId, userId, message }) => {
  const payload = {
    issue_id: String(issueId?._id || issueId?.id || issueId),
    user_id: String(userId?._id || userId?.id || userId),
    message,
  };

  if (isTestMode()) {
    const timestamp = store.nowIso();
    const row = { id: store.uid(), ...payload, created_at: timestamp, updated_at: timestamp };
    store.tables.comments.push(row);
    return rowToDoc(row);
  }

  const { data, error } = await getSupabase().from("comments").insert(payload).select("*").single();
  if (error) {
    throw error;
  }
  return rowToDoc(data);
};

const listByIssue = async (issueId) => {
  if (isTestMode()) {
    const User = require("./User");
    const rows = store.tables.comments
      .filter((c) => String(c.issue_id) === String(issueId))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const populated = [];
    for (const row of rows) {
      const user = await User.findById(row.user_id);
      populated.push({
        ...rowToDoc(row),
        userId: user ? { _id: user.id, id: user.id, name: user.name, role: user.role } : row.user_id,
      });
    }
    return populated;
  }

  const { data, error } = await getSupabase()
    .from("comments")
    .select("*, users!comments_user_id_fkey (id, name, role)")
    .eq("issue_id", issueId)
    .order("created_at", { ascending: true });
  if (error) {
    throw error;
  }
  return (data || []).map((row) => ({
    ...rowToDoc(row),
    userId: row.users
      ? { _id: row.users.id, id: row.users.id, name: row.users.name, role: row.users.role }
      : row.user_id,
  }));
};

const deleteByIssue = async (issueId) => {
  if (isTestMode()) {
    store.tables.comments = store.tables.comments.filter((c) => String(c.issue_id) !== String(issueId));
    return true;
  }
  const { error } = await getSupabase().from("comments").delete().eq("issue_id", issueId);
  if (error) {
    throw error;
  }
  return true;
};

module.exports = {
  create,
  listByIssue,
  deleteByIssue,
};
