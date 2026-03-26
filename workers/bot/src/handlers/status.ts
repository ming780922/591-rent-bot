import { CommandContext } from 'grammy'
import { BotContext } from '../bot'
import { Env, getSubscription } from '../db/queries'

export function statusHandler(env: Env) {
  return async (ctx: CommandContext<BotContext>) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return

    const sub = await getSubscription(env.DB, telegramId) as any
    if (!sub) {
      return ctx.reply('你目前沒有訂閱。\n使用 /subscribe 建立訂閱。')
    }

    const locations = JSON.parse(sub.locations)
    const locText = sub.location_type === 'town'
      ? locations.areas.map((a: any) => `${a.city}${a.region}`).join('、')
      : locations.lines.map((l: any) => `${l.line}（${l.stations.join('、')}）`).join('、')

    const lines = [
      `狀態：${sub.status === 'active' ? '通知中' : '已暫停'}`,
      `位置：${locText}`,
      sub.room_type ? `類型：${sub.room_type}` : null,
      (sub.rent_min || sub.rent_max)
        ? `租金：${sub.rent_min ?? '不限'} ~ ${sub.rent_max ?? '不限'} 元` : null,
      sub.layout ? `格局：${sub.layout}` : null,
      (sub.size_min || sub.size_max)
        ? `坪數：${sub.size_min ?? '不限'} ~ ${sub.size_max ?? '不限'} 坪` : null,
      sub.shape ? `型態：${sub.shape}` : null,
    ].filter(Boolean).join('\n')

    await ctx.reply(`目前訂閱設定：\n\n${lines}`)
  }
}
