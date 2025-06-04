
import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai"; // Corrected import
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

  if (!process.env.API_KEY) {
    geminiInitializationError = "Gemini API Key is not configured in process.env.API_KEY.";
    console.error("geminiService.ts:", geminiInitializationError);
    return null;
  }
  try {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
  const fullPrompt = `${AI_ANALYSIS_PROMPT_PREFIX}${text}\n"""`;

  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: fullPrompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error summarizing evidence text:", error);
    throw error;
  }
};

export const extractWcatCaseInfoFromText = async (pdfText: string, decisionNumber: string): Promise<WcatCaseInfoExtracted> => {
  const currentAi = ensureAiInitialized();
  const prompt = AI_WCAT_CASE_EXTRACTION_PROMPT(decisionNumber) + pdfText + '\n"""';
  
  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
        model: GEMINI_TEXT_MODEL,
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


const initializeChatInternal = (): Chat => {
  const currentAi = ensureAiInitialized();
  // Re-create chatInstance if it's null or if system instruction needs to be re-applied.
  // For simplicity, this basic chat does not handle history persistence within geminiService itself,
  // but relies on the calling agent (AgUiAgentService) to manage history.
  // If chatInstance exists, we assume it's usable. A more robust solution might check its state.
  if (!chatInstance) {
      chatInstance = currentAi.chats.create({
        model: GEMINI_TEXT_MODEL,
        config: {
          systemInstruction: AI_CHAT_SYSTEM_INSTRUCTION,
        },
      });
  }
  return chatInstance;
};

const prepareChatPrompt = (
  userQuery: string,
  relevantFiles?: EvidenceFile[],
  relevantWcatCases?: WcatCase[],
  relevantTools?: AiTool[] // Added AiTool[]
): string => {
  let prompt = userQuery;
  let contextHeader = "\n\nRelevant Context & Available Tools:\n";
  let contextProvided = false;

  if (relevantFiles && relevantFiles.length > 0) {
    contextProvided = true;
    const fileContext = relevantFiles.map(file => 
      `Document: ${file.name}\nSummary: ${file.summary || 'Not summarized.'}\nTags: ${file.tags.map(t => t.name).join(', ') || 'No tags.'}\nReferenced Policies: ${file.referencedPolicies?.map(p => p.policyNumber).join(', ') || 'None'}`
    ).join("\n---\n");
    contextHeader += `\n--- User's Evidence Files ---\n${fileContext}`;
  }

  if (relevantWcatCases && relevantWcatCases.length > 0) {
    contextProvided = true;
    const wcatContext = relevantWcatCases.map(wcase =>
      `WCAT Decision: ${wcase.decisionNumber} (${wcase.year})\nOutcome: ${wcase.outcomeSummary}\nAI Summary: ${wcase.aiSummary}\nReferenced Policies: ${wcase.referencedPolicies.map(p => p.policyNumber).join(', ') || 'None'}\nKeywords: ${wcase.keywords.join(', ')}\nPattern Tags: ${wcase.tags.filter(t => t.scope === 'wcat_pattern').map(t => t.name).join('; ') || 'None'}`
    ).join("\n---\n");
    contextHeader += `\n--- Relevant WCAT Precedents ---\n${wcatContext}`;
  }
  
  if (relevantTools && relevantTools.length > 0) {
    contextProvided = true;
    const toolContext = relevantTools.map(tool =>
      `Tool: ${tool.name} (${tool.type})\nDescription: ${tool.description}${tool.usageExample ? `\nUsage Example: ${tool.usageExample}` : ''}${tool.type === 'mcp_process' && tool.mcpProcessDetails ? `\n(This is an MCP server process: ${tool.mcpProcessDetails.command} ${tool.mcpProcessDetails.args.join(' ')})` : ''}`
    ).join("\n---\n");
    contextHeader += `\n--- Available Tools/Capabilities ---\n${toolContext}`;
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
  relevantTools?: AiTool[] // Added AiTool[]
): Promise<{text: string, groundingSources?: Array<{uri:string, title: string}>}> => {
  const chat = initializeChatInternal();
  const fullPrompt = prepareChatPrompt(userQuery, relevantFiles, relevantWcatCases, relevantTools);

  try {
    // For non-streaming, sendMessage returns GenerateContentResponse directly
    // The 'history' parameter is not directly used here because this chatInstance maintains its own history.
    // If a fresh chat with history is needed each time, initializeChatInternal would need to accept history.
    const response: GenerateContentResponse = await chat.sendMessage({ message: fullPrompt });
    
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const groundingSources = groundingMetadata?.groundingChunks
        ?.filter(chunk => chunk.web && chunk.web.uri)
        .map(chunk => ({ uri: chunk.web.uri, title: chunk.web.title || chunk.web.uri })) || [];

    return { text: response.text, groundingSources };
  } catch (error) {
    console.error("Error getting chat response:", error);
    throw error;
  }
};

export const getChatResponseStream = async (
  userQuery: string, 
  relevantFiles?: EvidenceFile[],
  relevantWcatCases?: WcatCase[],
  relevantTools?: AiTool[] // Added AiTool[]
): Promise<AsyncIterable<GenerateContentResponse>> => { // Corrected return type
  const chat = initializeChatInternal();
  const fullPrompt = prepareChatPrompt(userQuery, relevantFiles, relevantWcatCases, relevantTools);

  try {
    // Based on the error and SDK examples, chat.sendMessageStream() when awaited
    // directly yields the AsyncIterable (the stream itself).
    const stream = await chat.sendMessageStream({ message: fullPrompt });
    return stream;
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
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const sources = groundingMetadata?.groundingChunks
        ?.filter(chunk => chunk.web && chunk.web.uri)
        .map(chunk => ({ uri: chunk.web.uri, title: chunk.web.title || chunk.web.uri })) || [];
        
    return { text: response.text, sources };
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
    await currentAi.models.generateContent({ // This call will throw if the key is truly invalid
      model: GEMINI_TEXT_MODEL,
      contents: "test",
    });
    return true;
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
      contents: prompt,
    });
    return response.text; 
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
  const prompt = AI_POLICY_MANUAL_INDEXING_PROMPT(manualName) + manualText + '\n"""';
  
  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
        model: GEMINI_TEXT_MODEL,
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