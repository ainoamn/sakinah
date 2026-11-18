const MARA_URL = 'https://www.mara.gov.om/arabic/calendar_page2.asp'

function to24(key, hhmm) {
  const [h, m] = String(hhmm || '').split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '—'
  const hour = ['Asr', 'Maghrib', 'Isha'].includes(key) && h < 12 ? h + 12 : h
  return String(hour).padStart(2, '0') + ':' + String(m).padStart(2, '0')
}

function parseMaraHtml(html, year, month) {
  const table = html.match(/<table[^>]*border=['"]?1['"]?[\s\S]*?<\/table>/i)
  if (!table) throw new Error('mara-table')
  const rows = [...table[0].matchAll(/<tr>([\s\S]*?)<\/tr>/gi)].slice(1)
  const keys = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
  return rows.map(row => {
    const cells = [...row[1].matchAll(/<td[^>]*>\s*(?:<font[^>]*>)?\s*([^<]+?)\s*(?:<\/font>)?\s*<\/td>/gi)].map(m => m[1].trim())
    if (cells.length < 7) return null
    const [d, mo] = cells[0].split('/').map(Number)
    const timings = Object.fromEntries(keys.map((key, i) => [key, to24(key, cells[i + 1])]))
    return {
      date: {
        readable: `${d}-${mo}-${year}`,
        gregorian: {
          day: String(d),
          month: String(month),
          year: String(year),
          date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        }
      },
      timings,
      meta: { source: 'mara' }
    }
  }).filter(Boolean)
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  try {
    const url = new URL(req.url, 'http://localhost')
    const year = Number(url.searchParams.get('year') || new Date().getFullYear())
    const month = Number(url.searchParams.get('month') || (new Date().getMonth() + 1))
    const cityId = Number(url.searchParams.get('cityId') ?? 0)
    if (!Number.isFinite(year) || month < 1 || month > 12 || cityId < 0) {
      res.status(400).json({ error: 'bad-request' })
      return
    }
    const body = new URLSearchParams({
      year: String(year),
      month: String(month),
      CityID: String(cityId),
      B1: 'أعرض'
    })
    const response = await fetch(MARA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SakinahPrayerProxy/1.0'
      },
      body
    })
    if (!response.ok) throw new Error('mara-http-' + response.status)
    const html = await response.text()
    const data = parseMaraHtml(html, year, month)
    if (!data.length) throw new Error('mara-empty')
    res.status(200).json({ source: 'mara', year, month, cityId, data })
  } catch (error) {
    res.status(502).json({ error: 'mara-unavailable', detail: String(error.message || error) })
  }
}
