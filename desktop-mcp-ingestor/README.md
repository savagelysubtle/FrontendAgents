# Desktop MCP Ingestor

**A local desktop application that ingests folders, converts each into a single-page .txt summary (file tree + metadata), and allows AI chat about the ingested content, with the ability to interact with backend tools via an AG-UI compatible agent.**

## Overview

The Desktop MCP (Model Context Protocol) Ingestor is designed to help users quickly understand the contents of local folders. It processes a selected folder, generates a textual summary including a file tree and basic metadata, and then allows the user to interact with an AI to ask questions about this ingested content. Furthermore, it can connect to a backend AG-UI (Agent-User Interface) compatible agent, enabling the AI to leverage external tools and capabilities defined by that agent.

## Core Features

*   **Folder Ingestion:** Select a local folder to process.
*   **Content Summarization:** Generates a `.txt` summary including:
    *   File tree structure (folders and files).
    *   Basic metadata (file count, total size, timestamp).
*   **AI Chat Interface:**
    *   Chat with an AI (powered by a backend agent) about the ingested content.
    *   AI can answer questions, suggest organizational changes, and more.
*   **Backend Agent Integration (AG-UI):**
    *   Connects to an AG-UI compatible backend agent specified by URL.
    *   The AI can request the backend agent to use configured tools (MCP Tools).
    *   Frontend displays tools reported by the agent.
    *   Users can enable/disable tools for AI interaction.
*   **Tool Management:** A dedicated panel to view available tools reported by the agent and manage their enabled/disabled state.
*   **Local File Operations (via Agent):** The AI can leverage backend tools to potentially perform file operations, depending on the agent's capabilities.
*   **Settings Management:**
    *   Configure application behavior (theme, max file size, ignore patterns, agent URL).
    *   Manage backend tool configuration (if the agent uses a JSON definition like `mcp.json`).
    *   Import/Export settings.
*   **Dark/Light Theme:** Switch between dark and light UI themes.
*   **Responsive Design:** Adapts to different screen sizes.

## Tech Stack

*   **Frontend:**
    *   React 19
    *   TypeScript
    *   Tailwind CSS (for styling)
    *   `@ag-ui/client`: For communication with the backend AG-UI agent.
*   **AI (via Backend Agent):**
    *   The application itself does not directly call the Gemini API for chat. It communicates with a backend agent.
    *   The backend agent is responsible for interacting with AI models (e.g., Google Gemini) and executing tools.
*   **Development Environment (Assumed):**
    *   Node.js and a package manager (npm/yarn/pnpm) for development.
    *   A local development server (e.g., Vite, Parcel, or a simple static server).

## Project Structure

```
/
├── public/
│   └── (Static assets, though most are handled by index.html directly)
├── src/
│   ├── components/            # UI components (ChatPanel, SettingsPanel, etc.)
│   │   ├── common/            # Reusable common components (e.g., LoadingSpinner - though currently unused)
│   │   └── ...
│   ├── services/              # Client-side services (e.g. agentService.ts - placeholder)
│   ├── App.tsx                # Main application component, state management, routing
│   ├── index.tsx              # React entry point
│   ├── constants.tsx          # App-wide constants (icons, messages)
│   └── types.ts               # TypeScript type definitions
├── index.html                 # Main HTML file
├── metadata.json              # Application metadata for the environment
├── mcp.json                   # Example backend tool configuration (for user reference/backend setup)
├── FUTURE_FEATURES.md         # Document outlining potential future enhancements
└── README.md                  # This file
```

## Backend Agent Requirement

This application **requires** a separate backend AG-UI (Agent-User Interface) compatible agent to be running and accessible via the URL configured in the **Settings Panel**. The frontend communicates with this agent for all AI-powered chat functionalities and tool execution.

The backend agent is responsible for:
1.  Receiving user messages from the frontend.
2.  Interacting with an AI model (e.g., Google Gemini).
3.  Managing and exposing available tools (MCP Tools).
4.  Executing tool calls requested by the AI.
5.  Sending responses and events back to the frontend.

The `mcp.json` file in this repository serves as an *example* of how such tools might be defined for a backend agent. The frontend itself displays the tools that are dynamically reported by the connected agent.

## Setup and Running

This application is designed to run locally. It communicates with a backend AG-UI agent for its AI capabilities.

**Prerequisites:**

*   Node.js (which includes npm) installed on your system. You can download it from [https://nodejs.org/](https://nodejs.org/).
*   A running AG-UI compatible backend agent.

**Steps for Local Development:**

1.  **Clone the Repository:**
    ```bash
    git clone <repository_url> # Replace <repository_url> with the actual URL
    cd FrontendAgents/desktop-mcp-ingestor
    ```

2.  **Install Dependencies:**
    Navigate to the `desktop-mcp-ingestor` directory if you aren't already there. Then, install the project's dependencies using npm (or your preferred package manager like Yarn or PNPM):
    ```bash
    npm install
    # or
    # yarn install
    # or
    # pnpm install
    ```

3.  **Configure Backend Agent:**
    *   Ensure your AG-UI compatible backend agent is running.
    *   Once the frontend application is running (see next step), open it in your browser.
    *   Navigate to the **Settings Panel** (`Settings` in the UI).
    *   Enter the URL of your running backend agent in the **Backend Agent URL** field and save the settings.

4.  **Run the Development Server:**
    To start the Vite development server, run the following command:
    ```bash
    npm run dev
    # or
    # yarn dev
    # or
    pnpm dev
    ```
    This will typically start the application on `http://localhost:5173` (Vite's default) or another port if 5173 is in use. The console output will show the exact URL. Open this URL in your web browser.

5.  **Interact with the Application:**
    *   You can now use the application to ingest folders and chat with the AI (via the configured backend agent).

**Building and Previewing for Production:**

1.  **Build the Application:**
    To create an optimized production build, run:
    ```bash
    npm run build
    # or
    # yarn build
    # or
    pnpm build
    ```
    This will create a `dist` folder containing the static assets.

2.  **Preview the Production Build:**
    To locally serve and preview the production build from the `dist` folder, run:
    ```bash
    npm run preview
    # or
    # yarn preview
    # or
    pnpm preview
    ```
    This will start a local server, and the console output will show the URL to access the preview.

## Configuration

*   Application settings (theme, agent URL, ingest parameters) are managed via the **Settings Panel** and stored in the browser's `localStorage` in a file conceptually named `mcp_settings.json`.
*   The `mcp.json` file in the root is an *example* of a tool configuration format that a backend agent might use. The content of this file can be pasted into the "Backend Agent MCP Tool Configuration" section in the Settings Panel if your agent is designed to be configured this way.

## Future Enhancements

For a list of planned and potential future features, please see [FUTURE_FEATURES.md](./FUTURE_FEATURES.md).

---

## License

This project is licensed under the [Apache License 2.0](../LICENSE).
