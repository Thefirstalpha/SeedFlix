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