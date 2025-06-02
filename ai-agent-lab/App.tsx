
import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import AgentsPage from './pages/AgentsPage';
import ToolsPage from './pages/ToolsPage';
import AssistantPage from './pages/AssistantPage';
import SettingsPage from './pages/SettingsPage';
import { useTheme } from './hooks/useTheme'; // Import useTheme to initialize it
import { telemetryService } from './services/telemetryService';


// Component to handle page view telemetry
const PageViewLogger: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    telemetryService.logEvent('page_view', { path: location.pathname, search: location.search });
  }, [location]);

  return null; // This component doesn't render anything
};


const App: React.FC = () => {
  useTheme(); // Initialize theme management hook at the top level

  // Example of logging an app start event
  useEffect(() => {
    telemetryService.logEvent('app_started');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return (
    <Layout>
      <PageViewLogger />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/tools" element={<ToolsPage />} />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {/* Add a fallback route for unknown paths */}
        <Route path="*" element={
            <div className="text-center py-10">
              <h1 className="text-3xl font-bold">404 - Page Not Found</h1>
              <p className="mt-4">The page you are looking for does not exist.</p>
            </div>
          } />
      </Routes>
    </Layout>
  );
};

export default App;
