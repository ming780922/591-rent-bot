import { describe, it, expect } from 'vitest'
import { build591Url } from '../../../shared/build-url'

// Helper: build a minimal subscription object
function makeSub(locations: object, extra: Record<string, any> = {}): Record<string, any> {
  return {
    locations: JSON.stringify(locations),
    room_type: null,
    rent_min: null,
    rent_max: null,
    layout: null,
    size_min: null,
    size_max: null,
    shape: null,
    feat_new: 0,
    feat_near_mrt: 0,
    feat_pet: 0,
    feat_cook: 0,
    feat_parking: 0,
    feat_elevator: 0,
    feat_balcony: 0,
    feat_short_term: 0,
    feat_social_housing: 0,
    feat_subsidy: 0,
    feat_elderly: 0,
    feat_invoice: 0,
    feat_register: 0,
    exclude_top_floor: 0,
    ...extra,
  }
}

describe('build591Url', () => {
  it('areas only → produces town URLs, one per area', () => {
    const sub = makeSub({
      areas: [
        { city: '台北市', region: '大安區' },
        { city: '新北市', region: '板橋區' },
      ],
      lines: [],
    })
    const urls = build591Url(sub)
    expect(urls).toHaveLength(2)
    urls.forEach(u => expect(u).toContain('rent.591.com.tw/list'))
  })

  it('lines only → produces MRT URLs, one per station', () => {
    const sub = makeSub({
      areas: [],
      lines: [
        { line: '板南線', stations: ['忠孝敦化', '忠孝復興'] },
      ],
    })
    const urls = build591Url(sub)
    expect(urls).toHaveLength(2)
    urls.forEach(u => expect(u).toContain('rent.591.com.tw/list'))
  })

  it('both areas and lines → produces town + MRT URLs, total count correct', () => {
    const sub = makeSub({
      areas: [{ city: '台北市', region: '大安區' }],
      lines: [{ line: '板南線', stations: ['忠孝敦化', '忠孝復興', '市政府'] }],
    })
    const urls = build591Url(sub)
    expect(urls).toHaveLength(4) // 1 area + 3 stations
  })

  it('both empty → returns empty array', () => {
    const sub = makeSub({ areas: [], lines: [] })
    const urls = build591Url(sub)
    expect(urls).toHaveLength(0)
  })

  it('town URL uses region= (not regionid=) with numeric city ID', () => {
    const sub = makeSub({
      areas: [{ city: '台北市', region: '大安區' }],
      lines: [],
    })
    const [url] = build591Url(sub)
    const params = new URL(url).searchParams
    expect(params.get('region')).toBe('1')       // 台北市 → 1
    expect(params.has('regionid')).toBe(false)   // old wrong param absent
  })

  it('town URL uses numeric section ID (not Chinese district name)', () => {
    const sub = makeSub({
      areas: [{ city: '台北市', region: '大安區' }],
      lines: [],
    })
    const [url] = build591Url(sub)
    const params = new URL(url).searchParams
    expect(params.get('section')).toBe('5')      // 大安區 → 5
  })

  it('新北市 district section ID is correct', () => {
    const sub = makeSub({
      areas: [{ city: '新北市', region: '板橋區' }],
      lines: [],
    })
    const [url] = build591Url(sub)
    const params = new URL(url).searchParams
    expect(params.get('region')).toBe('3')       // 新北市 → 3
    expect(params.get('section')).toBe('26')     // 板橋區 → 26
  })

  it('unknown district → section param omitted, URL still produced', () => {
    const sub = makeSub({
      areas: [{ city: '台北市', region: '未知區' }],
      lines: [],
    })
    const [url] = build591Url(sub)
    const params = new URL(url).searchParams
    expect(params.has('section')).toBe(false)
    expect(url).toContain('rent.591.com.tw/list')
  })

  it('MRT URL uses metro= (numeric line ID) not mrtSerialNo=', () => {
    const sub = makeSub({
      areas: [],
      lines: [{ line: '板南線', stations: ['忠孝敦化'] }],
    })
    const [url] = build591Url(sub)
    const params = new URL(url).searchParams
    expect(params.get('metro')).toBe('168')       // 板南線 → 168
    expect(params.has('mrtSerialNo')).toBe(false) // old wrong param absent
  })

  it('MRT URL uses station= (numeric station ID) not mrt=', () => {
    const sub = makeSub({
      areas: [],
      lines: [{ line: '板南線', stations: ['忠孝敦化'] }],
    })
    const [url] = build591Url(sub)
    const params = new URL(url).searchParams
    expect(params.get('station')).toBe('4264')   // 忠孝敦化 → 4264
    expect(params.has('mrt')).toBe(false)        // old wrong param absent
  })

  it('unknown MRT line → skipped (no URL produced)', () => {
    const sub = makeSub({
      areas: [],
      lines: [{ line: '未知線', stations: ['某站'] }],
    })
    const urls = build591Url(sub)
    expect(urls).toHaveLength(0)
  })

  it('rent filter → price=min$_max$ format (custom free-text values)', () => {
    const sub = makeSub(
      { areas: [{ city: '台北市', region: '大安區' }], lines: [] },
      { rent_min: 10000, rent_max: 25000 }
    )
    const [url] = build591Url(sub)
    const rawSearch = new URL(url).search
    expect(rawSearch).toContain('price=10000%24_25000%24')
    expect(rawSearch).not.toContain('price_min')
    expect(rawSearch).not.toContain('price_max')
  })

  it('rent_min only → price=min$_$ format', () => {
    const sub = makeSub(
      { areas: [{ city: '台北市', region: '大安區' }], lines: [] },
      { rent_min: 15000 }
    )
    const [url] = build591Url(sub)
    expect(new URL(url).search).toContain('price=15000%24_%24')
  })

  it('rent_max only → price=$_max$ format', () => {
    const sub = makeSub(
      { areas: [{ city: '台北市', region: '大安區' }], lines: [] },
      { rent_max: 30000 }
    )
    const [url] = build591Url(sub)
    expect(new URL(url).search).toContain('price=%24_30000%24')
  })

  it('size filter → acreage=min_max format (not area_min/area_max)', () => {
    const sub = makeSub(
      { areas: [{ city: '台北市', region: '大安區' }], lines: [] },
      { size_min: 15, size_max: 30 }
    )
    const [url] = build591Url(sub)
    const params = new URL(url).searchParams
    expect(params.get('acreage')).toBe('15_30')
    expect(params.has('area_min')).toBe(false)
    expect(params.has('area_max')).toBe(false)
  })

  it('feature flags → other= param with correct values', () => {
    const sub = makeSub(
      { areas: [{ city: '台北市', region: '大安區' }], lines: [] },
      { feat_pet: 1, feat_elevator: 1 }
    )
    const [url] = build591Url(sub)
    const params = new URL(url).searchParams
    const other = params.get('other') ?? ''
    expect(other).toContain('pet')        // was allow_pet
    expect(other).toContain('lift')       // was elevator
    expect(params.has('option')).toBe(false) // old wrong param absent
  })

  it('all feature flags → correct other= values', () => {
    const sub = makeSub(
      { areas: [{ city: '台北市', region: '大安區' }], lines: [] },
      {
        feat_near_mrt: 1, feat_pet: 1, feat_cook: 1, feat_parking: 1,
        feat_elevator: 1, feat_balcony: 1, feat_short_term: 1,
        feat_social_housing: 1, feat_subsidy: 1, feat_elderly: 1,
        feat_invoice: 1, feat_register: 1,
      }
    )
    const [url] = build591Url(sub)
    const other = new URL(url).searchParams.get('other') ?? ''
    expect(other).toContain('near_subway')
    expect(other).toContain('pet')
    expect(other).toContain('cook')
    expect(other).toContain('cartplace')
    expect(other).toContain('lift')
    expect(other).toContain('balcony_1')
    expect(other).toContain('lease')
    expect(other).toContain('social-housing')
    expect(other).toContain('rental-subsidy')
    expect(other).toContain('elderly-friendly')
    expect(other).toContain('tax-deductible')
    expect(other).toContain('naturalization')
  })

  it('feat_new → newPost inside other= (not newly=1)', () => {
    const sub = makeSub(
      { areas: [{ city: '台北市', region: '大安區' }], lines: [] },
      { feat_new: 1 }
    )
    const [url] = build591Url(sub)
    const params = new URL(url).searchParams
    expect(params.get('other')).toContain('newPost')
    expect(params.has('newly')).toBe(false)
  })

  it('exclude_top_floor → notice=not_cover (not not_cover=1)', () => {
    const sub = makeSub(
      { areas: [{ city: '台北市', region: '大安區' }], lines: [] },
      { exclude_top_floor: 1 }
    )
    const [url] = build591Url(sub)
    const params = new URL(url).searchParams
    expect(params.get('notice')).toBe('not_cover')
    expect(params.has('not_cover')).toBe(false)
  })

  it('missing areas/lines keys (legacy fallback) → empty array', () => {
    const sub = makeSub({})
    const urls = build591Url(sub)
    expect(urls).toHaveLength(0)
  })

  it('real-world URL: 台北市大安區 + pet + price 10000-20000', () => {
    const sub = makeSub(
      { areas: [{ city: '台北市', region: '大安區' }], lines: [] },
      { rent_min: 10000, rent_max: 20000, feat_pet: 1 }
    )
    const [url] = build591Url(sub)
    const params = new URL(url).searchParams
    expect(params.get('region')).toBe('1')
    expect(params.get('section')).toBe('5')
    expect(new URL(url).search).toContain('price=10000%24_20000%24')
    expect(params.get('other')).toBe('pet')
  })

  it('real-world URL: 板南線忠孝敦化', () => {
    const sub = makeSub({
      areas: [],
      lines: [{ line: '板南線', stations: ['忠孝敦化'] }],
    })
    const [url] = build591Url(sub)
    const params = new URL(url).searchParams
    expect(params.get('metro')).toBe('168')
    expect(params.get('station')).toBe('4264')
  })
})
