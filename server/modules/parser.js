// Enum of quality options
const QUALITY_MAP = {
  '.2160p.': '2160p',
  '.1080p.': '1080p',
  '.720p.': '720p',
  '.480p.': '480p',
  '.sd.': '480p',
};

const SOURCE_MAP = {
  '.web-dl.': 'WEB',
  '.webrip.': 'WEBRip',
  '.hdrip.': 'HDRip',
  '.bdrip.': 'BDRip',
  '.dvdrip.': 'DVDRip',
  '.hdtv.': 'HDTV',
  '.sdtv.': 'SDTV',
  '.bluray.': 'BluRay',
  '.web.': 'WEB',
};

const LANGUAGE_MAP = {
  '.vff.': 'VFF',
  '.vf2.': 'VF2',
  '.vfq.': 'VFQ',
  '.vostfr.': 'VOSTFR',
  '.truefrench.': 'VFF',
  '.multi.': 'MULTI',
};

export function extractQuality(title) {
  const normalized = String(title || '').toLowerCase();
  for (const option in QUALITY_MAP) {
    if (normalized.includes(option.toLowerCase())) {
      return QUALITY_MAP[option];
    }
  }
  return null;
}

export function extractSource(title) {
  const normalized = String(title || '').toLowerCase();
  for (const option in SOURCE_MAP) {
    if (normalized.includes(option.toLowerCase())) {
      return SOURCE_MAP[option];
    }
  }
  return null;
}

export function extractLanguage(title) {
  const normalized = String(title || '').toLowerCase();
  for (const option in LANGUAGE_MAP) {
    if (normalized.includes(option.toLowerCase())) {
      return LANGUAGE_MAP[option];
    }
  }
  return null;
}
