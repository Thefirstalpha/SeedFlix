import path from 'node:path';

const configuredDataDir = process.env.SEEDFLIX_DATA_DIR?.trim();
const dataDir = configuredDataDir || path.resolve(process.cwd(), 'data');

export const config = {
  sessionDurationMs: 1000 * 60 * 60 * 24 * 14,
  dataDir,
  databasePath: path.join(dataDir, 'seedflix.db'),
};
