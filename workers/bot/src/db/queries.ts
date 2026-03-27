export interface Env {
  DB: D1Database
  BOT_TOKEN: string
  INTERNAL_SECRET: string
  GH_TOKEN: string
  GH_REPO: string
  MINIAPP_URL: string
}

// ── Users ──────────────────────────────────────────
export async function upsertUser(
  db: D1Database,
  telegramId: number,
  username: string | undefined
) {
  return db.prepare(
    `INSERT INTO users (telegram_id, username)
     VALUES (?, ?)
     ON CONFLICT(telegram_id) DO UPDATE SET username = excluded.username`
  ).bind(telegramId, username ?? null).run()
}

// ── Sessions ───────────────────────────────────────
export async function getSession(db: D1Database, telegramId: number) {
  return db.prepare(
    `SELECT state, data FROM sessions WHERE telegram_id = ?`
  ).bind(telegramId).first<{ state: string; data: string }>()
}

export async function setSession(
  db: D1Database,
  telegramId: number,
  state: string,
  data: object
) {
  return db.prepare(
    `INSERT INTO sessions (telegram_id, state, data, updated_at)
     VALUES (?, ?, ?, unixepoch())
     ON CONFLICT(telegram_id) DO UPDATE SET
       state = excluded.state,
       data = excluded.data,
       updated_at = excluded.updated_at`
  ).bind(telegramId, state, JSON.stringify(data)).run()
}

export async function deleteSession(db: D1Database, telegramId: number) {
  return db.prepare(
    `DELETE FROM sessions WHERE telegram_id = ?`
  ).bind(telegramId).run()
}

// ── Subscriptions ──────────────────────────────────
export async function getSubscription(db: D1Database, telegramId: number) {
  return db.prepare(
    `SELECT s.*, f.*
     FROM subscriptions s
     JOIN subscription_filters f ON s.id = f.subscription_id
     WHERE s.telegram_id = ?`
  ).bind(telegramId).first()
}

export async function createSubscription(
  db: D1Database,
  telegramId: number,
  filters: Record<string, unknown>
) {
  const sub = await db.prepare(
    `INSERT INTO subscriptions (telegram_id) VALUES (?)
     ON CONFLICT(telegram_id) DO UPDATE SET
       status = 'active',
       created_at = unixepoch()
     RETURNING id`
  ).bind(telegramId).first<{ id: number }>()

  if (!sub) throw new Error('Failed to create subscription')

  const {
    location_type, locations,
    room_type, rent_min, rent_max,
    layout, size_min, size_max, shape,
    feat_new, feat_near_mrt, feat_pet, feat_cook,
    feat_parking, feat_elevator, feat_balcony, feat_short_term,
    feat_social_housing, feat_subsidy, feat_elderly,
    feat_invoice, feat_register, exclude_top_floor,
    extra_filters
  } = filters as any

  await db.prepare(
    `INSERT INTO subscription_filters
       (subscription_id, location_type, locations,
        room_type, rent_min, rent_max,
        layout, size_min, size_max, shape,
        feat_new, feat_near_mrt, feat_pet, feat_cook,
        feat_parking, feat_elevator, feat_balcony, feat_short_term,
        feat_social_housing, feat_subsidy, feat_elderly,
        feat_invoice, feat_register, exclude_top_floor, extra_filters)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(subscription_id) DO UPDATE SET
       location_type=excluded.location_type, locations=excluded.locations,
       room_type=excluded.room_type, rent_min=excluded.rent_min, rent_max=excluded.rent_max,
       layout=excluded.layout, size_min=excluded.size_min, size_max=excluded.size_max,
       shape=excluded.shape, feat_new=excluded.feat_new, feat_near_mrt=excluded.feat_near_mrt,
       feat_pet=excluded.feat_pet, feat_cook=excluded.feat_cook, feat_parking=excluded.feat_parking,
       feat_elevator=excluded.feat_elevator, feat_balcony=excluded.feat_balcony,
       feat_short_term=excluded.feat_short_term, feat_social_housing=excluded.feat_social_housing,
       feat_subsidy=excluded.feat_subsidy, feat_elderly=excluded.feat_elderly,
       feat_invoice=excluded.feat_invoice, feat_register=excluded.feat_register,
       exclude_top_floor=excluded.exclude_top_floor, extra_filters=excluded.extra_filters`
  ).bind(
    sub.id, location_type, JSON.stringify(locations),
    room_type ?? null, rent_min ?? null, rent_max ?? null,
    layout ?? null, size_min ?? null, size_max ?? null, shape ?? null,
    feat_new ?? 0, feat_near_mrt ?? 0, feat_pet ?? 0, feat_cook ?? 0,
    feat_parking ?? 0, feat_elevator ?? 0, feat_balcony ?? 0, feat_short_term ?? 0,
    feat_social_housing ?? 0, feat_subsidy ?? 0, feat_elderly ?? 0,
    feat_invoice ?? 0, feat_register ?? 0, exclude_top_floor ?? 0,
    JSON.stringify(extra_filters ?? {})
  ).run()

  return sub.id
}

export async function updateSubscriptionStatus(
  db: D1Database,
  telegramId: number,
  status: 'active' | 'paused'
) {
  return db.prepare(
    `UPDATE subscriptions SET status = ? WHERE telegram_id = ?`
  ).bind(status, telegramId).run()
}

export async function getAllActiveSubscriptions(db: D1Database) {
  return db.prepare(
    `SELECT s.id, s.telegram_id, s.last_run_at, f.*
     FROM subscriptions s
     JOIN subscription_filters f ON s.id = f.subscription_id
     WHERE s.status = 'active'`
  ).all()
}

export async function updateLastRunAt(db: D1Database, subscriptionId: number) {
  return db.prepare(
    `UPDATE subscriptions SET last_run_at = unixepoch() WHERE id = ?`
  ).bind(subscriptionId).run()
}
