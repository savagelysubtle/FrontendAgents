
import { DirectoryNode, McpServerStatus, McpApiConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class McpClient {
  private apiConfig: McpApiConfig | null = null;
  private initialized: boolean = false;
  private initializationError: string | null = null;
  private addAuditLog: (action: string, details: string) => void;

  constructor(addAuditLogEntry: (action: string, details: string) => void) {
    this.addAuditLog = addAuditLogEntry;
  }

  public initialize(apiConfig: McpApiConfig | null): void {
    if (apiConfig) {
      this.apiConfig = apiConfig;
      this.initialized = true;
      this.initializationError = null;
      this.addAuditLog('MCP_CLIENT_INIT_SUCCESS', `MCP Client initialized with API config: ${apiConfig.configName}. Timeout: ${apiConfig.requestTimeoutMs || 'default'}, Expected Server Version: ${apiConfig.expectedServerVersion || 'any'}`);
      console.log('MCP Client Initialized with API config:', this.apiConfig);
    } else {
      this.apiConfig = null;
      this.initialized = false;
      this.initializationError = "No API configuration provided to McpClient.";
      this.addAuditLog('MCP_CLIENT_INIT_ERROR', this.initializationError);
      console.error(this.initializationError);
    }
  }
  
  private getEndpointUrl(endpointKey: keyof McpApiConfig['endpoints'], params?: Record<string, string>): string {
    if (!this.apiConfig) throw new Error('MCP Client not configured. API Config is null.');
    
    const endpointPathOrUrl = this.apiConfig.endpoints[endpointKey];
    let url: string;

    if (endpointPathOrUrl.startsWith('http://') || endpointPathOrUrl.startsWith('https://')) {
        // If the endpoint is an absolute URL (e.g., for getServerStatus)
        url = endpointPathOrUrl;
    } else {
        // Otherwise, it's a path relative to baseApiUrl
        url = `${this.apiConfig.baseApiUrl}${endpointPathOrUrl}`;
    }

    if (params) {
      const queryParams = new URLSearchParams(params);
      url = `${url}?${queryParams.toString()}`;
    }
    return url;
  }

  private async request<T>(
    endpointKey: keyof McpApiConfig['endpoints'],
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    body?: any,
    queryParams?: Record<string, string>
  ): Promise<T> {
    if (!this.initialized || this.initializationError || !this.apiConfig) {
      const errorMsg = `MCP Client not initialized or configuration error: ${this.initializationError || 'API Config is missing'}`;
      this.addAuditLog(`MCP_OP_ERROR_${endpointKey.toString().toUpperCase()}`, errorMsg);
      throw new Error(errorMsg);
    }

    const url = this.getEndpointUrl(endpointKey, queryParams);
    this.addAuditLog(`MCP_OP_${endpointKey.toString().toUpperCase()}_START`, `URL: ${url}, Method: ${method}, Timeout: ${this.apiConfig.requestTimeoutMs || 'N/A'}`);

    const controller = new AbortController();
    let timeoutId: number | undefined; // Changed NodeJS.Timeout to number

    if (this.apiConfig.requestTimeoutMs && this.apiConfig.requestTimeoutMs > 0) {
      timeoutId = window.setTimeout(() => { // Use window.setTimeout for browser
        controller.abort();
        this.addAuditLog(`MCP_OP_TIMEOUT_${endpointKey.toString().toUpperCase()}`, `Request to ${url} timed out after ${this.apiConfig.requestTimeoutMs}ms.`);
      }, this.apiConfig.requestTimeoutMs);
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal, // Pass the abort signal
      });

      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (textError) {
            errorText = '[Could not read error response body]';
        }
        const errorMsg = `MCP Error (${endpointKey.toString()}): ${response.status} ${response.statusText}. Details: ${errorText}`;
        this.addAuditLog(`MCP_OP_ERROR_${endpointKey.toString().toUpperCase()}`, errorMsg);
        throw new Error(errorMsg);
      }
      
      if (response.status === 204 || response.headers.get("content-length") === "0") {
        this.addAuditLog(`MCP_OP_${endpointKey.toString().toUpperCase()}_SUCCESS_NO_CONTENT`, `URL: ${url}, Status: ${response.status}`);
        return { success: true } as unknown as T; 
      }

      try {
        const data = await response.json();
        this.addAuditLog(`MCP_OP_${endpointKey.toString().toUpperCase()}_SUCCESS`, `URL: ${url}, Response: ${JSON.stringify(data).substring(0,100)}...`);
        return data as T;
      } catch (jsonError: any) {
        const errorMsg = `MCP Error (${endpointKey.toString()}): Response was not valid JSON. URL: ${url}. Error: ${jsonError.message}`;
        this.addAuditLog(`MCP_OP_ERROR_${endpointKey.toString().toUpperCase()}_JSON_PARSE`, errorMsg);
        throw new Error(errorMsg);
      }

    } catch (error: any) {
       if (error.name === 'AbortError') {
         // Error already logged by timeout handler if it was a timeout
         throw new Error(`Request to ${url} aborted (likely timed out).`);
       }
       this.addAuditLog(`MCP_OP_ERROR_${endpointKey.toString().toUpperCase()}`, `Request to ${url} failed: ${error.message}`);
       throw error; 
    } finally {
        if (timeoutId) {
            window.clearTimeout(timeoutId); // Use window.clearTimeout
        }
    }
  }

  async listDirectory(path: string): Promise<DirectoryNode[]> {
    try {
      const response = await this.request<{ nodes: DirectoryNode[] }>('listDirectory', 'GET', undefined, { path });
      return response.nodes || [];
    } catch (e) {
      console.warn(`MCP listDirectory failed for path "${path}", returning empty list as fallback for UI. Error:`, e);
      return [];
    }
  }

  async readFile(path: string): Promise<{ name: string; content: string; type: string; size: number } | null> {
     try {
      return await this.request<{ name: string; content: string; type: string; size: number } | null>('readFile', 'GET', undefined, { path });
    } catch (e) {
      console.warn(`MCP readFile failed for path "${path}", returning null. Error:`, e);
      return null; 
    }
  }

  async writeFile(path: string, content: string): Promise<boolean> {
     try {
      const response = await this.request<{ success: boolean }>('writeFile', 'POST', { path, content });
      return response.success;
    } catch (e) {
      console.warn(`MCP writeFile failed for path "${path}", returning false. Error:`, e);
      return false;
    }
  }

  async renameFile(oldPath: string, newPath: string): Promise<boolean> {
    try {
      const response = await this.request<{ success: boolean }>('renameFile', 'POST', { oldPath, newPath });
      return response.success;
    } catch (e) {
      console.warn(`MCP renameFile failed for "${oldPath}" to "${newPath}", returning false. Error:`, e);
      return false;
    }
  }

  async deleteFileOrDirectory(path: string): Promise<boolean> {
     try {
      const response = await this.request<{ success: boolean }>('deleteFileOrDirectory', 'DELETE', undefined, { path });
      return response.success;
    } catch (e) {
      console.warn(`MCP deleteFileOrDirectory failed for path "${path}", returning false. Error:`, e);
      return false;
    }
  }
  
  async getDirectoryTree(basePath: string = '/'): Promise<DirectoryNode[]> {
    try {
      const response = await this.request<{ tree: DirectoryNode[] }>('getDirectoryTree', 'GET', undefined, { basePath });
      return response.tree || [];
    } catch (e) {
      console.warn(`MCP getDirectoryTree failed for path "${basePath}", returning empty. Error:`, e);
      return [];
    }
  }

  async createZip(filePaths: string[], outputPath: string): Promise<boolean> {
    try {
      const response = await this.request<{ success: boolean }>('createZip', 'POST', { filePaths, outputPath });
      return response.success;
    } catch (e) {
      console.warn(`MCP createZip failed for output "${outputPath}", returning false. Error:`, e);
      return false;
    }
  }

  async addAllowedDirectory(path: string): Promise<boolean> {
    try {
      const response = await this.request<{ success: boolean }>('addAllowedDirectory', 'POST', { path });
      return response.success;
    } catch (e) {
      console.warn(`MCP addAllowedDirectory failed for path "${path}", returning false. Error:`, e);
      return false;
    }
  }

  async getServerStatus(): Promise<McpServerStatus> {
    if (!this.isReady() || !this.apiConfig) { // Check if client is ready for this operation
        return { isRunning: false, error: this.getInitializationError() || "Client not configured for status check." };
    }
    try {
      const data = await this.request<McpServerStatus>('getServerStatus', 'GET');
      
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
      return {
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
    return this.initialized && !this.initializationError && !!this.apiConfig;
  }

  public getInitializationError(): string | null {
    return this.initializationError;
  }

  public getConfiguredBaseUrl(): string | null {
    return this.apiConfig ? this.apiConfig.baseApiUrl : null;
  }

  public getConfiguredServerName(): string | null {
    // Note: McpApiConfig has 'configName', not 'serverName'. 
    // If you want a general server name, it should be part of McpApiConfig or derived.
    return this.apiConfig ? this.apiConfig.configName : "MCP Server (Config Name N/A)";
  }
}
