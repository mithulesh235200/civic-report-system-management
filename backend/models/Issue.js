const { getSupabase, isTestMode } = require("../config/supabase");
const store = require("./_store");
const User = require("./User");

const haversineMeters = (lngA, latA, lngB, latB) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(latB - latA);
  const dLng = toRad(lngB - lngA);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const rowToDoc = (row, supporters = []) => {
  if (!row) {
    return null;
  }
  const lng = row.longitude ?? row.lng ?? null;
  const lat = row.latitude ?? row.lat ?? null;
  const doc = {
    _id: row.id,
    id: row.id,
    title: row.title,
    description: row.description,
    image: row.image || null,
    category: row.category,
    severity: row.severity,
    location: { type: "Point", coordinates: [lng, lat] },
    longitude: lng,
    latitude: lat,
    address: row.address || null,
    status: row.status,
    reportedBy: row.reported_by,
    assignedWorker: row.assigned_worker || null,
    aiAnalysis: row.ai_analysis || {},
    proofImage: row.proof_image || null,
    resolutionNotes: row.resolution_notes || null,
    resolutionVerification: row.resolution_verification || null,
    verifiedBy: row.verified_by || null,
    supporters: supporters.map((s) => s),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    save: async () => {
      await updateById(row.id, {
        title: doc.title,
        description: doc.description,
        image: doc.image,
        category: doc.category,
        severity: doc.severity,
        longitude: doc.location?.coordinates?.[0] ?? doc.longitude,
        latitude: doc.location?.coordinates?.[1] ?? doc.latitude,
        address: doc.address,
        status: doc.status,
        assignedWorker: doc.assignedWorker?._id || doc.assignedWorker || null,
        aiAnalysis: doc.aiAnalysis,
        proofImage: doc.proofImage,
        resolutionNotes: doc.resolutionNotes,
        resolutionVerification: doc.resolutionVerification,
        verifiedBy: doc.verifiedBy?._id || doc.verifiedBy || null,
      });
      // Persist supporters added via push on the raw doc
      const currentIds = new Set(getSupporterIds(row.id));
      for (const s of doc.supporters) {
        const sid = String(s?._id || s?.id || s);
        if (!currentIds.has(sid)) {
          await addSupporter(row.id, sid);
        }
      }
      return doc;
    },
  };
  return doc;
};

const toSupabaseInsert = (data) => ({
  title: data.title,
  description: data.description,
  image: data.image || null,
  category: data.category,
  severity: data.severity || "medium",
  longitude: Number(data.longitude ?? data.location?.coordinates?.[0]),
  latitude: Number(data.latitude ?? data.location?.coordinates?.[1]),
  address: data.address || null,
  status: data.status || "reported",
  reported_by: data.reportedBy?._id || data.reportedBy?.id || data.reportedBy,
  assigned_worker: data.assignedWorker?._id || data.assignedWorker?.id || data.assignedWorker || null,
  ai_analysis: data.aiAnalysis || {},
  proof_image: data.proofImage || null,
  resolution_notes: data.resolutionNotes || null,
  resolution_verification: data.resolutionVerification || null,
  verified_by: data.verifiedBy?._id || data.verifiedBy?.id || data.verifiedBy || null,
});

// ---- supporters ----
const getSupporterIds = (issueId) => {
  if (!isTestMode()) {
    throw new Error("getSupporterIds is memory-only; use listSupporters for Supabase");
  }
  return store.tables.supporters.filter((s) => String(s.issue_id) === String(issueId)).map((s) => s.user_id);
};

const listSupporters = async (issueId) => {
  if (isTestMode()) {
    return getSupporterIds(issueId);
  }
  const { data, error } = await getSupabase()
    .from("issue_supporters")
    .select("user_id")
    .eq("issue_id", issueId);
  if (error) {
    throw error;
  }
  return (data || []).map((r) => r.user_id);
};

const addSupporter = async (issueId, userId) => {
  if (isTestMode()) {
    const exists = store.tables.supporters.some(
      (s) => String(s.issue_id) === String(issueId) && String(s.user_id) === String(userId)
    );
    if (!exists) {
      store.tables.supporters.push({ issue_id: issueId, user_id: userId, created_at: store.nowIso() });
    }
    return true;
  }
  const { error } = await getSupabase()
    .from("issue_supporters")
    .upsert({ issue_id: issueId, user_id: userId }, { onConflict: "issue_id,user_id" });
  if (error) {
    throw error;
  }
  return true;
};

const withSupporters = async (rows) => {
  if (isTestMode()) {
    return rows.map((row) => rowToDoc(row, getSupporterIds(row.id)));
  }
  const ids = rows.map((r) => r.id);
  let map = {};
  if (ids.length) {
    const { data, error } = await getSupabase()
      .from("issue_supporters")
      .select("issue_id, user_id")
      .in("issue_id", ids);
    if (error) {
      throw error;
    }
    for (const s of data || []) {
      (map[s.issue_id] = map[s.issue_id] || []).push(s.user_id);
    }
  }
  return rows.map((row) => rowToDoc(row, map[row.id] || []));
};

// ---- CRUD ----
const create = async (data) => {
  if (isTestMode()) {
    const timestamp = store.nowIso();
    const row = {
      id: store.uid(),
      title: data.title,
      description: data.description,
      image: data.image || null,
      category: data.category,
      severity: data.severity || "medium",
      longitude: Number(data.longitude ?? data.location?.coordinates?.[0]),
      latitude: Number(data.latitude ?? data.location?.coordinates?.[1]),
      address: data.address || null,
      status: "reported",
      reported_by: String(data.reportedBy?._id || data.reportedBy?.id || data.reportedBy),
      assigned_worker: null,
      ai_analysis: data.aiAnalysis || {},
      proof_image: null,
      resolution_notes: null,
      resolution_verification: null,
      verified_by: null,
      created_at: timestamp,
      updated_at: timestamp,
    };
    store.tables.issues.push(row);
    return rowToDoc(row, []);
  }

  const { data: row, error } = await getSupabase()
    .from("issues")
    .insert(toSupabaseInsert(data))
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  return rowToDoc(row, []);
};

const findById = async (id) => {
  if (isTestMode()) {
    const row = store.tables.issues.find((i) => String(i.id) === String(id));
    return row ? rowToDoc(row, getSupporterIds(row.id)) : null;
  }
  const { data, error } = await getSupabase().from("issues").select("*").eq("id", id).maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  const supporters = await listSupporters(data.id);
  return rowToDoc(data, supporters);
};

const pickUser = (doc) =>
  doc ? { _id: doc.id, id: doc.id, name: doc.name, email: doc.email, role: doc.role } : null;

const findByIdPopulated = async (id) => {
  const issue = await findById(id);
  if (!issue) {
    return null;
  }
  const [reporter, worker] = await Promise.all([
    User.findById(issue.reportedBy),
    issue.assignedWorker ? User.findById(issue.assignedWorker) : null,
  ]);
  const supporterDocs = await Promise.all(
    (issue.supporters || []).map((sid) => User.findById(sid?._id || sid?.id || sid))
  );
  return {
    ...issue,
    reportedBy: pickUser(reporter) || issue.reportedBy,
    assignedWorker: issue.assignedWorker ? pickUser(worker) : null,
    supporters: supporterDocs.filter(Boolean).map(pickUser),
  };
};

const populateList = async (docs) => {
  const userCache = new Map();
  const getUser = async (id) => {
    if (!id) {
      return null;
    }
    const key = String(id?._id || id?.id || id);
    if (!userCache.has(key)) {
      userCache.set(key, await User.findById(key));
    }
    return userCache.get(key);
  };
  return Promise.all(
    docs.map(async (issue) => {
      const reporter = await getUser(issue.reportedBy);
      const worker = issue.assignedWorker ? await getUser(issue.assignedWorker) : null;
      const supporters = await Promise.all((issue.supporters || []).map((s) => getUser(s?._id || s?.id || s)));
      return {
        ...issue,
        reportedBy: pickUser(reporter) || issue.reportedBy,
        assignedWorker: issue.assignedWorker ? pickUser(worker) : null,
        supporters: supporters.filter(Boolean).map(pickUser),
      };
    })
  );
};

const sortDesc = (rows) => rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

const matchAdmin = (row, { search, status, severity, category }) => {
  if (status && status !== "all" && row.status !== status) {
    return false;
  }
  if (severity && severity !== "all" && row.severity !== severity) {
    return false;
  }
  if (category && category !== "all" && row.category !== category) {
    return false;
  }
  if (search) {
    const q = search.toLowerCase();
    const hay = `${row.title || ""} ${row.description || ""} ${row.address || ""}`.toLowerCase();
    if (!hay.includes(q)) {
      return false;
    }
  }
  return true;
};

const listByReporter = async (userId) => {
  if (isTestMode()) {
    const rows = sortDesc(store.tables.issues.filter((i) => String(i.reported_by) === String(userId)));
    return populateList(await withSupporters(rows));
  }
  const { data, error } = await getSupabase()
    .from("issues")
    .select("*")
    .eq("reported_by", userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return populateList(await withSupporters(data || []));
};

const listMap = async ({ category, severity, status }) => {
  if (isTestMode()) {
    return sortDesc(
      store.tables.issues.filter((i) => {
        if (i.status === "rejected") {
          return false;
        }
        if (category && i.category !== category) {
          return false;
        }
        if (severity && i.severity !== severity) {
          return false;
        }
        if (status && status !== "all" && i.status !== status) {
          return false;
        }
        return true;
      })
    )
      .slice(0, 500)
      .map((row) => ({
        _id: row.id,
        id: row.id,
        title: row.title,
        category: row.category,
        severity: row.severity,
        status: row.status,
        location: { type: "Point", coordinates: [row.longitude, row.latitude] },
        address: row.address,
        createdAt: row.created_at,
        created_at: row.created_at,
      }));
  }

  let query = getSupabase()
    .from("issues")
    .select("id, title, category, severity, status, longitude, latitude, address, created_at")
    .neq("status", "rejected")
    .order("created_at", { ascending: false })
    .limit(500);
  if (category) {
    query = query.eq("category", category);
  }
  if (severity) {
    query = query.eq("severity", severity);
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data || []).map((row) => ({
    _id: row.id,
    id: row.id,
    title: row.title,
    category: row.category,
    severity: row.severity,
    status: row.status,
    location: { type: "Point", coordinates: [row.longitude, row.latitude] },
    address: row.address,
    createdAt: row.created_at,
    created_at: row.created_at,
  }));
};

const listAdmin = async (filters = {}) => {
  if (isTestMode()) {
    const rows = sortDesc(store.tables.issues.filter((i) => matchAdmin(i, filters)));
    return populateList(await withSupporters(rows));
  }
  let query = getSupabase().from("issues").select("*").order("created_at", { ascending: false });
  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.severity && filters.severity !== "all") {
    query = query.eq("severity", filters.severity);
  }
  if (filters.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }
  if (filters.search) {
    const q = `%${filters.search}%`;
    query = query.or(`title.ilike.${q},description.ilike.${q},address.ilike.${q}`);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return populateList(await withSupporters(data || []));
};

const listNearby = async ({ longitude, latitude, radiusKm = 5 }) => {
  const maxMeters = Number(radiusKm) * 1000;
  const within = (row) => {
    if (!Number.isFinite(row.longitude) || !Number.isFinite(row.latitude)) {
      return false;
    }
    return haversineMeters(longitude, latitude, row.longitude, row.latitude) <= maxMeters;
  };
  if (isTestMode()) {
    const rows = store.tables.issues.filter(within).slice(0, 100);
    return withSupporters(rows);
  }
  const { data, error } = await getSupabase().from("issues").select("*").limit(500);
  if (error) {
    throw error;
  }
  return withSupporters((data || []).filter(within).slice(0, 100));
};

const findDuplicate = async ({ category, longitude, latitude }) => {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }
  const pool = isTestMode()
    ? store.tables.issues.filter((i) => i.category === category && i.status !== "rejected")
    : (
        await getSupabase()
          .from("issues")
          .select("id, title, address, status, severity, longitude, latitude")
          .eq("category", category)
          .neq("status", "rejected")
          .limit(200)
      ).data || [];

  let best = null;
  let bestDist = 250;
  for (const row of pool) {
    const dist = haversineMeters(longitude, latitude, row.longitude, row.latitude);
    if (dist <= bestDist) {
      best = row;
      bestDist = dist;
    }
  }
  if (!best) {
    return null;
  }
  return {
    issueId: best.id,
    _id: best.id,
    title: best.title,
    address: best.address,
    status: best.status,
    severity: best.severity,
    duplicateScore: best.address && bestDist <= 100 ? 0.9 : 0.82,
    distanceMeters: bestDist,
  };
};

const candidatesForMemory = async ({ category, limit = 40 }) => {
  if (isTestMode()) {
    return sortDesc(
      store.tables.issues.filter(
        (i) =>
          (!category || category === "other" || i.category === category) &&
          ["verified", "assigned", "in-progress", "resolved"].includes(i.status)
      )
    ).slice(0, limit);
  }
  let query = getSupabase()
    .from("issues")
    .select("id, title, description, category, severity, status, address, ai_analysis, created_at")
    .in("status", ["verified", "assigned", "in-progress", "resolved"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (category && category !== "other") {
    query = query.eq("category", category);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return data || [];
};

const lowConfidenceReview = async (limit = 10) => {
  const isLow = (row) => {
    const ai = row.ai_analysis || row.aiAnalysis || {};
    return (
      (ai.confidenceScore ?? 1) < 0.78 ||
      (ai.semisupervisedConfidence ?? 1) < 0.72 ||
      (ai.retrievalConfidence ?? 1) < 0.4
    );
  };
  if (isTestMode()) {
    return sortDesc(
      store.tables.issues.filter((i) => i.status !== "rejected" && isLow(i))
    ).slice(0, limit);
  }
  const { data, error } = await getSupabase()
    .from("issues")
    .select("id, title, category, severity, status, address, ai_analysis, created_at")
    .neq("status", "rejected")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    throw error;
  }
  return (data || []).filter(isLow).slice(0, limit);
};

const updateById = async (id, patch = {}) => {
  if (isTestMode()) {
    const row = store.tables.issues.find((i) => String(i.id) === String(id));
    if (!row) {
      return null;
    }
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.image !== undefined) row.image = patch.image;
    if (patch.category !== undefined) row.category = patch.category;
    if (patch.severity !== undefined) row.severity = patch.severity;
    if (patch.longitude !== undefined) row.longitude = Number(patch.longitude);
    if (patch.latitude !== undefined) row.latitude = Number(patch.latitude);
    if (patch.address !== undefined) row.address = patch.address;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.assignedWorker !== undefined)
      row.assigned_worker = patch.assignedWorker ? String(patch.assignedWorker) : null;
    if (patch.aiAnalysis !== undefined) row.ai_analysis = patch.aiAnalysis;
    if (patch.proofImage !== undefined) row.proof_image = patch.proofImage;
    if (patch.resolutionNotes !== undefined) row.resolution_notes = patch.resolutionNotes;
    if (patch.resolutionVerification !== undefined) row.resolution_verification = patch.resolutionVerification;
    if (patch.verifiedBy !== undefined)
      row.verified_by = patch.verifiedBy ? String(patch.verifiedBy) : null;
    row.updated_at = store.nowIso();
    return rowToDoc(row, getSupporterIds(row.id));
  }

  const mapping = {};
  if (patch.title !== undefined) mapping.title = patch.title;
  if (patch.description !== undefined) mapping.description = patch.description;
  if (patch.image !== undefined) mapping.image = patch.image;
  if (patch.category !== undefined) mapping.category = patch.category;
  if (patch.severity !== undefined) mapping.severity = patch.severity;
  if (patch.longitude !== undefined) mapping.longitude = Number(patch.longitude);
  if (patch.latitude !== undefined) mapping.latitude = Number(patch.latitude);
  if (patch.address !== undefined) mapping.address = patch.address;
  if (patch.status !== undefined) mapping.status = patch.status;
  if (patch.assignedWorker !== undefined) mapping.assigned_worker = patch.assignedWorker || null;
  if (patch.aiAnalysis !== undefined) mapping.ai_analysis = patch.aiAnalysis;
  if (patch.proofImage !== undefined) mapping.proof_image = patch.proofImage;
  if (patch.resolutionNotes !== undefined) mapping.resolution_notes = patch.resolutionNotes;
  if (patch.resolutionVerification !== undefined)
    mapping.resolution_verification = patch.resolutionVerification;
  if (patch.verifiedBy !== undefined) mapping.verified_by = patch.verifiedBy || null;

  const { data, error } = await getSupabase()
    .from("issues")
    .update(mapping)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? rowToDoc(data, await listSupporters(data.id)) : null;
};

const deleteById = async (id) => {
  if (isTestMode()) {
    store.tables.issues = store.tables.issues.filter((i) => String(i.id) !== String(id));
    store.tables.supporters = store.tables.supporters.filter((s) => String(s.issue_id) !== String(id));
    store.tables.assignments = store.tables.assignments.filter((a) => String(a.issue_id) !== String(id));
    store.tables.comments = store.tables.comments.filter((c) => String(c.issue_id) !== String(id));
    store.tables.feedback = store.tables.feedback.filter((f) => String(f.issue_id) !== String(id));
    return true;
  }
  const supabase = getSupabase();
  await supabase.from("assignments").delete().eq("issue_id", id);
  await supabase.from("comments").delete().eq("issue_id", id);
  await supabase.from("ai_training_feedback").delete().eq("issue_id", id);
  await supabase.from("issue_supporters").delete().eq("issue_id", id);
  const { error } = await supabase.from("issues").delete().eq("id", id);
  if (error) {
    throw error;
  }
  return true;
};

// ---- dashboard aggregates (computed in JS so memory + Supabase match) ----
const allRows = async () => {
  if (isTestMode()) {
    return store.tables.issues;
  }
  const { data, error } = await getSupabase().from("issues").select("*").limit(2000);
  if (error) {
    throw error;
  }
  return data || [];
};

const dashboardStats = async () => {
  const rows = await allRows();
  const active = new Set(["reported", "verified", "assigned"]);
  const byCategory = {};
  const bySeverity = {};
  const byAddress = {};
  const trend = {};
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setHours(0, 0, 0, 0);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  for (const r of rows) {
    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    const created = new Date(r.created_at || r.createdAt);
    if (created >= sevenDaysAgo) {
      const key = `${created.getFullYear()}-${created.getMonth() + 1}-${created.getDate()}`;
      trend[key] = (trend[key] || 0) + 1;
    }
    if (r.address) {
      byAddress[r.address] = byAddress[r.address] || { count: 0, categories: new Set() };
      byAddress[r.address].count += 1;
      byAddress[r.address].categories.add(r.category);
    }
  }

  const topSupported = [...rows]
    .map((r) => ({
      _id: r.id,
      id: r.id,
      title: r.title,
      address: r.address,
      status: r.status,
      supportersCount: 0,
      createdAt: r.created_at || r.createdAt,
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  if (!isTestMode()) {
    const supabase = getSupabase();
    const { data: supporters } = await supabase.from("issue_supporters").select("issue_id");
    const counts = {};
    for (const s of supporters || []) {
      counts[s.issue_id] = (counts[s.issue_id] || 0) + 1;
    }
    topSupported.forEach((t) => {
      t.supportersCount = counts[t._id] || 0;
    });
    topSupported.sort((a, b) => b.supportersCount - a.supportersCount || new Date(b.createdAt) - new Date(a.createdAt));
  } else {
    for (const t of topSupported) {
      t.supportersCount = store.tables.supporters.filter((s) => String(s.issue_id) === String(t._id)).length;
    }
    topSupported.sort((a, b) => b.supportersCount - a.supportersCount || new Date(b.createdAt) - new Date(a.createdAt));
  }

  return {
    totalIssues: rows.length,
    pendingIssues: rows.filter((r) => active.has(r.status)).length,
    resolvedIssues: rows.filter((r) => r.status === "resolved").length,
    categoryBreakdown: Object.entries(byCategory).map(([_id, count]) => ({ _id, count })),
    severityBreakdown: Object.entries(bySeverity).map(([_id, count]) => ({ _id, count })),
    trend,
    hotspots: Object.entries(byAddress)
      .map(([address, v]) => ({ _id: address, count: v.count, categories: [...v.categories] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    topSupportedIssues: topSupported,
  };
};

module.exports = {
  create,
  findById,
  findByIdPopulated,
  populateList,
  listByReporter,
  listMap,
  listAdmin,
  listNearby,
  findDuplicate,
  candidatesForMemory,
  lowConfidenceReview,
  updateById,
  deleteById,
  addSupporter,
  listSupporters,
  dashboardStats,
  haversineMeters,
};
