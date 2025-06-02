
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { McpJsonParsedForSettings as McpJsonParsed, McpServerToolConfigForSettings as McpServerToolConfig } from '../types'; // Ensure these types are imported
import { GEMINI_MODEL } from '../constants';

const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI | null = null;
if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
} else {
  console.warn("API_KEY is not set. Gemini related AI features will be limited or disabled.");
}

let chatInstance: Chat | null = null;

export const generateMcpToolsManifestForLLM = (mcpJsonContent: string, toolStates: Record<string, boolean>): string => {
  let manifest = "AVAILABLE MCP TOOLS (Only enabled tools are listed):\n\n";
  let foundEnabledTool = false;

  if (!mcpJsonContent || mcpJsonContent.trim() === "") {
    manifest += "No MCP tools are currently defined (mcp.json is empty or not configured).\n";
    return manifest;
  }

  try {
    const parsedMcpConfig = JSON.parse(mcpJsonContent) as McpJsonParsed;
    const mcpServers = parsedMcpConfig?.mcpServers;

    if (typeof mcpServers === 'object' && mcpServers !== null && Object.keys(mcpServers).length > 0) {
      for (const toolName in mcpServers) {
        if (toolStates[toolName] === true) { 
          foundEnabledTool = true;
          const toolConfig = mcpServers[toolName];
          
          manifest += `Tool: ${toolName}\n`;
          
          const description = toolConfig.description || 
                              (toolConfig.command ? `Runs the command '${toolConfig.command}'.` : `Executes the '${toolName}' operation.`);
          manifest += `  Description: ${description}\n`;
          
          if (toolConfig.command) {
            manifest += `  Action: Runs command: ${toolConfig.command}\n`;
          }
          if (toolConfig.args && toolConfig.args.length > 0) {
            manifest += `  Default Args: ${toolConfig.args.join(' ')}\n`;
          }

          let argumentSchemaString = "{}";
          if (toolConfig.parameters && Object.keys(toolConfig.parameters).length > 0) {
            const paramsForSchema: Record<string, any> = {};
            const requiredParams: string[] = [];
            for (const paramName in toolConfig.parameters) {
              paramsForSchema[paramName] = { 
                type: toolConfig.parameters[paramName].type,
                description: toolConfig.parameters[paramName].description 
              };
              if (toolConfig.parameters[paramName].required) {
                requiredParams.push(paramName);
              }
            }
            argumentSchemaString = JSON.stringify({
              type: "object",
              properties: paramsForSchema,
              required: requiredParams.length > 0 ? requiredParams : undefined
            }, null, 2).replace(/\n/g, "\n    "); 
          }
          
          manifest += `  Argument Schema (if dynamic arguments are needed):\n    ${argumentSchemaString}\n`;
          manifest += `  To request use of this tool, respond ONLY with a JSON object in the following format (replace "..." with actual arguments if needed, matching the schema above):\n`;
          manifest += `  \`\`\`json\n  {\n    "mcp_tool_call": {\n      "name": "${toolName}",\n      "arguments": { /* If arguments are needed based on schema, provide them here as key:value pairs */ }\n    }\n  }\n  \`\`\`\n`;
          manifest += "---\n";
        }
      }
      if (!foundEnabledTool) {
        manifest += "No MCP tools are currently enabled. The user can enable them in the Tools panel.\n";
      }
    } else {
      manifest += "No MCP tools are currently defined in mcp.json.\n";
    }
  } catch (error) {
    console.error("Error parsing mcp.json for tool manifest:", error);
    manifest += "Error parsing mcp.json. Tool information may be incomplete. Please check the mcp.json content in the Settings panel for validity.\n";
  }
  return manifest;
};


const getChatInstance = (ingestedContentSummary?: string, mcpToolsManifest?: string): Chat | null => {
  if (!ai) return null;

  let systemInstruction = `You are an AI assistant for the Desktop MCP Ingestor application.
The user has ingested a folder, and its summary (file tree + metadata) is provided below if available.
Help the user understand the ingested content, answer questions about it, and perform tasks like conceptual renaming or suggesting organizational structures.

Available slash commands (these are user-initiated, you describe them if asked but don't try to invoke them as slash commands yourself):
- /ingest: User triggers this to re-initiate the folder ingestion process.
- /open [filename]: User asks to display information about a specific file from the ingest.
- /rename "[pattern]" to "[new_pattern]": User asks you to describe how files matching the pattern would be renamed.

MODEL CONTEXT PROTOCOL (MCP) TOOLS:
You have access to the following external tools. These tools can perform actions on the user's system if invoked.
The user can enable or disable these tools from the 'Tools' panel in the application.

${mcpToolsManifest || 'No MCP tool manifest provided or tools are not configured.'}

IMPORTANT:
1. When you need to use an MCP tool, your *entire response* MUST BE a single JSON object formatted exactly as specified under that tool's "To request use of this tool..." section.
2. Do NOT add any conversational text, explanations, or markdown formatting before or after this JSON object if you are calling a tool.
3. If a tool requires specific arguments (as defined in its Argument Schema), you MUST gather these arguments from the user through conversation first. Once all required arguments are clear, then, in a *separate, subsequent message*, provide the JSON tool call request.
4. Do NOT attempt to execute the tool's command directly or describe its output as if you ran it. Simply provide the JSON call structure. The application will handle the actual execution and provide the results back to you in a subsequent message from the SYSTEM.
5. If the user asks about available tools, you can list the ones described in the manifest above.

If no content is ingested, guide the user to use the File Manager to ingest a folder or use the /ingest command.
Be concise and helpful.`;

  if (ingestedContentSummary) {
    systemInstruction += `\n\nCURRENTLY INGESTED CONTENT SUMMARY:\n---\n${ingestedContentSummary}\n---`;
  } else {
    systemInstruction += `\n\nNo content has been ingested yet. Please guide the user to ingest a folder.`;
  }
  
  chatInstance = ai.chats.create({
    model: GEMINI_MODEL,
    config: {
      systemInstruction: systemInstruction,
    },
  });
  return chatInstance;
};

export const streamChatResponse = async (
  messageText: string,
  ingestedContentSummary: string | null,
  mcpToolsManifest: string, 
  onChunk: (chunkText: string, isFinal: boolean) => void,
  onError: (error: string) => void
): Promise<void> => {
  if (!ai) {
    onError("Gemini AI SDK not initialized (API_KEY missing or invalid). Chat features disabled.");
    onChunk("", true); 
    return;
  }
  try {
    const chat = getChatInstance(ingestedContentSummary || undefined, mcpToolsManifest); 
    if (!chat) {
        onError("Could not initialize chat instance.");
        onChunk("", true);
        return;
    }
    
    const result = await chat.sendMessageStream({ message: messageText });
    let fullResponseText = "";
    for await (const chunk of result) {
      const textContent = chunk.text ?? "";
      fullResponseText += textContent;
      onChunk(textContent, false); 
    }
    onChunk(fullResponseText, true); 

  } catch (error) {
    console.error("Error streaming chat response:", error);
    onError(`Error from Gemini: ${error instanceof Error ? error.message : String(error)}`);
    onChunk("", true); 
  }
};

export const generateDescriptionForIngest = async (ingestSummary: string, userQuery: string): Promise<string> => {
  if (!ai) throw new Error("Gemini AI SDK not initialized. API_KEY missing?");
  try {
    const prompt = `Based on the following ingested file summary:\n---\n${ingestSummary}\n---\n\nUser query: "${userQuery}"\n\nProvide a concise textual response.`;
    
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating text from ingest:", error);
    throw error;
  }
};

export const generateAiOrganizedStructure = async (ingestSummary: string): Promise<string> => {
  if (!ai) throw new Error("Gemini AI SDK not initialized. API_KEY missing?");
  try {
    const prompt = `You are an AI file organization expert. Based on the following ingested file summary, propose a new, more logical directory structure and file naming scheme.
Your goal is to improve clarity, findability, and organization.
Provide your reasoning for the proposed changes (e.g., why files are grouped a certain way, why names are changed).
Output the new structure in a clear, text-based tree format similar to the input summary (using 📁 for folders and 📄 for files).
If you suggest renaming files, clearly indicate the old name and the new name if possible within the tree or in a separate list.
This is a suggestion only; no actual file operations will be performed by you.

ORIGINAL INGESTED SUMMARY:
---
${ingestSummary}
---

PROPOSED REORGANIZED STRUCTURE AND REASONING:
(Begin your response with the proposed structure, followed by your reasoning)
`;
    
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
            temperature: 0.5, 
        }
    });
    return response.text;
  } catch (error) {
    console.error("Error generating AI organized structure:", error);
    throw error;
  }
};

export const aiLintAndFormatMcpJson = async (rawJsonString: string): Promise<string> => {
  if (!ai) throw new Error("Gemini AI SDK not initialized. API_KEY missing?");
  try {
    const prompt = `You are an AI assistant specializing in JSON linting and formatting, specifically for 'mcp.json' configurations.
Your task is to take the user's raw input, validate it, correct any minor syntactical errors, ensure it conforms to the expected structure, and then reformat it with 2-space indentation.

The expected 'mcp.json' structure is:
{
  "mcpServers": {
    "[ToolName1]": {
      "command": "string (path to executable or command)",
      "args": ["string", "array", "of", "arguments"],
      "cwd": "optional string (current working directory for the command)",
      "env": {
        "optional_env_var": "string_value"
      },
      "description": "optional string: A human-readable and AI-parsable summary of what the tool does.",
      "parameters": {
         "optional_param_name": { "type": "string|number|boolean", "description": "...", "required": true|false }
      }
    },
    "[ToolName2]": { ... }
  }
}

If the input is fundamentally not JSON or cannot be reasonably coerced into the expected structure, respond with a clear error message within a JSON string like: { "error": "Invalid input: Not valid JSON or does not conform to mcp.json structure." }.
Otherwise, return the corrected and formatted JSON string. Ensure the output is ONLY the JSON string, preferably wrapped in \`\`\`json ... \`\`\` if possible, but the primary goal is the clean JSON output.

User's raw JSON input:
---
${rawJsonString}
---

Corrected and Formatted JSON Output:
`;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        temperature: 0.2, 
        responseMimeType: "application/json", 
      },
    });

    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }

    try {
      JSON.parse(jsonStr); 
      return jsonStr;
    } catch (e) {
      console.error("AI returned non-JSON or malformed JSON after linting:", jsonStr, e);
      return JSON.stringify({ "error": "AI processing failed to return valid JSON. Original input might be too malformed." }, null, 2);
    }

  } catch (error) {
    console.error("Error during AI linting and formatting:", error);
    throw error; 
  }
};
