import { IndexerSettings, TransmissionSettings } from "../../../common/settings";
import type { WebPushSubscription } from '../../../common/user';

interface BrowserPushSubscription {
    toJSON(): {
        endpoint?: string;
        expirationTime?: number | null;
        keys?: Record<string, string>;
    };
}

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
export async function getPullAuto(): Promise<boolean> {
    const response = await fetch(`/api/settings/pull-auto`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    return Boolean(data.pullAuto);
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

export async function updatePullAuto(pullAuto: boolean) {
    const response = await fetch(`/api/settings/pull-auto`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pullAuto: pullAuto }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update pull auto setting');
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
        body: JSON.stringify({ language: language }),
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
        body: JSON.stringify({ spoiler: spoiler }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update spoiler setting');
    }
}
export async function configureDiscord(settings: { webhookUrl: string }) {
    const response = await fetch(`/api/settings/discord`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to configure Discord settings');
    }
}

export async function getWebPushSettings() {
    const response = await fetch('/api/settings/web-push', { credentials: 'include' });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load web push settings');
    }
    return response.json() as Promise<{
        publicKey: string;
        subscriptions: WebPushSubscription[];
    }>;
}

export async function addWebPushBrowser(name: string, subscription: BrowserPushSubscription) {
    const response = await fetch('/api/settings/web-push', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, subscription: subscription.toJSON() }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add browser');
    }
    return response.json() as Promise<{ subscription: WebPushSubscription }>;
}

export async function removeWebPushBrowser(subscriptionId: string) {
    const response = await fetch(`/api/settings/web-push/${encodeURIComponent(subscriptionId)}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove browser');
    }
}