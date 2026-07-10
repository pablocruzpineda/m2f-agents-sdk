# @mind2flow/cli

`m2f` — the Mind2Flow command-line interface. Build, manage and run AI agents
from your terminal.

```bash
npm install -g @mind2flow/cli

m2f login
m2f agents list
m2f agents run <agentId> --input "Hello!"
m2f tools push ./tool.py --description "What it does"
m2f tasks create --agent-id <id> --name daily --cron "0 8 * * *" --message "Go!"
m2f knowledge query "What changed in our prices this year?"
m2f mcp setup --mcp-key mcp_xxx        # wire Mind2Flow into Cursor
```

Configuration lives in `~/.m2f/config.json`; `M2F_API_KEY` / `M2F_BASE_URL`
environment variables override it.

Full docs: https://github.com/pablocruzpineda/m2f-agents-sdk
