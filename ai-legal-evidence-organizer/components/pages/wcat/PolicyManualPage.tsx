
import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../../contexts/AppContext';
import { PolicyManual, PolicyEntry } from '../../../types';
import LoadingSpinner from '../../ui/LoadingSpinner';

const PolicyIconBig = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.0} stroke="currentColor" className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.75V16.5L12 14.25 7.5 16.5V3.75m9 0H18A2.25 2.25 0 0120.25 6v12A2.25 2.25 0 0118 20.25H6A2.25 2.25 0 013.75 18V6A2.25 2.25 0 016 3.75h1.5m9 0h-9" /></svg>;

const PolicyManualPage: React.FC = () => {
  const { 
    policyManuals, addPolicyManual, deletePolicyManual, getPolicyManualById, getPolicyEntry,
    isLoading: isAppLoading, setIsLoading: setAppIsLoading, 
    setError: setAppError, addAuditLogEntry, apiKey, mcpClient 
  } = useAppContext();
  
  const { policyNumber: routePolicyNumber, manualId: routeManualId } = useParams<{ policyNumber?: string, manualId?: string }>();
  const navigate = useNavigate();

  const [selectedManual, setSelectedManual] = useState<PolicyManual | null>(null);
  const [selectedPolicyEntry, setSelectedPolicyEntry] = useState<PolicyEntry | null>(null);
  const [searchTermManuals, setSearchTermManuals] = useState('');
  const [searchTermEntries, setSearchTermEntries] = useState('');

  // Form state for adding new manual
  const [showAddManualForm, setShowAddManualForm] = useState(false);
  const [newManualName, setNewManualName] = useState('');
  const [newManualVersion, setNewManualVersion] = useState('');
  const [newManualSourceUrl, setNewManualSourceUrl] = useState('');
  const [newManualFile, setNewManualFile] = useState<File | null>(null);
  const [isAddingManual, setIsAddingManual] = useState(false);

  // Effect to handle deep linking or initial selection
  useEffect(() => {
    if (routeManualId) {
      const manual = getPolicyManualById(routeManualId);
      setSelectedManual(manual || null);
      if (manual && routePolicyNumber) {
        const entry = getPolicyEntry(manual.id, routePolicyNumber);
        setSelectedPolicyEntry(entry || null);
      } else {
        setSelectedPolicyEntry(null);
      }
    } else if (routePolicyNumber && policyManuals.length > 0) {
      // Fallback: if only policy number is in route, find first manual containing it
      let foundManual: PolicyManual | null = null;
      let foundEntry: PolicyEntry | null = null;
      for (const man of policyManuals) {
        const entry = man.policyEntries.find(pe => pe.policyNumber === routePolicyNumber);
        if (entry) {
          foundManual = man;
          foundEntry = entry;
          break;
        }
      }
      setSelectedManual(foundManual);
      setSelectedPolicyEntry(foundEntry);
      if (foundManual) navigate(`/policy-manual/${foundManual.id}?policyNumber=${routePolicyNumber}`, { replace: true });

    } else if (!selectedManual && policyManuals.length > 0) {
      // setSelectedManual(policyManuals[0]); // Optionally select first manual by default
    }
  }, [routeManualId, routePolicyNumber, policyManuals, getPolicyManualById, getPolicyEntry, navigate, selectedManual]);

  const filteredManuals = useMemo(() => 
    policyManuals.filter(manual =>
      manual.manualName.toLowerCase().includes(searchTermManuals.toLowerCase()) ||
      (manual.version && manual.version.toLowerCase().includes(searchTermManuals.toLowerCase()))
    ).sort((a,b) => a.manualName.localeCompare(b.manualName)), 
  [policyManuals, searchTermManuals]);

  const filteredPolicyEntries = useMemo(() => {
    if (!selectedManual) return [];
    return selectedManual.policyEntries.filter(entry =>
      entry.policyNumber.toLowerCase().includes(searchTermEntries.toLowerCase()) ||
      (entry.title && entry.title.toLowerCase().includes(searchTermEntries.toLowerCase())) ||
      (entry.snippet && entry.snippet.toLowerCase().includes(searchTermEntries.toLowerCase()))
    ).sort((a,b) => a.policyNumber.localeCompare(b.policyNumber));
  }, [selectedManual, searchTermEntries]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setNewManualFile(event.target.files[0]);
      setNewManualSourceUrl(''); // Clear URL if file is chosen
      if (!newManualName) setNewManualName(event.target.files[0].name.replace(/\.[^/.]+$/, "")); // Auto-fill name
    }
  };
  
  const handleAddManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newManualName.trim()) {
      setAppError("Manual name is required.");
      return;
    }
    if (!newManualFile && !newManualSourceUrl.trim()) {
      setAppError("Please provide either a PDF file or a source URL.");
      return;
    }
     if (!apiKey) {
      setAppError("Gemini API Key not set. Cannot index manual.");
      return;
    }
    if (!mcpClient || !mcpClient.ready) {
      setAppError("MCP Client not ready. Cannot save manual PDF.");
      return;
    }

    setIsAddingManual(true);
    setAppIsLoading(true);

    let pdfContentString = "";
    let originalFileName = newManualFile?.name || newManualName + ".pdf";

    if (newManualFile) {
      // For demo: read as text. Real app: base64 or send blob for server-side parsing.
      pdfContentString = await newManualFile.text(); 
    } else if (newManualSourceUrl.trim()) {
      // Simulate fetching from URL - for demo, use placeholder
      addAuditLogEntry('POLICY_MANUAL_DOWNLOAD_SIM_START', `Simulating download from ${newManualSourceUrl}`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate download
      pdfContentString = `Simulated PDF content from ${newManualSourceUrl} for ${newManualName}. Policy C3-16.00, AP1-2-1.`;
      originalFileName = newManualSourceUrl.substring(newManualSourceUrl.lastIndexOf('/') + 1) || newManualName + ".pdf";
      addAuditLogEntry('POLICY_MANUAL_DOWNLOAD_SIM_END', `Simulated download complete for ${newManualName}.`);
    }
    
    const added = await addPolicyManual(
      { manualName: newManualName, sourceUrl: newManualSourceUrl, version: newManualVersion },
      pdfContentString,
      originalFileName
    );

    if (added) {
      addAuditLogEntry('POLICY_MANUAL_ADDED', `Manual "${newManualName}" submitted for processing.`);
      setNewManualName('');
      setNewManualVersion('');
      setNewManualSourceUrl('');
      setNewManualFile(null);
      setShowAddManualForm(false);
      setSelectedManual(added); // Select the newly added manual
    }
    // Error handling is done in AppContext for addPolicyManual

    setAppIsLoading(false);
    setIsAddingManual(false);
  };

  const handleDeleteManual = async (manualId: string) => {
    const manual = policyManuals.find(m => m.id === manualId);
    if (manual && window.confirm(`Are you sure you want to delete the manual "${manual.manualName}"?`)) {
      setAppIsLoading(true);
      await deletePolicyManual(manualId);
      if (selectedManual?.id === manualId) {
        setSelectedManual(null);
        setSelectedPolicyEntry(null);
      }
      setAppIsLoading(false);
    }
  };
  
  const handleSelectManual = (manual: PolicyManual) => {
    setSelectedManual(manual);
    setSelectedPolicyEntry(null); // Reset policy entry when manual changes
    setSearchTermEntries('');
    navigate(`/policy-manual/${manual.id}`);
  };

  const handleSelectPolicyEntry = (entry: PolicyEntry) => {
    setSelectedPolicyEntry(entry);
    if(selectedManual) {
        navigate(`/policy-manual/${selectedManual.id}?policyNumber=${entry.policyNumber}`);
    }
  }

  if (isAppLoading && policyManuals.length === 0 && !showAddManualForm) {
      return <div className="p-6 flex justify-center items-center h-full"><LoadingSpinner message="Loading policy manuals..." /></div>;
  }

  return (
    <div className="p-6 flex flex-col md:flex-row gap-6 h-[calc(100vh-var(--header-height,80px)-2rem)]">
      {/* Left Sidebar: List of Manuals & Add New Form */}
      <div className="md:w-1/3 lg:w-1/4 space-y-3 overflow-y-auto bg-surface p-4 rounded-lg shadow border border-border flex flex-col">
        <button 
          onClick={() => setShowAddManualForm(prev => !prev)}
          className="w-full bg-primary text-white px-3 py-2 rounded-md hover:bg-primary-dark transition-colors text-sm"
        >
          {showAddManualForm ? 'Cancel Adding Manual' : 'Add New Policy Manual'}
        </button>

        {showAddManualForm && (
          <form onSubmit={handleAddManualSubmit} className="p-3 border border-border rounded-md bg-background space-y-2 text-sm">
            <h4 className="font-semibold text-textPrimary">New Manual Details:</h4>
            <div>
              <label htmlFor="newManualName" className="block text-xs font-medium text-textSecondary">Manual Name*</label>
              <input type="text" id="newManualName" value={newManualName} onChange={e => setNewManualName(e.target.value)} required 
                     className="mt-0.5 w-full px-2 py-1 bg-background border border-border rounded-md shadow-sm"/>
            </div>
            <div>
              <label htmlFor="newManualVersion" className="block text-xs font-medium text-textSecondary">Version (e.g., 2023, Vol II)</label>
              <input type="text" id="newManualVersion" value={newManualVersion} onChange={e => setNewManualVersion(e.target.value)}
                     className="mt-0.5 w-full px-2 py-1 bg-background border border-border rounded-md shadow-sm"/>
            </div>
            <div>
              <label htmlFor="newManualFile" className="block text-xs font-medium text-textSecondary">Upload PDF File</label>
              <input type="file" id="newManualFile" accept=".pdf" onChange={handleFileChange}
                     className="mt-0.5 w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-secondary file:text-white"/>
            </div>
             <p className="text-xs text-center text-textSecondary">OR</p>
            <div>
              <label htmlFor="newManualSourceUrl" className="block text-xs font-medium text-textSecondary">PDF Source URL</label>
              <input type="url" id="newManualSourceUrl" value={newManualSourceUrl} onChange={e => setNewManualSourceUrl(e.target.value)} placeholder="https://example.com/manual.pdf"
                     className="mt-0.5 w-full px-2 py-1 bg-background border border-border rounded-md shadow-sm"/>
            </div>
            <button type="submit" disabled={isAddingManual || isAppLoading || !apiKey} className="w-full bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 disabled:opacity-50 text-xs">
              {isAddingManual ? <LoadingSpinner size="sm" /> : (!apiKey ? "API Key Missing" : "Add & Process Manual")}
            </button>
             {!apiKey && <p className="text-xs text-red-500 text-center">Gemini API Key required for processing.</p>}
          </form>
        )}
        
        <input 
            type="text"
            placeholder="Search loaded manuals..."
            value={searchTermManuals}
            onChange={(e) => setSearchTermManuals(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary text-sm"
        />
        <div className="flex-grow overflow-y-auto space-y-1">
            {filteredManuals.length === 0 && !isAppLoading ? (
            <p className="text-textSecondary text-xs text-center py-2">No policy manuals loaded or match search.</p>
            ) : filteredManuals.map(manual => (
            <div key={manual.id} 
                 className={`p-2 rounded-md text-sm cursor-pointer hover:bg-primary-light hover:text-white
                            ${selectedManual?.id === manual.id ? 'bg-primary text-white' : 'text-textPrimary bg-background border border-border'}`}
                 onClick={() => handleSelectManual(manual)}>
                <div className="flex justify-between items-start">
                    <span className="font-medium block truncate" title={manual.manualName}>{manual.manualName}</span>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteManual(manual.id);}} className="text-red-500 hover:text-red-300 text-xs p-0.5 ml-1" title="Delete Manual">&times;</button>
                </div>
                <span className="text-xs opacity-80 block">{manual.version || 'N/A'} - {manual.policyEntries.length} policies</span>
                {manual.isProcessing && <LoadingSpinner size="sm" message="Indexing..." />}
            </div>
            ))}
            {isAppLoading && filteredManuals.length === 0 && <LoadingSpinner message="Loading manuals..." />}
        </div>
      </div>

      {/* Right Panel: Selected Manual's Entries & Content */}
      <div className="md:w-2/3 lg:w-3/4 flex flex-col gap-4 overflow-y-hidden">
        {selectedManual ? (
          <>
            <div className="bg-surface p-4 rounded-lg shadow border border-border flex-shrink-0">
              <h2 className="text-xl font-semibold text-textPrimary mb-1">{selectedManual.manualName}</h2>
              <p className="text-xs text-textSecondary">Version: {selectedManual.version || "N/A"} | Source: {selectedManual.sourceUrl ? <a href={selectedManual.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline text-primary">{selectedManual.sourceUrl}</a> : "File Upload"} | MCP: {selectedManual.mcpPath}</p>
              <input 
                  type="text"
                  placeholder={`Search ${selectedManual.policyEntries.length} policies in "${selectedManual.manualName}"...`}
                  value={searchTermEntries}
                  onChange={(e) => setSearchTermEntries(e.target.value)}
                  className="w-full mt-2 px-3 py-2 bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary text-sm"
              />
            </div>

            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-hidden">
                {/* Policy Entries List */}
                <div className="bg-surface p-4 rounded-lg shadow border border-border flex flex-col overflow-y-hidden">
                    <h3 className="text-lg font-semibold text-textPrimary mb-2 flex-shrink-0">Policy Index ({filteredPolicyEntries.length})</h3>
                    <div className="flex-grow overflow-y-auto space-y-1 pr-1">
                    {selectedManual.isProcessing && <LoadingSpinner message="AI Indexing in progress..." />}
                    {!selectedManual.isProcessing && filteredPolicyEntries.length === 0 && <p className="text-xs text-textSecondary text-center">No policy entries match or available.</p>}
                    {!selectedManual.isProcessing && filteredPolicyEntries.map(entry => (
                        <div key={entry.policyNumber} 
                             className={`p-2 rounded-md text-xs cursor-pointer hover:bg-primary-light/20
                                        ${selectedPolicyEntry?.policyNumber === entry.policyNumber ? 'bg-primary-light/30 border border-primary' : 'border border-transparent'}`}
                             onClick={() => handleSelectPolicyEntry(entry)}>
                        <span className="font-medium text-primary block">{entry.policyNumber} - {entry.title || "Untitled Policy"}</span>
                        <span className="text-textSecondary block truncate">{entry.snippet || "No snippet available."}</span>
                        </div>
                    ))}
                    </div>
                </div>
                {/* Selected Policy Entry Content */}
                <div className="bg-surface p-4 rounded-lg shadow border border-border flex flex-col overflow-y-hidden">
                     <h3 className="text-lg font-semibold text-textPrimary mb-2 flex-shrink-0">Policy Details</h3>
                    {selectedPolicyEntry ? (
                    <div className="flex-grow overflow-y-auto pr-1 text-sm">
                        <h4 className="text-md font-semibold text-primary">{selectedPolicyEntry.policyNumber} - {selectedPolicyEntry.title || "Untitled Policy"}</h4>
                        {selectedPolicyEntry.page && <p className="text-xs text-textSecondary">Page: {selectedPolicyEntry.page}</p>}
                        <p className="mt-2 text-textSecondary whitespace-pre-wrap">{selectedPolicyEntry.snippet || "Full content snippet not available or this is the main content placeholder."}</p>
                        {/* In a real app, we might load more detailed content here or link to a page in the rawTextContent of the manual */}
                    </div>
                    ) : (
                    <p className="text-textSecondary text-center py-6 text-sm">Select a policy from the index to view its details.</p>
                    )}
                </div>
            </div>
          </>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center text-textSecondary bg-surface p-6 rounded-lg shadow border border-border">
            <PolicyIconBig />
            <p className="mt-2 text-lg">Select a Policy Manual</p>
            <p className="text-sm">Choose a manual from the left sidebar to view its contents and indexed policies.</p>
            {policyManuals.length === 0 && !isAppLoading && <p className="mt-2 text-sm">No policy manuals have been added yet. Click "Add New Policy Manual" to begin.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default PolicyManualPage;
