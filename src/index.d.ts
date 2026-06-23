export type BehaviorTreeNodeCategory = 'root' | 'composite' | 'decorator' | 'action' | 'condition' | 'subtree' | 'operation' | 'unknown';
export type BehaviorTreeNodeStatus = 'idle' | 'running' | 'success' | 'failure' | 'skipped' | 'halted' | 'disabled' | 'unknown';
export type BehaviorTreePortDirection = 'input' | 'output';
export type BehaviorTreePoint = { x: number; y: number };
export type BehaviorTreeColor = number | `#${string}`;

export type BehaviorTreePort = {
  [key: string]: any;
  id: string;
  label?: string;
  name?: string;
  direction?: BehaviorTreePortDirection | string;
  dataType?: string;
  type?: string;
  required?: boolean;
  multiple?: boolean;
  acceptsMany?: boolean;
  maxConnections?: number | null;
};

export type BehaviorTreePorts = BehaviorTreePort[] | {
  inputs?: BehaviorTreePort[];
  outputs?: BehaviorTreePort[];
};

export type BehaviorTreeChildRef = string | {
  id?: string;
  nodeId?: string;
  slot?: number;
  index?: number;
};

export type BehaviorTreeNode = {
  [key: string]: any;
  id: string;
  type?: string;
  label?: string;
  name?: string;
  category?: BehaviorTreeNodeCategory | string;
  status?: BehaviorTreeNodeStatus | string;
  parentId?: string | null;
  children?: BehaviorTreeChildRef[];
  position?: BehaviorTreePoint;
  params?: Record<string, any>;
  ports?: BehaviorTreePorts;
};

export type BehaviorTreeNodeType = {
  [key: string]: any;
  id?: string;
  label?: string;
  category?: BehaviorTreeNodeCategory | string;
  minChildren?: number;
  maxChildren?: number | null;
  color?: number | string;
  paramsSchema?: Record<string, any>;
  ports?: BehaviorTreePorts;
};

export type BehaviorTreeEdge = {
  [key: string]: any;
  id?: string;
  kind?: 'child' | 'data' | string;
  from?: string;
  to?: string;
  parentId?: string;
  childId?: string;
  fromNodeId?: string;
  fromPortId?: string;
  toNodeId?: string;
  toPortId?: string;
  slot?: number;
  index?: number;
};

export type BehaviorTreeModel = {
  [key: string]: any;
  id?: string;
  rootId?: string;
  nodes?: BehaviorTreeNode[] | Record<string, BehaviorTreeNode>;
  edges?: BehaviorTreeEdge[];
  nodeTypes?: Record<string, BehaviorTreeNodeType>;
  blackboard?: Record<string, any>;
  metadata?: Record<string, any>;
};

export type NormalizedBehaviorTreePort = BehaviorTreePort & {
  id: string;
  fullId: string;
  nodeId: string;
  direction: BehaviorTreePortDirection;
  dataType: string;
};

export type NormalizedBehaviorTreeChildEdge = {
  kind: 'child';
  fromNodeId: string;
  toNodeId: string;
  slot?: number;
  id?: string;
};

export type NormalizedBehaviorTreeDataEdge = {
  kind: 'data';
  fromNodeId: string;
  fromPortId: string;
  toNodeId: string;
  toPortId: string;
  id?: string;
};

export type NormalizedBehaviorTree = {
  tree: BehaviorTreeModel;
  rootId: string;
  nodes: BehaviorTreeNode[];
  nodesById: Map<string, BehaviorTreeNode>;
  childrenById: Map<string, string[]>;
  parentById: Map<string, string>;
  childEdges: NormalizedBehaviorTreeChildEdge[];
  dataEdges: NormalizedBehaviorTreeDataEdge[];
  portsByNodeId: Map<string, { inputs: NormalizedBehaviorTreePort[]; outputs: NormalizedBehaviorTreePort[] }>;
  portsById: Map<string, NormalizedBehaviorTreePort>;
  nodeTypes: Record<string, BehaviorTreeNodeType>;
  diagnostics: string[];
};

export type BehaviorTreeLayoutOptions = {
  nodeWidth?: number;
  nodeHeight?: number;
  horizontalGap?: number;
  verticalGap?: number;
  preservePositions?: boolean;
  center?: boolean;
  existingPositions?: Map<string, BehaviorTreePoint>;
};

export type BehaviorTreeConnectResult = {
  ok: boolean;
  reason?: string;
  from?: NormalizedBehaviorTreePort;
  to?: NormalizedBehaviorTreePort;
};

export type BehaviorTreeNodeTypeSuggestion = {
  typeId: string;
  label: string;
  category: string;
  nodeType: BehaviorTreeNodeType;
  ports: BehaviorTreePort[];
};

export type BehaviorTreeChildNodeTypeSuggestion = {
  typeId: string;
  label: string;
  category: string;
  nodeType: BehaviorTreeNodeType;
};

export type BehaviorTreeDiagnosticSeverity = 'error' | 'warning';

export type BehaviorTreeDiagnostic = {
  id: string;
  severity: BehaviorTreeDiagnosticSeverity;
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
  portId?: string;
  path?: string;
};

export const STATUS_COLOR: Record<BehaviorTreeNodeStatus | 'unknown', BehaviorTreeColor>;
export const CATEGORY_COLOR: Record<BehaviorTreeNodeCategory | 'unknown', BehaviorTreeColor>;
export const NODE_VIEW_THEME: Record<string, any>;
export const DRAWING_THEME: Record<string, any>;
export const CANVAS_THEME: Record<string, any>;
export const DEFAULT_BEHAVIOR_TREE_THEME: Record<string, any>;
export function createBehaviorTreeTheme(overrides?: Record<string, any>): Record<string, any>;
export function normalizeCategory(value?: string): keyof typeof CATEGORY_COLOR;
export function normalizeStatus(value?: string): keyof typeof STATUS_COLOR;
export function toColor(value: number | string | undefined, fallback: number | string): number;
export function portColor(dataType?: string): BehaviorTreeColor;
export function areSameDataType(a?: string, b?: string): boolean;

export type BehaviorTreeCanvasEvents = {
  selectionchange: { nodeId: string; node: BehaviorTreeNode | null; nodeIds?: string[]; nodes?: BehaviorTreeNode[]; edgeId?: string; edge?: BehaviorTreeEdge | null };
  nodeclick: { nodeId: string; node: BehaviorTreeNode };
  edgeclick: { edgeId: string; edge: BehaviorTreeEdge };
  nodedrag: { nodeId: string; position: BehaviorTreePoint };
  nodesdrag: { nodeIds: string[]; positions: Record<string, BehaviorTreePoint> };
  connectionstart: { port: NormalizedBehaviorTreePort; suggestions: BehaviorTreeNodeTypeSuggestion[] };
  connectionpreview: { port: NormalizedBehaviorTreePort; target: NormalizedBehaviorTreePort | null; ok: boolean; reason?: string };
  connectionrequest: {
    port: NormalizedBehaviorTreePort;
    world: BehaviorTreePoint;
    portWorld: BehaviorTreePoint;
    screen: BehaviorTreePoint;
    suggestions: BehaviorTreeNodeTypeSuggestion[];
  };
  portconnect: {
    edge: BehaviorTreeEdge;
    from: NormalizedBehaviorTreePort;
    to: NormalizedBehaviorTreePort;
    tree: BehaviorTreeModel;
  };
  childconnectionstart: {
    nodeId: string;
    node: BehaviorTreeNode;
    portKind: 'parent' | 'child';
    suggestions: BehaviorTreeChildNodeTypeSuggestion[];
  };
  childconnectionrequest: {
    nodeId: string;
    node: BehaviorTreeNode;
    portKind: 'parent' | 'child';
    parentId?: string;
    childId?: string;
    world: BehaviorTreePoint;
    portWorld: BehaviorTreePoint;
    screen: BehaviorTreePoint;
    suggestions: BehaviorTreeChildNodeTypeSuggestion[];
  };
  childconnect: {
    edge: BehaviorTreeEdge;
    parentId: string;
    childId: string;
    tree: BehaviorTreeModel;
    reparent: boolean;
    previousParentId?: string;
  };
  childconnectioncancel: {
    nodeId: string;
    node: BehaviorTreeNode | null;
    portKind: 'parent' | 'child';
  };
  nodechange: {
    nodeId: string;
    node: BehaviorTreeNode;
    previousNode: BehaviorTreeNode;
    tree: BehaviorTreeModel;
  };
  edgedelete: { edgeId: string; edge: BehaviorTreeEdge; tree: BehaviorTreeModel };
  nodedelete: { nodeId: string; node: BehaviorTreeNode | null; tree: BehaviorTreeModel };
  treechange: { tree: BehaviorTreeModel; reason: string };
  historychange: { canUndo: boolean; canRedo: boolean };
  connectioncancel: { port: NormalizedBehaviorTreePort };
  viewportchange: { x: number; y: number; scale: number };
  diagnostics: { diagnostics: BehaviorTreeDiagnostic[] };
};

export type BehaviorTreeCanvasOptions = {
  target: HTMLElement;
  tree?: BehaviorTreeModel;
  nodeTypes?: Record<string, BehaviorTreeNodeType>;
  width?: number;
  height?: number;
  background?: number | string;
  backgroundAlpha?: number;
  resizeTo?: HTMLElement | Window | false;
  readonly?: boolean;
  showGrid?: boolean;
  nodeWidth?: number;
  nodeHeight?: number;
  horizontalGap?: number;
  verticalGap?: number;
  minZoom?: number;
  maxZoom?: number;
  historyLimit?: number;
  theme?: Record<string, any>;
};

export function normalizeBehaviorTree(tree: BehaviorTreeModel | null | undefined, nodeTypes?: Record<string, BehaviorTreeNodeType>): NormalizedBehaviorTree;
export function layoutBehaviorTree(normalized: NormalizedBehaviorTree, options?: BehaviorTreeLayoutOptions): Map<string, BehaviorTreePoint>;
export function canConnect(
  normalized: NormalizedBehaviorTree,
  from: string | { nodeId?: string; portId?: string; id?: string },
  to: string | { nodeId?: string; portId?: string; id?: string }
): BehaviorTreeConnectResult;
export function canLinkChild(
  normalized: NormalizedBehaviorTree,
  parentId: string,
  childId: string
): { ok: boolean; reason?: string; parent?: BehaviorTreeNode; child?: BehaviorTreeNode };
export function canReparentChild(
  normalized: NormalizedBehaviorTree,
  parentId: string,
  childId: string
): { ok: boolean; reason?: string; parent?: BehaviorTreeNode; child?: BehaviorTreeNode; previousParentId?: string };
export function suggestNodeTypesForPort(
  normalized: NormalizedBehaviorTree,
  target: string | { nodeId?: string; portId?: string; id?: string }
): BehaviorTreeNodeTypeSuggestion[];
export function suggestNodeTypesForChild(
  normalized: NormalizedBehaviorTree,
  parentId: string
): BehaviorTreeChildNodeTypeSuggestion[];
export function validateBehaviorTree(
  tree: BehaviorTreeModel | NormalizedBehaviorTree | null | undefined,
  nodeTypes?: Record<string, BehaviorTreeNodeType>
): BehaviorTreeDiagnostic[];

export class BehaviorTreeCanvas {
  constructor(options: BehaviorTreeCanvasOptions);
  target: HTMLElement;
  tree: BehaviorTreeModel;
  nodeTypes: Record<string, BehaviorTreeNodeType>;
  theme: Record<string, any>;
  width: number;
  height: number;
  background: number | string;
  backgroundAlpha: number;
  resizeTo: HTMLElement | Window | false;
  readonly: boolean;
  showGrid: boolean;
  nodeWidth: number;
  nodeHeight: number;
  horizontalGap: number;
  verticalGap: number;
  minZoom: number;
  maxZoom: number;
  historyLimit: number;
  selectedNodeId: string;
  selectedEdgeId: string;
  mount(): Promise<this>;
  destroy(): void;
  on<K extends keyof BehaviorTreeCanvasEvents>(eventName: K, handler: (event: BehaviorTreeCanvasEvents[K]) => void): () => void;
  off<K extends keyof BehaviorTreeCanvasEvents>(eventName: K, handler: (event: BehaviorTreeCanvasEvents[K]) => void): void;
  setTree(tree: BehaviorTreeModel): void;
  getTree(): BehaviorTreeModel;
  toJSON(space?: number): string;
  loadTree(tree: BehaviorTreeModel, options?: { recordHistory?: boolean; clearHistory?: boolean; reason?: string }): BehaviorTreeModel;
  loadJSON(input: string | BehaviorTreeModel, options?: { recordHistory?: boolean; clearHistory?: boolean; reason?: string }): BehaviorTreeModel;
  editTree(mutator: (tree: BehaviorTreeModel) => void, reason?: string): void;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  clearHistory(): void;
  setExecutionFlow(flow?: { nodeIds?: string[]; edgeIds?: string[] } | string[]): void;
  clearExecutionFlow(): void;
  setNodeTypes(nodeTypes: Record<string, BehaviorTreeNodeType>): void;
  setTheme(theme: Record<string, any>): void;
  selectNode(nodeId: string): void;
  selectNodes(nodeIds: string[]): void;
  getSelectedNodeIds(): string[];
  toggleNodeSelection(nodeId: string): void;
  selectDataEdge(edgeId: string): void;
  selectChildEdge(edgeId: string): void;
  deleteSelection(): boolean;
  cancelConnection(): boolean;
  deleteNodes(nodeIds: string[]): boolean;
  removeDataEdge(edgeId: string): boolean;
  removeChildEdge(edgeId: string): boolean;
  deleteNode(nodeId: string): boolean;
  updateNode(nodeId: string, patch: Partial<BehaviorTreeNode>): BehaviorTreeNode | null;
  updateNodeParams(nodeId: string, paramsPatch: Record<string, any>): BehaviorTreeNode | null;
  createNode(node: BehaviorTreeNode): BehaviorTreeNode | null;
  createChildNode(parentId: string, node: BehaviorTreeNode, slot?: number): BehaviorTreeNode | null;
  linkChild(parentId: string, childId: string, slot?: number): boolean;
  reparentChild(parentId: string, childId: string, slot?: number): boolean;
  unlinkChild(parentId: string, childId: string): boolean;
  moveChild(parentId: string, childId: string, slot: number): boolean;
  moveChildRelative(parentId: string, childId: string, delta: number): boolean;
  canConnect(
    from: string | { nodeId?: string; portId?: string; id?: string },
    to: string | { nodeId?: string; portId?: string; id?: string }
  ): BehaviorTreeConnectResult;
  connectPorts(
    from: string | { nodeId?: string; portId?: string; id?: string },
    to: string | { nodeId?: string; portId?: string; id?: string }
  ): BehaviorTreeEdge | null;
  suggestNodeTypesForPort(target: string | { nodeId?: string; portId?: string; id?: string }): BehaviorTreeNodeTypeSuggestion[];
  suggestNodeTypesForChild(parentId: string): BehaviorTreeChildNodeTypeSuggestion[];
  render(): void;
  arrange(): void;
  fit(): void;
}
