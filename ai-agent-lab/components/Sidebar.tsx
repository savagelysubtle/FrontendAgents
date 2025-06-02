import React from 'react';
import { NavLink } from 'react-router-dom';
import HomeIcon from './icons/HomeIcon';
import AgentIcon from './icons/AgentIcon';
import ToolIcon from './icons/ToolIcon';
import ChatIcon from './icons/ChatIcon';
import SettingsIcon from './icons/SettingsIcon';
// import { ACCENT_COLOR } from '../constants'; // ACCENT_COLOR not directly needed if CSS vars are used

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const navItems = [
  { path: '/', label: 'Home', icon: HomeIcon },
  { path: '/agents', label: 'Agents', icon: AgentIcon },
  { path: '/tools', label: 'Tools', icon: ToolIcon },
  { path: '/assistant', label: 'Assistant', icon: ChatIcon },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar }) => {
  const commonLinkClasses = "flex items-center px-3 py-3 rounded-md text-sm font-medium transition-colors duration-150";
  
  const inactiveLinkClasses = `text-[var(--text-secondary)] hover:bg-[var(--button-ghost-neutral-hover-bg)] hover:text-[var(--text-primary)]`;
  const activeLinkClasses = `bg-[var(--accent-bg)] text-[var(--accent-text-on-bg)]`;

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black opacity-50 lg:hidden"
          onClick={toggleSidebar}
        ></div>
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[var(--card-background)] border-r border-[var(--border-primary)] shadow-xl transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}
      >
        <div className="flex items-center justify-center h-16 border-b border-[var(--border-primary)]">
          <span className={`text-2xl font-bold text-[var(--accent-text)]`}>AgentLab</span>
        </div>
        <nav className="flex-grow p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `${commonLinkClasses} ${isActive ? activeLinkClasses : inactiveLinkClasses}`
              }
              onClick={isOpen && window.innerWidth < 1024 ? toggleSidebar : undefined} // Close sidebar on mobile nav click
            >
              <item.icon className="h-5 w-5 mr-3" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;