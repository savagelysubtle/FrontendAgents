import { DirectoryNode, McpServerStatus, McpApiConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';
import {
  Client as McpSDKClient,
} from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import type {
  ListResourcesResult,
  ReadResourceResult,
  // CallToolResult, // Removed as it's unused
  // ServerInfo, // Removed: Will use LocalServerInfo
  Resource as McpResource,
  ClientCapabilities,
  // ClientInfo, // Removed: Will use LocalClientInfo
  // ClientConfig, // Removed: Will use LocalClientConfig
  Tool as McpServerToolDef, // Added for listMcpTools
  // ListToolsResult // Also unused, can remain commented
} from "@modelcontextprotocol/sdk/types.js";


// Define local interfaces for the potentially missing SDK types
interface LocalServerInfo {
  serverVersion?: string;
  // Add other properties if they are accessed from the server info object
}

interface LocalClientInfo {
  name: string;
  version: string;
  [key: string]: unknown; // Added to satisfy SDK Client constructor
}

interface LocalClientConfig {
  clientInformation: LocalClientInfo;
  clientCapabilities: ClientCapabilities; // Assuming ClientCapabilities is correctly imported
}


export class McpClient {
  private apiConfig: McpApiConfig | null = null;
  private sdkClient: McpSDKClient | null = null;
  private activeTransport: StreamableHTTPClientTransport | StdioClientTransport | null = null; // Union type

  private initialized: boolean = false;
  private initializationError: string | null = null;
  private addAuditLog: (action: string, details: string) => void;

  constructor(addAuditLogEntry: (action: string, details: string) => void) {
    this.addAuditLog = addAuditLogEntry;
  }

  public async initialize(apiConfig: McpApiConfig | null): Promise<void> {
    if (this.sdkClient) {
      try {
        await this.sdkClient.close();
        this.addAuditLog('MCP_SDK_CLIENT_DISCONNECTED', 'Previous MCP SDK client closed.');
      } catch (e: any) {
        this.addAuditLog('MCP_SDK_CLIENT_DISCONNECT_ERROR', `Error closing previous MCP SDK client: ${e.message}`);
      }
    }
    this.sdkClient = null;
    this.activeTransport = null;
    this.initialized = false;

    if (!apiConfig) {
      this.apiConfig = null;
      this.initializationError = "No API configuration provided to McpClient.";
      this.addAuditLog('MCP_CLIENT_INIT_ERROR', this.initializationError);
      console.error(this.initializationError);
      return;
    }

    this.apiConfig = apiConfig;
    this.initializationError = null;

    // Determine transport type, default to 'http'
    const transportType = this.apiConfig.transportType || 'http';

    if (transportType === 'http') {
      if (!this.apiConfig.baseApiUrl || typeof this.apiConfig.baseApiUrl !== 'string' || this.apiConfig.baseApiUrl.trim() === '') {
          this.initializationError = `MCP SDK Client (HTTP) initialization failed: baseApiUrl is missing or invalid in API config "${apiConfig.configName}".`;
          this.addAuditLog('MCP_SDK_CLIENT_INIT_ERROR_NO_BASE_URL', this.initializationError);
          console.error(this.initializationError);
          this.initialized = false;
          return;
      }
      try {
          new URL(this.apiConfig.baseApiUrl);
      } catch (urlError: any) {
          this.initializationError = `MCP SDK Client (HTTP) initialization failed: Invalid baseApiUrl "${this.apiConfig.baseApiUrl}" in API config "${apiConfig.configName}": ${urlError.message}`;
          this.addAuditLog('MCP_SDK_CLIENT_INIT_ERROR_INVALID_BASE_URL', this.initializationError);
          console.error(this.initializationError);
          this.initialized = false;
          return;
      }
    } else if (transportType === 'stdio') {
      if (!this.apiConfig.stdioOptions || typeof this.apiConfig.stdioOptions.command !== 'string' || this.apiConfig.stdioOptions.command.trim() === '') {
        this.initializationError = `MCP SDK Client (stdio) initialization failed: stdioOptions.command is missing or invalid in API config "${apiConfig.configName}".`;
        this.addAuditLog('MCP_SDK_CLIENT_INIT_ERROR_NO_STDIO_COMMAND', this.initializationError);
        console.error(this.initializationError);
        this.initialized = false;
        return;
      }
    } else {
      this.initializationError = `MCP SDK Client initialization failed: Unknown transportType "${transportType}" in API config "${apiConfig.configName}".`;
      this.addAuditLog('MCP_SDK_CLIENT_INIT_ERROR_UNKNOWN_TRANSPORT', this.initializationError);
      console.error(this.initializationError);
      this.initialized = false;
      return;
    }


    const clientInfo: LocalClientInfo = { name: "AIOrganizerClient", version: "1.0.0" };
    const clientCapabilities: ClientCapabilities = {
      roots: { list: true },
    };

    const clientOptions: LocalClientConfig = { // Use LocalClientConfig
        clientInformation: clientInfo,
        clientCapabilities: clientCapabilities,
    };

    try {
      if (transportType === 'http' && this.apiConfig.baseApiUrl) {
        this.activeTransport = new StreamableHTTPClientTransport(new URL(this.apiConfig.baseApiUrl));
        this.addAuditLog('MCP_SDK_CLIENT_CONNECT_ATTEMPT', `Attempting to connect MCP SDK Client (HTTP) to ${this.apiConfig.baseApiUrl} for ${apiConfig.configName}.`);
      } else if (transportType === 'stdio' && this.apiConfig.stdioOptions) {
        this.activeTransport = new StdioClientTransport(this.apiConfig.stdioOptions);
        this.addAuditLog('MCP_SDK_CLIENT_CONNECT_ATTEMPT', `Attempting to connect MCP SDK Client (stdio) with command "${this.apiConfig.stdioOptions.command}" for ${apiConfig.configName}.`);
      } else {
        // This case should ideally be caught by earlier checks
        throw new Error("Internal error: Transport type resolved but required config (baseApiUrl or stdioOptions) missing.");
      }

      this.sdkClient = new McpSDKClient(clientInfo);

      // this.addAuditLog('MCP_SDK_CLIENT_CONNECT_ATTEMPT', `Attempting to connect MCP SDK Client to ${this.apiConfig.baseApiUrl} for ${apiConfig.configName}.`); // Old log
      await this.sdkClient.connect(this.activeTransport);

      this.initialized = true;
      this.initializationError = null; // Clear error on success
      this.addAuditLog('MCP_SDK_CLIENT_INIT_SUCCESS', `MCP SDK Client initialized and connected (${transportType}) for ${apiConfig.configName}.`);
      console.log(`MCP SDK Client Initialized and connected (${transportType}) with API config:`, this.apiConfig);

    } catch (e: any) {
      const target = transportType === 'http' ? this.apiConfig.baseApiUrl : `command '${this.apiConfig.stdioOptions?.command}'`;
      this.initializationError = `MCP SDK Client connection failed for ${apiConfig.configName} (transport: ${transportType}, target: ${target}): ${e.message || 'Unknown connection error'}`;
      this.addAuditLog('MCP_SDK_CLIENT_INIT_ERROR', this.initializationError);
      console.error(this.initializationError, e);
      this.sdkClient = null;
      this.activeTransport = null;
      this.initialized = false; // Ensure initialized is false on error
    }
  }

  private mapMcpResourceToDirectoryNode(resource: McpResource): DirectoryNode {
    return {
      id: resource.uri,
      name: resource.name || resource.uri.substring(resource.uri.lastIndexOf('/') + 1) || resource.uri,
      type: resource.type === 'directory' ? 'directory' : 'file',
      path: resource.uri,
      children: (Array.isArray(resource.children) ? resource.children.map(child => this.mapMcpResourceToDirectoryNode(child)) : undefined),
    };
  }

  private checkClientReady(operationName: string): boolean {
    if (!this.sdkClient || !this.apiConfig || !this.initialized) {
      this.initializationError = this.initializationError || `MCP SDK Client not ready or not properly initialized for operation: ${operationName}. Initialized: ${this.initialized}, API Config: ${!!this.apiConfig}, SDK Client: ${!!this.sdkClient}`;
      this.addAuditLog(`MCP_OP_ERROR_${operationName.toUpperCase()}_UNREADY`, this.initializationError);
      console.error(this.initializationError);
      return false;
    }
    return true;
  }

  async listDirectory(path: string): Promise<DirectoryNode[]> {
    if (!this.checkClientReady('listDirectory') || !this.sdkClient) return [];
    try {
      this.addAuditLog('MCP_OP_LISTRESOURCES_START', `Listing resources for rootUri: ${path}`);
      const response: ListResourcesResult = await this.sdkClient.listResources({ rootUri: path });
      const resultPayload = response.result as ({ resources?: McpResource[] } | undefined);
      this.addAuditLog('MCP_OP_LISTRESOURCES_SUCCESS', `Found ${Array.isArray(resultPayload?.resources) ? resultPayload.resources.length : 0} resources for ${path}.`);
      return Array.isArray(resultPayload?.resources) ? resultPayload.resources.map(res => this.mapMcpResourceToDirectoryNode(res)) : [];
    } catch (e: any) {
      this.addAuditLog('MCP_OP_LISTRESOURCES_ERROR', `Failed to list resources for ${path}: ${e instanceof Error ? e.message : String(e)}`);
      console.error(`MCP listDirectory (listResources) failed for path "${path}":`, e);
      return [];
    }
  }

  async readFile(path: string): Promise<{ name: string; content: string; type: string; size: number } | null> {
    if (!this.checkClientReady('readFile') || !this.sdkClient) return null;
    try {
      this.addAuditLog('MCP_OP_READRESOURCE_START', `Reading resource: ${path}`);
      const response: ReadResourceResult = await this.sdkClient.readResource({ uri: path });
      const resultPayload = response.result as ({ resource?: McpResource } | undefined);
      const resource = resultPayload?.resource;

      if (!resource) {
        this.addAuditLog('MCP_OP_READRESOURCE_NOT_FOUND', `Resource not found at ${path}.`);
        return null;
      }

      let contentString: string;
      if (typeof resource.content === 'string') {
        contentString = resource.content;
      } else if (resource.content instanceof Uint8Array) {
        contentString = new TextDecoder().decode(resource.content);
      } else {
        contentString = '[Content not available or in unexpected format]';
        this.addAuditLog('MCP_OP_READRESOURCE_WARN_CONTENT_FORMAT', `Content for ${path} is not string or Uint8Array.`);
      }
      this.addAuditLog('MCP_OP_READRESOURCE_SUCCESS', `Resource ${path} read successfully. Size: ${resource.byteSize || 'N/A'}`);
      return {
        name: resource.name || resource.uri.substring(resource.uri.lastIndexOf('/') + 1),
        content: contentString,
        type: (resource.mediaType && typeof resource.mediaType === 'string') ? resource.mediaType : 'application/octet-stream',
        size: typeof resource.byteSize === 'number' ? resource.byteSize : 0,
      };
    } catch (e: any) {
      this.addAuditLog('MCP_OP_READRESOURCE_ERROR', `Failed to read resource ${path}: ${e instanceof Error ? e.message : String(e)}`);
      console.error(`MCP readFile (readResource) failed for path "${path}":`, e);
      return null;
    }
  }

  private async callToolAndCheckSuccess(toolName: string, args: Record<string, any>, operationDescription: string): Promise<boolean> {
    if (!this.checkClientReady(`callTool(${toolName})`) || !this.sdkClient) return false;
    try {
      this.addAuditLog(`MCP_OP_CALLTOOL_${toolName.toUpperCase()}_START`, `Calling tool ${toolName} with args: ${JSON.stringify(args).substring(0,100)}...`);
      // Use a more generic type for the response from sdkClient.callTool initially
      const response: any = await this.sdkClient.callTool({ toolUseId: uuidv4(), name: toolName, arguments: args });

      const success = !response.error; // Success is the absence of an error

      if (success) {
        this.addAuditLog(`MCP_OP_CALLTOOL_${toolName.toUpperCase()}_SUCCESS`, `${operationDescription} successful using tool ${toolName}.`);
      } else {
        // If there's an error, response.error should exist
        const errorMessage = response.error?.message || 'Unknown error from tool.';
        const resultString = response.result ? JSON.stringify(response.result) : (response.error ? JSON.stringify(response.error) : 'No result or error object');
        this.addAuditLog(`MCP_OP_CALLTOOL_${toolName.toUpperCase()}_FAILED_RESULT`, `${operationDescription} failed using tool ${toolName}. Server error: ${errorMessage}. Full response details: ${resultString.substring(0,100)}...`);
      }
      return success; // This is now definitely a boolean
    } catch (e: any) {
      this.addAuditLog(`MCP_OP_CALLTOOL_${toolName.toUpperCase()}_ERROR`, `Error ${operationDescription} using tool ${toolName}: ${e instanceof Error ? e.message : String(e)}`);
      console.error(`MCP callTool ${toolName} for ${operationDescription} failed:`, e);
      return false;
    }
  }

  async writeFile(path: string, content: string): Promise<boolean> {
    return this.callToolAndCheckSuccess("filesystem/writeFile", { path, content }, `Writing file to ${path}`);
  }

  async renameFile(oldPath: string, newPath: string): Promise<boolean> {
    return this.callToolAndCheckSuccess('renameFile', { oldPath, newPath }, 'Renaming file/directory');
  }

  async createDirectory(path: string): Promise<boolean> {
    return this.callToolAndCheckSuccess('createDirectory', { path }, 'Creating directory');
  }

  async deleteFileOrDirectory(path: string): Promise<boolean> {
    return this.callToolAndCheckSuccess("filesystem/delete", { path }, `Deleting ${path}`);
  }

  async getDirectoryTree(basePath: string = '/'): Promise<DirectoryNode[]> {
    if (!this.checkClientReady('getDirectoryTree') || !this.sdkClient) return [];
    const toolName = "filesystem/getTree";
    try {
      this.addAuditLog(`MCP_OP_CALLTOOL_${toolName.toUpperCase()}_START`, `Getting directory tree for basePath: ${basePath}`);
      // Use a more generic type for the response
      const response: any = await this.sdkClient.callTool({ toolUseId: uuidv4(), name: toolName, arguments: { basePath } });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const resultPayload = response.result as ({ tree?: McpResource[] } | undefined);
      if (resultPayload && Array.isArray(resultPayload.tree)) {
        const resources = resultPayload.tree;
        this.addAuditLog(`MCP_OP_CALLTOOL_${toolName.toUpperCase()}_SUCCESS`, `Found ${resources.length} root items for tree at ${basePath}.`);
        return resources.map(res => this.mapMcpResourceToDirectoryNode(res));
      } else {
        this.addAuditLog(`MCP_OP_CALLTOOL_${toolName.toUpperCase()}_FAILED_RESULT_STRUCTURE`, `Tool ${toolName} for ${basePath} did not return expected tree structure. Result: ${JSON.stringify(response.result).substring(0,100)}...`);
        return [];
      }
    } catch (e: any) {
      this.addAuditLog(`MCP_OP_CALLTOOL_${toolName.toUpperCase()}_ERROR`, `Failed to get directory tree for ${basePath}: ${e instanceof Error ? e.message : String(e)}`);
      console.error(`MCP getDirectoryTree (tool ${toolName}) failed for path "${basePath}":`, e);
      return [];
    }
  }

  async createZip(filePaths: string[], outputPath: string): Promise<boolean> {
    return this.callToolAndCheckSuccess("filesystem/createZip", { filePaths, outputPath }, `Creating ZIP at ${outputPath}`);
  }

  async addAllowedDirectory(path: string): Promise<boolean> {
    return this.callToolAndCheckSuccess("config/addAllowedDirectory", { path }, `Adding allowed directory ${path}`);
  }

  async getServerStatus(): Promise<McpServerStatus> {
    if (!this.checkClientReady('getServerStatus') || !this.sdkClient) {
      return { isRunning: false, error: this.getInitializationError() || "Client not configured for status check." };
    }
    try {
      this.addAuditLog('MCP_OP_GETSERVERINFO_START', `Fetching server info.`);
      // Use a more generic type for the response
      const toolResponse: any = await this.sdkClient.callTool({toolUseId: uuidv4(), name: "system/info", arguments: {}});

      if (toolResponse.error) {
        throw new Error(toolResponse.error.message);
      }

      const serverInfoPayload = toolResponse.result as Record<string, unknown> | undefined;

      if (!serverInfoPayload) {
        throw new Error("Server did not return information (empty result).");
      }

      let finalServerVersion: string | undefined;
      const rawServerVersion = serverInfoPayload.serverVersion;

      if (typeof rawServerVersion === 'string') {
        finalServerVersion = rawServerVersion;
      } else if (typeof rawServerVersion === 'number' || typeof rawServerVersion === 'boolean') {
        finalServerVersion = String(rawServerVersion);
        console.warn(`MCP Server returned a non-string but convertible version (type ${typeof rawServerVersion}): ${finalServerVersion}`);
      } else {
        finalServerVersion = undefined; // Explicitly undefined for other types
        if (rawServerVersion !== undefined && rawServerVersion !== null) {
            console.warn(`MCP Server returned an unexpected type for serverVersion: ${typeof rawServerVersion}. Value: ${JSON.stringify(rawServerVersion)}. Treating version as undefined.`);
        }
      }

      this.addAuditLog('MCP_OP_GETSERVERINFO_SUCCESS', `Server info fetched: Version ${String(finalServerVersion ?? 'N/A')}`);

      let allowedDirectories: string[] = [];
      try {
        this.addAuditLog('MCP_OP_LISTROOTS_START', 'Listing resource roots for allowed directories.');
        const rootsResponse: ListResourcesResult = await this.sdkClient.listResources({});
        const rootsResultPayload = rootsResponse.result as ({ resources?: McpResource[] } | undefined);
        allowedDirectories = (Array.isArray(rootsResultPayload?.resources) ? rootsResultPayload.resources.map(r => r.uri) : []);
        this.addAuditLog('MCP_OP_LISTROOTS_SUCCESS', `Found ${allowedDirectories.length} resource roots: ${allowedDirectories.join(', ')}`);
      } catch (rootsError: any) {
        this.addAuditLog('MCP_OP_LISTROOTS_ERROR', `Failed to list resource roots: ${rootsError instanceof Error ? rootsError.message : String(rootsError)}`);
      }

      if (this.apiConfig?.expectedServerVersion) {
        if (!finalServerVersion) {
          this.addAuditLog('MCP_SERVER_VERSION_WARNING', `Expected server version ${this.apiConfig.expectedServerVersion}, but server did not report a version or it was invalid.`);
        } else if (finalServerVersion !== this.apiConfig.expectedServerVersion) {
          this.addAuditLog('MCP_SERVER_VERSION_MISMATCH', `Expected server version ${this.apiConfig.expectedServerVersion}, but got ${finalServerVersion}.`);
        }
      }

      return {
        isRunning: true,
        version: finalServerVersion,
        allowedDirectories: allowedDirectories,
      };
    } catch (e: any) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      this.addAuditLog('MCP_OP_GETSERVERINFO_ERROR', `Failed to get server status/info: ${errorMessage}`);
      console.error('MCP getServerStatus failed:', e);
      return {
        isRunning: false,
        error: errorMessage,
      };
    }
  }

  public get ready(): boolean {
    return this.initialized && !this.initializationError && !!this.apiConfig && !!this.sdkClient;
  }

  public getInitializationError(): string | null {
    if (this.initializationError) return this.initializationError;
    if (!this.apiConfig) return "API Config not set.";
    if (!this.initialized) return "Client not successfully initialized (connection may have failed).";
    if (!this.sdkClient) return "SDK Client not created.";
    return null;
  }

  public getSdkClient(): McpSDKClient | null {
    return this.sdkClient;
  }

  public getConfiguredBaseUrl(): string | null {
    return this.apiConfig && typeof this.apiConfig.baseApiUrl === 'string' ? this.apiConfig.baseApiUrl : null;
  }

  public getConfiguredServerName(): string | null {
    return this.apiConfig ? this.apiConfig.configName : "MCP Server (Config Name N/A)";
  }

  async listMcpTools(): Promise<McpServerToolDef[] | null> {
    if (!this.checkClientReady('listMcpTools') || !this.sdkClient) return null;
    try {
      this.addAuditLog('MCP_OP_LISTTOOLS_START', 'Listing MCP server tools.');
      // Use a more generic type for the response
      const response: any = await this.sdkClient.listTools({});

      if (response.error) {
        throw new Error(response.error.message);
      }

      const resultPayload = response.result as ({ tools?: McpServerToolDef[] } | undefined);

      if (resultPayload && Array.isArray(resultPayload.tools)) {
        this.addAuditLog('MCP_OP_LISTTOOLS_SUCCESS', `Found ${resultPayload.tools.length} MCP server tools.`);
        return resultPayload.tools;
      } else {
        this.addAuditLog('MCP_OP_LISTTOOLS_NO_TOOLS_ARRAY', 'MCP server tools list was not in expected format or empty.');
        return []; // Return empty array if tools are not in the expected structure
      }
    } catch (e: any) {
      this.addAuditLog('MCP_OP_LISTTOOLS_ERROR', `Failed to list MCP server tools: ${e instanceof Error ? e.message : String(e)}`);
      console.error('MCP listMcpTools failed:', e);
      return null;
    }
  }
}
