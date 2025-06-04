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
import SideBySideViewerPage from './components/pages/SideBySideViewerPage';

// Simple Error Boundary for AppLayout
class AppLayoutErrorBoundary extends React.Component<{children: React.ReactNode}, { hasError: boolean, error: Error | null, errorInfo: React.ErrorInfo | null }> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("AppLayoutErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="p-6 text-center text-red-500 bg-red-50 dark:bg-red-900 min-h-screen flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold mb-4">Application Layout Error</h1>
          <p className="mb-2">There was an error rendering the main application layout.</p>
          <p className="mb-4">This might be due to an issue with context initialization (AppContext) or a critical error in Header/Sidebar.</p>
          <details className="text-left text-xs bg-white dark:bg-gray-800 p-2 border border-red-300 rounded w-full max-w-2xl">
            <summary>Error Details</summary>
            <pre className="whitespace-pre-wrap mt-2">
              {this.state.error && this.state.error.toString()}
              <br />
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppLayout: React.FC = () => {
  const { theme, isMainSidebarCollapsed, isLoading } = useAppContext();
  return (
    <div className={`flex flex-col min-h-screen bg-background text-textPrimary theme-${theme}`}>
      <Header />
      {isLoading && (
        <div className="fixed top-0 left-0 right-0 h-1 z-50">
          <div className="h-full bg-primary animate-pulse-fast"></div> {/* Simple pulse, can be improved with a better animation */}
        </div>
      )}
      {/* Main content area, flex-1 to take remaining height. Adjust pt-16 if header height changes. */}
      <div className="flex flex-1 pt-16">
        <Sidebar />
        {/* Sidebar width is w-64. Main content margin adjusts based on sidebar state. */}
        <main className={`
          flex-1 overflow-y-auto bg-background
          transition-all duration-300 ease-in-out
          ${isMainSidebarCollapsed ? 'ml-0' : 'ml-64'}
        `}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  console.log("App.tsx: App component rendering...");
  return (
    <HashRouter>
      <Routes>
        <Route
          path="/"
          element={
            <AppLayoutErrorBoundary>
              <AppLayout />
            </AppLayoutErrorBoundary>
          }
        >
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
          <Route path="wcat-database/:decisionNumber" element={<WcatPrecedentTablePage />} />
          <Route path="policy-manual" element={<PolicyManualPage />} />
          <Route path="policy-manual/:manualId" element={<PolicyManualPage />}> {/* Changed to manualId for consistency */}
            <Route path=":policyNumber" element={<PolicyManualPage />} /> {/* Nested for policy number */}
          </Route>
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
