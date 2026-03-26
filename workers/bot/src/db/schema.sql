CREATE TABLE IF NOT EXISTS users (
  telegram_id INTEGER PRIMARY KEY,
  username    TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id   INTEGER NOT NULL REFERENCES users(telegram_id),
  status        TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused')),
  cron_interval INTEGER NOT NULL DEFAULT 60,
  last_run_at   INTEGER,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(telegram_id)
);

CREATE TABLE IF NOT EXISTS subscription_filters (
  subscription_id      INTEGER PRIMARY KEY REFERENCES subscriptions(id),
  location_type        TEXT NOT NULL CHECK(location_type IN ('town','mrt')),
  locations            TEXT NOT NULL,
  room_type            TEXT,
  rent_min             INTEGER,
  rent_max             INTEGER,
  layout               TEXT,
  size_min             INTEGER,
  size_max             INTEGER,
  shape                TEXT,
  feat_new             INTEGER NOT NULL DEFAULT 0,
  feat_near_mrt        INTEGER NOT NULL DEFAULT 0,
  feat_pet             INTEGER NOT NULL DEFAULT 0,
  feat_cook            INTEGER NOT NULL DEFAULT 0,
  feat_parking         INTEGER NOT NULL DEFAULT 0,
  feat_elevator        INTEGER NOT NULL DEFAULT 0,
  feat_balcony         INTEGER NOT NULL DEFAULT 0,
  feat_short_term      INTEGER NOT NULL DEFAULT 0,
  feat_social_housing  INTEGER NOT NULL DEFAULT 0,
  feat_subsidy         INTEGER NOT NULL DEFAULT 0,
  feat_elderly         INTEGER NOT NULL DEFAULT 0,
  feat_invoice         INTEGER NOT NULL DEFAULT 0,
  feat_register        INTEGER NOT NULL DEFAULT 0,
  exclude_top_floor    INTEGER NOT NULL DEFAULT 0,
  extra_filters        TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS sessions (
  telegram_id  INTEGER PRIMARY KEY,
  state        TEXT    NOT NULL,
  data         TEXT    NOT NULL DEFAULT '{}',
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON subscriptions(status);
