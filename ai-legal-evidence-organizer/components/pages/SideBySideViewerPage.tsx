
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppContext } from '../../contexts/AppContext';
import { EvidenceFile, WcatCase, PolicyReference, Tag } from '../../types';
import LoadingSpinner from '../ui/LoadingSpinner';
import ChatPopupModal from '../ui/ChatPopupModal'; // New component for chat
import { DEFAULT_TAG_COLOR } from '../../constants';

const AiChatIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-3.86 8.25-8.625 8.25S3.75 16.556 3.75 12c0-4.556 3.86-8.25 8.625-8.25S21 7.444 21 12z" />
    </svg>
);

const DocumentPanel: React.FC<{ item: EvidenceFile | WcatCase, type: 'evidence' | 'wcat' }> = ({ item, type }) => {
  const isEvidence = type === 'evidence';
  const evidenceItem = item as EvidenceFile;
  const wcatItem = item as WcatCase;

  const title = isEvidence ? evidenceItem.name : `${wcatItem.decisionNumber} (${wcatItem.year})`;
  const summary = isEvidence ? evidenceItem.summary : wcatItem.aiSummary;
  const tags = item.tags || [];
  const policies = isEvidence ? (evidenceItem.referencedPolicies || []) : (wcatItem.referencedPolicies || []);

  return (
    <div className="bg-surface p-4 rounded-lg shadow border border-border h-full flex flex-col">
      <h3 className="text-xl font-semibold text-textPrimary mb-2 pb-2 border-b border-border truncate" title={title}>
        {isEvidence ? 'Evidence: ' : 'WCAT: '} {title}
      </h3>
      <div className="space-y-3 overflow-y-auto flex-grow pr-1">
        <div>
          <h4 className="text-sm font-medium text-textSecondary mb-1">AI Summary:</h4>
          <pre className="text-xs whitespace-pre-wrap bg-background p-2 rounded border border-border max-h-40 overflow-y-auto">
            {summary || 'No summary available.'}
          </pre>
        </div>
        <div>
          <h4 className="text-sm font-medium text-textSecondary mb-1">Tags:</h4>
          <div className="flex flex-wrap gap-1">
            {tags.length > 0 ? tags.map(tag => (
              <span key={tag.id} className={`text-xs px-1.5 py-0.5 rounded-full text-white ${tag.color || DEFAULT_TAG_COLOR}`}>
                {tag.name}
              </span>
            )) : <span className="text-xs text-textSecondary">No tags.</span>}
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium text-textSecondary mb-1">Referenced Policies:</h4>
          {policies.length > 0 ? (
            <ul className="list-disc list-inside pl-4 text-xs">
              {policies.map(pol => (
                <li key={pol.policyNumber}>
                  <Link to={`/policy-manual/${pol.policyNumber}`} className="text-primary hover:underline">
                    {pol.policyNumber}
                  </Link>
                  {pol.policyTitle && ` - ${pol.policyTitle}`}
                </li>
              ))}
            </ul>
          ) : <span className="text-xs text-textSecondary">No policies referenced.</span>}
        </div>
        {!isEvidence && wcatItem.keyQuotes && wcatItem.keyQuotes.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-textSecondary mb-1">Key Quotes:</h4>
            <ul className="list-disc list-inside pl-4 text-xs bg-background p-2 rounded border border-border max-h-32 overflow-y-auto">
              {wcatItem.keyQuotes.map((q, i) => <li key={i} className="mb-1">"{q.quote}"</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};


const SideBySideViewerPage: React.FC = () => {
  const { evidenceFileId, wcatCaseId } = useParams<{ evidenceFileId: string; wcatCaseId: string }>();
  const { getFileById, getWcatCaseById, mcpClient, updateFile, addAuditLogEntry, setError } = useAppContext();

  const [evidenceFile, setEvidenceFile] = useState<EvidenceFile | null | undefined>(null);
  const [wcatCase, setWcatCase] = useState<WcatCase | null | undefined>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      if (!evidenceFileId || !wcatCaseId) {
        setError("Missing Evidence File ID or WCAT Case ID for comparison.");
        setIsLoading(false);
        return;
      }

      let fetchedEvidenceFile = getFileById(evidenceFileId);
      const fetchedWcatCase = getWcatCaseById(wcatCaseId);

      if (fetchedEvidenceFile && !fetchedEvidenceFile.content && fetchedEvidenceFile.type !== 'img' && fetchedEvidenceFile.mcpPath && mcpClient && mcpClient.ready) {
        try {
            addAuditLogEntry('SBS_MCP_READ_START', `Reading ${fetchedEvidenceFile.name} from ${fetchedEvidenceFile.mcpPath}`);
            const mcpFile = await mcpClient.readFile(fetchedEvidenceFile.mcpPath);
            if (mcpFile && mcpFile.content) {
                updateFile(evidenceFileId, { content: mcpFile.content });
                fetchedEvidenceFile = { ...fetchedEvidenceFile, content: mcpFile.content };
                addAuditLogEntry('SBS_MCP_READ_SUCCESS', `Content loaded for ${fetchedEvidenceFile.name}`);
            }
        } catch (err: any) {
            setError(`Error loading evidence file content: ${err.message}`);
            addAuditLogEntry('SBS_MCP_READ_ERROR', `MCP Error for ${fetchedEvidenceFile?.name}: ${err.message}`);
        }
      }
      
      setEvidenceFile(fetchedEvidenceFile);
      setWcatCase(fetchedWcatCase);
      setIsLoading(false);
    };
    loadData();
  }, [evidenceFileId, wcatCaseId, getFileById, getWcatCaseById, mcpClient, updateFile, setError, addAuditLogEntry]);

  if (isLoading) {
    return <div className="p-6 flex justify-center items-center h-full"><LoadingSpinner message="Loading comparison data..." /></div>;
  }

  if (!evidenceFile || !wcatCase) {
    return <div className="p-6 text-center text-textSecondary">One or both items for comparison could not be found. <Link to="/" className="text-primary hover:underline">Return to Dashboard</Link></div>;
  }

  return (
    <div className="p-6 space-y-6 h-[calc(100vh-var(--header-height,80px)-2rem)] flex flex-col">
      <h2 className="text-2xl font-semibold text-textPrimary">Compare Documents</h2>
      <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
        <DocumentPanel item={evidenceFile} type="evidence" />
        <DocumentPanel item={wcatCase} type="wcat" />
      </div>

      <button
        onClick={() => setIsChatModalOpen(true)}
        className="fixed bottom-6 right-6 bg-primary text-white p-4 rounded-full shadow-lg hover:bg-primary-dark transition-colors focus:outline-none focus:ring-2 focus:ring-primary-light focus:ring-opacity-50"
        aria-label="Open AI Chat Agent"
        title="Open AI Chat Agent (Context: Comparing these two documents)"
      >
        <AiChatIcon />
      </button>

      {isChatModalOpen && (
        <ChatPopupModal
          isOpen={isChatModalOpen}
          onClose={() => setIsChatModalOpen(false)}
          initialEvidenceContext={[evidenceFile]}
          initialWcatContext={[wcatCase]}
        />
      )}
    </div>
  );
};

export default SideBySideViewerPage;
