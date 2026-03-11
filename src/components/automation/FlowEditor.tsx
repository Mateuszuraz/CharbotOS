import React, { useCallback, useState, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  Panel,
  NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { CustomNode } from './CustomNode';
import { GlassButton } from '@/components/ui/GlassButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { Plus, Play, Save, ChevronDown, X, ChevronUp, Copy, Trash2, HelpCircle } from 'lucide-react';
import { NODE_TYPES, NodeData, Workflow } from '@/types/automation';
import { v4 as uuidv4 } from 'uuid';
import { NodeConfigPanel } from './NodeConfigPanel';
import { useSettings } from '@/context/SettingsContext';
import { useLanguage } from '@/context/LanguageContext';

const nodeTypes = { custom: CustomNode };

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'custom',
    position: { x: 100, y: 150 },
    data: { label: 'Chat Message', type: 'trigger', nodeType: 'chat-trigger', icon: 'MessageSquare', config: { event: 'Any Message' } },
  },
  {
    id: '2',
    type: 'custom',
    position: { x: 420, y: 150 },
    data: { label: 'LLM Generate', type: 'llm', nodeType: 'llm-generate', icon: 'Bot', config: { model: 'llama3' } },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#1A1A1A', strokeWidth: 2 } },
];

function loadWorkflows(): Workflow[] {
  try { return JSON.parse(localStorage.getItem('charbot-workflows') || '[]'); }
  catch { return []; }
}

export function FlowEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // A — Workflow save/load
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const [savedWorkflows, setSavedWorkflows] = useState<Workflow[]>(loadWorkflows);
  const [showWorkflowList, setShowWorkflowList] = useState(false);
  const [editingName, setEditingName] = useState(false);

  // B — Execution output panel
  const [nodeOutputs, setNodeOutputs] = useState<Record<string, { label: string; nodeType: string; output: any }>>({});
  const [showOutputPanel, setShowOutputPanel] = useState(false);

  const { settings } = useSettings();
  const { lang } = useLanguage();
  const [showHelp, setShowHelp] = useState(false);
  const isDarkRef = useRef(false);

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    isDarkRef.current = settings.theme === 'dark' || (settings.theme === 'system' && prefersDark);
  }, [settings.theme]);

  const getEdgeStyle = () => ({
    stroke: isDarkRef.current ? '#F9F7F1' : '#1A1A1A',
    strokeWidth: 2,
  });

  // E — Auto-clear selection when selected node is deleted
  useEffect(() => {
    if (selectedNodeId && !nodes.find(n => n.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [nodes, selectedNodeId]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges(eds => addEdge({ ...params, animated: true, style: getEdgeStyle() }, eds)),
    [setEdges],
  );

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setShowWorkflowList(false);
  }, []);

  const updateNodeData = (id: string, newData: Partial<NodeData>) => {
    setNodes(nds =>
      nds.map(node =>
        node.id === id
          ? { ...node, data: { ...node.data, ...newData, config: { ...node.data.config, ...newData.config } } }
          : node,
      ),
    );
  };

  const addNode = (typeKey: string) => {
    const typeDef = NODE_TYPES[typeKey];
    const newNode: Node = {
      id: uuidv4(),
      type: 'custom',
      position: { x: Math.random() * 400 + 80, y: Math.random() * 280 + 80 },
      data: { label: typeDef.label, type: typeDef.type, nodeType: typeKey, icon: typeDef.icon, config: {} },
    };
    setNodes(nds => [...nds, newNode]);
  };

  // E — Duplicate node
  const duplicateNode = (id: string) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    const newNode: Node = {
      ...node,
      id: uuidv4(),
      position: { x: node.position.x + 44, y: node.position.y + 44 },
      data: { ...node.data, status: 'idle', output: undefined },
    };
    setNodes(nds => [...nds, newNode]);
    setSelectedNodeId(newNode.id);
  };

  // A — Save workflow
  const saveWorkflow = () => {
    const now = Date.now();
    const existing = savedWorkflows.find(w => w.name === workflowName);
    const wf: Workflow = {
      id: existing?.id ?? uuidv4(),
      name: workflowName,
      nodes: nodes.map(n => ({ ...n, data: { ...n.data, status: 'idle', output: undefined } })),
      edges,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const updated = existing
      ? savedWorkflows.map(w => w.id === wf.id ? wf : w)
      : [wf, ...savedWorkflows];
    setSavedWorkflows(updated);
    localStorage.setItem('charbot-workflows', JSON.stringify(updated));
  };

  // A — Load workflow
  const loadWorkflow = (wf: Workflow) => {
    setNodes(wf.nodes);
    setEdges(wf.edges);
    setWorkflowName(wf.name);
    setShowWorkflowList(false);
    setSelectedNodeId(null);
    setNodeOutputs({});
    setShowOutputPanel(false);
  };

  const deleteWorkflow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedWorkflows.filter(w => w.id !== id);
    setSavedWorkflows(updated);
    localStorage.setItem('charbot-workflows', JSON.stringify(updated));
  };

  // --- LLM helper (non-streaming, per-node provider) ---
  const callLLM = async (nodeConfig: Record<string, any>, inputStr: string): Promise<string> => {
    const provider = nodeConfig.provider || 'ollama';
    const model = nodeConfig.model || (
      provider === 'openai' ? 'gpt-4o' :
      provider === 'google' ? 'gemini-2.5-flash-latest' :
      provider === 'anthropic' ? 'claude-sonnet-4-6' :
      'llama3.2'
    );
    const rawPrompt = nodeConfig.prompt || '{{input}}';
    const prompt = rawPrompt.replace(/\{\{input\}\}/g, inputStr);
    const systemPrompt = nodeConfig.systemPrompt || '';
    const messages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      { role: 'user', content: prompt },
    ];

    if (provider === 'ollama') {
      // Ollama: direct call (local, no API key needed)
      const endpoint = settings.endpoint || 'http://localhost:11434';
      const res = await fetch(`${endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: false }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { message: { content: string } };
      return data.message.content.trim();
    }

    // P0-5: all cloud providers go through backend proxy — no API keys in browser
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model, messages, systemPrompt }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || res.statusText); }

    // /api/ai/chat is SSE — collect all deltas into full text
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = ''; let fullText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        try { const j = JSON.parse(line.slice(6)); if (j.delta) fullText += j.delta; } catch { /* skip */ }
      }
    }
    return fullText.trim();
  };

  // Node execution engine
  const executeNode = async (node: Node, input: any): Promise<any> => {
    setNodes(nds => nds.map(n =>
      n.id === node.id ? { ...n, data: { ...n.data, status: 'running' } } : n,
    ));

    try {
      let output: any = null;

      switch (node.data.nodeType) {
        // C — JavaScript node
        case 'javascript': {
          const code = node.data.config.code || 'return input;';
          // eslint-disable-next-line no-new-func
          const fn = new Function('input', code);
          output = fn(input);
          break;
        }

        // F — Condition node
        case 'condition': {
          const expression = node.data.config.expression || 'true';
          // eslint-disable-next-line no-new-func
          const fn = new Function('input', `return Boolean(${expression})`);
          const result = fn(input);
          output = { result, input };
          break;
        }

        case 'shell-command': {
          const res = await fetch('/api/terminal/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              command: node.data.config.command || 'echo "No command"',
              cwd: node.data.config.cwd,
            }),
          });
          output = await res.json();
          break;
        }

        case 'file-operation': {
          const { operation, path: opPath, content } = node.data.config;
          // P0-2: route through osAgent sandbox instead of raw /api/fs/*
          const ep = operation === 'write' ? '/api/os/write-file'
            : operation === 'list' ? '/api/os/list-dir'
            : '/api/os/read-file';
          const body = operation === 'write'
            ? { path: opPath || './output.txt', content: content || '' }
            : operation === 'list'
              ? { dir: opPath || './' }
              : { path: opPath || './' };
          const res = await fetch(ep, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          output = await res.json();
          break;
        }

        case 'http-request': {
          const { url, method, body } = node.data.config;
          if (url) {
            const res = await fetch(url, {
              method: method || 'GET',
              body: body ? JSON.stringify(body) : undefined,
              headers: { 'Content-Type': 'application/json' },
            });
            output = await res.json();
          }
          break;
        }

        case 'llm-generate': {
          const inputStr = typeof input === 'string' ? input : JSON.stringify(input, null, 2);
          const text = await callLLM(node.data.config, inputStr);
          output = text;
          break;
        }

        case 'output': {
          const content = typeof input === 'string' ? input : JSON.stringify(input, null, 2);
          window.dispatchEvent(new CustomEvent('charbot:flow-output', { detail: { content } }));
          output = content;
          break;
        }

        default: {
          await new Promise(r => setTimeout(r, 300));
          output = input;
        }
      }

      setNodes(nds => nds.map(n =>
        n.id === node.id ? { ...n, data: { ...n.data, status: 'success', output } } : n,
      ));
      return output;
    } catch (error) {
      console.error('Node execution failed:', error);
      setNodes(nds => nds.map(n =>
        n.id === node.id ? { ...n, data: { ...n.data, status: 'error' } } : n,
      ));
      throw error;
    }
  };

  // B — Workflow runner with output collection + F — condition branching
  const runWorkflow = async () => {
    setIsRunning(true);
    setShowOutputPanel(false);
    setNodeOutputs({});
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, status: 'idle', output: undefined } })));

    const startNode = nodes.find(n => n.data.type === 'trigger');
    if (!startNode) { setIsRunning(false); return; }

    const outputs: typeof nodeOutputs = {};

    try {
      const traverse = async (node: Node, input: any) => {
        const output = await executeNode(node, input);
        outputs[node.id] = { label: node.data.label, nodeType: node.data.nodeType ?? 'unknown', output };

        // F — Condition node routes to true/false branch
        let outgoing: Edge[];
        if (node.data.nodeType === 'condition') {
          const branch = output?.result ? 'true' : 'false';
          outgoing = edges.filter(e =>
            e.source === node.id && (e.sourceHandle === branch || !e.sourceHandle),
          );
        } else {
          outgoing = edges.filter(e => e.source === node.id);
        }

        for (const edge of outgoing) {
          const target = nodes.find(n => n.id === edge.target);
          if (target) await traverse(target, output);
        }
      };

      await traverse(startNode, {});
    } catch (e) {
      console.error('Workflow error:', e);
    }

    setNodeOutputs(outputs);
    setShowOutputPanel(Object.keys(outputs).length > 0);
    setIsRunning(false);
  };

  const isDark = isDarkRef.current;

  return (
    <div className="h-full w-full bg-bg-app relative flex flex-col overflow-hidden">
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-bg-app h-full"
        >
          {/* D — Dark-mode aware Background */}
          <Background
            color={isDark ? '#3A3A3A' : '#1A1A1A'}
            gap={24}
            size={1}
            style={{ opacity: 0.08 }}
          />

          {/* D — Dark-mode aware Controls */}
          <Controls
            style={{ boxShadow: 'none' }}
            className="bg-bg-app border-2 border-glass-border shadow-[4px_4px_0px_var(--color-shadow-hard)] [&>button]:bg-bg-app [&>button]:border-glass-border [&>button]:text-text-primary [&>button:hover]:bg-black/5"
          />

          {/* D — Dark-mode aware MiniMap */}
          <MiniMap
            className="bg-bg-app border-2 border-glass-border overflow-hidden shadow-[4px_4px_0px_var(--color-shadow-hard)]"
            nodeColor={isDark ? '#F9F7F1' : '#1A1A1A'}
            maskColor={isDark ? 'rgba(25,25,25,0.8)' : 'rgba(255,255,255,0.8)'}
          />

          {/* Add Node Panel */}
          <Panel position="top-left" className="m-3">
            <GlassCard className="p-1.5 flex flex-col gap-0.5 w-44">
              <div className="text-[9px] font-bold text-text-secondary uppercase tracking-widest px-2 py-1.5 font-mono border-b border-glass-border mb-0.5">
                Add Node
              </div>
              {Object.entries(NODE_TYPES).map(([key, def]) => (
                <GlassButton
                  key={key}
                  variant="ghost"
                  size="sm"
                  className="justify-start text-[11px] font-mono h-8"
                  onClick={() => addNode(key)}
                >
                  <Plus size={11} className="mr-1.5 flex-shrink-0 opacity-60" />
                  {def.label}
                </GlassButton>
              ))}
            </GlassCard>
          </Panel>

          {/* A — Workflow toolbar */}
          <Panel position="top-right" className="m-3">
            <div className="flex items-center gap-2">
              {/* Workflow name + saved list */}
              <div className="relative">
                <button
                  onClick={() => setShowWorkflowList(p => !p)}
                  className="flex items-center gap-1.5 h-9 px-3 bg-bg-app border-2 border-glass-border shadow-[2px_2px_0px_var(--color-shadow-hard)] text-[11px] font-mono font-bold text-text-primary hover:border-text-primary transition-colors min-w-[120px]"
                >
                  {editingName ? (
                    <input
                      autoFocus
                      value={workflowName}
                      onChange={e => setWorkflowName(e.target.value)}
                      onBlur={() => setEditingName(false)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false); }}
                      onClick={e => e.stopPropagation()}
                      className="bg-transparent focus:outline-none flex-1 text-[11px] font-mono font-bold min-w-0"
                    />
                  ) : (
                    <span
                      className="flex-1 truncate text-left"
                      onDoubleClick={e => { e.stopPropagation(); setEditingName(true); }}
                    >
                      {workflowName}
                    </span>
                  )}
                  <ChevronDown size={11} className="flex-shrink-0 opacity-60" />
                </button>

                {showWorkflowList && (
                  <div className="absolute top-full right-0 mt-1 w-60 bg-bg-app border-2 border-glass-border shadow-[4px_4px_0px_var(--color-shadow-hard)] z-50">
                    <div className="text-[9px] font-bold font-mono uppercase text-text-secondary px-3 py-2 border-b border-glass-border tracking-widest">
                      Saved Workflows
                    </div>
                    {savedWorkflows.length === 0 ? (
                      <div className="px-3 py-4 text-[10px] text-text-secondary font-mono italic">
                        No saved workflows yet
                      </div>
                    ) : (
                      savedWorkflows.map(wf => (
                        <div
                          key={wf.id}
                          className="flex items-center border-b border-glass-border/50 last:border-0 hover:bg-black/5 dark:hover:bg-white/5"
                        >
                          <button
                            onClick={() => loadWorkflow(wf)}
                            className="flex-1 text-left px-3 py-2.5 text-[11px] font-mono font-bold text-text-primary truncate"
                          >
                            {wf.name}
                          </button>
                          <button
                            onClick={e => deleteWorkflow(wf.id, e)}
                            className="p-2 text-text-secondary hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <GlassButton variant="secondary" size="sm" onClick={saveWorkflow}>
                <Save size={13} className="mr-1" />
                Save
              </GlassButton>

              <GlassButton
                variant="primary"
                size="sm"
                onClick={runWorkflow}
                disabled={isRunning}
              >
                <Play size={13} className="mr-1" />
                {isRunning ? 'Running…' : 'Execute'}
              </GlassButton>

              <button
                onClick={() => setShowHelp(v => !v)}
                title={lang === 'pl' ? 'Instrukcja obsługi' : 'Help / Guide'}
                className={`h-9 w-9 flex items-center justify-center border-2 transition-all ${
                  showHelp
                    ? 'bg-text-primary text-bg-app border-text-primary shadow-[2px_2px_0px_var(--color-shadow-hard)]'
                    : 'bg-bg-app border-glass-border text-text-secondary hover:border-text-primary hover:text-text-primary shadow-[2px_2px_0px_var(--color-shadow-hard)]'
                }`}
              >
                <HelpCircle size={15} />
              </button>
            </div>
          </Panel>

          {/* E — Node config panel with duplicate */}
          {selectedNodeId && (
            <Panel position="top-right" className="m-3 mt-16 pointer-events-none">
              <div className="pointer-events-auto">
                <NodeConfigPanel
                  node={nodes.find(n => n.id === selectedNodeId) || null}
                  onUpdate={updateNodeData}
                  onClose={() => setSelectedNodeId(null)}
                  onDuplicate={duplicateNode}
                />
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {/* Help / Guide panel */}
      {showHelp && (
        <div className="border-t-2 border-text-primary bg-bg-app flex flex-col max-h-[60vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b-2 border-glass-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <HelpCircle size={14} className="text-text-primary" />
              <span className="text-[10px] font-black font-mono uppercase tracking-[0.2em] text-text-primary">
                {lang === 'pl' ? 'Instrukcja Obsługi Flows' : 'Flows — User Guide'}
              </span>
              <span className="text-[8px] font-bold font-mono bg-text-primary text-bg-app px-1.5 py-0.5 ml-1">
                v1.0
              </span>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="text-text-secondary hover:text-text-primary transition-colors p-1"
            >
              <X size={14} />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl">

              {/* Column 1 — What is Flows + Quick start */}
              <div className="space-y-4">
                <div>
                  <p className="text-[9px] font-black font-mono uppercase tracking-[0.15em] text-text-secondary border-b-2 border-glass-border pb-1.5 mb-3">
                    {lang === 'pl' ? '01 — Co to jest Flows?' : '01 — What is Flows?'}
                  </p>
                  <p className="text-[10px] font-mono text-text-secondary leading-relaxed">
                    {lang === 'pl'
                      ? 'Flows to edytor wizualny potoków AI. Łącz węzły w pipeline\'y, które wykonują: generowanie tekstu, warunki logiczne, kod JS, polecenia shell, requesty HTTP i operacje na plikach — wszystko bez pisania kodu.'
                      : 'Flows is a visual AI pipeline editor. Chain nodes into workflows that run: text generation, conditions, JS code, shell commands, HTTP requests and file ops — all without writing a single line of code.'}
                  </p>
                </div>

                <div>
                  <p className="text-[9px] font-black font-mono uppercase tracking-[0.15em] text-text-secondary border-b-2 border-glass-border pb-1.5 mb-3">
                    {lang === 'pl' ? '02 — Szybki start' : '02 — Quick Start'}
                  </p>
                  <div className="space-y-2">
                    {(lang === 'pl' ? [
                      ['1', 'Dodaj węzeł', 'Kliknij dowolny typ węzła w panelu po lewej stronie.'],
                      ['2', 'Połącz węzły', 'Przeciągnij z prawego portu jednego węzła do lewego portu następnego.'],
                      ['3', 'Skonfiguruj', 'Kliknij węzeł, by otworzyć panel konfiguracji po prawej.'],
                      ['4', 'Uruchom', 'Kliknij „Execute" — workflow startuje od węzła Trigger.'],
                      ['5', 'Zapisz', 'Kliknij „Save". Dwuklik na nazwie pozwala ją zmienić.'],
                    ] : [
                      ['1', 'Add a node', 'Click any node type in the left panel.'],
                      ['2', 'Connect nodes', 'Drag from the right port of one node to the left port of the next.'],
                      ['3', 'Configure', 'Click a node to open its config panel on the right.'],
                      ['4', 'Execute', 'Click "Execute" — the workflow starts from the Trigger node.'],
                      ['5', 'Save', 'Click "Save". Double-click the name to rename it.'],
                    ]).map(([num, title, desc]) => (
                      <div key={num} className="flex gap-2.5">
                        <span className="flex-shrink-0 w-5 h-5 bg-text-primary text-bg-app text-[9px] font-black font-mono flex items-center justify-center">
                          {num}
                        </span>
                        <div>
                          <p className="text-[10px] font-bold font-mono text-text-primary">{title}</p>
                          <p className="text-[9px] font-mono text-text-secondary leading-snug">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Column 2 — Node types */}
              <div>
                <p className="text-[9px] font-black font-mono uppercase tracking-[0.15em] text-text-secondary border-b-2 border-glass-border pb-1.5 mb-3">
                  {lang === 'pl' ? '03 — Typy węzłów' : '03 — Node Types'}
                </p>
                <div className="space-y-2">
                  {(lang === 'pl' ? [
                    ['Chat Trigger', 'trigger', 'Punkt startowy przepływu. Każdy workflow musi zaczynać się od Triggera.'],
                    ['LLM Generate', 'llm', 'Wywołuje model AI. Użyj {{input}}, by wstrzyknąć dane z poprzedniego węzła.'],
                    ['Condition', 'condition', 'Wyrażenie JS zwracające true/false. Routing do dwóch różnych gałęzi.'],
                    ['JavaScript', 'code', 'Dowolny kod JS. Zmienna input zawiera dane z poprzedniego węzła. Użyj return.'],
                    ['HTTP Request', 'http', 'Wywołuje dowolne REST API (GET/POST). Wynik trafia do następnego węzła.'],
                    ['Shell Command', 'shell', 'Uruchamia polecenie terminala na serwerze lokalnym.'],
                    ['File Operation', 'file', 'Odczyt, zapis lub lista plików. Ścieżka względna lub bezwzględna.'],
                    ['Output', 'output', 'Wysyła końcowy wynik do interfejsu czatu Charbot OS.'],
                  ] : [
                    ['Chat Trigger', 'trigger', 'Starting point. Every workflow must begin with a Trigger node.'],
                    ['LLM Generate', 'llm', 'Calls an AI model. Use {{input}} to inject data from the previous node.'],
                    ['Condition', 'condition', 'A JS expression returning true/false. Routes to two separate branches.'],
                    ['JavaScript', 'code', 'Any JS code. The input variable holds data from the previous node. Use return.'],
                    ['HTTP Request', 'http', 'Calls any REST API (GET/POST). Result passes to the next node.'],
                    ['Shell Command', 'shell', 'Runs a terminal command on the local server.'],
                    ['File Operation', 'file', 'Read, write, or list files. Relative or absolute path.'],
                    ['Output', 'output', 'Sends the final result to the Charbot OS chat interface.'],
                  ]).map(([name, , desc]) => (
                    <div key={name} className="flex gap-2 border-l-2 border-glass-border pl-2">
                      <div>
                        <p className="text-[10px] font-bold font-mono text-text-primary">{name}</p>
                        <p className="text-[9px] font-mono text-text-secondary leading-snug">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 3 — Tips + Examples */}
              <div className="space-y-4">
                <div>
                  <p className="text-[9px] font-black font-mono uppercase tracking-[0.15em] text-text-secondary border-b-2 border-glass-border pb-1.5 mb-3">
                    {lang === 'pl' ? '04 — Wskazówki' : '04 — Tips & Tricks'}
                  </p>
                  <div className="space-y-2">
                    {(lang === 'pl' ? [
                      ['{{input}}', 'W węźle LLM wpisz {{input}} w polu prompt, by wkleić wynik poprzedniego węzła.'],
                      ['Nawigacja', 'Przeciągnij tło, by przesuwać kanwę. Scroll myszy = zoom.'],
                      ['Duplikowanie', 'W panelu konfiguracji węzła kliknij ikonę kopiowania, by zduplikować węzeł.'],
                      ['Usuwanie', 'Zaznacz węzeł i naciśnij Delete, lub użyj × w panelu konfiguracji.'],
                      ['Rozgałęzienia', 'Użyj węzła Condition, by stworzyć logikę if/else — dwa oddzielne połączenia wychodzące.'],
                      ['Multi-LLM', 'Połącz kilka węzłów LLM po sobie, by zbudować wieloetapowy pipeline AI.'],
                    ] : [
                      ['{{input}}', 'In an LLM node, type {{input}} in the prompt field to inject the previous node\'s output.'],
                      ['Navigation', 'Drag the background to pan the canvas. Scroll to zoom.'],
                      ['Duplicate', 'In the node config panel, click the copy icon to duplicate a node.'],
                      ['Delete', 'Select a node and press Delete, or use × in the config panel.'],
                      ['Branching', 'Use a Condition node to create if/else logic — two separate outgoing connections.'],
                      ['Multi-LLM', 'Chain multiple LLM nodes to build a multi-step AI pipeline.'],
                    ]).map(([key, desc]) => (
                      <div key={key} className="flex gap-2">
                        <span className="flex-shrink-0 font-black font-mono text-[9px] text-text-primary bg-black/5 dark:bg-white/5 px-1.5 py-0.5 h-fit whitespace-nowrap">
                          {key}
                        </span>
                        <p className="text-[9px] font-mono text-text-secondary leading-snug">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[9px] font-black font-mono uppercase tracking-[0.15em] text-text-secondary border-b-2 border-glass-border pb-1.5 mb-3">
                    {lang === 'pl' ? '05 — Przykładowy pipeline' : '05 — Example Pipeline'}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {['Chat Trigger', '→', 'LLM Generate', '→', 'Condition', '→', 'Output'].map((step, i) => (
                      <span
                        key={i}
                        className={step === '→'
                          ? 'text-text-secondary font-mono text-[10px]'
                          : 'text-[8px] font-bold font-mono uppercase bg-text-primary text-bg-app px-1.5 py-0.5'
                        }
                      >
                        {step}
                      </span>
                    ))}
                  </div>
                  <p className="text-[9px] font-mono text-text-secondary mt-2 leading-relaxed">
                    {lang === 'pl'
                      ? 'Trigger → LLM analizuje wiadomość → Condition sprawdza wynik → Output wyświetla w czacie.'
                      : 'Trigger → LLM analyses the message → Condition checks result → Output displays in chat.'}
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* B — Execution output panel */}
      {showOutputPanel && (
        <div className="border-t-2 border-glass-border bg-bg-app max-h-52 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-glass-border bg-bg-app flex-shrink-0">
            <span className="text-[9px] font-bold font-mono uppercase text-text-secondary tracking-widest">
              Execution Results — {Object.keys(nodeOutputs).length} node{Object.keys(nodeOutputs).length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setShowOutputPanel(false)}
              className="text-text-secondary hover:text-text-primary transition-colors"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            <div className="p-3 flex gap-3 flex-wrap">
              {Object.values(nodeOutputs).map((item, i) => (
                <div
                  key={i}
                  className="border-2 border-glass-border p-3 text-[10px] font-mono min-w-[200px] max-w-[320px] flex-1 bg-bg-app shadow-[2px_2px_0px_var(--color-shadow-hard)]"
                >
                  <div className="font-bold text-text-primary uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span>{item.label}</span>
                    <span className="text-text-secondary font-normal normal-case">({item.nodeType})</span>
                  </div>
                  <pre className="text-text-secondary text-[9px] overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-24">
                    {JSON.stringify(item.output, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FlowEditorWrapper() {
  return (
    <ReactFlowProvider>
      <FlowEditor />
    </ReactFlowProvider>
  );
}
