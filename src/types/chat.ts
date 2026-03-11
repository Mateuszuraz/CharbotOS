export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** Full data URL (data:mime/type;base64,...) — used for preview */
  dataUrl: string;
  /** Raw base64 string without prefix — sent to AI providers */
  base64: string;
  /** Plain text content for .txt / .md files */
  text?: string;
}

export interface ToolCallEntry {
  id: string;
  toolName: string;
  args: Record<string, any>;
  result?: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: Attachment[];
  toolCalls?: ToolCallEntry[];
}
