import { IndexerSettings, TransmissionSettings } from "../../../common/settings";


export async function isTmdbConfigure(): Promise<boolean> {
    const response = await fetch(`/api/tmdb/configure`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
    });
    if (response.ok) {
        const data = await response.json();
        if (data.ok) {
            return true;
        }
    }
    return false;
}

export async function configureTmdb(tmdbApiKey: string) {
    const response = await fetch(`/api/tmdb/configure`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: tmdbApiKey }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to configure TMDB API key');
    }
}

export async function configureTransmission(settings: TransmissionSettings) {
    const response = await fetch(`/api/transmission/configure`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to configure Transmission settings');
    }
}

export async function configureIndexer(settings: IndexerSettings) {
    const response = await fetch(`/api/indexer/configure`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to configure Indexer settings');
    }
}

export async function updateLanguage(language: string) {
    const response = await fetch(`/api/settings/language`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({language: language}),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update language setting');
    }
}

export async function updateSpoilerMode(spoiler: boolean) {
    const response = await fetch(`/api/settings/spoiler`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({spoiler: spoiler}),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update spoiler setting');
    }
}