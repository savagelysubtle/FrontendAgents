
import { McpServer, McpTool, McpResource, McpPrompt, ClientCapabilitiesConfig, JsonRpcRequest, JsonRpcResponse, McpLoggingLevel, StdioConfig } from '../types';

// Simulates network delay
const networkDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Store mock client instances
const activeClients = new Map<string, MockMcpClient>();

class MockMcpClient {
  private serverId: string;
  private serverName: string;
  private configType: 'stdio' | 'sse';
  private stdioConfig?: StdioConfig;
  private serverUrl?: string;

  public isConnected: boolean = false;
  public serverReportedCapabilities: Record<string, any> = {};
  private requestedLoggingLevel?: McpLoggingLevel;

  constructor(server: McpServer) {
    this.serverId = server.id;
    this.serverName = server.name;
    this.configType = server.configType;
    if (server.configType === 'stdio') {
      this.stdioConfig = server.stdioConfig;
    } else {
      this.serverUrl = server.url;
    }
  }

  async initialize(clientCapabilities: ClientCapabilitiesConfig): Promise<{ serverCapabilities: Record<string, any> }> {
    this.requestedLoggingLevel = clientCapabilities.loggingLevel;
    const connectTarget = this.configType === 'stdio' 
      ? `STDIO command: ${this.stdioConfig?.command}` 
      : `SSE URL: ${this.serverUrl}`;

    console.log(`[MCP Client ${this.serverName} (${this.serverId})] Initializing connection to ${connectTarget} with capabilities:`, clientCapabilities);
    if (this.requestedLoggingLevel !== undefined) {
      console.log(`[MCP Client ${this.serverName}] Requesting logging level: ${McpLoggingLevel[this.requestedLoggingLevel]} (${this.requestedLoggingLevel})`);
    }
    await networkDelay(1000); 

    if (this.serverName.toLowerCase().includes("error_server")) { // More specific error trigger
      throw new Error(`Mock connection error: Server '${this.serverName}' deliberately unavailable`);
    }
    
    this.isConnected = true;
    this.serverReportedCapabilities = {
      protocolVersion: "2025-03-26",
      serverName: this.serverName,
      configType: this.configType,
      tools: true,
      resources: true,
      prompts: true,
      roots: clientCapabilities.roots, 
      sampling: clientCapabilities.sampling,
      completion: true,
      logging: true,
      effectiveLoggingLevel: this.requestedLoggingLevel !== undefined ? this.requestedLoggingLevel : McpLoggingLevel.INFO, 
    };
    console.log(`[MCP Client ${this.serverName}] Connection initialized. Server capabilities:`, this.serverReportedCapabilities);
    return { serverCapabilities: this.serverReportedCapabilities };
  }

  async listTools(): Promise<McpTool[]> {
    if (!this.isConnected) throw new Error("Client not connected.");
    console.log(`[MCP Client ${this.serverName}] Listing tools...`);
    await networkDelay(500);
    const nameLower = this.serverName.toLowerCase();
    const commandLower = this.stdioConfig?.command?.toLowerCase() || "";

    if (nameLower.includes("calculator") || nameLower.includes("calc")) {
      return [
        { name: 'calculator.add', description: 'Adds two numbers.', inputSchema: { a: { type: 'number', required: true }, b: { type: 'number', required: true } } },
        { name: 'calculator.subtract', description: 'Subtracts second number from first.', inputSchema: { a: { type: 'number', required: true }, b: { type: 'number', required: true } } },
      ];
    }
    if (nameLower.includes("python") || commandLower.includes("python")) {
        return [
            { name: 'python.script.info', description: 'Gets info about the Python script.'},
            { name: 'python.execute.snippet', description: 'Executes a Python snippet.', inputSchema: { code: {type: 'string', required: true}}},
            { name: 'python.linter.check', description: 'Lints a python file.', inputSchema: { file_path: { type: 'string', required: true}}}
        ];
    }
    if (nameLower.includes("rust") || commandLower.includes("cargo run")) {
        return [
            { name: 'rust.project.build', description: 'Builds the Rust project.'},
            { name: 'rust.analyzer.check_file', description: 'Checks a Rust file for errors.', inputSchema: { file_path: { type: 'string', required: true}}}
        ];
    }
     if (nameLower.includes("brave-search") || commandLower.includes("brave-search")) {
        return [
            { name: 'web.search', description: 'Performs a web search using Brave Search.', inputSchema: { query: { type: 'string', required: true }, count: { type: 'number' } } },
        ];
    }
    if (nameLower.includes("toolbox") || commandLower.includes("toolbox")) {
        return [
            { name: 'string.reverse', description: 'Reverses a string.', inputSchema: { text: { type: 'string', required: true } } },
            { name: 'math.random_number', description: 'Generates a random number in a range.', inputSchema: { min: { type: 'number' }, max: { type: 'number' } } },
        ];
    }
    // Default tools
    return [
      { name: 'echo', description: 'Echoes back the input.', inputSchema: { message: { type: 'string', required: true } } },
      { name: 'file.read.metadata', description: 'Gets metadata for a file (simulated).', inputSchema: { path: { type: 'string', required: true } } },
    ];
  }

  async callTool(toolName: string, params: any): Promise<any> {
    if (!this.isConnected) throw new Error("Client not connected.");
    console.log(`[MCP Client ${this.serverName}] Calling tool "${toolName}" with params:`, params);
    await networkDelay(1000);
    const request: JsonRpcRequest = { jsonrpc: "2.0", method: `tool:${toolName}`, params, id: crypto.randomUUID() };
    console.log(`[MCP Client ${this.serverName}] Sending request:`, request);

    let result: any;
    if (toolName === 'calculator.add' && typeof params.a === 'number' && typeof params.b === 'number') {
      result = params.a + params.b;
    } else if (toolName === 'calculator.subtract' && typeof params.a === 'number' && typeof params.b === 'number') {
      result = params.a - params.b;
    } else if (toolName === 'echo') {
      result = `Echo from ${this.serverName}: ${params.message}`;
    } else if (toolName === 'file.read.metadata') {
      result = { path: params.path, size: Math.floor(Math.random() * 10000), lastModified: new Date().toISOString(), type: "text/plain" };
    } else if (toolName === 'python.script.info') {
        result = { script_path: this.stdioConfig?.args?.join(' ') || 'N/A', python_version: '3.9 (mocked)', server: this.serverName };
    } else if (toolName === 'python.execute.snippet' && params.code) {
        result = { output: `Simulated Python output for: ${params.code}`, status: 'success', server: this.serverName };
    } else if (toolName === 'python.linter.check' && params.file_path) {
        result = { file_path: params.file_path, issues_found: Math.floor(Math.random() * 5), status: 'completed', server: this.serverName };
    } else if (toolName === 'rust.project.build') {
        result = { status: 'success', build_time_ms: Math.floor(Math.random() * 5000) + 1000, server: this.serverName };
    } else if (toolName === 'rust.analyzer.check_file' && params.file_path) {
        result = { file_path: params.file_path, errors: [], warnings: Math.floor(Math.random() * 3), status: 'checked', server: this.serverName };
    } else if (toolName === 'web.search' && params.query) {
        result = {
            query: params.query,
            results: [
                { title: `Mock Result 1 for "${params.query}" from ${this.serverName}`, url: `https://example.com/search?q=${encodeURIComponent(params.query)}&src=1`, snippet: "This is a simulated search result..." },
                { title: `Mock Result 2 for "${params.query}" from ${this.serverName}`, url: `https://example.com/search?q=${encodeURIComponent(params.query)}&src=2`, snippet: "Another interesting snippet found by the mock search." }
            ],
            server: this.serverName
        };
    } else if (toolName === 'string.reverse' && params.text) {
        result = { original: params.text, reversed: params.text.split('').reverse().join(''), server: this.serverName };
    } else if (toolName === 'math.random_number') {
        const min = params.min ?? 0; // Use ?? to provide default if undefined
        const max = params.max ?? 100; // Use ?? to provide default if undefined
        if (typeof min !== 'number' || typeof max !== 'number' || min > max) {
             return { error: { code: -32602, message: `Invalid params for math.random_number on server ${this.serverName}. Min/max must be numbers and min <= max.` } };
        }
        result = { number: Math.floor(Math.random() * (max - min + 1)) + min, range: {min, max}, server: this.serverName };
    }
     else {
      return { error: { code: -32601, message: `Method '${toolName}' not found on server ${this.serverName}` } };
    }
    
    const response: JsonRpcResponse = { jsonrpc: "2.0", result, id: request.id };
    console.log(`[MCP Client ${this.serverName}] Received response:`, response);
    return response.result;
  }

  async listResources(): Promise<McpResource[]> { 
    if (!this.isConnected) throw new Error("Client not connected.");
    await networkDelay(300);
    const nameLower = this.serverName.toLowerCase();
     if (nameLower.includes("python") || (this.stdioConfig?.command?.toLowerCase() || "").includes("python")) {
        return [
            { name: 'python_config_file', description: 'Access the Python server configuration file.', uriTemplate: 'file:///etc/python_server.conf' },
            { name: 'python_log_directory', description: 'Main log directory for Python processes.', uriTemplate: 'dir:///var/log/python/'}
        ];
    }
    return [
      { name: 'project_document', description: 'Access a specific project document by its name.', uriTemplate: '/docs/{docName}', paramsSchema: { docName: { type: 'string', required: true, description: 'Name of the document (e.g., "readme.md")' } } },
      { name: 'user_preferences', description: 'User specific settings file.' },
      { name: 'raw_file_content', description: 'Raw file content by path.', uriTemplate: 'file://{filePath}', paramsSchema: { filePath: { type: 'string', required: true, description: 'Absolute path to the file'}}}
    ];
  }
  
  async readResource(resourceName: string, params: any): Promise<any> { 
     if (!this.isConnected) throw new Error("Client not connected.");
     console.log(`[MCP Client ${this.serverName}] Reading resource "${resourceName}" with params:`, params);
     await networkDelay(600);
     let content: any;
     if (resourceName === 'project_document' && params.docName) {
        content = `## ${params.docName}\n\nThis is the simulated content for the document named "${params.docName}" from server ${this.serverName}.\nLast updated: ${new Date().toLocaleDateString()}`;
     } else if (resourceName === 'user_preferences') {
        content = { theme: 'dark', language: 'en', notifications: true, source: this.serverName };
     } else if (resourceName === 'raw_file_content' && params.filePath) {
        content = `Simulated raw content of ${params.filePath} from ${this.serverName}:\nHello from the mock file system!\nThis file contains some text.\nRandom number: ${Math.random()}`;
     } else if (resourceName === 'python_config_file') {
        content = `[PythonServerConfig]\nport = 8088\nlog_level = DEBUG\n# Mock config from ${this.serverName}`;
     } else if (resourceName === 'python_log_directory') {
        content = { type: 'directory_listing', files: ['app.log', 'error.log', 'access.log'], source: this.serverName};
     }
      else {
        return { error: { code: -32602, message: `Invalid params or resource '${resourceName}' not found on ${this.serverName}` } };
     }
     return { name: resourceName, params, content };
  }

  async listPrompts(): Promise<McpPrompt[]> { 
    if (!this.isConnected) throw new Error("Client not connected.");
    await networkDelay(300);
     const nameLower = this.serverName.toLowerCase();
     if (nameLower.includes("toolbox") || (this.stdioConfig?.command?.toLowerCase() || "").includes("toolbox")) {
        return [
            { name: 'generate_code_comment', description: 'Generates a comment for a code block.', paramsSchema: { code: { type: 'string', required: true }, language: {type: 'string', required: false, description: "e.g. python, javascript" } } },
        ];
    }
    return [
      { name: 'summarize_text', description: 'Summarizes provided text.', paramsSchema: { text: { type: 'string', required: true, description: "The text to summarize" }, length: {type: 'string', description: "e.g. short, medium, long", required: false } } },
      { name: 'generate_email_subject', description: 'Generates an email subject based on body.', paramsSchema: { emailBody: { type: 'string', required: true, description: "The body of the email" } } },
    ];
  }

  async executePrompt(promptName: string, params: any): Promise<any> { 
    if (!this.isConnected) throw new Error("Client not connected.");
    console.log(`[MCP Client ${this.serverName}] Executing prompt "${promptName}" with params:`, params);
    await networkDelay(800);
    let result: any;
    if (promptName === 'summarize_text' && params.text) {
        const length = params.length || 'medium';
        result = `Summary (length: ${length}) from ${this.serverName}: ${params.text.substring(0, Math.min(params.text.length, 100) + Math.random()*50)}... (mocked summary)`;
    } else if (promptName === 'generate_email_subject' && params.emailBody) {
        result = `Subject from ${this.serverName}: Regarding your message about "${params.emailBody.substring(0,20)}..." (mocked subject)`;
    } else if (promptName === 'generate_code_comment' && params.code) {
        result = `// Mocked comment for code on ${this.serverName}:\n// ${params.code.split('\\n')[0]} ...`;
    }
     else {
        return { error: { code: -32602, message: `Invalid params or prompt '${promptName}' not found on ${this.serverName}` } };
    }
    return { name: promptName, params, result };
  }

  async close(): Promise<void> {
    const closeTarget = this.configType === 'stdio' ? `STDIO command: ${this.stdioConfig?.command}` : `SSE URL: ${this.serverUrl}`;
    console.log(`[MCP Client ${this.serverName}] Closing connection to ${closeTarget}`);
    this.isConnected = false;
    await networkDelay(200);
  }
}

export const mcpClientService = {
  async connect(server: McpServer): Promise<Partial<McpServer>> {
    if (activeClients.has(server.id)) {
      const existingClient = activeClients.get(server.id)!;
      if (existingClient.isConnected) {
         console.warn(`[MCP Service] Client for server ${server.name} (${server.id}) is already connected.`);
         const tools = await existingClient.listTools();
         const resources = await existingClient.listResources();
         const prompts = await existingClient.listPrompts();
         return { status: 'connected', tools, resources, prompts, serverReportedCapabilities: existingClient.serverReportedCapabilities };
      }
    }

    const client = new MockMcpClient(server);
    activeClients.set(server.id, client);

    try {
      const { serverCapabilities } = await client.initialize(server.clientCapabilities);
      const tools = await client.listTools();
      const resources = await client.listResources();
      const prompts = await client.listPrompts();
      return {
        status: 'connected',
        serverReportedCapabilities: serverCapabilities,
        tools,
        resources,
        prompts,
        lastError: undefined,
      };
    } catch (error) {
      console.error(`[MCP Service] Error connecting to server ${server.name}:`, error);
      activeClients.delete(server.id); 
      throw error; 
    }
  },

  async disconnect(serverId: string): Promise<void> {
    const client = activeClients.get(serverId);
    if (client) {
      await client.close();
      activeClients.delete(serverId);
      console.log(`[MCP Service] Disconnected from server ${serverId}`);
    }
  },

  getClient(serverId: string): MockMcpClient | undefined {
    return activeClients.get(serverId);
  },

  async callTool(serverId: string, toolName: string, params: any): Promise<any> { 
    const client = activeClients.get(serverId);
    if (!client || !client.isConnected) {
      throw new Error(`Client for server ${serverId} not connected or not found.`);
    }
    return client.callTool(toolName, params);
  },
  
  async listTools(serverId: string): Promise<McpTool[]> { 
    const client = activeClients.get(serverId);
    if (!client || !client.isConnected) return [];
    return client.listTools();
  },

  async listResources(serverId: string): Promise<McpResource[]> { 
    const client = activeClients.get(serverId);
    if (!client || !client.isConnected) return [];
    return client.listResources();
  },
  
  async readResource(serverId: string, resourceName: string, params: any): Promise<any> { 
    const client = activeClients.get(serverId);
    if (!client || !client.isConnected) throw new Error(`Client for server ${serverId} not connected or not found.`);
    return client.readResource(resourceName, params);
  },

  async listPrompts(serverId: string): Promise<McpPrompt[]> { 
    const client = activeClients.get(serverId);
    if (!client || !client.isConnected) return [];
    return client.listPrompts();
  },

  async executePrompt(serverId: string, promptName: string, params: any): Promise<any> { 
    const client = activeClients.get(serverId);
    if (!client || !client.isConnected) throw new Error(`Client for server ${serverId} not connected or not found.`);
    return client.executePrompt(promptName, params);
  }
};
