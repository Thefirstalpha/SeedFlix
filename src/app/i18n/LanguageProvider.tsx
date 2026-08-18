import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import en from './locales/en';
import fr from './locales/fr';

export type SupportedLanguage = 'fr' | 'en';


// Utilitaire pour générer toutes les clés possibles d'un objet imbriqué
type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}.${P}`
    : never
  : never;

type Leaves<T, Prev extends string = ''> = {
  [K in keyof T]:
    T[K] extends string
      ? Prev extends ''
        ? K & string
        : Join<Prev, K & string>
      : T[K] extends Record<string, any>
        ? Leaves<T[K], Prev extends '' ? K & string : Join<Prev, K & string>>
        : never;
}[keyof T];


type I18nKey = Leaves<I18nMessages>;

type DictionaryValue = string | Record<string, any>;
type Dictionary = Record<string, DictionaryValue>;

export type Translator = (key: I18nKey, vars?: Record<string, string | number>) => string;

type I18nContextValue = {
  language: SupportedLanguage;
  setLanguage: (nextLanguage: SupportedLanguage) => void;
  t: Translator;
  availableLanguages: Array<{ code: SupportedLanguage; label: string }>;
};

const dictionaries: Record<SupportedLanguage, Dictionary> = {
  fr: fr as unknown as Dictionary,
  en: en as unknown as Dictionary,
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function resolveKey(dictionary: Dictionary, key: string): string {
  const value = key.split('.').reduce<DictionaryValue | undefined>((acc, segment) => {
    if (!acc || typeof acc === 'string') {
      return undefined;
    }

    return acc[segment];
  }, dictionary);

  return typeof value === 'string' ? value : key;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) {
    return template;
  }

  return template.replace(/\{\{(.*?)\}\}/g, (_match, token) => {
    const key = String(token || '').trim();
    return key in vars ? String(vars[key]) : '';
  });
}

function parseSupportedLanguage(input: unknown): SupportedLanguage {
  if (input === 'en') {
    return 'en';
  }

  return 'fr';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [language, setLanguage] = useState<SupportedLanguage>('fr');

  useEffect(() => {
    const settingsLanguage = parseSupportedLanguage(
      (user?.settings?.language as string | undefined),
    );
    setLanguage(settingsLanguage);
  }, [user]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key, vars) => {
        const dictionary = dictionaries[language] || dictionaries.fr;
        return interpolate(resolveKey(dictionary, key), vars);
      },
      availableLanguages: [
        { code: 'fr', label: 'Francais' },
        { code: 'en', label: 'English' },
      ],
    }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within LanguageProvider');
  }

  return context;
}

export interface I18nMessages {
  common: {
    appName: string;
    save: string;
    saving: string;
    cancel: string;
    close: string;
    copy: string;
    copied: string;
    remove: string;
    delete: string;
    loading: string;
  };
  auth: {
    adminRequired: string;
    usernameRequired: string;
    passwordRequired: string;
    newPasswordTooShort: string;
    usernameAlreadyExists: string;
    userNotFound: string;
    cannotDeleteAdmin: string;
    cannotModifyAdmin: string;
    invalidJsonPayload: string;
    failedListUsers: string;
    failedCreateUser: string;
    failedDeleteUser: string;
    failedResetUserPassword: string;
  };
  root: {
    downloads: string;
    wishlist: string;
    notifications: string;
    settings: string;
    logout: string;
    openMenu: string;
    copyright: string;
    footer: string;
    toasts: {
      oneNew: string;
      manyNew: string;
      updatesAvailable: string;
    };
  };
  login: {
    title: string;
    description: string;
    username: string;
    password: string;
    submit: string;
    submitting: string;
    failed: string;
  };
  setup: {
    badge: string;
    title: string;
    preparing: string;
    steps: {
      legal: string;
      security: string;
      tmdb: string;
      torrent: string;
      indexer: string;
    };
    progress: string;
    stepLabel: string;
    password: {
      description: string;
      cardTitleUser: string;
      cardDescriptionUser: string;
      currentPassword: string;
      newPassword: string;
      confirm: string;
      minimum: string;
      saveAndContinue: string;
      errors: {
        required: string;
        mismatch: string;
        updateFailed: string;
      };
    };
    tmdb: {
      cardTitle: string;
      cardDescription: string;
      keyLabel: string;
      documentation: string;
      placeholder: string;
      helper: string;
      testing: string;
      saveAndContinue: string;
      errors: {
        required: string;
        configFailed: string;
      };
    };
    torrent: {
      cardTitle: string;
      cardDescription: string;
      url: string;
      urlPlaceholder: string;
      port: string;
      portPlaceholder: string;
      authRequired: string;
      authDescription: string;
      username: string;
      password: string;
      moviesFolder: string;
      moviesFolderPlaceholder: string;
      seriesFolder: string;
      seriesFolderPlaceholder: string;
      testing: string;
      testAndContinue: string;
      errors: {
        urlPortRequired: string;
        credentialsRequired: string;
        configFailed: string;
      };
    };
    indexer: {
      cardTitle: string;
      cardDescription: string;
      url: string;
      urlPlaceholder: string;
      token: string;
      defaultQuality: string;
      allQualities: string;
      quality: {
        [key: string]: string;
      };
      testing: string;
      testAndFinish: string;
      errors: {
        urlTokenRequired: string;
        configFailed: string;
      };
      legalNote: string;
    };
    legal: {
      cardTitle: string;
      cardDescription: string;
      term1: string;
      term2: string;
      term3: string;
      term4: string;
      checkbox: string;
      accept: string;
    };
  };
  downloads: {
    title: string;
    activeSummary: string;
    loading: string;
    empty: string;
    filters: {
      label: string;
      active: string;
      completed: string;
      seedflixOnly: string;
      allTorrents: string;
      empty: string;
    };
    unknown: string;
    finished: string;
    rate: string;
    eta: string;
    peers: string;
    totalSize: string;
    remaining: string;
    ratio: string;
    added: string;
    managedBadge: string;
    unmanagedBadge: string;
    showRawDetails: string;
    hideRawDetails: string;
    rawDetails: string;
    errorPrefix: string;
    pause: string;
    resume: string;
    remove: string;
    dontTrack: string;
    loadFailed: string;
  };
  home: {
    emptySearch: string;
    emptyFilters: string;
    searchPlaceholder: string;
    searching: string;
    filters: string;
    show: string;
    hide: string;
    all: string;
    movies: string;
    series: string;
    allGenres: string;
    allLanguages: string;
    minYear: string;
    maxYear: string;
    allRatings: string;
    minRating: string;
    popularMovies: string;
    popularSeries: string;
    noMoviesMatch: string;
    noSeriesMatch: string;
    languages: {
      french: string;
      english: string;
      japanese: string;
      korean: string;
      spanish: string;
      italian: string;
      german: string;
      portuguese: string;
      russian: string;
      chinese: string;
      unknown: string;
    };
  };
  movieDetails: {
    notFoundTitle: string;
    backHome: string;
    back: string;
    addToWishlist: string;
    removeFromWishlist: string;
    votes: string;
    synopsis: string;
    director: string;
    cast: string;
    messages: {
      duplicateTorrent: string;
      torrentAdded: string;
    };
    errors: {
      indexerSearchFailed: string;
      addTorrentFailed: string;
    };
    indexer: {
      title: string;
      quality: string;
      language: string;
      all: string;
      sort: string;
      date: string;
      size: string;
      searching: string;
      empty: string;
      adding: string;
      addToClient: string;
      qualityBadge: string;
      languageBadge: string;
      sizeBadge: string;
      seeders: string;
      peers: string;
      categories: string;
    };
    pagination: {
      previous: string;
      next: string;
      current: string;
      page: string;
    };
  };
  seriesDetails: {
    notFoundTitle: string;
    backHome: string;
    back: string;
    addSeries: string;
    removeSeries: string;
    unknownStatus: string;
    votes: string;
    synopsis: string;
    creatorsAndNetworks: string;
    creatorsLabel: string;
    networksLabel: string;
    seasonsLabel: string;
    seasonsAndEpisodes: string;
    season: string;
    seasonWithName: string;
    coveredBySeries: string;
    addSeason: string;
    removeSeason: string;
    episodeNumber: string;
    unknownDate: string;
    covered: string;
    addEpisode: string;
    removeEpisode: string;
    spoilers: {
      hiddenTitle: string;
      clickToReveal: string;
      noOverview: string;
    };
    episodesUnavailable: string;
    noSeasonInfo: string;
    notAvailable: string;
    messages: {
      duplicateTorrent: string;
      torrentAdded: string;
    };
    errors: {
      indexerSearchFailed: string;
      addTorrentFailed: string;
    };
    indexer: {
      title: string;
      description: string;
      quality: string;
      language: string;
      all: string;
      sort: string;
      date: string;
      size: string;
      searching: string;
      empty: string;
      adding: string;
      addToClient: string;
      qualityBadge: string;
      languageBadge: string;
      sizeBadge: string;
      seeders: string;
      peers: string;
    };
    pagination: {
      previous: string;
      next: string;
      current: string;
      page: string;
    };
  };
  wishlistPage: {
    title: string;
    summary: {
      movies_one: string;
      movies_many: string;
      series_one: string;
      series_many: string;
    };
    tabs: {
      movies: string;
      series: string;
    };
    actions: {
      manage: string;
      selectAll: string;
      deselectAll: string;
      removeCount: string;
    };
    movies: {
      title: string;
      emptyTitle: string;
      emptyDescription: string;
      discover: string;
    };
    series: {
      title: string;
      fullFavorite: string;
      partialFavorite: string;
      selectWhole: string;
      fullSeries: string;
      seasons: string;
      seasonNumber: string;
      episodes: string;
      emptyTitle: string;
      emptyDescription: string;
      discover: string;
    };
    indexerResults: {
      title: string;
      count: string;
      empty: string;
      actions: {
        add: string;
        adding: string;
        correct: string;
        reject: string;
        rejectAll: string;
        rejectingAll: string;
      };
    };
  };
  notificationsPage: {
    unread_one: string;
    unread_many: string;
    markAllRead: string;
    reject: string;
    clearAll: string;
    confirmClearTitle: string;
    confirmClearDescription: string;
    loading: string;
    empty: string;
    new: string;
    markAsRead: string;
    types: {
      success: string;
      error: string;
      warning: string;
      search: string;
      info: string;
    };
  };
  settings: {
    title: string;
    tabs: {
      general: string;
      configuration: string;
      notifications: string;
      users: string;
      database: string;
      factory: string;
      storage: string;
    };
    storage: {
      description: string;
    };
    about: {
      versionLabel: string;
    };
    preferences: {
      title: string;
      description: string;
      saved: string;
      failed: string;
    };
    spoilers: {
      title: string;
      description: string;
      toggleLabel: string;
      toggleHelp: string;
      save: string;
      saved: string;
      failed: string;
    };
    language: {
      title: string;
      description: string;
      field: string;
      french: string;
      save: string;
      success: string;
      failed: string;
    };
    messages: {
      loadFailed: string;
      passwordUpdated: string;
      updateFailed: string;
      tmdbKeyRequired: string;
      tmdbSaved: string;
      configFailed: string;
      savedButTestFailed: string;
      configurationFailed: string;
      discordWebhookRequired: string;
      discordConfigured: string;
      browserUnsupported: string;
      browserPermissionDenied: string;
      browserSaved: string;
      browserConfigFailed: string;
      browserRemoved: string;
      browserRemoveFailed: string;
      resetFailed: string;
      testNotificationSent: string;
      testNotificationFailed: string;
      configurationSaved: string;
    };
    security: {
      title: string;
      lastChange: string;
      unknown: string;
      changePasswordSuggestion: string;
      currentPassword: string;
      newPassword: string;
      update: string;
    };
    api: {
      common: {
        saveAndTest: string;
        savingAndTesting: string;
      };
      tmdb: {
        title: string;
        description: string;
        apiToken: string;
        placeholder: string;
        save: string;
      };
      torrent: {
        title: string;
        description: string;
        url: string;
        port: string;
        authRequired: string;
        username: string;
        password: string;
        moviesFolder: string;
        seriesFolder: string;
      };
      indexer: {
        title: string;
        description: string;
        url: string;
        token: string;
        defaultQuality: string;
        defaultLanguage: string;
      };
    };
    notifications: {
      title: string;
      description: string;
      discord: {
        title: string;
        description: string;
        enabled: string;
        configure: string;
        webhookLabel: string;
        webhookHelp: string;
        testing: string;
        testAndSave: string;
        testTitle: string;
        testDescription: string;
        testFooter: string;
      };
      browser: {
        title: string;
        description: string;
        devicePlaceholder: string;
        add: string;
        none: string;
        current: string;
        registered: string;
      };
      test: {
        title: string;
        description: string;
        sending: string;
        trigger: string;
      };
    };
    users: {
      title: string;
      description: string;
      createNew: string;
      createDescription: string;
      passwordGeneratedOnCreate: string;
      generatePassword: string;
      username: string;
      password: string;
      passwordMinLength: string;
      create: string;
      managingUsers: string;
      noUsers: string;
      resetPassword: string;
      resetButton: string;
      resetPasswordTitle: string;
      resetPasswordDescription: string;
      passwordGeneratedOnReset: string;
      generatedPasswordTitle: string;
      generatedPasswordDescription: string;
      generatedPasswordDescriptionReset: string;
      newPassword: string;
      confirmDeleteTitle: string;
      confirmDeleteDescription: string;
      userCreated: string;
      userDeleted: string;
      passwordReset: string;
    };
    database: {
      title: string;
      description: string;
      warning: string;
      namespaces: string;
      refreshList: string;
      empty: string;
      noSelection: string;
      updatedAt: string;
      rawEditor: string;
      reload: string;
      prettyFormat: string;
      reloaded: string;
      listReloaded: string;
      saved: string;
      loadFailed: string;
      entryLoadFailed: string;
      saveFailed: string;
      invalidJson: string;
    };
    factory: {
      title: string;
      description: string;
      resetting: string;
      reset: string;
      confirmTitle: string;
      confirmDescription: string;
      confirmAction: string;
    };
  };
}

