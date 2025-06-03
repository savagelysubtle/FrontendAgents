
import React from 'react';
import { NavLink } from 'react-router-dom'; 
import { useAppContext } from '../contexts/AppContext'; // Import useAppContext

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label }) => (
  <NavLink
    to={to}
    end // Important for matching index routes exactly
    className={({ isActive }) =>
      `flex items-center space-x-3 p-3 rounded-lg hover:bg-primary-light hover:text-white transition-colors ${
        isActive ? 'bg-primary text-white shadow-lg' : 'text-textSecondary hover:text-textPrimary'
      }`
    }
  >
    {icon}
    <span className="font-medium">{label}</span>
  </NavLink>
);

// Icons
const DashboardIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h12M3.75 3h-1.5m1.5 0h16.5M3.75 3v11.25A2.25 2.25 0 005.25 16.5h13.5M3.75 12v8.25A2.25 2.25 0 006 22.5h12M3.75 12H21m-9 10.5h6M3.75 12H21" /></svg>;
const FileIngestionIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338 0 4.5 4.5 0 01-1.41 8.775H6.75z" /></svg>;
const DocViewerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>;
const TagExplorerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>;
const ChatAgentIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-3.86 8.25-8.625 8.25S3.75 16.556 3.75 12c0-4.556 3.86-8.25 8.625-8.25S21 7.444 21 12z" /></svg>;
const SearchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>;
const ExportIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>;
const SettingsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-1.003 1.11-.113l.271.271c.09.09.213.128.333.128h.214c.12 0 .243-.038.333-.128l.271-.271c.55-.89 1.02-.333 1.11.113l.049.296c.05.295.238.548.527.625l.296.049c.542.09.901.56.113 1.11l-.271.271c-.09.09-.128.213-.128.333v.214c0 .12.038.243.128.333l.271.271c.89.55.333 1.02-.113 1.11l-.296.049c-.295.05-.548.238-.625.527l-.049.296c-.09.542-.56 1.003-1.11-.113l-.271-.271c-.09-.09-.213-.128-.333-.128h-.214c-.12 0-.243.038-.333-.128l-.271-.271c-.55-.89-1.02-.333-1.11-.113l-.049-.296c-.05-.295-.238-.548-.527-.625l-.296-.049c-.542-.09-.901-.56-.113-1.11l.271.271c.09.09.128.213.128.333V9.9c0-.12-.038-.243-.128-.333l-.271-.271c-.89-.55-.333-1.02.113-1.11l.296-.049c.295-.05.548.238.625.527l.049-.296zM12 15a3 3 0 100-6 3 3 0 000 6z" /></svg>;

const WcatIcon: React.FC<{ transform?: string; className?: string }> = ({ transform, className }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24" 
        strokeWidth={1.5} 
        stroke="currentColor" 
        className={className || "w-6 h-6"} 
        transform={transform}
    >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
);
const PolicyIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9" /></svg>;
const PatternIcon = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" /></svg>;


const Sidebar: React.FC = () => {
  const { isMainSidebarCollapsed } = useAppContext();
  return (
    <aside 
      className={`
        w-64 bg-surface h-screen p-4 space-y-1 border-r border-border 
        fixed top-0 left-0 pt-20 flex flex-col z-30 
        transition-transform duration-300 ease-in-out
        ${isMainSidebarCollapsed ? '-translate-x-full' : 'translate-x-0'}
      `}
    > {/* Adjust pt if header height changes */}
      <nav className="flex flex-col space-y-1">
        <NavItem to="/" icon={<DashboardIcon />} label="Dashboard" />
        <NavItem to="/ingestion" icon={<FileIngestionIcon />} label="File Ingestion" />
        <NavItem to="/viewer" icon={<DocViewerIcon />} label="Document Viewer" />
        <NavItem to="/tags" icon={<TagExplorerIcon />} label="Tag Explorer" />
        <NavItem to="/chat" icon={<ChatAgentIcon />} label="Chat Agent" />
        <NavItem to="/search" icon={<SearchIcon />} label="Search Evidence" />
      </nav>
      
      <div className="mt-4 pt-4 border-t border-border">
        <p className="px-3 text-xs font-semibold text-textSecondary uppercase tracking-wider mb-2">Case Law Tools</p>
        <nav className="flex flex-col space-y-1">
            <NavItem to="/wcat-search" icon={<WcatIcon />} label="WCAT Search" />
            <NavItem to="/wcat-database" icon={<WcatIcon transform="scale(1.1)" />} label="WCAT Precedents" />
            <NavItem to="/policy-manual" icon={<PolicyIcon />} label="Policy Manual" />
            <NavItem to="/pattern-dashboard" icon={<PatternIcon />} label="Pattern Dashboard" />
        </nav>
      </div>

      <div className="mt-auto pt-4 border-t border-border"> {/* Pushes settings to bottom */}
        <nav className="flex flex-col space-y-1">
            <NavItem to="/export" icon={<ExportIcon />} label="Export Center" />
            <NavItem to="/settings" icon={<SettingsIcon />} label="Settings" />
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
