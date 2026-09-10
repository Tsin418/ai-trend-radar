const PUBLISH_DATA_BASE = 'https://raw.githubusercontent.com/Tsin418/ai-trend-radar/publish/data';

type ImportMetaWithEnv = ImportMeta & { env?: Record<string, string | undefined> };

function envValue(key: string): string | undefined {
	return (import.meta as ImportMetaWithEnv).env?.[key];
}

function radarDataUrlCandidates(envKey: string | undefined, localPath: string): string[] {
	const candidates = [
		envKey ? envValue(envKey)?.trim() : undefined,
		`${PUBLISH_DATA_BASE}/${localPath.replace(/^\/data\//, '')}`,
		localPath,
	];
	return candidates.filter((url): url is string => Boolean(url));
}

// Runtime data lives on the publish branch; the bundled /data copies are
// build-time snapshots. Try the env override, then the publish branch raw
// URL, then the bundled copy.
export async function fetchRadarData(
	localPath: string,
	options: { envKey?: string; accept?: string } = {}
): Promise<Response | null> {
	const { envKey, accept = 'application/json' } = options;
	for (const url of radarDataUrlCandidates(envKey, localPath)) {
		try {
			const response = await fetch(url, { headers: { Accept: accept } });
			if (response.ok) return response;
		} catch {
			// try the next candidate
		}
	}
	return null;
}
