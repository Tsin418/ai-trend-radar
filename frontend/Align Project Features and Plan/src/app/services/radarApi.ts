import { latestDailyDashboardToRadarDigest } from '../adapters/latestDailyDashboardAdapter';
import { fetchRadarData } from './radarDataSources';
import type { LatestDailyDashboardFile } from '../types/dashboard';
import type { RadarDigest } from '../types/radar';

const DEFAULT_DASHBOARD_URL = '/data/latest-daily-dashboard.json';

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
  const response = await fetchRadarData(DEFAULT_DASHBOARD_URL, { envKey: 'VITE_RADAR_DASHBOARD_URL' });

  if (!response) {
    throw new Error(`Failed to load dashboard JSON from ${DEFAULT_DASHBOARD_URL}: no data source responded.`);
  }

  const json = await response.json() as unknown;
  assertLatestDailyDashboardFile(json);
  return latestDailyDashboardToRadarDigest(json);
}
