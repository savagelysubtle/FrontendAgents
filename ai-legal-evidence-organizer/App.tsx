
import React from 'react';
import { HashRouter, Routes, Route, Outlet } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import DashboardPage from './components/pages/DashboardPage';
import FileIngestionPage from './components/pages/FileIngestionPage';
import DocumentViewerPage from './components/pages/DocumentViewerPage';
import TagExplorerPage from './components/pages/TagExplorerPage';
import ChatAgentPanelPage from './components/pages/ChatAgentPanelPage';
import SearchPage from './components/pages/SearchPage';
import ExportCenterPage from './components/pages/ExportCenterPage';
import SettingsPage from './components/pages/SettingsPage';
import { useAppContext } from './contexts/AppContext';

// New Page Imports
import WcatSearchPage from './components/pages/wcat/WcatSearchPage';
import WcatPrecedentTablePage from './components/pages/wcat/WcatPrecedentTablePage';
import PolicyManualPage from './components/pages/wcat/PolicyManualPage';
import PatternDashboardPage from './components/pages/wcat/PatternDashboardPage';
import SideBySideViewerPage from './components/pages/SideBySideViewerPage'; // Added


const AppLayout: React.FC = () => {
  const { theme, isMainSidebarCollapsed } = useAppContext(); 
  return (
    <div className={`flex flex-col min-h-screen bg-background text-textPrimary theme-${theme}`}>
      <Header />
      <div className="flex flex-1 pt-16"> {/* pt-16 to offset fixed header */}
        <Sidebar />
        <main className={`
          flex-1 overflow-y-auto bg-background 
          transition-all duration-300 ease-in-out
          ${isMainSidebarCollapsed ? 'ml-0' : 'ml-64'}
        `}> {/* ml-64 to offset fixed sidebar */}
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="ingestion" element={<FileIngestionPage />} />
          <Route path="viewer" element={<DocumentViewerPage />} />
          <Route path="viewer/:fileId" element={<DocumentViewerPage />} />
          <Route path="tags" element={<TagExplorerPage />} />
          <Route path="chat" element={<ChatAgentPanelPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="export" element={<ExportCenterPage />} />
          <Route path="settings" element={<SettingsPage />} />
          
          {/* WCAT & Policy Routes */}
          <Route path="wcat-search" element={<WcatSearchPage />} />
          <Route path="wcat-database" element={<WcatPrecedentTablePage />} />
          <Route path="wcat-database/:decisionNumber" element={<WcatPrecedentTablePage />} /> {/* For linking to specific case view */}
          <Route path="policy-manual" element={<PolicyManualPage />} />
          <Route path="policy-manual/:policyNumber" element={<PolicyManualPage />} /> {/* For linking to specific policy */}
          <Route path="pattern-dashboard" element={<PatternDashboardPage />} />

          {/* Side-by-Side Comparison Route */}
          <Route path="compare/:evidenceFileId/:wcatCaseId" element={<SideBySideViewerPage />} />

          <Route path="*" element={<div className="p-6 text-center"><h2>404 - Page Not Found</h2></div>} />
        </Route>
      </Routes>
    </HashRouter>
  );
};

export default App;
