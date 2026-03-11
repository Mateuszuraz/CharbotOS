export type NodeType = 'trigger' | 'action' | 'condition' | 'llm';

export interface NodeData {
  label: string;
  type: NodeType;
  nodeType?: string; // Specific node type key (e.g., 'shell-command')
  config: Record<string, any>;
  icon?: string;
  status?: 'idle' | 'running' | 'success' | 'error';
  output?: any; // Store execution output
}

export interface Workflow {
  id: string;
  name: string;
  nodes: any[]; // ReactFlow nodes
  edges: any[]; // ReactFlow edges
  createdAt: number;
  updatedAt: number;
}

export const NODE_TYPES: Record<string, { label: string; type: NodeType; description: string; icon: string }> = {
  'chat-trigger': {
    label: 'Chat Message',
    type: 'trigger',
    description: 'Triggers when a message is received',
    icon: 'MessageSquare',
  },
  'llm-generate': {
    label: 'LLM Generate',
    type: 'llm',
    description: 'Generate text using AI',
    icon: 'Bot',
  },
  'http-request': {
    label: 'HTTP Request',
    type: 'action',
    description: 'Make an external API call',
    icon: 'Globe',
  },
  'javascript': {
    label: 'Execute Code',
    type: 'action',
    description: 'Run custom JavaScript',
    icon: 'Code',
  },
  'shell-command': {
    label: 'Shell/PowerShell',
    type: 'action',
    description: 'Execute system commands',
    icon: 'Terminal',
  },
  'file-operation': {
    label: 'File System',
    type: 'action',
    description: 'Read/Write files',
    icon: 'FileText',
  },
  'condition': {
    label: 'If / Condition',
    type: 'condition',
    description: 'Branch flow based on a condition expression',
    icon: 'GitBranch',
  },
  'output': {
    label: 'Output → Chat',
    type: 'action',
    description: 'Injects the result into the active chat session as an AI message',
    icon: 'MessageSquarePlus',
  },
};
