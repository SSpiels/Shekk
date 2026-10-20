import { createServerFn } from "@tanstack/react-start";
import { parseCoords } from "./live-types";

/*
 * Public lookups (no sign-in), so each goes through live-guarded.server.ts:
 * answers are cached briefly and real upstream calls are budgeted per caller and
 * overall. Handlers stay thin — nothing runs at module scope here.
 */

export const getWeather = createServerFn({ method: "GET" })
  .inputValidator(parseCoords)
  .handler(async ({ data }) => {
    const { guardedWeather } = await import("./live-guarded.server");
    return guardedWeather(data.lat, data.lon);
  });

export const getJewishToday = createServerFn({ method: "GET" })
  .inputValidator(parseCoords)
  .handler(async ({ data }) => {
    const { guardedJewish } = await import("./live-guarded.server");
    return guardedJewish(data.lat, data.lon);
  });

export const getPlaceName = createServerFn({ method: "GET" })
  .inputValidator(parseCoords)
  .handler(async ({ data }) => {
    const { guardedPlaceName } = await import("./live-guarded.server");
    return guardedPlaceName(data.lat, data.lon);
  });
