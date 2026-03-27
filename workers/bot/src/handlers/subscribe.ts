import { CommandContext, InlineKeyboard } from 'grammy'
import { BotContext } from '../bot'
import { Env, upsertUser, getSubscription, createSubscription, setSession, getSession, deleteSession } from '../db/queries'

// ── 狀態常數 ────────────────────────────────────────
const S = {
  IDLE: 'IDLE',
  LOCATION_TYPE: 'LOCATION_TYPE',
  SELECT_CITY: 'SELECT_CITY',
  SELECT_DISTRICT: 'SELECT_DISTRICT',
  SELECT_MRT_LINE: 'SELECT_MRT_LINE',
  SELECT_MRT_STATION: 'SELECT_MRT_STATION',
  SELECT_ROOM_TYPE: 'SELECT_ROOM_TYPE',
  SET_RENT: 'SET_RENT',
  AWAIT_RENT_INPUT: 'AWAIT_RENT_INPUT',
  SELECT_LAYOUT: 'SELECT_LAYOUT',
  SET_SIZE: 'SET_SIZE',
  AWAIT_SIZE_INPUT: 'AWAIT_SIZE_INPUT',
  SELECT_SHAPE: 'SELECT_SHAPE',
  SELECT_FEATURES: 'SELECT_FEATURES',
  CONFIRM: 'CONFIRM',
} as const

// ── 資料常數 ────────────────────────────────────────
const CITIES = ['台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市', '基隆市', '新竹市', '新竹縣', '苗栗縣', '彰化縣', '南投縣', '雲林縣', '嘉義市', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣', '台東縣']

const DISTRICTS: Record<string, string[]> = {
  '台北市': ['中正區', '大同區', '中山區', '松山區', '大安區', '萬華區', '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區'],
  '新北市': ['板橋區', '三重區', '中和區', '永和區', '新莊區', '新店區', '樹林區', '鶯歌區', '三峽區', '淡水區', '汐止區', '瑞芳區', '土城區', '蘆洲區', '五股區', '泰山區', '林口區'],
  '桃園市': ['桃園區', '中壢區', '大溪區', '楊梅區', '蘆竹區', '大園區', '龜山區', '八德區', '龍潭區', '平鎮區', '新屋區', '觀音區', '復興區'],
  '台中市': ['中區', '東區', '南區', '西區', '北區', '西屯區', '南屯區', '北屯區', '豐原區', '大里區', '太平區', '清水區', '沙鹿區', '梧棲區', '烏日區'],
  '台南市': ['中西區', '東區', '南區', '北區', '安平區', '安南區', '永康區', '歸仁區', '新化區', '左鎮區', '玉井區', '楠西區'],
  '高雄市': ['新興區', '前金區', '苓雅區', '鹽埕區', '鼓山區', '旗津區', '前鎮區', '三民區', '楠梓區', '小港區', '左營區', '仁武區', '大社區', '鳳山區', '林園區'],
}

const MRT_LINES: Record<string, string[]> = {
  '板南線': ['南港展覽館', '南港', '昆陽', '後山埤', '永春', '市政府', '國父紀念館', '忠孝敦化', '忠孝復興', '忠孝新生', '善導寺', '台北車站', '西門', '龍山寺', '江子翠', '新埔', '板橋', '府中', '亞東醫院', '海山', '土城', '永寧', '頂埔'],
  '淡水信義線': ['淡水', '紅樹林', '竹圍', '關渡', '忠義', '復興崗', '北投', '新北投', '奇岩', '唭哩岸', '石牌', '明德', '芝山', '士林', '劍潭', '圓山', '民權西路', '雙連', '中山', '台北車站', '台大醫院', '中正紀念堂', '東門', '大安森林公園', '大安', '信義安和', '台北101/世貿', '象山'],
  '中和新蘆線': ['迴龍', '丹鳳', '輔大', '新莊', '頭前庄', '先嗇宮', '三重國小', '三重', '菜寮', '台北橋', '三民高中', '大橋頭', '民權西路', '中山國小', '行天宮', '松江南京', '忠孝新生', '古亭', '景安', '南勢角', '永安市場', '頂溪', '中和', '秀朗橋', '景平', '景安'],
  '文湖線': ['動物園', '木柵', '萬芳社區', '萬芳醫院', '辛亥', '麟光', '六張犁', '科技大樓', '大安', '忠孝復興', '南京復興', '中山國中', '松山機場', '大直', '劍南路', '西湖', '港墘', '文德', '內湖', '大湖公園', '葫洲', '東湖', '南港軟體園區', '南港展覽館'],
}

const ROOM_TYPES = ['整層住家', '獨立套房', '分租套房', '雅房', '車位', '其他']
const LAYOUTS = ['1房', '2房', '3房', '4房以上']
const SHAPES = ['公寓', '電梯大樓', '透天厝', '別墅']
const FEATURES = [
  { key: 'feat_new', label: '新上架' },
  { key: 'feat_near_mrt', label: '近捷運' },
  { key: 'feat_pet', label: '可養寵物' },
  { key: 'feat_cook', label: '可開伙' },
  { key: 'feat_parking', label: '有車位' },
  { key: 'feat_elevator', label: '有電梯' },
  { key: 'feat_balcony', label: '有陽台' },
  { key: 'feat_short_term', label: '可短期租賃' },
  { key: 'feat_social_housing', label: '社會住宅' },
  { key: 'feat_subsidy', label: '租金補貼' },
  { key: 'feat_elderly', label: '高齡友善' },
  { key: 'feat_invoice', label: '可報稅' },
  { key: 'feat_register', label: '可入籍' },
]
const RENT_RANGES = [
  { label: '5,000 以下', min: 0, max: 5000 },
  { label: '5,000-10,000', min: 5000, max: 10000 },
  { label: '10,000-20,000', min: 10000, max: 20000 },
  { label: '20,000-30,000', min: 20000, max: 30000 },
  { label: '30,000-40,000', min: 30000, max: 40000 },
  { label: '40,000 以上', min: 40000, max: 0 },
]
const SIZE_RANGES = [
  { label: '10 坪以下', min: 0, max: 10 },
  { label: '10-20 坪', min: 10, max: 20 },
  { label: '20-30 坪', min: 20, max: 30 },
  { label: '30-40 坪', min: 30, max: 40 },
  { label: '40-50 坪', min: 40, max: 50 },
  { label: '50 坪以上', min: 50, max: 0 },
]

// ── 工具函式 ────────────────────────────────────────
function makeMultiSelectKb(
  options: string[],
  selected: string[],
  prefix: string,
  cols = 2
): InlineKeyboard {
  const kb = new InlineKeyboard()
  options.forEach((opt, i) => {
    const checked = selected.includes(opt) ? '✅ ' : ''
    kb.text(`${checked}${opt}`, `${prefix}:${opt}`)
    if ((i + 1) % cols === 0) kb.row()
  })
  kb.row().text('完成', `${prefix}:DONE`).text('跳過', `${prefix}:SKIP`)
  return kb
}

function makeFeaturesKb(selected: Record<string, number>): InlineKeyboard {
  const kb = new InlineKeyboard()
  FEATURES.forEach((f, i) => {
    const checked = selected[f.key] ? '✅ ' : ''
    kb.text(`${checked}${f.label}`, `feat:${f.key}`)
    if ((i + 1) % 2 === 0) kb.row()
  })
  kb.row()
    .text('排除頂樓加蓋', `feat:exclude_top_floor`)
    .row()
    .text('完成', 'feat:DONE')
    .text('跳過', 'feat:SKIP')
  return kb
}

function buildConfirmText(data: Record<string, any>): string {
  const loc = data.locations
  let locText = ''
  if (data.location_type === 'town') {
    locText = loc.areas.map((a: any) => `${a.city}${a.region}`).join('、')
  } else {
    locText = loc.lines.map((l: any) => `${l.line}（${l.stations.join('、')}）`).join('、')
  }

  const featLabels = FEATURES
    .filter(f => data[f.key])
    .map(f => f.label)
  if (data.exclude_top_floor) featLabels.push('排除頂樓加蓋')

  return [
    '請確認以下訂閱設定：\n',
    `📍 位置：${locText}`,
    data.room_type ? `🏠 類型：${data.room_type}` : null,
    (data.rent_min || data.rent_max)
      ? `💰 租金：${data.rent_min || '不限'} ~ ${data.rent_max || '不限'} 元` : null,
    data.layout ? `🛏 格局：${data.layout}` : null,
    (data.size_min || data.size_max)
      ? `📐 坪數：${data.size_min || '不限'} ~ ${data.size_max || '不限'} 坪` : null,
    data.shape ? `🏢 型態：${data.shape}` : null,
    featLabels.length ? `✨ 特色：${featLabels.join('、')}` : null,
  ].filter(Boolean).join('\n')
}

// ── /subscribe 指令入口 ─────────────────────────────
export function subscribeHandler(env: Env) {
  return async (ctx: CommandContext<BotContext>) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return

    await upsertUser(env.DB, telegramId, ctx.from.username)

    const existing = await getSubscription(env.DB, telegramId)
    if (existing) {
      await ctx.reply('你已有訂閱，是否要覆蓋？', {
        reply_markup: new InlineKeyboard()
          .text('覆蓋設定', 'subscribe:OVERWRITE')
          .text('取消', 'subscribe:CANCEL'),
      })
      return
    }

    await setSession(env.DB, telegramId, S.LOCATION_TYPE, {})
    await askLocationType(ctx)
  }
}

// ── Callback handler（所有 Inline Keyboard 點擊）────
export function subscribeCallbackHandler(env: Env) {
  return async (ctx: any) => {
    const telegramId = ctx.from?.id
    if (!telegramId) return
    await ctx.answerCallbackQuery()

    const data = ctx.callbackQuery.data as string

    // ── 覆蓋確認（不需要 session）──
    if (data === 'subscribe:OVERWRITE') {
      await setSession(env.DB, telegramId, S.LOCATION_TYPE, {})
      await ctx.editMessageText('重新設定訂閱條件：')
      await askLocationType(ctx)
      return
    }
    if (data === 'subscribe:CANCEL') {
      await ctx.editMessageText('已取消。')
      return
    }

    const session = await getSession(env.DB, telegramId)
    if (!session) return

    const state = session.state
    const sessionData: Record<string, any> = JSON.parse(session.data)

    // ── 步驟 1：位置模式 ──
    if (state === S.LOCATION_TYPE) {
      if (data === 'loc_type:town') {
        sessionData.location_type = 'town'
        sessionData.locations = { areas: [] }
        await setSession(env.DB, telegramId, S.SELECT_CITY, sessionData)
        await ctx.editMessageText('選擇縣市：', { reply_markup: makeCityKb() })
      } else if (data === 'loc_type:mrt') {
        sessionData.location_type = 'mrt'
        sessionData.locations = { lines: [] }
        await setSession(env.DB, telegramId, S.SELECT_MRT_LINE, sessionData)
        await ctx.editMessageText('選擇捷運路線：', { reply_markup: makeMrtLineKb() })
      }
      return
    }

    // ── 步驟 2a：選縣市 ──
    if (state === S.SELECT_CITY) {
      const city = data.replace('city:', '')
      sessionData._currentCity = city
      await setSession(env.DB, telegramId, S.SELECT_DISTRICT, sessionData)
      const currentDistricts = sessionData.locations.areas
        .filter((a: any) => a.city === city)
        .map((a: any) => a.region)
      const kb = makeDistrictKb(city, currentDistricts)
      await ctx.editMessageText(`選擇 ${city} 的區域（可多選）：`, { reply_markup: kb })
      return
    }

    // ── 步驟 3a：選區域 ──
    if (state === S.SELECT_DISTRICT) {
      const city = sessionData._currentCity

      if (data === 'district:DONE' || data === 'district:SKIP') {
        await setSession(env.DB, telegramId, S.SELECT_ROOM_TYPE, sessionData)
        await ctx.editMessageText('選擇租屋類型（可多選）：', {
          reply_markup: makeMultiSelectKb(ROOM_TYPES, sessionData.room_type?.split(',') ?? [], 'room'),
        })
        return
      }

      if (data === 'district:ADD_CITY') {
        await setSession(env.DB, telegramId, S.SELECT_CITY, sessionData)
        await ctx.editMessageText('繼續選擇其他縣市：', { reply_markup: makeCityKb() })
        return
      }

      const region = data.replace('district:', '')
      const areas: any[] = sessionData.locations.areas
      const idx = areas.findIndex((a: any) => a.city === city && a.region === region)
      if (idx >= 0) {
        areas.splice(idx, 1)
      } else {
        areas.push({ city, region })
      }
      sessionData.locations.areas = areas

      await setSession(env.DB, telegramId, S.SELECT_DISTRICT, sessionData)
      const selected = areas.filter((a: any) => a.city === city).map((a: any) => a.region)
      await ctx.editMessageText(`選擇 ${city} 的區域（可多選）：`, {
        reply_markup: makeDistrictKb(city, selected),
      })
      return
    }

    // ── 步驟 2b：選捷運路線 ──
    if (state === S.SELECT_MRT_LINE) {
      const line = data.replace('mrt_line:', '')
      sessionData._currentLine = line
      const currentStations = (sessionData.locations.lines.find((l: any) => l.line === line)?.stations) ?? []
      await setSession(env.DB, telegramId, S.SELECT_MRT_STATION, sessionData)
      await ctx.editMessageText(`選擇 ${line} 的站點（可多選）：`, {
        reply_markup: makeMrtStationKb(line, currentStations),
      })
      return
    }

    // ── 步驟 3b：選捷運站 ──
    if (state === S.SELECT_MRT_STATION) {
      const line = sessionData._currentLine

      if (data === 'mrt_station:DONE' || data === 'mrt_station:SKIP') {
        await setSession(env.DB, telegramId, S.SELECT_ROOM_TYPE, sessionData)
        await ctx.editMessageText('選擇租屋類型（可多選）：', {
          reply_markup: makeMultiSelectKb(ROOM_TYPES, sessionData.room_type?.split(',') ?? [], 'room'),
        })
        return
      }

      if (data === 'mrt_station:ADD_LINE') {
        await setSession(env.DB, telegramId, S.SELECT_MRT_LINE, sessionData)
        await ctx.editMessageText('繼續選擇其他路線：', { reply_markup: makeMrtLineKb() })
        return
      }

      const station = data.replace('mrt_station:', '')
      const lines: any[] = sessionData.locations.lines
      let lineEntry = lines.find((l: any) => l.line === line)
      if (!lineEntry) {
        lineEntry = { line, stations: [] }
        lines.push(lineEntry)
      }
      const si = lineEntry.stations.indexOf(station)
      if (si >= 0) lineEntry.stations.splice(si, 1)
      else lineEntry.stations.push(station)

      sessionData.locations.lines = lines
      await setSession(env.DB, telegramId, S.SELECT_MRT_STATION, sessionData)
      await ctx.editMessageText(`選擇 ${line} 的站點（可多選）：`, {
        reply_markup: makeMrtStationKb(line, lineEntry.stations),
      })
      return
    }

    // ── 步驟 4：類型 ──
    if (state === S.SELECT_ROOM_TYPE) {
      if (data === 'room:SKIP') {
        sessionData.room_type = null
      } else if (data === 'room:DONE') {
        // 保留現有選擇
      } else {
        const type = data.replace('room:', '')
        const selected: string[] = sessionData.room_type ? sessionData.room_type.split(',') : []
        const idx = selected.indexOf(type)
        if (idx >= 0) selected.splice(idx, 1)
        else selected.push(type)
        sessionData.room_type = selected.length ? selected.join(',') : null
        await setSession(env.DB, telegramId, S.SELECT_ROOM_TYPE, sessionData)
        await ctx.editMessageText('選擇租屋類型（可多選）：', {
          reply_markup: makeMultiSelectKb(ROOM_TYPES, selected, 'room'),
        })
        return
      }
      await setSession(env.DB, telegramId, S.SET_RENT, sessionData)
      await ctx.editMessageText('設定租金範圍：', { reply_markup: makeRentKb() })
      return
    }

    // ── 步驟 5：租金 ──
    if (state === S.SET_RENT) {
      if (data === 'rent:SKIP') {
        sessionData.rent_min = null
        sessionData.rent_max = null
        await nextAfterRent(ctx, env.DB, telegramId, sessionData)
        return
      }
      if (data === 'rent:CUSTOM') {
        await setSession(env.DB, telegramId, S.AWAIT_RENT_INPUT, sessionData)
        await ctx.editMessageText('請輸入租金範圍，格式：最低-最高\n例如：20000-35000\n（只有上限請輸入：0-35000）')
        return
      }
      const [minStr, maxStr] = data.replace('rent:', '').split('-')
      sessionData.rent_min = parseInt(minStr) || null
      sessionData.rent_max = parseInt(maxStr) || null
      await nextAfterRent(ctx, env.DB, telegramId, sessionData)
      return
    }

    // ── 步驟 6：格局 ──
    if (state === S.SELECT_LAYOUT) {
      if (data === 'layout:SKIP') {
        sessionData.layout = null
      } else if (data === 'layout:DONE') {
        // 保留現有選擇
      } else {
        const layout = data.replace('layout:', '')
        const selected: string[] = sessionData.layout ? sessionData.layout.split(',') : []
        const idx = selected.indexOf(layout)
        if (idx >= 0) selected.splice(idx, 1)
        else selected.push(layout)
        sessionData.layout = selected.length ? selected.join(',') : null
        await setSession(env.DB, telegramId, S.SELECT_LAYOUT, sessionData)
        await ctx.editMessageText('選擇格局（可多選）：', {
          reply_markup: makeMultiSelectKb(LAYOUTS, selected, 'layout', 4),
        })
        return
      }
      await setSession(env.DB, telegramId, S.SET_SIZE, sessionData)
      await ctx.editMessageText('設定坪數範圍：', { reply_markup: makeSizeKb() })
      return
    }

    // ── 步驟 7：坪數 ──
    if (state === S.SET_SIZE) {
      if (data === 'size:SKIP') {
        sessionData.size_min = null
        sessionData.size_max = null
        await nextAfterSize(ctx, env.DB, telegramId, sessionData)
        return
      }
      if (data === 'size:CUSTOM') {
        await setSession(env.DB, telegramId, S.AWAIT_SIZE_INPUT, sessionData)
        await ctx.editMessageText('請輸入坪數範圍，格式：最小-最大\n例如：15-30\n（只有下限請輸入：15-0）')
        return
      }
      const [minStr, maxStr] = data.replace('size:', '').split('-')
      sessionData.size_min = parseInt(minStr) || null
      sessionData.size_max = parseInt(maxStr) || null
      await nextAfterSize(ctx, env.DB, telegramId, sessionData)
      return
    }

    // ── 步驟 8：型態 ──
    if (state === S.SELECT_SHAPE) {
      if (data === 'shape:SKIP') {
        sessionData.shape = null
      } else if (data === 'shape:DONE') {
        // 保留現有選擇
      } else {
        const shape = data.replace('shape:', '')
        const selected: string[] = sessionData.shape ? sessionData.shape.split(',') : []
        const idx = selected.indexOf(shape)
        if (idx >= 0) selected.splice(idx, 1)
        else selected.push(shape)
        sessionData.shape = selected.length ? selected.join(',') : null
        await setSession(env.DB, telegramId, S.SELECT_SHAPE, sessionData)
        await ctx.editMessageText('選擇型態（可多選）：', {
          reply_markup: makeMultiSelectKb(SHAPES, selected, 'shape', 2),
        })
        return
      }
      await setSession(env.DB, telegramId, S.SELECT_FEATURES, sessionData)
      await ctx.editMessageText('選擇特色（可多選）：', {
        reply_markup: makeFeaturesKb(sessionData),
      })
      return
    }

    // ── 步驟 9：特色 ──
    if (state === S.SELECT_FEATURES) {
      if (data === 'feat:SKIP') {
        // 全不選，保持 default 0
      } else if (data === 'feat:DONE') {
        // 保留現有選擇
      } else {
        const key = data.replace('feat:', '')
        sessionData[key] = sessionData[key] ? 0 : 1
        await setSession(env.DB, telegramId, S.SELECT_FEATURES, sessionData)
        await ctx.editMessageText('選擇特色（可多選）：', {
          reply_markup: makeFeaturesKb(sessionData),
        })
        return
      }
      await setSession(env.DB, telegramId, S.CONFIRM, sessionData)
      await ctx.editMessageText(buildConfirmText(sessionData), {
        reply_markup: new InlineKeyboard()
          .text('確認訂閱', 'confirm:YES')
          .text('重新設定', 'confirm:RESET'),
      })
      return
    }

    // ── 步驟 10：確認 ──
    if (state === S.CONFIRM) {
      if (data === 'confirm:YES') {
        await createSubscription(env.DB, telegramId, sessionData)
        await deleteSession(env.DB, telegramId)
        console.log(`[Bot] subscription.created user=${telegramId} location_type=${sessionData.location_type} locations=${JSON.stringify(sessionData.locations)}`)
        await ctx.editMessageText(
          '✅ 訂閱成功！\n\n系統將每小時自動搜尋符合條件的新房源並通知你。\n\n使用 /status 查看訂閱設定\n使用 /pause 暫停通知'
        )
      } else if (data === 'confirm:RESET') {
        await setSession(env.DB, telegramId, S.LOCATION_TYPE, {})
        await ctx.editMessageText('重新設定：')
        await askLocationType(ctx)
      }
      return
    }
  }
}

// ── 文字輸入 handlers ───────────────────────────────
export async function handleRentInput(ctx: any, env: Env) {
  const telegramId = ctx.from?.id
  if (!telegramId) return
  const session = await getSession(env.DB, telegramId)
  if (!session || session.state !== S.AWAIT_RENT_INPUT) return

  const text = ctx.message.text.trim()
  const match = text.match(/^(\d+)-(\d+)$/)
  if (!match) {
    await ctx.reply('格式錯誤，請輸入：最低-最高，例如：20000-35000')
    return
  }

  const sessionData = JSON.parse(session.data)
  sessionData.rent_min = parseInt(match[1]) || null
  sessionData.rent_max = parseInt(match[2]) || null
  await nextAfterRent(ctx, env.DB, telegramId, sessionData)
}

export async function handleSizeInput(ctx: any, env: Env) {
  const telegramId = ctx.from?.id
  if (!telegramId) return
  const session = await getSession(env.DB, telegramId)
  if (!session || session.state !== S.AWAIT_SIZE_INPUT) return

  const text = ctx.message.text.trim()
  const match = text.match(/^(\d+)-(\d+)$/)
  if (!match) {
    await ctx.reply('格式錯誤，請輸入：最小-最大，例如：15-30')
    return
  }

  const sessionData = JSON.parse(session.data)
  sessionData.size_min = parseInt(match[1]) || null
  sessionData.size_max = parseInt(match[2]) || null
  await nextAfterSize(ctx, env.DB, telegramId, sessionData)
}

// ── 流程推進輔助 ────────────────────────────────────
async function nextAfterRent(ctx: any, db: D1Database, telegramId: number, sessionData: any) {
  await setSession(db, telegramId, S.SELECT_LAYOUT, sessionData)
  await ctx.reply('選擇格局（可多選）：', {
    reply_markup: makeMultiSelectKb(LAYOUTS, sessionData.layout?.split(',') ?? [], 'layout', 4),
  })
}

async function nextAfterSize(ctx: any, db: D1Database, telegramId: number, sessionData: any) {
  await setSession(db, telegramId, S.SELECT_SHAPE, sessionData)
  await ctx.reply('選擇型態（可多選）：', {
    reply_markup: makeMultiSelectKb(SHAPES, sessionData.shape?.split(',') ?? [], 'shape', 2),
  })
}

// ── Keyboard 產生函式 ───────────────────────────────
async function askLocationType(ctx: any) {
  await ctx.reply('請選擇位置搜尋方式：', {
    reply_markup: new InlineKeyboard()
      .text('按鄉鎮區域', 'loc_type:town')
      .text('按捷運站', 'loc_type:mrt'),
  })
}

function makeCityKb(): InlineKeyboard {
  const kb = new InlineKeyboard()
  CITIES.forEach((city, i) => {
    kb.text(city, `city:${city}`)
    if ((i + 1) % 3 === 0) kb.row()
  })
  return kb
}

function makeDistrictKb(city: string, selected: string[]): InlineKeyboard {
  const districts = DISTRICTS[city] ?? []
  const kb = new InlineKeyboard()
  districts.forEach((d, i) => {
    const checked = selected.includes(d) ? '✅ ' : ''
    kb.text(`${checked}${d}`, `district:${d}`)
    if ((i + 1) % 3 === 0) kb.row()
  })
  kb.row()
    .text('完成', 'district:DONE')
    .text('加其他縣市', 'district:ADD_CITY')
  return kb
}

function makeMrtLineKb(): InlineKeyboard {
  const kb = new InlineKeyboard()
  Object.keys(MRT_LINES).forEach((line) => {
    kb.text(line, `mrt_line:${line}`).row()
  })
  return kb
}

function makeMrtStationKb(line: string, selected: string[]): InlineKeyboard {
  const stations = MRT_LINES[line] ?? []
  const kb = new InlineKeyboard()
  stations.forEach((s, i) => {
    const checked = selected.includes(s) ? '✅ ' : ''
    kb.text(`${checked}${s}`, `mrt_station:${s}`)
    if ((i + 1) % 3 === 0) kb.row()
  })
  kb.row()
    .text('完成', 'mrt_station:DONE')
    .text('加其他路線', 'mrt_station:ADD_LINE')
  return kb
}

function makeRentKb(): InlineKeyboard {
  const kb = new InlineKeyboard()
  RENT_RANGES.forEach((r, i) => {
    kb.text(r.label, `rent:${r.min}-${r.max}`)
    if ((i + 1) % 2 === 0) kb.row()
  })
  kb.row().text('自訂範圍', 'rent:CUSTOM').text('跳過', 'rent:SKIP')
  return kb
}

function makeSizeKb(): InlineKeyboard {
  const kb = new InlineKeyboard()
  SIZE_RANGES.forEach((r, i) => {
    kb.text(r.label, `size:${r.min}-${r.max}`)
    if ((i + 1) % 2 === 0) kb.row()
  })
  kb.row().text('自訂範圍', 'size:CUSTOM').text('跳過', 'size:SKIP')
  return kb
}
