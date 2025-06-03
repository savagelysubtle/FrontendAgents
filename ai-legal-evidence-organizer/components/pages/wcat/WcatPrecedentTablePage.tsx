
import React, { useState, useMemo, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../../contexts/AppContext';
import { WcatCase, Tag } from '../../../types';
import Modal from '../../ui/Modal';
import LoadingSpinner from '../../ui/LoadingSpinner';

const WcatPrecedentTablePage: React.FC = () => {
  const { 
    wcatCases, deleteWcatCase, addAuditLogEntry, isLoading, 
    tags: allGlobalTags, // For filtering by pattern tags
    generateAndAssignWcatPatternTags, getWcatCaseById 
  } = useAppContext();
  const { decisionNumber: routeDecisionNumber } = useParams<{decisionNumber?: string}>();
  const navigate = useNavigate();

  const [filterText, setFilterText] = useState('');
  const [selectedPatternTagIds, setSelectedPatternTagIds] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: keyof WcatCase | 'relevance'; direction: 'asc' | 'desc' } | null>(null);
  
  const [selectedCase, setSelectedCase] = useState<WcatCase | null>(null);
  const [isGeneratingPatterns, setIsGeneratingPatterns] = useState<string | null>(null); // Holds ID of case being processed

  useEffect(() => {
    if (routeDecisionNumber) {
        const caseFromRoute = wcatCases.find(c => c.decisionNumber === routeDecisionNumber);
        if (caseFromRoute) setSelectedCase(caseFromRoute);
        else navigate('/wcat-database', { replace: true }); // Navigate away if case not found
    }
  }, [routeDecisionNumber, wcatCases, navigate]);

  const wcatPatternTags = useMemo(() => {
    return allGlobalTags.filter(tag => tag.scope === 'wcat_pattern');
  }, [allGlobalTags]);

  const filteredAndSortedCases = useMemo(() => {
    let cases = [...wcatCases];
    if (filterText) {
      const lowerFilter = filterText.toLowerCase();
      cases = cases.filter(c =>
        c.decisionNumber.toLowerCase().includes(lowerFilter) ||
        c.aiSummary.toLowerCase().includes(lowerFilter) ||
        c.outcomeSummary.toLowerCase().includes(lowerFilter) ||
        c.keywords.some(kw => kw.toLowerCase().includes(lowerFilter)) ||
        c.referencedPolicies.some(p => p.policyNumber.toLowerCase().includes(lowerFilter)) ||
        c.tags.some(t => t.name.toLowerCase().includes(lowerFilter))
      );
    }

    if (selectedPatternTagIds.length > 0) {
        cases = cases.filter(c => 
            selectedPatternTagIds.every(tagId => c.tags.some(ct => ct.id === tagId))
        );
    }

    if (sortConfig) {
      cases.sort((a, b) => {
        const valA = a[sortConfig.key as keyof WcatCase];
        const valB = b[sortConfig.key as keyof WcatCase];
        if (sortConfig.key === 'tags') { // Special sort for tags count or first tag name
            const tagsALength = (valA as Tag[])?.length || 0;
            const tagsBLength = (valB as Tag[])?.length || 0;
            return sortConfig.direction === 'asc' ? tagsALength - tagsBLength : tagsBLength - tagsALength;
        }
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        }
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return cases;
  }, [wcatCases, filterText, sortConfig, selectedPatternTagIds]);

  const requestSort = (key: keyof WcatCase | 'relevance') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: keyof WcatCase | 'relevance') => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  };

  const handleDelete = async (caseId: string, decisionNum: string) => {
    if (window.confirm(`Are you sure you want to delete WCAT Case ${decisionNum}? This will also attempt to delete its PDF from MCP if stored.`)) {
        await deleteWcatCase(caseId); // deleteWcatCase is now async
        addAuditLogEntry('WCAT_CASE_REMOVED_MANUALLY', `WCAT Case ${decisionNum} removed by user.`);
        if (selectedCase?.id === caseId) setSelectedCase(null); // Close modal if current case deleted
    }
  }

  const handleTogglePatternTagFilter = (tagId: string) => {
    setSelectedPatternTagIds(prev => 
        prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const handleGeneratePatterns = async (caseId: string) => {
    setIsGeneratingPatterns(caseId);
    try {
      await generateAndAssignWcatPatternTags(caseId);
      // Re-fetch the case to update modal if it's open
      const updatedCase = getWcatCaseById(caseId);
      if (selectedCase?.id === caseId && updatedCase) {
        setSelectedCase(updatedCase);
      }
    } catch (error) {
      console.error("Error triggering pattern generation:", error);
    } finally {
      setIsGeneratingPatterns(null);
    }
  };


  const tableHeaders: { key: keyof WcatCase | 'relevance', label: string, sortable?: boolean, className?: string }[] = [
    { key: 'decisionNumber', label: 'Decision #', sortable: true, className: "w-1/12 px-2 py-3" },
    { key: 'year', label: 'Year', sortable: true, className: "w-1/12 px-2 py-3" },
    { key: 'outcomeSummary', label: 'Outcome', sortable: true, className: "w-3/12 px-2 py-3" },
    { key: 'tags', label: 'Pattern Tags', sortable: true, className: "w-3/12 px-2 py-3" },
    { key: 'referencedPolicies', label: 'Policies Ref.', sortable: false, className: "w-2/12 px-2 py-3" },
    { key: 'relevance' as any, label: 'Actions', sortable: false, className: "w-2/12 px-2 py-3" }
  ];

  if (isLoading && wcatCases.length === 0) {
    return <div className="p-6 flex justify-center"><LoadingSpinner message="Loading WCAT cases..." /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-semibold text-textPrimary">WCAT Precedent Database</h2>
        <Link to="/wcat-search" className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors">
          Search & Add New Cases
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Filter cases by keyword, decision #, policy, summary..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="w-full px-4 py-2 bg-background border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div>
            <label className="block text-sm font-medium text-textSecondary mb-1">Filter by Pattern Tags (AND logic):</label>
            <div className="flex flex-wrap gap-1 bg-surface p-2 rounded-md border border-border max-h-20 overflow-y-auto">
                {wcatPatternTags.length > 0 ? wcatPatternTags.map(tag => (
                    <button
                        key={tag.id}
                        onClick={() => handleTogglePatternTagFilter(tag.id)}
                        className={`text-xs px-2 py-0.5 rounded-full border ${selectedPatternTagIds.includes(tag.id) ? `${tag.color} text-white` : 'bg-gray-100 dark:bg-gray-700 text-textPrimary hover:border-primary'}`}
                    >
                        {tag.name}
                    </button>
                )) : <span className="text-xs text-textSecondary">No WCAT pattern tags defined yet.</span>}
            </div>
        </div>
      </div>


      {filteredAndSortedCases.length === 0 && !filterText && selectedPatternTagIds.length === 0 ? (
         <p className="text-textSecondary text-center py-8">No WCAT cases in the database yet. <Link to="/wcat-search" className="text-primary hover:underline">Add some cases</Link>.</p>
      ) : filteredAndSortedCases.length === 0 ? (
         <p className="text-textSecondary text-center py-8">No WCAT cases match your filter criteria.</p>
      ) : (
        <div className="overflow-x-auto bg-surface shadow-md rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {tableHeaders.map(header => (
                  <th key={header.key} scope="col" 
                      className={`px-2 py-3 text-left text-xs font-medium text-textSecondary uppercase tracking-wider ${header.className || ''} ${header.sortable ? 'cursor-pointer' : ''}`}
                      onClick={() => header.sortable && requestSort(header.key as keyof WcatCase)}
                  >
                    {header.label} {getSortIndicator(header.key as keyof WcatCase)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-surface divide-y divide-border">
              {filteredAndSortedCases.map((wcase) => (
                <tr key={wcase.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="px-2 py-3 whitespace-nowrap text-sm text-primary font-medium hover:underline cursor-pointer" onClick={() => setSelectedCase(wcase)}>{wcase.decisionNumber}</td>
                  <td className="px-2 py-3 whitespace-nowrap text-sm text-textPrimary">{wcase.year}</td>
                  <td className="px-2 py-3 text-sm text-textPrimary truncate max-w-xs" title={wcase.outcomeSummary}>{wcase.outcomeSummary}</td>
                  <td className="px-2 py-3 text-sm text-textSecondary truncate max-w-xs" title={wcase.tags.map(t=>t.name).join(', ')}>
                    {wcase.tags.filter(t => t.scope === 'wcat_pattern').slice(0,2).map(t => 
                        <span key={t.id} className={`text-xs px-1.5 py-0.5 rounded-full ${t.color} text-white mr-1 whitespace-nowrap`}>{t.name}</span>
                    )}
                    {wcase.tags.filter(t => t.scope === 'wcat_pattern').length > 2 ? '...' : ''}
                     {wcase.tags.filter(t => t.scope === 'wcat_pattern').length === 0 && 'N/A'}
                  </td>
                  <td className="px-2 py-3 text-sm text-textPrimary">
                    {wcase.referencedPolicies.slice(0,2).map(p => p.policyNumber).join(', ')}
                    {wcase.referencedPolicies.length > 2 ? '...' : ''}
                  </td>
                  <td className="px-2 py-3 whitespace-nowrap text-sm font-medium space-x-1">
                    <button onClick={() => setSelectedCase(wcase)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 text-xs p-0.5">View</button>
                    {wcase.mcpPath && <a href={wcase.mcpPath} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 text-xs p-0.5">MCP-PDF</a>}
                    {!wcase.mcpPath && wcase.fullPdfUrl && <a href={wcase.fullPdfUrl} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 text-xs p-0.5">Web-PDF</a>}
                    <button onClick={() => handleDelete(wcase.id, wcase.decisionNumber)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 text-xs p-0.5">Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selectedCase && (
        <Modal isOpen={!!selectedCase} onClose={() => setSelectedCase(null)} title={`WCAT Decision: ${selectedCase.decisionNumber} (${selectedCase.year})`}>
            <div className="space-y-3 text-sm max-h-[75vh] overflow-y-auto pr-2">
                <p><strong>Outcome:</strong> {selectedCase.outcomeSummary}</p>
                <div><strong>AI Summary:</strong> <pre className="whitespace-pre-wrap text-xs bg-background p-2 rounded border border-border max-h-40 overflow-y-auto">{selectedCase.aiSummary}</pre></div>
                <div><strong>Pattern Tags:</strong> 
                    {selectedCase.tags.filter(t=>t.scope === 'wcat_pattern').length > 0 ? selectedCase.tags.filter(t=>t.scope === 'wcat_pattern').map(tag => (
                       <span key={tag.id} className={`text-xs px-2 py-0.5 rounded-full ${tag.color} text-white mr-1 mb-1 inline-block`}>{tag.name}</span>
                    )) : "No pattern tags identified yet."}
                    { (isGeneratingPatterns === selectedCase.id) ? <LoadingSpinner size="sm" message="Generating patterns..." /> :
                     (selectedCase.rawTextContent && <button onClick={() => handleGeneratePatterns(selectedCase.id)} className="text-xs text-secondary hover:underline ml-2 p-1">(Re-generate Patterns)</button>)
                    }
                </div>
                <div><strong>Referenced Policies:</strong> 
                    {selectedCase.referencedPolicies.length > 0 ? selectedCase.referencedPolicies.map(p => (
                       <Link key={p.policyNumber} to={`/policy-manual/${p.policyNumber}`} className="text-primary hover:underline mr-2">{p.policyNumber}{p.policyTitle ? ` (${p.policyTitle})` : ''}</Link>
                    )) : "None"}
                </div>
                <p><strong>Keywords:</strong> {selectedCase.keywords.join(', ') || "None"}</p>
                <div><strong>Key Quotes:</strong>
                    {selectedCase.keyQuotes.length > 0 ? (
                        <ul className="list-disc list-inside pl-4 max-h-32 overflow-y-auto bg-background p-2 rounded border border-border">
                            {selectedCase.keyQuotes.map((q, i) => <li key={i} className="mb-1">"{q.quote}" {q.page && `(p. ${q.page})`} {q.context && `- ${q.context}`}</li>)}
                        </ul>
                    ) : "None extracted"}
                </div>
                 <p>
                    {selectedCase.mcpPath ? 
                        <a href={selectedCase.mcpPath} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold mr-2">View PDF (from MCP)</a> :
                        <span className="text-textSecondary mr-2">PDF not stored in MCP.</span>
                    }
                     (<a href={selectedCase.fullPdfUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View Original PDF Online</a>)
                </p>
                 {selectedCase.rawTextContent && <details className="text-xs">
                    <summary className="cursor-pointer text-textSecondary">View Raw Extracted Text (for debugging)</summary>
                    <pre className="whitespace-pre-wrap bg-background p-2 rounded border border-border max-h-48 overflow-y-auto mt-1">{selectedCase.rawTextContent.substring(0, 2000)}...</pre>
                </details>}
            </div>
        </Modal>
      )}
    </div>
  );
};

export default WcatPrecedentTablePage;
