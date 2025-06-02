
import React, { useState } from 'react';
import { IngestedData, IngestedFolder, IngestedFile } from '../types';
import { Icons } from '../constants';

interface FileManagerPanelProps {
  ingestedData: IngestedData | null;
  onIngestRequest: () => void;
  isIngesting: boolean;
  ingestProgress: number;
  currentTheme: 'dark' | 'light';
  aiOrganizedSuggestion: string | null;
  isAiOrganizing: boolean;
  onAiOrganizeRequest: () => void;
  apiKeyExists: boolean;
}

const FileTreeItem: React.FC<{ item: IngestedFile | IngestedFolder, indent: number, currentTheme: 'dark' | 'light' }> = ({ item, indent, currentTheme }) => {
  const [isOpen, setIsOpen] = useState(true);
  const isFolder = 'folders' in item;

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div style={{ paddingLeft: `${indent * 1}rem` }}>
      <div 
        className={`flex items-center py-1 cursor-pointer hover:opacity-80 ${currentTheme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
        onClick={() => isFolder && setIsOpen(!isOpen)}
        role={isFolder ? "button" : undefined}
        aria-expanded={isFolder ? isOpen : undefined}
        tabIndex={isFolder ? 0 : undefined}
        onKeyDown={isFolder ? (e) => { if (e.key === 'Enter' || e.key === ' ') setIsOpen(!isOpen); } : undefined}
      >
        <span className="mr-2 flex-shrink-0">
          {isFolder ? (isOpen ? Icons.folderOpen : Icons.folder) : Icons.file}
        </span>
        <span className="truncate" title={item.path}>{item.name}</span>
        {!isFolder && <span className="ml-2 text-xs opacity-60">({(item as IngestedFile).type}, {formatBytes((item as IngestedFile).size)})</span>}
      </div>
      {isFolder && isOpen && (item as IngestedFolder).folders.map(subFolder => (
        <FileTreeItem key={subFolder.id} item={subFolder} indent={indent + 1} currentTheme={currentTheme} />
      ))}
      {isFolder && isOpen && (item as IngestedFolder).files.map(file => (
        <FileTreeItem key={file.id} item={file} indent={indent + 1} currentTheme={currentTheme} />
      ))}
    </div>
  );
};

const FileManagerPanel: React.FC<FileManagerPanelProps> = ({ 
    ingestedData, 
    onIngestRequest, 
    isIngesting, 
    ingestProgress, 
    currentTheme,
    aiOrganizedSuggestion,
    isAiOrganizing,
    onAiOrganizeRequest,
    apiKeyExists
}) => {
  
  const handleDownloadSummary = () => {
    if (ingestedData) {
        const blob = new Blob([ingestedData.summaryText], { type: "text/plain;charset=utf-8" });
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = `${ingestedData.rootName}_summary.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
    }
  };

  const summaryBoxBaseClass = `flex-grow overflow-y-auto p-3 rounded whitespace-pre-wrap text-xs md:text-sm font-mono border`;
  const summaryBoxThemeClass = currentTheme === 'dark' 
    ? 'bg-gray-800 text-gray-300 border-gray-700' 
    : 'bg-gray-100 text-gray-700 border-gray-300';

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Top section: File Tree & Actions */}
      <div className="flex flex-col md:flex-row md:h-2/3 gap-4"> {/* Adjusted height */}
        {/* Left Pane: File Tree & Actions */}
        <div className="md:w-1/3 lg:w-1/4 p-4 panel flex flex-col overflow-y-auto"> {/* Added overflow-y-auto */}
          <h3 className="text-xl font-semibold mb-3 text-accent flex items-center">
            {Icons.folderTree}
            <span className="ml-2">Ingest Explorer</span>
          </h3>
          <button
            onClick={onIngestRequest}
            disabled={isIngesting}
            className="w-full button-accent mb-4 flex items-center justify-center space-x-2"
          >
            {Icons.upload}
            <span>{ingestedData ? 'Re-Ingest Folder' : 'Ingest Folder'}</span>
          </button>
          {isIngesting && (
             <div className="w-full mb-2">
                <div className="progress-bar-container">
                    <div className="progress-bar" style={{ width: `${ingestProgress}%` }}>
                         {ingestProgress > 10 && <span className="text-xs">{Math.round(ingestProgress)}%</span>}
                    </div>
                </div>
                <p className="text-xs text-center mt-1">Ingesting...</p>
            </div>
          )}
          {ingestedData ? (
            <div className="flex-grow overflow-y-auto pr-1"> {/* Added pr-1 for scrollbar space */}
              <FileTreeItem item={ingestedData.fileTree} indent={0} currentTheme={currentTheme} />
            </div>
          ) : (
            <p className={`text-sm ${currentTheme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
              No folder ingested yet. Click "Ingest Folder" to start.
            </p>
          )}
        </div>

        {/* Right Pane: Ingest Summary Preview */}
        <div className="md:w-2/3 lg:w-3/4 p-4 panel flex flex-col overflow-hidden">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xl font-semibold text-accent">Ingest Summary (.txt Preview)</h3>
            {ingestedData && (
              <div className="flex space-x-2">
                <button 
                    onClick={handleDownloadSummary}
                    className="button-accent text-xs px-3 py-1 flex items-center space-x-1"
                    title="Download full summary text"
                >
                    {Icons.download} <span>Download Summary</span>
                </button>
                {apiKeyExists && (
                    <button 
                        onClick={onAiOrganizeRequest}
                        disabled={isAiOrganizing || isIngesting}
                        className="button-accent text-xs px-3 py-1 flex items-center space-x-1"
                        title="Ask AI to suggest a new folder structure"
                    >
                        {isAiOrganizing ? (
                             <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                                 style={{ borderColor: currentTheme === 'dark' ? 'var(--accent-text-dark)' : 'var(--accent-text-light)', borderTopColor: 'transparent' }}>
                            </div>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10 3.75a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 3.75zM10 8.75a.75.75 0 01.75.75v1.5a.75.75 0 01-1.501 0v-1.5A.75.75 0 0110 8.75zM10 13.75a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5a.75.75 0 01.75-.75z"/></svg>
                        )}
                        <span>AI Organize Structure</span>
                    </button>
                )}
              </div>
            )}
          </div>
          <pre className={`${summaryBoxBaseClass} ${summaryBoxThemeClass} flex-grow`}>
            {ingestedData ? ingestedData.summaryText : 'Ingest a folder to see its summary here.'}
          </pre>
        </div>
      </div>
      
      {/* Bottom section: AI Organized Suggestion */}
      {(aiOrganizedSuggestion || isAiOrganizing) && apiKeyExists && (
        <div className="flex-grow p-4 panel flex flex-col overflow-hidden mt-4 md:h-1/3"> {/* Adjusted height and margin */}
          <h3 className="text-xl font-semibold mb-3 text-accent">AI Suggested Reorganization</h3>
           {isAiOrganizing && !aiOrganizedSuggestion && (
            <div className="flex items-center justify-center h-full">
                <div className="flex items-center space-x-2 text-sm">
                    <div className={`w-2 h-2 ${currentTheme === 'dark' ? 'bg-gray-400' : 'bg-gray-500'} rounded-full animate-pulse delay-75`}></div>
                    <div className={`w-2 h-2 ${currentTheme === 'dark' ? 'bg-gray-400' : 'bg-gray-500'} rounded-full animate-pulse delay-150`}></div>
                    <div className={`w-2 h-2 ${currentTheme === 'dark' ? 'bg-gray-400' : 'bg-gray-500'} rounded-full animate-pulse delay-300`}></div>
                    <span>Generating AI suggestion...</span>
                </div>
            </div>
          )}
          {aiOrganizedSuggestion && (
            <pre className={`${summaryBoxBaseClass} ${summaryBoxThemeClass} flex-grow`}>
              {aiOrganizedSuggestion}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

export default FileManagerPanel;
