import path from "node:path";
import pino from "pino";

export const config = {
    sessionDurationMs: 1000 * 60 * 60 * 24 * 14,
    dataDir: 'data',
    databasePath: path.join('data', 'seedflix.db')
};



export const logger = pino();