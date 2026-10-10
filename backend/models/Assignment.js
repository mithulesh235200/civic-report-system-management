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
    workerId: row.worker_id,
    assignedBy: row.assigned_by,
    notes: row.notes || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    save: async () => updateStatus(row.id, docStatus(row)),
  };
};

const docStatus = (row) => row.status;

const create = async ({ issueId, workerId, assignedBy, notes, status = "assigned" }) => {
  const payload = {
    issue_id: String(issueId?._id || issueId?.id || issueId),
    worker_id: String(workerId?._id || workerId?.id || workerId),
    assigned_by: String(assignedBy?._id || assignedBy?.id || assignedBy),
    notes: notes || null,
    status,
  };

  if (isTestMode()) {
    const timestamp = store.nowIso();
    const row = { id: store.uid(), ...payload, created_at: timestamp, updated_at: timestamp };
    store.tables.assignments.push(row);
    return rowToDoc(row);
  }

  const { data, error } = await getSupabase().from("assignments").insert(payload).select("*").single();
  if (error) {
    throw error;
  }
  return rowToDoc(data);
};

const listByWorker = async (workerId) => {
  if (isTestMode()) {
    return store.tables.assignments
      .filter((a) => String(a.worker_id) === String(workerId))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(rowToDoc);
  }
  const { data, error } = await getSupabase()
    .from("assignments")
    .select("*")
    .eq("worker_id", workerId)
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return (data || []).map(rowToDoc);
};

const findOne = async ({ issueId, workerId }) => {
  if (isTestMode()) {
    const row = store.tables.assignments.find(
      (a) => String(a.issue_id) === String(issueId) && String(a.worker_id) === String(workerId)
    );
    return rowToDoc(row || null);
  }
  const { data, error } = await getSupabase()
    .from("assignments")
    .select("*")
    .eq("issue_id", issueId)
    .eq("worker_id", workerId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return rowToDoc(data);
};

const updateStatus = async (id, status) => {
  if (isTestMode()) {
    const row = store.tables.assignments.find((a) => String(a.id) === String(id));
    if (!row) {
      return null;
    }
    row.status = status;
    row.updated_at = store.nowIso();
    return rowToDoc(row);
  }
  const { data, error } = await getSupabase()
    .from("assignments")
    .update({ status })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    throw error;
  }
  return rowToDoc(data);
};

const activeLoadMap = async () => {
  const map = new Map();
  const rows = isTestMode()
    ? store.tables.assignments.filter((a) => ["assigned", "accepted"].includes(a.status))
    : (
        await getSupabase().from("assignments").select("worker_id").in("status", ["assigned", "accepted"]).limit(2000)
      ).data || [];
  for (const r of rows) {
    const key = String(r.worker_id || r.workerId);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
};

const deleteByIssue = async (issueId) => {
  if (isTestMode()) {
    store.tables.assignments = store.tables.assignments.filter((a) => String(a.issue_id) !== String(issueId));
    return true;
  }
  const { error } = await getSupabase().from("assignments").delete().eq("issue_id", issueId);
  if (error) {
    throw error;
  }
  return true;
};

module.exports = {
  create,
  listByWorker,
  findOne,
  updateStatus,
  activeLoadMap,
  deleteByIssue,
};
