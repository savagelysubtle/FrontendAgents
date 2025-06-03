import { useEffect, useState, useCallback } from 'react';
import useLocalStorage from './useLocalStorage';
import { AppSettings } from '../types';
import { LOCAL_STORAGE_KEYS, DEFAULT_SETTINGS } from '../constants';

// Define the type for the effective theme (always light or dark)
export type EffectiveTheme = 'light' | 'dark';

// Updated return signature:
// 1. themePreference: The stored preference ('light', 'dark', 'system')
// 2. effectiveTheme: The currently applied visual theme ('light' or 'dark')
// 3. setTheme: Function to update the theme preference
export function useTheme(): [
  AppSettings['theme'],
  EffectiveTheme,
  (theme: AppSettings['theme']) => void
] {
  const [settings, setSettings] = useLocalStorage<AppSettings>(
    LOCAL_STORAGE_KEYS.SETTINGS,
    DEFAULT_SETTINGS
  );
  const themePreference = settings.theme;

  // State to hold the effective theme, resolved from 'system' if necessary
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>(() => {
    if (themePreference === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    // If preference is 'light' or 'dark', that's the effective theme
    return themePreference as EffectiveTheme;
  });

  // Memoized setTheme function to update the stored theme preference
  const setTheme = useCallback((newThemePreference: AppSettings['theme']) => {
    setSettings(prevSettings => ({ ...prevSettings, theme: newThemePreference }));
  }, [setSettings]);

  // Effect to apply theme to DOM and update effectiveTheme when themePreference changes
  useEffect(() => {
    const root = window.document.documentElement;
    const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let newCalculatedEffectiveTheme: EffectiveTheme;

    if (themePreference === 'light') {
      root.classList.remove('dark');
      newCalculatedEffectiveTheme = 'light';
    } else if (themePreference === 'dark') {
      root.classList.add('dark');
      newCalculatedEffectiveTheme = 'dark';
    } else { // themePreference === 'system'
      if (isSystemDark) {
        root.classList.add('dark');
        newCalculatedEffectiveTheme = 'dark';
      } else {
        root.classList.remove('dark');
        newCalculatedEffectiveTheme = 'light';
      }
    }

    // Update the effectiveTheme state if it has changed
    if (effectiveTheme !== newCalculatedEffectiveTheme) {
        setEffectiveTheme(newCalculatedEffectiveTheme);
    }
  }, [themePreference, effectiveTheme]); // Rerun if themePreference changes or to correct effectiveTheme

  // Effect to listen for OS theme changes and update DOM + effectiveTheme if preference is 'system'
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (event: MediaQueryListEvent) => {
      // Only act if the current preference is 'system'
      if (themePreference === 'system') {
        const root = window.document.documentElement;
        const newSystemEffectiveTheme: EffectiveTheme = event.matches ? 'dark' : 'light';

        if (event.matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
        setEffectiveTheme(newSystemEffectiveTheme);
      }
    };

    // Add listener only if current preference is 'system'
    if (themePreference === 'system') {
      mediaQuery.addEventListener('change', handleChange);
    }

    // Cleanup listener
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
    // This effect's setup/cleanup should re-run if themePreference changes.
    // setEffectiveTheme is stable and not needed in the dependency array.
  }, [themePreference]); // Dependency updated

  return [themePreference, effectiveTheme, setTheme];
}