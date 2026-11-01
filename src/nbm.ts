// Parser for the NBM short-range station text bulletin (NBS). Each station card is a header line followed by
// fixed-width rows: FHR (forecast hour), UTC (valid hour) and TMP (deg F). Fields are 3 characters wide and
// right-justified, so adjacent three-digit values have no separator ("105107") and must be read by column.
import { climateDay } from "./climateDay.js"

export interface NbmReading {
  /** Valid time, UTC epoch ms. */
  validMs: number
  /** Forecast 2 m temperature, deg F. */
  tempF: number
}

/** Values outside these bounds come from format drift and are dropped. */
const MIN_PLAUSIBLE_F = -60
const MAX_PLAUSIBLE_F = 135
const FIELD_WIDTH = 3
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

export interface StationCard { id: string; text: string }

/** Split a bulletin into station cards keyed by the 4-character station id on each NBS header line. */
export function splitStationCards(bulletin: string): StationCard[] {
  const header = /^[ ]*([A-Z][A-Z0-9]{3})\b[^\n]*\bNBS\b[^\n]*$/gm
  const starts: Array<{ id: string; index: number }> = []
  for (let m = header.exec(bulletin); m; m = header.exec(bulletin)) starts.push({ id: m[1]!, index: m.index })
  return starts.map((s, i) => ({ id: s.id, text: bulletin.slice(s.index, starts[i + 1]?.index ?? bulletin.length) }))
}

/** Read one labelled fixed-width row of a card; blank or "-" fields become NaN. */
export function readRow(card: string, label: string): number[] {
  const line = card.split("\n").find((l) => new RegExp(`^[ ]{0,3}${label} `).test(l))
  if (!line) return []
  const values: number[] = []
  for (let i = line.indexOf(label) + label.length + 1; i < line.length; i += FIELD_WIDTH) {
    const token = line.slice(i, i + FIELD_WIDTH).trim()
    values.push(token === "" || token === "-" ? NaN : Number.parseInt(token, 10))
  }
  return values
}

/** Column valid times: the cycle time plus FHR hours, else walking the UTC hour row forward across midnights. */
function columnTimes(fhr: number[], hours: number[], columns: number, cycleMs: number): number[] {
  if (fhr.length >= columns) return fhr.slice(0, columns).map((h) => (Number.isFinite(h) ? cycleMs + h * HOUR_MS : NaN))
  const base = new Date(cycleMs)
  let day = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate())
  let previous = base.getUTCHours()
  return hours.slice(0, columns).map((h) => {
    if (!Number.isFinite(h) || h < 0 || h > 23) return NaN
    if (h < previous) day += DAY_MS
    previous = h
    return day + h * HOUR_MS
  })
}

/**
 * Parse an NBS bulletin into hourly temperature series per station.
 * @param bulletin  the bulletin text (one or many station cards)
 * @param cycleMs   the model cycle time (UTC epoch ms), e.g. from the file name `blend_nbstx.t01z`
 * @param stations  optional station ids to keep; all stations when omitted
 */
export function parseNbs(bulletin: string, cycleMs: number, stations?: Iterable<string>): Map<string, NbmReading[]> {
  const keep = stations ? new Set(stations) : null
  const out = new Map<string, NbmReading[]>()
  for (const card of splitStationCards(bulletin)) {
    if ((keep && !keep.has(card.id)) || out.has(card.id)) continue
    const temps = readRow(card.text, "TMP")
    const times = columnTimes(readRow(card.text, "FHR"), readRow(card.text, "UTC"), temps.length, cycleMs)
    const readings: NbmReading[] = []
    temps.forEach((tempF, i) => {
      const validMs = times[i] ?? NaN
      if (Number.isFinite(tempF) && Number.isFinite(validMs) && tempF >= MIN_PLAUSIBLE_F && tempF <= MAX_PLAUSIBLE_F) {
        readings.push({ validMs, tempF })
      }
    })
    if (readings.length > 0) out.set(card.id, readings)
  }
  return out
}

/** Forecast high and low over a station's climate day (local standard time), from hourly readings. */
export function climateDayHighLow(readings: readonly NbmReading[], date: string, timeZone: string): { high: number | null; low: number | null } {
  const { startMs, endMs } = climateDay(date, timeZone)
  const inDay = readings.filter((r) => r.validMs >= startMs && r.validMs < endMs).map((r) => r.tempF)
  return inDay.length ? { high: Math.max(...inDay), low: Math.min(...inDay) } : { high: null, low: null }
}

/** Public NOAA locations of the NBS bulletin for a cycle: NOMADS first, the AWS Open Data mirror second. */
export function nbsUrls(cycleMs: number): string[] {
  const d = new Date(cycleMs)
  const ymd = d.toISOString().slice(0, 10).split("-").join("")
  const hh = String(d.getUTCHours()).padStart(2, "0")
  const path = `blend.${ymd}/${hh}/text/blend_nbstx.t${hh}z`
  return [
    `https://nomads.ncep.noaa.gov/pub/data/nccf/com/blend/prod/${path}`,
    `https://noaa-nbm-grib2-pds.s3.amazonaws.com/${path}`,
  ]
}
