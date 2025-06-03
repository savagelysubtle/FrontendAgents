
import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";
import { ChatMessage, EvidenceFile, WcatCase, WcatCaseInfoExtracted, PolicyReference, PolicyEntry } from '../types';
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

const initializeAi = () => {
  if (!process.env.API_KEY) {
    console.error("Gemini API Key is not set in process.env.API_KEY");
    throw new Error("Gemini API Key is not configured.");
  }
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
};

export const summarizeEvidenceText = async (text: string): Promise<string> => {
  const currentAi = initializeAi();
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
  const currentAi = initializeAi();
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


const initializeChat = () => {
  const currentAi = initializeAi();
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

export const getChatResponse = async (
  history: ChatMessage[], 
  userQuery: string, 
  relevantFiles?: EvidenceFile[],
  relevantWcatCases?: WcatCase[]
): Promise<{text: string, groundingSources?: Array<{uri:string, title: string}>}> => {
  const chat = initializeChat();
  let prompt = userQuery;
  let contextHeader = "\n\nRelevant Context:\n";
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
  
  if (contextProvided) {
    prompt = `${contextHeader}\n\nUser Query: ${userQuery}`;
  }

  try {
    const response: GenerateContentResponse = await chat.sendMessage({ message: prompt });
    
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

export const resetChatSession = () => {
  chatInstance = null; 
  console.log("Chat session has been reset.");
};

export const getGroundedResponse = async (query: string): Promise<{text: string, sources: Array<{uri:string, title: string}>}> => {
  const currentAi = initializeAi();
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
    const currentAi = initializeAi();
    await currentAi.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: "test",
    });
    return true;
  } catch (error) {
    console.error("API Key test failed:", error);
    return false;
  }
};

export const expandWcatSearchQuery = async (userQuery: string): Promise<string> => {
  const currentAi = initializeAi();
  const prompt = AI_WCAT_QUERY_EXPANSION_PROMPT(userQuery);
  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
    });
    return response.text; // Assuming Gemini returns the expanded query string directly
  } catch (error) {
    console.error("Error expanding WCAT search query:", error);
    throw error;
  }
};

export const identifyWcatCasePatterns = async (caseText: string): Promise<string[]> => {
  const currentAi = initializeAi();
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
  const currentAi = initializeAi();
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
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s; // Regex to remove markdown fences if present
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    
    const parsedData = JSON.parse(jsonStr);
    // Add basic validation if needed, e.g., check if it's an array
    if (Array.isArray(parsedData)) {
        return parsedData.map(item => ({ // Ensure only expected fields are mapped
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
