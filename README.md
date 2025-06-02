# FrontendAgents Monorepo

This repository is a monorepo containing two related projects for AI agent and tool management:

- **AI Agent Lab** (`ai-agent-lab/`): A Progressive Web App (PWA) for managing, testing, and interacting with AI agents and Model Context Protocol (MCP) tools. Features a Gemini-powered AI assistant, agent and tool management, and PWA installability.
- **Desktop MCP Ingestor** (`desktop-mcp-ingestor/`): A local desktop application for ingesting folders, generating summaries, and enabling AI chat about local content via a backend AG-UI compatible agent.

---

## Projects Overview

### 1. AI Agent Lab
- **Type:** Progressive Web App (PWA)
- **Purpose:** Register, manage, and interact with AI agents and MCP servers/tools. Includes a Gemini-powered chat assistant and dynamic tool invocation.
- **Tech:** React 19, TypeScript, Tailwind CSS, Google Gemini API, Local Storage, PWA features.
- **Location:** [`ai-agent-lab/`](./ai-agent-lab/)
- **See:** [`ai-agent-lab/README.md`](./ai-agent-lab/README.md)

### 2. Desktop MCP Ingestor
- **Type:** Desktop Application (local web app)
- **Purpose:** Ingest local folders, summarize contents, and enable AI chat about ingested data. Integrates with backend AG-UI agents for tool execution.
- **Tech:** React 19, TypeScript, Tailwind CSS, AG-UI client, Local Storage.
- **Location:** [`desktop-mcp-ingestor/`](./desktop-mcp-ingestor/)
- **See:** [`desktop-mcp-ingestor/README.md`](./desktop-mcp-ingestor/README.md)

---

## Monorepo Structure

```
FrontendAgents/
├── ai-agent-lab/              # AI Agent Lab PWA
│   ├── src/
│   ├── public/
│   ├── ...
│   └── README.md
├── desktop-mcp-ingestor/      # Desktop MCP Ingestor app
│   ├── src/
│   ├── public/
│   ├── ...
│   └── README.md
├── .gitignore
├── README.md                  # (This file)
└── ...
```

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/FrontendAgents.git
cd FrontendAgents
```

### 2. Project Setup

Each project is self-contained. See the respective subproject's README for detailed setup and usage instructions:

- [AI Agent Lab Setup](./ai-agent-lab/README.md)
- [Desktop MCP Ingestor Setup](./desktop-mcp-ingestor/README.md)

### 3. Monorepo Management

- Each project manages its own dependencies and build scripts.
- You may use tools like [npm workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces) or [pnpm workspaces](https://pnpm.io/workspaces) for unified dependency management (optional, not required for basic usage).
- To contribute, make changes in the relevant subproject directory and submit a pull request.

---

## Contributing

1. Fork the repository and create a new branch for your feature or fix.
2. Make changes in the appropriate subproject directory.
3. Ensure your code is well-documented and tested.
4. Submit a pull request with a clear description of your changes.

---

## License

See individual subproject directories for license information.

---

## References
- [AI Agent Lab README](./ai-agent-lab/README.md)
- [Desktop MCP Ingestor README](./desktop-mcp-ingestor/README.md)
