# AI Agent Lab

**AI Agent Lab** is a sophisticated Progressive Web Application (PWA) designed for developers and AI enthusiasts to seamlessly manage, test, and enhance AI agents and their associated tools. It provides a centralized, user-friendly interface for interacting with agents conforming to the Agent-to-Agent (A2A) communication paradigm and tools accessible via the Model Context Protocol (MCP). The application features a Gemini-powered AI assistant, robust settings customization, and PWA capabilities for an enhanced user experience.

## Table of Contents

1.  [Overview](#overview)
2.  [Key Features](#key-features)
3.  [Tech Stack](#tech-stack)
4.  [File Structure](#file-structure)
5.  [Architectural Choices](#architectural-choices)
6.  [Getting Started](#getting-started)
    *   [Prerequisites](#prerequisites)
    *   [Installation & Running](#installation--running)
7.  [Core Functionalities](#core-functionalities)
    *   [Dashboard (`/`)](#dashboard--)
    *   [Agent Management (`/agents`)](#agent-management--agents)
    *   [MCP Server & Tool Management (`/tools`)](#mcp-server--tool-management--tools)
    *   [AI Assistant (`/assistant`)](#ai-assistant--assistant)
    *   [Settings (`/settings`)](#settings--settings)
8.  [PWA Features](#pwa-features)
9.  [Theming](#theming)
10. [Data Persistence](#data-persistence)
11. [Environment Variables](#environment-variables)
12. [License](#license)

## Overview

AI Agent Lab empowers users to:

*   **Register and Manage Agents**: Easily add agents via their `agent.json` manifest URL, toggle their status, refresh metadata, and view comprehensive details.
*   **Interact with MCP Servers & Tools**: Configure connections to MCP servers (both SSE and STDIO-like JSON configurations), discover their capabilities (tools, resources, prompts), and interact with them through dynamically generated forms or the AI Assistant.
*   **Leverage an AI Assistant**: Utilize a Gemini-powered chat interface for assistance, generating documentation, simulating agent runs, and controlling MCP tools with natural language or built-in commands.
*   **Customize the Experience**: Personalize the app with light, dark, or system-based themes, configure assistant behavior, manage default MCP client capabilities, and handle application data via import/export.
*   **Work Offline & Install**: As a PWA, it's installable for an app-like experience and offers basic offline functionality.

## Key Features

*   **Agent Management**:
    *   Register via `agent.json` URL.
    *   View details (name, description, version, author, capabilities, URL, status).
    *   Enable/Disable agents, refresh metadata, edit (limited), delete.
    *   Status indicators (online, offline, error, loading) and metadata viewer.
*   **MCP Server & Tool Management**:
    *   **SSE Server Registration**: Via dedicated modal (name, URL).
    *   **JSON Configuration**: Comprehensive JSON editor for all server types (especially STDIO-like), supporting commands, arguments, CWD, environment variables. Features AI-powered JSON formatting and validation.
    *   Connect/Disconnect from servers.
    *   Status indicators (connected, disconnected, connecting, error).
    *   Discover and list tools, resources, and prompts from connected servers.
    *   Dynamic parameter input forms based on item schemas for interaction.
    *   View results of tool calls, resource reads, or prompt executions.
*   **AI Assistant (Powered by Google Gemini API)**:
    *   Conversational interface with command support (e.g., `/help`, `/run`, `/list agents`, `/mcp list-servers`, `/mcp list-tools`, `/mcp call-tool`, `/clear`).
    *   Configurable Gemini model, temperature, system prompt, TopK/P, and thinking budget (for Flash model).
    *   Streaming responses for real-time interaction.
    *   **Integrated Tools Pane**: Quick access to call available tools from connected MCP servers directly within the chat.
*   **Settings & Customization**:
    *   **Themes**: Light, Dark, System preference.
    *   **PWA**: Installable on desktop and mobile.
    *   **Telemetry**: Opt-in for anonymized usage data and error reports.
    *   **MCP Client**: Configure default client capabilities (roots, sampling, logging level).
    *   **Data Management**: Export/Import all application data (settings, agents, MCP servers, chat history) as a JSON file.
*   **Modern UI/UX**:
    *   Responsive design built with React and Tailwind CSS.
    *   Intuitive, component-based architecture with consistent iconography.
    *   CSS variable-driven theming.

## Tech Stack

*   **Frontend**: React 19, TypeScript
*   **Styling**: Tailwind CSS (with CSS Variables for robust theming)
*   **Routing**: React Router v7
*   **AI Integration**: Google Gemini API (`@google/genai` SDK v1.3.0) via esm.sh
*   **State Management**:
    *   React Hooks (`useState`, `useEffect`, `useMemo`, `useRef`)
    *   Custom `useLocalStorage` hook for persistent state slices.
    *   Service layer (`localStorageService.ts`) for abstracting storage interactions.
*   **PWA Features**: Service Worker (`sw.js`), Web App Manifest (`manifest.json` via `metadata.json`)
*   **Module Loading**: ES Modules with Import Maps (via `index.html` and esm.sh CDN)
*   **Icons**: Heroicons (SVG components)

## File Structure

```
.
├── public/                     # Static assets served directly
│   ├── icons/                  # Application icons for PWA
│   │   ├── icon-192x192.png
│   │   ├── icon-512x512.png
│   │   ├── icon-maskable-192x192.png
│   │   └── icon-maskable-512x512.png
│   ├── index.html              # Main HTML entry point
│   ├── manifest.json           # Web App Manifest (dynamically served from metadata.json content)
│   └── sw.js                   # Service Worker for PWA caching
├── src/                        # Main application source code
│   ├── components/             # Reusable UI components
│   │   ├── icons/              # SVG icon components
│   │   │   ├── AgentIcon.tsx
│   │   │   ├── BookOpenIcon.tsx
│   │   │   ├── ChatIcon.tsx
│   │   │   ├── ChevronDoubleLeftIcon.tsx
│   │   │   ├── DownloadIcon.tsx
│   │   │   ├── EditIcon.tsx
│   │   │   ├── HomeIcon.tsx
│   │   │   ├── MoonIcon.tsx
│   │   │   ├── PanelLeftIcon.tsx
│   │   │   ├── PlayIcon.tsx
│   │   │   ├── PlusIcon.tsx
│   │   │   ├── RefreshIcon.tsx
│   │   │   ├── SendIcon.tsx
│   │   │   ├── SettingsIcon.tsx
│   │   │   ├── SpinnerIcon.tsx
│   │   │   ├── SunIcon.tsx
│   │   │   ├── ToolIcon.tsx
│   │   │   ├── TrashIcon.tsx
│   │   │   └── UploadIcon.tsx
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── ChatMessage.tsx
│   │   ├── ChatToolsPane.tsx
│   │   ├── Header.tsx
│   │   ├── Input.tsx
│   │   ├── Layout.tsx
│   │   ├── Modal.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Textarea.tsx
│   │   └── ToggleSwitch.tsx
│   ├── hooks/                  # Custom React Hooks
│   │   ├── useLocalStorage.ts
│   │   ├── usePWAInstall.ts
│   │   └── useTheme.ts
│   ├── pages/                  # Page-level components (routed views)
│   │   ├── AgentsPage.tsx
│   │   ├── AssistantPage.tsx
│   │   ├── HomePage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── ToolsPage.tsx
│   ├── services/               # Business logic, API interactions
│   │   ├── geminiService.ts    # Google Gemini API client
│   │   ├── localStorageService.ts # Abstraction for LocalStorage
│   │   ├── mcpClientService.ts # Mock MCP client logic
│   │   └── telemetryService.ts # Mock telemetry service
│   ├── utils/                  # Utility functions
│   │   └── fileUtils.ts        # File reading/downloading helpers
│   ├── App.tsx                 # Root React component, sets up routing
│   ├── constants.ts            # Application-wide constants
│   ├── index.tsx               # React application entry point
│   └── types.ts                # TypeScript type definitions
└── README.md                   # This file
```
*(Note: `metadata.json` is listed in the prompt, but typically named `manifest.json` when served for PWA. The `index.html` references `/manifest.json`)*

## Architectural Choices

*   **Progressive Web App (PWA)**: Enables installation, offline access (via `sw.js` caching core assets), and an app-like experience. `manifest.json` (from `metadata.json`) defines PWA properties.
*   **Component-Based Architecture**: Leverages React's component model for a modular, maintainable, and reusable UI. (`src/components/`)
*   **Functional Components & Hooks**: Adopts modern React practices using functional components and hooks (`useState`, `useEffect`, custom hooks in `src/hooks/`) for state and lifecycle management.
*   **Centralized State Slices via Local Storage**: Key application data (agents, MCP servers, settings, chat history) is persisted in the browser's Local Storage. The `useLocalStorage` hook and `localStorageService` provide a structured way to manage this.
*   **Service Layer**: Decouples external interactions and core logic from UI components.
    *   `geminiService.ts`: Handles all communication with the Google Gemini API.
    *   `mcpClientService.ts`: Manages connections and interactions with MCP servers (currently a mock implementation).
    *   `localStorageService.ts`: Provides an API for CRUD operations on data stored in Local Storage.
    *   `telemetryService.ts`: A mock service for logging events and errors (opt-in).
*   **Type Safety with TypeScript**: Enhances code quality and maintainability by providing static typing throughout the application (`*.ts`, `*.tsx`, `types.ts`).
*   **Styling with Tailwind CSS & CSS Variables**:
    *   **Tailwind CSS**: A utility-first CSS framework for rapid UI development (loaded via CDN).
    *   **CSS Variables**: Defined in `index.html` for theming (light/dark/system modes) and consistent styling. Component styles reference these variables (e.g., `bg-[var(--card-background)]`).
*   **Client-Side Routing**: `react-router-dom` (v7) for SPA navigation without page reloads.
*   **ES Modules & Import Maps**: Modern JavaScript modules are loaded directly from a CDN (esm.sh) using import maps defined in `index.html`, simplifying dependency management for this client-side application.
*   **Model Context Protocol (MCP) Focus**: The app is designed to be a client for MCP-compliant servers, allowing users to manage server configurations and interact with exposed tools, resources, and prompts.
*   **Google Gemini API Integration**: The AI Assistant and other AI-driven features (like documentation generation and JSON formatting help) are powered by the Gemini API, adhering to specific usage guidelines.

## Getting Started

### Prerequisites

1.  **Modern Web Browser**: Chrome, Edge, Firefox, Safari (latest versions recommended).
2.  **Google Gemini API Key**:
    *   A valid Google Gemini API key is **required** for the AI Assistant and other AI-powered features to function.
    *   This key **must** be available as an environment variable named `API_KEY` in the environment where the `index.html` file is served.
    *   Example: If serving locally with a simple HTTP server that supports environment variables, ensure `API_KEY` is set in your shell before starting the server.
    *   **Important**: Do not hardcode the API key into the application's source code. The application is designed to read it from `process.env.API_KEY`.

### Installation & Running

This project is designed to run directly in the browser using ES modules loaded from CDNs.

1.  **Clone the Repository (if applicable) or Obtain Files**: Ensure all files listed in the [File Structure](#file-structure) are present in their correct locations.
2.  **Set up the `API_KEY`**:
    *   Before serving the application, make sure the `API_KEY` environment variable is set and accessible to the context that will serve `index.html`. The `geminiService.ts` relies on `process.env.API_KEY`.
    *   If you are simply opening `index.html` directly in the browser (via `file:///` protocol), `process.env.API_KEY` will likely not be available, and Gemini features will fail. You need to serve the files through an HTTP server.
3.  **Serve `index.html`**:
    *   Use a simple local HTTP server. For example, using Python:
        ```bash
        # Navigate to the project's root directory (where index.html is)
        python -m http.server
        ```
        Or using Node.js with `serve`:
        ```bash
        # Install serve globally if you haven't: npm install -g serve
        serve .
        ```
    *   Ensure the server can pass environment variables or that `process.env.API_KEY` is somehow polyfilled/available in the JavaScript context it serves. (For simple local servers, this usually means the variable was set in the terminal session that started the server).
4.  **Access the App**: Open your browser and navigate to the local address provided by your HTTP server (e.g., `http://localhost:8000` or `http://localhost:3000`).

## Core Functionalities

### Dashboard (`/`)

*   **Welcome Message & Overview**.
*   **Quick Action Cards**: Navigate to Agents, Tools, or Assistant pages. Displays counts of registered agents and MCP servers.
*   **PWA Installation Prompt**: If the app is not installed and the browser supports it.

### Agent Management (`/agents`)

*   **Register Agents**: Add new agents by providing the URL to their `agent.json` manifest.
*   **View Agents**: Displayed in a card layout with details: name, URL, description, version, author, status (online, offline, error, loading), last refreshed time.
*   **Interact**:
    *   Toggle agent `isEnabled` status.
    *   Manually `Refresh` agent data (re-fetches `agent.json`).
    *   `Edit` agent details (URL, and overrides for name/description if manually set).
    *   `Delete` agents.
    *   View full `metadata` (the content of `agent.json`).
*   **Automatic Refresh (Basic)**: Periodically checks enabled agents (currently placeholder logging, manual refresh is primary).

### MCP Server & Tool Management (`/tools`)

*   **Register MCP Servers**:
    *   **SSE Servers**: Added via a dedicated modal (name, URL, client capabilities).
    *   **JSON Configuration**: A powerful modal allows managing multiple server configurations (including STDIO-like and SSE) via a JSON editor.
        *   Supports fields like `command`, `args`, `cwd`, `env` for STDIO-like servers.
        *   Features an "Format & Validate with AI" button using Gemini to help structure and correct the JSON.
*   **Server Interaction**:
    *   Connect/Disconnect from servers.
    *   Status indicators (connected, disconnected, error, connecting).
    *   View error messages if connection fails.
*   **View Server Details (for connected servers)**:
    *   A modal displays discovered **Tools**, **Resources**, and **Prompts**, each in its own tab.
    *   Shows server-reported **Capabilities**.
*   **Interact with MCP Items**:
    *   For each tool, resource, or prompt, a "Call", "Read", or "Execute" button opens a modal.
    *   This modal dynamically generates an input form based on the item's `inputSchema` or `paramsSchema`. Supports boolean toggles, text/number inputs.
    *   Allows submitting parameters as raw JSON if preferred or if no schema is available.
    *   Displays the result or error from the interaction in a subsequent modal.

### AI Assistant (`/assistant`)

*   **Chat Interface**: Full-fledged chat UI for interacting with the Gemini model.
*   **Commands**:
    *   `/help [item_name]`: Generates documentation for a registered agent using Gemini.
    *   `/run <agent_name> [input...]`: Simulates running an agent by querying Gemini.
    *   `/list agents`: Lists all registered agents and their status.
    *   `/mcp list-servers`: Lists registered MCP servers and their connection status.
    *   `/mcp list-tools <server_name_alias>`: Lists tools for a *connected* MCP server.
    *   `/mcp call-tool <server_name_alias> <tool_name> [JSON_params]`: Calls a specific tool on a connected MCP server.
    *   `/clear`: Clears the chat history.
*   **AI Configuration**: Assistant behavior (model, temperature, system prompt, TopK/P, thinking budget) is configurable in Settings and applies to new chat sessions.
*   **Streaming Responses**: AI responses are streamed token by token for a more interactive experience.
*   **Tools Pane**:
    *   A collapsible side panel lists available tools from all currently connected MCP servers.
    *   Clicking a tool pre-fills the `/mcp call-tool` command in the chat input.
*   **Error Handling**: Displays system messages for errors like failed chat initialization.

### Settings (`/settings`)

Organized into tabs for clarity:

*   **General**:
    *   **Appearance**: Select theme (Light, Dark, System).
    *   **PWA Settings**: Install app button if applicable.
    *   **Privacy**: Toggle telemetry data collection.
    *   **Integrations**: Placeholder for future service integrations.
*   **AI Assistant**:
    *   Configure `assistantModel` (e.g., `gemini-2.5-flash-preview-04-17`).
    *   Adjust `assistantTemperature`.
    *   Customize `assistantSystemPrompt` (with a reset to default option).
    *   Set `assistantTopK` and `assistantTopP` (optional).
    *   Toggle `assistantEnableThinking` (for compatible models like Flash).
*   **MCP Client**:
    *   Set default client capabilities (`roots`, `sampling`, `loggingLevel`) requested when connecting to MCP servers.
*   **Data Management**:
    *   **Export Configuration**: Download all app data (settings, agents, MCP servers, chat history) as a single JSON file.
    *   **Import Configuration**: Upload a previously exported JSON file to restore application state.

## PWA Features

*   **Installability**: Users can install AI Agent Lab to their desktop or mobile device for an app-like experience via the "Install App" button (if available) or browser's install PWA option.
*   **Offline Caching**: The Service Worker (`sw.js`) caches core application assets (`index.html`, `manifest.json`, potentially JS/CSS bundles if configured explicitly). This allows the app shell to load offline. Dynamic data (agent manifests, MCP interactions, AI responses) still requires network connectivity.

## Theming

*   Supports **Light**, **Dark**, and **System** (adapts to OS preference) themes.
*   Implemented using CSS variables defined in `index.html` and toggled by adding/removing a `.dark` class on the `<html>` element via the `useTheme` hook.
*   Provides a consistent look and feel across the application.

## Data Persistence

*   All user-specific data is stored in the browser's **Local Storage**. This includes:
    *   Registered Agents (`LOCAL_STORAGE_KEYS.AGENTS`)
    *   MCP Server Configurations (`LOCAL_STORAGE_KEYS.MCP_SERVERS`)
    *   Application Settings (`LOCAL_STORAGE_KEYS.SETTINGS`)
    *   AI Assistant Chat History (`LOCAL_STORAGE_KEYS.CHAT_HISTORY`)
*   This data persists across browser sessions.
*   The "Data Management" section in Settings allows users to export this data for backup and import it to restore or transfer configurations.

## Environment Variables

*   **`API_KEY` (Required)**: Your Google Gemini API key. This **must** be set as an environment variable in the context where the application's `index.html` is served. The application accesses it via `process.env.API_KEY`.

---

## License

This project is licensed under the [Apache License 2.0](../LICENSE).
