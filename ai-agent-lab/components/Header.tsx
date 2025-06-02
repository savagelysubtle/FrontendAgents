import React from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import Button from './Button';
import SunIcon from './icons/SunIcon';
import MoonIcon from './icons/MoonIcon';
import { AppSettings } from '../types';

interface HeaderProps {
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  const location = useLocation();
  const [theme, setTheme] = useTheme();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path.startsWith('/agents')) return 'Agents Management';
    if (path.startsWith('/tools')) return 'Tools Management';
    if (path.startsWith('/assistant')) return 'AI Assistant';
    if (path.startsWith('/settings')) return 'Application Settings';
    return 'AI Agent Lab';
  };

  const toggleTheme = () => {
    let newTheme: AppSettings['theme'];
    if (theme === 'light') newTheme = 'dark';
    else if (theme === 'dark') newTheme = 'system';
    else newTheme = 'light';
    setTheme(newTheme);
  };
  
  const getThemeIcon = () => {
    if (theme === 'light') return <MoonIcon className="w-5 h-5" />;
    if (theme === 'dark') return <SunIcon className="w-5 h-5" />; // Icon to switch to System (often sun)
    // System theme - show icon for current effective theme
    const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isSystemDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />;
  };

  const getThemeTooltip = () => {
    if (theme === 'light') return 'Switch to Dark Theme';
    if (theme === 'dark') return 'Switch to System Theme';
    return 'Switch to Light Theme';
  };


  return (
    <header className="sticky top-0 z-20 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Mobile menu button */}
          <div className="lg:hidden">
            <Button variant="ghost" onClick={toggleSidebar} aria-label="Open sidebar">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] hidden sm:block">{getPageTitle()}</h1>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={toggleTheme} aria-label={getThemeTooltip()} title={getThemeTooltip()}>
              {getThemeIcon()}
            </Button>
            {/* Placeholder for user profile or other actions */}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;