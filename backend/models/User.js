const bcrypt = require("bcryptjs");

const { getSupabase, isTestMode } = require("../config/supabase");
const store = require("./_store");

const normalizeRole = (role) => (role === "citizen" ? "user" : role || "user");

const rowToDoc = (row) => {
  if (!row) {
    return null;
  }

  const role = normalizeRole(row.role);
  const doc = {
    _id: row.id,
    id: row.id,
    name: row.name,
    email: row.email,
    role,
    phone: row.phone || null,
    avatar: row.avatar || null,
    address: row.address || null,
    bio: row.bio || null,
    preferredLanguage: row.preferred_language || "english",
    notificationPreferences: row.notification_preferences || {
      statusUpdates: true,
      nearbyAlerts: true,
      assistantTips: true,
    },
    password: row.password_hash,
    passwordHash: row.password_hash,
    refreshTokenHash: row.refresh_token_hash || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (role === "worker") {
    const hasCoords =
      row.worker_last_lng !== null &&
      row.worker_last_lng !== undefined &&
      row.worker_last_lat !== null &&
      row.worker_last_lat !== undefined;
    doc.workerProfile = {
      availability: row.worker_availability || "offline",
      lastKnownLocation: hasCoords
        ? { type: "Point", coordinates: [row.worker_last_lng, row.worker_last_lat] }
        : null,
      lastLocationUpdatedAt: row.worker_last_location_at || null,
    };
  }

  doc.getPortalRole = () => doc.role;
  doc.comparePassword = (candidate) => bcrypt.compare(candidate, row.password_hash);
  doc.toSafeObject = () => ({
    id: doc.id,
    _id: doc._id,
    name: doc.name,
    email: doc.email,
    role: doc.role,
    phone: doc.phone,
    avatar: doc.avatar,
    address: doc.address,
    bio: doc.bio,
    preferredLanguage: doc.preferredLanguage,
    notificationPreferences: doc.notificationPreferences,
    workerProfile: doc.role === "worker" ? doc.workerProfile : undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  });
  doc.save = async () => {
    await updateById(doc.id, {
      name: doc.name,
      phone: doc.phone,
      avatar: doc.avatar,
      address: doc.address,
      bio: doc.bio,
      preferredLanguage: doc.preferredLanguage,
      notificationPreferences: doc.notificationPreferences,
      workerAvailability: doc.workerProfile?.availability,
      workerLng: doc.workerProfile?.lastKnownLocation?.coordinates?.[0] ?? null,
      workerLat: doc.workerProfile?.lastKnownLocation?.coordinates?.[1] ?? null,
      workerLocationAt: doc.workerProfile?.lastLocationUpdatedAt ?? null,
    });
    return doc;
  };

  return doc;
};

const toRow = (doc) => ({
  id: doc.id,
  name: doc.name,
  email: doc.email,
  password_hash: doc.passwordHash,
  role: doc.role,
  phone: doc.phone,
  avatar: doc.avatar,
  address: doc.address,
  bio: doc.bio,
  preferred_language: doc.preferredLanguage,
  notification_preferences: doc.notificationPreferences,
  refresh_token_hash: doc.refreshTokenHash,
  worker_availability: doc.workerProfile?.availability || null,
  worker_last_lng: doc.workerProfile?.lastKnownLocation?.coordinates?.[0] ?? null,
  worker_last_lat: doc.workerProfile?.lastKnownLocation?.coordinates?.[1] ?? null,
  worker_last_location_at: doc.workerProfile?.lastLocationUpdatedAt || null,
  created_at: doc.createdAt,
  updated_at: doc.updatedAt,
});

const hashPassword = async (plain) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
};

const create = async ({ name, email, password, role = "user", phone = null }) => {
  const normalizedEmail = String(email).toLowerCase().trim();
  const normalizedRole = normalizeRole(role);
  const passwordHash = await hashPassword(password);

  if (isTestMode()) {
    if (store.tables.users.some((u) => u.email === normalizedEmail)) {
      const error = new Error("Duplicate email");
      error.code = "DUPLICATE";
      throw error;
    }
    const timestamp = store.nowIso();
    const row = {
      id: store.uid(),
      name,
      email: normalizedEmail,
      password_hash: passwordHash,
      role: normalizedRole,
      phone: phone || null,
      avatar: null,
      address: null,
      bio: null,
      preferred_language: "english",
      notification_preferences: { statusUpdates: true, nearbyAlerts: true, assistantTips: true },
      refresh_token_hash: null,
      worker_availability: normalizedRole === "worker" ? "offline" : null,
      worker_last_lng: null,
      worker_last_lat: null,
      worker_last_location_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    };
    store.tables.users.push(row);
    return rowToDoc(row);
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .insert({
      name,
      email: normalizedEmail,
      password_hash: passwordHash,
      role: normalizedRole,
      phone: phone || null,
      worker_availability: normalizedRole === "worker" ? "offline" : null,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const dup = new Error("Duplicate email");
      dup.code = "DUPLICATE";
      throw dup;
    }
    throw error;
  }

  return rowToDoc(data);
};

const findByEmail = async (email) => {
  const normalizedEmail = String(email).toLowerCase().trim();

  if (isTestMode()) {
    return rowToDoc(store.tables.users.find((u) => u.email === normalizedEmail) || null);
  }

  const { data, error } = await getSupabase()
    .from("users")
    .select("*")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return rowToDoc(data);
};

const findById = async (id) => {
  if (!id) {
    return null;
  }

  if (isTestMode()) {
    return rowToDoc(store.tables.users.find((u) => String(u.id) === String(id)) || null);
  }

  const { data, error } = await getSupabase().from("users").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw error;
  }
  return rowToDoc(data);
};

const updateById = async (id, patch = {}) => {
  const mapping = {};
  if (patch.name !== undefined) mapping.name = patch.name;
  if (patch.phone !== undefined) mapping.phone = patch.phone;
  if (patch.avatar !== undefined) mapping.avatar = patch.avatar;
  if (patch.address !== undefined) mapping.address = patch.address;
  if (patch.bio !== undefined) mapping.bio = patch.bio;
  if (patch.preferredLanguage !== undefined) mapping.preferred_language = patch.preferredLanguage;
  if (patch.notificationPreferences !== undefined)
    mapping.notification_preferences = patch.notificationPreferences;
  if (patch.refreshTokenHash !== undefined) mapping.refresh_token_hash = patch.refreshTokenHash;
  if (patch.workerAvailability !== undefined) mapping.worker_availability = patch.workerAvailability;
  if (patch.workerLng !== undefined) mapping.worker_last_lng = patch.workerLng;
  if (patch.workerLat !== undefined) mapping.worker_last_lat = patch.workerLat;
  if (patch.workerLocationAt !== undefined) mapping.worker_last_location_at = patch.workerLocationAt;
  if (patch.password !== undefined) mapping.password_hash = await hashPassword(patch.password);

  if (isTestMode()) {
    const row = store.tables.users.find((u) => String(u.id) === String(id));
    if (!row) {
      return null;
    }
    Object.assign(row, mapping, { updated_at: store.nowIso() });
    return rowToDoc(row);
  }

  const { data, error } = await getSupabase()
    .from("users")
    .update(mapping)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }
  return rowToDoc(data);
};

const setRefreshHash = async (id, hash) => updateById(id, { refreshTokenHash: hash });

const listWorkers = async () => {
  if (isTestMode()) {
    return store.tables.users
      .filter((u) => u.role === "worker")
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      .map(rowToDoc);
  }

  const { data, error } = await getSupabase().from("users").select("*").eq("role", "worker").order("name");

  if (error) {
    throw error;
  }
  return (data || []).map(rowToDoc);
};

const listAdminIds = async () => {
  if (isTestMode()) {
    return store.tables.users.filter((u) => u.role === "admin").map((u) => u.id);
  }

  const { data, error } = await getSupabase().from("users").select("id").eq("role", "admin");

  if (error) {
    throw error;
  }
  return (data || []).map((row) => row.id);
};

module.exports = {
  create,
  findByEmail,
  findById,
  updateById,
  setRefreshHash,
  listWorkers,
  listAdminIds,
};
