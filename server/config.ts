import path from "node:path";

export const config = {
    sessionDurationMs: 1000 * 60 * 60 * 24 * 14,
    dataDir: 'data',
    databasePath: path.join('data', 'seedflix.db')
};