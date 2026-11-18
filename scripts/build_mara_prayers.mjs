import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

const OUT = path.resolve('public/site/prayers/mara')
const CITIES = [
  ['Muscat', 0],
  ['Nizwa', 79],
  ['Salalah', 56],
  ['Sohar', 52],
  ['Sur', 57],
  ['Ibri', 61],
  ['Rustaq', 15]
]

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
    const [d] = cells[0].split('/').map(Number)
    const timings = Object.fromEntries(keys.map((key, i) => [key, to24(key, cells[i + 1])]))
    return {
      date: {
        readable: `${d}-${month}-${year}`,
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

function fetchMonth(cityId, year, month) {
  const tmp = path.resolve('scripts', `mara-${cityId}-${year}-${month}.html`)
  const data = `year=${year}&month=${month}&CityID=${cityId}&B1=%D8%A3%D8%B9%D8%B1%D8%B6`
  const result = spawnSync('curl.exe', [
    '-sL', '-X', 'POST', 'https://www.mara.gov.om/arabic/calendar_page2.asp',
    '-H', 'Content-Type: application/x-www-form-urlencoded',
    '--data', data,
    '-o', tmp
  ], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || 'curl-failed')
  const html = fs.readFileSync(tmp, 'utf8')
  fs.unlinkSync(tmp)
  return parseMaraHtml(html, year, month)
}

const now = new Date()
const months = []
for (let i = 0; i < 3; i++) {
  const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
  months.push([d.getFullYear(), d.getMonth() + 1])
}

fs.mkdirSync(OUT, { recursive: true })
for (const [name, cityId] of CITIES) {
  const dir = path.join(OUT, String(cityId))
  fs.mkdirSync(dir, { recursive: true })
  for (const [year, month] of months) {
    process.stdout.write(`MARA ${name} ${year}-${month}... `)
    try {
      const data = fetchMonth(cityId, year, month)
      fs.writeFileSync(path.join(dir, `${year}-${month}.json`), JSON.stringify({ source: 'mara', city: name, cityId, year, month, data }))
      console.log(data.length, 'days')
    } catch (error) {
      console.log('FAIL', error.message)
    }
  }
}
