import { readStore, runInTransaction } from "./db";

interface GlobalConfig {
    tmdbApiKey: string | null;
}

export function readGlobalConfig(): GlobalConfig {
    const config = readStore('global_config', 0);
    return {
        tmdbApiKey: config?.tmdbApiKey || null
    }
}

export function updateGlobalConfig(newConfig: Partial<GlobalConfig>) {
    return runInTransaction(({ writeStore }) => {
        const currentConfig = readGlobalConfig();
        const updatedConfig = { ...currentConfig, ...newConfig };
        writeStore('global_config', 0, updatedConfig);
    });
}

export async function getTmdbApiKey() {
    const config = await readGlobalConfig();
    if (config.tmdbApiKey) {
        return config.tmdbApiKey;
    }

    return null;
}