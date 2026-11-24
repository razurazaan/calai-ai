// Daily step counts. In the Android / iPhone app they are read from the phone's health store
// (Health Connect on Android, Apple Health / HealthKit on iPhone) and saved to the server, so the
// history lives in MongoDB. On the website there's no step sensor, so steps are typed in by hand.
import { Capacitor } from "@capacitor/core";
import { Health } from "@capgo/capacitor-health";
import { api } from "./api.js";
import { addDays, parseDate } from "./utils.js";

const PLATFORM = Capacitor.getPlatform();
export const HEALTH =
  PLATFORM === "android" ? { source: "health-connect", name: "Health Connect" }
  : PLATFORM === "ios" ? { source: "healthkit", name: "Apple Health" }
  : null;

// Whether the user turned on syncing on this device (the OS keeps the actual permission)
const KEY = "calsnap_health_steps";
const remember = (on) => {
  try {
    on ? localStorage.setItem(KEY, "1") : localStorage.removeItem(KEY);
  } catch { /* storage blocked: syncing just won't be remembered */ }
};
export const healthConnected = () => {
  try {
    return Boolean(HEALTH) && localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

export async function healthAvailable() {
  if (!HEALTH) return { available: false };
  try {
    return await Health.isAvailable();
  } catch (err) {
    return { available: false, reason: err.message };
  }
}

export async function connectHealth() {
  const status = await Health.requestAuthorization({ read: ["steps"] });
  // HealthKit never says whether read access was refused (an Apple privacy rule), so on iPhone a
  // finished prompt counts as connected; refused access then simply reads as 0 steps.
  const ok = PLATFORM === "ios" || Boolean(status.readAuthorized?.includes("steps"));
  remember(ok);
  return ok;
}

export const disconnectHealth = () => remember(false);
export const openHealthSettings = () => Health.openHealthConnectSettings();

// Total steps between local midnight and the next midnight. One query per day keeps the day
// boundaries right on daylight-saving days, where a day isn't 24 hours.
async function stepsOn(date) {
  const { samples } = await Health.queryAggregated({
    dataType: "steps",
    startDate: parseDate(date).toISOString(),
    endDate: parseDate(addDays(date, 1)).toISOString(),
    bucket: "day",
    aggregation: "sum",
  });
  return Math.round(samples.reduce((sum, s) => sum + (Number(s.value) || 0), 0));
}

// Read each day from `from` to `to` (YYYY-MM-DD, inclusive) and save them on the server
export async function syncHealthSteps(from, to) {
  if (!healthConnected()) return;
  const dates = [];
  for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
  let counts;
  try {
    counts = await Promise.all(dates.map(stepsOn));
  } catch (err) {
    // Permission removed in Health Connect settings: stop trying until the user reconnects
    const status = await Health.checkAuthorization({ read: ["steps"] }).catch(() => null);
    if (PLATFORM === "android" && status && !status.readAuthorized?.includes("steps")) remember(false);
    throw err;
  }
  const days = Object.fromEntries(dates.map((d, i) => [d, counts[i]]));
  await api("/steps/sync", { method: "PUT", body: { source: HEALTH.source, days } });
}

// Rough estimates from step count, scaled by the user's height and weight
export function stepStats(steps, profile = {}) {
  const heightCm = profile.heightCm || 170;
  const weightKg = profile.weightKg || 70;
  const km = (steps * heightCm * 0.415) / 100_000; // stride is about 41.5% of height
  const kcal = steps * 0.04 * (weightKg / 70); // about 0.04 kcal per step at 70 kg
  return { km: Math.round(km * 10) / 10, kcal: Math.round(kcal) };
}
