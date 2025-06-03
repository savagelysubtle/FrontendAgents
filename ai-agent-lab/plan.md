# Refactoring Plan: AI Agent Lab Enhancement

**Project:** AI Agent Lab
**Goal:** Improve UI/UX consistency, user experience for theme management, and clarity of chat messages by adopting refined patterns.

**Instructions for AI App Builder:**
You will be refactoring the `ai-agent-lab` application based on the steps outlined below. For each step, I will provide specific objectives, descriptions of changes, key files to modify, and detailed prompts. Please apply these changes incrementally. If a prompt asks you to modify an existing file, clearly indicate the changes (e.g., using diff format or by showing the new relevant sections). Your focus is solely on the `ai-agent-lab` codebase and the instructions within this plan.

---

## Phase 1: UI/UX Refinements

### Step 1.1: Enhance Theme Toggle Logic

*   **Objective:** Provide a more intuitive and potentially direct theme toggling experience, addressing user feedback about the current cycle (light -> dark -> system -> light).
*   **Description of Changes:**
    *   Modify the `useTheme` hook to support an optional, more direct light/dark toggle behavior, while still allowing 'system' to be set via settings.
    *   Update the `Header.tsx` component to utilize this enhanced theme toggle.
*   **Key Files to Modify:**
    *   `ai-agent-lab/hooks/useTheme.ts`
    *   `ai-agent-lab/components/Header.tsx`
    *   `ai-agent-lab/pages/SettingsPage.tsx` (potentially, to offer a choice in toggle behavior)
*   **Prompts for AI App Builder:**

    **Prompt 1.1.1 (Modify `useTheme.ts`):**
    ```
    Modify `ai-agent-lab/hooks/useTheme.ts`.
    The goal is to make the theme toggle in the header more direct (Light <-> Dark) while still allowing 'System' to be the underlying preference set in settings.
    1.  The `useTheme` hook currently returns `[currentTheme, setTheme]`. The `setTheme` function directly sets the theme preference ('light', 'dark', 'system') in localStorage. This part is fine.
    2.  The `useEffect` that applies the theme based on `currentTheme` (and system preference if `currentTheme === 'system'`) is also largely correct.
    3.  The change is primarily conceptual for how the *header toggle button* interacts with `setTheme`. We want the header button to feel like a direct Light/Dark switch.
        *   When the user clicks the toggle in the header:
            *   If the *current effective theme* (considering 'system' preference) is light, the toggle should switch the *preference* to 'dark'.
            *   If the *current effective theme* is dark, the toggle should switch the *preference* to 'light'.
        *   The 'system' theme preference itself would primarily be set via the Settings page. The header toggle will override 'system' to an explicit 'light' or 'dark'.
    4.  No direct code changes might be needed in `useTheme.ts` itself for this specific toggle behavior, as the logic for applying the theme based on the stored preference is already there. The main change will be in `Header.tsx` determining what theme to set *next* when the button is clicked. However, ensure `useTheme` correctly exposes the *effective* current theme (e.g., if settings.theme is 'system' and OS is dark, it should effectively be 'dark').

    Review the existing `useTheme.ts` and confirm if any adjustments are needed to clearly distinguish between the *stored preference* ('light', 'dark', 'system') and the *currently applied visual theme* (which resolves 'system' to 'light' or 'dark'). If `useTheme` already correctly handles applying the theme based on the stored preference, no changes might be needed here, and the logic will be in `Header.tsx`.
    ```

    **Prompt 1.1.2 (Modify `Header.tsx` for Theme Toggle):**
    ```
    Modify `ai-agent-lab/components/Header.tsx`.
    1.  The `toggleTheme` function needs to be updated.
    2.  When the theme toggle button is clicked:
        *   Determine the *current effective visual theme*. If `theme` (from `useTheme()`) is 'system', check `window.matchMedia('(prefers-color-scheme: dark)').matches` to know if it's effectively light or dark.
        *   If the current effective visual theme is light, call `setTheme('dark')`.
        *   If the current effective visual theme is dark, call `setTheme('light')`.
    3.  The `getThemeIcon` function should change to show the icon for the *opposite* of the current effective visual theme (e.g., if effectively light, show MoonIcon to switch to dark).
    4.  The `getThemeTooltip` function should change to reflect this direct toggle: "Switch to Dark Theme" or "Switch to Light Theme".
    5.  The option to set the theme to 'system' will remain in `SettingsPage.tsx`. The header toggle will now be a direct override to 'light' or 'dark'. This change is for `ai-agent-lab`.
    ```

    **Prompt 1.1.3 (Review `SettingsPage.tsx` for Theme Options):**
    ```
    Review `ai-agent-lab/pages/SettingsPage.tsx`.
    1.  Ensure the "Appearance" section still allows the user to select 'Light', 'Dark', or 'System' as their theme preference. This preference is what `useTheme` stores.
    2.  The header toggle (modified in the previous step) will now act as a direct switch between light and dark, effectively overriding the 'system' preference with an explicit choice until 'system' is re-selected in settings.
    3.  No major changes are expected here unless the current implementation prevents the header toggle from working as described. The core functionality of selecting 'light', 'dark', or 'system' in settings must remain.
    ```
*   **Verification:**
    *   The theme toggle button in the header now directly switches between light and dark modes.
    *   The icon and tooltip on the toggle button correctly reflect the action (e.g., shows moon when light, sun when dark).
    *   Users can still select 'Light', 'Dark', or 'System' as their base preference in the Settings page. If 'System' is chosen, the header toggle will switch it to 'Light' or 'Dark'.

---

### Step 1.2: Improve Chat Message Styling for System Messages

*   **Objective:** Make system messages in the chat interface more visually distinct from user and assistant messages.
*   **Description of Changes:**
    *   Modify `ChatMessage.tsx` to apply unique styling to messages where `message.sender === MessageSender.SYSTEM`.
*   **Key Files to Modify:**
    *   `ai-agent-lab/components/ChatMessage.tsx`
*   **Prompt for AI App Builder:**
    ```
    Modify `ai-agent-lab/components/ChatMessage.tsx`.
    1.  Currently, system messages are handled by this block:
        if (isSystem) {
          return (
            <div className="my-2 text-center">
              <span className="px-2 py-1 bg-gray-200 dark:bg-zinc-800 text-xs text-[var(--text-subtle)] rounded-full">
                {message.text}
              </span>
            </div>
          );
        }
    2.  Enhance the styling for these system messages to make them more distinct. Consider the following changes:
        *   **Background:** Use a slightly different shade or a very subtle pattern/border to differentiate from the main chat background. For example, a lighter gray or a very soft accent color.
        *   **Text Styling:** Perhaps use italics or a slightly different font weight if appropriate, while maintaining readability. The current `text-xs text-[var(--text-subtle)]` is good.
        *   **Layout:** The current centered layout with a rounded-full span is good for short system messages. Ensure it still looks good for potentially longer system messages (e.g., error messages or multi-line status updates). If messages can be longer, the `rounded-full` span might need to become a `rounded-lg` div that spans more width, but still centered.
        *   **Example for a slightly more prominent system message style (adapt as needed):**
            <div className="my-3 py-2 px-3 text-center">
              <div className="inline-block bg-[var(--page-background)] dark:bg-zinc-800/50 border border-[var(--border-secondary)] rounded-lg px-3 py-1.5 shadow-sm">
                <p className="text-xs text-[var(--text-subtle)] italic">{message.text}</p>
              </div>
            </div>
    3.  Ensure these changes are applied only when `message.sender === MessageSender.SYSTEM`. The styling for user and assistant messages should remain as is. This is for the `ai-agent-lab` application.
    ```
*   **Verification:**
    *   System messages in the chat (e.g., "Chat history cleared by user.", "Error: Could not initialize AI Assistant chat session.") have a clearly distinct visual appearance compared to user and assistant messages.
    *   The new styling is theme-aware (adapts to light/dark mode using CSS variables).

---

## Phase 2: Service Layer Enhancements for Agent Communication

*(This phase focuses on future-proofing the service layer. Ensure Phase 1 for `ai-agent-lab` is complete.)*

### Step 2.1: Refactor `mcpClientService.ts` for Extensibility

*   **Objective:** Modify the mock `mcpClientService.ts` to be more easily adaptable for potentially supporting different types of agent/server communication protocols in the future, beyond the current hardcoded mock MCP logic.
*   **Description of Changes:**
    *   Introduce more abstract interfaces or patterns within `mcpClientService.ts` that could allow different "client implementations" (e.g., one for mock MCP, another for a real MCP, another for AG-UI if ever needed) to be plugged in.
    *   This is primarily a structural refactor of the service's internals. The external API it exposes to `ToolsPage.tsx` should remain largely the same for now to minimize disruption.
*   **Key Files to Modify:**
    *   `ai-agent-lab/services/mcpClientService.ts`
*   **Prompts for AI App Builder:**

    **Prompt 2.1.1 (Refactor `mcpClientService.ts` Internals):**
    ```
    Modify `ai-agent-lab/services/mcpClientService.ts`. The goal is to make its internal structure more adaptable for different communication backends in the future, while keeping its current external API (methods like `connect`, `disconnect`, `callTool`, etc.) mostly unchanged for now.

    1.  **Define a Client Interface (Conceptual):**
        Think about what a generic "AgentConnection" or "ServerClient" interface might look like. It would have methods like:
        *   `initialize(config: any): Promise<{ serverCapabilities: Record<string, any> }>`
        *   `listTools(): Promise<McpTool[]>`
        *   `callTool(toolName: string, params: any): Promise<any>`
        *   `listResources(): Promise<McpResource[]>`
        *   `readResource(resourceName: string, params: any): Promise<any>`
        *   `listPrompts(): Promise<McpPrompt[]>`
        *   `executePrompt(promptName: string, params: any): Promise<any>`
        *   `close(): Promise<void>`
        *   `getIsConnected(): boolean`

    2.  **Refactor `MockMcpClient`:**
        *   Ensure the existing `MockMcpClient` class implicitly or explicitly implements such an interface. No major changes to its mock logic are needed, just conceptual alignment.

    3.  **Modify `activeClients` Store:**
        *   Currently, `activeClients` stores `MockMcpClient` instances. Modify it to store instances conforming to your conceptual client interface (e.g., `Map<string, IAgentConnection>`). For now, it will still only store `MockMcpClient` instances, but the typing prepares for future flexibility.

    4.  **Update Service Methods:**
        *   The main service methods (`mcpClientService.connect`, `.callTool`, etc.) currently create and use `MockMcpClient` directly.
        *   When `mcpClientService.connect` is called, it should still instantiate `MockMcpClient` (as it's the only implementation for now).
        *   The other methods (`callTool`, `listTools`, etc.) should retrieve the client instance from `activeClients` and call the corresponding methods on that instance. This part is likely already happening.

    5.  **No Change to External API:** The functions exported by `mcpClientService` that are used by `ToolsPage.tsx` should retain their existing signatures as much as possible to avoid breaking the UI components. This is primarily an *internal structural refactoring* of the service to make it easier to add, for example, a `RealMcpOverStdioClient` or `AgUiClientWrapper` in the future without rewriting the entire service.

    This refactoring is for `ai-agent-lab`. Focus on the internal structure and type definitions within `mcpClientService.ts` to promote extensibility. Show the modified `mcpClientService.ts`.
    ```
*   **Verification:**
    *   The `ai-agent-lab` application continues to function as before with the mock MCP tools.
    *   The internal structure of `mcpClientService.ts` is more modular, with a clear separation of the client implementation (currently `MockMcpClient`) and the service logic that manages these clients.
    *   Type definitions (like a client interface) are introduced to guide future extensions.

---

This plan provides a detailed roadmap for `ai-agent-lab`. Remember to test thoroughly after each step.