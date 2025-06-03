# FrontendAgents Monorepo

This repository is a monorepo containing projects related to AI agent interactions, tool management, and specialized AI-powered applications. It is maintained by Steve ([@savagelysubtle](https://github.com/savagelysubtle)).

---

## Projects Overview

### 1. AI Agent Lab
- **Type:** Progressive Web App (PWA)
- **Purpose:** A comprehensive platform for managing, testing, and interacting with AI agents and Model Context Protocol (MCP) tools. Features include agent registration (via `agent.json`), MCP server management (SSE and JSON configurations), a Gemini-powered AI assistant for control and interaction, and dynamic tool invocation.
- **Tech Highlights:** React 19, TypeScript, Tailwind CSS, Google Gemini API (`@google/genai`), Local Storage for state persistence, PWA features (Service Worker, Web App Manifest), ES Modules with Import Maps.
- **Location:** [`ai-agent-lab/`](./ai-agent-lab/)
- **Detailed Info:** See [`ai-agent-lab/README.md`](./ai-agent-lab/README.md)

### 2. Desktop MCP Ingestor
- **Type:** Desktop Application (local web app)
- **Purpose:** Enables users to ingest local folders, generate textual summaries (including file tree and metadata), and engage in AI-powered chat about the ingested content. Integrates with a backend AG-UI (Agent-User Interface) compatible agent for tool execution and advanced AI capabilities.
- **Tech Highlights:** React 19, TypeScript, Tailwind CSS, `@ag-ui/client` for backend agent communication, Local Storage. Connects to an external backend agent, which is responsible for AI model interaction (e.g., Google Gemini) and tool execution.
- **Location:** [`desktop-mcp-ingestor/`](./desktop-mcp-ingestor/)
- **Detailed Info:** See [`desktop-mcp-ingestor/README.md`](./desktop-mcp-ingestor/README.md)

### 3. AI Legal Evidence Organizer
- **Type:** Desktop Application (local web app)
- **Purpose:** Assists legal self-representatives, advocates, and lawyers in organizing, tagging, analyzing, and understanding legal evidence and related case law. Leverages AI (Google Gemini) for evidence summarization, policy extraction from documents, and an intelligent chat agent for contextual inquiries.
- **Tech Highlights:** React, TypeScript, Tailwind CSS, Google Gemini API (`@google/genai`). Designed to interact with a conceptual local MCP (My Computer's Processor) Server for all evidence file operations via an `McpClient` and `mcp.json` configuration, while application metadata (tags, summaries, etc.) is persisted in the browser's `localStorage`.
- **Location:** [`ai-legal-evidence-organizer/`](./ai-legal-evidence-organizer/)
- **Detailed Info:** See [`ai-legal-evidence-organizer/README.md`](./ai-legal-evidence-organizer/README.md)

---

## Monorepo Structure

```
FrontendAgents/
├── ai-agent-lab/              # AI Agent Lab PWA
│   ├── public/                 # Static assets (icons, manifest.json via metadata.json)
│   ├── src/                    # React components, services, hooks, pages
│   ├── index.html              # Main HTML entry point
│   ├── ...                     # Other PWA and project files
│   └── README.md
├── ai-legal-evidence-organizer/ # AI Legal Evidence Organizer
│   ├── public/                 # Static assets (index.html, mcp.json example)
│   ├── src/                    # React components, contexts, services
│   ├── index.html              # Main HTML entry point
│   ├── ...                     # Configuration, other project files
│   └── README.md
├── desktop-mcp-ingestor/      # Desktop MCP Ingestor app
│   ├── public/                 # Static assets
│   ├── src/                    # React components, services
│   ├── index.html              # Main HTML entry point
│   ├── ...                     # Vite config, other project files
│   └── README.md
├── .gitignore
├── LICENSE                    # Main license for the monorepo (if applicable)
├── package-lock.json          # (Or other lockfile if using a package manager at root)
├── README.md                  # (This file)
└── ...                        # Other monorepo configuration files (e.g., workspace configs)
```

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/savagelysubtle/FrontendAgents.git
cd FrontendAgents
```
*(Replace with the correct repository URL if different)*

### 2. Project Setup

Each project within this monorepo is self-contained and has its own specific setup instructions, dependencies, and environment requirements (like API keys). Please refer to the respective subproject's `README.md` for detailed guidance:

- **AI Agent Lab**: [Setup Instructions](./ai-agent-lab/README.md#getting-started)
- **Desktop MCP Ingestor**: [Setup Instructions](./desktop-mcp-ingestor/README.md#setup-and-running)
- **AI Legal Evidence Organizer**: [Setup Instructions](./ai-legal-evidence-organizer/README.md#setup--running)

---

## Monorepo Management

-   **Independence**: Each project currently manages its own dependencies (e.g., via `package.json` within its directory) and build scripts.
-   **Unified Management (Optional)**: For more streamlined management of dependencies and running scripts across all projects, you might consider tools like:
    *   [npm Workspaces](https://docs.npmjs.com/cli/using-npm/workspaces)
    *   [pnpm Workspaces](https://pnpm.io/workspaces)
    *   [Lerna](https://lerna.js.org/)
    *   [Nx](https://nx.dev/)
    This is optional and not required for basic usage if projects are developed and built independently.
-   **Contributions**: When contributing, ensure changes are made in the relevant subproject directory or at the root for monorepo-level configurations.

---

## Contributing

We welcome contributions! Please follow these general steps:

1.  **Fork** the repository on GitHub.
2.  **Create a branch** for your feature, bug fix, or enhancement from the `main` or `develop` branch (e.g., `git checkout -b feature/your-awesome-feature` or `fix/address-issue-123`).
3.  **Make your changes** in the appropriate subproject directory or at the root level for monorepo-wide concerns.
4.  **Commit your changes** with clear, descriptive messages (e.g., `git commit -m 'feat(ai-agent-lab): Add new tool interaction widget'`). Consider conventional commit messages.
5.  **Push your branch** to your fork on GitHub (e.g., `git push origin feature/your-awesome-feature`).
6.  **Open a Pull Request** (PR) to the original repository, detailing the changes you've made and why.
7.  Ensure your code is **well-documented**, includes **type hints** (for TypeScript projects), and, where applicable, is covered by **tests**.
8.  Ensure your code is formatted using the project's formatter (e.g., `ruff`) and passes type checks (e.g., `ty`).

---

## License

License information is typically found within each individual subproject directory (e.g., a `LICENSE` file or noted in their `README.md`). Please refer to these for specifics. If a top-level `LICENSE` file exists in this root directory, it would generally govern files at this root level and potentially provide a default for subprojects unless overridden.

*(The `LICENSE` file in the root of the provided file structure suggests an Apache License 2.0 for the `desktop-mcp-ingestor` and `ai-agent-lab`. Please ensure this is consistent or update as needed.)*

---

## References

For more detailed information on each project, please see their individual README files:

-   [AI Agent Lab README](./ai-agent-lab/README.md)
-   [Desktop MCP Ingestor README](./desktop-mcp-ingestor/README.md)
-   [AI Legal Evidence Organizer README](./ai-legal-evidence-organizer/README.md)
