// 591 縣市 ID 對照表
const CITY_ID: Record<string, string> = {
  '台北市': '1', '新北市': '3', '桃園市': '6', '台中市': '8',
  '台南市': '20', '高雄市': '22', '基隆市': '2', '新竹市': '5',
  '新竹縣': '4', '苗栗縣': '7', '彰化縣': '9', '南投縣': '10',
  '雲林縣': '11', '嘉義市': '12', '嘉義縣': '13', '屏東縣': '23',
  '宜蘭縣': '24', '花蓮縣': '25', '台東縣': '26', '澎湖縣': '27',
}

// 591 行政區 section ID 對照表（key 格式：城市_區域）
const SECTION_ID: Record<string, string> = {
  // 台北市 (region=1)
  '台北市_中正區': '1', '台北市_大同區': '2', '台北市_中山區': '3',
  '台北市_松山區': '4', '台北市_大安區': '5', '台北市_萬華區': '6',
  '台北市_信義區': '7', '台北市_士林區': '8', '台北市_北投區': '9',
  '台北市_內湖區': '10', '台北市_南港區': '11', '台北市_文山區': '12',
  // 新北市 (region=3)
  '新北市_板橋區': '26', '新北市_永和區': '37', '新北市_中和區': '38',
  '新北市_三重區': '43', '新北市_新莊區': '44',
  // 台中市 (region=8)
  '台中市_中區': '98', '台中市_西區': '101', '台中市_北區': '102',
  '台中市_北屯區': '103', '台中市_西屯區': '104', '台中市_南屯區': '105',
  // 台南市 (region=15)
  '台南市_東區': '206', '台南市_南區': '207', '台南市_安平區': '210',
  '台南市_安南區': '211', '台南市_永康區': '212',
  // 高雄市 (region=17)
  '高雄市_苓雅區': '245', '高雄市_前鎮區': '249', '高雄市_三民區': '250',
  '高雄市_大社區': '255', '高雄市_鳳山區': '268',
}

// 591 類型 ID 對照表
const ROOM_TYPE_ID: Record<string, string> = {
  '整層住家': '1', '獨立套房': '2', '分租套房': '3',
  '雅房': '4', '車位': '8', '其他': '24',
}

// 591 格局對照
const LAYOUT_ID: Record<string, string> = {
  '1房': '1', '2房': '2', '3房': '3', '4房以上': '4',
}

// 591 型態對照
const SHAPE_ID: Record<string, string> = {
  '公寓': '1', '電梯大樓': '2', '透天厝': '3', '別墅': '4',
}

export function build591Url(sub: Record<string, any>): string[] {
  const locations = JSON.parse(sub.locations as string)
  const urls: string[] = []

  const baseParams = buildBaseParams(sub)

  for (const area of locations.areas ?? []) {
    const sectionKey = `${area.city}_${area.region}`
    const sectionId = SECTION_ID[sectionKey]
    const params = new URLSearchParams({
      ...baseParams,
      region: CITY_ID[area.city] ?? '',
      ...(sectionId ? { section: sectionId } : {}),
    })
    urls.push(`https://rent.591.com.tw/list?${params}`)
  }

  for (const line of locations.lines ?? []) {
    for (const station of line.stations ?? []) {
      const params = new URLSearchParams({
        ...baseParams,
        mrtSerialNo: line.line,
        mrt: station,
      })
      urls.push(`https://rent.591.com.tw/list?${params}`)
    }
  }

  return urls
}

function buildBaseParams(sub: Record<string, any>): Record<string, string> {
  const params: Record<string, string> = {}

  // 類型
  if (sub.room_type) {
    const ids = sub.room_type.split(',')
      .map((t: string) => ROOM_TYPE_ID[t.trim()])
      .filter(Boolean)
    if (ids.length) params['kind'] = ids.join(',')
  }

  // 租金
  if (sub.rent_min) params['price_min'] = String(sub.rent_min)
  if (sub.rent_max) params['price_max'] = String(sub.rent_max)

  // 格局
  if (sub.layout) {
    const ids = sub.layout.split(',')
      .map((l: string) => LAYOUT_ID[l.trim()])
      .filter(Boolean)
    if (ids.length) params['layout'] = ids.join(',')
  }

  // 坪數
  if (sub.size_min) params['area_min'] = String(sub.size_min)
  if (sub.size_max) params['area_max'] = String(sub.size_max)

  // 型態
  if (sub.shape) {
    const ids = sub.shape.split(',')
      .map((s: string) => SHAPE_ID[s.trim()])
      .filter(Boolean)
    if (ids.length) params['shape'] = ids.join(',')
  }

  // 特色
  const features: string[] = []
  if (sub.feat_near_mrt) features.push('near_mrt')
  if (sub.feat_pet) features.push('allow_pet')
  if (sub.feat_cook) features.push('can_cook')
  if (sub.feat_parking) features.push('parking')
  if (sub.feat_elevator) features.push('elevator')
  if (sub.feat_balcony) features.push('balcony')
  if (sub.feat_short_term) features.push('short_term')
  if (sub.feat_social_housing) features.push('social_house')
  if (sub.feat_subsidy) features.push('rent_subsidy')
  if (sub.feat_elderly) features.push('elderly_friendly')
  if (sub.feat_invoice) features.push('can_report_tax')
  if (sub.feat_register) features.push('can_register')
  if (features.length) params['option'] = features.join(',')

  // 排除頂樓加蓋
  if (sub.exclude_top_floor) params['not_cover'] = '1'

  // 新上架
  if (sub.feat_new) params['newly'] = '1'

  return params
}
