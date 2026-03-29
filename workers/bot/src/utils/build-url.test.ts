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

  it('town URL contains correct regionid and section params', () => {
    const sub = makeSub({
      areas: [{ city: '台北市', region: '大安區' }],
      lines: [],
    })
    const [url] = build591Url(sub)
    const params = new URL(url).searchParams
    expect(params.get('regionid')).toBe('1') // 台北市 → 1
    expect(params.get('section')).toBe('大安區')
  })

  it('MRT URL contains correct mrtSerialNo and mrt params', () => {
    const sub = makeSub({
      areas: [],
      lines: [{ line: '板南線', stations: ['忠孝敦化'] }],
    })
    const [url] = build591Url(sub)
    const params = new URL(url).searchParams
    expect(params.get('mrtSerialNo')).toBe('板南線')
    expect(params.get('mrt')).toBe('忠孝敦化')
  })

  it('rent filter → price_min and price_max params included', () => {
    const sub = makeSub(
      { areas: [{ city: '台北市', region: '大安區' }], lines: [] },
      { rent_min: 10000, rent_max: 25000 }
    )
    const [url] = build591Url(sub)
    const params = new URL(url).searchParams
    expect(params.get('price_min')).toBe('10000')
    expect(params.get('price_max')).toBe('25000')
  })

  it('size filter → area_min and area_max params included', () => {
    const sub = makeSub(
      { areas: [{ city: '台北市', region: '大安區' }], lines: [] },
      { size_min: 15, size_max: 30 }
    )
    const [url] = build591Url(sub)
    const params = new URL(url).searchParams
    expect(params.get('area_min')).toBe('15')
    expect(params.get('area_max')).toBe('30')
  })

  it('feature flags → option param included', () => {
    const sub = makeSub(
      { areas: [{ city: '台北市', region: '大安區' }], lines: [] },
      { feat_pet: 1, feat_elevator: 1 }
    )
    const [url] = build591Url(sub)
    const params = new URL(url).searchParams
    const option = params.get('option') ?? ''
    expect(option).toContain('allow_pet')
    expect(option).toContain('elevator')
  })

  it('exclude_top_floor → not_cover param set to 1', () => {
    const sub = makeSub(
      { areas: [{ city: '台北市', region: '大安區' }], lines: [] },
      { exclude_top_floor: 1 }
    )
    const [url] = build591Url(sub)
    const params = new URL(url).searchParams
    expect(params.get('not_cover')).toBe('1')
  })

  it('missing areas/lines keys (legacy fallback) → empty array', () => {
    const sub = makeSub({})
    const urls = build591Url(sub)
    expect(urls).toHaveLength(0)
  })
})
