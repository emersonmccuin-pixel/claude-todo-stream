export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm?: string;
}

export interface TodoStreamData {
  updated_at: string;
  todos: TodoItem[];
}
