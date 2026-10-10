-- CivicTrack Supabase schema (Postgres). Run this in Supabase SQL Editor.
-- Project: https://fkmocqvsvisrkfgqpcab.supabase.co

create extension if not exists "pgcrypto";

-- USERS ---------------------------------------------------------------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  password_hash text not null,
  role text not null default 'user' check (role in ('user', 'admin', 'worker')),
  phone text,
  avatar text,
  address text,
  bio text check (char_length(bio) <= 280),
  preferred_language text not null default 'english' check (preferred_language in ('english', 'hinglish')),
  notification_preferences jsonb not null default '{"statusUpdates": true, "nearbyAlerts": true, "assistantTips": true}',
  refresh_token_hash text,
  worker_availability text check (worker_availability in ('available', 'busy', 'offline')),
  worker_last_lng double precision,
  worker_last_lat double precision,
  worker_last_location_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists users_role_idx on users (role);
create index if not exists users_email_idx on users (email);

-- ISSUES --------------------------------------------------------------
create table if not exists issues (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  image text,
  category text not null check (category in ('pothole', 'garbage', 'water-leakage', 'streetlight', 'road-damage', 'other')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'critical')),
  longitude double precision not null,
  latitude double precision not null,
  address text,
  status text not null default 'reported' check (status in ('reported', 'verified', 'assigned', 'in-progress', 'resolved', 'rejected')),
  reported_by uuid not null references users (id) on delete cascade,
  assigned_worker uuid references users (id) on delete set null,
  ai_analysis jsonb not null default '{}',
  proof_image text,
  resolution_notes text,
  resolution_verification jsonb,
  verified_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists issues_status_idx on issues (status);
create index if not exists issues_category_idx on issues (category);
create index if not exists issues_reported_by_idx on issues (reported_by);
create index if not exists issues_assigned_worker_idx on issues (assigned_worker);
create index if not exists issues_created_at_idx on issues (created_at desc);
create index if not exists issues_geo_idx on issues (longitude, latitude);

-- SUPPORTERS (join table, replaces Mongoose array) --------------------
create table if not exists issue_supporters (
  issue_id uuid not null references issues (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (issue_id, user_id)
);

-- ASSIGNMENTS ---------------------------------------------------------
create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references issues (id) on delete cascade,
  worker_id uuid not null references users (id) on delete cascade,
  assigned_by uuid not null references users (id) on delete cascade,
  notes text,
  status text not null default 'assigned' check (status in ('assigned', 'accepted', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assignments_worker_idx on assignments (worker_id, status);
create index if not exists assignments_issue_idx on assignments (issue_id);

-- COMMENTS ------------------------------------------------------------
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references issues (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists comments_issue_idx on comments (issue_id, created_at);

-- NOTIFICATIONS -------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  message text not null,
  status text not null default 'unread' check (status in ('unread', 'read')),
  type text not null default 'system' check (type in ('issue-status', 'assignment', 'system', 'proof-review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, status, created_at desc);

-- AI TRAINING FEEDBACK ------------------------------------------------
create table if not exists ai_training_feedback (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null unique references issues (id) on delete cascade,
  predicted_category text,
  predicted_severity text,
  corrected_category text not null check (corrected_category in ('pothole', 'garbage', 'water-leakage', 'streetlight', 'road-damage', 'other')),
  corrected_severity text not null check (corrected_severity in ('low', 'medium', 'critical')),
  training_notes text check (char_length(training_notes) <= 500),
  confidence_override double precision check (confidence_override is null or (confidence_override >= 0 and confidence_override <= 1)),
  corrected_by uuid not null references users (id) on delete cascade,
  status text not null default 'approved' check (status = 'approved'),
  applied_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_feedback_corrected_idx on ai_training_feedback (corrected_category, corrected_severity);

-- updated_at trigger --------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_updated on users;
create trigger trg_users_updated before update on users
for each row execute function set_updated_at();

drop trigger if exists trg_issues_updated on issues;
create trigger trg_issues_updated before update on issues
for each row execute function set_updated_at();

drop trigger if exists trg_assignments_updated on assignments;
create trigger trg_assignments_updated before update on assignments
for each row execute function set_updated_at();

drop trigger if exists trg_comments_updated on comments;
create trigger trg_comments_updated before update on comments
for each row execute function set_updated_at();

drop trigger if exists trg_notifications_updated on notifications;
create trigger trg_notifications_updated before update on notifications
for each row execute function set_updated_at();

drop trigger if exists trg_ai_feedback_updated on ai_training_feedback;
create trigger trg_ai_feedback_updated before update on ai_training_feedback
for each row execute function set_updated_at();
