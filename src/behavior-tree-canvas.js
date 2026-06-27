import { Application, Container, Graphics, Rectangle } from "pixi.js";
import { canConnect, canLinkChild, canReparentChild, normalizeBehaviorTree, suggestNodeTypesForChild, suggestNodeTypesForPort, validateBehaviorTree } from "./core.js";
import { drawExecutionPort, drawNodeBackground, drawPort } from "./drawing.js";
import { clamp, pointerClient } from "./geometry.js";
import { layoutBehaviorTree } from "./layout.js";
import { createNodeView, nodeVisualHeight } from "./node-view.js";
import { areSameDataType, createBehaviorTreeTheme, normalizeCategory, normalizeStatus, portColor, toColor } from "./theme.js";

/**
 * @import {
 *   BehaviorTreeModel,
 *   BehaviorTreeNode,
 *   BehaviorTreeNodeType,
 *   BehaviorTreePoint,
 *   BehaviorTreeEdge,
 *   NormalizedBehaviorTreePort,
 *   BehaviorTreeNodeTypeSuggestion,
 *   BehaviorTreeChildNodeTypeSuggestion,
 *   NormalizedBehaviorTree
 * } from './core.js'
 */

/**
 * @typedef {{
 *   target:HTMLElement,
 *   tree?:BehaviorTreeModel,
 *   nodeTypes?:Record<string, BehaviorTreeNodeType>,
 *   width?:number,
 *   height?:number,
 *   background?:number|string,
 *   backgroundAlpha?:number,
 *   resizeTo?:HTMLElement|Window|false,
 *   readonly?:boolean,
 *   showGrid?:boolean,
 *   nodeWidth?:number,
 *   nodeHeight?:number,
 *   horizontalGap?:number,
 *   verticalGap?:number,
 *   minZoom?:number,
 *   maxZoom?:number,
 *   historyLimit?:number,
 *   theme?:Record<string, any>
 * }} BehaviorTreeCanvasOptions
 * @typedef {{kind:'data', id:string, edge:BehaviorTreeEdge}} BehaviorTreeSelectedDataEdge
 * @typedef {{
 *   selectionchange:{nodeId:string,node:BehaviorTreeNode|null,nodeIds?:string[],nodes?:BehaviorTreeNode[],edgeId?:string,edge?:BehaviorTreeEdge|null},
 *   nodeclick:{nodeId:string,node:BehaviorTreeNode},
 *   edgeclick:{edgeId:string,edge:BehaviorTreeEdge},
 *   nodedrag:{nodeId:string,position:BehaviorTreePoint},
 *   nodesdrag:{nodeIds:string[],positions:Record<string, BehaviorTreePoint>},
 *   connectionstart:{port:NormalizedBehaviorTreePort,suggestions:BehaviorTreeNodeTypeSuggestion[]},
 *   connectionpreview:{port:NormalizedBehaviorTreePort,target:NormalizedBehaviorTreePort|null,ok:boolean,reason?:string},
 *   connectionrequest:{port:NormalizedBehaviorTreePort,world:BehaviorTreePoint,portWorld:BehaviorTreePoint,screen:BehaviorTreePoint,suggestions:BehaviorTreeNodeTypeSuggestion[]},
 *   portconnect:{edge:BehaviorTreeEdge,from:NormalizedBehaviorTreePort,to:NormalizedBehaviorTreePort,tree:BehaviorTreeModel},
 *   childconnectionstart:{nodeId:string,node:BehaviorTreeNode,portKind:'parent'|'child',suggestions:BehaviorTreeChildNodeTypeSuggestion[]},
 *   childconnectionrequest:{nodeId:string,node:BehaviorTreeNode,portKind:'parent'|'child',parentId?:string,childId?:string,world:BehaviorTreePoint,portWorld:BehaviorTreePoint,screen:BehaviorTreePoint,suggestions:BehaviorTreeChildNodeTypeSuggestion[]},
 *   childconnect:{edge:BehaviorTreeEdge,parentId:string,childId:string,tree:BehaviorTreeModel,reparent:boolean,previousParentId?:string},
 *   childconnectioncancel:{nodeId:string,node:BehaviorTreeNode|null,portKind:'parent'|'child'},
 *   nodechange:{nodeId:string,node:BehaviorTreeNode,previousNode:BehaviorTreeNode,tree:BehaviorTreeModel},
 *   edgedelete:{edgeId:string,edge:BehaviorTreeEdge,tree:BehaviorTreeModel},
 *   nodedelete:{nodeId:string,node:BehaviorTreeNode|null,tree:BehaviorTreeModel},
 *   treechange:{tree:BehaviorTreeModel,reason:string},
 *   historychange:{canUndo:boolean,canRedo:boolean},
 *   connectioncancel:{port:NormalizedBehaviorTreePort},
 *   viewportchange:{x:number,y:number,scale:number},
 *   diagnostics:{diagnostics:import('./core.js').BehaviorTreeDiagnostic[]}
 * }} BehaviorTreeCanvasEvents
 */

export class BehaviorTreeCanvas {
    /**
     * @param {BehaviorTreeCanvasOptions} options
     */
    constructor(options) {
        if (!options || typeof options !== "object") throw new TypeError("BehaviorTreeCanvas requires an options object");
        if (!options.target || typeof options.target !== "object") throw new TypeError("BehaviorTreeCanvas requires a target HTMLElement");
        if (Object.prototype.hasOwnProperty.call(options, "tree")) assertTreeModel(options.tree, "tree");
        if (Object.prototype.hasOwnProperty.call(options, "nodeTypes")) assertPlainObject(options.nodeTypes, "nodeTypes");
        if (Object.prototype.hasOwnProperty.call(options, "theme") && options.theme !== undefined) assertPlainObject(options.theme, "theme");
        if (Object.prototype.hasOwnProperty.call(options, "readonly")) assertBoolean(options.readonly, "readonly");
        if (Object.prototype.hasOwnProperty.call(options, "showGrid")) assertBoolean(options.showGrid, "showGrid");
        const width = options.width ?? 960;
        const height = options.height ?? 640;
        const nodeWidth = options.nodeWidth ?? 184;
        const nodeHeight = options.nodeHeight ?? 66;
        const horizontalGap = options.horizontalGap ?? 54;
        const verticalGap = options.verticalGap ?? 86;
        const minZoom = options.minZoom ?? 0.2;
        const maxZoom = options.maxZoom ?? 2.4;
        const historyLimit = options.historyLimit ?? 80;
        assertPositiveNumber(width, "width");
        assertPositiveNumber(height, "height");
        assertPositiveNumber(nodeWidth, "nodeWidth");
        assertPositiveNumber(nodeHeight, "nodeHeight");
        assertPositiveNumber(horizontalGap, "horizontalGap");
        assertPositiveNumber(verticalGap, "verticalGap");
        assertPositiveNumber(minZoom, "minZoom");
        assertPositiveNumber(maxZoom, "maxZoom");
        assertPositiveInteger(historyLimit, "historyLimit");
        if (maxZoom < minZoom) throw new RangeError("maxZoom must be greater than or equal to minZoom");
        this.target = options.target;
        this.tree = options.tree ? cloneTree(options.tree) : { rootId: "", nodes: [] };
        this.nodeTypes = options.nodeTypes ?? {};
        this.theme = createBehaviorTreeTheme(options.theme);
        this.width = width;
        this.height = height;
        this.background = options.background ?? toColor(this.theme.canvas.background, 0);
        this.backgroundAlpha = options.backgroundAlpha ?? this.theme.canvas.backgroundAlpha;
        this.resizeTo = options.resizeTo === false ? false : (options.resizeTo ?? options.target);
        this.readonly = options.readonly === true;
        this.showGrid = options.showGrid !== false;
        this.nodeWidth = nodeWidth;
        this.nodeHeight = nodeHeight;
        this.horizontalGap = horizontalGap;
        this.verticalGap = verticalGap;
        this.minZoom = minZoom;
        this.maxZoom = maxZoom;
        this.historyLimit = historyLimit;
    }

    /**
     * Create the Pixi application and render the current tree.
     * @returns {Promise<this>}
     */
    async mount() {
        if (this.app) return this;
        this.app = new Application();
        await this.app.init({
            width: this.width,
            height: this.height,
            antialias: true,
            autoDensity: true,
            resolution: window.devicePixelRatio || 1,
            resizeTo: this.resizeTo || undefined,
            background: this.background,
            backgroundAlpha: this.backgroundAlpha
        });
        this.app.canvas.tabIndex = 0;
        this.target.appendChild(this.app.canvas);
        this.app.stage.sortableChildren = true;
        this.#setupScene();
        this.#bindInput();
        this.#bindAnimations();
        this.render();
        this.#resizeObserver = new ResizeObserver(() => this.#resize());
        this.#resizeObserver.observe(this.target);
        this.#resize();
        return this;
    }

    destroy() {
        this.#unbindInput();
        this.#unbindAnimations();
        this.#resizeObserver?.disconnect();
        this.#resizeObserver = null;
        this.#clearScene();
        this.#listeners.clear();
        this.app?.destroy({ removeView: true }, { children: true, texture: false, textureSource: false, context: true });
        this.app = null;
    }

    /**
     * @template {keyof BehaviorTreeCanvasEvents} K
     * @param {K} eventName
     * @param {(event:BehaviorTreeCanvasEvents[K]) => void} handler
     * @returns {() => void}
     */
    on(eventName, handler) {
        const key = String(eventName);
        const list = this.#listeners.get(key) || new Set();
        list.add(/** @type {any} */ (handler));
        this.#listeners.set(key, list);
        return () => this.off(eventName, handler);
    }

    /**
     * @template {keyof BehaviorTreeCanvasEvents} K
     * @param {K} eventName
     * @param {(event:BehaviorTreeCanvasEvents[K]) => void} handler
     */
    off(eventName, handler) {
        this.#listeners.get(String(eventName))?.delete(/** @type {any} */ (handler));
    }

    /** @param {BehaviorTreeModel} tree */
    setTree(tree) {
        assertTreeModel(tree, "tree");
        this.tree = cloneTree(tree);
        this.#undoStack = [];
        this.#redoStack = [];
        this.selectedNodeId = "";
        this.selectedEdgeId = "";
        this.#selectedNodeIds.clear();
        this.#emitHistoryChange();
        this.render();
    }

    /** @returns {BehaviorTreeModel} */
    getTree() {
        return cloneTree(this.tree);
    }

    /** @param {number} [space] */
    toJSON(space = 2) {
        return JSON.stringify(this.getTree(), null, space);
    }

    /**
     * @param {BehaviorTreeModel} tree
     * @param {{recordHistory?:boolean, clearHistory?:boolean, reason?:string}} [options]
     */
    loadTree(tree, options = {}) {
        assertTreeModel(tree, "tree");
        assertPlainObject(options, "options");
        if (options.recordHistory) this.#recordHistory();
        this.tree = cloneTree(tree);
        this.selectedNodeId = "";
        this.selectedEdgeId = "";
        this.#selectedNodeIds.clear();
        if (options.clearHistory !== false && !options.recordHistory) {
            this.#undoStack = [];
            this.#redoStack = [];
        }
        this.render();
        this.#emit("treechange", { tree: this.tree, reason: options.reason ?? "load-tree" });
        this.#emitSelectionChange();
        this.#emitHistoryChange();
        return this.getTree();
    }

    /**
     * @param {string | BehaviorTreeModel} input
     * @param {{recordHistory?:boolean, clearHistory?:boolean, reason?:string}} [options]
     */
    loadJSON(input, options = {}) {
        const tree = typeof input === "string" ? JSON.parse(input) : input;
        return this.loadTree(tree, { reason: "load-json", ...options });
    }

    /**
     * @param {(tree:BehaviorTreeModel) => void} mutator
     * @param {string} [reason]
     */
    editTree(mutator, reason = "edit") {
        this.#recordHistory();
        mutator(this.tree);
        this.selectedEdgeId = "";
        this.render();
        this.#emit("treechange", { tree: this.tree, reason });
        this.#emitHistoryChange();
    }

    undo() {
        if (!this.#undoStack.length) return false;
        this.#redoStack.push(cloneTree(this.tree));
        this.tree = this.#undoStack.pop();
        this.selectedNodeId = "";
        this.selectedEdgeId = "";
        this.#selectedNodeIds.clear();
        this.render();
        this.#emit("treechange", { tree: this.tree, reason: "undo" });
        this.#emitHistoryChange();
        return true;
    }

    redo() {
        if (!this.#redoStack.length) return false;
        this.#undoStack.push(cloneTree(this.tree));
        this.tree = this.#redoStack.pop();
        this.selectedNodeId = "";
        this.selectedEdgeId = "";
        this.#selectedNodeIds.clear();
        this.render();
        this.#emit("treechange", { tree: this.tree, reason: "redo" });
        this.#emitHistoryChange();
        return true;
    }

    canUndo() {
        return this.#undoStack.length > 0;
    }

    canRedo() {
        return this.#redoStack.length > 0;
    }

    clearHistory() {
        this.#undoStack = [];
        this.#redoStack = [];
        this.#emitHistoryChange();
    }

    /**
     * @param {{nodeIds?:string[],edgeIds?:string[]} | string[]} flow
     */
    setExecutionFlow(flow = {}) {
        if (!Array.isArray(flow)) assertPlainObject(flow, "flow");
        const edgeIds = Array.isArray(flow) ? flow : (flow.edgeIds ?? []);
        const nodeIds = Array.isArray(flow) ? [] : (flow.nodeIds ?? []);
        assertArray(edgeIds, "flow.edgeIds");
        assertArray(nodeIds, "flow.nodeIds");
        this.#executionFlowEdgeIds = new Set(edgeIds.map(id => String(id || "")).filter(Boolean));
        this.#executionFlowNodeIds = new Set(nodeIds.map(id => String(id || "")).filter(Boolean));
        this.#redrawEdges();
    }

    clearExecutionFlow() {
        if (!this.#executionFlowEdgeIds.size && !this.#executionFlowNodeIds.size) return;
        this.#executionFlowEdgeIds.clear();
        this.#executionFlowNodeIds.clear();
        this.#redrawEdges();
    }

    /** @param {Record<string, BehaviorTreeNodeType>} nodeTypes */
    setNodeTypes(nodeTypes) {
        assertPlainObject(nodeTypes, "nodeTypes");
        this.nodeTypes = nodeTypes;
        this.render();
    }

    /** @param {Record<string, any>} theme */
    setTheme(theme) {
        assertPlainObject(theme, "theme");
        this.theme = createBehaviorTreeTheme(theme);
        this.background = toColor(this.theme.canvas.background, 0);
        this.backgroundAlpha = this.theme.canvas.backgroundAlpha;
        try {
            if (this.app?.renderer?.background) {
                this.app.renderer.background.color = this.background;
                this.app.renderer.background.alpha = this.backgroundAlpha;
            }
        } catch {
            // Pixi renderers differ in how they expose background mutation.
        }
        this.render();
    }

    /** @param {string} nodeId */
    selectNode(nodeId) {
        const id = String(nodeId || "");
        this.#setSelectedNodeIds(id ? [id] : []);
    }

    /** @param {string[]} nodeIds */
    selectNodes(nodeIds) {
        this.#setSelectedNodeIds(nodeIds);
    }

    /** @returns {string[]} */
    getSelectedNodeIds() {
        return [...this.#selectedNodeIds];
    }

    /** @param {string} nodeId */
    toggleNodeSelection(nodeId) {
        const id = String(nodeId || "");
        if (!id) return;
        const next = new Set(this.#selectedNodeIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        this.#setSelectedNodeIds([...next], id);
    }

    /** @param {string} edgeId */
    selectDataEdge(edgeId) {
        this.selectedEdgeId = String(edgeId || "");
        this.selectedNodeId = "";
        this.#selectedNodeIds.clear();
        this.#applySelection();
        this.#redrawEdges();
        this.#emitSelectionChange();
    }

    /** @param {string} edgeId */
    selectChildEdge(edgeId) {
        this.selectedEdgeId = String(edgeId || "");
        this.selectedNodeId = "";
        this.#selectedNodeIds.clear();
        this.#applySelection();
        this.#redrawEdges();
        this.#emitSelectionChange();
    }

    deleteSelection() {
        if (this.#selectedNodeIds.size) return this.deleteNodes([...this.#selectedNodeIds]);
        if (this.selectedEdgeId) {
            if (isChildEdgeId(this.selectedEdgeId)) return this.removeChildEdge(this.selectedEdgeId);
            return this.removeDataEdge(this.selectedEdgeId);
        }
        if (this.selectedNodeId) return this.deleteNode(this.selectedNodeId);
        return false;
    }

    cancelConnection() {
        const drag = this.#drag;
        if (!drag || (drag.kind !== "connect" && drag.kind !== "child-link")) return false;
        this.#drag = null;
        this.#compatiblePortIds.clear();
        this.#compatibleExecutionPortIds.clear();
        this.#clearConnectionPreview();
        this.#applyPortHighlights("", "");
        this.#applyExecutionPortHighlights("", "");
        this.#unbindWindowDrag();
        if (drag.kind === "connect") this.#emit("connectioncancel", { port: drag.port });
        else this.#emit("childconnectioncancel", {
            nodeId: drag.nodeId,
            node: this.#normalized?.nodesById.get(drag.nodeId) || null,
            portKind: drag.portKind
        });
        return true;
    }

    /** @param {string[]} nodeIds */
    deleteNodes(nodeIds) {
        const ids = [...new Set((nodeIds || []).map(id => String(id || "")).filter(Boolean))];
        if (!ids.length) return false;
        const nodes = ids.map(id => this.#normalized?.nodesById.get(id) || findTreeNode(this.tree, id)).filter(Boolean);
        if (!nodes.length) return false;
        this.#recordHistory();
        let changed = false;
        for (const id of ids) {
            if (!findTreeNode(this.tree, id)) continue;
            if (removeTreeNode(this.tree, id)) {
                this.#nodePositions.delete(id);
                this.#positions.delete(id);
                changed = true;
            }
        }
        if (!changed) return false;
        this.#clearSelectedNodes();
        this.selectedEdgeId = "";
        this.render();
        this.#emit("treechange", { tree: this.tree, reason: "delete-nodes" });
        this.#emitSelectionChange();
        return true;
    }

    /** @param {string} edgeId */
    removeDataEdge(edgeId) {
        const key = String(edgeId || "");
        const edges = Array.isArray(this.tree.edges) ? this.tree.edges : [];
        const index = edges.findIndex(edge => String(edge.kind || "") === "data" && dataEdgeId(edge) === key);
        if (index < 0) return false;
        this.#recordHistory();
        const [edge] = edges.splice(index, 1);
        if (this.selectedEdgeId === key) this.selectedEdgeId = "";
        this.render();
        this.#emit("edgedelete", { edgeId: key, edge, tree: this.tree });
        this.#emit("treechange", { tree: this.tree, reason: "delete-edge" });
        this.#emitSelectionChange();
        return true;
    }

    /** @param {string} edgeId */
    removeChildEdge(edgeId) {
        const key = String(edgeId || "");
        const parsed = parseChildEdgeId(key);
        if (!parsed) return false;
        const edge = this.#findTreeChildEdge(key);
        if (!edge) return false;
        this.#recordHistory();
        if (!removeTreeChildLink(this.tree, parsed.parentId, parsed.childId)) return false;
        if (this.selectedEdgeId === key) this.selectedEdgeId = "";
        this.render();
        this.#emit("edgedelete", { edgeId: key, edge, tree: this.tree });
        this.#emit("treechange", { tree: this.tree, reason: "delete-child-edge" });
        this.#emitSelectionChange();
        return true;
    }

    /** @param {string} nodeId */
    deleteNode(nodeId) {
        const id = String(nodeId || "");
        const node = this.#normalized?.nodesById.get(id) || findTreeNode(this.tree, id);
        if (!node) return false;
        this.#recordHistory();
        if (!removeTreeNode(this.tree, id)) return false;
        this.#nodePositions.delete(id);
        this.#positions.delete(id);
        this.#selectedNodeIds.delete(id);
        if (this.selectedNodeId === id) this.selectedNodeId = "";
        this.selectedEdgeId = "";
        this.render();
        this.#emit("nodedelete", { nodeId: id, node, tree: this.tree });
        this.#emit("treechange", { tree: this.tree, reason: "delete-node" });
        this.#emitSelectionChange();
        return true;
    }

    /**
     * @param {string} nodeId
     * @param {Partial<BehaviorTreeNode>} patch
     */
    updateNode(nodeId, patch) {
        const id = String(nodeId || "");
        const node = findTreeNode(this.tree, id);
        if (!node || !patch || typeof patch !== "object") return null;
        const previousNode = cloneTree(node);
        const next = { ...patch, id };
        delete next.children;
        this.#recordHistory();
        Object.assign(node, next);
        if (node.position) this.#nodePositions.set(id, { ...node.position });
        this.selectedNodeId = id;
        this.selectedEdgeId = "";
        this.#selectedNodeIds = new Set([id]);
        this.render();
        const changedNode = this.#normalized?.nodesById.get(id) || node;
        this.#emit("nodechange", { nodeId: id, node: changedNode, previousNode, tree: this.tree });
        this.#emit("treechange", { tree: this.tree, reason: "update-node" });
        this.#emitSelectionChange();
        return changedNode;
    }

    /**
     * @param {string} nodeId
     * @param {Record<string, any>} paramsPatch
     */
    updateNodeParams(nodeId, paramsPatch) {
        const id = String(nodeId || "");
        const node = findTreeNode(this.tree, id);
        if (!node || !paramsPatch || typeof paramsPatch !== "object") return null;
        return this.updateNode(id, { params: { ...(node.params || {}), ...paramsPatch } });
    }

    /** @param {BehaviorTreeNode} node */
    createNode(node) {
        const nextNode = normalizeCreatedNode(node);
        if (!nextNode.id || findTreeNode(this.tree, nextNode.id)) return null;
        this.#recordHistory();
        if (!addTreeNode(this.tree, nextNode)) return null;
        this.selectedNodeId = nextNode.id;
        this.selectedEdgeId = "";
        this.#selectedNodeIds = new Set([nextNode.id]);
        if (nextNode.position) this.#nodePositions.set(nextNode.id, { ...nextNode.position });
        this.render();
        this.#emit("treechange", { tree: this.tree, reason: "create-node" });
        this.#emitSelectionChange();
        return nextNode;
    }

    /**
     * @param {string} parentId
     * @param {BehaviorTreeNode} node
     * @param {number} [slot]
     */
    createChildNode(parentId, node, slot) {
        if (!this.#normalized) this.#normalized = normalizeBehaviorTree(this.tree, this.nodeTypes);
        const parent = this.#normalized.nodesById.get(String(parentId || ""));
        if (!parent || !suggestNodeTypesForChild(this.#normalized, parent.id).some(item => item.typeId === node.type)) return null;
        const nextNode = normalizeCreatedNode(node);
        if (!nextNode.id || findTreeNode(this.tree, nextNode.id)) return null;
        this.#recordHistory();
        if (!addTreeNode(this.tree, nextNode)) return null;
        addTreeChildLink(this.tree, parent.id, nextNode.id, slot);
        this.selectedNodeId = nextNode.id;
        this.selectedEdgeId = "";
        this.#selectedNodeIds = new Set([nextNode.id]);
        if (nextNode.position) this.#nodePositions.set(nextNode.id, { ...nextNode.position });
        this.render();
        const edge = this.#findTreeChildEdge(childEdgeId(parent.id, nextNode.id)) || {
            id: childEdgeId(parent.id, nextNode.id),
            kind: "child",
            parentId: parent.id,
            childId: nextNode.id,
            fromNodeId: parent.id,
            toNodeId: nextNode.id
        };
        this.#emit("childconnect", { edge, parentId: parent.id, childId: nextNode.id, tree: this.tree, reparent: false });
        this.#emit("treechange", { tree: this.tree, reason: "create-child-node" });
        this.#emitSelectionChange();
        return nextNode;
    }

    /**
     * @param {string} parentId
     * @param {string} childId
     * @param {number} [slot]
     */
    linkChild(parentId, childId, slot) {
        if (!this.#normalized) this.#normalized = normalizeBehaviorTree(this.tree, this.nodeTypes);
        const check = canLinkChild(this.#normalized, parentId, childId);
        if (!check.ok) return false;
        this.#recordHistory();
        addTreeChildLink(this.tree, String(parentId), String(childId), slot);
        this.selectedNodeId = String(childId);
        this.selectedEdgeId = "";
        this.#selectedNodeIds = new Set([String(childId)]);
        this.render();
        const edge = this.#findTreeChildEdge(childEdgeId(String(parentId), String(childId))) || {
            id: childEdgeId(String(parentId), String(childId)),
            kind: "child",
            parentId: String(parentId),
            childId: String(childId),
            fromNodeId: String(parentId),
            toNodeId: String(childId)
        };
        this.#emit("childconnect", { edge, parentId: String(parentId), childId: String(childId), tree: this.tree, reparent: false });
        this.#emit("treechange", { tree: this.tree, reason: "link-child" });
        this.#emitSelectionChange();
        return true;
    }

    /**
     * @param {string} parentId
     * @param {string} childId
     * @param {number} [slot]
     */
    reparentChild(parentId, childId, slot) {
        if (!this.#normalized) this.#normalized = normalizeBehaviorTree(this.tree, this.nodeTypes);
        const check = canReparentChild(this.#normalized, parentId, childId);
        if (!check.ok || !check.previousParentId) return false;
        this.#recordHistory();
        removeTreeChildLink(this.tree, check.previousParentId, String(childId));
        addTreeChildLink(this.tree, String(parentId), String(childId), slot);
        const edgeId = childEdgeId(String(parentId), String(childId));
        this.selectedNodeId = "";
        this.selectedEdgeId = edgeId;
        this.#selectedNodeIds.clear();
        this.render();
        const edge = this.#findTreeChildEdge(edgeId) || {
            id: edgeId,
            kind: "child",
            parentId: String(parentId),
            childId: String(childId),
            fromNodeId: String(parentId),
            toNodeId: String(childId)
        };
        this.#emit("childconnect", { edge, parentId: String(parentId), childId: String(childId), tree: this.tree, reparent: true, previousParentId: check.previousParentId });
        this.#emit("treechange", { tree: this.tree, reason: "reparent-child" });
        this.#emitSelectionChange();
        return true;
    }

    /**
     * @param {string} parentId
     * @param {string} childId
     */
    unlinkChild(parentId, childId) {
        return this.removeChildEdge(childEdgeId(String(parentId || ""), String(childId || "")));
    }

    /**
     * @param {string} parentId
     * @param {string} childId
     * @param {number} slot
     */
    moveChild(parentId, childId, slot) {
        if (!this.#normalized) this.#normalized = normalizeBehaviorTree(this.tree, this.nodeTypes);
        const parent = String(parentId || "");
        const child = String(childId || "");
        const order = this.#normalized.childrenById.get(parent) || [];
        const currentIndex = order.indexOf(child);
        if (currentIndex < 0) return false;
        const targetIndex = clampChildSlot(slot, order.length);
        if (targetIndex === currentIndex) return false;
        this.#recordHistory();
        if (!moveTreeChild(this.tree, parent, child, targetIndex, order)) return false;
        const edgeId = childEdgeId(parent, child);
        this.selectedNodeId = "";
        this.selectedEdgeId = edgeId;
        this.#selectedNodeIds.clear();
        this.render();
        const edge = this.#findTreeChildEdge(edgeId);
        this.#emit("treechange", { tree: this.tree, reason: "move-child" });
        this.#emitSelectionChange();
        return true;
    }

    /**
     * @param {string} parentId
     * @param {string} childId
     * @param {number} delta
     */
    moveChildRelative(parentId, childId, delta) {
        if (!this.#normalized) this.#normalized = normalizeBehaviorTree(this.tree, this.nodeTypes);
        const order = this.#normalized.childrenById.get(String(parentId || "")) || [];
        const index = order.indexOf(String(childId || ""));
        if (index < 0) return false;
        return this.moveChild(parentId, childId, index + Number(delta || 0));
    }

    /**
     * @param {string | {nodeId?:string, portId?:string, id?:string}} from
     * @param {string | {nodeId?:string, portId?:string, id?:string}} to
     */
    canConnect(from, to) {
        if (!this.#normalized) this.#normalized = normalizeBehaviorTree(this.tree, this.nodeTypes);
        return canConnect(this.#normalized, from, to);
    }

    /** @param {string | {nodeId?:string, portId?:string, id?:string}} target */
    suggestNodeTypesForPort(target) {
        if (!this.#normalized) this.#normalized = normalizeBehaviorTree(this.tree, this.nodeTypes);
        return suggestNodeTypesForPort(this.#normalized, target);
    }

    /** @param {string} parentId */
    suggestNodeTypesForChild(parentId) {
        if (!this.#normalized) this.#normalized = normalizeBehaviorTree(this.tree, this.nodeTypes);
        return suggestNodeTypesForChild(this.#normalized, parentId);
    }

    /**
     * @param {string | {nodeId?:string, portId?:string, id?:string}} a
     * @param {string | {nodeId?:string, portId?:string, id?:string}} b
     * @returns {BehaviorTreeEdge | null}
     */
    connectPorts(a, b) {
        if (!this.#normalized) this.#normalized = normalizeBehaviorTree(this.tree, this.nodeTypes);
        const source = this.#resolvePort(a);
        const target = this.#resolvePort(b);
        if (!source || !target) return null;
        const connection = this.#connectionForPorts(source, target);
        if (!connection.ok || !connection.from || !connection.to) return null;
        if (!this.#hasDataEdge(connection.from, connection.to)) this.#recordHistory();
        const edge = this.#appendDataEdge(connection.from, connection.to);
        this.render();
        this.#emit("portconnect", { edge, from: connection.from, to: connection.to, tree: this.tree });
        this.#emit("treechange", { tree: this.tree, reason: "connect-ports" });
        return edge;
    }

    render() {
        this.#normalized = normalizeBehaviorTree(this.tree, this.nodeTypes);
        this.#diagnostics = validateBehaviorTree(this.#normalized);
        this.#diagnosticsByNodeId = diagnosticsByNodeId(this.#diagnostics);
        this.#positions = layoutBehaviorTree(this.#normalized, {
            nodeWidth: this.nodeWidth,
            nodeHeight: this.nodeHeight,
            horizontalGap: this.horizontalGap,
            verticalGap: this.verticalGap,
            preservePositions: !this.#forceArrange,
            center: this.#forceArrange ? true : undefined,
            existingPositions: this.#nodePositions
        });

        for (const [nodeId, point] of this.#positions) {
            if (!this.#nodePositions.has(nodeId)) this.#nodePositions.set(nodeId, { ...point });
        }

        if (!this.app) {
            this.#emit("diagnostics", { diagnostics: [...this.#diagnostics] });
            return;
        }

        this.#edgeLayer.removeChildren().forEach(child => child.destroy({ children: true }));
        this.#nodeLayer.removeChildren().forEach(child => child.destroy({ children: true }));
        this.#entranceAnimations.clear();
        this.#runningNodeBackgrounds.clear();
        this.#runningEdgeViews.clear();
        this.#flowEdgeViews.clear();
        this.#nodeViews.clear();
        this.#portAnchors.clear();
        this.#portViews.clear();
        this.#executionAnchors.clear();
        this.#executionPortViews.clear();
        this.#drawGrid();
        this.#drawEdges();
        this.#drawNodes();
        this.#drawDataEdges();
        this.#applySelection();
        this.#knownNodeIds = new Set(this.#normalized.nodes.map(node => node.id));
        this.#hasRenderedScene = true;

        if (!this.#hasFitted && this.#positions.size) {
            this.#hasFitted = true;
            queueMicrotask(() => this.fit());
        }
        this.#emit("diagnostics", { diagnostics: [...this.#diagnostics] });
    }

    /** Recompute the automatic layout and forget positions moved in this view. */
    arrange() {
        this.#nodePositions.clear();
        this.#hasFitted = false;
        this.#forceArrange = true;
        this.render();
        this.#forceArrange = false;
    }

    fit() {
        if (!this.app || !this.#positions.size) return;
        const bounds = this.#treeBounds();
        const screen = this.app.screen;
        const margin = 120;
        const scaleX = screen.width / Math.max(1, bounds.width + margin);
        const scaleY = screen.height / Math.max(1, bounds.height + margin);
        const scale = clamp(Math.min(scaleX, scaleY), this.minZoom, this.maxZoom);
        this.#viewport.scale.set(scale);
        this.#viewport.position.set(
            (screen.width / 2) - ((bounds.x + bounds.width / 2) * scale),
            (screen.height / 2) - ((bounds.y + bounds.height / 2) * scale)
        );
        this.#emitViewportChange();
    }

    #setupScene() {
        if (!this.app) return;
        this.#viewport.sortableChildren = true;
        this.#gridLayer.label = "grid";
        this.#gridLayer.zIndex = 0;
        this.#edgeLayer.label = "edges";
        this.#edgeLayer.zIndex = 10;
        this.#nodeLayer.label = "nodes";
        this.#nodeLayer.zIndex = 20;
        this.#overlayLayer.label = "overlay";
        this.#overlayLayer.zIndex = 30;
        this.#overlayLayer.addChild(this.#selectionBox);
        this.#overlayLayer.addChild(this.#connectionPreview);
        this.#viewport.addChild(this.#gridLayer, this.#edgeLayer, this.#nodeLayer, this.#overlayLayer);
        this.app.stage.addChild(this.#viewport);
    }

    #clearScene() {
        this.#gridLayer.removeChildren().forEach(child => child.destroy({ children: true }));
        this.#edgeLayer.removeChildren().forEach(child => child.destroy({ children: true }));
        this.#nodeLayer.removeChildren().forEach(child => child.destroy({ children: true }));
        this.#overlayLayer.removeChildren().forEach(child => child.destroy({ children: true }));
        this.#viewport.removeFromParent();
        this.#nodeViews.clear();
        this.#portViews.clear();
        this.#portAnchors.clear();
        this.#executionPortViews.clear();
        this.#executionAnchors.clear();
        this.#compatiblePortIds.clear();
        this.#compatibleExecutionPortIds.clear();
        this.#selectionBox.clear();
        this.#diagnostics = [];
        this.#diagnosticsByNodeId.clear();
        this.#normalized = null;
    }

    #drawGrid() {
        const theme = this.theme.canvas.grid;
        this.#gridLayer.clear();
        if (!this.showGrid) return;
        const span = theme.span;
        const minor = theme.minorStep;
        const major = minor * theme.majorEvery;
        for (let x = -span; x <= span; x += minor) {
            const isMajor = x % major === 0;
            this.#gridLayer.moveTo(x, -span);
            this.#gridLayer.lineTo(x, span);
            this.#gridLayer.stroke({
                width: isMajor ? theme.majorWidth : theme.minorWidth,
                color: toColor(isMajor ? theme.majorColor : theme.minorColor, 0),
                alpha: isMajor ? theme.majorAlpha : theme.minorAlpha
            });
        }
        for (let y = -span; y <= span; y += minor) {
            const isMajor = y % major === 0;
            this.#gridLayer.moveTo(-span, y);
            this.#gridLayer.lineTo(span, y);
            this.#gridLayer.stroke({
                width: isMajor ? theme.majorWidth : theme.minorWidth,
                color: toColor(isMajor ? theme.majorColor : theme.minorColor, 0),
                alpha: isMajor ? theme.majorAlpha : theme.minorAlpha
            });
        }
    }

    #drawEdges() {
        if (!this.#normalized) return;
        for (const [parentId, children] of this.#normalized.childrenById) {
            for (const childId of children) this.#drawEdge(parentId, childId);
        }
    }

    /**
     * @param {string} parentId
     * @param {string} childId
     */
    #drawEdge(parentId, childId) {
        const theme = this.theme.canvas.childEdge;
        const parent = this.#positions.get(parentId);
        const child = this.#positions.get(childId);
        if (!parent || !child) return;
        const childNode = this.#normalized?.nodesById.get(childId);
        const status = normalizeStatus(childNode?.status);
        const color = status === "idle" ? toColor(theme.idleColor, 0) : toColor(this.theme.statusColor[status], 0);
        const edge = new Graphics();
        const edgeId = childEdgeId(parentId, childId);
        const selected = edgeId === this.selectedEdgeId;
        const y1 = parent.y + (this.#nodeHeightForNodeId(parentId) / 2);
        const y2 = child.y - (this.#nodeHeightForNodeId(childId) / 2);
        const midY = y1 + ((y2 - y1) * 0.5);
        const path = {
            x1: parent.x,
            y1,
            c1x: parent.x,
            c1y: midY,
            c2x: child.x,
            c2y: midY,
            x2: child.x,
            y2
        };
        const flowing = this.#isExecutionFlowEdge(parentId, childId, status);
        edge.moveTo(parent.x, y1);
        edge.bezierCurveTo(parent.x, midY, child.x, midY, child.x, y2);
        edge.stroke({
            width: selected ? theme.selectedHitWidth : theme.hitWidth,
            color: toColor(theme.hitColor, 0),
            alpha: theme.hitAlpha
        });
        edge.moveTo(parent.x, y1);
        edge.bezierCurveTo(parent.x, midY, child.x, midY, child.x, y2);
        edge.stroke({
            width: selected ? theme.selectedWidth : status === "running" ? theme.runningWidth : theme.width,
            color: selected ? toColor(theme.selectedColor, 0) : color,
            alpha: selected ? theme.selectedAlpha : status === "idle" ? theme.idleAlpha : theme.alpha
        });
        if ((status === "running" || flowing) && !selected) this.#runningEdgeViews.add(edge);
        edge.eventMode = "static";
        edge.cursor = this.readonly ? "default" : "pointer";
        edge.on("pointertap", event => this.#handleChildEdgeTap(event, parentId, childId));
        this.#edgeLayer.addChild(edge);
        if (flowing && !selected) this.#drawExecutionFlowEdge(path, color);
    }

    #drawDataEdges() {
        const theme = this.theme.canvas.dataEdge;
        if (!this.#normalized) return;
        for (const edge of this.#normalized.dataEdges) {
            const from = this.#portAnchors.get(`${edge.fromNodeId}:${edge.fromPortId}`);
            const to = this.#portAnchors.get(`${edge.toNodeId}:${edge.toPortId}`);
            if (!from || !to) continue;
            const fromNode = this.#positions.get(edge.fromNodeId);
            const toNode = this.#positions.get(edge.toNodeId);
            if (!fromNode || !toNode) continue;

            const x1 = fromNode.x + from.x;
            const y1 = fromNode.y + from.y;
            const x2 = toNode.x + to.x;
            const y2 = toNode.y + to.y;
            const dx = Math.max(theme.curveMinDx, Math.abs(x2 - x1) * theme.curveFactor);
            const edgeId = dataEdgeId(edge);
            const selected = edgeId === this.selectedEdgeId;
            const link = new Graphics();
            link.moveTo(x1, y1);
            link.bezierCurveTo(x1 + dx, y1, x2 - dx, y2, x2, y2);
            link.stroke({
                width: selected ? theme.selectedHitWidth : theme.hitWidth,
                color: toColor(theme.hitColor, 0),
                alpha: theme.hitAlpha
            });
            link.moveTo(x1, y1);
            link.bezierCurveTo(x1 + dx, y1, x2 - dx, y2, x2, y2);
            link.stroke({
                width: selected ? theme.selectedWidth : theme.width,
                color: selected ? toColor(theme.selectedColor, 0) : areSameDataType(from.dataType, to.dataType) ? toColor(theme.compatibleColor, 0) : toColor(theme.incompatibleColor, 0),
                alpha: selected ? theme.selectedAlpha : theme.alpha
            });
            link.circle(x2, y2, theme.endpointRadius);
            link.fill({
                color: selected ? toColor(theme.selectedColor, 0) : toColor(portColor(to.dataType), 0),
                alpha: selected ? theme.selectedAlpha : theme.endpointAlpha
            });
            link.eventMode = "static";
            link.cursor = this.readonly ? "default" : "pointer";
            link.on("pointertap", event => this.#handleDataEdgeTap(event, edge));
            this.#edgeLayer.addChild(link);
        }
    }

    /**
     * @param {{x1:number,y1:number,c1x:number,c1y:number,c2x:number,c2y:number,x2:number,y2:number}} path
     * @param {number} fallbackColor
     */
    #drawExecutionFlowEdge(path, fallbackColor) {
        const animation = this.theme.canvas.animation || {};
        if (!animation.enabled || !animation.executionFlow) return;
        const view = new Graphics();
        view.eventMode = "none";
        this.#edgeLayer.addChild(view);
        this.#flowEdgeViews.add({
            view,
            path,
            color: toColor(animation.flowColor, fallbackColor),
            alpha: Number(animation.flowAlpha ?? 0.92),
            radius: Number(animation.flowParticleRadius ?? 3.2)
        });
    }

    #drawNodes() {
        if (!this.#normalized) return;
        for (const node of this.#normalized.nodes) {
            const point = this.#positions.get(node.id);
            if (!point) continue;
            const created = createNodeView({
                node,
                type: this.#nodeType(node),
                ports: this.#normalized.portsByNodeId.get(node.id),
                selectedNodeId: this.selectedNodeId,
                selectedNodeIds: this.#selectedNodeIds,
                readonly: this.readonly,
                nodeWidth: this.nodeWidth,
                nodeHeight: this.nodeHeight,
                canHaveChildren: this.#canNodeHaveChildren(node),
                canReceiveParent: this.#canNodeReceiveParent(node),
                childCapacity: this.#nodeChildCapacity(node),
                childOrder: this.#childOrderForNode(node.id),
                validationSeverity: this.#diagnosticsByNodeId.get(node.id) || "",
                theme: this.theme,
                onNodePointerDown: (event, targetNode) => this.#handleNodePointerDown(event, targetNode),
                onNodeTap: (event, targetNode) => this.#handleNodeTap(event, targetNode),
                onPortPointerDown: (event, port) => this.#handlePortPointerDown(event, port),
                onExecutionPortPointerDown: (event, targetNode, kind) => this.#handleExecutionPortPointerDown(event, targetNode, kind)
            });
            const view = created.view;
            view.position.set(point.x, point.y);
            this.#prepareNodeAnimation(node, view);
            this.#nodeViews.set(node.id, view);
            for (const [portId, anchor] of created.portAnchors) this.#portAnchors.set(portId, anchor);
            for (const [portId, portView] of created.portViews) this.#portViews.set(portId, portView);
            for (const [portId, anchor] of created.executionAnchors) this.#executionAnchors.set(portId, anchor);
            for (const [portId, portView] of created.executionViews) this.#executionPortViews.set(portId, portView);
            this.#nodeLayer.addChild(view);
        }
    }

    #applySelection() {
        if (!this.#normalized) return;
        for (const [nodeId, view] of this.#nodeViews) {
            const node = this.#normalized.nodesById.get(nodeId);
            const bg = view.children[0];
            if (!(bg instanceof Graphics) || !node) continue;
            const type = this.#nodeType(node);
            const category = normalizeCategory(node.category || type.category);
            const status = normalizeStatus(node.status);
            drawNodeBackground(bg, {
                width: this.nodeWidth,
                height: this.#nodeVisualHeight(node),
                accent: toColor(type.color, this.theme.categoryColor[category]),
                statusColor: this.theme.statusColor[status],
                selected: this.#selectedNodeIds.has(nodeId) || nodeId === this.selectedNodeId,
                disabled: status === "disabled",
                validationSeverity: this.#diagnosticsByNodeId.get(nodeId) || ""
            }, this.theme.drawing);
        }
    }

    /** @param {string[]} nodeIds @param {string} [primaryNodeId] */
    #setSelectedNodeIds(nodeIds, primaryNodeId = "") {
        if (!this.#normalized) this.#normalized = normalizeBehaviorTree(this.tree, this.nodeTypes);
        const ids = [...new Set((nodeIds || []).map(id => String(id || "")).filter(id => this.#normalized?.nodesById.has(id) || findTreeNode(this.tree, id)))];
        this.#selectedNodeIds = new Set(ids);
        this.selectedNodeId = primaryNodeId && this.#selectedNodeIds.has(primaryNodeId) ? primaryNodeId : (ids[ids.length - 1] || "");
        this.selectedEdgeId = "";
        this.#applySelection();
        this.#redrawEdges();
        this.#emitSelectionChange();
    }

    #clearSelectedNodes() {
        this.#selectedNodeIds.clear();
        this.selectedNodeId = "";
    }

    #clearSelection() {
        this.#clearSelectedNodes();
        this.selectedEdgeId = "";
        this.#applySelection();
        this.#redrawEdges();
        this.#emitSelectionChange();
    }

    #emitSelectionChange() {
        const nodeIds = [...this.#selectedNodeIds];
        const nodes = nodeIds.map(id => this.#normalized?.nodesById.get(id) || findTreeNode(this.tree, id)).filter(Boolean);
        const node = this.selectedNodeId ? (this.#normalized?.nodesById.get(this.selectedNodeId) || findTreeNode(this.tree, this.selectedNodeId)) : null;
        const edge = this.selectedEdgeId ? (isChildEdgeId(this.selectedEdgeId) ? this.#findTreeChildEdge(this.selectedEdgeId) : this.#findTreeDataEdge(this.selectedEdgeId)) : null;
        this.#emit("selectionchange", {
            nodeId: this.selectedNodeId,
            node,
            nodeIds,
            nodes,
            edgeId: this.selectedEdgeId,
            edge
        });
    }

    /** @param {BehaviorTreeNode} node */
    #selectNode(node) {
        if (this.selectedNodeId === node.id && this.#selectedNodeIds.size === 1) return;
        this.#setSelectedNodeIds([node.id], node.id);
    }

    /**
     * @param {any} event
     * @param {BehaviorTreeEdge} edge
     */
    #handleDataEdgeTap(event, edge) {
        event.stopPropagation?.();
        this.#focusCanvas();
        const edgeId = dataEdgeId(edge);
        this.selectedNodeId = "";
        this.selectedEdgeId = edgeId;
        this.#selectedNodeIds.clear();
        this.#applySelection();
        this.#redrawEdges();
        this.#emit("edgeclick", { edgeId, edge });
        this.#emitSelectionChange();
    }

    /**
     * @param {any} event
     * @param {string} parentId
     * @param {string} childId
     */
    #handleChildEdgeTap(event, parentId, childId) {
        event.stopPropagation?.();
        this.#focusCanvas();
        const edgeId = childEdgeId(parentId, childId);
        const edge = this.#findTreeChildEdge(edgeId);
        if (!edge) return;
        this.selectedNodeId = "";
        this.selectedEdgeId = edgeId;
        this.#selectedNodeIds.clear();
        this.#applySelection();
        this.#redrawEdges();
        this.#emit("edgeclick", { edgeId, edge });
        this.#emitSelectionChange();
    }

    /**
     * @param {any} event
     * @param {NormalizedBehaviorTreePort} port
     */
    #handlePortPointerDown(event, port) {
        event.stopPropagation?.();
        this.#focusCanvas();
        if (this.readonly || !this.app || !this.#normalized) return;
        const pointer = pointerClient(event, this.app.canvas);
        const world = this.#clientToWorld(pointer.clientX, pointer.clientY);
        const anchor = this.#worldPortAnchor(port.fullId);
        const suggestions = suggestNodeTypesForPort(this.#normalized, port.fullId);
        this.#drag = {
            kind: "connect",
            pointerId: pointer.pointerId,
            port,
            startWorldX: anchor?.x ?? world.x,
            startWorldY: anchor?.y ?? world.y,
            currentWorldX: world.x,
            currentWorldY: world.y,
            hoverPortId: ""
        };
        this.#compatiblePortIds = this.#compatiblePortsFor(port);
        this.#applyPortHighlights(port.fullId, "");
        this.#drawConnectionPreview();
        this.#emit("connectionstart", { port, suggestions });
        this.#bindWindowDrag();
    }

    /**
     * @param {any} event
     * @param {BehaviorTreeNode} node
     * @param {'parent'|'child'} kind
     */
    #handleExecutionPortPointerDown(event, node, kind) {
        event.stopPropagation?.();
        this.#focusCanvas();
        if (this.readonly || !this.app || !this.#normalized) return;
        if (kind === "child" && this.#nodeChildCapacity(node)?.hasCapacity === false) return;
        const pointer = pointerClient(event, this.app.canvas);
        const world = this.#clientToWorld(pointer.clientX, pointer.clientY);
        const key = `${node.id}:${kind}`;
        const anchor = this.#worldExecutionAnchor(key);
        this.#drag = {
            kind: "child-link",
            pointerId: pointer.pointerId,
            nodeId: node.id,
            portKind: kind,
            startWorldX: anchor?.x ?? world.x,
            startWorldY: anchor?.y ?? world.y,
            currentWorldX: world.x,
            currentWorldY: world.y,
            hoverPortId: ""
        };
        this.#compatibleExecutionPortIds = this.#compatibleExecutionPortsFor(node.id, kind);
        this.#applyExecutionPortHighlights(key, "");
        this.#drawConnectionPreview();
        this.#emit("childconnectionstart", {
            nodeId: node.id,
            node,
            portKind: kind,
            suggestions: kind === "child" ? suggestNodeTypesForChild(this.#normalized, node.id) : []
        });
        this.#bindWindowDrag();
    }

    /**
     * @param {any} event
     * @param {BehaviorTreeNode} node
     */
    #handleNodePointerDown(event, node) {
        event.stopPropagation?.();
        this.#focusCanvas();
        const modifier = hasSelectionModifier(event);
        if (modifier) {
            this.toggleNodeSelection(node.id);
            return;
        }
        if (!this.#selectedNodeIds.has(node.id)) this.#selectNode(node);
        if (this.readonly || !this.app) return;
        const pointer = pointerClient(event, this.app.canvas);
        const world = this.#clientToWorld(pointer.clientX, pointer.clientY);
        const nodeIds = this.#selectedNodeIds.has(node.id) ? [...this.#selectedNodeIds] : [node.id];
        const startPositions = new Map();
        for (const nodeId of nodeIds) startPositions.set(nodeId, this.#positions.get(nodeId) || { x: 0, y: 0 });
        const current = startPositions.get(node.id) || { x: 0, y: 0 };
        this.#drag = {
            kind: "node",
            nodeId: node.id,
            nodeIds,
            startPositions,
            pointerId: pointer.pointerId,
            startClientX: pointer.clientX,
            startClientY: pointer.clientY,
            startWorldX: world.x,
            startWorldY: world.y,
            startX: current.x,
            startY: current.y
        };
        this.#bindWindowDrag();
    }

    /**
     * @param {any} event
     * @param {BehaviorTreeNode} node
     */
    #handleNodeTap(event, node) {
        event.stopPropagation?.();
        if (this.#drag?.kind === "node" && this.#drag.moved) {
            this.#suppressNodeTapUntil = performance.now() + 250;
            return;
        }
        if (performance.now() <= this.#suppressNodeTapUntil) return;
        if (hasSelectionModifier(event)) return;
        this.#selectNode(node);
        this.#emit("nodeclick", { nodeId: node.id, node });
    }

    /** @param {any} event */
    #handleStagePointerDown = (event) => {
        if (!this.app) return;
        this.#focusCanvas();
        const pointer = pointerClient(event, this.app.canvas);
        const world = this.#clientToWorld(pointer.clientX, pointer.clientY);
        if (hasSelectionModifier(event)) {
            this.selectedEdgeId = "";
            this.#drag = {
                kind: "marquee",
                pointerId: pointer.pointerId,
                startWorldX: world.x,
                startWorldY: world.y,
                currentWorldX: world.x,
                currentWorldY: world.y,
                baseSelection: new Set(this.#selectedNodeIds)
            };
            this.#drawSelectionBox();
            this.#bindWindowDrag();
            return;
        }
        if (this.selectedNodeId || this.selectedEdgeId || this.#selectedNodeIds.size) {
            this.#clearSelection();
        }
        this.#drag = {
            kind: "pan",
            pointerId: pointer.pointerId,
            startClientX: pointer.clientX,
            startClientY: pointer.clientY,
            startX: this.#viewport.x,
            startY: this.#viewport.y
        };
        this.#bindWindowDrag();
    };

    /** @param {WheelEvent} event */
    #handleWheel = (event) => {
        if (!this.app) return;
        event.preventDefault();
        const rect = this.app.canvas.getBoundingClientRect();
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;
        const before = this.#screenToWorld(screenX, screenY);
        const nextScale = clamp(this.#viewport.scale.x * Math.exp(-event.deltaY * 0.001), this.minZoom, this.maxZoom);
        this.#viewport.scale.set(nextScale);
        this.#viewport.position.set(screenX - (before.x * nextScale), screenY - (before.y * nextScale));
        this.#emitViewportChange();
    };

    /** @param {PointerEvent} event */
    #handleWindowPointerMove = (event) => {
        const drag = this.#drag;
        if (!drag || (drag.pointerId != null && event.pointerId !== drag.pointerId)) return;
        if (drag.kind === "pan") {
            this.#viewport.position.set(
                drag.startX + (event.clientX - drag.startClientX),
                drag.startY + (event.clientY - drag.startClientY)
            );
            this.#emitViewportChange();
            return;
        }

        if (drag.kind === "connect") {
            const world = this.#clientToWorld(event.clientX, event.clientY);
            const target = this.#findPortAtWorld(world, drag.port.fullId);
            drag.currentWorldX = world.x;
            drag.currentWorldY = world.y;
            drag.hoverPortId = target?.fullId || "";
            this.#applyPortHighlights(drag.port.fullId, drag.hoverPortId);
            this.#drawConnectionPreview();
            const check = target ? this.#connectionForPorts(drag.port, target) : { ok: false };
            this.#emit("connectionpreview", { port: drag.port, target, ok: check.ok, reason: check.reason });
            return;
        }

        if (drag.kind === "child-link") {
            const world = this.#clientToWorld(event.clientX, event.clientY);
            const target = this.#findExecutionPortAtWorld(world, `${drag.nodeId}:${drag.portKind}`);
            drag.currentWorldX = world.x;
            drag.currentWorldY = world.y;
            drag.hoverPortId = target?.key || "";
            this.#applyExecutionPortHighlights(`${drag.nodeId}:${drag.portKind}`, drag.hoverPortId);
            this.#drawConnectionPreview();
            return;
        }

        if (drag.kind === "marquee") {
            const world = this.#clientToWorld(event.clientX, event.clientY);
            drag.currentWorldX = world.x;
            drag.currentWorldY = world.y;
            const ids = new Set(drag.baseSelection || []);
            for (const nodeId of this.#nodeIdsInRect(drag.startWorldX, drag.startWorldY, drag.currentWorldX, drag.currentWorldY)) ids.add(nodeId);
            this.#selectedNodeIds = ids;
            this.selectedNodeId = [...ids].at(-1) || "";
            this.selectedEdgeId = "";
            this.#applySelection();
            this.#drawSelectionBox();
            return;
        }

        const world = this.#clientToWorld(event.clientX, event.clientY);
        if (Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY) > 3) drag.moved = true;
        const delta = {
            x: world.x - drag.startWorldX,
            y: world.y - drag.startWorldY
        };
        const draggedPositions = {};
        for (const nodeId of drag.nodeIds || [drag.nodeId]) {
            const start = drag.startPositions?.get(nodeId) || { x: drag.startX, y: drag.startY };
            const point = { x: start.x + delta.x, y: start.y + delta.y };
            this.#positions.set(nodeId, point);
            this.#nodePositions.set(nodeId, point);
            this.#nodeViews.get(nodeId)?.position.set(point.x, point.y);
            draggedPositions[nodeId] = point;
            this.#emit("nodedrag", { nodeId, position: point });
        }
        this.#redrawEdges();
        if ((drag.nodeIds || []).length > 1) this.#emit("nodesdrag", { nodeIds: drag.nodeIds, positions: draggedPositions });
    };

    /** @param {PointerEvent} event */
    #handleWindowPointerUp = (event) => {
        const drag = this.#drag;
        if (drag?.pointerId != null && event.pointerId !== drag.pointerId) return;
        if (drag?.kind === "connect") {
            this.#finishConnectionDrag(event, drag);
            return;
        }
        if (drag?.kind === "child-link") {
            this.#finishChildLinkDrag(event, drag);
            return;
        }
        if (drag?.kind === "marquee") {
            this.#selectionBox.clear();
            this.#drag = null;
            this.#unbindWindowDrag();
            this.#emitSelectionChange();
            return;
        }
        if (drag?.kind === "node" && drag.moved) this.#suppressNodeTapUntil = performance.now() + 250;
        this.#drag = null;
        this.#unbindWindowDrag();
    };

    #bindInput() {
        if (!this.app) return;
        this.app.stage.eventMode = "static";
        this.app.stage.on("pointerdown", this.#handleStagePointerDown);
        this.app.canvas.addEventListener("wheel", this.#handleWheel, { passive: false });
    }

    #unbindInput() {
        this.#unbindWindowDrag();
        this.app?.stage?.off?.("pointerdown", this.#handleStagePointerDown);
        this.app?.canvas?.removeEventListener?.("wheel", this.#handleWheel);
    }

    #bindAnimations() {
        this.app?.ticker?.add?.(this.#tickAnimations);
    }

    #unbindAnimations() {
        this.app?.ticker?.remove?.(this.#tickAnimations);
    }

    /**
     * @param {string} parentId
     * @param {string} childId
     * @param {string} status
     */
    #isExecutionFlowEdge(parentId, childId, status) {
        const explicitFlow = this.#executionFlowEdgeIds.size > 0 || this.#executionFlowNodeIds.size > 0;
        if (this.#executionFlowEdgeIds.has(childEdgeId(parentId, childId))) return true;
        if (this.#executionFlowNodeIds.has(childId)) return true;
        return !explicitFlow && status === "running";
    }

    /** @param {BehaviorTreeNode} node @param {Container} view */
    #prepareNodeAnimation(node, view) {
        const animation = this.theme.canvas.animation || {};
        const status = normalizeStatus(node.status);
        const bg = view.children[0];
        if (bg instanceof Graphics && status === "running") this.#runningNodeBackgrounds.set(node.id, bg);
        if (!animation.enabled) return;
        const shouldEnter = animation.enterOnMount || this.#hasRenderedScene;
        if (!shouldEnter || this.#knownNodeIds.has(node.id)) return;
        const scale = Number(animation.enterScale ?? 0.96);
        view.alpha = 0;
        view.scale.set(scale);
        this.#entranceAnimations.set(node.id, {
            view,
            elapsedMs: 0,
            durationMs: Math.max(1, Number(animation.enterDurationMs ?? 160)),
            startScale: scale
        });
    }

    #tickAnimations = (ticker) => {
        const animation = this.theme.canvas.animation || {};
        if (!animation.enabled) return;
        const deltaMS = Number(ticker?.deltaMS ?? 16.67);

        for (const [nodeId, item] of this.#entranceAnimations) {
            item.elapsedMs += deltaMS;
            const progress = clamp(item.elapsedMs / item.durationMs, 0, 1);
            const eased = 1 - ((1 - progress) ** 3);
            item.view.alpha = eased;
            item.view.scale.set(item.startScale + ((1 - item.startScale) * eased));
            if (progress >= 1) {
                item.view.alpha = 1;
                item.view.scale.set(1);
                this.#entranceAnimations.delete(nodeId);
            }
        }

        this.#animationTimeMs += deltaMS;
        if (animation.runningPulse) {
            const duration = Math.max(1, Number(animation.pulseDurationMs ?? 1100));
            const wave = (Math.sin((this.#animationTimeMs / duration) * Math.PI * 2) + 1) / 2;
            const nodeAlpha = lerp(Number(animation.runningNodeMinAlpha ?? 0.9), Number(animation.runningNodeMaxAlpha ?? 1), wave);
            const edgeAlpha = lerp(Number(animation.runningEdgeMinAlpha ?? 0.78), Number(animation.runningEdgeMaxAlpha ?? 1), wave);
            for (const bg of this.#runningNodeBackgrounds.values()) bg.alpha = nodeAlpha;
            for (const edge of this.#runningEdgeViews) edge.alpha = edgeAlpha;
        }

        if (!animation.executionFlow) return;
        const flowDuration = Math.max(1, Number(animation.flowDurationMs ?? 900));
        const flowPhase = (this.#animationTimeMs % flowDuration) / flowDuration;
        const trailSteps = Math.max(1, Math.trunc(Number(animation.flowTrailSteps ?? 7)));
        const trailLength = Math.max(0, Math.min(0.95, Number(animation.flowTrailLength ?? 0.2)));
        for (const item of this.#flowEdgeViews) {
            item.view.clear();
            for (let index = trailSteps - 1; index >= 0; index -= 1) {
                const trailOffset = trailSteps <= 1 ? 0 : (trailLength * (index / (trailSteps - 1)));
                const t = (flowPhase - trailOffset + 1) % 1;
                const point = cubicBezierPoint(item.path, t);
                const alpha = item.alpha * (1 - (index / (trailSteps + 1)));
                const radius = item.radius * (1 - (index / ((trailSteps + 1) * 1.8)));
                item.view.circle(point.x, point.y, radius);
                item.view.fill({ color: item.color, alpha });
            }
        }
    };

    #focusCanvas() {
        this.app?.canvas?.focus?.({ preventScroll: true });
    }

    #bindWindowDrag() {
        window.addEventListener("pointermove", this.#handleWindowPointerMove);
        window.addEventListener("pointerup", this.#handleWindowPointerUp);
        window.addEventListener("pointercancel", this.#handleWindowPointerUp);
    }

    #unbindWindowDrag() {
        window.removeEventListener("pointermove", this.#handleWindowPointerMove);
        window.removeEventListener("pointerup", this.#handleWindowPointerUp);
        window.removeEventListener("pointercancel", this.#handleWindowPointerUp);
    }

    #redrawEdges() {
        this.#edgeLayer.removeChildren().forEach(child => child.destroy({ children: true }));
        this.#runningEdgeViews.clear();
        this.#flowEdgeViews.clear();
        this.#drawEdges();
        this.#drawDataEdges();
        this.#drawConnectionPreview();
    }

    /**
     * @param {PointerEvent} event
     * @param {{kind:"connect", pointerId?:number, port:NormalizedBehaviorTreePort, startWorldX:number, startWorldY:number, currentWorldX:number, currentWorldY:number, hoverPortId:string}} drag
     */
    #finishConnectionDrag(event, drag) {
        if (!this.app || !this.#normalized) return;
        const world = this.#clientToWorld(event.clientX, event.clientY);
        const screen = { x: event.clientX, y: event.clientY };
        const target = this.#findPortAtWorld(world, drag.port.fullId);
        const connection = target ? this.#connectionForPorts(drag.port, target) : { ok: false };

        this.#drag = null;
        this.#compatiblePortIds.clear();
        this.#clearConnectionPreview();
        this.#applyPortHighlights("", "");
        this.#unbindWindowDrag();

        if (connection.ok && connection.from && connection.to) {
            if (!this.#hasDataEdge(connection.from, connection.to)) this.#recordHistory();
            const edge = this.#appendDataEdge(connection.from, connection.to);
            this.render();
            this.#emit("portconnect", { edge, from: connection.from, to: connection.to, tree: this.tree });
            this.#emit("treechange", { tree: this.tree, reason: "connect-ports" });
            return;
        }

        if (!target) {
            const portWorld = this.#worldPortAnchor(drag.port.fullId) || { x: drag.startWorldX, y: drag.startWorldY };
            this.#emit("connectionrequest", {
                port: drag.port,
                world,
                portWorld,
                screen,
                suggestions: suggestNodeTypesForPort(this.#normalized, drag.port.fullId)
            });
            return;
        }

        this.#emit("connectioncancel", { port: drag.port });
    }

    /**
     * @param {PointerEvent} event
     * @param {{kind:"child-link", pointerId?:number, nodeId:string, portKind:'parent'|'child', startWorldX:number, startWorldY:number, currentWorldX:number, currentWorldY:number, hoverPortId:string}} drag
     */
    #finishChildLinkDrag(event, drag) {
        if (!this.app || !this.#normalized) return;
        const world = this.#clientToWorld(event.clientX, event.clientY);
        const target = this.#findExecutionPortAtWorld(world, `${drag.nodeId}:${drag.portKind}`);
        const sourceKey = `${drag.nodeId}:${drag.portKind}`;
        const check = target ? this.#childConnectionForExecutionPorts(sourceKey, target.key) : { ok: false };

        this.#drag = null;
        this.#compatibleExecutionPortIds.clear();
        this.#clearConnectionPreview();
        this.#applyExecutionPortHighlights("", "");
        this.#unbindWindowDrag();

        if (check.ok && check.parentId && check.childId) {
            if (check.reparent) this.reparentChild(check.parentId, check.childId);
            else this.linkChild(check.parentId, check.childId);
            return;
        }

        if (!target && drag.portKind === "child") {
            const node = this.#normalized.nodesById.get(drag.nodeId);
            const portWorld = this.#worldExecutionAnchor(sourceKey) || { x: drag.startWorldX, y: drag.startWorldY };
            if (!node) return;
            this.#emit("childconnectionrequest", {
                nodeId: drag.nodeId,
                node,
                portKind: drag.portKind,
                parentId: drag.nodeId,
                world,
                portWorld,
                screen: { x: event.clientX, y: event.clientY },
                suggestions: suggestNodeTypesForChild(this.#normalized, drag.nodeId)
            });
        }
    }

    #drawConnectionPreview() {
        const theme = this.theme.canvas.connectionPreview;
        this.#connectionPreview.clear();
        const drag = this.#drag;
        if (!drag || (drag.kind !== "connect" && drag.kind !== "child-link")) return;
        const isChildLink = drag.kind === "child-link";
        const sourceKey = isChildLink ? `${drag.nodeId}:${drag.portKind}` : drag.port.fullId;
        const start = isChildLink ? this.#worldExecutionAnchor(sourceKey) || { x: drag.startWorldX, y: drag.startWorldY } : this.#worldPortAnchor(sourceKey) || { x: drag.startWorldX, y: drag.startWorldY };
        const end = drag.hoverPortId
            ? (isChildLink ? this.#worldExecutionAnchor(drag.hoverPortId) : this.#worldPortAnchor(drag.hoverPortId))
            : { x: drag.currentWorldX, y: drag.currentWorldY };
        if (!end) return;
        const target = drag.hoverPortId ? (isChildLink ? this.#executionAnchors.get(drag.hoverPortId) : this.#resolvePort(drag.hoverPortId)) : null;
        const check = isChildLink
            ? (target ? this.#childConnectionForExecutionPorts(sourceKey, drag.hoverPortId) : { ok: false })
            : (target ? this.#connectionForPorts(drag.port, /** @type {NormalizedBehaviorTreePort} */ (target)) : { ok: false });
        const color = target ? (check.ok ? toColor(theme.validColor, 0) : toColor(theme.invalidColor, 0)) : toColor(theme.emptyColor, 0);
        const dx = Math.max(theme.curveMinDx, Math.abs(end.x - start.x) * theme.curveFactor);
        this.#connectionPreview.moveTo(start.x, start.y);
        this.#connectionPreview.bezierCurveTo(start.x + dx, start.y, end.x - dx, end.y, end.x, end.y);
        this.#connectionPreview.stroke({ width: theme.width, color, alpha: target ? theme.targetAlpha : theme.emptyAlpha });
    }

    #clearConnectionPreview() {
        this.#connectionPreview.clear();
    }

    #drawSelectionBox() {
        this.#selectionBox.clear();
        const drag = this.#drag;
        if (!drag || drag.kind !== "marquee") return;
        const theme = this.theme.canvas.selectionBox;
        const x = Math.min(drag.startWorldX, drag.currentWorldX);
        const y = Math.min(drag.startWorldY, drag.currentWorldY);
        const width = Math.abs(drag.currentWorldX - drag.startWorldX);
        const height = Math.abs(drag.currentWorldY - drag.startWorldY);
        this.#selectionBox.rect(x, y, width, height);
        this.#selectionBox.fill({ color: toColor(theme.fill, 0), alpha: theme.fillAlpha });
        this.#selectionBox.stroke({ width: theme.strokeWidth / Math.max(0.25, this.#viewport.scale.x || 1), color: toColor(theme.stroke, 0), alpha: theme.strokeAlpha });
    }

    /**
     * @param {number} x1
     * @param {number} y1
     * @param {number} x2
     * @param {number} y2
     */
    #nodeIdsInRect(x1, y1, x2, y2) {
        const left = Math.min(x1, x2);
        const right = Math.max(x1, x2);
        const top = Math.min(y1, y2);
        const bottom = Math.max(y1, y2);
        const ids = [];
        for (const [nodeId, point] of this.#positions) {
            const halfWidth = this.nodeWidth / 2;
            const halfHeight = this.#nodeHeightForNodeId(nodeId) / 2;
            const nodeLeft = point.x - halfWidth;
            const nodeRight = point.x + halfWidth;
            const nodeTop = point.y - halfHeight;
            const nodeBottom = point.y + halfHeight;
            if (nodeRight >= left && nodeLeft <= right && nodeBottom >= top && nodeTop <= bottom) ids.push(nodeId);
        }
        return ids;
    }

    #resize() {
        if (!this.app) return;
        this.app.stage.hitArea = new Rectangle(0, 0, this.app.screen.width, this.app.screen.height);
        this.#drawGrid();
        if (!this.#hasFitted && this.#positions.size) this.fit();
    }

    /**
     * @param {number} clientX
     * @param {number} clientY
     * @returns {BehaviorTreePoint}
     */
    #clientToWorld(clientX, clientY) {
        if (!this.app) return { x: 0, y: 0 };
        const rect = this.app.canvas.getBoundingClientRect();
        return this.#screenToWorld(clientX - rect.left, clientY - rect.top);
    }

    /**
     * @param {number} screenX
     * @param {number} screenY
     * @returns {BehaviorTreePoint}
     */
    #screenToWorld(screenX, screenY) {
        const scale = this.#viewport.scale.x || 1;
        return {
            x: (screenX - this.#viewport.x) / scale,
            y: (screenY - this.#viewport.y) / scale
        };
    }

    #emitViewportChange() {
        this.#emit("viewportchange", {
            x: this.#viewport.x,
            y: this.#viewport.y,
            scale: this.#viewport.scale.x
        });
    }

    #treeBounds() {
        const padX = this.nodeWidth / 2;
        const padY = this.nodeHeight / 2;
        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;
        for (const [nodeId, point] of this.#positions) {
            const nodePadY = Math.max(padY, this.#nodeHeightForNodeId(nodeId) / 2);
            minX = Math.min(minX, point.x - padX);
            maxX = Math.max(maxX, point.x + padX);
            minY = Math.min(minY, point.y - nodePadY);
            maxY = Math.max(maxY, point.y + nodePadY);
        }
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    /** @param {BehaviorTreeNode} node */
    #nodeType(node) {
        return this.#normalized?.nodeTypes[node.type || ""] || {};
    }

    /** @param {BehaviorTreeNode} node */
    #canNodeHaveChildren(node) {
        const type = this.#nodeType(node);
        if (String(node.category || type.category || "").toLowerCase() === "operation") return false;
        const max = type.maxChildren == null ? Number.POSITIVE_INFINITY : Number(type.maxChildren);
        return max !== 0;
    }

    /** @param {BehaviorTreeNode} node */
    #nodeChildCapacity(node) {
        if (!this.#canNodeHaveChildren(node)) return null;
        const type = this.#nodeType(node);
        const rawMax = type.maxChildren == null ? Number.POSITIVE_INFINITY : Number(type.maxChildren);
        const max = Number.isFinite(rawMax) ? Math.max(0, rawMax) : Number.POSITIVE_INFINITY;
        const count = (this.#normalized?.childrenById.get(node.id) || []).length;
        const hasCapacity = !Number.isFinite(max) || count < max;
        let label = "";
        if (Number.isFinite(max)) label = `${count}/${max}`;
        else if (count > 0) label = `${count}+`;
        else label = "0+";
        return { count, max, hasCapacity, label };
    }

    /** @param {string} nodeId */
    #childOrderForNode(nodeId) {
        const parentId = this.#normalized?.parentById.get(nodeId);
        if (!parentId) return null;
        const siblings = this.#normalized?.childrenById.get(parentId) || [];
        const index = siblings.indexOf(nodeId);
        return index >= 0 ? index + 1 : null;
    }

    /** @param {BehaviorTreeNode} node */
    #canNodeReceiveParent(node) {
        const type = this.#nodeType(node);
        if (String(node.category || type.category || "").toLowerCase() === "operation") return false;
        return node.id !== this.#normalized?.rootId;
    }

    /** @param {string} nodeId */
    #nodeHeightForNodeId(nodeId) {
        const node = this.#normalized?.nodesById.get(nodeId);
        return node ? this.#nodeVisualHeight(node) : this.nodeHeight;
    }

    /** @param {BehaviorTreeNode} node */
    #nodeVisualHeight(node) {
        const ports = this.#normalized?.portsByNodeId.get(node.id);
        return nodeVisualHeight(this.nodeHeight, ports);
    }

    /**
     * @param {string | {nodeId?:string, portId?:string, id?:string}} ref
     * @returns {NormalizedBehaviorTreePort | null}
     */
    #resolvePort(ref) {
        if (!this.#normalized) return null;
        if (typeof ref === "string") return this.#normalized.portsById.get(ref) || this.#normalized.portsById.get(ref.replace(".", ":")) || null;
        if (ref && typeof ref === "object") {
            if (ref.id && this.#normalized.portsById.has(ref.id)) return this.#normalized.portsById.get(ref.id) || null;
            const nodeId = String(ref.nodeId || "");
            const portId = String(ref.portId || ref.id || "");
            if (nodeId && portId) return this.#normalized.portsById.get(`${nodeId}:${portId}`) || null;
        }
        return null;
    }

    /**
     * @param {NormalizedBehaviorTreePort} a
     * @param {NormalizedBehaviorTreePort} b
     */
    #connectionForPorts(a, b) {
        if (!this.#normalized) return { ok: false, reason: "tree is not normalized" };
        if (a.fullId === b.fullId) return { ok: false, reason: "same port" };
        const from = a.direction === "output" ? a : b;
        const to = a.direction === "output" ? b : a;
        return canConnect(this.#normalized, from.fullId, to.fullId);
    }

    /** @param {NormalizedBehaviorTreePort} source */
    #compatiblePortsFor(source) {
        const result = new Set();
        if (!this.#normalized) return result;
        const seen = new Set();
        for (const port of this.#normalized.portsById.values()) {
            if (seen.has(port.fullId)) continue;
            seen.add(port.fullId);
            if (this.#connectionForPorts(source, port).ok) result.add(port.fullId);
        }
        return result;
    }

    /**
     * @param {NormalizedBehaviorTreePort} from
     * @param {NormalizedBehaviorTreePort} to
     * @returns {BehaviorTreeEdge}
     */
    #appendDataEdge(from, to) {
        const edges = Array.isArray(this.tree.edges) ? this.tree.edges : [];
        this.tree.edges = edges;
        const existing = edges.find(edge =>
            String(edge.kind || "") === "data" &&
            edge.fromNodeId === from.nodeId &&
            edge.fromPortId === from.id &&
            edge.toNodeId === to.nodeId &&
            edge.toPortId === to.id
        );
        if (existing) return existing;
        const edge = {
            id: `data:${from.nodeId}.${from.id}->${to.nodeId}.${to.id}`,
            kind: "data",
            fromNodeId: from.nodeId,
            fromPortId: from.id,
            toNodeId: to.nodeId,
            toPortId: to.id
        };
        edges.push(edge);
        return edge;
    }

    /**
     * @param {NormalizedBehaviorTreePort} from
     * @param {NormalizedBehaviorTreePort} to
     */
    #hasDataEdge(from, to) {
        const edges = Array.isArray(this.tree.edges) ? this.tree.edges : [];
        return edges.some(edge =>
            String(edge.kind || "") === "data" &&
            edge.fromNodeId === from.nodeId &&
            edge.fromPortId === from.id &&
            edge.toNodeId === to.nodeId &&
            edge.toPortId === to.id
        );
    }

    /** @param {string} edgeId */
    #findTreeDataEdge(edgeId) {
        const key = String(edgeId || "");
        return (this.tree.edges || []).find(edge => String(edge.kind || "") === "data" && dataEdgeId(edge) === key) || null;
    }

    /** @param {string} edgeId */
    #findTreeChildEdge(edgeId) {
        const parsed = parseChildEdgeId(edgeId);
        if (!parsed) return null;
        const explicit = (this.tree.edges || []).find(edge =>
            String(edge.kind || "child") === "child" &&
            String(edge.parentId ?? edge.fromNodeId ?? edge.from ?? "") === parsed.parentId &&
            String(edge.childId ?? edge.toNodeId ?? edge.to ?? "") === parsed.childId
        );
        if (explicit) return explicit;
        const children = this.#normalized?.childrenById.get(parsed.parentId) || [];
        if (!children.includes(parsed.childId)) return null;
        return {
            id: edgeId,
            kind: "child",
            parentId: parsed.parentId,
            childId: parsed.childId,
            fromNodeId: parsed.parentId,
            toNodeId: parsed.childId
        };
    }

    /**
     * @param {string} portId
     * @returns {BehaviorTreePoint | null}
     */
    #worldPortAnchor(portId) {
        const anchor = this.#portAnchors.get(portId);
        if (!anchor) return null;
        const nodePosition = this.#positions.get(anchor.nodeId);
        if (!nodePosition) return null;
        return { x: nodePosition.x + anchor.x, y: nodePosition.y + anchor.y };
    }

    /**
     * @param {string} key
     * @returns {BehaviorTreePoint | null}
     */
    #worldExecutionAnchor(key) {
        const anchor = this.#executionAnchors.get(key);
        if (!anchor) return null;
        const nodePosition = this.#positions.get(anchor.nodeId);
        if (!nodePosition) return null;
        return { x: nodePosition.x + anchor.x, y: nodePosition.y + anchor.y };
    }

    /**
     * @param {BehaviorTreePoint} world
     * @param {string} excludePortId
     * @returns {NormalizedBehaviorTreePort | null}
     */
    #findPortAtWorld(world, excludePortId) {
        if (!this.#normalized) return null;
        const tolerance = 14 / Math.max(0.25, this.#viewport.scale.x || 1);
        let best = null;
        let bestDistance = Number.POSITIVE_INFINITY;
        const seen = new Set();
        for (const [portId, anchor] of this.#portAnchors) {
            if (seen.has(anchor.fullId) || anchor.fullId === excludePortId) continue;
            seen.add(anchor.fullId);
            const nodePosition = this.#positions.get(anchor.nodeId);
            if (!nodePosition) continue;
            const dx = (nodePosition.x + anchor.x) - world.x;
            const dy = (nodePosition.y + anchor.y) - world.y;
            const distance = Math.hypot(dx, dy);
            if (distance <= tolerance && distance < bestDistance) {
                bestDistance = distance;
                best = this.#normalized.portsById.get(portId) || this.#normalized.portsById.get(anchor.fullId) || null;
            }
        }
        return best;
    }

    /**
     * @param {BehaviorTreePoint} world
     * @param {string} excludeKey
     * @returns {{key:string,nodeId:string,kind:'parent'|'child'} | null}
     */
    #findExecutionPortAtWorld(world, excludeKey) {
        const tolerance = 14 / Math.max(0.25, this.#viewport.scale.x || 1);
        let best = null;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const [key, anchor] of this.#executionAnchors) {
            if (key === excludeKey) continue;
            const nodePosition = this.#positions.get(anchor.nodeId);
            if (!nodePosition) continue;
            const dx = (nodePosition.x + anchor.x) - world.x;
            const dy = (nodePosition.y + anchor.y) - world.y;
            const distance = Math.hypot(dx, dy);
            if (distance <= tolerance && distance < bestDistance) {
                bestDistance = distance;
                best = { key, nodeId: anchor.nodeId, kind: anchor.kind };
            }
        }
        return best;
    }

    /**
     * @param {string} sourcePortId
     * @param {string} hoverPortId
     */
    #applyPortHighlights(sourcePortId, hoverPortId) {
        if (!this.#normalized) return;
        for (const [portId, view] of this.#portViews) {
            const port = this.#normalized.portsById.get(portId);
            if (!port) continue;
            let state = "normal";
            if (port.fullId === sourcePortId) state = "source";
            else if (port.fullId === hoverPortId) state = this.#compatiblePortIds.has(port.fullId) ? "hover" : "invalid";
            else if (this.#compatiblePortIds.has(port.fullId)) state = "compatible";
            drawPort(view, port, /** @type {any} */ (state), this.theme.drawing);
        }
    }

    /**
     * @param {string} sourceKey
     * @param {string} hoverKey
     */
    #applyExecutionPortHighlights(sourceKey, hoverKey) {
        for (const [key, view] of this.#executionPortViews) {
            const anchor = this.#executionAnchors.get(key);
            if (!anchor) continue;
            let state = anchor.state || "normal";
            if (key === sourceKey) state = "source";
            else if (key === hoverKey) state = this.#compatibleExecutionPortIds.has(key) ? "hover" : "invalid";
            else if (this.#compatibleExecutionPortIds.has(key)) state = "compatible";
            drawExecutionPort(view, anchor.kind, /** @type {any} */ (state), this.theme.drawing);
        }
    }

    /**
     * @param {string} nodeId
     * @param {'parent'|'child'} kind
     */
    #compatibleExecutionPortsFor(nodeId, kind) {
        const result = new Set();
        for (const [key, anchor] of this.#executionAnchors) {
            if (anchor.nodeId === nodeId || anchor.kind === kind) continue;
            if (this.#childConnectionForExecutionPorts(`${nodeId}:${kind}`, key).ok) result.add(key);
        }
        return result;
    }

    /**
     * @param {string} sourceKey
     * @param {string} targetKey
     * @returns {{ok:boolean,reason?:string,parentId?:string,childId?:string,reparent?:boolean}}
     */
    #childConnectionForExecutionPorts(sourceKey, targetKey) {
        if (!this.#normalized) return { ok: false, reason: "tree is not normalized" };
        const source = this.#executionAnchors.get(sourceKey);
        const target = this.#executionAnchors.get(targetKey);
        if (!source || !target) return { ok: false, reason: "missing execution port" };
        if (source.kind === target.kind) return { ok: false, reason: "execution ports have same direction" };
        const parentId = source.kind === "child" ? source.nodeId : target.nodeId;
        const childId = source.kind === "child" ? target.nodeId : source.nodeId;
        const existingParent = this.#normalized.parentById.get(childId);
        const check = existingParent && existingParent !== parentId
            ? canReparentChild(this.#normalized, parentId, childId)
            : canLinkChild(this.#normalized, parentId, childId);
        return check.ok ? { ok: true, parentId, childId, reparent: existingParent && existingParent !== parentId } : { ok: false, reason: check.reason, parentId, childId };
    }

    /**
     * @template {keyof BehaviorTreeCanvasEvents} K
     * @param {K} eventName
     * @param {BehaviorTreeCanvasEvents[K]} detail
     */
    #emit(eventName, detail) {
        for (const handler of this.#listeners.get(String(eventName)) || []) handler(detail);
    }

    #recordHistory() {
        this.#undoStack.push(cloneTree(this.tree));
        if (this.#undoStack.length > this.historyLimit) this.#undoStack.shift();
        this.#redoStack = [];
        this.#emitHistoryChange();
    }

    #emitHistoryChange() {
        this.#emit("historychange", { canUndo: this.canUndo(), canRedo: this.canRedo() });
    }

    /** @type {HTMLElement} */
    target;
    /** @type {Application | null} */
    app = null;
    /** @type {BehaviorTreeModel} */
    tree;
    /** @type {Record<string, BehaviorTreeNodeType>} */
    nodeTypes;
    /** @type {Record<string, any>} */
    theme;
    width;
    height;
    background;
    backgroundAlpha;
    /** @type {HTMLElement|Window|false} */
    resizeTo;
    readonly;
    showGrid;
    nodeWidth;
    nodeHeight;
    horizontalGap;
    verticalGap;
    minZoom;
    maxZoom;
    historyLimit;
    selectedNodeId = "";
    selectedEdgeId = "";
    /** @type {Set<string>} */
    #selectedNodeIds = new Set();
    #suppressNodeTapUntil = 0;

    /** @type {Container} */
    #viewport = new Container();
    /** @type {Graphics} */
    #gridLayer = new Graphics();
    /** @type {Container} */
    #edgeLayer = new Container();
    /** @type {Container} */
    #nodeLayer = new Container();
    /** @type {Container} */
    #overlayLayer = new Container();
    /** @type {Graphics} */
    #connectionPreview = new Graphics();
    /** @type {Graphics} */
    #selectionBox = new Graphics();
    /** @type {Map<string, Container>} */
    #nodeViews = new Map();
    /** @type {Set<string>} */
    #knownNodeIds = new Set();
    #hasRenderedScene = false;
    #animationTimeMs = 0;
    /** @type {Map<string, {view:Container,elapsedMs:number,durationMs:number,startScale:number}>} */
    #entranceAnimations = new Map();
    /** @type {Map<string, Graphics>} */
    #runningNodeBackgrounds = new Map();
    /** @type {Set<Graphics>} */
    #runningEdgeViews = new Set();
    /** @type {Set<{view:Graphics,path:{x1:number,y1:number,c1x:number,c1y:number,c2x:number,c2y:number,x2:number,y2:number},color:number,alpha:number,radius:number}>} */
    #flowEdgeViews = new Set();
    /** @type {Set<string>} */
    #executionFlowNodeIds = new Set();
    /** @type {Set<string>} */
    #executionFlowEdgeIds = new Set();
    /** @type {Map<string, Graphics>} */
    #portViews = new Map();
    /** @type {Map<string, {x:number,y:number,direction:'input'|'output',dataType:string,nodeId:string,portId:string,fullId:string}>} */
    #portAnchors = new Map();
    /** @type {Map<string, Graphics>} */
    #executionPortViews = new Map();
    /** @type {Map<string, {x:number,y:number,kind:'parent'|'child',nodeId:string,state?:'normal'|'available'|'full'}>} */
    #executionAnchors = new Map();
    /** @type {Map<string, BehaviorTreePoint>} */
    #positions = new Map();
    /** @type {Map<string, BehaviorTreePoint>} */
    #nodePositions = new Map();
    /** @type {NormalizedBehaviorTree | null} */
    #normalized = null;
    /** @type {import('./core.js').BehaviorTreeDiagnostic[]} */
    #diagnostics = [];
    /** @type {Map<string, 'error'|'warning'>} */
    #diagnosticsByNodeId = new Map();
    /** @type {ResizeObserver | null} */
    #resizeObserver = null;
    /** @type {Map<string, Set<(event:any) => void>>} */
    #listeners = new Map();
    /** @type {Set<string>} */
    #compatiblePortIds = new Set();
    /** @type {Set<string>} */
    #compatibleExecutionPortIds = new Set();
    /** @type {BehaviorTreeModel[]} */
    #undoStack = [];
    /** @type {BehaviorTreeModel[]} */
    #redoStack = [];
    /** @type {null | ({kind:"pan", pointerId?:number, startClientX:number, startClientY:number, startX:number, startY:number} | {kind:"node", nodeId:string, nodeIds?:string[], startPositions?:Map<string, BehaviorTreePoint>, pointerId?:number, startClientX:number, startClientY:number, startWorldX:number, startWorldY:number, startX:number, startY:number, moved?:boolean} | {kind:"connect", pointerId?:number, port:NormalizedBehaviorTreePort, startWorldX:number, startWorldY:number, currentWorldX:number, currentWorldY:number, hoverPortId:string} | {kind:"child-link", pointerId?:number, nodeId:string, portKind:'parent'|'child', startWorldX:number, startWorldY:number, currentWorldX:number, currentWorldY:number, hoverPortId:string} | {kind:"marquee", pointerId?:number, startWorldX:number, startWorldY:number, currentWorldX:number, currentWorldY:number, baseSelection:Set<string>})} */
    #drag = null;
    #hasFitted = false;
    #forceArrange = false;
}

/** @param {Pick<BehaviorTreeEdge, 'id'|'fromNodeId'|'fromPortId'|'toNodeId'|'toPortId'>} edge */
function dataEdgeId(edge) {
    const from = edge.fromNodeId && edge.fromPortId ? `${edge.fromNodeId}.${edge.fromPortId}` : String(edge.from || "");
    const to = edge.toNodeId && edge.toPortId ? `${edge.toNodeId}.${edge.toPortId}` : String(edge.to || "");
    return String(edge.id || `data:${from}->${to}`);
}

/**
 * @param {string} parentId
 * @param {string} childId
 */
function childEdgeId(parentId, childId) {
    return `child:${parentId}->${childId}`;
}

/** @param {string} edgeId */
function isChildEdgeId(edgeId) {
    return String(edgeId || "").startsWith("child:");
}

/** @param {any} event */
function hasSelectionModifier(event) {
    const source = event?.nativeEvent || event?.originalEvent || event;
    return source?.shiftKey === true || source?.ctrlKey === true || source?.metaKey === true;
}

/** @param {string} edgeId */
function parseChildEdgeId(edgeId) {
    const match = String(edgeId || "").match(/^child:(.+)->(.+)$/);
    if (!match) return null;
    return { parentId: match[1], childId: match[2] };
}

/**
 * @param {number} slot
 * @param {number} childCount
 */
function clampChildSlot(slot, childCount) {
    if (!Number.isFinite(slot)) return childCount - 1;
    return Math.max(0, Math.min(childCount - 1, Math.trunc(slot)));
}

function lerp(a, b, t) {
    return a + ((b - a) * t);
}

function cubicBezierPoint(path, t) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    return {
        x: (mt2 * mt * path.x1) + (3 * mt2 * t * path.c1x) + (3 * mt * t2 * path.c2x) + (t2 * t * path.x2),
        y: (mt2 * mt * path.y1) + (3 * mt2 * t * path.c1y) + (3 * mt * t2 * path.c2y) + (t2 * t * path.y2)
    };
}

/**
 * @param {BehaviorTreeModel} tree
 * @param {string} nodeId
 * @returns {BehaviorTreeNode | null}
 */
function findTreeNode(tree, nodeId) {
    if (Array.isArray(tree.nodes)) return tree.nodes.find(node => node.id === nodeId) || null;
    if (tree.nodes && typeof tree.nodes === "object") return /** @type {BehaviorTreeNode | null} */ (tree.nodes[nodeId] || null);
    return null;
}

/** @param {BehaviorTreeNode} node */
function normalizeCreatedNode(node) {
    return {
        ...(node && typeof node === "object" ? node : {}),
        id: String(node?.id || "")
    };
}

/**
 * @param {BehaviorTreeModel} tree
 * @param {BehaviorTreeNode} node
 */
function addTreeNode(tree, node) {
    if (!node.id || findTreeNode(tree, node.id)) return false;
    if (Array.isArray(tree.nodes)) {
        tree.nodes.push(node);
        return true;
    }
    if (tree.nodes && typeof tree.nodes === "object") {
        tree.nodes[node.id] = node;
        return true;
    }
    tree.nodes = [node];
    return true;
}

/**
 * @param {BehaviorTreeModel} tree
 * @param {string} nodeId
 */
function removeTreeNode(tree, nodeId) {
    let removed = false;
    if (Array.isArray(tree.nodes)) {
        const before = tree.nodes.length;
        tree.nodes = tree.nodes.filter(node => node.id !== nodeId);
        removed = tree.nodes.length !== before;
        for (const node of tree.nodes) cleanupNodeLinks(node, nodeId);
    } else if (tree.nodes && typeof tree.nodes === "object" && tree.nodes[nodeId]) {
        delete tree.nodes[nodeId];
        removed = true;
        for (const node of Object.values(tree.nodes)) cleanupNodeLinks(node, nodeId);
    }

    if (!removed) return false;
    if (tree.rootId === nodeId) tree.rootId = "";
    if (Array.isArray(tree.edges)) tree.edges = tree.edges.filter(edge => !edgeReferencesNode(edge, nodeId));
    return true;
}

/**
 * @param {BehaviorTreeModel} tree
 * @param {string} parentId
 * @param {string} childId
 * @param {number | undefined} slot
 */
function addTreeChildLink(tree, parentId, childId, slot) {
    const parent = findTreeNode(tree, parentId);
    const child = findTreeNode(tree, childId);
    if (!parent || !child) return;
    const children = Array.isArray(parent.children) ? parent.children : [];
    const existingIndex = children.findIndex(item => childRefId(item) === childId);
    if (existingIndex < 0) {
        if (Number.isInteger(slot) && slot >= 0 && slot < children.length) children.splice(slot, 0, childId);
        else children.push(childId);
    }
    parent.children = children;
    delete child.parentId;
    if (Array.isArray(tree.edges)) {
        tree.edges = tree.edges.filter(edge =>
            String(edge.kind || "child") !== "child" ||
            !(
                String(edge.parentId ?? edge.fromNodeId ?? edge.from ?? "") === parentId &&
                String(edge.childId ?? edge.toNodeId ?? edge.to ?? "") === childId
            )
        );
    }
}

/**
 * @param {BehaviorTreeModel} tree
 * @param {string} parentId
 * @param {string} childId
 */
function removeTreeChildLink(tree, parentId, childId) {
    const parent = findTreeNode(tree, parentId);
    const child = findTreeNode(tree, childId);
    let changed = false;
    if (parent && Array.isArray(parent.children)) {
        const before = parent.children.length;
        parent.children = parent.children.filter(item => childRefId(item) !== childId);
        changed = parent.children.length !== before || changed;
    }
    if (child?.parentId === parentId) {
        delete child.parentId;
        changed = true;
    }
    if (Array.isArray(tree.edges)) {
        const before = tree.edges.length;
        tree.edges = tree.edges.filter(edge =>
            String(edge.kind || "child") !== "child" ||
            !(
                String(edge.parentId ?? edge.fromNodeId ?? edge.from ?? "") === parentId &&
                String(edge.childId ?? edge.toNodeId ?? edge.to ?? "") === childId
            )
        );
        changed = tree.edges.length !== before || changed;
    }
    return changed;
}

/**
 * @param {BehaviorTreeModel} tree
 * @param {string} parentId
 * @param {string} childId
 * @param {number} slot
 * @param {string[]} currentOrder
 */
function moveTreeChild(tree, parentId, childId, slot, currentOrder) {
    const parent = findTreeNode(tree, parentId);
    if (!parent) return false;
    const without = currentOrder.filter(id => id !== childId);
    if (without.length === currentOrder.length) return false;
    const insertAt = Math.max(0, Math.min(without.length, Math.trunc(slot)));
    const nextOrder = [...without.slice(0, insertAt), childId, ...without.slice(insertAt)];
    if (nextOrder.every((id, index) => id === currentOrder[index])) return false;

    const refsById = new Map();
    if (Array.isArray(parent.children)) {
        for (const childRef of parent.children) refsById.set(childRefId(childRef), childRef);
    }
    parent.children = nextOrder.map(id => refsById.get(id) || id);
    syncChildEdgeSlots(tree, parentId, nextOrder);
    return true;
}

/**
 * @param {BehaviorTreeModel} tree
 * @param {string} parentId
 * @param {string[]} childOrder
 */
function syncChildEdgeSlots(tree, parentId, childOrder) {
    if (!Array.isArray(tree.edges)) return;
    const slotByChildId = new Map(childOrder.map((childId, index) => [childId, index]));
    for (const edge of tree.edges) {
        if (String(edge.kind || "child") !== "child") continue;
        const edgeParentId = String(edge.parentId ?? edge.fromNodeId ?? edge.from ?? "");
        const edgeChildId = String(edge.childId ?? edge.toNodeId ?? edge.to ?? "");
        if (edgeParentId !== parentId || !slotByChildId.has(edgeChildId)) continue;
        edge.slot = slotByChildId.get(edgeChildId);
        edge.index = edge.slot;
    }
}

/**
 * @param {BehaviorTreeNode} node
 * @param {string} deletedNodeId
 */
function cleanupNodeLinks(node, deletedNodeId) {
    if (node.parentId === deletedNodeId) delete node.parentId;
    if (Array.isArray(node.children)) {
        node.children = node.children.filter(child => childRefId(child) !== deletedNodeId);
    }
}

/**
 * @param {import('./core.js').BehaviorTreeChildRef} child
 */
function childRefId(child) {
    if (child && typeof child === "object") return String(child.nodeId ?? child.id ?? "");
    return String(child ?? "");
}

/**
 * @param {BehaviorTreeEdge} edge
 * @param {string} nodeId
 */
function edgeReferencesNode(edge, nodeId) {
    if (edge.fromNodeId === nodeId || edge.toNodeId === nodeId) return true;
    if (edge.parentId === nodeId || edge.childId === nodeId) return true;
    if (edge.from === nodeId || edge.to === nodeId) return true;
    if (String(edge.from || "").split(/[.:]/)[0] === nodeId) return true;
    if (String(edge.to || "").split(/[.:]/)[0] === nodeId) return true;
    return false;
}

/** @param {import('./core.js').BehaviorTreeDiagnostic[]} diagnostics */
function diagnosticsByNodeId(diagnostics) {
    const result = new Map();
    for (const diagnostic of diagnostics) {
        if (!diagnostic.nodeId) continue;
        const current = result.get(diagnostic.nodeId);
        if (current === "error") continue;
        result.set(diagnostic.nodeId, diagnostic.severity === "error" ? "error" : current || "warning");
    }
    return result;
}

/** @param {BehaviorTreeModel} tree */
function cloneTree(tree) {
    if (typeof structuredClone === "function") return structuredClone(tree);
    return JSON.parse(JSON.stringify(tree));
}

function assertTreeModel(value, name) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError(`${name} must be a behavior tree model object`);
    }
    if (value.nodes !== undefined && !Array.isArray(value.nodes) && (typeof value.nodes !== "object" || value.nodes === null)) {
        throw new TypeError(`${name}.nodes must be an array or object map`);
    }
    if (value.edges !== undefined && !Array.isArray(value.edges)) {
        throw new TypeError(`${name}.edges must be an array`);
    }
    if (value.nodeTypes !== undefined) assertPlainObject(value.nodeTypes, `${name}.nodeTypes`);
}

function assertPlainObject(value, name) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError(`${name} must be an object`);
    }
}

function assertArray(value, name) {
    if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
}

function assertBoolean(value, name) {
    if (typeof value !== "boolean") throw new TypeError(`${name} must be a boolean`);
}

function assertPositiveNumber(value, name) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        throw new TypeError(`${name} must be a positive number`);
    }
}

function assertPositiveInteger(value, name) {
    if (!Number.isInteger(value) || value <= 0) {
        throw new TypeError(`${name} must be a positive integer`);
    }
}
