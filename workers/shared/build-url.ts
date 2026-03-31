// 591 縣市 ID 對照表
const CITY_ID: Record<string, string> = {
  '台北市': '1', '新北市': '3', '桃園市': '6', '台中市': '8',
  '台南市': '20', '高雄市': '22', '基隆市': '2', '新竹市': '5',
  '新竹縣': '4', '苗栗縣': '7', '彰化縣': '9', '南投縣': '10',
  '雲林縣': '11', '嘉義市': '12', '嘉義縣': '13', '屏東縣': '23',
  '宜蘭縣': '24', '花蓮縣': '25', '台東縣': '26', '澎湖縣': '27',
}

// 591 區域 ID 對照表 (city → district → numeric section ID)
const SECTION_ID: Record<string, Record<string, string>> = {
  '台北市': {
    '中正區': '1', '大同區': '2', '中山區': '3', '松山區': '4',
    '大安區': '5', '萬華區': '6', '信義區': '7', '士林區': '8',
    '北投區': '9', '內湖區': '10', '南港區': '11', '文山區': '12',
  },
  '新北市': {
    '萬里區': '20', '金山區': '21', '板橋區': '26', '汐止區': '27',
    '深坑區': '28', '石碇區': '29', '瑞芳區': '30', '平溪區': '31',
    '雙溪區': '32', '貢寮區': '33', '新店區': '34', '坪林區': '35',
    '烏來區': '36', '永和區': '37', '中和區': '38', '土城區': '39',
    '三峽區': '40', '樹林區': '41', '鶯歌區': '42', '三重區': '43',
    '新莊區': '44', '泰山區': '45', '林口區': '46', '蘆洲區': '47',
    '五股區': '48', '八里區': '49', '淡水區': '50', '三芝區': '51',
    '石門區': '52',
  },
}

// 591 捷運線 ID 對照表
const MRT_LINE_ID: Record<string, string> = {
  '文湖線': '100', '淡水信義線': '125', '新北投支線': '195',
  '松山新店線': '148', '小碧潭支線': '192', '中和新蘆線': '162',
  '板南線': '168', '淡海輕軌': '316', '環狀線': '346',
}

// 591 捷運站 ID 對照表
const STATION_ID: Record<string, string> = {
  // 文湖線
  '南港展覽館': '4257', '南港軟體園區': '4314', '東湖': '4315', '葫洲': '4316',
  '大湖公園': '4317', '內湖': '4318', '文德': '4319', '港墘': '4320',
  '西湖': '4321', '劍南路': '4282', '大直': '4323', '松山機場': '4324',
  '中山國中': '4185', '南京復興': '4186', '忠孝復興': '4187', '大安': '4188',
  '科技大樓': '4189', '六張犁': '4190', '麟光': '4191', '辛亥': '4192',
  '萬芳醫院': '4193', '萬芳社區': '4194', '木柵': '4195', '動物園': '4196',
  // 淡水信義線
  '新北投': '4198', '淡水': '4163', '紅樹林': '4164', '竹圍': '4165',
  '關渡': '4166', '忠義': '4167', '復興崗': '4168', '北投': '4169',
  '奇岩': '4170', '唭哩岸': '4171', '石牌': '4172', '明德': '4173',
  '芝山': '4174', '士林': '4175', '劍潭': '4176', '圓山': '4177',
  '民權西路': '4178', '雙連': '4179', '中山': '4180', '台北車站': '4181',
  '台大醫院': '4182', '中正紀念堂': '4183', '東門': '4200',
  '大安森林公園': '4201', '信義安和': '66300', '台北101/世貿': '66301', '象山': '4205',
  // 松山新店線
  '松山': '4235', '南京三民': '4236', '台北小巨蛋': '66305',
  '松江南京': '66266', '北門': '4241', '西門': '4242', '小南門': '4255',
  '古亭': '4184', '台電大樓': '4244', '公館': '4245', '萬隆': '4246',
  '景美': '4247', '大坪林': '4248', '七張': '4249', '新店區公所': '4251',
  '新店': '4250', '小碧潭': '4253',
  // 中和新蘆線
  '蘆洲': '66258', '三民高中': '66259', '徐匯中學': '66260',
  '三和國中': '66261', '三重國小': '66262', '迴龍': '4207', '丹鳳': '4208',
  '輔大': '4209', '新莊': '4210', '頭前庄': '4211', '先嗇宮': '4212',
  '三重': '4213', '菜寮': '4214', '台北橋': '4215', '大橋頭': '66263',
  '中山國小': '66264', '行天宮': '66265', '忠孝新生': '4221',
  '頂溪': '4231', '永安市場': '4232', '景安': '4233', '南勢角': '4234',
  // 板南線
  '南港': '4258', '昆陽': '4259', '後山埤': '4260', '永春': '4261',
  '市政府': '4262', '國父紀念館': '4263', '忠孝敦化': '4264',
  '善導寺': '4267', '龍山寺': '4271', '江子翠': '4272', '新埔': '4273',
  '板橋': '4274', '府中': '4275', '亞東醫院': '4277', '海山': '4278',
  '土城': '4279', '永寧': '4280', '頂埔': '4281',
  // 淡海輕軌
  '竿蓁林': '66346', '淡金鄧公': '66347', '淡江大學': '66348',
  '淡金北新': '66349', '新市一路': '66350', '淡水行政中心': '66351',
  '濱海義山': '66352', '濱海沙崙': '66353', '淡海新市鎮': '66354',
  '崁頂': '66355', '台北海洋大學': '66383', '沙崙': '66384', '淡水漁人碼頭': '66385',
  // 環狀線
  '十四張': '4306', '秀朗橋': '66358', '景平': '66359', '中和': '66360',
  '橋和': '66361', '中原': '66362', '板新': '4299',
  '新埔民生': '66363', '幸福': '66364', '新北產業園區': '66365',
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
    const sectionId = SECTION_ID[area.city]?.[area.region] ?? ''
    const params = new URLSearchParams({
      ...baseParams,
      region: CITY_ID[area.city] ?? '',
    })
    if (sectionId) params.set('section', sectionId)
    urls.push(`https://rent.591.com.tw/list?${params}`)
  }

  for (const line of locations.lines ?? []) {
    const metroId = MRT_LINE_ID[line.line] ?? ''
    if (!metroId) continue
    for (const station of line.stations ?? []) {
      const stationId = STATION_ID[station] ?? ''
      const params = new URLSearchParams({
        ...baseParams,
        metro: metroId,
      })
      if (stationId) params.set('station', stationId)
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

  // 租金 (price=min$_max$ for custom free-text values)
  if (sub.rent_min || sub.rent_max) {
    const min = sub.rent_min ? `${sub.rent_min}$` : '$'
    const max = sub.rent_max ? `${sub.rent_max}$` : '$'
    params['price'] = `${min}_${max}`
  }

  // 格局
  if (sub.layout) {
    const ids = sub.layout.split(',')
      .map((l: string) => LAYOUT_ID[l.trim()])
      .filter(Boolean)
    if (ids.length) params['layout'] = ids.join(',')
  }

  // 坪數 (acreage=min_max)
  if (sub.size_min || sub.size_max) {
    const min = sub.size_min ? String(sub.size_min) : '0'
    const max = sub.size_max ? String(sub.size_max) : ''
    params['acreage'] = `${min}_${max}`
  }

  // 型態
  if (sub.shape) {
    const ids = sub.shape.split(',')
      .map((s: string) => SHAPE_ID[s.trim()])
      .filter(Boolean)
    if (ids.length) params['shape'] = ids.join(',')
  }

  // 特色 (other param)
  const features: string[] = []
  if (sub.feat_new) features.push('newPost')
  if (sub.feat_near_mrt) features.push('near_subway')
  if (sub.feat_pet) features.push('pet')
  if (sub.feat_cook) features.push('cook')
  if (sub.feat_parking) features.push('cartplace')
  if (sub.feat_elevator) features.push('lift')
  if (sub.feat_balcony) features.push('balcony_1')
  if (sub.feat_short_term) features.push('lease')
  if (sub.feat_social_housing) features.push('social-housing')
  if (sub.feat_subsidy) features.push('rental-subsidy')
  if (sub.feat_elderly) features.push('elderly-friendly')
  if (sub.feat_invoice) features.push('tax-deductible')
  if (sub.feat_register) features.push('naturalization')
  if (features.length) params['other'] = features.join(',')

  // 排除頂樓加蓋
  if (sub.exclude_top_floor) params['notice'] = 'not_cover'

  return params
}
