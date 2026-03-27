import { Bot, webhookCallback } from 'grammy'
import { Env } from './db/queries'
import { createBot } from './bot'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const bot = createBot(env)
    const url = new URL(request.url)

    // Webhook endpoint
    if (request.method === 'POST' && url.pathname === '/webhook') {
      const handleUpdate = webhookCallback(bot, 'cloudflare-mod')
      return handleUpdate(request)
    }

    return new Response('591 Rent Bot is running', { status: 200 })
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const { getAllActiveSubscriptions, updateLastRunAt } = await import('./db/queries')
    const { build591Url } = await import('./utils/build-url')

    console.log('[Cron] 開始執行排程')

    const result = await getAllActiveSubscriptions(env.DB)
    if (!result.results.length) {
      console.log('[Cron] 無訂閱，跳過')
      return
    }

    console.log(`[Cron] 查詢到 ${result.results.length} 筆 active 訂閱`)

    const subscriptions = result.results.map((sub: any) => ({
      chat_id: String(sub.telegram_id),
      urls: build591Url(sub),
    }))

    console.log(`[Cron] 觸發 GHA，共 ${subscriptions.length} 個訂閱`)

    const resp = await fetch(
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

    if (!resp.ok) {
      const body = await resp.text()
      console.error(`[Cron] GHA 觸發失敗: ${resp.status} ${body}`)
      return
    }

    console.log(`[Cron] GHA 觸發成功: ${resp.status}`)

    for (const sub of result.results as any[]) {
      await updateLastRunAt(env.DB, sub.id)
    }
  },
}
