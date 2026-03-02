# Bit Office

A pixel-art office where you hire AI agents, assign them projects, and watch them actually work.
Leaders delegate, teammates debate, code gets written — all while you supervise like a tiny AI startup CEO.

<video src="https://github.com/user-attachments/assets/a13ac1a0-8440-49f1-ab1e-110a35847d0c" controls width="100%"></video>

## Quick Start

### Use via npx (easiest)

```bash
npx bit-office
```

Opens a browser UI, auto-detects installed AI CLIs, generates a pair code for your phone.

### Run from source (3 steps)

```bash
# 1. Install — checks deps, installs packages, copies .env templates
git clone https://github.com/anthropics/bit-office.git && cd bit-office
pnpm bootstrap

# 2. Configure — set your project workspace path
#    Edit apps/gateway/.env → WORKSPACE=/path/to/your/project

# 3. Start — launches web UI + gateway in one command
pnpm start:local
```

## Features

- **Pixel Office UI** — PixiJS-rendered 2D office, each AI agent is a pixel character with idle/working/approval animations
- **Multi-Agent Orchestration** — Team lead delegates tasks to workers, collects results, retries on failure, escalates when stuck
- **Multi-Channel** — WebSocket (LAN), Ably (remote), Telegram (bot per agent)
- **Mix & Match Models** — Each agent can run a different AI CLI (Claude Code, Codex, Gemini, Aider, OpenCode). Let Codex lead and review, Claude code, Gemini test — they collaborate on the same project
- **Mobile PWA** — Install on phone, pair with a 6-digit code, control agents anywhere
- **Approval Bubbles** — Risky commands (git push, rm -rf, npm install) trigger Yes/No approval on your phone
- **External CLI Monitor** — Auto-detects AI CLI processes (Claude Code, Codex, etc.) already running on your machine, streams their live conversation into the office UI so you can watch and approve from anywhere
- **Office Editor** — Drag-and-drop furniture, paint floors/walls, customize your virtual office

## Run from Source

### Prerequisites

- Node.js 18+
- pnpm
- At least one AI CLI installed: `claude`, `codex`, `gemini`, `aider`, or `opencode`

### Assets

The pixel office tileset is not included due to license. Purchase it from [donarg.itch.io/officetileset](https://donarg.itch.io/officetileset), then place the downloaded folder at `apps/web/public/Office Tileset` and restart.

### Setup

```bash
git clone https://github.com/anthropics/bit-office.git
cd bit-office
pnpm bootstrap   # checks deps, installs packages, copies .env templates
# Edit apps/gateway/.env — set WORKSPACE to your target project directory
```

### Development

```bash
# Start both web + gateway
pnpm dev

# Or separately
pnpm dev:web       # Next.js on :3000
pnpm dev:gateway   # Gateway on :9090
```

### Environment Variables

```bash
# Required for dev (defaults to .workspace/ dir if unset)
WORKSPACE=/path/to/your/project

# Optional: enable remote access via Ably
ABLY_API_KEY=your-ably-key

# Optional: Telegram bots (position maps to agent preset)
TELEGRAM_BOT_TOKENS=token_alex,token_mia,,token_sophie,,token_marcus
```

### Build & Publish

```bash
pnpm build:release    # Build web + gateway
pnpm publish:release  # Publish to npm
```

## Architecture

```
Phone (PWA)                          Mac (Daemon)
┌─────────────┐    WebSocket/Ably    ┌──────────────────────────┐
│  Next.js 15 │ ◄─────────────────► │  Gateway                 │
│  PixiJS v8  │    pair code auth    │  ├─ Orchestrator         │
│  Zustand    │                      │  │  ├─ Agent Sessions    │
│  PWA        │   commands ──────►   │  │  ├─ Delegation Router │
│             │   ◄────── events     │  │  ├─ Retry Tracker     │
└─────────────┘                      │  │  └─ Prompt Engine     │
                                     │  ├─ Channels             │
                                     │  │  ├─ WebSocket (LAN)   │
                                     │  │  ├─ Ably (Remote)     │
                                     │  │  └─ Telegram (Bots)   │
                                     │  └─ Policy Engine        │
                                     └──────────┬───────────────┘
                                                │ spawn
                                     ┌──────────▼───────────────┐
                                     │  AI CLI Processes         │
                                     │  claude / codex / gemini  │
                                     └──────────────────────────┘
```

### Project Structure

```
apps/
  web/           Next.js 15 PWA — pixel office UI, pairing, agent control
  gateway/       Node.js daemon — channels, orchestration, AI process management

packages/
  shared/        Zod schemas — type-safe command/event protocol
  orchestrator/  Multi-agent engine — delegation, retry, prompt templates
```

### Event Flow

The UI only renders 4 key events to keep things simple:

| Event | Agent State | UI |
|-------|-------------|-----|
| `TASK_STARTED` | working | Character animates |
| `APPROVAL_NEEDED` | waiting_approval | Speech bubble (Yes/No) |
| `TASK_DONE` | done | Summary popup |
| `TASK_FAILED` | error | Error indicator |

### Team Collaboration Phases

When you hire a team, the leader follows a structured lifecycle instead of jumping straight to coding:

```
CREATE ──► DESIGN ──► EXECUTE ──► COMPLETE ──┐
  ▲                                          │
  └──────── End Project ◄────────────────────┘
                          (or feedback → EXECUTE)
```

| Phase | What happens | User can chat? | Key UI |
|-------|-------------|----------------|--------|
| **CREATE** | Leader asks what you want to build | Yes | Normal chat input |
| **DESIGN** | Leader outputs a `[PLAN]...[/PLAN]` | Yes (feedback) | **Approve Plan** button |
| **EXECUTE** | Leader delegates to workers (see below) | No (Cancel only) | Working indicator |
| **COMPLETE** | Delivery card with files + Preview button | Yes (feedback) | **End Project** button |

- **CREATE → DESIGN**: Automatic when leader outputs a `[PLAN]` block
- **DESIGN → EXECUTE**: User clicks "Approve Plan" → system creates a unique project directory
- **EXECUTE → COMPLETE**: All workers finish, leader summarizes with preview info
- **COMPLETE → EXECUTE**: User sends feedback (change requests)
- **COMPLETE → CREATE**: User clicks "End Project" (fresh cycle)

### Execute Phase — Build → Review → Fix Loop

```
Leader assigns Developer(s)
  └─ Dev codes, builds, fixes build errors, reports with preview info
       └─ Leader assigns Code Reviewer
            └─ Reviewer checks code → VERDICT: PASS or FAIL
                 ├─ PASS → Leader outputs FINAL SUMMARY → COMPLETE phase
                 └─ FAIL → Leader sends ISSUES to Dev for fix
                      └─ Dev fixes + rebuilds → Reviewer re-checks
                           └─ (repeat up to 3 review cycles)
```

**Roles in execute phase:**

| Role | Responsibility | Output format |
|------|---------------|---------------|
| **Developer** | Write code, build, self-fix build errors | `STATUS`, `FILES_CHANGED`, `ENTRY_FILE` or `PREVIEW_CMD`+`PREVIEW_PORT` |
| **Code Reviewer** | Check correctness, find real bugs | `VERDICT` (PASS/FAIL), `ISSUES`, `SUGGESTIONS` |
| **Team Lead** | Coordinate, delegate, never write code | `@Name: task` delegations, `FINAL SUMMARY` |

**Dev must produce a previewable deliverable** — one of:
- **Type A (static)**: HTML file or framework build output (`dist/index.html`). Dev runs `npm run build` and fixes errors until it succeeds.
- **Type B (command)**: A start command + port (e.g., `python app.py` on port 5000). System runs it automatically.

**Project directory**: On "Approve Plan", the system creates a unique directory (e.g., `match-3-game/`, or `match-3-game-2/` if it exists). All team members work in this shared directory.

**Safeguards**: max 5 delegation depth, max 20 total delegations, 7-round budget, 3 review cycles max, 10-round hard ceiling. Delegation is blocked in all phases except EXECUTE.

### Preview

The system supports three preview modes, chosen automatically:

| Type | Example | How it works |
|------|---------|-------------|
| **Static HTML** | Plain HTML/CSS/JS | `npx serve` on port 9100 |
| **Build output** | Vite/React `dist/` | Dev runs `npm run build`, system serves `dist/index.html` |
| **Running process** | Python Flask, Node Express | System runs `PREVIEW_CMD` on `PREVIEW_PORT` |

Preview is served from the dev's last successful build. Fix iterations update the preview automatically.

## Agent Presets

| Name | Role | Style |
|------|------|-------|
| Alex | Frontend Dev | Friendly, casual |
| Mia | Backend Dev | Formal, professional |
| Leo | Fullstack Dev | Aggressive, action-first |
| Sophie | Code Reviewer | Patient, mentor-like |
| Marcus | Architect / Lead | Formal, strategic |

## Inspiration

Pixel office art inspired by [pixel-agents](https://github.com/pablodelucca/pixel-agents) by [@pablodelucca](https://github.com/pablodelucca).

## License

MIT

---

*This entire project was vibe-coded — built with AI, from start to finish.*
