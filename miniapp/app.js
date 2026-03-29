// ── Configuration ────────────────────────────────
// Replace with your deployed API worker URL after deployment
const API_BASE = '__API_WORKER_URL__'

// ── Telegram WebApp init ──────────────────────────
const tg = window.Telegram.WebApp
tg.ready()
tg.expand()

// ── Location data ────────────────────────────────
const CITIES = ['台北市','新北市','桃園市','台中市','台南市','高雄市','基隆市','新竹市','新竹縣','苗栗縣','彰化縣','南投縣','雲林縣','嘉義市','嘉義縣','屏東縣','宜蘭縣','花蓮縣','台東縣']

const DISTRICTS = {
  '台北市': ['中正區','大同區','中山區','松山區','大安區','萬華區','信義區','士林區','北投區','內湖區','南港區','文山區'],
  '新北市': ['板橋區','三重區','中和區','永和區','新莊區','新店區','樹林區','鶯歌區','三峽區','淡水區','汐止區','瑞芳區','土城區','蘆洲區','五股區','泰山區','林口區'],
  '桃園市': ['桃園區','中壢區','大溪區','楊梅區','蘆竹區','大園區','龜山區','八德區','龍潭區','平鎮區','新屋區','觀音區','復興區'],
  '台中市': ['中區','東區','南區','西區','北區','西屯區','南屯區','北屯區','豐原區','大里區','太平區','清水區','沙鹿區','梧棲區','烏日區'],
  '台南市': ['中西區','東區','南區','北區','安平區','安南區','永康區','歸仁區','新化區','左鎮區','玉井區','楠西區'],
  '高雄市': ['新興區','前金區','苓雅區','鹽埕區','鼓山區','旗津區','前鎮區','三民區','楠梓區','小港區','左營區','仁武區','大社區','鳳山區','林園區'],
}

const MRT_STATIONS = {
  '板南線': ['南港展覽館','南港','昆陽','後山埤','永春','市政府','國父紀念館','忠孝敦化','忠孝復興','忠孝新生','善導寺','台北車站','西門','龍山寺','江子翠','新埔','板橋','府中','亞東醫院','海山','土城','永寧','頂埔'],
  '淡水信義線': ['淡水','紅樹林','竹圍','關渡','忠義','復興崗','北投','新北投','奇岩','唭哩岸','石牌','明德','芝山','士林','劍潭','圓山','民權西路','雙連','中山','台北車站','台大醫院','中正紀念堂','東門','大安森林公園','大安','信義安和','台北101/世貿','象山'],
  '中和新蘆線': ['迴龍','丹鳳','輔大','新莊','頭前庄','先嗇宮','三重國小','三重','菜寮','台北橋','三民高中','大橋頭','民權西路','中山國小','行天宮','松江南京','忠孝新生','古亭','景安','南勢角','永安市場','頂溪','中和','秀朗橋','景平','景安'],
  '文湖線': ['動物園','木柵','萬芳社區','萬芳醫院','辛亥','麟光','六張犁','科技大樓','大安','忠孝復興','南京復興','中山國中','松山機場','大直','劍南路','西湖','港墘','文德','內湖','大湖公園','葫洲','東湖','南港軟體園區','南港展覽館'],
}

// ── State ────────────────────────────────────────
let currentSub = null
// Town mode: Array of {city, region}
let selectedAreas = []
// MRT mode: Array of {line, stations: []}
let selectedMrtLines = []
// Track which city / line is currently shown for district / station selection
let activeCityForDistricts = null
let activeLineForStations = null

// ── API helper ───────────────────────────────────
async function apiCall(method, path, body) {
  const initData = tg.initData || ''
  const opts = {
    method,
    headers: {
      'Authorization': `tma ${initData}`,
      'Content-Type': 'application/json',
    },
  }
  if (body !== undefined) opts.body = JSON.stringify(body)
  let res
  try {
    res = await fetch(API_BASE + path, opts)
  } catch (err) {
    showError('網路錯誤：' + err.message)
    throw err
  }
  if (!res.ok) {
    const text = await res.text()
    const err = new Error(`API ${method} ${path} failed (${res.status}): ${text}`)
    showError(err.message)
    throw err
  }
  return res.json()
}

// ── Error banner ─────────────────────────────────
function showError(msg) {
  const el = document.getElementById('error-banner')
  el.textContent = msg
  el.style.display = ''
}

// ── Toast ────────────────────────────────────────
let toastTimer = null
function showToast(msg, duration = 2500) {
  const el = document.getElementById('toast')
  el.textContent = msg
  el.classList.add('show')
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('show'), duration)
}

// ── Tab switching ────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === name)
  })
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.toggle('active', el.id === `tab-${name}`)
  })
  if (name === 'view') loadViewTab()
  if (name === 'manage') loadManageTab()
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab))
})

// ── Populate city select ──────────────────────────
function populateCitySelect() {
  const sel = document.getElementById('city-select')
  CITIES.forEach(city => {
    const opt = document.createElement('option')
    opt.value = city
    opt.textContent = city
    sel.appendChild(opt)
  })
}

// ── District checkboxes ───────────────────────────
function renderDistrictCheckboxes(city) {
  const container = document.getElementById('district-checkboxes')
  container.innerHTML = ''
  const districts = DISTRICTS[city] || []
  const selectedForCity = selectedAreas.filter(a => a.city === city).map(a => a.region)
  districts.forEach(d => {
    const label = document.createElement('label')
    label.className = 'chip' + (selectedForCity.includes(d) ? ' chip--checked' : '')
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.value = d
    cb.checked = selectedForCity.includes(d)
    cb.addEventListener('change', () => {
      if (cb.checked) {
        if (!selectedAreas.find(a => a.city === city && a.region === d)) {
          selectedAreas.push({ city, region: d })
        }
      } else {
        selectedAreas = selectedAreas.filter(a => !(a.city === city && a.region === d))
      }
      label.classList.toggle('chip--checked', cb.checked)
      renderSelectedAreaTags()
    })
    label.appendChild(cb)
    label.appendChild(document.createTextNode(d))
    container.appendChild(label)
  })
}

// ── MRT station checkboxes ────────────────────────
function renderMrtStationCheckboxes(line) {
  const container = document.getElementById('mrt-station-checkboxes')
  container.innerHTML = ''
  const stations = MRT_STATIONS[line] || []
  let lineEntry = selectedMrtLines.find(l => l.line === line)
  stations.forEach(s => {
    const isSelected = lineEntry ? lineEntry.stations.includes(s) : false
    const label = document.createElement('label')
    label.className = 'chip' + (isSelected ? ' chip--checked' : '')
    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.value = s
    cb.checked = isSelected
    cb.addEventListener('change', () => {
      if (!lineEntry) {
        lineEntry = { line, stations: [] }
        selectedMrtLines.push(lineEntry)
      }
      if (cb.checked) {
        if (!lineEntry.stations.includes(s)) lineEntry.stations.push(s)
      } else {
        lineEntry.stations = lineEntry.stations.filter(x => x !== s)
      }
      label.classList.toggle('chip--checked', cb.checked)
      renderSelectedMrtTags()
    })
    label.appendChild(cb)
    label.appendChild(document.createTextNode(s))
    container.appendChild(label)
  })
}

// ── Tag rendering ─────────────────────────────────
function renderSelectedAreaTags() {
  const list = document.getElementById('selected-areas')
  list.innerHTML = ''
  const grouped = {}
  selectedAreas.forEach(({ city, region }) => {
    if (!grouped[city]) grouped[city] = []
    grouped[city].push(region)
  })
  Object.entries(grouped).forEach(([city, regions]) => {
    const tag = document.createElement('span')
    tag.className = 'tag'
    tag.textContent = regions.length ? `${city}・${regions.join('、')}` : city
    const rm = document.createElement('button')
    rm.className = 'tag-remove'
    rm.type = 'button'
    rm.textContent = '×'
    rm.title = `移除 ${city}`
    rm.addEventListener('click', () => {
      selectedAreas = selectedAreas.filter(a => a.city !== city)
      renderSelectedAreaTags()
      // Re-render district checkboxes if this city is still active
      if (activeCityForDistricts === city) {
        renderDistrictCheckboxes(city)
      }
    })
    tag.appendChild(rm)
    list.appendChild(tag)
  })
}

function renderSelectedMrtTags() {
  const list = document.getElementById('selected-mrt-lines')
  list.innerHTML = ''
  selectedMrtLines.forEach(({ line, stations }) => {
    const tag = document.createElement('span')
    tag.className = 'tag'
    tag.textContent = stations.length ? `${line}・${stations.join('、')}` : line
    const rm = document.createElement('button')
    rm.className = 'tag-remove'
    rm.type = 'button'
    rm.textContent = '×'
    rm.title = `移除 ${line}`
    rm.addEventListener('click', () => {
      selectedMrtLines = selectedMrtLines.filter(l => l.line !== line)
      renderSelectedMrtTags()
    })
    tag.appendChild(rm)
    list.appendChild(tag)
  })
}

// ── City select handler ───────────────────────────
document.getElementById('city-select').addEventListener('change', function () {
  const city = this.value
  if (!city) {
    document.getElementById('district-field').style.display = 'none'
    document.getElementById('add-area-btn').style.display = 'none'
    return
  }
  activeCityForDistricts = city
  document.getElementById('district-field').style.display = ''
  document.getElementById('add-area-btn').style.display = ''
  renderDistrictCheckboxes(city)
})

// ── Add area button ───────────────────────────────
document.getElementById('add-area-btn').addEventListener('click', () => {
  // Reset city select, hide district checkboxes
  document.getElementById('city-select').value = ''
  document.getElementById('district-field').style.display = 'none'
  activeCityForDistricts = null
})

// ── MRT line select ───────────────────────────────
document.getElementById('mrt-line-select').addEventListener('change', function () {
  const line = this.value
  if (!line) {
    document.getElementById('mrt-station-field').style.display = 'none'
    document.getElementById('add-line-btn').style.display = 'none'
    return
  }
  activeLineForStations = line
  document.getElementById('mrt-station-field').style.display = ''
  document.getElementById('add-line-btn').style.display = ''
  renderMrtStationCheckboxes(line)
})

// ── Add line button ───────────────────────────────
document.getElementById('add-line-btn').addEventListener('click', () => {
  document.getElementById('mrt-line-select').value = ''
  document.getElementById('mrt-station-field').style.display = 'none'
  activeLineForStations = null
})

// ── Build filter payload from form ────────────────
function buildPayload() {
  const validLines = selectedMrtLines.filter(l => l.stations.length > 0)
  if (selectedAreas.length === 0 && validLines.length === 0) {
    throw new Error('請至少選擇一個區域或捷運站點')
  }
  const locations = { areas: selectedAreas, lines: validLines }

  const getChecked = (name) => {
    const vals = [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(el => el.value)
    return vals.length ? vals.join(',') : null
  }

  const getNum = (id) => {
    const v = document.getElementById(id).value.trim()
    return v ? parseInt(v, 10) : null
  }

  const getFeat = (name) => {
    const el = document.querySelector(`input[name="${name}"]`)
    return el && el.checked ? 1 : 0
  }

  return {
    locations,
    room_type: getChecked('room_type'),
    rent_min: getNum('rent_min'),
    rent_max: getNum('rent_max'),
    layout: getChecked('layout'),
    size_min: getNum('size_min'),
    size_max: getNum('size_max'),
    shape: getChecked('shape'),
    feat_new: getFeat('feat_new'),
    feat_near_mrt: getFeat('feat_near_mrt'),
    feat_pet: getFeat('feat_pet'),
    feat_cook: getFeat('feat_cook'),
    feat_parking: getFeat('feat_parking'),
    feat_elevator: getFeat('feat_elevator'),
    feat_balcony: getFeat('feat_balcony'),
    feat_short_term: getFeat('feat_short_term'),
    feat_social_housing: getFeat('feat_social_housing'),
    feat_subsidy: getFeat('feat_subsidy'),
    feat_elderly: getFeat('feat_elderly'),
    feat_invoice: getFeat('feat_invoice'),
    feat_register: getFeat('feat_register'),
    exclude_top_floor: getFeat('exclude_top_floor'),
  }
}

// ── Fill form from subscription data ─────────────
function fillForm(sub) {
  if (!sub) return

  const f = sub.filters

  // Location
  selectedAreas = [...(f.locations?.areas ?? [])]
  renderSelectedAreaTags()
  selectedMrtLines = (f.locations?.lines ?? []).map(l => ({ line: l.line, stations: [...(l.stations || [])] }))
  renderSelectedMrtTags()

  // Multi-select checkboxes
  const setChecked = (name, csvVal) => {
    const vals = csvVal ? csvVal.split(',') : []
    document.querySelectorAll(`input[name="${name}"]`).forEach(cb => {
      cb.checked = vals.includes(cb.value)
      cb.closest('.chip')?.classList.toggle('chip--checked', cb.checked)
    })
  }
  setChecked('room_type', f.room_type)
  setChecked('layout', f.layout)
  setChecked('shape', f.shape)

  // Numeric inputs
  document.getElementById('rent_min').value = f.rent_min ?? ''
  document.getElementById('rent_max').value = f.rent_max ?? ''
  document.getElementById('size_min').value = f.size_min ?? ''
  document.getElementById('size_max').value = f.size_max ?? ''

  // Feature checkboxes
  const feats = ['feat_new','feat_near_mrt','feat_pet','feat_cook','feat_parking',
    'feat_elevator','feat_balcony','feat_short_term','feat_social_housing',
    'feat_subsidy','feat_elderly','feat_invoice','feat_register','exclude_top_floor']
  feats.forEach(name => {
    const cb = document.querySelector(`input[name="${name}"]`)
    if (cb) {
      cb.checked = !!f[name]
      cb.closest('.chip')?.classList.toggle('chip--checked', !!f[name])
    }
  })
}

// ── Save form ─────────────────────────────────────
document.getElementById('subscribe-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const btn = document.getElementById('save-btn')
  btn.disabled = true
  btn.textContent = '儲存中...'

  try {
    const payload = buildPayload()
    await apiCall('PUT', '/subscription', payload)
    currentSub = null // invalidate cache
    showToast('✅ 訂閱已儲存！')
    btn.textContent = '儲存訂閱'
    btn.disabled = false
  } catch (err) {
    showToast('❌ ' + err.message)
    btn.textContent = '儲存訂閱'
    btn.disabled = false
  }
})

// ── View tab ──────────────────────────────────────
async function loadViewTab() {
  const loading = document.getElementById('view-loading')
  const empty = document.getElementById('view-empty')
  const content = document.getElementById('view-content')

  loading.style.display = ''
  empty.style.display = 'none'
  content.style.display = 'none'

  try {
    const data = await apiCall('GET', '/subscription')
    currentSub = data.subscription

    if (!currentSub) {
      loading.style.display = 'none'
      empty.style.display = ''
      document.getElementById('search-action').style.display = 'none'
      return
    }

    loading.style.display = 'none'
    content.style.display = ''
    document.getElementById('search-action').style.display = ''

    const badge = document.getElementById('view-status-badge')
    badge.textContent = currentSub.status === 'active' ? '通知中' : '已暫停'
    badge.className = 'badge ' + (currentSub.status === 'active' ? 'badge--active' : 'badge--paused')

    const dl = document.getElementById('view-details')
    dl.innerHTML = ''
    const f = currentSub.filters

    function addRow(label, value) {
      if (!value) return
      const dt = document.createElement('dt')
      dt.textContent = label
      const dd = document.createElement('dd')
      dd.textContent = value
      dl.appendChild(dt)
      dl.appendChild(dd)
    }

    // Location
    const areas = f.locations?.areas ?? []
    const mLines = f.locations?.lines ?? []
    if (areas.length) {
      const grouped = {}
      areas.forEach(({ city, region }) => {
        if (!grouped[city]) grouped[city] = []
        grouped[city].push(region)
      })
      const townText = Object.entries(grouped).map(([city, regions]) =>
        regions.length ? `${city}（${regions.join('、')}）` : city
      ).join('、')
      addRow('鄉鎮', townText)
    }
    if (mLines.length) {
      const mrtText = mLines.map(l =>
        `${l.line}（${(l.stations || []).join('、')}）`
      ).join('、')
      addRow('捷運', mrtText)
    }
    addRow('房屋類型', f.room_type?.replace(/,/g, '、'))
    if (f.rent_min || f.rent_max) {
      addRow('租金', `${f.rent_min ? f.rent_min + ' 元' : '不限'} ～ ${f.rent_max ? f.rent_max + ' 元' : '不限'}`)
    }
    addRow('格局', f.layout?.replace(/,/g, '、'))
    if (f.size_min || f.size_max) {
      addRow('坪數', `${f.size_min ?? '不限'} ～ ${f.size_max ?? '不限'} 坪`)
    }
    addRow('建築型態', f.shape?.replace(/,/g, '、'))

    const featMap = {
      feat_new: '新上架', feat_near_mrt: '近捷運', feat_pet: '可養寵物',
      feat_cook: '可開伙', feat_parking: '有車位', feat_elevator: '有電梯',
      feat_balcony: '有陽台', feat_short_term: '可短期租賃', feat_social_housing: '社會住宅',
      feat_subsidy: '租金補貼', feat_elderly: '高齡友善', feat_invoice: '可報稅',
      feat_register: '可入籍', exclude_top_floor: '排除頂樓加蓋',
    }
    const activeFeats = Object.entries(featMap)
      .filter(([key]) => f[key])
      .map(([, label]) => label)
    addRow('特色', activeFeats.join('、') || null)

  } catch (err) {
    loading.textContent = '載入失敗：' + err.message
  }
}

// ── Search now button ─────────────────────────────
document.getElementById('search-now-btn').addEventListener('click', async () => {
  const btn = document.getElementById('search-now-btn')
  btn.disabled = true
  btn.textContent = '搜尋中...'

  try {
    const initData = tg.initData || ''
    const res = await fetch(API_BASE + '/search', {
      method: 'POST',
      headers: {
        'Authorization': `tma ${initData}`,
        'Content-Type': 'application/json',
      },
    })
    if (res.ok) {
      showToast('✅ 搜尋已觸發，結果將透過 Bot 傳送')
    } else {
      const data = await res.json().catch(() => ({}))
      if (data.error === 'NO_SUBSCRIPTION') {
        showToast('❌ 請先建立訂閱')
      } else {
        showToast('❌ 觸發失敗，請稍後再試')
      }
    }
  } catch {
    showToast('❌ 觸發失敗，請稍後再試')
  } finally {
    btn.disabled = false
    btn.textContent = '🔍 立即搜尋'
  }
})

// ── Manage tab ────────────────────────────────────
async function loadManageTab() {
  const loading = document.getElementById('manage-loading')
  const empty = document.getElementById('manage-empty')
  const content = document.getElementById('manage-content')

  loading.style.display = ''
  empty.style.display = 'none'
  content.style.display = 'none'

  try {
    const data = currentSub !== null
      ? { subscription: currentSub }
      : await apiCall('GET', '/subscription')
    currentSub = data.subscription

    if (!currentSub) {
      loading.style.display = 'none'
      empty.style.display = ''
      return
    }

    loading.style.display = 'none'
    content.style.display = ''
    renderManageStatus(currentSub.status)

  } catch (err) {
    loading.textContent = '載入失敗：' + err.message
  }
}

function renderManageStatus(status) {
  const statusText = document.getElementById('manage-status-text')
  const toggleBtn = document.getElementById('toggle-status-btn')
  if (status === 'active') {
    statusText.textContent = '目前正在通知中'
    toggleBtn.textContent = '暫停通知'
  } else {
    statusText.textContent = '通知已暫停'
    toggleBtn.textContent = '恢復通知'
  }
}

document.getElementById('toggle-status-btn').addEventListener('click', async () => {
  if (!currentSub) return
  const newStatus = currentSub.status === 'active' ? 'paused' : 'active'
  const btn = document.getElementById('toggle-status-btn')
  btn.disabled = true

  try {
    await apiCall('PATCH', '/subscription/status', { status: newStatus })
    currentSub.status = newStatus
    renderManageStatus(newStatus)
    showToast(newStatus === 'active' ? '✅ 通知已恢復' : '⏸ 通知已暫停')
  } catch (err) {
    showToast('❌ ' + err.message)
  } finally {
    btn.disabled = false
  }
})

document.getElementById('delete-btn').addEventListener('click', async () => {
  const confirmed = confirm('確定要刪除訂閱嗎？此操作無法復原。')
  if (!confirmed) return

  const btn = document.getElementById('delete-btn')
  btn.disabled = true
  btn.textContent = '刪除中...'

  try {
    await apiCall('DELETE', '/subscription')
    currentSub = null
    showToast('訂閱已刪除')
    // Reload manage tab to show empty state
    loadManageTab()
    // Also reset form
    resetForm()
  } catch (err) {
    showToast('❌ ' + err.message)
    btn.disabled = false
    btn.textContent = '刪除訂閱'
  }
})

// ── Reset form ────────────────────────────────────
function resetForm() {
  document.getElementById('subscribe-form').reset()
  selectedAreas = []
  selectedMrtLines = []
  activeCityForDistricts = null
  activeLineForStations = null
  document.getElementById('selected-areas').innerHTML = ''
  document.getElementById('selected-mrt-lines').innerHTML = ''
  document.getElementById('district-checkboxes').innerHTML = ''
  document.getElementById('mrt-station-checkboxes').innerHTML = ''
  document.getElementById('district-field').style.display = 'none'
  document.getElementById('mrt-station-field').style.display = 'none'
  document.getElementById('add-area-btn').style.display = 'none'
  document.getElementById('add-line-btn').style.display = 'none'
  // Uncheck all chip checkboxes visually
  document.querySelectorAll('.chip input[type="checkbox"]').forEach(cb => {
    cb.checked = false
    cb.closest('.chip')?.classList.remove('chip--checked')
  })
}

// ── Init ──────────────────────────────────────────
async function init() {
  if (!tg.initData) {
    showError('請從 Telegram 開啟此頁面（initData 為空）')
    return
  }

  populateCitySelect()

  // Try to load existing subscription to pre-fill settings form
  try {
    const data = await apiCall('GET', '/subscription')
    currentSub = data.subscription
    if (currentSub) {
      fillForm(currentSub)
    }
  } catch (e) {
    // Not fatal — user may not have a subscription yet
    console.warn('init load failed:', e.message)
    showError('載入訂閱失敗：' + e.message)
  }
}

init()
