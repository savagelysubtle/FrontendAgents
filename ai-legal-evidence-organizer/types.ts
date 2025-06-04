export interface EvidenceFile {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'txt' | 'img' | 'unknown';
  content: string; // For text files, base64 for images, or path for actual files
  summary?: string;
  tags: Tag[];
  annotations: Annotation[];
  metadata: {
    author?: string;
    createdAt?: string; // ISO date string
    modifiedAt?: string; // ISO date string
    source?: string;
    size?: number; // bytes
  };
  mcpPath: string; // Path on the simulated MCP server
  isProcessing?: boolean; // For UI feedback during AI processing
  referencedPolicies?: PolicyReference[]; // Added for policy linking
}

export interface Tag {
  id:string;
  name: string;
  color: string; // e.g., 'bg-red-500'
  criteria?: 'admission' | 'minimization' | 'omission' | 'contradiction' | 'chronic pain' | 'causation' | 'other' | 'wcat_pattern_generic'; // Extended for WCAT patterns
  scope?: 'evidence_marker' | 'wcat_pattern' | 'general_keyword'; // New field for better categorization
}

export interface Annotation {
  id: string;
  fileId: string;
  text: string; // Highlighted text or user note
  quote?: string; // Actual quote from document
  page?: number; // For PDF/DOCX
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string; // ISO date string
  relatedFileIds?: string[];
  relatedWcatCaseIds?: string[];
  relatedToolIds?: string[]; // Added for tool context
}

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO date string
  action: string; // e.g., 'FILE_UPLOADED', 'TAG_ADDED', 'AI_SUMMARY_GENERATED'
  details: string; // e.g., 'File "report.pdf" uploaded' or JSON stringify of params
}

export interface DirectoryNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: DirectoryNode[];
}

// Gemini API specific (simplified)
export interface GeminiResponse { // For non-streaming
  text: string;
  // If grounding is used
  candidates?: Array<{
    groundingMetadata?: {
      groundingChunks?: Array<{ web: { uri: string; title: string } }>;
    };
  }>;
}

export enum Theme {
  Light = 'light',
  Dark = 'dark'
}

export interface McpServerStatus {
  isRunning: boolean;
  version?: string;
  allowedDirectories?: string[];
  error?: string; // Added optional error field
}

// New types for WCAT and Policy integration

export interface PolicyReference {
  policyNumber: string; // e.g., "C3-16.00"
  policyTitle?: string; // Optional: "Chronic Pain"
  manualVersion?: string; // Example versions like "RSCM I", "RSCM II", or user-defined manual name
}

export interface WcatCase {
  id: string; // Unique ID, could be the decisionNumber
  decisionNumber: string; // e.g., "2022-00234"
  year: number;
  applicantIdentifier?: string; // Anonymized if possible
  outcomeSummary: string; // AI generated or extracted
  referencedPolicies: PolicyReference[];
  keywords: string[]; // Legal/medical terms
  keyQuotes: Array<{ quote: string; page?: number; context?: string }>;
  fullPdfUrl: string; // Direct link to PDF
  aiSummary: string; // Overall AI summary of the case
  ingestedAt: string; // ISO date string
  // embeddings?: number[]; // For future advanced RAG
  rawTextContent?: string; // Temporary storage of extracted text for re-analysis if needed
  tags: Tag[]; // Added for pattern tagging and other relevant keywords
  mcpPath?: string; // Path on the MCP server where the original PDF is stored
}

// Represents an individual policy entry extracted from a manual
export interface PolicyEntry {
  policyNumber: string;
  title?: string;
  page?: number;
  snippet?: string;
}

// Represents an entire policy manual document (e.g., a PDF)
export interface PolicyManual {
  id: string;
  manualName: string;
  sourceUrl?: string;
  mcpPath: string;
  version?: string;
  ingestedAt: string;
  rawTextContent?: string;
  policyEntries: PolicyEntry[];
  isProcessing?: boolean;
}


export interface WcatSearchResultItem {
    decisionNumber: string;
    title: string; // e.g. "Decision No. WCAT-2023-00001"
    pdfUrl: string;
    snippet?: string; // Short summary from search result
    date?: string;
}

export interface WcatCaseInfoExtracted { // For Gemini JSON response
    decisionNumber: string;
    year?: number;
    applicantIdentifier?: string;
    outcomeSummary?: string;
    referencedPolicies?: PolicyReference[];
    keywords?: string[];
    keyQuotes?: Array<{ quote: string; page?: number; context?: string }>;
    aiSummary?: string;
}

export interface SavedChatSession {
  id: string;
  name: string;
  timestamp: string; // ISO string of save time
  messages: ChatMessage[];
  relatedFileIds?: string[];
  relatedWcatCaseIds?: string[];
  relatedToolIds?: string[]; // Added for tool context
}

// For mcp.json (user-provided server execution definitions)
export interface McpServerProcessConfig {
  command: string;
  type?: 'stdio' | 'http'; // Optional type, 'stdio' is common in MCP docs for local
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  description?: string;
  usageExample?: string;
}
export interface McpUserProvidedServers {
  mcpServers: Record<string, McpServerProcessConfig>;
}

// Interface for StdioClientTransport options, based on SDK usage
export interface McpStdioOptions {
  command: string; // The command to execute for the stdio server
  args?: string[]; // Arguments for the command
  cwd?: string; // Current working directory for the command
  env?: Record<string, string>; // Environment variables for the command
}

// For mcp_api_configs.json (API connection configurations)
export interface McpApiEndpoints {
  listDirectory: string;
  readFile: string;
  writeFile: string;
  renameFile: string;
  deleteFileOrDirectory: string;
  getDirectoryTree: string;
  batchRenameFiles: string;
  createZip: string;
  addAllowedDirectory: string;
  getServerStatus: string;
}

export interface McpApiConfig {
  configName: string;
  baseApiUrl?: string; // Now optional, only used if transportType is 'http' or for older custom HTTP MCPs
  endpoints?: McpApiEndpoints; // Optional: Relevant for non-SDK HTTP direct API calls
  requestTimeoutMs?: number;
  expectedServerVersion?: string;
  transportType?: 'http' | 'stdio'; // Defines the transport mechanism for SDK-based clients
  stdioOptions?: McpStdioOptions; // Options for stdio transport
}

// New type for AI Tools
export interface AiTool {
  id: string;
  name: string;
  description: string;
  type: 'mcp_process' | 'custom_abstract'; // 'mcp_process' derived from mcp.json, 'custom_abstract' user-defined
  usageExample?: string; // How to conceptually use the tool in chat
  // For mcp_process tools, we can store the original command details for reference, though client won't execute directly
  mcpProcessDetails?: {
    command: string;
    args: string[];
    cwd?: string;
  };
  isAvailable?: boolean; // Could be used if a tool's backend (mcp_process) has a health check
}

// Phase 4: MCP Server Tool and AG-UI Frontend Tool Definitions
export interface McpServerToolDef {
  name: string;
  description?: string;
  inputSchema: any; // JSONSchema7
  outputSchema?: any; // JSONSchema7
  annotations?: Record<string, any>;
}

export interface AgUiFrontendToolDef {
  name: string;
  description: string;
  parametersSchema: any; // JSONSchema7 for parameters
}

// Phase 5: DynamicMarker for Generative UI
export interface DynamicMarker {
  id: string;
  text: string; // The text to highlight or mark
  type: 'highlight' | 'underline' | 'comment' | 'reference';
  color?: string; // e.g., 'yellow-300', 'blue-500' for highlights
  commentText?: string; // For comment type
  referenceTarget?: { fileId?: string; wcatId?: string; policyId?: string }; // For reference type
  uiElementId?: string; // ID of the UI element this marker is associated with (optional)
}

// Added for AI Folder Organization Feature
export interface AiOrganizationSuggestion {
  originalRelativePath: string; // Relative to the user's selected folder root (e.g., 'MyFolder/report.pdf')
  newRelativePathInOrganizedFolder: string; // Relative to a new base path for the organized folder (e.g., 'Evidence/Financials/Q1_Report_Renamed.pdf')
  // originalFile: File; // Could be useful to pass the original File object if needed later for content reading
}

export interface AiOrganizationPlan {
  newMcpBaseDirectory: string; // e.g., /uploads/Case_123_Organized - this is the root for the new structure on MCP
  directoriesToCreateOnMcp: string[]; // Full MCP paths to create, e.g., ['/uploads/Case_123_Organized/Evidence']
  fileOperations: AiOrganizationSuggestion[];
  aiRationale?: string;
}

export type AuditLogStatusType = 'info' | 'success' | 'warning' | 'error';