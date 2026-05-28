import { latestDailyDashboardToRadarDigest } from '../adapters/latestDailyDashboardAdapter';
import type { LatestDailyDashboardFile } from '../types/dashboard';
import type { RadarDigest } from '../types/radar';

const DEFAULT_DASHBOARD_URL = '/data/latest-daily-dashboard.json';

function dashboardUrl(): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return env?.VITE_RADAR_DASHBOARD_URL || DEFAULT_DASHBOARD_URL;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function assertLatestDailyDashboardFile(value: unknown): asserts value is LatestDailyDashboardFile {
  if (!isObject(value)) {
    throw new Error('Dashboard JSON is not an object.');
  }

  if (value.schemaVersion !== 1) {
    throw new Error(`Unsupported dashboard schemaVersion: ${String(value.schemaVersion)}.`);
  }

  if (value.mode !== 'daily') {
    throw new Error(`Unsupported dashboard mode: ${String(value.mode)}.`);
  }

  if (!Array.isArray(value.projects) || !isObject(value.sections) || !isObject(value.summary)) {
    throw new Error('Dashboard JSON is missing required projects, sections, or summary fields.');
  }
}

export async function fetchLatestRadarDigest(): Promise<RadarDigest> {
  const url = dashboardUrl();
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load dashboard JSON from ${url}: ${response.status} ${response.statusText}`);
  }

  const json = await response.json() as unknown;
  assertLatestDailyDashboardFile(json);
  return latestDailyDashboardToRadarDigest(json);
}
