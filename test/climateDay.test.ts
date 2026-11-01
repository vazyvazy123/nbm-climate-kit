import { describe, expect, it } from "vitest"
import { climateDate, climateDay, offsetMinutesAt } from "../src/climateDay.js"

describe("climateDay", () => {
  it("starts at local standard midnight in winter", () => {
    const { startMs, endMs } = climateDay("2026-01-10", "America/Chicago")
    expect(new Date(startMs).toISOString()).toBe("2026-01-10T06:00:00.000Z")
    expect(endMs - startMs).toBe(86_400_000)
  })

  it("stays on standard time while daylight saving is in force (01:00 wall clock)", () => {
    const { startMs } = climateDay("2026-07-04", "America/New_York")
    expect(new Date(startMs).toISOString()).toBe("2026-07-04T05:00:00.000Z")
    expect(offsetMinutesAt(startMs, "America/New_York")).toBe(-240)
  })

  it("handles zones without daylight saving", () => {
    const { startMs } = climateDay("2026-07-04", "America/Phoenix")
    expect(new Date(startMs).toISOString()).toBe("2026-07-04T07:00:00.000Z")
  })

  it("rejects malformed dates", () => {
    expect(() => climateDay("2026/07/04", "America/Chicago")).toThrow()
  })
})

describe("climateDate", () => {
  it("assigns 00:30 daylight time to the previous climate day", () => {
    const ms = Date.parse("2026-07-05T04:30:00Z")
    expect(climateDate(ms, "America/New_York")).toBe("2026-07-04")
  })

  it("assigns 01:30 daylight time to the new climate day", () => {
    const ms = Date.parse("2026-07-05T05:30:00Z")
    expect(climateDate(ms, "America/New_York")).toBe("2026-07-05")
  })
})
