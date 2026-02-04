import * as vscode from 'vscode';
import * as path from 'path';
import { TodoTreeDataProvider } from './todoProvider';

let todoProvider: TodoTreeDataProvider;
let fileWatcher: vscode.FileSystemWatcher | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('Claude TODO Stream extension activated');

  // Create and register the tree data provider
  todoProvider = new TodoTreeDataProvider();

  const treeView = vscode.window.createTreeView('claudeTodoStream', {
    treeDataProvider: todoProvider,
    showCollapseAll: false
  });
  context.subscriptions.push(treeView);

  // Register refresh command
  const refreshCommand = vscode.commands.registerCommand('claudeTodoStream.refresh', () => {
    todoProvider.refresh();
  });
  context.subscriptions.push(refreshCommand);

  // Set up file watcher for the todo stream file
  setupFileWatcher(context);

  // Re-setup watcher when workspace folders change
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      setupFileWatcher(context);
      todoProvider.refresh();
    })
  );
}

function setupFileWatcher(context: vscode.ExtensionContext): void {
  // Dispose existing watcher if any
  if (fileWatcher) {
    fileWatcher.dispose();
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return;
  }

  // Watch for changes to todo-stream.json in any workspace
  const pattern = new vscode.RelativePattern(
    workspaceFolders[0],
    '.claude/todo-stream.json'
  );

  fileWatcher = vscode.workspace.createFileSystemWatcher(pattern, false, false, false);

  fileWatcher.onDidChange(() => {
    todoProvider.refresh();
  });

  fileWatcher.onDidCreate(() => {
    todoProvider.refresh();
  });

  fileWatcher.onDidDelete(() => {
    todoProvider.refresh();
  });

  context.subscriptions.push(fileWatcher);
}

export function deactivate() {
  if (fileWatcher) {
    fileWatcher.dispose();
  }
  console.log('Claude TODO Stream extension deactivated');
}
