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
