export function maskEpisodeLabel(value: string): string {
  return String(value || '').replace(/(S\d{1,2}E\d{1,2})(?:\s*[-–]\s*[^:\n]+)?/i, '$1');
}

export function getSafeNotificationMessage(
  message: string,
  spoilerModeEnabled: boolean,
  mediaType?: unknown,
): string {
  if (!spoilerModeEnabled || (mediaType !== undefined && String(mediaType || '') !== 'episode')) {
    return message;
  }

  return maskEpisodeLabel(message);
}

