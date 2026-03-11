/** OS tool definitions, XML parser, and executor for the OS File Agent */

export const OS_TOOLS = [
  {
    name: 'list_dir',
    description: 'List files and directories in a given path.',
    parameters: {
      dir: 'string — the directory path to list (supports ~/)',
    },
  },
  {
    name: 'search_files',
    description: 'Search for files matching a query string (by filename) within a directory tree (max depth 4, max 50 results).',
    parameters: {
      query: 'string — filename search term',
      dir: 'string — root directory to search from',
    },
  },
  {
    name: 'read_file',
    description: 'Read the contents of a text file or XLSX/CSV spreadsheet. Max 500KB for text files.',
    parameters: {
      path: 'string — absolute or ~/relative file path',
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file (creates or overwrites). Use for creating new files or replacing file content.',
    parameters: {
      path: 'string — file path to write',
      content: 'string — content to write',
    },
  },
  {
    name: 'append_csv',
    description: 'Append a row to a CSV file. Creates the file with headers if it does not exist.',
    parameters: {
      path: 'string — CSV file path',
      row_data: 'object — key-value pairs for the new row',
    },
  },
];

export interface PluginDef {
  name: string;
  description: string;
  parameters: Record<string, string>;
  source: 'file' | 'webhook';
}

export async function fetchPluginDefs(): Promise<PluginDef[]> {
  try {
    const res = await fetch('/api/plugins');
    if (!res.ok) return [];
    const data = await res.json() as { plugins?: PluginDef[] };
    return data.plugins ?? [];
  } catch {
    return [];
  }
}

export function buildOsAgentSystemPromptAddendum(extraTools: PluginDef[] = []): string {
  const allTools = [
    ...OS_TOOLS.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })),
    ...extraTools.map(p => ({ name: p.name, description: p.description, parameters: p.parameters })),
  ];
  const toolList = allTools.map(t =>
    `  - **${t.name}**: ${t.description}\n    Params: ${JSON.stringify(t.parameters)}`
  ).join('\n');

  return `

## OS File Agent

You have access to the user's local filesystem via these tools:
${toolList}

To use a tool, output a tool call block (and NOTHING else in that message):
<tool_call>
{"name": "list_dir", "args": {"dir": "~/Downloads"}}
</tool_call>

Rules:
- Use ONE tool call per message.
- After the tool result is returned, you may call another tool or give a final answer.
- Always use paths with ~/ prefix for home directory paths.
- Never invent file contents — read first, then operate.
- When writing or appending, confirm the operation to the user.
`;
}

export interface ToolCall {
  name: string;
  args: Record<string, any>;
}

/** Parse <tool_call>...</tool_call> blocks from assistant text */
export function parseToolCalls(text: string): ToolCall[] {
  const results: ToolCall[] = [];
  const regex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.name && typeof parsed.name === 'string') {
        results.push({ name: parsed.name, args: parsed.args ?? {} });
      }
    } catch {
      // ignore malformed JSON
    }
  }
  return results;
}

/** Remove <tool_call>...</tool_call> blocks from text */
export function stripToolCalls(text: string): string {
  return text.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '').trim();
}

/** Execute an OS tool by calling the appropriate /api/os/* endpoint */
export async function executeOsTool(name: string, args: Record<string, any>): Promise<any> {
  const endpointMap: Record<string, string> = {
    list_dir: '/api/os/list-dir',
    search_files: '/api/os/search-files',
    read_file: '/api/os/read-file',
    write_file: '/api/os/write-file',
    append_csv: '/api/os/append-csv',
  };

  const endpoint = endpointMap[name];
  // Fallback: try plugin exec for unknown tools
  if (!endpoint) {
    const res = await fetch(`/api/plugins/exec/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `Plugin ${name} failed`);
    return data.result ?? JSON.stringify(data);
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Tool ${name} failed`);

  // Format result as readable string
  if (name === 'list_dir' && data.entries) {
    return data.entries.map((e: any) =>
      `${e.isDirectory ? '[DIR] ' : '[FILE]'} ${e.name} — ${e.path}`
    ).join('\n') || '(empty directory)';
  }
  if (name === 'search_files' && data.results) {
    return data.results.length > 0
      ? data.results.join('\n')
      : 'No files found matching the query.';
  }
  if (name === 'read_file') {
    if (data.type === 'text') return data.content;
    if (data.type === 'xlsx') {
      return Object.entries(data.sheets as Record<string, string>)
        .map(([sheet, csv]) => `### Sheet: ${sheet}\n${csv}`)
        .join('\n\n');
    }
  }
  if (name === 'write_file') return `File written: ${data.path}`;
  if (name === 'append_csv') return `Row appended to: ${data.path}`;

  return JSON.stringify(data);
}
