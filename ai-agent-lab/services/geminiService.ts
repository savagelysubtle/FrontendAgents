
import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";
import { GEMINI_TEXT_MODEL }  from '../constants';
import { DocumentationContent, McpServersJsonFormat } from '../types'; 

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("Gemini API Key is missing. Please set the API_KEY environment variable.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY || "MISSING_API_KEY" }); 

interface CreateChatSessionOptions {
  model: string;
  temperature?: number;
  systemInstruction?: string;
  topK?: number;
  topP?: number;
  enableThinking?: boolean; // Specific to Flash model
}

// Define a local interface for the chat session's model configuration
interface ChatSessionModelConfig {
  systemInstruction?: string;
  temperature?: number;
  topK?: number;
  topP?: number;
  thinkingConfig?: { thinkingBudget: number };
}

export const geminiService = {
  generateText: async (prompt: string): Promise<string> => {
    if (!API_KEY) return "API Key not configured. Cannot connect to Gemini.";
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL, // This could also be made configurable if needed elsewhere
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      console.error("Error generating text with Gemini:", error);
      throw error; 
    }
  },

  generateDocumentation: async (itemName: string, itemType: 'tool' | 'agent'): Promise<DocumentationContent> => {
    if (!API_KEY) {
      return { title: `Documentation for ${itemName} (API Key Missing)`, 
               installGuide: ["API Key not configured. Cannot generate documentation."] };
    }
    const prompt = `
      Generate documentation for a ${itemType} named "${itemName}".
      The documentation should include the following sections if applicable:
      1.  Title: "Documentation for ${itemName}"
      2.  Install Guide: Step-by-step installation instructions.
      3.  Usage: Examples of how to use the ${itemType}, including common commands or scenarios.
      4.  FAQ: Frequently asked questions and their answers.
      5.  Improvement Suggestions: Potential areas for improving the ${itemType}.

      Return the response as a JSON object with keys: "title", "installGuide" (array of strings), "usage" (array of objects with "command" and "description" strings), "faq" (array of objects with "question" and "answer" strings), and "improvementSuggestions" (array of strings).
      If a section is not applicable, its value can be an empty array or omitted.
    `;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL, // Consider using the configured assistant model here too
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        }
      });

      let jsonStr = response.text.trim();
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = jsonStr.match(fenceRegex);
      if (match && match[2]) {
        jsonStr = match[2].trim();
      }
      
      const parsedData = JSON.parse(jsonStr) as DocumentationContent;
      return parsedData;

    } catch (error) {
      console.error("Error generating documentation with Gemini:", error);
      return {
        title: `Error generating documentation for ${itemName}`,
        installGuide: [`Failed to generate documentation: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  },

  createChatSession: (options: CreateChatSessionOptions): Chat => {
    if (!API_KEY) {
      console.warn("API Key not configured. Chat session might not work as expected and throw errors.");
    }

    const modelConfig: ChatSessionModelConfig = {};
    if (options.systemInstruction) modelConfig.systemInstruction = options.systemInstruction;
    if (options.temperature !== undefined) modelConfig.temperature = options.temperature;
    if (options.topK !== undefined) modelConfig.topK = options.topK;
    if (options.topP !== undefined) modelConfig.topP = options.topP;
    
    // Add thinkingConfig only for the flash model and if enableThinking is explicitly set
    if (options.model === GEMINI_TEXT_MODEL && options.enableThinking !== undefined) {
        modelConfig.thinkingConfig = { thinkingBudget: options.enableThinking ? 1 : 0 };
    }


    return ai.chats.create({
      model: options.model,
      config: modelConfig,
    });
  },

  sendMessageStream: async (
    chat: Chat, 
    message: string,
    onChunk: (chunkText: string) => void,
    onError: (error: Error) => void,
    onComplete: () => void
  ): Promise<void> => {
    if (!API_KEY) {
      onError(new Error("API Key not configured. Cannot send message."));
      onComplete();
      return;
    }
    console.log("[geminiService.sendMessageStream] Attempting to send message:", message);
    try {
      const result = await chat.sendMessageStream({ message }); 
      let firstChunkReceived = false;
      let chunkCount = 0;
      for await (const chunk of result) { 
        firstChunkReceived = true;
        chunkCount++;
        // console.log(`[geminiService.sendMessageStream] Received chunk ${chunkCount}:`, chunk.text);
        onChunk(chunk.text);
      }
      if (!firstChunkReceived) {
        console.warn("[geminiService.sendMessageStream] Stream completed without any chunks being processed.");
      } else {
        console.log(`[geminiService.sendMessageStream] Stream completed. Total chunks: ${chunkCount}`);
      }
    } catch (error) {
      console.error("[geminiService.sendMessageStream] Error during streaming:", error);
      onError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      console.log("[geminiService.sendMessageStream] Calling onComplete.");
      onComplete();
    }
  },

  formatMcpServerConfig: async (jsonString: string): Promise<string> => {
    if (!API_KEY) throw new Error("API Key not configured. Cannot format JSON.");
    const prompt = `
You are an expert JSON linter and formatter. The user will provide a JSON string that is intended to configure MCP (Model Context Protocol) servers.
Your task is to:
1. Validate if the input is valid JSON. If not, try to correct minor syntax errors if obvious. If it's badly malformed and unfixable, return "ERROR: Input is not valid JSON and could not be automatically corrected."
2. The root of the JSON object MUST be a key named "mcpServers". If missing, and the input is an object of server configs, wrap it with "mcpServers".
3. The value of "mcpServers" MUST be an object where each key is a server name (string) and each value is an object representing that server's configuration.
4. Each server configuration object (the value associated with a server name):
   - MAY contain a "type" property with a string value (e.g., "stdio", "sse"). If "type" is missing but a "command" property is present, assume "type": "stdio". If "type" is missing but a "url" property is present, assume "type": "sse".
   - If "type" is "stdio" (or assumed "stdio"):
     - MUST contain a "command" property (string value). If missing, this is an error for this server entry.
     - MAY contain "args" (array of strings). If "args" is a single string, convert it to an array containing that string.
     - MAY contain "cwd" (string value for current working directory).
     - MAY contain "env" (object where keys and values are strings).
   - If "type" is "sse":
     - MUST contain a "url" property (string value). If missing, this is an error for this server entry.
   - Unknown "type" values should be preserved but flagged if they don't meet stdio or sse criteria.
5. Preserve all user-provided data values. Do not invent new properties unless correcting structure (like wrapping in "mcpServers" or "args" array).
6. Reformat the JSON to be clean, well-indented (2 spaces), with consistent double quotes for all keys and string values.
7. Return ONLY the formatted JSON string as your output. Do not add any explanations or markdown fences around the JSON.
8. If critical structural errors persist that prevent forming the correct "mcpServers" structure (e.g., "command" missing for stdio, "url" missing for sse for a particular server entry after attempting corrections), return an error message starting with "ERROR:", describing the first major issue found for a specific server entry. For example: "ERROR: Server 'ServerName' of type 'stdio' is missing the required 'command' property."

User input JSON:
\`\`\`json
${jsonString}
\`\`\`

Formatted JSON (or error message):
`;
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: prompt,
      });
      
      let textResponse = response.text.trim();
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = textResponse.match(fenceRegex);
      if (match && match[2]) {
        textResponse = match[2].trim();
      }

      if (textResponse.startsWith("ERROR:")) {
        throw new Error(textResponse); 
      }
      return textResponse;

    } catch (error) {
      console.error("Error formatting MCP config with Gemini:", error);
      if (error instanceof Error && error.message.startsWith("ERROR:")) {
          throw error;
      }
      throw new Error(`AI formatting service error: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
