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
    const { getAllActiveSubscriptions, updateLastRunAt, getHiddenItems } = await import('./db/queries')
    const { build591Url } = await import('../../shared/build-url')
    const { dispatchCrawler } = await import('../../shared/gha')

    console.log('[Cron] 開始執行排程')

    const result = await getAllActiveSubscriptions(env.DB)
    if (!result.results.length) {
      console.log('[Cron] 無訂閱，跳過')
      return
    }

    console.log(`[Cron] 查詢到 ${result.results.length} 筆 active 訂閱`)

    const subscriptions = await Promise.all(result.results.map(async (sub: any) => {
      const urls = build591Url(sub)
      const hiddenRecords = await getHiddenItems(env.DB, sub.telegram_id)
      const hidden_items = hiddenRecords.results.map((r: any) => r.item_id)
      const hidden_titles = hiddenRecords.results.map((r: any) => r.title)
      console.log(`[Cron] chat_id=${sub.telegram_id} urls: ${JSON.stringify(urls)} hidden: ${hidden_items.length}`)
      return { chat_id: String(sub.telegram_id), urls, hidden_items, hidden_titles }
    }))

    console.log(`[Cron] 觸發 GHA，共 ${subscriptions.length} 個訂閱`)

    try {
      await dispatchCrawler(env, subscriptions, false)
      console.log(`[Cron] GHA 觸發成功`)
    } catch (e) {
      console.error(`[Cron] GHA 觸發錯誤:`, e)
      return
    }

    for (const sub of result.results as any[]) {
      await updateLastRunAt(env.DB, sub.id)
    }
  },
}
