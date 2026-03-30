import { build591Url } from '../../shared/build-url'

interface Env {
  DB: D1Database
  BOT_TOKEN: string
  GH_TOKEN: string
  GH_REPO: string
}

// ── Telegram initData validation ───────────────────
async function validateInitData(
  initData: string,
  botToken: string
): Promise<{ valid: boolean; telegramId?: number; username?: string }> {
  if (!initData) return { valid: false }

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return { valid: false }

  // Check auth_date is within 1 hour
  const authDate = parseInt(params.get('auth_date') ?? '0')
  const now = Math.floor(Date.now() / 1000)
  if (now - authDate > 3600) return { valid: false }

  // Build data-check-string: sorted key=value pairs (excluding hash)
  params.delete('hash')
  const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n')

  // HMAC-SHA256("WebAppData", botToken) as secret key, then sign dataCheckString
  const encoder = new TextEncoder()
  const secretKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode('WebAppData'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const secretKeyBytes = await crypto.subtle.sign('HMAC', secretKey, encoder.encode(botToken))

  const dataKey = await crypto.subtle.importKey(
    'raw',
    secretKeyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signatureBytes = await crypto.subtle.sign('HMAC', dataKey, encoder.encode(dataCheckString))
  const signature = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  if (signature !== hash) return { valid: false }

  // Parse user info from initData
  const userStr = params.get('user')
  if (!userStr) return { valid: false }

  try {
    const user = JSON.parse(userStr)
    return { valid: true, telegramId: user.id, username: user.username }
  } catch {
    return { valid: false }
  }
}

// ── DB helpers ─────────────────────────────────────
async function upsertUser(db: D1Database, telegramId: number, username: string | undefined) {
  return db
    .prepare(
      `INSERT INTO users (telegram_id, username)
       VALUES (?, ?)
       ON CONFLICT(telegram_id) DO UPDATE SET username = excluded.username`
    )
    .bind(telegramId, username ?? null)
    .run()
}

async function getSubscription(db: D1Database, telegramId: number) {
  return db
    .prepare(
      `SELECT s.id, s.status, s.created_at, f.*
       FROM subscriptions s
       JOIN subscription_filters f ON s.id = f.subscription_id
       WHERE s.telegram_id = ?`
    )
    .bind(telegramId)
    .first<Record<string, unknown>>()
}

async function upsertSubscription(
  db: D1Database,
  telegramId: number,
  filters: Record<string, unknown>
) {
  const sub = await db
    .prepare(
      `INSERT INTO subscriptions (telegram_id) VALUES (?)
       ON CONFLICT(telegram_id) DO UPDATE SET
         status = 'active',
         created_at = unixepoch()
       RETURNING id`
    )
    .bind(telegramId)
    .first<{ id: number }>()

  if (!sub) throw new Error('Failed to create subscription')

  const {
    locations,
    room_type,
    rent_min,
    rent_max,
    layout,
    size_min,
    size_max,
    shape,
    feat_new,
    feat_near_mrt,
    feat_pet,
    feat_cook,
    feat_parking,
    feat_elevator,
    feat_balcony,
    feat_short_term,
    feat_social_housing,
    feat_subsidy,
    feat_elderly,
    feat_invoice,
    feat_register,
    exclude_top_floor,
    extra_filters,
  } = filters as any

  await db
    .prepare(
      `INSERT INTO subscription_filters
         (subscription_id, locations,
          room_type, rent_min, rent_max,
          layout, size_min, size_max, shape,
          feat_new, feat_near_mrt, feat_pet, feat_cook,
          feat_parking, feat_elevator, feat_balcony, feat_short_term,
          feat_social_housing, feat_subsidy, feat_elderly,
          feat_invoice, feat_register, exclude_top_floor, extra_filters)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(subscription_id) DO UPDATE SET
         locations=excluded.locations,
         room_type=excluded.room_type, rent_min=excluded.rent_min, rent_max=excluded.rent_max,
         layout=excluded.layout, size_min=excluded.size_min, size_max=excluded.size_max,
         shape=excluded.shape, feat_new=excluded.feat_new, feat_near_mrt=excluded.feat_near_mrt,
         feat_pet=excluded.feat_pet, feat_cook=excluded.feat_cook,
         feat_parking=excluded.feat_parking, feat_elevator=excluded.feat_elevator,
         feat_balcony=excluded.feat_balcony, feat_short_term=excluded.feat_short_term,
         feat_social_housing=excluded.feat_social_housing, feat_subsidy=excluded.feat_subsidy,
         feat_elderly=excluded.feat_elderly, feat_invoice=excluded.feat_invoice,
         feat_register=excluded.feat_register, exclude_top_floor=excluded.exclude_top_floor,
         extra_filters=excluded.extra_filters`
    )
    .bind(
      sub.id,
      typeof locations === 'string' ? locations : JSON.stringify(locations),
      room_type ?? null,
      rent_min ?? null,
      rent_max ?? null,
      layout ?? null,
      size_min ?? null,
      size_max ?? null,
      shape ?? null,
      feat_new ?? 0,
      feat_near_mrt ?? 0,
      feat_pet ?? 0,
      feat_cook ?? 0,
      feat_parking ?? 0,
      feat_elevator ?? 0,
      feat_balcony ?? 0,
      feat_short_term ?? 0,
      feat_social_housing ?? 0,
      feat_subsidy ?? 0,
      feat_elderly ?? 0,
      feat_invoice ?? 0,
      feat_register ?? 0,
      exclude_top_floor ?? 0,
      JSON.stringify(extra_filters ?? {})
    )
    .run()

  return sub.id
}

async function updateSubscriptionStatus(
  db: D1Database,
  telegramId: number,
  status: 'active' | 'paused'
) {
  return db
    .prepare(`UPDATE subscriptions SET status = ? WHERE telegram_id = ?`)
    .bind(status, telegramId)
    .run()
}

async function deleteSubscription(db: D1Database, telegramId: number) {
  // Delete filters first (FK), then subscription
  const sub = await db
    .prepare(`SELECT id FROM subscriptions WHERE telegram_id = ?`)
    .bind(telegramId)
    .first<{ id: number }>()
  if (!sub) return
  await db.prepare(`DELETE FROM subscription_filters WHERE subscription_id = ?`).bind(sub.id).run()
  await db.prepare(`DELETE FROM subscriptions WHERE telegram_id = ?`).bind(telegramId).run()
}

// ── CORS helpers ───────────────────────────────────
function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

function json(data: unknown, status = 200, origin = '*'): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  })
}

function err(message: string, status: number, origin = '*'): Response {
  return json({ error: message }, status, origin)
}

// ── Main handler ───────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin') ?? '*'

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    // Auth: extract initData from Authorization header
    const authHeader = request.headers.get('Authorization') ?? ''
    const initData = authHeader.startsWith('tma ') ? authHeader.slice(4) : ''

    const authResult = await validateInitData(initData, env.BOT_TOKEN)
    if (!authResult.valid || !authResult.telegramId) {
      return err('Unauthorized', 401, origin)
    }

    const { telegramId, username } = authResult

    // Ensure user exists
    await upsertUser(env.DB, telegramId, username)

    const path = url.pathname

    // ── GET /subscription ──────────────────────────
    if (request.method === 'GET' && path === '/subscription') {
      const row = await getSubscription(env.DB, telegramId)
      if (!row) {
        return json({ subscription: null }, 200, origin)
      }
      const { id, status, created_at, subscription_id, ...filters } = row
      // Parse JSON fields
      if (typeof filters.locations === 'string') {
        try { filters.locations = JSON.parse(filters.locations as string) } catch {}
      }
      if (typeof filters.extra_filters === 'string') {
        try { filters.extra_filters = JSON.parse(filters.extra_filters as string) } catch {}
      }
      return json({ subscription: { id, status, created_at, filters } }, 200, origin)
    }

    // ── PUT /subscription ──────────────────────────
    if (request.method === 'PUT' && path === '/subscription') {
      let body: Record<string, unknown>
      try {
        body = await request.json()
      } catch {
        return err('Invalid JSON', 400, origin)
      }

      // Validate required fields
      const locs = body.locations as any
      if (!locs || (((!locs.areas || locs.areas.length === 0) && (!locs.lines || locs.lines.length === 0)))) {
        return err('locations with at least one area or line is required', 400, origin)
      }

      try {
        const subId = await upsertSubscription(env.DB, telegramId, body)
        return json({ ok: true, subscription_id: subId }, 200, origin)
      } catch (e: any) {
        console.error('upsertSubscription error:', e)
        return err('Database error', 500, origin)
      }
    }

    // ── PATCH /subscription/status ─────────────────
    if (request.method === 'PATCH' && path === '/subscription/status') {
      let body: { status?: string }
      try {
        body = await request.json()
      } catch {
        return err('Invalid JSON', 400, origin)
      }

      if (body.status !== 'active' && body.status !== 'paused') {
        return err('status must be "active" or "paused"', 400, origin)
      }

      await updateSubscriptionStatus(env.DB, telegramId, body.status)
      return json({ ok: true }, 200, origin)
    }

    // ── DELETE /subscription ───────────────────────
    if (request.method === 'DELETE' && path === '/subscription') {
      await deleteSubscription(env.DB, telegramId)
      return json({ ok: true }, 200, origin)
    }

    // ── POST /search ───────────────────────────────
    if (request.method === 'POST' && path === '/search') {
      const row = await getSubscription(env.DB, telegramId)
      if (!row) {
        return json({ ok: false, error: 'NO_SUBSCRIPTION' }, 400, origin)
      }

      const subscriptions = [{
        chat_id: String(telegramId),
        urls: build591Url(row),
      }]

      const ghResp = await fetch(
        `https://api.github.com/repos/${env.GH_REPO}/actions/workflows/crawl.yml/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.GH_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'User-Agent': '591-rent-bot',
          },
          body: JSON.stringify({
            ref: 'main',
            inputs: { subscriptions: JSON.stringify(subscriptions) },
          }),
        }
      )

      if (!ghResp.ok) {
        const body = await ghResp.text()
        console.error(`[Search] GHA 觸發失敗: ${ghResp.status} ${body}`)
        return json({ ok: false, error: 'TRIGGER_FAILED' }, 502, origin)
      }
      return json({ ok: true }, 200, origin)
    }

    return err('Not Found', 404, origin)
  },
}
