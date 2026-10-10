const { getSupabase, isSupabaseConfigured, isTestMode } = require("./supabase");

const connectDB = async () => {
  if (isTestMode() && !isSupabaseConfigured()) {
    console.log("Supabase is not configured. Running with in-memory test store.");
    return;
  }

  const supabase = getSupabase();

  if (!supabase) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or anon key) must be configured. See backend/.env.example."
    );
  }

  const { error } = await supabase.from("users").select("id", { head: true, count: "exact" }).limit(1);

  if (error) {
    throw new Error(`Supabase connection failed: ${error.message}. Did you run backend/supabase/schema.sql?`);
  }

  console.log("Supabase (Postgres) connected");
};

module.exports = connectDB;
