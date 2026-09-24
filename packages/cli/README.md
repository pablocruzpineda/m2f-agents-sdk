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

# Analyse your agents (new in 0.3.0)
m2f agents summary <agentId> --bucket week          # exact figures, from the database
m2f agents search <agentId> "drill,paint"           # customers' messages by default
m2f agents conversations <agentId> --full           # whole threads
m2f agents analyze <agentId> "Did it end in a sale?" --field outcome:"bought, quoted or only asked"
m2f agents integrations <agentId>                   # connected apps, and whether they work
m2f agents channels <agentId>                       # WhatsApp checked live, endpoint, shared link
m2f org summary --bucket month                      # TENANT/ADMIN only

# New in 0.4.0
m2f agents actions <agentId>                         # what its apps actually answered
m2f agents test <agentId> --cases cases.json --email me@x.com --wait   # runs FOR REAL
m2f artifacts report <agentId> --from 2026-08-01 --to 2026-08-31      # operation report
m2f artifacts list
m2f artifacts share <id>                             # public link, customers hidden

# New in 0.5.0 — phone calls (Twilio set up once in the console)
m2f voice lines                                      # agents that answer calls
m2f voice call <agentId> +525512345678 --var nombre=Ana --wait
m2f voice calls <agentId>                            # outcome, credits, summary
m2f voice set <agentId> --voice Cristina --greeting "Hola, gracias por llamar."
m2f voice pause <agentId>                            # and resume
```

`analyze`, `artifacts report` and `agents test` run an LLM on your own key and cost tokens; `agents test` also runs the agent's connected apps for real. `voice call` places a real phone call (credits + Twilio minutes). The others only read.

Configuration lives in `~/.m2f/config.json`; `M2F_API_KEY` / `M2F_BASE_URL`
environment variables override it.

**Prerequisites** (one-time, in the [dashboard](https://app.mind2flow.io)): create a
REST API key (Developers → API) and add your LLM provider key (Profile → API &
Model Configuration — the knowledge graph needs an OpenAI key). API usage
deducts platform credits per request (`m2f credits` shows the balance); LLM
usage bills to your own key (BYOK).

Full docs: https://github.com/pablocruzpineda/m2f-agents-sdk
