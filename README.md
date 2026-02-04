# Claude Code TODO Stream

A VS Code extension that displays Claude Code's task list in your Explorer sidebar in real-time. Watch Claude work through tasks as they happen.

![Claude TODO Stream in action](https://github.com/user-attachments/assets/placeholder.png)

## Features

- **Real-time updates** - See Claude's task list update live as it works
- **Status indicators** - Visual icons show task status:
  - ⚪ Pending (circle outline)
  - 🔄 In Progress (spinning sync icon)
  - ✅ Completed (green checkmark)
- **Per-workspace scope** - Each project has its own todo stream
- **Auto-expand on startup** - The panel opens automatically when VS Code starts
- **Session awareness** - Clears old todos when a new Claude session starts

## Requirements

- VS Code 1.85.0 or higher
- [Claude Code](https://claude.ai/code) CLI or VS Code extension
- Windows with PowerShell (hooks are written in PowerShell)

## Installation

### Step 1: Install the VS Code Extension

**Option A: From VSIX (recommended)**
```bash
cd claude-todo-stream
npm install
npm run compile
npx vsce package
code --install-extension claude-todo-stream-0.0.1.vsix
```

**Option B: Development mode**
1. Clone this repo
2. Open in VS Code
3. Run `npm install`
4. Press F5 to launch Extension Development Host

### Step 2: Set Up Claude Code Hooks

Claude Code uses hooks to capture the todo list. You need to add two hook scripts and configure them.

#### Create the hook scripts

**1. Create `C:\Users\<YOUR_USERNAME>\.claude\hooks\todo-stream.ps1`:**

```powershell
# todo-stream.ps1
# PostToolUse hook for TodoWrite

$stdinContent = $input | Out-String

$workingDir = $env:CLAUDE_WORKING_DIR
if (-not $workingDir) {
    $workingDir = (Get-Location).Path
}

if ($stdinContent) {
    try {
        $hookData = $stdinContent | ConvertFrom-Json
        $todos = $hookData.tool_input.todos

        if ($todos) {
            $claudeDir = Join-Path $workingDir ".claude"
            if (!(Test-Path $claudeDir)) {
                New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null
            }

            $output = @{
                updated_at = (Get-Date).ToUniversalTime().ToString("o")
                todos = @()
            }

            foreach ($todo in $todos) {
                $output.todos += @{
                    content = $todo.content
                    status = $todo.status
                    activeForm = $todo.activeForm
                }
            }

            $outputPath = Join-Path $claudeDir "todo-stream.json"
            $jsonContent = $output | ConvertTo-Json -Depth 10
            # Write UTF8 without BOM (important!)
            [System.IO.File]::WriteAllText($outputPath, $jsonContent, [System.Text.UTF8Encoding]::new($false))
        }
    } catch {
        # Silently fail
    }
}

exit 0
```

**2. Create `C:\Users\<YOUR_USERNAME>\.claude\hooks\todo-stream-clear.ps1`:**

```powershell
# todo-stream-clear.ps1
# SessionStart hook - clears todo-stream.json for fresh session

$stdinContent = $input | Out-String

if ($stdinContent) {
    try {
        $sessionData = $stdinContent | ConvertFrom-Json
        $workingDir = $sessionData.cwd

        if ($workingDir) {
            $todoFile = Join-Path $workingDir ".claude\todo-stream.json"

            if (Test-Path $todoFile) {
                $emptyState = @{
                    updated_at = (Get-Date).ToUniversalTime().ToString("o")
                    todos = @()
                    session_id = $sessionData.session_id
                }
                $jsonContent = $emptyState | ConvertTo-Json -Depth 10
                [System.IO.File]::WriteAllText($todoFile, $jsonContent, [System.Text.UTF8Encoding]::new($false))
            }
        }
    } catch {
        # Silently fail
    }
}

exit 0
```

#### Configure Claude Code to use the hooks

Add the following to your `C:\Users\<YOUR_USERNAME>\.claude\settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "TodoWrite",
        "hooks": [
          {
            "type": "command",
            "command": "powershell.exe -ExecutionPolicy Bypass -NoProfile -File \"C:\\Users\\<YOUR_USERNAME>\\.claude\\hooks\\todo-stream.ps1\""
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "powershell.exe -ExecutionPolicy Bypass -NoProfile -File \"C:\\Users\\<YOUR_USERNAME>\\.claude\\hooks\\todo-stream-clear.ps1\""
          }
        ]
      }
    ]
  }
}
```

**Important:** Replace `<YOUR_USERNAME>` with your actual Windows username.

### Step 3: Restart Claude Code

Hooks only apply to new sessions. Start a new Claude Code session after configuring the hooks.

## Usage

Once installed and configured:

1. Open any project in VS Code
2. Start a Claude Code session in that project
3. When Claude uses its TodoWrite tool to track tasks, you'll see them appear in the "Claude TODO Stream" panel in your Explorer sidebar

The extension watches for changes to `.claude/todo-stream.json` in your workspace and updates the view automatically.

## How It Works

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Claude Code   │────▶│  PostToolUse     │────▶│  todo-stream    │
│   TodoWrite     │     │  Hook            │     │  .json          │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │  VS Code        │
                                                 │  FileWatcher    │
                                                 └────────┬────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │  TreeView       │
                                                 │  Updates        │
                                                 └─────────────────┘
```

1. Claude Code calls `TodoWrite` to update its task list
2. The `PostToolUse` hook captures this and writes to `.claude/todo-stream.json`
3. VS Code's FileSystemWatcher detects the file change
4. The TreeDataProvider refreshes and displays the updated todos

## Troubleshooting

### Todos not appearing

1. **Check hooks are configured** - Verify your `settings.json` has the hooks configured
2. **Start a new session** - Hooks only apply to sessions started after configuration
3. **Check the file exists** - Look for `.claude/todo-stream.json` in your workspace
4. **Check debug log** - Look at `C:\Users\<USERNAME>\.claude\hooks\todo-stream-debug.log`

### Old todos persist after new session

Make sure the `SessionStart` hook is configured to clear old todos.

### Extension not loading

1. Check VS Code Developer Tools (Help > Toggle Developer Tools) for errors
2. Ensure the extension is enabled in the Extensions panel

## Linux/macOS Support

The hooks are currently written in PowerShell for Windows. To use on Linux/macOS, you'll need to rewrite the hooks as bash scripts. The logic is the same:

1. Read JSON from stdin
2. Extract the `todos` array from `tool_input`
3. Write to `.claude/todo-stream.json` in the workspace

## Contributing

Contributions welcome! Please feel free to submit issues and pull requests.

## License

MIT
