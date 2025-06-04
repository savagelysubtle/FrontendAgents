import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import { Theme } from '../types';
import { APP_NAME } from '../constants';

const SunIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-6.364-.386l1.591-1.591M3 12h2.25m.386-6.364l1.591 1.591" />
  </svg>
);

const MoonIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
  </svg>
);

const MenuIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
);


const Header: React.FC = () => {
  const { theme, toggleTheme, currentError, toggleMainSidebar, isMainSidebarCollapsed, mcpServerStatus } = useAppContext();

  const getMcpStatusIndicator = () => {
    if (!mcpServerStatus) return null;

    let color = 'bg-yellow-500'; // Default to yellow for initializing or unknown states
    let titleText = `MCP Server: ${mcpServerStatus.error || 'Initializing...'}`;

    if (mcpServerStatus.isRunning) {
      color = 'bg-green-500';
      titleText = `MCP Server: Running (Version: ${mcpServerStatus.version || 'Unknown'})`;
    } else if (mcpServerStatus.error && !mcpServerStatus.isRunning) {
      color = 'bg-red-500';
      titleText = `MCP Server Error: ${mcpServerStatus.error}`;
    } else if (!mcpServerStatus.isRunning) {
      // Still yellow, but potentially different message if error is empty
      titleText = `MCP Server: Not Running (Status: ${mcpServerStatus.error || 'Not Connected'})`;
    }


    return (
      <div className="flex items-center space-x-2" title={titleText}>
        <span className={`w-3 h-3 rounded-full ${color}`}></span>
        <span className="text-xs text-textSecondary hidden sm:inline">
          {mcpServerStatus.isRunning ? `MCP: Online` : (mcpServerStatus.error ? 'MCP: Error' : 'MCP: Offline')}
        </span>
      </div>
    );
  };

  return (
    <header className="bg-surface shadow-md p-4 sticky top-0 z-40 border-b border-border">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-3">
            <button
                onClick={toggleMainSidebar}
                className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-textPrimary"
                aria-label={isMainSidebarCollapsed ? 'Open sidebar' : 'Close sidebar'}
            >
                <MenuIcon />
            </button>
            <h1 className="text-2xl font-bold text-primary">{APP_NAME}</h1>
        </div>
        <div className="flex items-center space-x-4">
          {getMcpStatusIndicator()}
          {currentError && (
            <div className="text-red-500 text-xs p-1 bg-red-100 dark:bg-red-900 dark:text-red-300 rounded border border-red-500 max-w-xs truncate" title={currentError}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 inline mr-1">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              {currentError.length > 30 ? `${currentError.substring(0, 27)}...` : currentError}
            </div>
          )}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-textPrimary"
            aria-label={theme === Theme.Light ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            {theme === Theme.Light ? <MoonIcon /> : <SunIcon />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
