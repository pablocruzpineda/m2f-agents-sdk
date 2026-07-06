# MCP server — use your agents from Cursor & Claude

Mind2Flow also exposes an **MCP (Model Context Protocol) server** with 80
tools covering agents, crews, devices, custom tools, tenant management,
scheduled tasks and project management. This lets AI coding assistants
(Cursor, Claude Code, Claude Desktop, Lovable, …) operate your Mind2Flow
account directly.

## Keys

MCP uses its own key type — `mcp_...`, created in the dashboard under
**Developers → MCP Keys**. It is separate from the `rest_` key used by the
SDK/CLI, with the same scope model.

## Setup with the CLI

Cursor:

```bash
m2f mcp setup --mcp-key mcp_xxx --url https://your-mcp-host/mcp
```

This writes the server into `~/.cursor/mcp.json`. Restart Cursor afterwards.

Claude Code — print the exact command to run:

```bash
m2f mcp claude-command --mcp-key mcp_xxx --url https://your-mcp-host/mcp
# outputs:
# claude mcp add --transport sse mind2flow https://your-mcp-host/mcp --header "Authorization: Bearer mcp_xxx"
```

For self-hosted stacks the default URL is `http://localhost:3003/mcp`.

## Manual configuration

Any MCP client that supports SSE transport works:

```json
{
  "mcpServers": {
    "mind2flow": {
      "url": "https://your-mcp-host/mcp",
      "headers": { "Authorization": "Bearer mcp_xxx" }
    }
  }
}
```

## Tool categories

| Category | Tools | Scopes |
| --- | --- | --- |
| AI Agents | 17 | `agents:*` |
| Agent Scheduled Tasks | 5 | `agents:*` |
| Devices | 9 | `devices:*` |
| Tenant Management | 12 | `tenant:*` |
| Tool Creation | 8 | `tools:*` |
| Crews | 10 | `crews:*` |
| Project Management | 19 | — |

The authoritative list is whatever `tools/list` returns from your server.
