
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom'; // Added missing import
import { useAppContext } from '../../contexts/AppContext';
import { EvidenceFile } from '../../types';
// import { mcpCreateZip, mcpWriteFile } from '../../services/mcpService'; // Replaced
import LoadingSpinner from '../ui/LoadingSpinner';

const ExportCenterPage: React.FC = () => {
  const { 
      files, addAuditLogEntry, 
      setIsLoading: setAppIsLoading, isLoading: isAppLoading, // Use global loading state
      setError, 
      mcpClient, isMcpClientLoading 
    } = useAppContext();

  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<'zip' | 'pdf_bundle' | 'csv_index'>('zip');
  const [bundleName, setBundleName] = useState(`Evidence_Bundle_${new Date().toISOString().split('T')[0]}`);

  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds(prev => 
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
    );
  };

  const selectedFiles = useMemo(() => {
    return files.filter(f => selectedFileIds.includes(f.id));
  }, [files, selectedFileIds]);

  const handleExport = async () => {
    if (selectedFiles.length === 0) {
      setError("Please select at least one file to export.");
      return;
    }
    if (!mcpClient || !mcpClient.ready) {
      setError(`MCP Client is not ready. Status: ${isMcpClientLoading ? 'Loading config...' : (mcpClient?.getInitializationError() || 'Unknown error')}. Export aborted.`);
      return;
    }

    setAppIsLoading(true);
    setError(null);
    try {
      const mcpFilePaths = selectedFiles.map(f => f.mcpPath).filter(p => p) as string[]; // Ensure paths are valid
      if (mcpFilePaths.length !== selectedFiles.length && exportFormat === 'zip') {
          setError("Some selected files do not have valid MCP paths. Cannot create ZIP.");
          setAppIsLoading(false);
          return;
      }

      const outputFileName = `${bundleName}.${exportFormat === 'csv_index' ? 'csv' : (exportFormat === 'pdf_bundle' ? 'pdf' : 'zip')}`;
      const outputPath = `/exports/${outputFileName}`; // Target MCP path for the bundle/index

      let success = false;
      let operationDetails = "";

      if (exportFormat === 'zip') {
        if(mcpFilePaths.length === 0) {
            operationDetails = "No valid MCP paths found for selected files to zip.";
        } else {
            success = await mcpClient.createZip(mcpFilePaths, outputPath);
            operationDetails = `ZIP creation for ${mcpFilePaths.length} files to ${outputPath}. Success: ${success}`;
        }
      } else if (exportFormat === 'pdf_bundle') {
        // This remains highly simulated as frontend PDF bundling is complex.
        // A real implementation would send file IDs/paths to an MCP endpoint that handles bundling.
        operationDetails = `PDF Bundle (simulated) requested for ${selectedFiles.length} files to ${outputPath}.`;
        success = true; // Simulate success for PDF bundle
        addAuditLogEntry('EXPORT_PDF_BUNDLE_SIMULATED', operationDetails);
      } else if (exportFormat === 'csv_index') {
        const csvHeader = "ID,Name,Type,McpPath,Tags,Summary,ReferencedPolicies\n";
        const csvRows = selectedFiles.map(f => 
            `"${f.id}","${f.name.replace(/"/g, '""')}","${f.type}","${f.mcpPath || 'N/A'}","${f.tags.map(t=>t.name).join(';')}","${(f.summary || '').replace(/"/g, '""')}","${(f.referencedPolicies || []).map(p=>p.policyNumber).join(';')}"`
        ).join('\n');
        const csvContent = csvHeader + csvRows;
        success = await mcpClient.writeFile(outputPath, csvContent); // Write CSV to MCP
        operationDetails = `CSV Index generation to ${outputPath} for ${selectedFiles.length} files. Success: ${success}`;
      }

      if (success) {
        alert(`Export successful (or simulated)! Bundle "${outputFileName}" operation details: ${operationDetails}`);
        addAuditLogEntry('EXPORT_SUCCESS', operationDetails);
        setSelectedFileIds([]); 
      } else {
        setError(`Export failed for ${exportFormat}. Details: ${operationDetails || "Unknown MCP error."}`);
        addAuditLogEntry('EXPORT_FAILED', operationDetails || `Export failed for ${exportFormat}.`);
      }

    } catch (err: any) {
      setError(`Export error: ${err.message}`);
      addAuditLogEntry('EXPORT_ERROR_EXCEPTION', `Exception during export: ${err.message}`);
    } finally {
      setAppIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-3xl font-semibold text-textPrimary">Export Center</h2>

       { (isMcpClientLoading || (mcpClient && !mcpClient.ready)) && (
        <div className="p-4 bg-yellow-100 dark:bg-yellow-900 border border-yellow-500 text-yellow-700 dark:text-yellow-300 rounded-md">
          MCP Client Status: {isMcpClientLoading ? 'Initializing...' : (mcpClient?.getInitializationError() || 'Not ready.')} Export operations might fail.
        </div>
      )}

      <div className="bg-surface p-6 rounded-lg shadow border border-border space-y-4">
        <div>
          <label htmlFor="bundleName" className="block text-sm font-medium text-textSecondary">Bundle Name</label>
          <input
            type="text"
            id="bundleName"
            value={bundleName}
            onChange={(e) => setBundleName(e.target.value)}
            className="mt-1 block w-full px-3 py-2 bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="exportFormat" className="block text-sm font-medium text-textSecondary">Export Format</label>
          <select 
            id="exportFormat"
            value={exportFormat} 
            onChange={(e) => setExportFormat(e.target.value as 'zip' | 'pdf_bundle' | 'csv_index')}
            className="mt-1 block w-full px-3 py-2 bg-background border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
          >
            <option value="zip">ZIP Archive (Original Files from MCP)</option>
            <option value="pdf_bundle">PDF Bundle (Combined into one PDF - Simulated)</option>
            <option value="csv_index">CSV Index (List of files and metadata - Saved to MCP)</option>
          </select>
        </div>
      </div>

      <div className="bg-surface p-6 rounded-lg shadow border border-border">
        <h3 className="text-xl font-semibold text-textPrimary mb-3">Select Files to Export ({selectedFileIds.length} selected)</h3>
        {files.length > 0 ? (
          <div className="max-h-96 overflow-y-auto space-y-2 border border-border p-3 rounded-md bg-background">
            {files.map(file => (
              <label key={file.id} className="flex items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md cursor-pointer">
                <input 
                  type="checkbox"
                  checked={selectedFileIds.includes(file.id)}
                  onChange={() => toggleFileSelection(file.id)}
                  className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary mr-3"
                />
                <span className="text-textPrimary">{file.name} <span className="text-xs text-textSecondary">({file.type}) - MCP Path: {file.mcpPath || "N/A"}</span></span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-textSecondary text-center py-4">No files available to export. <Link to="/ingestion" className="text-primary hover:underline">Add some files</Link>.</p>
        )}
      </div>

      <button
        onClick={handleExport}
        disabled={isAppLoading || selectedFileIds.length === 0 || !mcpClient?.ready}
        className="w-full bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 text-lg font-semibold flex items-center justify-center"
      >
        {isAppLoading ? <LoadingSpinner size="sm" /> : (
            <>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            { !mcpClient?.ready ? 'MCP Client Not Ready' : 'Export Selected Files'}
            </>
        )}
      </button>
    </div>
  );
};

export default ExportCenterPage;
