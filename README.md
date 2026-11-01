# nbm-climate-kit

Small, dependency-free TypeScript helpers for two things that trip up anyone working with US station temperature forecasts:

1. **Parsing NOAA's National Blend of Models (NBM) station text bulletin (NBS)**, the free hourly-guidance product published for ~1,800 stations. The format is fixed-width with 3-character fields, so adjacent three-digit values run together (`105107`) and naive whitespace splitting silently corrupts hot-weather forecasts.
2. **Computing the NWS "climate day"**. The National Weather Service Daily Climate Report (CLI) covers one calendar day in **local standard time all year**, so during daylight saving time the official day runs **01:00 to 01:00** on the wall clock. Using the wall-clock day attributes an hour of readings to the wrong day.

## Install

```bash
npm install nbm-climate-kit
```

## Usage

```ts
import { climateDay, climateDayHighLow, nbsUrls, parseNbs } from "nbm-climate-kit"

const cycleMs = Date.parse("2026-01-10T13:00:00Z")
const text = await (await fetch(nbsUrls(cycleMs)[1])).text()   // AWS Open Data mirror

const series = parseNbs(text, cycleMs, ["KORD", "KLAX"])
console.log(climateDayHighLow(series.get("KORD")!, "2026-01-11", "America/Chicago"))
// { high: 31, low: 18 }

console.log(climateDay("2026-07-04", "America/New_York"))
// { startMs: 2026-07-04T05:00Z, endMs: 2026-07-05T05:00Z, standardOffsetMinutes: -300 }
```

## API

| Function | What it does |
|---|---|
| `parseNbs(text, cycleMs, stations?)` | Bulletin text → `Map<stationId, { validMs, tempF }[]>` |
| `climateDayHighLow(readings, date, tz)` | Forecast high/low over the NWS climate day |
| `climateDay(date, tz)` | UTC bounds of a climate day (local standard midnight → midnight) |
| `climateDate(ms, tz)` | Which climate day an instant belongs to |
| `nbsUrls(cycleMs)` | Public NOMADS and AWS URLs of the NBS bulletin for a cycle |
| `splitStationCards`, `readRow` | Lower-level parsing helpers |

## Notes

- Data: NBM output is a public-domain product of NOAA/NWS. This package only parses text; it bundles no data.
- The parser drops values outside -60 to 135 deg F as format drift.
- Requires a runtime with full ICU time-zone data (Node 18+).

## License

MIT
