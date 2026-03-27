import { CommandContext } from 'grammy'
import { BotContext } from '../bot'
import { Env, updateSubscriptionStatus } from '../db/queries'

export function pauseHandler(env: Env) {
  return async (ctx: CommandContext<BotContext>) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return
    await updateSubscriptionStatus(env.DB, telegramId, 'paused')
    console.log(`[Bot] subscription.paused user=${telegramId}`)
    await ctx.reply('已暫停通知。使用 /resume 恢復。')
  }
}

export function resumeHandler(env: Env) {
  return async (ctx: CommandContext<BotContext>) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return
    await updateSubscriptionStatus(env.DB, telegramId, 'active')
    console.log(`[Bot] subscription.resumed user=${telegramId}`)
    await ctx.reply('已恢復通知，下次排程時將開始推播。')
  }
}
