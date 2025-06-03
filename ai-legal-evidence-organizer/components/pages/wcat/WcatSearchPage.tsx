
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../../../contexts/AppContext';
import { searchWcatDecisions, fetchAndProcessWcatPdf } from '../../../services/wcatService';
import { WcatSearchResultItem, WcatCase, Tag } from '../../../types';
import LoadingSpinner from '../../ui/LoadingSpinner';
import { WCAT_BASE_URL, DEFAULT_WCAT_PATTERN_TAG_COLOR } from '../../../constants';
import { identifyWcatCasePatterns } from '../../../services/geminiService';


const WcatSearchPage: React.FC = () => {
  const { 
    addWcatCase, getWcatCaseByDecisionNumber, 
    setIsLoading, isLoading, setError, addAuditLogEntry, apiKey,
    mcpClient, // Get McpClient from context
    generateAndAssignWcatPatternTags // For generating patterns after import
  } = useAppContext();
  
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState('2020-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [classification, setClassification] = useState('noteworthy'); 
  const [isPerformingDeepSearch, setIsPerformingDeepSearch] = useState(false);

  const [searchResults, setSearchResults] = useState<WcatSearchResultItem[]>([]);
  const [processingCaseId, setProcessingCaseId] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey && isPerformingDeepSearch) { // Warn if deep search relies on AI processing
      setError("Gemini API Key is not set. AI processing of cases for deep search will fail. Please configure it in Settings.");
    }
    setIsLoading(true);
    setError(null);
    setSearchResults([]);
    try {
      const searchDetail = `Query: ${query}, Start: ${startDate}, End: ${endDate}, Class: ${classification}, Deep: ${isPerformingDeepSearch}`;
      addAuditLogEntry('WCAT_SEARCH_INITIATED', searchDetail);
      // Pass isPerformingDeepSearch to the service
      const results = await searchWcatDecisions(query, startDate, endDate, classification, isPerformingDeepSearch);
      setSearchResults(results);
      addAuditLogEntry('WCAT_SEARCH_COMPLETED', `Found ${results.length} WCAT results. ${searchDetail}`);
    } catch (err: any) {
      setError(`WCAT Search Error: ${err.message}`);
      addAuditLogEntry('WCAT_SEARCH_ERROR', `Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportCase = async (searchResult: WcatSearchResultItem) => {
    if (!apiKey) {
        setError("Gemini API Key is not set. Cannot process case. Please configure it in Settings.");
        return;
    }
    if (getWcatCaseByDecisionNumber(searchResult.decisionNumber)) {
      alert(`Case ${searchResult.decisionNumber} is already in your database.`);
      return;
    }
    setProcessingCaseId(searchResult.decisionNumber);
    setIsLoading(true);
    setError(null);
    try {
      // Pass mcpClient to fetchAndProcessWcatPdf
      const caseDataPartial = await fetchAndProcessWcatPdf(searchResult.pdfUrl, searchResult.decisionNumber, addAuditLogEntry, mcpClient);
      const newCase = await addWcatCase(caseDataPartial as Omit<WcatCase, 'id' | 'ingestedAt' | 'tags'>);
      alert(`Case ${searchResult.decisionNumber} imported successfully! Path: ${newCase.mcpPath || 'N/A'}. Now attempting to generate pattern tags...`);
      
      // After successful import, generate and assign pattern tags
      await generateAndAssignWcatPatternTags(newCase.id);
      addAuditLogEntry('WCAT_CASE_PATTERNS_QUEUED', `Pattern tag generation initiated for ${newCase.decisionNumber}.`);
      alert(`Pattern tag generation complete for ${newCase.decisionNumber}. Check the case in the database.`);

    } catch (err: any) {
      setError(`Failed to import WCAT Case ${searchResult.decisionNumber}: ${err.message}`);
      addAuditLogEntry('WCAT_IMPORT_ERROR', `Import failed for ${searchResult.decisionNumber}: ${err.message}`);
    } finally {
      setIsLoading(false);
      setProcessingCaseId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-3xl font-semibold text-textPrimary">Search WCAT Decisions</h2>
      
      {!apiKey && (
        <div className="p-4 bg-yellow-100 dark:bg-yellow-900 border border-yellow-500 text-yellow-700 dark:text-yellow-300 rounded-md">
          Warning: Gemini API Key is not set. AI features for processing cases will not work. Please go to Settings to configure it.
        </div>
      )}

      <form onSubmit={handleSearch} className="bg-surface p-6 rounded-lg shadow border border-border space-y-4">
        <div>
          <label htmlFor="wcat-query" className="block text-sm font-medium text-textSecondary">Search Query</label>
          <input
            type="text"
            id="wcat-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., chronic pain, stenosis, CRPS, 'deep search: pre-existing conditions'"
            className="mt-1 block w-full px-3 py-2 bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="wcat-start-date" className="block text-sm font-medium text-textSecondary">Start Date</label>
            <input type="date" id="wcat-start-date" value={startDate} onChange={(e) => setStartDate(e.target.value)} 
                   className="mt-1 block w-full px-3 py-2 bg-background border border-border rounded-md shadow-sm"/>
          </div>
          <div>
            <label htmlFor="wcat-end-date" className="block text-sm font-medium text-textSecondary">End Date</label>
            <input type="date" id="wcat-end-date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                   className="mt-1 block w-full px-3 py-2 bg-background border border-border rounded-md shadow-sm"/>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
           <div>
            <label htmlFor="wcat-classification" className="block text-sm font-medium text-textSecondary">Classification</label>
            <select id="wcat-classification" value={classification} onChange={(e) => setClassification(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-background border border-border rounded-md shadow-sm">
              <option value="noteworthy">Noteworthy</option>
              <option value="all">All Decisions</option>
            </select>
          </div>
          <div className="flex items-center">
            <input 
                type="checkbox" 
                id="deep-search-toggle" 
                checked={isPerformingDeepSearch} 
                onChange={(e) => setIsPerformingDeepSearch(e.target.checked)}
                className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary mr-2"
            />
            <label htmlFor="deep-search-toggle" className="text-sm font-medium text-textSecondary">
                Perform Deep Search (more results, slower, uses AI for processing during import)
            </label>
          </div>
        </div>
        <button type="submit" disabled={isLoading} className="w-full bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50">
          {isLoading && !processingCaseId ? <LoadingSpinner size="sm" message="Searching..." /> : 'Search WCAT (Simulated)'}
        </button>
        <p className="text-xs text-textSecondary text-center">Note: WCAT search is simulated. "Deep Search" simulates broader query matching and potentially more results.</p>
      </form>

      {searchResults.length > 0 && (
        <div className="bg-surface p-6 rounded-lg shadow border border-border">
          <h3 className="text-xl font-semibold text-textPrimary mb-4">Search Results ({searchResults.length})</h3>
          <ul className="space-y-3">
            {searchResults.map(item => (
              <li key={item.decisionNumber} className="p-4 border border-border rounded-md bg-background hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <a href={item.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-lg font-semibold text-primary hover:underline">
                      {item.title || `WCAT Decision ${item.decisionNumber}`}
                    </a>
                    {item.date && <p className="text-xs text-textSecondary">Date: {item.date}</p>}
                  </div>
                  <button
                    onClick={() => handleImportCase(item)}
                    disabled={(isLoading && processingCaseId === item.decisionNumber) || !!getWcatCaseByDecisionNumber(item.decisionNumber)}
                    className="bg-secondary text-white px-3 py-1.5 rounded-md hover:bg-secondary-dark text-sm disabled:opacity-50 whitespace-nowrap"
                  >
                    {isLoading && processingCaseId === item.decisionNumber ? <LoadingSpinner size="sm" /> : 
                     (getWcatCaseByDecisionNumber(item.decisionNumber) ? 'Imported' : 'Import & Process')}
                  </button>
                </div>
                {item.snippet && <p className="text-sm text-textSecondary mt-1">{item.snippet}</p>}
                <p className="text-xs text-textSecondary mt-1">PDF: <a href={item.pdfUrl} target="_blank" rel="noopener noreferrer" className="hover:underline truncate block">{item.pdfUrl}</a></p>
              </li>
            ))}
          </ul>
        </div>
      )}
       {isLoading && searchResults.length === 0 && !processingCaseId && !isPerformingDeepSearch && <LoadingSpinner message="Loading search results..." />}
       {isLoading && searchResults.length === 0 && !processingCaseId && isPerformingDeepSearch && <LoadingSpinner message="Performing deep search..." />}


    </div>
  );
};

export default WcatSearchPage;
