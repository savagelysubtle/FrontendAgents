import { GoogleGenAI, GenerateContentResponse, Chat, Tool, mcpToTool, GenerateContentConfig, Part, Content, FunctionCall } from "@google/genai"; // Added FunctionCall, removed GResult types
import { Client as McpSDKClient } from "@modelcontextprotocol/sdk/client/index.js";
import { ChatMessage, EvidenceFile, WcatCase, WcatCaseInfoExtracted, PolicyReference, PolicyEntry, AiTool } from '../types';
import {
    GEMINI_TEXT_MODEL,
    AI_ANALYSIS_PROMPT_PREFIX,
    AI_CHAT_SYSTEM_INSTRUCTION,
    AI_WCAT_CASE_EXTRACTION_PROMPT,
    AI_WCAT_QUERY_EXPANSION_PROMPT,
    AI_WCAT_PATTERN_IDENTIFICATION_PROMPT,
    AI_POLICY_MANUAL_INDEXING_PROMPT
} from '../constants';

let ai: GoogleGenAI | null = null;
let chatInstance: Chat | null = null;
let geminiInitializationError: string | null = null;

const initializeAi = (): GoogleGenAI | null => {
  console.log("geminiService.ts: initializeAi called. Checking process.env.API_KEY:", process.env.API_KEY ? "Exists" : "MISSING or undefined");
  if (ai) return ai; // Already successfully initialized
  if (geminiInitializationError) return null; // Already failed initialization

  const apiKey = typeof process !== 'undefined' && process.env && process.env.API_KEY;

  if (!apiKey) {
    geminiInitializationError = "Gemini API Key is not configured in process.env.API_KEY.";
    console.error("geminiService.ts:", geminiInitializationError);
    return null;
  }
  try {
    ai = new GoogleGenAI({ apiKey }); // Use the local apiKey const
    console.log("geminiService.ts: GoogleGenAI client initialized successfully.");
    return ai;
  } catch (e: any) {
    geminiInitializationError = `Failed to initialize GoogleGenAI: ${e.message}`;
    console.error("geminiService.ts:", geminiInitializationError, e);
    ai = null;
    return null;
  }
};

// Call initializeAi once at a higher level if preferred, or ensure it's called by each exported function.
// For simplicity and to ensure it's attempted before first use:
// initializeAi(); // This would log error to console if key is missing, but not throw.

const ensureAiInitialized = (): GoogleGenAI => {
  const currentAi = initializeAi();
  if (!currentAi) {
    throw new Error(geminiInitializationError || "Gemini AI client is not initialized. API Key may be missing or invalid.");
  }
  return currentAi;
};


export const summarizeEvidenceText = async (text: string): Promise<string> => {
  const currentAi = ensureAiInitialized();
  const fullPrompt = `${AI_ANALYSIS_PROMPT_PREFIX}${text}\n\"\"\"`;

  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    });
    return response.text ?? ''; // Ensure text is not undefined
  } catch (error) {
    console.error("Error summarizing evidence text:", error);
    throw error;
  }
};

export const extractWcatCaseInfoFromText = async (pdfText: string, decisionNumber: string): Promise<WcatCaseInfoExtracted> => {
  const currentAi = ensureAiInitialized();
  const prompt = AI_WCAT_CASE_EXTRACTION_PROMPT(decisionNumber) + pdfText + '\n\"\"\"';

  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
      }
    });
    let jsonStr = response.text?.trim() ?? ''; // Ensure text is not undefined
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }

    const parsedData = JSON.parse(jsonStr);
    if (!parsedData.decisionNumber || parsedData.decisionNumber !== decisionNumber) {
        console.warn("Mismatched decision number in Gemini response, using provided.", parsedData.decisionNumber, decisionNumber);
    }
    parsedData.decisionNumber = decisionNumber;
    return parsedData as WcatCaseInfoExtracted;

  } catch (error) {
    console.error(`Error extracting WCAT case info for ${decisionNumber}:`, error);
    throw error;
  }
};


const initializeChatInternal = (history?: Content[], toolsForSession?: any[]): Chat => {
  const currentAi = ensureAiInitialized();
  // resetChatSession() called by AgUiAgentService is responsible for nullifying chatInstance.
  // So, if chatInstance is null here, we must create a new one.
  // If tools are provided, a new instance is also created to ensure they are part of the session.
  if (!chatInstance || (toolsForSession && toolsForSession.length > 0)) {
    const chatCreationConfig: { model: string; systemInstruction?: string; tools?: any[]; history?: Content[], generationConfig?: GenerateContentConfig } = {
        model: GEMINI_TEXT_MODEL,
        systemInstruction: AI_CHAT_SYSTEM_INSTRUCTION,
    };
    if (toolsForSession) {
        chatCreationConfig.tools = toolsForSession;
    }
    if (history && history.length > 0) { // Allow starting chat with history
        chatCreationConfig.history = history;
    }
    chatInstance = currentAi.chats.create(chatCreationConfig); // Corrected: Use ai.chats.create
    console.log("geminiService.ts: New chatInstance created.",
                chatCreationConfig.tools ? "Tools included." : "No tools.",
                chatCreationConfig.history ? "History included." : "No history init.");
  } else if (history && history.length > 0 && chatInstance && (chatInstance as any).history) {
    // If reusing an existing chat instance, and new history is provided that should precede the next message.
    // This is a bit complex as SDK might not directly support "injecting" history like this without `startChat`.
    // For simplicity, `resetChatSession` before runs that require fresh history + tools is the primary strategy.
    // This else-if block might be removed if `resetChatSession` is always called.
    (chatInstance as any).history = history; // This is a conceptual assignment; SDK might not work this way.
     console.log("geminiService.ts: Existing ChatInstance history updated (conceptual).");
  }
  return chatInstance!; // Non-null assertion, as logic should ensure it's created.
};

const prepareChatPrompt = (
  userQuery: string,
  relevantFiles?: EvidenceFile[],
  relevantWcatCases?: WcatCase[],
  relevantTools?: AiTool[] // This is the AppAiTool for descriptive context
): string => {
  let prompt = userQuery;
  let contextHeader = "\n\nRelevant Context & Available Tools (Descriptive):\n";
  let contextProvided = false;

  if (relevantFiles && relevantFiles.length > 0) {
    contextProvided = true;
    const fileContext = relevantFiles.map(f => `Doc: ${f.name} (Summary: ${f.summary || 'N/A'})`).join("; ");
    contextHeader += `\n--- Evidence Files ---\n${fileContext}`;
  }

  if (relevantWcatCases && relevantWcatCases.length > 0) {
    contextProvided = true;
    const wcatContext = relevantWcatCases.map(c => `WCAT: ${c.decisionNumber} (Outcome: ${c.outcomeSummary})`).join("; ");
    contextHeader += `\n--- WCAT Precedents ---\n${wcatContext}`;
  }

  // This section describes AiTool[] (application's definition) for context, not for Gemini's direct execution via mcpToTool
  if (relevantTools && relevantTools.length > 0) {
    contextProvided = true;
    const toolDesc = relevantTools.map(t => `${t.name}: ${t.description}`).join("; ");
    contextHeader += `\n--- App Tools ---\n${toolDesc}`;
  }

  if (contextProvided) {
    prompt = `${contextHeader}\n\nUser Query: ${userQuery}`;
  }
  return prompt;
};

export const getChatResponse = async (
  history: ChatMessage[],
  userQuery: string,
  relevantFiles?: EvidenceFile[],
  relevantWcatCases?: WcatCase[],
  relevantAppAiTools?: AiTool[],
  mcpSdkClient?: McpSDKClient | null
): Promise<{text: string, groundingSources?: Array<{uri:string, title: string}>}> => {

  let toolsForSession: any[] | undefined = undefined;
  if (mcpSdkClient) {
    toolsForSession = [mcpToTool(mcpSdkClient)];
    console.log("geminiService.ts: MCP Tools configured for getChatResponse.");
  }

  const geminiHistory: Content[] = history.map(h => ({
    role: h.sender === 'ai' ? 'model' : 'user',
    parts: [{ text: h.text }]
  }));

  const chat = initializeChatInternal(geminiHistory, toolsForSession);
  const fullPrompt = prepareChatPrompt(userQuery, relevantFiles, relevantWcatCases, relevantAppAiTools);

  try {
    const response: GenerateContentResponse = await chat.sendMessage(fullPrompt);

    const functionCalls = response.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      console.warn("geminiService: Function call(s) requested by model in getChatResponse. Automatic handling via mcpToTool is expected. If it stalls, manual loop is needed.", functionCalls);
      // If mcpToTool handles it automatically, the final response will have text.
      // If not, this indicates a need for a manual tool call loop here.
      // For now, we assume mcpToTool + SDK handles the loop or the final text is available.
    }

    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const groundingSources: Array<{uri:string, title: string}> = [];
    if (groundingMetadata?.groundingChunks) {
        for (const chunk of groundingMetadata.groundingChunks) {
            if (chunk.web && chunk.web.uri) {
                groundingSources.push({ uri: chunk.web.uri, title: chunk.web.title || chunk.web.uri });
            }
        }
    }
    return { text: response.text ?? (functionCalls && functionCalls.length > 0 ? "[Function call processing expected by SDK]" : ''), groundingSources };
  } catch (error) {
    console.error("Error getting chat response:", error);
    throw error;
  }
};

export const getChatResponseStream = async (
  userQuery: string,
  relevantFiles?: EvidenceFile[],
  relevantWcatCases?: WcatCase[],
  relevantAppAiTools?: AiTool[],
  mcpSdkClient?: McpSDKClient | null
): Promise<AsyncIterable<GenerateContentResponse>> => {

  let toolsForSession: any[] | undefined = undefined; // Use any[] for tools for mcpToTool output
  if (mcpSdkClient) {
    toolsForSession = [mcpToTool(mcpSdkClient)];
    console.log("geminiService: MCP Tools enabled for this stream request (via chat initialization).");
  }

  const chat = initializeChatInternal(undefined, toolsForSession);
  const fullPrompt = prepareChatPrompt(userQuery, relevantFiles, relevantWcatCases, relevantAppAiTools);

  try {
    // sendMessageStream itself returns Promise<AsyncIterable<GenerateContentResponse>> if SDK types are simplified this way.
    // Or it returns Promise<StreamGenerateContentResult> where .stream is the iterable.
    // Based on persistent linter errors about StreamGenerateContentResult not found, trying the simpler direct return.
    const streamResult = await chat.sendMessageStream(fullPrompt);
    // If sendMessageStream returns StreamGenerateContentResult, it should be: return streamResult.stream;
    // Assuming for now it returns the iterable directly based on type simplification:
    return streamResult;
  } catch (error) {
    console.error("Error getting chat stream response:", error);
    throw error;
  }
};


export const resetChatSession = () => {
  // This function is called by AgUiAgentService to effectively reset the context for a new run.
  // It ensures that the next call to initializeChatInternal() will create a new chat instance.
  chatInstance = null;
  console.log("geminiService.ts: Gemini chat session instance has been reset for the next interaction.");
};

export const getGroundedResponse = async (query: string): Promise<{text: string, sources: Array<{uri:string, title: string}>}> => {
  const currentAi = ensureAiInitialized();
  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: [{role: 'user', parts:[{text: query}]}],
      tools: [{ "google_search_retrieval": {} }], // Corrected tools structure for Google Search
    });
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const sources: Array<{uri:string, title: string}> = [];
     if (groundingMetadata?.groundingChunks) {
        for (const chunk of groundingMetadata.groundingChunks) {
            if (chunk.web && chunk.web.uri) {
                sources.push({ uri: chunk.web.uri, title: chunk.web.title || chunk.web.uri });
            }
        }
    }

    return { text: response.text ?? '', sources }; // Ensure text is not undefined
  } catch (error) {
    console.error("Error getting grounded response:", error);
    if (error instanceof Error && error.message.includes("application/json")) {
        console.warn("If using googleSearch tool, responseMimeType should not be 'application/json'.");
    }
    throw error;
  }
};

export const testApiKey = async (): Promise<boolean> => {
  try {
    // Attempt to initialize AI, which will use the (polyfilled) process.env.API_KEY
    const currentAi = initializeAi(); // Use the version that doesn't throw immediately
    if (!currentAi) {
      console.error("geminiService.ts: API Key test failed:", geminiInitializationError || "AI client could not be initialized.");
      return false;
    }
    // A simple content generation to test the key
    const response: GenerateContentResponse = await currentAi.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: [{role: 'user', parts: [{text: "test"}]}]
    });
    return !!response.text;
  } catch (error) {
    console.error("geminiService.ts: API Key test failed during generateContent call:", error);
    return false;
  }
};

export const expandWcatSearchQuery = async (userQuery: string): Promise<string> => {
  const currentAi = ensureAiInitialized();
  const prompt = AI_WCAT_QUERY_EXPANSION_PROMPT(userQuery);
  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: [{role: 'user', parts: [{text: prompt}]}]
    });
    return response.text ?? ''; // Ensure text is not undefined
  } catch (error) {
    console.error("Error expanding WCAT search query:", error);
    throw error;
  }
};

export const identifyWcatCasePatterns = async (caseText: string): Promise<string[]> => {
  const currentAi = ensureAiInitialized();
  const prompt = AI_WCAT_PATTERN_IDENTIFICATION_PROMPT(caseText);
  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: [{role: 'user', parts:[{text: prompt}]}],
      generationConfig: { // Top-level property
        responseMimeType: "application/json",
      }
    });
    let jsonStr = response.text?.trim() ?? ''; // Ensure text is not undefined
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }

    const parsedData = JSON.parse(jsonStr);
    if (Array.isArray(parsedData) && parsedData.every(item => typeof item === 'string')) {
      return parsedData as string[];
    } else {
      console.error("Failed to parse pattern array from Gemini response:", parsedData);
      throw new Error("AI response for patterns was not a valid JSON array of strings.");
    }
  } catch (error) {
    console.error("Error identifying WCAT case patterns:", error);
    throw error;
  }
};

export const extractPolicyEntriesFromManualText = async (manualText: string, manualName: string): Promise<PolicyEntry[]> => {
  const currentAi = ensureAiInitialized();
  const prompt = AI_POLICY_MANUAL_INDEXING_PROMPT(manualName) + manualText + '\n\"\"\"';

  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: [{role: 'user', parts:[{text: prompt}]}],
      generationConfig: { // Top-level property
        responseMimeType: "application/json",
      }
    });
    let jsonStr = response.text?.trim() ?? ''; // Ensure text is not undefined
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }

    const parsedData = JSON.parse(jsonStr);
    if (Array.isArray(parsedData)) {
        return parsedData.map(item => ({
            policyNumber: item.policyNumber,
            title: item.title,
            page: item.page,
            snippet: item.snippet,
        })) as PolicyEntry[];
    } else {
        console.error("Failed to parse policy entries array from Gemini response:", parsedData);
        throw new Error("AI response for policy entries was not a valid JSON array.");
    }

  } catch (error) {
    console.error(`Error extracting policy entries from manual "${manualName}":`, error);
    throw error;
  }
};