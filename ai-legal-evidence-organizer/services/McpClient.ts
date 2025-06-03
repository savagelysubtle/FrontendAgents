import { DirectoryNode, McpServerStatus } from '../types';
import { Client as SdkMcpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport, StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js';
// import { ToolCallParams, ToolCallResult } from '@modelcontextprotocol/sdk/common'; // REMOVED
import { RequestId } from '@modelcontextprotocol/sdk/types.js'; // RequestId might be needed if constructing full RequestMessages - Json and RequestMessage removed

/**
 * Details for connecting to an MCP server via HTTP/S.
 */
export interface HttpTransportDetails {
  type: 'http';
  baseApiUrl: string;
  endpoints: {
    listDirectory: string;
    readFile: string;
    writeFile: string;
    renameFile: string;
    deleteFileOrDirectory: string;
    getDirectoryTree: string;
    createZip: string;
    addAllowedDirectory: string;
    getServerStatus: string; // This might be an absolute URL or relative
    // Add other specific HTTP endpoints your client uses
  };
}

/**
 * Details for connecting to an MCP server via Stdio.
 */
export interface StdioTransportDetails {
  type: 'stdio';
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  // Map your client's abstract operations to actual MCP tool names
  toolMappings: {
    listDirectory: string; // e.g., 'fs_list_directory'
    readFile: string;      // e.g., 'fs_read_file'
    writeFile: string;     // e.g., 'fs_write_file'
    renameFile: string;    // e.g., 'fs_rename_file'
    deleteFileOrDirectory: string; // e.g., 'fs_delete'
    getDirectoryTree: string; // e.g., 'fs_get_tree'
    createZip: string;     // e.g., 'fs_create_zip'
    addAllowedDirectory: string; // e.g., 'fs_add_allowed_dir'
    getServerStatus?: string; // Optional: if status is also a tool
    // Add mappings for any other operations
  };
}

export type McpTransportConfig = HttpTransportDetails | StdioTransportDetails;

/**
 * Main configuration for the McpClient.
 */
export interface McpApiConfig {
  configName: string;
  transportConfig: McpTransportConfig;
  requestTimeoutMs?: number; // Primarily for HTTP, but can be a general timeout
  expectedServerVersion?: string;
}

export class McpClient {
  private apiConfig: McpApiConfig | null = null;
  private initialized: boolean = false;
  private initializationError: string | null = null;
  private addAuditLog: (action: string, details: string) => void;

  private sdkStdioClient: SdkMcpClient | null = null;
  private stdioTransport: StdioClientTransport | null = null;

  constructor(addAuditLogEntry: (action: string, details: string) => void) {
    this.addAuditLog = addAuditLogEntry;
  }

  public async initialize(apiConfig: McpApiConfig | null): Promise<void> {
    if (!apiConfig) {
      this.apiConfig = null;
      this.initialized = false;
      this.initializationError = "No API configuration provided to McpClient.";
      this.addAuditLog('MCP_CLIENT_INIT_ERROR', this.initializationError);
      console.error(this.initializationError);
      return;
    }

    this.apiConfig = apiConfig;
    this.initializationError = null; // Reset error

    try {
      if (this.apiConfig.transportConfig.type === 'stdio') {
        this.addAuditLog('MCP_CLIENT_INIT_START_STDIO', `Initializing Stdio transport for ${apiConfig.configName}. Command: ${this.apiConfig.transportConfig.command}`);
        this.sdkStdioClient = new SdkMcpClient({
          name: `mcp-legal-aid-client-${apiConfig.configName}`,
          version: '1.0.0' // Or your client's version
        });

        const stdioParams: StdioServerParameters = {
          command: this.apiConfig.transportConfig.command,
          args: this.apiConfig.transportConfig.args || [],
          cwd: this.apiConfig.transportConfig.cwd,
          env: this.apiConfig.transportConfig.env,
        };
        this.stdioTransport = new StdioClientTransport(stdioParams);

        // Attempt to connect. This might throw if the server process fails to start.
        await this.sdkStdioClient.connect(this.stdioTransport);

        this.initialized = true;
        this.addAuditLog('MCP_CLIENT_INIT_SUCCESS_STDIO', `Stdio MCP Client initialized and connected for ${apiConfig.configName}.`);
        console.log('Stdio MCP Client Initialized and connected for:', this.apiConfig.configName);

      } else if (this.apiConfig.transportConfig.type === 'http') {
        this.addAuditLog('MCP_CLIENT_INIT_START_HTTP', `Initializing HTTP transport for ${apiConfig.configName}. Base URL: ${this.apiConfig.transportConfig.baseApiUrl}`);
        // HTTP initialization is simpler, mostly config storage
        this.initialized = true;
        this.addAuditLog('MCP_CLIENT_INIT_SUCCESS_HTTP', `HTTP MCP Client initialized for ${apiConfig.configName}.`);
        console.log('HTTP MCP Client Initialized with API config:', this.apiConfig);
      } else {
        throw new Error('Invalid transport type in McpApiConfig.');
      }
    } catch (error: any) {
      this.initialized = false;
      this.initializationError = `Failed to initialize MCP client for ${apiConfig.configName} (${apiConfig.transportConfig.type}): ${error.message}`;
      this.addAuditLog('MCP_CLIENT_INIT_ERROR', this.initializationError);
      console.error(this.initializationError, error);
      if (this.stdioTransport) {
        await this.stdioTransport.close(); // Ensure transport is closed on error
        this.stdioTransport = null;
      }
      this.sdkStdioClient = null;
    }
  }

  public async close(): Promise<void> {
    if (this.apiConfig?.transportConfig.type === 'stdio' && this.sdkStdioClient) {
      this.addAuditLog('MCP_CLIENT_CLOSE_STDIO', `Closing Stdio MCP Client for ${this.apiConfig.configName}.`);
      try {
        await this.sdkStdioClient.close();
      } catch (error: any) {
        this.addAuditLog('MCP_CLIENT_CLOSE_STDIO_ERROR', `Error closing Stdio client: ${error.message}`);
        console.error(`Error closing Stdio client for ${this.apiConfig.configName}:`, error);
      } finally {
        this.sdkStdioClient = null;
        this.stdioTransport = null; // Already closed by sdkStdioClient.close() or during init error
        this.initialized = false;
      }
    }
    // No specific close action needed for the simple HTTP client beyond resetting state
    this.apiConfig = null;
    this.initialized = false;
    this.initializationError = null;
    this.addAuditLog('MCP_CLIENT_CLOSED', 'MCP Client state reset.');
  }

  private getHttpEndpointUrl(endpointKey: keyof HttpTransportDetails['endpoints'], params?: Record<string, string>): string {
    if (!this.apiConfig || this.apiConfig.transportConfig.type !== 'http') {
      throw new Error('HTTP transport not configured or active.');
    }
    const httpConfig = this.apiConfig.transportConfig;
    const endpointPathOrUrl = httpConfig.endpoints[endpointKey];
    let url: string;

    if (endpointPathOrUrl.startsWith('http://') || endpointPathOrUrl.startsWith('https://')) {
        url = endpointPathOrUrl;
    } else {
        url = `${httpConfig.baseApiUrl}${endpointPathOrUrl}`;
    }

    if (params) {
      const queryParams = new URLSearchParams(params);
      url = `${url}?${queryParams.toString()}`;
    }
    return url;
  }

  private async httpRequest<T>(
    endpointKey: keyof HttpTransportDetails['endpoints'],
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: any,
    queryParams?: Record<string, string>
  ): Promise<T> {
    if (!this.initialized || this.initializationError || !this.apiConfig || this.apiConfig.transportConfig.type !== 'http') {
      const errorMsg = `HTTP MCP Client not initialized, misconfigured, or not in HTTP mode: ${this.initializationError || 'API Config is missing/invalid'}`;
      this.addAuditLog(`MCP_HTTP_OP_ERROR_${endpointKey.toString().toUpperCase()}`, errorMsg);
      throw new Error(errorMsg);
    }

    const url = this.getHttpEndpointUrl(endpointKey, queryParams);
    this.addAuditLog(`MCP_HTTP_OP_${endpointKey.toString().toUpperCase()}_START`, `URL: ${url}, Method: ${method}, Timeout: ${this.apiConfig.requestTimeoutMs || 'N/A'}`);

    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;
    const requestTimeoutMs = this.apiConfig.requestTimeoutMs;

    if (requestTimeoutMs && requestTimeoutMs > 0) {
      timeoutId = setTimeout(() => {
        controller.abort();
        this.addAuditLog(`MCP_HTTP_OP_TIMEOUT_${endpointKey.toString().toUpperCase()}`, `Request to ${url} timed out after ${requestTimeoutMs}ms.`);
      }, requestTimeoutMs);
    }

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorText = await response.text().catch(() => '[Could not read error response body]');
        const errorMsg = `MCP HTTP Error (${endpointKey.toString()}): ${response.status} ${response.statusText}. Details: ${errorText}`;
        this.addAuditLog(`MCP_HTTP_OP_ERROR_${endpointKey.toString().toUpperCase()}`, errorMsg);
        throw new Error(errorMsg);
      }

      if (response.status === 204 || response.headers.get("content-length") === "0") {
        this.addAuditLog(`MCP_HTTP_OP_${endpointKey.toString().toUpperCase()}_SUCCESS_NO_CONTENT`, `URL: ${url}, Status: ${response.status}`);
        return { success: true } as unknown as T; // Assuming success for no-content responses
      }

      const data = await response.json();
      this.addAuditLog(`MCP_HTTP_OP_${endpointKey.toString().toUpperCase()}_SUCCESS`, `URL: ${url}, Response: ${JSON.stringify(data).substring(0,100)}...`);
      return data as T;
    } catch (error: any) {
       if (error.name === 'AbortError') {
         throw new Error(`Request to ${url} aborted (likely timed out).`);
       }
       this.addAuditLog(`MCP_HTTP_OP_ERROR_${endpointKey.toString().toUpperCase()}`, `Request to ${url} failed: ${error.message}`);
       throw error;
    } finally {
        if (timeoutId) clearTimeout(timeoutId);
    }
  }

  private async stdioToolCall<U extends { [key: string]: unknown } | undefined>(toolName: string, args: Record<string, any> | undefined): Promise<U> {
    if (!this.initialized || this.initializationError || !this.apiConfig || this.apiConfig.transportConfig.type !== 'stdio' || !this.sdkStdioClient) {
      const errorMsg = `Stdio MCP Client not initialized, misconfigured, or not in Stdio mode: ${this.initializationError || 'SDK Client is missing/invalid'}`;
      this.addAuditLog(`MCP_STDIO_OP_ERROR_${toolName.toUpperCase()}`, errorMsg);
      throw new Error(errorMsg);
    }

    this.addAuditLog(`MCP_STDIO_OP_${toolName.toUpperCase()}_START`, `Tool: ${toolName}, Args: ${JSON.stringify(args)}`);

    try {
      const result = await this.sdkStdioClient.callTool({ name: toolName, arguments: args }) as U;
      this.addAuditLog(`MCP_STDIO_OP_${toolName.toUpperCase()}_SUCCESS`, `Tool: ${toolName}, Result: ${JSON.stringify(result).substring(0,100)}...`);
      return result;
    } catch (error: any) {
      this.addAuditLog(`MCP_STDIO_OP_ERROR_${toolName.toUpperCase()}`, `Tool ${toolName} failed: ${error.message}`);
      throw error;
    }
  }

  private getToolNameForOperation(operation: keyof StdioTransportDetails['toolMappings']): string {
    if (!this.apiConfig || this.apiConfig.transportConfig.type !== 'stdio') {
      throw new Error('Cannot get tool name: Not in stdio mode.');
    }
    const toolName = this.apiConfig.transportConfig.toolMappings[operation];
    if (!toolName) {
      throw new Error(`No tool mapping found for operation: ${operation} in Stdio config.`);
    }
    return toolName;
  }

  // --- Public API Methods (Dispatchers) ---

  async listDirectory(path: string): Promise<DirectoryNode[]> {
    if (!this.isReady()) throw new Error(this.getInitializationError() || 'Client not ready.');
    try {
      if (this.apiConfig?.transportConfig.type === 'stdio') {
        const toolName = this.getToolNameForOperation('listDirectory');
        const result = await this.stdioToolCall<{ content?: { nodes: DirectoryNode[] } }>(toolName, { path });
        return result?.content?.nodes || [];
      } else if (this.apiConfig?.transportConfig.type === 'http') {
        const response = await this.httpRequest<{ nodes: DirectoryNode[] }>('listDirectory', 'GET', undefined, { path });
        return response.nodes || [];
      }
      throw new Error('Invalid transport configuration.');
    } catch (e: any) {
      console.warn(`MCP listDirectory failed for path "${path}", returning empty. Error:`, e.message);
      this.addAuditLog('MCP_LISTDIR_FALLBACK', `Path: ${path}, Error: ${e.message}`);
      return [];
    }
  }

  async readFile(path: string): Promise<{ name: string; content: string; type: string; size: number } | null> {
    if (!this.isReady()) throw new Error(this.getInitializationError() || 'Client not ready.');
    try {
      if (this.apiConfig?.transportConfig.type === 'stdio') {
        const toolName = this.getToolNameForOperation('readFile');
        const result = await this.stdioToolCall<{ content?: { name: string; content: string; type: string; size: number } | null }>(toolName, { path });
        return result?.content || null;
      } else if (this.apiConfig?.transportConfig.type === 'http') {
        return await this.httpRequest<{ name: string; content: string; type: string; size: number } | null>('readFile', 'GET', undefined, { path });
      }
      throw new Error('Invalid transport configuration.');
    } catch (e: any) {
      console.warn(`MCP readFile failed for path "${path}", returning null. Error:`, e.message);
      this.addAuditLog('MCP_READFILE_FALLBACK', `Path: ${path}, Error: ${e.message}`);
      return null;
    }
  }

  async writeFile(path: string, content: string): Promise<boolean> {
    if (!this.isReady()) throw new Error(this.getInitializationError() || 'Client not ready.');
    try {
      if (this.apiConfig?.transportConfig.type === 'stdio') {
        const toolName = this.getToolNameForOperation('writeFile');
        const result = await this.stdioToolCall<{ content?: { success: boolean } }>(toolName, { path, content });
        return result?.content?.success || false;
      } else if (this.apiConfig?.transportConfig.type === 'http') {
        const response = await this.httpRequest<{ success: boolean }>('writeFile', 'POST', { path, content });
        return response.success;
      }
      throw new Error('Invalid transport configuration.');
    } catch (e: any) {
      console.warn(`MCP writeFile failed for path "${path}", returning false. Error:`, e.message);
      this.addAuditLog('MCP_WRITEFILE_FALLBACK', `Path: ${path}, Error: ${e.message}`);
      return false;
    }
  }

  async renameFile(oldPath: string, newPath: string): Promise<boolean> {
    if (!this.isReady()) throw new Error(this.getInitializationError() || 'Client not ready.');
    try {
      if (this.apiConfig?.transportConfig.type === 'stdio') {
        const toolName = this.getToolNameForOperation('renameFile');
        const result = await this.stdioToolCall<{ content?: { success: boolean } }>(toolName, { oldPath, newPath });
        return result?.content?.success || false;
      } else if (this.apiConfig?.transportConfig.type === 'http') {
        const response = await this.httpRequest<{ success: boolean }>('renameFile', 'POST', { oldPath, newPath });
        return response.success;
      }
      throw new Error('Invalid transport configuration.');
    } catch (e: any) {
      console.warn(`MCP renameFile failed for "${oldPath}" to "${newPath}", returning false. Error:`, e.message);
      this.addAuditLog('MCP_RENAMEFILE_FALLBACK', `Old: ${oldPath}, New: ${newPath}, Error: ${e.message}`);
      return false;
    }
  }

  async deleteFileOrDirectory(path: string): Promise<boolean> {
    if (!this.isReady()) throw new Error(this.getInitializationError() || 'Client not ready.');
    try {
      if (this.apiConfig?.transportConfig.type === 'stdio') {
        const toolName = this.getToolNameForOperation('deleteFileOrDirectory');
        const result = await this.stdioToolCall<{ content?: { success: boolean } }>(toolName, { path });
        return result?.content?.success || false;
      } else if (this.apiConfig?.transportConfig.type === 'http') {
        const response = await this.httpRequest<{ success: boolean }>('deleteFileOrDirectory', 'DELETE', undefined, { path });
        return response.success;
      }
      throw new Error('Invalid transport configuration.');
    } catch (e: any) {
      console.warn(`MCP deleteFileOrDirectory failed for path "${path}", returning false. Error:`, e.message);
      this.addAuditLog('MCP_DELETE_FALLBACK', `Path: ${path}, Error: ${e.message}`);
      return false;
    }
  }

  async getDirectoryTree(basePath: string = '/'): Promise<DirectoryNode[]> {
    if (!this.isReady()) throw new Error(this.getInitializationError() || 'Client not ready.');
    try {
      if (this.apiConfig?.transportConfig.type === 'stdio') {
        const toolName = this.getToolNameForOperation('getDirectoryTree');
        const result = await this.stdioToolCall<{ content?: { tree: DirectoryNode[] } }>(toolName, { basePath });
        return result?.content?.tree || [];
      } else if (this.apiConfig?.transportConfig.type === 'http') {
        const response = await this.httpRequest<{ tree: DirectoryNode[] }>('getDirectoryTree', 'GET', undefined, { basePath });
        return response.tree || [];
      }
      throw new Error('Invalid transport configuration.');
    } catch (e: any) {
      console.warn(`MCP getDirectoryTree failed for path "${basePath}", returning empty. Error:`, e.message);
      this.addAuditLog('MCP_GETDIRTREE_FALLBACK', `Path: ${basePath}, Error: ${e.message}`);
      return [];
    }
  }

  async createZip(filePaths: string[], outputPath: string): Promise<boolean> {
    if (!this.isReady()) throw new Error(this.getInitializationError() || 'Client not ready.');
    try {
      if (this.apiConfig?.transportConfig.type === 'stdio') {
        const toolName = this.getToolNameForOperation('createZip');
        const result = await this.stdioToolCall<{ content?: { success: boolean } }>(toolName, { filePaths, outputPath });
        return result?.content?.success || false;
      } else if (this.apiConfig?.transportConfig.type === 'http') {
        const response = await this.httpRequest<{ success: boolean }>('createZip', 'POST', { filePaths, outputPath });
        return response.success;
      }
      throw new Error('Invalid transport configuration.');
    } catch (e: any) {
      console.warn(`MCP createZip failed for output "${outputPath}", returning false. Error:`, e.message);
      this.addAuditLog('MCP_CREATEZIP_FALLBACK', `Output: ${outputPath}, Error: ${e.message}`);
      return false;
    }
  }

  async addAllowedDirectory(path: string): Promise<boolean> {
    if (!this.isReady()) throw new Error(this.getInitializationError() || 'Client not ready.');
     try {
      if (this.apiConfig?.transportConfig.type === 'stdio') {
        const toolName = this.getToolNameForOperation('addAllowedDirectory');
        const result = await this.stdioToolCall<{ content?: { success: boolean } }>(toolName, { path });
        return result?.content?.success || false;
      } else if (this.apiConfig?.transportConfig.type === 'http') {
        const response = await this.httpRequest<{ success: boolean }>('addAllowedDirectory', 'POST', { path });
        return response.success;
      }
      throw new Error('Invalid transport configuration.');
    } catch (e: any) {
      console.warn(`MCP addAllowedDirectory failed for path "${path}", returning false. Error:`, e.message);
      this.addAuditLog('MCP_ADDALLOWEDDIR_FALLBACK', `Path: ${path}, Error: ${e.message}`);
      return false;
    }
  }

  async getServerStatus(): Promise<McpServerStatus> {
    if (!this.isReady() || !this.apiConfig) {
        return { isRunning: false, error: this.getInitializationError() || "Client not configured for status check." };
    }
    try {
      let data: McpServerStatus | undefined; // Can be undefined if content is empty
      if (this.apiConfig.transportConfig.type === 'stdio') {
        const toolName = this.apiConfig.transportConfig.toolMappings.getServerStatus;
        if (!toolName) {
          this.addAuditLog('MCP_SERVER_STATUS_STDIO_NOT_MAPPED', 'getServerStatus tool not mapped for stdio.');
          return { isRunning: !!this.sdkStdioClient && this.initialized, version: 'N/A (stdio)', allowedDirectories: [] };
        }
        const result = await this.stdioToolCall<{ content?: McpServerStatus }>(toolName, {});
        data = result?.content;
        if (!data) {
            data = { isRunning: false, error: "Stdio status tool returned no content or malformed content" };
        }

      } else if (this.apiConfig.transportConfig.type === 'http') {
        data = await this.httpRequest<McpServerStatus>('getServerStatus', 'GET');
      } else {
        throw new Error('Invalid transport configuration for getServerStatus.');
      }

      if (this.apiConfig.expectedServerVersion) {
        if (!data.version) {
          this.addAuditLog('MCP_SERVER_VERSION_WARNING', `Expected server version ${this.apiConfig.expectedServerVersion}, but server did not report a version.`);
        } else if (data.version !== this.apiConfig.expectedServerVersion) {
          this.addAuditLog('MCP_SERVER_VERSION_MISMATCH', `Expected server version ${this.apiConfig.expectedServerVersion}, but got ${data.version}.`);
        }
      }

      if (typeof data?.isRunning === 'boolean') {
          return data;
      }
      return { // Malformed response
          isRunning: false,
          error: 'MCP server status response was malformed.',
          version: (data as any)?.version,
          allowedDirectories: (data as any)?.allowedDirectories,
      };
    } catch (e: any) {
      return {
        isRunning: false,
        version: 'N/A (Error fetching)',
        allowedDirectories: [],
        error: e.message,
      };
    }
  }

  public isReady(): boolean {
    if (!this.initialized || this.initializationError || !this.apiConfig) return false;
    if (this.apiConfig.transportConfig.type === 'stdio') {
      return !!this.sdkStdioClient && this.initialized;
    }
    return true; // HTTP is ready if initialized without error
  }

  public getInitializationError(): string | null {
    return this.initializationError;
  }

  public getConfiguredServerName(): string | null {
    return this.apiConfig ? this.apiConfig.configName : "MCP Server (Config Name N/A)";
  }

  public getCurrentTransportType(): 'http' | 'stdio' | null {
    return this.apiConfig ? this.apiConfig.transportConfig.type : null;
  }
}