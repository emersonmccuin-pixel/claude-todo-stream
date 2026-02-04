import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TodoItem, TodoStreamData } from './types';

export class TodoTreeItem extends vscode.TreeItem {
  constructor(
    public readonly todo: TodoItem,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    // Show activeForm when in_progress, otherwise content
    const label = todo.status === 'in_progress' && todo.activeForm
      ? todo.activeForm
      : todo.content;

    super(label, collapsibleState);

    this.tooltip = todo.content;
    this.description = this.getStatusDescription(todo.status);
    this.iconPath = this.getStatusIcon(todo.status);
    this.contextValue = 'todoItem';
  }

  private getStatusDescription(status: string): string {
    switch (status) {
      case 'completed': return 'done';
      case 'in_progress': return 'working...';
      case 'pending': return '';
      default: return '';
    }
  }

  private getStatusIcon(status: string): vscode.ThemeIcon {
    switch (status) {
      case 'completed':
        return new vscode.ThemeIcon('check', new vscode.ThemeColor('testing.iconPassed'));
      case 'in_progress':
        return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.yellow'));
      case 'pending':
      default:
        return new vscode.ThemeIcon('circle-outline');
    }
  }
}

export class TodoTreeDataProvider implements vscode.TreeDataProvider<TodoTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TodoTreeItem | undefined | null | void> =
    new vscode.EventEmitter<TodoTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TodoTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private todos: TodoItem[] = [];
  private todoFilePath: string | undefined;

  constructor() {
    this.updateTodoFilePath();
  }

  private updateTodoFilePath(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      this.todoFilePath = path.join(
        workspaceFolders[0].uri.fsPath,
        '.claude',
        'todo-stream.json'
      );
    } else {
      this.todoFilePath = undefined;
    }
  }

  refresh(): void {
    this.updateTodoFilePath();
    this.loadTodos();
    this._onDidChangeTreeData.fire();
  }

  loadTodos(): void {
    console.log('[TodoStream] loadTodos called');
    console.log('[TodoStream] todoFilePath:', this.todoFilePath);

    if (!this.todoFilePath) {
      console.log('[TodoStream] No file path set');
      this.todos = [];
      return;
    }

    try {
      const exists = fs.existsSync(this.todoFilePath);
      console.log('[TodoStream] File exists:', exists);

      if (exists) {
        let content = fs.readFileSync(this.todoFilePath, 'utf8');
        // Strip BOM if present (PowerShell UTF8 adds BOM)
        if (content.charCodeAt(0) === 0xFEFF) {
          content = content.slice(1);
        }
        console.log('[TodoStream] File content length:', content.length);
        const data: TodoStreamData = JSON.parse(content);
        this.todos = data.todos || [];
        console.log('[TodoStream] Loaded todos:', this.todos.length);
      } else {
        this.todos = [];
      }
    } catch (err) {
      console.error('[TodoStream] Error loading todos:', err);
      this.todos = [];
    }
  }

  getTreeItem(element: TodoTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<TodoTreeItem[]> {
    this.loadTodos();

    if (this.todos.length === 0) {
      return Promise.resolve([]);
    }

    const items = this.todos.map(
      todo => new TodoTreeItem(todo, vscode.TreeItemCollapsibleState.None)
    );

    return Promise.resolve(items);
  }
}
