import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { env, SELF } from 'cloudflare:test'

// ── Schema setup ───────────────────────────────────────────────────────────

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY,
    username    TEXT,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  )`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id   INTEGER NOT NULL REFERENCES users(telegram_id),
    status        TEXT    NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused')),
    cron_interval INTEGER NOT NULL DEFAULT 60,
    last_run_at   INTEGER,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(telegram_id)
  )`,
  `CREATE TABLE IF NOT EXISTS subscription_filters (
    subscription_id      INTEGER PRIMARY KEY REFERENCES subscriptions(id),
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
  )`,
  `CREATE TABLE IF NOT EXISTS hidden_items (
    telegram_id INTEGER NOT NULL REFERENCES users(telegram_id),
    item_id     TEXT    NOT NULL,
    title       TEXT    NOT NULL,
    link        TEXT    NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (telegram_id, item_id)
  )`,
]

beforeAll(async () => {
  for (const stmt of SCHEMA_STATEMENTS) {
    await env.DB.prepare(stmt).run()
  }
})

// ── validateInitData (pure crypto logic, replicated for unit testing) ───────

async function validateInitData(
  initData: string,
  botToken: string
): Promise<{ valid: boolean; telegramId?: number; username?: string }> {
  if (!initData) return { valid: false }

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return { valid: false }

  const authDate = parseInt(params.get('auth_date') ?? '0')
  const now = Math.floor(Date.now() / 1000)
  if (now - authDate > 3600) return { valid: false }

  params.delete('hash')
  const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n')

  const encoder = new TextEncoder()
  const secretKey = await crypto.subtle.importKey(
    'raw', encoder.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const secretKeyBytes = await crypto.subtle.sign('HMAC', secretKey, encoder.encode(botToken))
  const dataKey = await crypto.subtle.importKey(
    'raw', secretKeyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const signatureBytes = await crypto.subtle.sign('HMAC', dataKey, encoder.encode(dataCheckString))
  const signature = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  if (signature !== hash) return { valid: false }

  const userStr = params.get('user')
  if (!userStr) return { valid: false }
  try {
    const user = JSON.parse(userStr)
    return { valid: true, telegramId: user.id, username: user.username }
  } catch {
    return { valid: false }
  }
}

async function buildValidInitData(botToken: string, userId: number, username: string): Promise<string> {
  const authDate = Math.floor(Date.now() / 1000)
  const user = JSON.stringify({ id: userId, username })
  const params = new URLSearchParams({ auth_date: String(authDate), user })
  const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n')

  const encoder = new TextEncoder()
  const secretKey = await crypto.subtle.importKey(
    'raw', encoder.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const secretKeyBytes = await crypto.subtle.sign('HMAC', secretKey, encoder.encode(botToken))
  const dataKey = await crypto.subtle.importKey(
    'raw', secretKeyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const signatureBytes = await crypto.subtle.sign('HMAC', dataKey, encoder.encode(dataCheckString))
  const hash = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  params.set('hash', hash)
  return params.toString()
}

// ── validateInitData tests ─────────────────────────────────────────────────

describe('validateInitData', () => {
  const BOT_TOKEN = 'test-bot-token-123'

  it('valid hash → returns valid:true with telegramId and username', async () => {
    const initData = await buildValidInitData(BOT_TOKEN, 12345, 'testuser')
    const result = await validateInitData(initData, BOT_TOKEN)
    expect(result.valid).toBe(true)
    expect(result.telegramId).toBe(12345)
    expect(result.username).toBe('testuser')
  })

  it('wrong hash → returns valid:false', async () => {
    const initData = await buildValidInitData(BOT_TOKEN, 12345, 'testuser')
    const tampered = initData.replace(/hash=[^&]+/, 'hash=deadbeefdeadbeef')
    const result = await validateInitData(tampered, BOT_TOKEN)
    expect(result.valid).toBe(false)
  })

  it('auth_date older than 1 hour → returns valid:false', async () => {
    const staleDate = Math.floor(Date.now() / 1000) - 3601
    const user = JSON.stringify({ id: 12345, username: 'testuser' })
    const params = new URLSearchParams({ auth_date: String(staleDate), user })
    const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n')
    const encoder = new TextEncoder()
    const secretKey = await crypto.subtle.importKey(
      'raw', encoder.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const secretKeyBytes = await crypto.subtle.sign('HMAC', secretKey, encoder.encode(BOT_TOKEN))
    const dataKey = await crypto.subtle.importKey(
      'raw', secretKeyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const signatureBytes = await crypto.subtle.sign('HMAC', dataKey, encoder.encode(dataCheckString))
    const hash = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    params.set('hash', hash)

    const result = await validateInitData(params.toString(), BOT_TOKEN)
    expect(result.valid).toBe(false)
  })
})

// ── HTTP endpoint tests ────────────────────────────────────────────────────

describe('PUT /subscription', () => {
  async function putSub(locations: object, userId = 10001): Promise<Response> {
    const initData = await buildValidInitData(env.BOT_TOKEN as string, userId, 'tester')
    return SELF.fetch('http://localhost/subscription', {
      method: 'PUT',
      headers: { Authorization: `tma ${initData}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations }),
    })
  }

  it('areas only → 200 ok', async () => {
    const res = await putSub({ areas: [{ city: '台北市', region: '大安區' }], lines: [] }, 10001)
    expect(res.status).toBe(200)
    const json = await res.json() as any
    expect(json.ok).toBe(true)
  })

  it('lines only → 200 ok', async () => {
    const res = await putSub({ areas: [], lines: [{ line: '板南線', stations: ['忠孝敦化'] }] }, 10002)
    expect(res.status).toBe(200)
    const json = await res.json() as any
    expect(json.ok).toBe(true)
  })

  it('both areas and lines → 200 ok', async () => {
    const res = await putSub({
      areas: [{ city: '台北市', region: '大安區' }],
      lines: [{ line: '板南線', stations: ['忠孝敦化'] }],
    }, 10003)
    expect(res.status).toBe(200)
  })

  it('both empty → 400', async () => {
    const res = await putSub({ areas: [], lines: [] }, 10004)
    expect(res.status).toBe(400)
  })

  it('missing locations → 400', async () => {
    const initData = await buildValidInitData(env.BOT_TOKEN as string, 10005, 'tester')
    const res = await SELF.fetch('http://localhost/subscription', {
      method: 'PUT',
      headers: { Authorization: `tma ${initData}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})

describe('GET /subscription', () => {
  it('returns filters without location_type, locations as correct JSON', async () => {
    const userId = 20001
    const locations = { areas: [{ city: '台北市', region: '大安區' }], lines: [] }
    const initData = await buildValidInitData(env.BOT_TOKEN as string, userId, 'tester')
    const auth = `tma ${initData}`

    // Create subscription
    await SELF.fetch('http://localhost/subscription', {
      method: 'PUT',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations }),
    })

    const res = await SELF.fetch('http://localhost/subscription', {
      headers: { Authorization: auth },
    })
    expect(res.status).toBe(200)
    const json = await res.json() as any
    expect(json.subscription).not.toBeNull()
    const filters = json.subscription.filters
    expect(filters).not.toHaveProperty('location_type')
    expect(filters.locations).toBeDefined()
    expect(filters.locations.areas).toBeInstanceOf(Array)
    expect(filters.locations.lines).toBeInstanceOf(Array)
  })

  it('no subscription → returns subscription: null', async () => {
    const initData = await buildValidInitData(env.BOT_TOKEN as string, 20002, 'tester')
    const res = await SELF.fetch('http://localhost/subscription', {
      headers: { Authorization: `tma ${initData}` },
    })
    expect(res.status).toBe(200)
    const json = await res.json() as any
    expect(json.subscription).toBeNull()
  })
})

describe('PATCH /subscription/status', () => {
  it('active↔paused toggle works correctly', async () => {
    const userId = 30001
    const initData = await buildValidInitData(env.BOT_TOKEN as string, userId, 'tester')
    const auth = `tma ${initData}`

    // Create subscription (active by default)
    await SELF.fetch('http://localhost/subscription', {
      method: 'PUT',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations: { areas: [{ city: '台北市', region: '大安區' }], lines: [] } }),
    })

    // Pause it
    const pauseRes = await SELF.fetch('http://localhost/subscription/status', {
      method: 'PATCH',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paused' }),
    })
    expect(pauseRes.status).toBe(200)

    // Verify paused
    const getRes = await SELF.fetch('http://localhost/subscription', { headers: { Authorization: auth } })
    const getJson = await getRes.json() as any
    expect(getJson.subscription.status).toBe('paused')

    // Resume it
    await SELF.fetch('http://localhost/subscription/status', {
      method: 'PATCH',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    })

    // Verify active
    const getRes2 = await SELF.fetch('http://localhost/subscription', { headers: { Authorization: auth } })
    const getJson2 = await getRes2.json() as any
    expect(getJson2.subscription.status).toBe('active')
  })
})

describe('DELETE /subscription', () => {
  it('after DELETE, GET returns subscription: null', async () => {
    const userId = 40001
    const initData = await buildValidInitData(env.BOT_TOKEN as string, userId, 'tester')
    const auth = `tma ${initData}`

    // Create subscription
    await SELF.fetch('http://localhost/subscription', {
      method: 'PUT',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations: { areas: [{ city: '台北市', region: '大安區' }], lines: [] } }),
    })

    // Delete it
    const delRes = await SELF.fetch('http://localhost/subscription', {
      method: 'DELETE',
      headers: { Authorization: auth },
    })
    expect(delRes.status).toBe(200)

    // Verify gone
    const getRes = await SELF.fetch('http://localhost/subscription', { headers: { Authorization: auth } })
    const getJson = await getRes.json() as any
    expect(getJson.subscription).toBeNull()
  })
})

describe('POST /search', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('有訂閱 → 200 ok（mock GitHub API 回傳 204）', async () => {
    const userId = 50001
    const initData = await buildValidInitData(env.BOT_TOKEN as string, userId, 'tester')
    const auth = `tma ${initData}`

    // Create subscription
    await SELF.fetch('http://localhost/subscription', {
      method: 'PUT',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations: { areas: [{ city: '台北市', region: '大安區' }], lines: [] } }),
    })

    // Stub global fetch so GitHub API call returns 204
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url.includes('api.github.com')) {
        return new Response(null, { status: 204 })
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })

    const res = await SELF.fetch('http://localhost/search', {
      method: 'POST',
      headers: { Authorization: auth },
    })
    expect(res.status).toBe(200)
    const json = await res.json() as any
    expect(json.ok).toBe(true)
  })

  it('無訂閱 → 400 NO_SUBSCRIPTION', async () => {
    const initData = await buildValidInitData(env.BOT_TOKEN as string, 50002, 'tester')
    const res = await SELF.fetch('http://localhost/search', {
      method: 'POST',
      headers: { Authorization: `tma ${initData}` },
    })
    expect(res.status).toBe(400)
    const json = await res.json() as any
    expect(json.error).toBe('NO_SUBSCRIPTION')
  })

  it('initData 無效 → 401', async () => {
    const res = await SELF.fetch('http://localhost/search', {
      method: 'POST',
      headers: { Authorization: 'tma invalid_data' },
    })
    expect(res.status).toBe(401)
  })
})
