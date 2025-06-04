import { AbstractAgent, RunAgentInput, RunAgent, BaseEvent, EventType, Message as AgUiMessage, Tool as AgUiToolDefinition, Context as AgUiClientContextType, AgentConfig, TextMessageStartEvent, TextMessageContentEvent, TextMessageEndEvent, ToolCallStartEvent, ToolCallArgsEvent, ToolCallEndEvent, RunStartedEvent, RunErrorEvent, RunFinishedEvent, CustomEvent, ToolCall } from "@ag-ui/client"; // Renamed Context to AgUiClientContextType
import { Observable, Subscriber } from "rxjs";
import { v4 as uuidv4 } from 'uuid';
import { Client as McpSDKClient } from "@modelcontextprotocol/sdk/client/index.js"; // Added for type safety

// Local imports
import { getChatResponseStream, resetChatSession as resetGeminiChat } from './geminiService';
import { EvidenceFile, WcatCase, AiTool as AppAiTool, ChatMessage as AppChatMessage, DynamicMarker } from '../types';
import { McpClient } from './McpClient';

// Assuming Context type from @ag-ui/client is structurally { value: string; description: string; }
// This is based on the error messages. If it's different, this needs to change.
interface AgUiClientContext {
  value: string;
  description: string;
}

const resolveContext = (
    contextInputArray: AgUiClientContext[] | undefined, // Expect an array of these context objects
  ): { relevantFiles: EvidenceFile[], relevantWcatCases: WcatCase[], relevantAppAiTools: AppAiTool[] } => {

  const files: EvidenceFile[] = [];
  const wcatCases: WcatCase[] = [];
  const appAiTools: AppAiTool[] = [];

  if (contextInputArray && contextInputArray.length > 0) {
    // For simplicity, assume the first context item's 'value' field contains the JSON string of our app context
    const contextItem = contextInputArray[0];
    if (contextItem && typeof contextItem.value === 'string') {
      try {
        const parsedValue = JSON.parse(contextItem.value);

        if (parsedValue.appRelevantFiles && Array.isArray(parsedValue.appRelevantFiles)) {
          files.push(...(parsedValue.appRelevantFiles as EvidenceFile[]));
        }
        if (parsedValue.appRelevantWcatCases && Array.isArray(parsedValue.appRelevantWcatCases)) {
          wcatCases.push(...(parsedValue.appRelevantWcatCases as WcatCase[]));
        }
        if (parsedValue.appRelevantAppAiTools && Array.isArray(parsedValue.appRelevantAppAiTools)) {
          appAiTools.push(...(parsedValue.appRelevantAppAiTools as AppAiTool[]));
        }
        // Add more properties from parsedValue as needed
      } catch (e) {
        console.error("Failed to parse contextInput.value in resolveContext:", e, contextItem.value);
      }
    }
  }
  return { relevantFiles: files, relevantWcatCases: wcatCases, relevantAppAiTools: appAiTools };
};


export class GeminiAgUiAgent extends AbstractAgent {
  private mcpClient: McpClient | null;

  constructor(
    dependencies: {
      mcpClient?: McpClient | null; // Allow null in addition to undefined
    } = {}
  ) {
    super({ agentId: "gemini-legal-evidence-agent" } as AgentConfig);
    this.mcpClient = dependencies.mcpClient || null;
    resetGeminiChat();
  }

  public publicRun(input: RunAgentInput): Observable<BaseEvent> {
    return this.run(input);
  }

  protected run(input: RunAgentInput): Observable<BaseEvent> {
    return new Observable<BaseEvent>((subscriber: Subscriber<BaseEvent>) => {
      this.executeGeminiInteraction(input, subscriber)
        .catch(error => {
          console.error("Error in executeGeminiInteraction:", error);
          subscriber.next({
            type: EventType.RUN_ERROR,
            runId: input.runId,
            threadId: input.threadId,
            message: error.message || "An unknown error occurred in the agent.",
            timestamp: Date.now()
          } as RunErrorEvent);
          subscriber.complete();
        });

      return () => {
        // Cleanup logic if needed when observable is unsubscribed
      };
    });
  }

  private async executeGeminiInteraction(input: RunAgentInput, subscriber: Subscriber<BaseEvent>): Promise<void> {
    const { runId, threadId, messages: agUiMessages, context: agUiContextInputFromRun } = input;

    subscriber.next({ type: EventType.RUN_STARTED, runId, threadId, timestamp: Date.now() } as RunStartedEvent);

    const userQueryMessage = [...agUiMessages].reverse().find(m => m.role === 'user');
    if (!userQueryMessage || !userQueryMessage.content) {
      subscriber.next({ type: EventType.RUN_ERROR, runId, threadId, message: "No user query found in messages.", timestamp: Date.now() } as RunErrorEvent);
      subscriber.complete();
      return;
    }
    const userQuery = userQueryMessage.content as string;

    // Resolve context using the new interpretation
    const { relevantFiles, relevantWcatCases, relevantAppAiTools } = resolveContext(
        agUiContextInputFromRun as AgUiClientContext[] | undefined // Cast to the array type
      );

    resetGeminiChat();

    let mcpSdkClientForTools: McpSDKClient | null = null;
    if (this.mcpClient && this.mcpClient.ready) {
      mcpSdkClientForTools = this.mcpClient.getSdkClient();
      if (mcpSdkClientForTools) {
        // this.mcpClient.addAuditLog('MCP_AGENT_TOOLS_ENABLED', 'MCP SDK Client available, enabling for Gemini tools.');
        console.log('MCP SDK Client available, enabling for Gemini tools via AgUiAgentService.');
      } else {
        // this.mcpClient.addAuditLog('MCP_AGENT_TOOLS_WARN_NO_SDKCLIENT', 'McpClient ready, but getSdkClient() returned null.');
        console.warn('McpClient ready, but getSdkClient() returned null in AgUiAgentService.');
      }
    } else if (this.mcpClient) { // McpClient exists but is not ready
        // this.mcpClient.addAuditLog('MCP_AGENT_TOOLS_UNAVAILABLE', `McpClient not ready. Error: ${this.mcpClient.getInitializationError()}`);
        console.warn(`McpClient not ready in AgUiAgentService. Error: ${this.mcpClient.getInitializationError()}`);
    }

    try {
      const stream = await getChatResponseStream(userQuery, relevantFiles, relevantWcatCases, relevantAppAiTools, mcpSdkClientForTools);

      const streamingMessageId = `ai-msg-${uuidv4()}`;
      subscriber.next({ type: EventType.TEXT_MESSAGE_START, role: "assistant", messageId: streamingMessageId, timestamp: Date.now() } as TextMessageStartEvent);

      let accumulatedText = "";
      for await (const chunk of stream) {
        if (chunk.text) {
          subscriber.next({ type: EventType.TEXT_MESSAGE_CONTENT, messageId: streamingMessageId, delta: chunk.text, timestamp: Date.now() } as TextMessageContentEvent);
          accumulatedText += chunk.text;
        }
      }
      subscriber.next({ type: EventType.TEXT_MESSAGE_END, messageId: streamingMessageId, timestamp: Date.now() } as TextMessageEndEvent);

      if (relevantFiles.length === 1) {
        const markerRegex = /AI_MARKERS_PAYLOAD:\s*(\[.*?\])/s;
        const match = accumulatedText.match(markerRegex);
        if (match && match[1]) {
          try {
            const parsedMarkers: DynamicMarker[] = JSON.parse(match[1]);
            if (Array.isArray(parsedMarkers) && parsedMarkers.every(m => typeof m.text === 'string' && typeof m.type === 'string')) {
              subscriber.next({
                type: EventType.CUSTOM,
                name: "displayEvidenceMarkers",
                value: {
                  fileId: relevantFiles[0].id,
                  markers: parsedMarkers,
                },
                timestamp: Date.now()
              } as CustomEvent);
            }
          } catch (e) {
            console.warn("Failed to parse AI_MARKERS_PAYLOAD from AI response:", e);
          }
        }
      }

      subscriber.next({ type: EventType.RUN_FINISHED, runId, threadId, timestamp: Date.now() } as RunFinishedEvent);
      subscriber.complete();

    } catch (error: any) {
      console.error("Error during Gemini interaction:", error);
      subscriber.next({ type: EventType.RUN_ERROR, runId, threadId, message: error.message || "Failed to get response from AI.", timestamp: Date.now() } as RunErrorEvent);
      subscriber.complete();
    }
  }
}
