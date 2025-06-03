# AI Legal Evidence Organizer

**AI Legal Evidence Organizer** is a sophisticated desktop application designed for legal self-representatives, advocates, and lawyers. It leverages the power of AI to help users organize, tag, analyze, and understand legal evidence and related case law.

The application is architected to interact with a local "MCP (My Computer's Processor) Server" for all evidence file operations. This interaction is managed by an `McpClient` within the frontend, which discovers server capabilities and endpoints via a configuration file named `mcp.json`. This setup ensures that, conceptually, all sensitive data processing and file storage remains local to the user's environment.

**Note:** In this demonstration environment, while the `McpClient` attempts to make real HTTP calls as defined in `mcp.json` (e.g., to `http://localhost:8081`), a corresponding backend server is not provided. Therefore, direct file operations will likely fail, but the architectural pattern of client-server interaction is established. Application state (metadata, tags, etc.) is persisted in the browser's `localStorage`.

## Key Features

*   **Evidence Management (via MCP Server Interaction):**
    *   **File Ingestion:** Batch upload and process various file types. The `McpClient` attempts to write file data to the configured MCP server.
    *   **Document Viewer:** Preview documents. Content is fetched via `McpClient` from the server. Manage AI summaries, metadata, tags, and annotations.
    *   **Tagging:** Create and apply custom tags with criteria for categorization.
    *   **Annotations:** Add notes to documents.
*   **AI-Powered Analysis (via Google Gemini API):**
    *   **Evidence Summarization:** Automatically generate summaries of legal texts (content fetched via `McpClient`).
    *   **Policy Extraction:** Identify WorkSafeBC policy references within documents.
    *   **Intelligent Chat Agent:** Interact with an AI assistant. Context can include files (content fetched via `McpClient`), WCAT precedents, and policy manuals.
    *   **Grounded Responses:** Optionally use Google Search for up-to-date information.
*   **WCAT Precedent Integration & Policy Manuals:**
    *   **WCAT Search & Database:** (Simulated external search) Import and manage a local database of WCAT precedents, processed by AI.
    *   **Policy Manual:** (Simulated loading) Browse WorkSafeBC policy manuals.
*   **Local Data Interaction Model:**
    *   **`mcp.json`:** A configuration file defining the MCP server's API (base URL, endpoints). Fetched by `McpClient` on startup.
    *   **`McpClient.ts`:** A service that reads `mcp.json` and makes HTTP requests to the configured MCP server for all file operations (listing, reading, writing, deleting, etc.).
    *   **`localStorage`:** Used in this demo for persisting application metadata, tags, chat history, WCAT cases, and policies. Actual file *content* is conceptually on the MCP server.
*   **User Experience:**
    *   Responsive Design, Dark/Light Theme, Audit Logging.
    *   **Export Center:** Requests exports (e.g., ZIP, CSV) that would be handled by the MCP server.

## Tech Stack (Frontend)

*   **React & TypeScript**
*   **Tailwind CSS**
*   **Google Gemini API (`@google/genai`)**
*   **React Router**
*   **ESM Modules with `importmap`**

## MCP Server Interaction

*   The frontend `McpClient` attempts to communicate with a local server whose endpoints are defined in `/mcp.json`.
*   **Example `mcp.json` might specify a `baseApiUrl` like `http://localhost:8081/mcp-api` and endpoints like `/fs/read` or `/fs/write`.**
*   This architecture separates the frontend UI from the local data processing logic, which would reside in the actual MCP server (e.g., a Rust application).
*   **In this sandbox, `http://localhost:8081` is not expected to be running. Calls will fail, and the UI should indicate this.** The focus is on the client's attempt to use the configuration.

## Setup & Running

1.  **API Key for Google Gemini:**
    *   A valid Google Gemini API key is **required**.
    *   Set it as an environment variable `API_KEY` OR enter it in the application's Settings page for the session.
        ```bash
        export API_KEY="YOUR_GEMINI_API_KEY"
        ```

2.  **`mcp.json` Configuration:**
    *   Ensure `mcp.json` is present in the root directory, configured to point to your intended (even if currently non-existent) MCP server.

3.  **Serve the Application:**
    *   Use a simple HTTP server from the project's root directory:
        *   `npx serve .` (Node.js)
        *   `python -m http.server` (Python 3)
    *   Open the provided URL (e.g., `http://localhost:3000`).

## Usage Highlights

*   **File Operations:** When ingesting, viewing, or deleting files, the application will attempt to communicate with the MCP server endpoints specified in `mcp.json`. Success/failure of these operations depends on a listening server.
*   **AI Chat Context:** If files are selected for chat context, their content will be actively fetched from the MCP server (if available) to provide to the AI.
*   **Settings Page:** Shows the status of the MCP client's initialization and its attempt to connect to the server defined in `mcp.json`.

## Important Notes

*   **MCP Server Unavailability:** Without a real MCP server running at the address configured in `mcp.json` (e.g., `http://localhost:8081`), file operations (read, write, list, delete) performed by the `McpClient` will fail. The application attempts to handle these failures gracefully by reporting errors.
*   **`localStorage` for Metadata:** Non-file-content data (tags, summaries derived by AI, WCAT case info, etc.) is stored in `localStorage`.
*   **Gemini API Usage:** AI features require an internet connection and a valid Gemini API key.
