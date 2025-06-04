import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { useAppContext } from '../../contexts/AppContext';
import { McpClient } from '../../services/McpClient'; // Assuming FileSystemOperation will be defined in McpClient or types
import LoadingSpinner from '../ui/LoadingSpinner';

// Define a more specific type for AI suggestions
interface AiOrganizationSuggestion {
  originalRelativePath: string; // Relative to the user's selected folder root
  newRelativePathInOrganizedFolder: string; // Relative to a new base path for the organized folder
  // e.g. if selected folder was 'MyDocs', original is 'MyDocs/report.pdf'
  // newBasePath might be '/uploads/Case_123_Organized/'
  // newRelativePathInOrganizedFolder might be 'Evidence/Financials/Q1_Report_Renamed.pdf'
  // So final MCP path becomes '/uploads/Case_123_Organized/Evidence/Financials/Q1_Report_Renamed.pdf'
}

interface AiOrganizationPlan {
  newMcpBaseDirectory: string; // e.g., /uploads/Case_123_Organized - this is the root for the new structure
  directoriesToCreateOnMcp: string[]; // Full MCP paths, e.g., ['/uploads/Case_123_Organized/Evidence', '/uploads/Case_123_Organized/Correspondence']
  fileOperations: AiOrganizationSuggestion[];
  aiRationale?: string;
}

interface AiOrganizationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalFiles: { originalPath: string; name: string; size: number; type: string }[]; // Files as selected by user
  suggestions: AiOrganizationPlan | null; // The AI's plan
  onApplyComplete: (appliedPlan: AiOrganizationPlan) => void; // Changed to pass the whole plan
}

const AiOrganizationReviewModal: React.FC<AiOrganizationReviewModalProps> = ({
  isOpen,
  onClose,
  originalFiles,
  suggestions,
  onApplyComplete,
}) => {
  const { mcpClient, addAuditLogEntry, setIsLoading, setError } = useAppContext();
  const [isApplying, setIsApplying] = useState(false);
  const [operationLogs, setOperationLogs] = useState<string[]>([]);

  const handleApplyChanges = async () => {
    if (!suggestions || !mcpClient || !mcpClient.ready) {
      setError('Cannot apply changes: No suggestions or MCP client not ready.');
      return;
    }

    setIsApplying(true);
    setIsLoading(true);
    setOperationLogs([]);
    let success = true;
    const newMcpFilePaths: string[] = [];

    const log = (message: string) => setOperationLogs(prev => [...prev, message]);

    try {
      log(`Starting AI Organization Process. New base directory: ${suggestions.newMcpBaseDirectory}`);
      addAuditLogEntry('AI_ORGANIZATION_APPLY_START', `New base: ${suggestions.newMcpBaseDirectory}, ${suggestions.directoriesToCreateOnMcp.length} dirs, ${suggestions.fileOperations.length} files`);

      // 1. Create new directories
      for (const dirPath of suggestions.directoriesToCreateOnMcp) {
        log(`Attempting to create directory: ${dirPath}`);
        const dirSuccess = await mcpClient.createDirectory(dirPath);
        if (dirSuccess) {
          log(`SUCCESS: Directory created: ${dirPath}`);
        } else {
          log(`FAILURE: Failed to create directory: ${dirPath}. Halting operations.`);
          addAuditLogEntry('AI_ORGANIZATION_APPLY_ERROR', `Failed to create dir: ${dirPath}`, 'error');
          success = false;
          break;
        }
      }

      // 2. Move/Rename files if all directories were created
      if (success) {
        // We need the original File objects to read their content if MCP doesn't support server-side copy/move of content directly
        // For now, assuming MCP `renameFile` can move across directories and handles content.
        // The `originalFiles` prop gives us the user's selection. We need to map these to their operations.

        for (const op of suggestions.fileOperations) {
          // The `op.originalRelativePath` is relative to the user's *selected local folder*.
          // The actual MCP source path needs to be determined if these files were *already* uploaded to a temporary MCP location.
          // For this workflow, let's assume we are organizing files *before* their first proper ingestion,
          // OR that the AI is given current MCP paths if they are already on the server.

          // **Simplification for this iteration:**
          // Assume `op.originalRelativePath` is an IDENTIFIER that can be mapped to a source file whose content will be written to the new path.
          // Or, if your McpClient.renameFile is truly a server-side move based on paths, you need the *current MCP source path*.

          // Let's assume `FileIngestionPage` uploads files to a temporary unique MCP path first,
          // and `op.originalRelativePath` is actually this temporary MCP source path.
          // For now, this modal doesn't know the temporary MCP source paths.

          // **Revised Assumption for this Modal's Responsibility:**
          // This modal assumes it's operating on files that are NOT yet on MCP in their final state.
          // It will instruct the FileIngestionPage to use these new paths when it DOES write them.
          // OR, if this modal is to *directly* manipulate files already on MCP, it needs the current MCP paths.

          // Given the `FileIngestionPage` context, it's more likely we are deciding the *target* paths.
          // The `handleStartAiOrganizationProcess` in FileIngestionPage prepares `filesToOrganize`
          // with `originalPath: file.webkitRelativePath`. These are local paths.

          // This modal should probably return the *plan* to FileIngestionPage,
          // which then handles uploading content to the *new* planned MCP paths.

          // For a direct manipulation modal (files already on MCP):
          // const oldMcpPath = op.originalMcpPath; // This would need to be part of AiOrganizationSuggestion
          const newMcpPath = `${suggestions.newMcpBaseDirectory}/${op.newRelativePathInOrganizedFolder}`.replace(/\/\//g, '/');

          // THIS IS WHERE THE LOGIC IS TRICKY - what is the source?
          // For this iteration, let's PRETEND `renameFile` takes a *local source file content* and a *target MCP path*.
          // This is not how `renameFile` typically works. `renameFile` implies existing resource on server.
          // McpClient.writeFile(newMcpPath, fileContent) is more appropriate here if organizing local files to new MCP structure.

          // Let's pivot: this modal CONFIRMS the plan. FileIngestionPage EXECUTES the upload to new paths.
          // So, this handleApplyChanges should simply call onApplyComplete with the plan.
          // The actual file writing will happen in FileIngestionPage based on this confirmed plan.

          // Keeping simplified MCP interaction for placeholder, but highlighting the issue:
          log(`File op (conceptual): ${op.originalRelativePath} -> ${newMcpPath}`); // Log conceptual path
          // This is conceptually what should happen, but McpClient might need a direct writeFile.
          // For now, we assume the onApplyComplete will handle the actual writing.
          // newMcpFilePaths.push(newMcpPath); // No longer collecting flat paths here
        }
      }

      if (success) { // Simpler check: if all directory creations succeeded
        log('Directory structure plan appears successful. Passing plan for file operations.');
        addAuditLogEntry('AI_ORGANIZATION_PLAN_READY', `Plan for ${suggestions.fileOperations.length} files ready.`);
        onApplyComplete(suggestions); // Pass the entire plan
      } else {
         log('Directory creation failed. Please review logs. Plan not applied.');
         setError('Failed to create directory structure for AI organization. Plan not applied.')
      }

    } catch (error: any) {
      console.error('Error applying AI organization changes:', error);
      log(`CRITICAL ERROR: ${error.message}`);
      setError(`Critical error during AI organization: ${error.message}`);
      addAuditLogEntry('AI_ORGANIZATION_APPLY_CRITICAL_ERROR', error.message, 'error');
      success = false;
    } finally {
      setIsApplying(false);
      setIsLoading(false);
      // onClose(); // Keep modal open to show logs, user can close manually.
    }
  };

  if (!isOpen || !suggestions) return null;

  return (
    <Modal
      title="AI Folder Organization Review"
      isOpen={isOpen}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-md text-textPrimary hover:bg-gray-100 dark:hover:bg-gray-700" disabled={isApplying}>
            Cancel
          </button>
          <button onClick={handleApplyChanges} className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark flex items-center" disabled={isApplying || !mcpClient?.ready}>
            {isApplying && <LoadingSpinner size="sm" />}
            {isApplying ? 'Applying...' : (mcpClient?.ready ? 'Apply Approved Changes' : 'MCP Not Ready')}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <h4 className="font-semibold text-textPrimary">AI Rationale:</h4>
          <p className="text-sm text-textSecondary italic">{suggestions.aiRationale || 'No rationale provided.'}</p>
        </div>

        <div>
          <h4 className="font-semibold text-textPrimary">New Base Directory on MCP:</h4>
          <p className="text-sm text-textSecondary font-mono">{suggestions.newMcpBaseDirectory}</p>
        </div>

        {suggestions.directoriesToCreateOnMcp.length > 0 && (
          <div>
            <h4 className="font-semibold text-textPrimary">Directories to Create:</h4>
            <ul className="list-disc list-inside pl-4 text-sm text-textSecondary">
              {suggestions.directoriesToCreateOnMcp.map((dir, index) => (
                <li key={index} className="font-mono">{dir}</li>
              ))}
            </ul>
          </div>
        )}

        {suggestions.fileOperations.length > 0 && (
          <div>
            <h4 className="font-semibold text-textPrimary">File Operations (Move/Rename):</h4>
            <div className="max-h-60 overflow-y-auto text-sm space-y-1">
              {suggestions.fileOperations.map((op, index) => (
                <div key={index} className="p-2 border border-border rounded bg-background-alt">
                  <p className="text-textSecondary">From (original relative): <span className="font-mono">{op.originalRelativePath}</span></p>
                  <p className="text-green-600 dark:text-green-400">To (new relative in organized folder): <span className="font-mono">{op.newRelativePathInOrganizedFolder}</span></p>
                  <p className="text-xs text-textTertiary">Full new MCP path (conceptual): <span className="font-mono">{`${suggestions.newMcpBaseDirectory}/${op.newRelativePathInOrganizedFolder}`.replace(/\/\//g, '/')}</span></p>
                </div>
              ))}
            </div>
          </div>
        )}

        {operationLogs.length > 0 && (
            <div>
                <h4 className="font-semibold text-textPrimary mt-3">Operation Log:</h4>
                <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-800 rounded-md max-h-40 overflow-y-auto text-xs border border-border">
                    {operationLogs.map((log, index) => (
                        <p key={index} className={`whitespace-pre-wrap ${log.startsWith('FAILURE') || log.startsWith('CRITICAL') ? 'text-red-500' : (log.startsWith('SUCCESS') ? 'text-green-500' : 'text-textSecondary')}`}>{log}</p>
                    ))}
                </div>
            </div>
        )}

      </div>
    </Modal>
  );
};

export default AiOrganizationReviewModal;

// TODO: Define FileSystemOperation in a shared types file or McpClient.ts if it's to be used for batch operations directly by McpClient
// For now, it's implied by AiOrganizationPlan structure
// export interface FileSystemOperation { type: 'CREATE_DIR' | 'RENAME_FILE' | 'DELETE_FILE'; path: string; newPath?: string; }