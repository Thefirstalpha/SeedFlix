export const port = Number(process.env.PORT || 4000);
export const tmdbApiKey = process.env.TMDB_API_KEY;
export const appImageTag = String(process.env.APP_IMAGE_TAG || 'dev').trim() || 'dev';
export const tmdbBaseUrl = 'https://api.themoviedb.org/3';
export const authCookieName = 'seedflix_session';
export const sessionDurationMs = 1000 * 60 * 60 * 24 * 7;
export const isDebugMode =
  process.argv.includes('--debug') ||
  ['1', 'true', 'yes', 'on'].includes(String(process.env.DEBUG || '').toLowerCase());
export const isRequestLogEnabled = !['0', 'false', 'no', 'off'].includes(
  String(process.env.REQUEST_LOGS || 'true').toLowerCase(),
);
export const dataDir = 'data';
export const defaultSettingsFilePath = 'server/defaultSettings.json';
