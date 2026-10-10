const { createClient } = require("@supabase/supabase-js");

let client = null;

const getSupabaseUrl = () => process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";

const getServiceKey = () =>
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

const getAnonKey = () =>
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const isSupabaseConfigured = () => Boolean(getSupabaseUrl() && (getServiceKey() || getAnonKey()));

const isTestMode = () => process.env.NODE_ENV === "test" || !isSupabaseConfigured();

const getSupabase = () => {
  if (client) {
    return client;
  }

  if (!isSupabaseConfigured()) {
    return null;
  }

  // Service-role key bypasses RLS; required for backend writes.
  // Falls back to anon/publishable key (read-limited by RLS policies).
  client = createClient(getSupabaseUrl(), getServiceKey() || getAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
};

module.exports = {
  getSupabase,
  isSupabaseConfigured,
  isTestMode,
  getSupabaseUrl,
};
