import { Bot, Context, session, SessionFlavor } from 'grammy'
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
    await ctx.reply(
      '歡迎使用 591 租屋通知 Bot！\n\n' +
      '可用指令：\n' +
      '/subscribe — 建立訂閱\n' +
      '/status — 查看目前訂閱\n' +
      '/pause — 暫停通知\n' +
      '/resume — 恢復通知'
    )
  })

  bot.command('subscribe', subscribeHandler(env))
  bot.command('status', statusHandler(env))
  bot.command('pause', pauseHandler(env))
  bot.command('resume', resumeHandler(env))

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
