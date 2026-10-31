import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { de, type Messages } from './de';
import { en } from './en';

export type { Messages };

export type Locale = 'de' | 'en';

/** Order in which the switcher renders the languages. */
export const LOCALES: readonly Locale[] = ['de', 'en'];

const CATALOGS: Record<Locale, Messages> = { de, en };

/** Native names for the switcher; `short` is the compact header label. */
export const LOCALE_META: Record<Locale, { name: string; short: string }> = {
  de: { name: 'Deutsch', short: 'DE' },
  en: { name: 'English', short: 'EN' },
};

const LOCALE_KEY = 'kontur.locale.v1';
const DEFAULT_LOCALE: Locale = 'de';

function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

function readStoredLocale(): Locale | null {
  try {
    const raw = window.localStorage.getItem(LOCALE_KEY);
    return isLocale(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeStoredLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // Storage can be unavailable (private mode, quota). The app keeps the
    // language for the running session only.
  }
}

/**
 * The stored choice wins. Otherwise the app stays German, which is the
 * documented default and the language the copy is written in; English is one
 * click away in the header and never appears unasked.
 */
function detectLocale(): Locale {
  return readStoredLocale() ?? DEFAULT_LOCALE;
}

/** Messages for the stored/detected locale, for code that cannot use hooks. */
export function currentMessages(): Messages {
  return CATALOGS[detectLocale()];
}

interface LocaleContextValue {
  locale: Locale;
  messages: Messages;
  setLocale: (next: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const setLocale = useCallback((next: Locale) => {
    if (!isLocale(next)) return;
    setLocaleState(next);
    writeStoredLocale(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, messages: CATALOGS[locale], setLocale }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used inside <LocaleProvider>.');
  }
  return context;
}

/** The copy for the active language. */
export function useMessages(): Messages {
  return useLocale().messages;
}

/**
 * Locale-aware number formatting. Counts, byte sizes and seconds are passed to
 * the message functions as ready-made strings, so they need the active locale
 * rather than a hardcoded one.
 */
export function useNumberFormat(): {
  number: (value: number) => string;
  decimal: (value: number) => string;
} {
  const { locale } = useLocale();
  return useMemo(() => {
    const integer = new Intl.NumberFormat(locale);
    const fixed = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return {
      number: (value: number) => integer.format(value),
      decimal: (value: number) => fixed.format(value),
    };
  }, [locale]);
}
