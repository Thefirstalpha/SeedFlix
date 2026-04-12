import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import en from './locales/en';
import fr from './locales/fr';

export type SupportedLanguage = 'fr' | 'en';

type DictionaryValue = string | Record<string, DictionaryValue>;
type Dictionary = Record<string, DictionaryValue>;

type I18nContextValue = {
  language: SupportedLanguage;
  setLanguage: (nextLanguage: SupportedLanguage) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
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
  const { settings } = useAuth();
  const [language, setLanguage] = useState<SupportedLanguage>('fr');

  useEffect(() => {
    const settingsLanguage = parseSupportedLanguage(
      (settings?.placeholders?.preferences as Record<string, unknown> | undefined)?.language,
    );
    setLanguage(settingsLanguage);
  }, [settings]);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key: string, vars?: Record<string, string | number>) => {
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
