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

    const result = await getAllActiveSubscriptions(env.DB)
    if (!result.results.length) return

    const subscriptions = result.results.map((sub: any) => ({
      chat_id: String(sub.telegram_id),
      urls: build591Url(sub),
    }))

    // 觸發 GitHub Actions
    await fetch(
      `https://api.github.com/repos/${env.GH_REPO}/actions/workflows/crawl.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GH_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: { subscriptions: JSON.stringify(subscriptions) },
        }),
      }
    )

    // 更新每個訂閱的 last_run_at
    for (const sub of result.results as any[]) {
      await updateLastRunAt(env.DB, sub.id)
    }
  },
}
