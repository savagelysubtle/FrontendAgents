# Future Features for Desktop MCP Ingestor

This document outlines potential future enhancements and features for the Desktop MCP Ingestor application.

## 1. Enhanced Chat Functionality

### 1.1. Persistent Chat History
*   **Description:** Store chat conversations persistently using the browser's `localStorage` or `IndexedDB`. This will allow users to close the application or reload the page and still have access to their previous conversations.
*   **Implementation Notes:**
    *   Each chat session/thread should be saved.
    *   Consider a mechanism to limit the amount of history stored to avoid excessive `localStorage` usage (e.g., keep the last N messages per thread, or a total size limit).
    *   The `ingestedData.summaryText` active at the time of the chat should ideally be linked or stored with the chat history for context.

### 1.2. Dedicated Chat History View
*   **Description:** Introduce a new page, tab within the "Chat" panel, or a dedicated section in "Settings" to browse and manage saved chat histories.
*   **Features:**
    *   List of saved chat sessions (e.g., by date, first message, or a user-defined title).
    *   Ability to select and re-open a past chat session, reloading the messages into the main chat view.
    *   Option to delete individual chat sessions or clear all history.

### 1.3. Project-Based Chat & Context Management
*   **Description:** Allow users to create or associate chats with "Projects." A project could be linked to a specific ingested folder or a particular task.
*   **Benefits:**
    *   **Context-Aware Chats:** When a project's chat is reopened, the application could automatically try to re-establish the context that was active during that chat (e.g., by displaying the summary of the ingested folder associated with that project). This emulates the context awareness seen in platforms like Claude or ChatGPT where conversations are self-contained.
    *   **Organized History:** Users can more easily find relevant past conversations by browsing projects.
*   **Implementation Ideas:**
    *   When ingesting a folder, offer an option to "Start new project chat" or "Add to existing project."
    *   Project metadata (name, associated ingest summary ID/timestamp) would need to be stored alongside chat histories.

### 1.4. Advanced Chat Features
*   Export individual chat conversations (e.g., as plain text or Markdown).
*   Search within chat history.
*   Ability to "pin" or "favorite" important chat sessions.

## 2. MCP Server Integration
*   **Description:** Fully implement the client-side logic to interact with an MCP server based on the `mcp.json` tool definitions and the server URL/token configured in settings.
*   **Features:**
    *   Allow AI (via slash commands or natural language) to trigger defined MCP commands.
    *   Parse `mcp.json` to understand available tools and their required arguments.
    *   Construct and send requests to the configured MCP server URL.
    *   Display output/responses from the MCP server in the chat or a dedicated output panel.
    *   Handle errors and feedback from the MCP server.

## 3. File Manager Enhancements
*   **Actual File Operations (via MCP Server):** If an MCP server is configured and provides file operation capabilities (move, rename, delete, create folder), allow the "AI Organize Structure" feature to optionally execute these changes.
*   **File Previews:** For common text-based file types, show a more direct preview in the File Manager instead of just the overall summary.
*   **Advanced Search/Filter:** Add options to search or filter the file tree in the File Manager.

## 4. UI/UX Refinements
*   **Loading/Progress Indicators:** More granular progress indicators for long-running AI tasks or large ingests.
*   **Accessibility Improvements:** Continuously review and improve ARIA attributes and keyboard navigation.
*   **Performance Optimizations:** For very large folder ingests or extensive chat histories.

## 5. Configuration Management
*   **Cloud Sync (Optional):** Allow users to optionally back up/sync their settings (and perhaps project/chat history if designed securely) to a cloud storage provider of their choice. This would be a significant undertaking requiring user authentication and careful security considerations.
