# cursor-cc-plugins v2.2

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-Plugin-blue)](https://docs.anthropic.com/en/docs/claude-code)

**Build high-quality projects using only natural language.**

A 2-agent workflow plugin for Cursor ↔ Claude Code collaboration, designed for VibeCoders who want to develop without deep technical knowledge.

---

## Who Is This For?

- **VibeCoders**: Build apps without technical expertise using natural language
- **Teams**: Coordinate work between Cursor (PM) and Claude Code (Worker)
- **Developers**: Automate the plan → implement → review cycle

---

## Installation

```bash
# Add the marketplace
/plugin marketplace add Chachamaru127/cursor-cc-plugins

# Install the plugin
/plugin install cursor-cc-plugins
```

---

## How to Use: Step-by-Step Guide for VibeCoders

This section explains how to build your project phase by phase. **You don't need to remember any commands** - just follow the conversation flow below.

### Phase 1: Defining What You Want to Build

**Goal**: Clarify your idea before writing any code.

```
┌─────────────────────────────────────────────────────────────────┐
│  YOU                                                            │
│  "I want to build a recipe sharing app"                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  CLAUDE CODE                                                    │
│  "Great! Let me ask a few questions to understand better:"     │
│                                                                 │
│  1. Who will use this? (home cooks, professional chefs, etc.)  │
│  2. What similar apps do you like? (Cookpad, Tasty, etc.)      │
│  3. What's the most important feature?                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  YOU                                                            │
│  "Home cooks, I like Cookpad's simplicity, and I want users    │
│   to be able to save their favorite recipes"                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  CLAUDE CODE                                                    │
│  "I recommend this tech stack:"                                 │
│  - Next.js (fast, modern web framework)                         │
│  - Supabase (easy database + auth)                              │
│  - Tailwind CSS (beautiful styling)                             │
│                                                                 │
│  "Shall I create the project?"                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  YOU                                                            │
│  "Yes, let's go!"                                               │
└─────────────────────────────────────────────────────────────────┘
```

**What happens**: Claude Code creates all the initial files and folders for you.

---

### Phase 2: Building Features One by One

**Goal**: Add features in small, manageable chunks.

```
┌─────────────────────────────────────────────────────────────────┐
│  YOU                                                            │
│  "Add user login feature"                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  CLAUDE CODE                                                    │
│  "I'll break this down into tasks:"                             │
│                                                                 │
│  Phase 1: User Authentication                                   │
│  - [ ] Create login page                                        │
│  - [ ] Create signup page                                       │
│  - [ ] Connect to Supabase Auth                                 │
│                                                                 │
│  "Starting Phase 1..."                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  CLAUDE CODE (working...)                                       │
│  ✅ Created src/app/login/page.tsx                              │
│  ✅ Created src/app/signup/page.tsx                             │
│  ✅ Added authentication logic                                  │
│                                                                 │
│  "Done! Want to see it in action?"                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  YOU                                                            │
│  "Run it"                                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  CLAUDE CODE                                                    │
│  "Dev server running at http://localhost:3000"                  │
│  "Open your browser to see the login page!"                     │
└─────────────────────────────────────────────────────────────────┘
```

**What to say when you want more features**:
- "Add recipe upload feature"
- "I want users to comment on recipes"
- "Add a search function"

---

### Phase 3: Checking If Things Work

**Goal**: Make sure your app is working correctly.

```
┌─────────────────────────────────────────────────────────────────┐
│  YOU                                                            │
│  "Check if everything is working"                               │
│  (or "review the code")                                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  CLAUDE CODE                                                    │
│  "Running quality checks..."                                    │
│                                                                 │
│  ✅ Security: No issues found                                   │
│  ✅ Performance: Good                                           │
│  ⚠️  Code Quality: 2 minor suggestions                         │
│                                                                 │
│  "Overall: Looking good! The 2 suggestions are optional."       │
└─────────────────────────────────────────────────────────────────┘
```

**When something goes wrong**:

```
┌─────────────────────────────────────────────────────────────────┐
│  YOU                                                            │
│  "It's broken" or "not working"                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  CLAUDE CODE                                                    │
│  "Let me diagnose the issue..."                                 │
│                                                                 │
│  🔍 Found: Missing database connection                          │
│  🔧 Fixing automatically...                                     │
│  ✅ Fixed! Try again.                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

### Phase 4: Repeat Until Done

**Goal**: Keep adding features until your app is complete.

```
The Development Loop:

    ┌──────────────────────┐
    │                      │
    │  "Add X feature"     │ ◄─── You describe what you want
    │                      │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │                      │
    │  Claude Code builds  │ ◄─── Automatic implementation
    │                      │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │                      │
    │  "Run it" to test    │ ◄─── You verify it works
    │                      │
    └──────────┬───────────┘
               │
               ▼
    ┌──────────────────────┐
    │                      │
    │  "Check it" review   │ ◄─── Quality check (optional)
    │                      │
    └──────────┬───────────┘
               │
               ▼
         Happy? ──No──┐
           │          │
          Yes         │
           │          │
           ▼          │
    ┌──────────────────────┐
    │  Next feature...     │
    └──────────┬───────────┘
               │
               └──────────────► Back to top
```

---

### Phase 5: When You Come Back Later

**Goal**: Resume work after a break.

```
┌─────────────────────────────────────────────────────────────────┐
│  YOU (next day)                                                 │
│  "What did we do last time?"                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  CLAUDE CODE                                                    │
│  "Last session (yesterday):"                                    │
│                                                                 │
│  ✅ Completed: User login, Recipe upload                        │
│  🔄 In progress: Comment feature                                │
│  📋 Next up: Search function                                    │
│                                                                 │
│  "Want to continue with the comment feature?"                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  YOU                                                            │
│  "Yes, continue"                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference: What to Say

Instead of remembering commands, just say what you want naturally:

| Situation | What to Say |
|-----------|-------------|
| **Starting a new project** | "I want to build a [describe your idea]" |
| **Adding a feature** | "Add [feature name]" or "I want users to be able to [action]" |
| **Seeing your app** | "Run it" or "Show me" |
| **Something broke** | "It's broken" or "Fix this error" |
| **Checking quality** | "Check if everything is okay" or "Review the code" |
| **Lost or confused** | "What should I do next?" |
| **Coming back later** | "What did we do last time?" or "Continue from where we left off" |
| **Want it done faster** | "Do everything" or "Handle this for me" |
| **Checking progress** | "What's the status?" or "How much is done?" |

---

## Example: Building a Complete App

Here's a realistic example of building a todo app from start to finish:

```
Day 1: Getting Started
─────────────────────
You: "I want to build a simple todo app"
     → Claude asks clarifying questions
     → You answer: "Just for myself, simple, with due dates"
     → Project created!

You: "Run it"
     → Dev server starts, you see a blank page

You: "Add the ability to create todos"
     → Todo creation feature built

You: "Run it"
     → You can now add todos!


Day 2: Adding More Features
───────────────────────────
You: "What did we do last time?"
     → Claude reminds you of progress

You: "Add due dates to todos"
     → Due date feature built

You: "Add the ability to mark todos as complete"
     → Completion feature built

You: "Check if everything is working"
     → Quality review: All good!


Day 3: Final Touches
────────────────────
You: "Add a way to delete todos"
     → Delete feature built

You: "Make it look nicer"
     → Styling improvements

You: "Run it"
     → Your complete todo app is working!
```

---

## Features

### v2.2 (Latest)
- 🎯 **One-Command Setup**: Instantly configure the 2-agent system
- 🔧 **Troubleshooting**: Say "it's broken" for automatic diagnosis
- 📋 **Enhanced Integration**: PM commands auto-deployed

### v2.1
- 🔧 **Auto Error Recovery**: Auto-fixes up to 3 times
- ⚡ **Parallel Processing**: Up to 67% faster
- 🧠 **Session Memory**: Remembers previous work

### v2.0
- 🚀 **Plan → Work → Review**: Automated development cycle
- 🏗️ **Project Generation**: Creates real projects automatically
- 🔍 **Code Review**: Security and quality checks

---

## For Teams: 2-Agent Architecture

If you're working with a team using Cursor and Claude Code together:

```
Cursor (PM)              Claude Code (Worker)
    │                           │
    │  "Build login feature"    │
    │──────────────────────────>│
    │                           │
    │                           │ Builds, tests, commits
    │                           │
    │  "Done! Please review"    │
    │<──────────────────────────│
    │                           │
    │ Reviews and approves      │
    │                           │
```

### Roles

| Agent | Role | What They Do |
|-------|------|--------------|
| **Cursor (PM)** | Manager | Plans features, reviews work, deploys to production |
| **Claude Code (Worker)** | Developer | Writes code, runs tests, deploys to staging |

---

## Project-Level Configuration (Team Sharing)

To share this plugin with your team, add to `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "cursor-cc-marketplace": {
      "source": {
        "source": "github",
        "repo": "Chachamaru127/cursor-cc-plugins"
      }
    }
  },
  "enabledPlugins": {
    "cursor-cc-plugins@cursor-cc-marketplace": true
  }
}
```

---

## Command Reference (For Advanced Users)

| Command | Purpose |
|---------|---------|
| `/init` | Start a new project |
| `/setup-2agent` | Setup Cursor + Claude Code system |
| `/plan` | Convert feature request to tasks |
| `/work` | Execute planned tasks |
| `/review` | Run code quality checks |
| `/start-task` | Begin next task |
| `/handoff-to-cursor` | Report completion to PM |
| `/sync-status` | Check current status |

---

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Links

- [GitHub Repository](https://github.com/Chachamaru127/cursor-cc-plugins)
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Report Issues](https://github.com/Chachamaru127/cursor-cc-plugins/issues)
