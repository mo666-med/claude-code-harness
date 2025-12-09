# cursor-cc-plugins

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-Plugin-blue)](https://docs.anthropic.com/en/docs/claude-code)

**Two AIs working as a team to support your development.**

Cursor thinks about "what to build" with you, while Claude Code "actually builds it."
Like a PM and engineer working in pairs, two AIs divide roles to move your project forward.

[English](README.md) | [日本語](README.ja.md)

![Cursor plans, Claude Code builds](docs/images/workflow-en.png)

---

## What Is This?

```
You: "I want to build a blog app"

    ↓ Cursor (PM role) creates a plan

Cursor: "I've organized the tasks. Let me hand it off to Claude Code."

    ↓ You pass it to Claude Code

Claude Code (Implementation role): "Done! Please review."

    ↓ You pass it back to Cursor

Cursor: "Review OK. Let's deploy to production."
```

**The "Plan → Implement → Review" cycle that was difficult with just one AI is now possible with two AIs working together.**

---

## Get Started in 3 Steps

### Step 1: Install

Run in Claude Code:

```bash
/plugin marketplace add Chachamaru127/cursor-cc-plugins
/plugin install cursor-cc-plugins
```

### Step 2: Setup ⭐ Do This First!

```bash
/setup-2agent
```

This command creates all necessary files.

### Step 3: Start Consulting with Cursor

**Now open Cursor.**

```
You → Cursor: "I want to build an e-commerce site"

Cursor: "Great! Let's organize the required features..."
```

Cursor creates the plan, and when implementation is needed, hands it off to Claude Code.

---

## Development Flow

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   1. Consult with Cursor                                    │
│      "I want to build X" "I want to add X feature"          │
│              │                                              │
│              ▼                                              │
│   2. Cursor organizes tasks                                 │
│      → Outputs task via /assign-to-cc                       │
│              │                                              │
│              ▼                                              │
│   3. Copy task to Claude Code                               │
│      (You bridge with copy & paste)                         │
│              │                                              │
│              ▼                                              │
│   4. Claude Code implements                                 │
│      → Completion report via /handoff-to-cursor             │
│              │                                              │
│              ▼                                              │
│   5. Copy completion report to Cursor                       │
│      (You bridge with copy & paste)                         │
│              │                                              │
│              ▼                                              │
│   6. Cursor reviews                                         │
│      → Decides on production deployment if OK               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Point**: Cursor and Claude Code don't communicate directly. **You bridge them with copy & paste.** This keeps you informed of what's happening and ensures safety.

---

## Why Use Two AIs?

### Comparison with Examples

**With just one AI:**
```
You: "Add a login feature"
AI: "Done!"
You: "...Is this really OK?" (You need to check yourself)
```

**With 2-Agent (this plugin):**
```
You → Cursor: "Add a login feature"
Cursor: "I've organized tasks including security requirements"
    ↓
Claude Code: "Implemented"
    ↓
Cursor: "Reviewed. SQL injection protection is OK. Let's deploy."
```

### Comparison Table

| Aspect | One AI Only | 2-Agent |
|--------|-------------|---------|
| Planning | Tends to be vague | Cursor organizes |
| Implementation | Focus on coding only | Claude Code handles |
| Review | Self-reviews itself | **Different AI checks objectively** |
| Quality | Varies | Maintains consistent quality |

---

## Only 2 Commands to Remember

Start with just these:

| Command | Where | What It Does |
|---------|-------|--------------|
| `/setup-2agent` | Claude Code | **Run once at the start**. Creates necessary files |
| `/start-task` | Claude Code | Receives task from Cursor and starts work |

Cursor and Claude Code will naturally guide you from there.

### Note: Creating a New Project

For existing projects, just `/setup-2agent` is enough.

**To create a new app from scratch**, run after `/setup-2agent`:
```bash
/init
```
to create a new project.

---

## Without Cursor (Solo Mode)

If you can't use Cursor, Claude Code alone works too.

```bash
# After installing, just talk to it directly
"I want to build a Todo app"
```

However, Solo mode is a simplified version:
- You need to review yourself
- Production deployment decisions are manual
- Planning to implementation all in one AI

**For serious projects, 2-Agent mode is recommended.**

> Details: [docs/usage-solo.md](docs/usage-solo.md)

---

## Learn More

| Document | Contents |
|----------|----------|
| [2-Agent Detailed Guide](docs/usage-2agent.md) | Workflow details, conversation examples |
| [Solo Mode Guide](docs/usage-solo.md) | Using Claude Code only |
| [Team Setup Guide](docs/ADMIN_GUIDE.md) | Safety settings, team operations |
| [Architecture](docs/ARCHITECTURE.md) | Technical details |

---

## FAQ

### Q: What's the difference between `/setup-2agent` and `/init`?

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/setup-2agent` | Plugin setup | **Once at the start** |
| `/init` | Create new project | Only when making a new app |

### Q: Will updating from v0.2 break things?

No. v0.2 commands still work the same.

```bash
/plugin update cursor-cc-plugins
/setup-2agent  # Detects updates and applies them
```

---

## Links

- [GitHub](https://github.com/Chachamaru127/cursor-cc-plugins)
- [Report Issues](https://github.com/Chachamaru127/cursor-cc-plugins/issues)
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)

---

MIT License
