// NWS daily climate reports (CLI) cover one calendar day in LOCAL STANDARD TIME, all year round.
// While daylight saving time is in force, that day runs from 01:00 to 01:00 on the wall clock.

/** A time zone's UTC offset in minutes (local wall clock minus UTC) at instant `ms`. */
export function offsetMinutesAt(ms: number, timeZone: string): number {
  const parts: Record<string, string> = {}
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
  for (const p of fmt.formatToParts(new Date(ms))) if (p.type !== "literal") parts[p.type] = p.value
  const wall = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour! % 24, +parts.minute!, +parts.second!)
  return Math.round((wall - Math.floor(ms / 1000) * 1000) / 60_000)
}

const standardCache = new Map<string, number>()

/** The zone's standard-time offset in minutes for `year`: the smaller of its January and July offsets. */
export function standardOffsetMinutes(year: number, timeZone: string): number {
  const key = `${timeZone}|${year}`
  let std = standardCache.get(key)
  if (std === undefined) {
    std = Math.min(offsetMinutesAt(Date.UTC(year, 0, 15, 12), timeZone), offsetMinutesAt(Date.UTC(year, 6, 15, 12), timeZone))
    standardCache.set(key, std)
  }
  return std
}

export interface ClimateDayBounds {
  /** Inclusive start, UTC epoch ms. */
  startMs: number
  /** Exclusive end, UTC epoch ms. */
  endMs: number
  /** The standard-time offset used, in minutes. */
  standardOffsetMinutes: number
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** UTC bounds of climate day `date` (yyyy-mm-dd) in `timeZone`: local-standard midnight to midnight. */
export function climateDay(date: string, timeZone: string): ClimateDayBounds {
  const m = ISO_DATE.exec(date)
  if (!m) throw new Error(`expected yyyy-mm-dd, got "${date}"`)
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  const std = standardOffsetMinutes(y, timeZone)
  const startMs = Date.UTC(y, mo - 1, d) - std * 60_000
  return { startMs, endMs: startMs + 86_400_000, standardOffsetMinutes: std }
}

/** The climate day (yyyy-mm-dd) that instant `ms` falls in for `timeZone`. */
export function climateDate(ms: number, timeZone: string): string {
  const std = standardOffsetMinutes(new Date(ms).getUTCFullYear(), timeZone)
  return new Date(ms + std * 60_000).toISOString().slice(0, 10)
}
