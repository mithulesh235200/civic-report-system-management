const { getSupabase, isTestMode } = require("../config/supabase");
const store = require("./_store");

const rowToDoc = (row) => {
  if (!row) {
    return null;
  }
  return {
    _id: row.id,
    id: row.id,
    userId: row.user_id,
    message: row.message,
    status: row.status,
    type: row.type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const insertMany = async (docs) => {
  const payload = docs.map((d) => ({
    user_id: String(d.userId?._id || d.userId?.id || d.userId),
    message: d.message,
    type: d.type || "system",
  }));

  if (isTestMode()) {
    const timestamp = store.nowIso();
    const rows = payload.map((p) => ({ id: store.uid(), status: "unread", ...p, created_at: timestamp, updated_at: timestamp }));
    store.tables.notifications.push(...rows);
    return rows.map(rowToDoc);
  }

  const { data, error } = await getSupabase().from("notifications").insert(payload).select("*");
  if (error) {
    throw error;
  }
  return (data || []).map(rowToDoc);
};

const listByUser = async (userId, limit = 100) => {
  if (isTestMode()) {
    return store.tables.notifications
      .filter((n) => String(n.user_id) === String(userId))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
      .map(rowToDoc);
  }
  const { data, error } = await getSupabase()
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    throw error;
  }
  return (data || []).map(rowToDoc);
};

const markRead = async (id, userId) => {
  if (isTestMode()) {
    const row = store.tables.notifications.find(
      (n) => String(n.id) === String(id) && String(n.user_id) === String(userId)
    );
    if (!row) {
      return null;
    }
    row.status = "read";
    row.updated_at = store.nowIso();
    return rowToDoc(row);
  }
  const { data, error } = await getSupabase()
    .from("notifications")
    .update({ status: "read" })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  if (error) {
    throw error;
  }
  return rowToDoc(data);
};

module.exports = {
  insertMany,
  listByUser,
  markRead,
};
