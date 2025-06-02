
import { useEffect } from 'react';
import useLocalStorage from './useLocalStorage';
import { AppSettings } from '../types';
import { LOCAL_STORAGE_KEYS, DEFAULT_SETTINGS } from '../constants';

export function useTheme(): [AppSettings['theme'], (theme: AppSettings['theme']) => void] {
  const [settings, setSettings] = useLocalStorage<AppSettings>(LOCAL_STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);

  const setTheme = (theme: AppSettings['theme']) => {
    setSettings(prevSettings => ({ ...prevSettings, theme }));
  };
  
  const currentTheme = settings.theme;

  useEffect(() => {
    const root = window.document.documentElement; // Target <html> element
    const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (currentTheme === 'light') {
      root.classList.remove('dark');
      // console.log('Theme applied to <html>: light');
    } else if (currentTheme === 'dark') {
      root.classList.add('dark');
      // console.log('Theme applied to <html>: dark');
    } else { // currentTheme === 'system'
      if (isSystemDark) {
        root.classList.add('dark');
        // console.log('Theme applied to <html>: system (effective dark)');
      } else {
        root.classList.remove('dark');
        // console.log('Theme applied to <html>: system (effective light)');
      }
    }
  }, [currentTheme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      if (settings.theme === 'system') {
        const root = window.document.documentElement; // Target <html> element
        if (mediaQuery.matches) {
          root.classList.add('dark');
          // console.log('System theme changed to dark, applying dark class to <html>');
        } else {
          root.classList.remove('dark');
          // console.log('System theme changed to light, removing dark class from <html>');
        }
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [settings.theme]);

  return [currentTheme, setTheme];
}