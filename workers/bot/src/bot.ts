import { Bot, Context, session, SessionFlavor, InlineKeyboard } from 'grammy'
import { Env } from './db/queries'
import { subscribeHandler, subscribeCallbackHandler } from './handlers/subscribe'
import { statusHandler } from './handlers/status'
import { pauseHandler, resumeHandler } from './handlers/pause'

export interface SessionData {
  state: string
  data: Record<string, unknown>
}

export type BotContext = Context & SessionFlavor<SessionData>

export function createBot(env: Env): Bot<BotContext> {
  const bot = new Bot<BotContext>(env.BOT_TOKEN)

  bot.use(
    session({
      initial: (): SessionData => ({ state: 'IDLE', data: {} }),
    })
  )

  // 指令
  bot.command('start', async (ctx) => {
    console.log(`[Bot] /start user=${ctx.from?.id} username=${ctx.from?.username ?? '-'}`)
    const replyOpts: any = {}
    if (env.MINIAPP_URL) {
      replyOpts.reply_markup = new InlineKeyboard()
        .webApp('📱 開啟訂閱管理介面', env.MINIAPP_URL)
    }
    await ctx.reply(
      '歡迎使用 591 租屋通知 Bot！\n\n' +
      '可用指令：\n' +
      '/subscribe — 建立訂閱\n' +
      '/status — 查看目前訂閱\n' +
      '/pause — 暫停通知\n' +
      '/resume — 恢復通知\n' +
      '/app — 開啟 Mini App 介面',
      replyOpts
    )
  })

  bot.command('app', async (ctx) => {
    console.log(`[Bot] /app user=${ctx.from?.id} username=${ctx.from?.username ?? '-'}`)
    if (!env.MINIAPP_URL) {
      await ctx.reply('Mini App 尚未設定，請使用指令管理訂閱。')
      return
    }
    await ctx.reply('點擊下方按鈕開啟訂閱管理介面：', {
      reply_markup: new InlineKeyboard()
        .webApp('📱 開啟訂閱管理介面', env.MINIAPP_URL),
    })
  })

  bot.command('subscribe', async (ctx) => {
    console.log(`[Bot] /subscribe user=${ctx.from?.id} username=${ctx.from?.username ?? '-'}`)
    return subscribeHandler(env)(ctx)
  })
  bot.command('status', async (ctx) => {
    console.log(`[Bot] /status user=${ctx.from?.id} username=${ctx.from?.username ?? '-'}`)
    return statusHandler(env)(ctx)
  })
  bot.command('pause', async (ctx) => {
    console.log(`[Bot] /pause user=${ctx.from?.id} username=${ctx.from?.username ?? '-'}`)
    return pauseHandler(env)(ctx)
  })
  bot.command('resume', async (ctx) => {
    console.log(`[Bot] /resume user=${ctx.from?.id} username=${ctx.from?.username ?? '-'}`)
    return resumeHandler(env)(ctx)
  })

  // Callback query（單獨處理 fetch_all 按鈕）
  bot.callbackQuery('fetch_all', async (ctx) => {
    const { getSubscription } = await import('./db/queries')
    const { build591Url } = await import('../../shared/build-url')
    const { dispatchCrawler } = await import('../../shared/gha')

    try {
      if (!ctx.from) throw new Error('No user data')
      const row = await getSubscription(env.DB, ctx.from.id)
      if (!row) {
        await ctx.answerCallbackQuery({ text: '查無您的訂閱資料！', show_alert: true })
        return
      }

      const subscriptions = [{
        chat_id: String(ctx.from.id),
        urls: build591Url(row as any),
      }]

      await dispatchCrawler(env, subscriptions, true) // forceSendAll = true
      
      await ctx.editMessageText('✅ 正在為您讀取所有詳細資料並截圖，因為張數較多，這可能會花費幾分鐘的時間，請稍候...')
      await ctx.answerCallbackQuery()
    } catch (e: any) {
      console.error('[Bot] fetch_all callback error:', e)
      await ctx.answerCallbackQuery({ text: '發送失敗，請稍後再試。', show_alert: true })
    }
  })

  // Callback query（單獨處理隱藏物件按鈕）
  bot.callbackQuery(/hide:(.+)/, async (ctx) => {
    const { addHiddenItem } = await import('./db/queries')
    
    try {
      if (!ctx.from) throw new Error('No user data')
      const itemId = ctx.match[1]
      
      // 解析原本訊息中的標題與連結
      const caption = ctx.callbackQuery.message?.caption || ctx.callbackQuery.message?.text || ''
      let title = caption.split('\n')[0].replace('🏠 ', '').trim()
      if (!title) title = `無標題物件 (${itemId})`
      
      const urlMatch = caption.match(/https:\/\/rent\.591\.com\.tw\S+/)
      const link = urlMatch ? urlMatch[0] : `https://rent.591.com.tw/home/${itemId}`
      
      await addHiddenItem(env.DB, ctx.from.id, itemId, title, link)
      await ctx.deleteMessage()
      await ctx.answerCallbackQuery({ text: '✅ 已加入隱藏清單，未來的推播將會自動過濾。' })
    } catch (e: any) {
      console.error('[Bot] hide callback error:', e)
      await ctx.answerCallbackQuery({ text: '隱藏失敗，請稍後再試。', show_alert: true })
    }
  })

  // Callback query（Inline Keyboard 點擊）
  bot.on('callback_query:data', subscribeCallbackHandler(env))

  // 文字輸入（處理 Conversation 中的自訂輸入）
  bot.on('message:text', async (ctx) => {
    const { state } = ctx.session
    if (state === 'AWAIT_RENT_INPUT') {
      const { handleRentInput } = await import('./handlers/subscribe')
      return handleRentInput(ctx, env)
    }
    if (state === 'AWAIT_SIZE_INPUT') {
      const { handleSizeInput } = await import('./handlers/subscribe')
      return handleSizeInput(ctx, env)
    }
  })

  bot.catch((err) => {
    console.error('Bot error:', err)
  })

  return bot
}
