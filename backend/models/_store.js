// Shared in-memory store used when NODE_ENV=test or Supabase env is missing.
// Production uses Supabase Postgres via @supabase/supabase-js.
const crypto = require("crypto");

const tables = {
  users: [],
  issues: [],
  supporters: [],
  assignments: [],
  comments: [],
  notifications: [],
  feedback: [],
};

const uid = () => crypto.randomUUID();

const nowIso = () => new Date().toISOString();

const reset = () => {
  tables.users = [];
  tables.issues = [];
  tables.supporters = [];
  tables.assignments = [];
  tables.comments = [];
  tables.notifications = [];
  tables.feedback = [];
};

module.exports = {
  tables,
  uid,
  nowIso,
  reset,
};
