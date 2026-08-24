import path from 'node:path';

const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

const configuredDataDir = isTest
  ? (process.env.SEEDFLIX_TEST_DATA_DIR?.trim() || path.resolve(process.cwd(), 'data', 'test'))
  : (process.env.SEEDFLIX_DATA_DIR?.trim() || path.resolve(process.cwd(), 'data'));

const dataDir = configuredDataDir;

const databaseFileName = isTest
  ? 'seedflix_test.db'
  : 'seedflix.db';

export const config = {
  sessionDurationMs: 1000 * 60 * 60 * 24 * 14,
  dataDir,
  databasePath: path.join(dataDir, databaseFileName),
  isTest,
};

