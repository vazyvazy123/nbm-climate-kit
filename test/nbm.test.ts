import { describe, expect, it } from "vitest"
import { climateDayHighLow, nbsUrls, parseNbs, readRow, splitStationCards } from "../src/nbm.js"

const row = (label: string, values: Array<number | string>): string =>
  ` ${label} ` + values.map((v) => String(v).padStart(3)).join("")

const card = (id: string, fhr: number[], utc: number[], tmp: Array<number | string>): string =>
  [` ${id}    NBM V5.0 NBS GUIDANCE    1/10/2026  0000 UTC`, row("UTC", utc), row("FHR", fhr), row("TMP", tmp), ""].join("\n")

const CYCLE = Date.parse("2026-01-10T00:00:00Z")

describe("splitStationCards", () => {
  it("finds every station card", () => {
    const text = card("KAAA", [3, 6], [3, 6], [40, 41]) + card("KBBB", [3, 6], [3, 6], [50, 51])
    expect(splitStationCards(text).map((c) => c.id)).toEqual(["KAAA", "KBBB"])
  })
})

describe("readRow", () => {
  it("reads adjacent three-digit values by column", () => {
    expect(readRow(row("TMP", [105, 107, 99]), "TMP")).toEqual([105, 107, 99])
  })

  it("turns blank and dash fields into NaN", () => {
    const values = readRow(row("TMP", [40, "-", 42]), "TMP")
    expect(values[0]).toBe(40)
    expect(Number.isNaN(values[1])).toBe(true)
  })
})

describe("parseNbs", () => {
  it("times columns from FHR", () => {
    const series = parseNbs(card("KAAA", [3, 6, 9], [3, 6, 9], [40, 38, 36]), CYCLE).get("KAAA")!
    expect(series.map((r) => new Date(r.validMs).toISOString().slice(11, 13))).toEqual(["03", "06", "09"])
    expect(series.map((r) => r.tempF)).toEqual([40, 38, 36])
  })

  it("keeps only the requested stations", () => {
    const text = card("KAAA", [3], [3], [40]) + card("KBBB", [3], [3], [50])
    expect([...parseNbs(text, CYCLE, ["KBBB"]).keys()]).toEqual(["KBBB"])
  })

  it("drops implausible values", () => {
    const series = parseNbs(card("KAAA", [3, 6], [3, 6], [40, 999]), CYCLE).get("KAAA")!
    expect(series).toHaveLength(1)
  })
})

describe("climateDayHighLow", () => {
  it("uses the local standard-time day", () => {
    const fhr = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33]
    const utc = fhr.map((h) => h % 24)
    const tmp = [30, 28, 25, 27, 35, 41, 44, 39, 33, 20, 22]
    const series = parseNbs(card("KAAA", fhr, utc, tmp), CYCLE).get("KAAA")!
    expect(climateDayHighLow(series, "2026-01-10", "America/Chicago")).toEqual({ high: 44, low: 25 })
  })

  it("returns nulls when no reading falls in the day", () => {
    expect(climateDayHighLow([], "2026-01-10", "America/Chicago")).toEqual({ high: null, low: null })
  })
})

describe("nbsUrls", () => {
  it("builds NOMADS and AWS paths", () => {
    expect(nbsUrls(Date.parse("2026-01-10T13:00:00Z"))[1]).toBe(
      "https://noaa-nbm-grib2-pds.s3.amazonaws.com/blend.20260110/13/text/blend_nbstx.t13z",
    )
  })
})
