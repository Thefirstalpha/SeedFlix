export interface BrowserNotificationDevice {
  id: string;
  name: string;
  createdAt: string;
}

const BROWSER_DEVICE_ID_KEY = 'seedflix:browser-device-id';

function safeWindow(): Window | null {
  return typeof window === 'undefined' ? null : window;
}

export function getOrCreateBrowserDeviceId(): string {
  const win = safeWindow();
  if (!win) {
    return '';
  }

  const existing = win.localStorage.getItem(BROWSER_DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const generated =
    typeof win.crypto?.randomUUID === 'function'
      ? win.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  win.localStorage.setItem(BROWSER_DEVICE_ID_KEY, generated);
  return generated;
}

export function getDefaultBrowserDeviceName(): string {
  if (typeof navigator === 'undefined') {
    return 'Navigateur';
  }

  const platform = String(navigator.platform || '').trim();
  const appName = String(navigator.appName || 'Navigateur').trim();
  return platform ? `${appName} - ${platform}` : appName;
}

export function parseBrowserDevices(value: unknown): BrowserNotificationDevice[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const id = String((entry as { id?: unknown }).id || '').trim();
      const name = String((entry as { name?: unknown }).name || '').trim();
      const createdAtRaw = String((entry as { createdAt?: unknown }).createdAt || '').trim();
      const createdAt = createdAtRaw || new Date().toISOString();

      if (!id || !name) {
        return null;
      }

      return { id, name, createdAt };
    })
    .filter((entry): entry is BrowserNotificationDevice => Boolean(entry));
}
