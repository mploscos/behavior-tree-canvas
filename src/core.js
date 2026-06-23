/**
 * @typedef {'root'|'composite'|'decorator'|'action'|'condition'|'subtree'|'operation'|'unknown'} BehaviorTreeNodeCategory
 * @typedef {'idle'|'running'|'success'|'failure'|'skipped'|'halted'|'disabled'|'unknown'} BehaviorTreeNodeStatus
 * @typedef {'input'|'output'} BehaviorTreePortDirection
 * @typedef {{x:number, y:number}} BehaviorTreePoint
 * @typedef {{
 *   id:string,
 *   label?:string,
 *   name?:string,
 *   direction?:BehaviorTreePortDirection|string,
 *   dataType?:string,
 *   type?:string,
 *   required?:boolean,
 *   multiple?:boolean,
 *   acceptsMany?:boolean,
 *   maxConnections?:number|null,
 *   [key:string]:any
 * }} BehaviorTreePort
 * @typedef {BehaviorTreePort[] | {inputs?:BehaviorTreePort[], outputs?:BehaviorTreePort[]}} BehaviorTreePorts
 * @typedef {string | {id?:string, nodeId?:string, slot?:number, index?:number}} BehaviorTreeChildRef
 * @typedef {{
 *   id:string,
 *   type?:string,
 *   label?:string,
 *   name?:string,
 *   category?:BehaviorTreeNodeCategory|string,
 *   status?:BehaviorTreeNodeStatus|string,
 *   parentId?:string|null,
 *   children?:BehaviorTreeChildRef[],
 *   position?:BehaviorTreePoint,
 *   params?:Record<string, any>,
 *   ports?:BehaviorTreePorts,
 *   [key:string]:any
 * }} BehaviorTreeNode
 * @typedef {{
 *   id?:string,
 *   label?:string,
 *   category?:BehaviorTreeNodeCategory|string,
 *   minChildren?:number,
 *   maxChildren?:number|null,
 *   color?:number|string,
 *   paramsSchema?:Record<string, any>,
 *   ports?:BehaviorTreePorts,
 *   [key:string]:any
 * }} BehaviorTreeNodeType
 * @typedef {{
 *   id?:string,
 *   kind?:'child'|'data'|string,
 *   from?:string,
 *   to?:string,
 *   parentId?:string,
 *   childId?:string,
 *   fromNodeId?:string,
 *   fromPortId?:string,
 *   toNodeId?:string,
 *   toPortId?:string,
 *   slot?:number,
 *   index?:number,
 *   [key:string]:any
 * }} BehaviorTreeEdge
 * @typedef {{
 *   id?:string,
 *   rootId?:string,
 *   nodes?:BehaviorTreeNode[]|Record<string, BehaviorTreeNode>,
 *   edges?:BehaviorTreeEdge[],
 *   nodeTypes?:Record<string, BehaviorTreeNodeType>,
 *   blackboard?:Record<string, any>,
 *   metadata?:Record<string, any>,
 *   [key:string]:any
 * }} BehaviorTreeModel
 * @typedef {BehaviorTreePort & {
 *   id:string,
 *   fullId:string,
 *   nodeId:string,
 *   direction:BehaviorTreePortDirection,
 *   dataType:string
 * }} NormalizedBehaviorTreePort
 * @typedef {{kind:'child', fromNodeId:string, toNodeId:string, slot?:number, id?:string}} NormalizedBehaviorTreeChildEdge
 * @typedef {{kind:'data', fromNodeId:string, fromPortId:string, toNodeId:string, toPortId:string, id?:string}} NormalizedBehaviorTreeDataEdge
 * @typedef {{
 *   tree:BehaviorTreeModel,
 *   rootId:string,
 *   nodes:BehaviorTreeNode[],
 *   nodesById:Map<string, BehaviorTreeNode>,
 *   childrenById:Map<string, string[]>,
 *   parentById:Map<string, string>,
 *   childEdges:NormalizedBehaviorTreeChildEdge[],
 *   dataEdges:NormalizedBehaviorTreeDataEdge[],
 *   portsByNodeId:Map<string, {inputs:NormalizedBehaviorTreePort[], outputs:NormalizedBehaviorTreePort[]}>,
 *   portsById:Map<string, NormalizedBehaviorTreePort>,
 *   nodeTypes:Record<string, BehaviorTreeNodeType>,
 *   diagnostics:string[]
 * }} NormalizedBehaviorTree
 * @typedef {{
 *   nodeWidth?:number,
 *   nodeHeight?:number,
 *   horizontalGap?:number,
 *   verticalGap?:number,
 *   preservePositions?:boolean,
 *   center?:boolean,
 *   existingPositions?:Map<string, BehaviorTreePoint>
 * }} BehaviorTreeLayoutOptions
 * @typedef {'error'|'warning'} BehaviorTreeDiagnosticSeverity
 * @typedef {{
 *   id:string,
 *   severity:BehaviorTreeDiagnosticSeverity,
 *   code:string,
 *   message:string,
 *   nodeId?:string,
 *   edgeId?:string,
 *   portId?:string,
 *   path?:string
 * }} BehaviorTreeDiagnostic
 */

/**
 * Normalize a behavior tree input into indexed nodes, execution links and
 * dataflow links. Invalid links are ignored and reported in diagnostics.
 *
 * @param {BehaviorTreeModel | null | undefined} tree
 * @param {Record<string, BehaviorTreeNodeType>} [nodeTypes]
 * @returns {NormalizedBehaviorTree}
 */
export function normalizeBehaviorTree(tree, nodeTypes = {}) {
    const source = tree && typeof tree === "object" ? tree : {};
    const nodes = normalizeNodes(source.nodes);
    const nodesById = new Map();
    const childrenById = new Map();
    const parentById = new Map();
    /** @type {NormalizedBehaviorTreeChildEdge[]} */
    const childEdges = [];
    /** @type {NormalizedBehaviorTreeDataEdge[]} */
    const dataEdges = [];
    const diagnostics = [];
    const mergedNodeTypes = {
        ...(nodeTypes || {}),
        ...(source.nodeTypes || {})
    };

    for (const node of nodes) {
        if (!node.id) {
            diagnostics.push("Behavior tree node without id ignored");
            continue;
        }
        if (nodesById.has(node.id)) {
            diagnostics.push(`Duplicate behavior tree node id "${node.id}" ignored`);
            continue;
        }
        nodesById.set(node.id, node);
        childrenById.set(node.id, []);
    }

    for (const node of nodesById.values()) {
        if (Array.isArray(node.children)) {
            for (const child of node.children) {
                const ref = normalizeChildRef(child);
                linkChild(node.id, ref.id, ref.slot, nodesById, childrenById, parentById, childEdges, diagnostics);
            }
        }
        if (node.parentId != null && node.parentId !== "") {
            linkChild(String(node.parentId), node.id, undefined, nodesById, childrenById, parentById, childEdges, diagnostics);
        }
    }

    const portsByNodeId = normalizeNodePorts(nodesById, mergedNodeTypes);
    const portsById = new Map();
    for (const ports of portsByNodeId.values()) {
        for (const port of [...ports.inputs, ...ports.outputs]) {
            portsById.set(port.fullId, port);
            portsById.set(`${port.nodeId}:${port.id}`, port);
        }
    }

    for (const edge of source.edges || []) {
        if (String(edge.kind || "child") === "data") {
            linkData(edge, nodesById, portsById, dataEdges, diagnostics);
            continue;
        }

        const parentId = String(edge.fromNodeId ?? edge.parentId ?? edge.from ?? "");
        const childId = String(edge.toNodeId ?? edge.childId ?? edge.to ?? "");
        const slot = normalizeSlot(edge.slot ?? edge.index);
        linkChild(parentId, childId, slot, nodesById, childrenById, parentById, childEdges, diagnostics);
    }

    const rootId = resolveRootId(source.rootId, nodesById, parentById, diagnostics);

    if (rootId) {
        detectCycles(rootId, childrenById, diagnostics);
        validateChildren(nodesById, childrenById, mergedNodeTypes, diagnostics);
    }

    return {
        tree: source,
        rootId,
        nodes: [...nodesById.values()],
        nodesById,
        childrenById,
        parentById,
        childEdges,
        dataEdges,
        portsByNodeId,
        portsById,
        nodeTypes: mergedNodeTypes,
        diagnostics
    };
}

/**
 * @param {NormalizedBehaviorTree} normalized
 * @param {string | {nodeId?:string, portId?:string, id?:string}} from
 * @param {string | {nodeId?:string, portId?:string, id?:string}} to
 * @returns {{ok:boolean, reason?:string, from?:NormalizedBehaviorTreePort, to?:NormalizedBehaviorTreePort}}
 */
export function canConnect(normalized, from, to) {
    const fromPort = resolvePort(normalized, from);
    const toPort = resolvePort(normalized, to);
    if (!fromPort) return { ok: false, reason: "missing output port" };
    if (!toPort) return { ok: false, reason: "missing input port" };
    if (fromPort.direction !== "output") return { ok: false, reason: "source port is not an output", from: fromPort, to: toPort };
    if (toPort.direction !== "input") return { ok: false, reason: "target port is not an input", from: fromPort, to: toPort };
    if (fromPort.nodeId === toPort.nodeId) return { ok: false, reason: "ports belong to the same node", from: fromPort, to: toPort };
    if (!areDataTypesCompatible(fromPort.dataType, toPort.dataType)) {
        return { ok: false, reason: `incompatible data types: ${fromPort.dataType} -> ${toPort.dataType}`, from: fromPort, to: toPort };
    }
    if (!hasConnectionCapacity(normalized, fromPort)) {
        return { ok: false, reason: `source port "${fromPort.nodeId}.${fromPort.id}" has no free connection slots`, from: fromPort, to: toPort };
    }
    if (!hasConnectionCapacity(normalized, toPort)) {
        return { ok: false, reason: `target port "${toPort.nodeId}.${toPort.id}" has no free connection slots`, from: fromPort, to: toPort };
    }
    return { ok: true, from: fromPort, to: toPort };
}

/**
 * Return node type definitions that expose a compatible port for the target.
 * This is intentionally generic: the future SEN bus can feed the palette using
 * the same port metadata without changing the editor core.
 *
 * @param {NormalizedBehaviorTree} normalized
 * @param {string | {nodeId?:string, portId?:string, id?:string}} target
 * @returns {Array<{typeId:string, label:string, category:string, nodeType:BehaviorTreeNodeType, ports:BehaviorTreePort[]}>}
 */
export function suggestNodeTypesForPort(normalized, target) {
    const targetPort = resolvePort(normalized, target);
    if (!targetPort) return [];
    if (!hasConnectionCapacity(normalized, targetPort)) return [];
    const wantedDirection = targetPort.direction === "input" ? "output" : "input";
    const suggestions = [];

    for (const [typeId, nodeType] of Object.entries(normalized.nodeTypes || {})) {
        const ports = splitPorts(nodeType.ports);
        const candidates = wantedDirection === "output" ? ports.outputs : ports.inputs;
        const compatible = candidates.filter(port => {
            if (!areDataTypesCompatible(normalizeDataType(port.dataType ?? port.type), targetPort.dataType)) return false;
            const direction = wantedDirection;
            const normalizedPort = normalizePalettePort(port, direction);
            return hasDetachedPortCapacity(normalizedPort);
        });
        if (compatible.length) suggestions.push({ ...nodeTypeSuggestionMeta(typeId, nodeType), nodeType, ports: compatible });
    }

    return suggestions;
}

/**
 * Validate whether a behavior-tree execution edge can be created.
 *
 * @param {NormalizedBehaviorTree} normalized
 * @param {string} parentId
 * @param {string} childId
 * @returns {{ok:boolean, reason?:string, parent?:BehaviorTreeNode, child?:BehaviorTreeNode}}
 */
export function canLinkChild(normalized, parentId, childId) {
    return validateChildLink(normalized, parentId, childId, false);
}

/**
 * Validate whether an existing execution subtree can be moved under a new parent.
 *
 * @param {NormalizedBehaviorTree} normalized
 * @param {string} parentId
 * @param {string} childId
 * @returns {{ok:boolean, reason?:string, parent?:BehaviorTreeNode, child?:BehaviorTreeNode, previousParentId?:string}}
 */
export function canReparentChild(normalized, parentId, childId) {
    return validateChildLink(normalized, parentId, childId, true);
}

/**
 * Return node type definitions that can be created as execution children of
 * the given parent.
 *
 * @param {NormalizedBehaviorTree} normalized
 * @param {string} parentId
 * @returns {Array<{typeId:string, label:string, category:string, nodeType:BehaviorTreeNodeType}>}
 */
export function suggestNodeTypesForChild(normalized, parentId) {
    const parent = normalized.nodesById.get(String(parentId || ""));
    if (!parent) return [];
    if (!canAcceptAdditionalChild(normalized, parent)) return [];
    const suggestions = [];
    for (const [typeId, nodeType] of Object.entries(normalized.nodeTypes || {})) {
        const category = String(nodeType.category || "").toLowerCase();
        if (category === "operation" || category === "root") continue;
        suggestions.push({ ...nodeTypeSuggestionMeta(typeId, nodeType), nodeType });
    }
    return suggestions;
}

/**
 * @param {string} typeId
 * @param {BehaviorTreeNodeType} nodeType
 */
function nodeTypeSuggestionMeta(typeId, nodeType) {
    return {
        typeId,
        label: String(nodeType.label || nodeType.name || typeId),
        category: String(nodeType.category || "unknown")
    };
}

/**
 * Validate a behavior-tree model and return structured diagnostics for hosts
 * and renderers.
 *
 * @param {BehaviorTreeModel | NormalizedBehaviorTree | null | undefined} tree
 * @param {Record<string, BehaviorTreeNodeType>} [nodeTypes]
 * @returns {BehaviorTreeDiagnostic[]}
 */
export function validateBehaviorTree(tree, nodeTypes = {}) {
    const normalized = isNormalizedTree(tree) ? tree : normalizeBehaviorTree(/** @type {BehaviorTreeModel | null | undefined} */ (tree), nodeTypes);
    /** @type {BehaviorTreeDiagnostic[]} */
    const diagnostics = [];
    let index = 0;
    const push = (diagnostic) => {
        diagnostics.push({ id: `${diagnostic.code}:${index++}`, ...diagnostic });
    };

    for (const message of normalized.diagnostics) {
        push({ severity: "error", code: "normalize", message });
    }

    if (!normalized.rootId) {
        push({ severity: "error", code: "missing-root", message: "Behavior tree has no root node", path: "rootId" });
    }

    for (const node of normalized.nodes) {
        const typeId = String(node.type || "");
        const type = normalized.nodeTypes[typeId];
        if (!typeId) {
            push({ severity: "error", code: "missing-node-type", message: `Node "${node.id}" has no type`, nodeId: node.id, path: `nodes.${node.id}.type` });
        } else if (!type) {
            push({ severity: "error", code: "unknown-node-type", message: `Node "${node.id}" references unknown type "${typeId}"`, nodeId: node.id, path: `nodes.${node.id}.type` });
        }

        const children = normalized.childrenById.get(node.id) || [];
        const min = Number.isFinite(type?.minChildren) ? Number(type.minChildren) : 0;
        const max = type?.maxChildren == null ? Number.POSITIVE_INFINITY : Number(type.maxChildren);
        if (children.length < min) {
            push({ severity: "error", code: "min-children", message: `Node "${node.id}" requires at least ${min} children`, nodeId: node.id, path: `nodes.${node.id}.children` });
        }
        if (Number.isFinite(max) && children.length > max) {
            push({ severity: "error", code: "max-children", message: `Node "${node.id}" allows at most ${max} children`, nodeId: node.id, path: `nodes.${node.id}.children` });
        }

        validateRequiredPorts(normalized, node, push);
        validateRequiredParams(normalized, node, push);
    }

    validateDataEdges(normalized, push);
    return diagnostics;
}

/** @param {any} value */
function isNormalizedTree(value) {
    return Boolean(value?.nodesById instanceof Map && value?.childrenById instanceof Map && value?.portsById instanceof Map);
}

/**
 * @param {NormalizedBehaviorTree} normalized
 * @param {BehaviorTreeNode} node
 * @param {(diagnostic:Omit<BehaviorTreeDiagnostic, 'id'>) => void} push
 */
function validateRequiredPorts(normalized, node, push) {
    const ports = normalized.portsByNodeId.get(node.id);
    if (!ports) return;
    for (const port of ports.inputs) {
        if (port.required !== true) continue;
        const hasConnection = normalized.dataEdges.some(edge => edge.toNodeId === node.id && edge.toPortId === port.id);
        if (!hasConnection) {
            push({
                severity: "error",
                code: "required-input",
                message: `Input "${port.id}" on node "${node.id}" requires a connection`,
                nodeId: node.id,
                portId: port.fullId,
                path: `nodes.${node.id}.ports.${port.id}`
            });
        }
    }
}

/**
 * @param {NormalizedBehaviorTree} normalized
 * @param {BehaviorTreeNode} node
 * @param {(diagnostic:Omit<BehaviorTreeDiagnostic, 'id'>) => void} push
 */
function validateRequiredParams(normalized, node, push) {
    const type = normalized.nodeTypes[node.type || ""] || {};
    const schema = type.paramsSchema || {};
    for (const [key, definition] of Object.entries(schema)) {
        const normalizedDefinition = normalizeParamSchema(definition);
        if (normalizedDefinition.required !== true) continue;
        if (!isEmptyParamValue(node.params?.[key])) continue;
        push({
            severity: "error",
            code: "required-param",
            message: `Param "${key}" on node "${node.id}" is required`,
            nodeId: node.id,
            path: `nodes.${node.id}.params.${key}`
        });
    }
}

/**
 * @param {NormalizedBehaviorTree} normalized
 * @param {(diagnostic:Omit<BehaviorTreeDiagnostic, 'id'>) => void} push
 */
function validateDataEdges(normalized, push) {
    const rawEdges = Array.isArray(normalized.tree.edges) ? normalized.tree.edges : [];
    const portUseCount = new Map();
    for (const edge of rawEdges) {
        if (String(edge.kind || "child") !== "data") continue;
        const edgeId = edge.id || dataEdgeDiagnosticId(edge);
        const fromRef = normalizePortRef(edge.from, edge.fromNodeId, edge.fromPortId);
        const toRef = normalizePortRef(edge.to, edge.toNodeId, edge.toPortId);
        const from = normalized.portsById.get(`${fromRef.nodeId}:${fromRef.portId}`);
        const to = normalized.portsById.get(`${toRef.nodeId}:${toRef.portId}`);
        if (!from) {
            push({ severity: "error", code: "missing-output-port", message: `Data edge references missing output port "${fromRef.nodeId}.${fromRef.portId}"`, edgeId, nodeId: fromRef.nodeId, portId: `${fromRef.nodeId}:${fromRef.portId}` });
            continue;
        }
        if (!to) {
            push({ severity: "error", code: "missing-input-port", message: `Data edge references missing input port "${toRef.nodeId}.${toRef.portId}"`, edgeId, nodeId: toRef.nodeId, portId: `${toRef.nodeId}:${toRef.portId}` });
            continue;
        }
        if (from.direction !== "output" || to.direction !== "input") {
            push({ severity: "error", code: "invalid-port-direction", message: `Data edge "${from.fullId}" -> "${to.fullId}" has invalid direction`, edgeId, nodeId: to.nodeId, portId: to.fullId });
            continue;
        }
        if (!areDataTypesCompatible(from.dataType, to.dataType)) {
            push({ severity: "error", code: "incompatible-data-types", message: `Data edge "${from.fullId}" -> "${to.fullId}" has incompatible types`, edgeId, nodeId: to.nodeId, portId: to.fullId });
        }
        for (const port of [from, to]) {
            const count = (portUseCount.get(port.fullId) || 0) + 1;
            portUseCount.set(port.fullId, count);
            const max = getMaxConnections(port);
            if (Number.isFinite(max) && count > max) {
                push({ severity: "error", code: "port-capacity", message: `Port "${port.fullId}" allows at most ${max} connections`, edgeId, nodeId: port.nodeId, portId: port.fullId });
            }
        }
    }
}

/** @param {any} value */
function normalizeParamSchema(value) {
    if (typeof value === "string") return { type: value };
    if (value && typeof value === "object") return value;
    return {};
}

/** @param {any} value */
function isEmptyParamValue(value) {
    return value == null || value === "";
}

/** @param {BehaviorTreeEdge} edge */
function dataEdgeDiagnosticId(edge) {
    const from = edge.fromNodeId && edge.fromPortId ? `${edge.fromNodeId}.${edge.fromPortId}` : String(edge.from || "");
    const to = edge.toNodeId && edge.toPortId ? `${edge.toNodeId}.${edge.toPortId}` : String(edge.to || "");
    return `data:${from}->${to}`;
}

/**
 * @param {NormalizedBehaviorTree} normalized
 * @param {string} parentId
 * @param {string} childId
 * @param {boolean} allowReparent
 * @returns {{ok:boolean, reason?:string, parent?:BehaviorTreeNode, child?:BehaviorTreeNode, previousParentId?:string}}
 */
function validateChildLink(normalized, parentId, childId, allowReparent) {
    const parent = normalized.nodesById.get(String(parentId || ""));
    const child = normalized.nodesById.get(String(childId || ""));
    if (!parent) return { ok: false, reason: "missing parent node" };
    if (!child) return { ok: false, reason: "missing child node" };
    if (parent.id === child.id) return { ok: false, reason: "node cannot be its own child", parent, child };
    if (child.id === normalized.rootId) return { ok: false, reason: "root node cannot be an execution child", parent, child };
    if (isOperationNode(normalized, parent)) return { ok: false, reason: "operation nodes cannot have execution children", parent, child };
    if (isOperationNode(normalized, child)) return { ok: false, reason: "operation nodes cannot be execution children", parent, child };
    const existingParent = normalized.parentById.get(child.id);
    if (existingParent && existingParent !== parent.id && !allowReparent) return { ok: false, reason: `child already has parent "${existingParent}"`, parent, child, previousParentId: existingParent };
    if (existingParent === parent.id && allowReparent) return { ok: false, reason: "child already belongs to this parent", parent, child, previousParentId: existingParent };
    if ((normalized.childrenById.get(parent.id) || []).includes(child.id)) return { ok: false, reason: "child link already exists", parent, child };

    const capacity = childCapacity(normalized, parent);
    if (Number.isFinite(capacity.max) && capacity.count >= capacity.max) return { ok: false, reason: `parent allows at most ${capacity.max} children`, parent, child, previousParentId: existingParent };
    if (wouldCreateChildCycle(normalized, parent.id, child.id)) return { ok: false, reason: "child link would create a cycle", parent, child };
    return { ok: true, parent, child, previousParentId: existingParent };
}

/**
 * @param {BehaviorTreeModel["nodes"]} value
 * @returns {BehaviorTreeNode[]}
 */
function normalizeNodes(value) {
    if (Array.isArray(value)) {
        return value
            .filter(node => node && typeof node === "object")
            .map(node => ({ ...node, id: String(node.id ?? "") }));
    }
    if (value && typeof value === "object") {
        return Object.entries(value).map(([id, node]) => ({
            ...(node && typeof node === "object" ? node : {}),
            id: String(/** @type {any} */ (node)?.id ?? id)
        }));
    }
    return [];
}

/**
 * @param {BehaviorTreeChildRef} value
 * @returns {{id:string, slot?:number}}
 */
function normalizeChildRef(value) {
    if (value && typeof value === "object") {
        return {
            id: String(value.nodeId ?? value.id ?? ""),
            slot: normalizeSlot(value.slot ?? value.index)
        };
    }
    return { id: String(value ?? "") };
}

/** @param {any} value */
function normalizeSlot(value) {
    const slot = Number(value);
    return Number.isInteger(slot) && slot >= 0 ? slot : undefined;
}

/**
 * @param {string} parentId
 * @param {string} childId
 * @param {number | undefined} slot
 * @param {Map<string, BehaviorTreeNode>} nodesById
 * @param {Map<string, string[]>} childrenById
 * @param {Map<string, string>} parentById
 * @param {NormalizedBehaviorTreeChildEdge[]} childEdges
 * @param {string[]} diagnostics
 */
function linkChild(parentId, childId, slot, nodesById, childrenById, parentById, childEdges, diagnostics) {
    if (!parentId || !childId) return;
    if (!nodesById.has(parentId)) {
        diagnostics.push(`Behavior tree edge references missing parent "${parentId}"`);
        return;
    }
    if (!nodesById.has(childId)) {
        diagnostics.push(`Behavior tree edge references missing child "${childId}"`);
        return;
    }
    if (parentId === childId) {
        diagnostics.push(`Behavior tree node "${parentId}" cannot be its own child`);
        return;
    }
    const existingParent = parentById.get(childId);
    if (existingParent && existingParent !== parentId) {
        diagnostics.push(`Behavior tree node "${childId}" already has parent "${existingParent}"`);
        return;
    }

    const children = childrenById.get(parentId) || [];
    if (!children.includes(childId)) {
        if (slot != null && slot < children.length) children.splice(slot, 0, childId);
        else children.push(childId);
    }
    childrenById.set(parentId, children);
    parentById.set(childId, parentId);
    if (!childEdges.some(edge => edge.fromNodeId === parentId && edge.toNodeId === childId)) {
        childEdges.push({ kind: "child", fromNodeId: parentId, toNodeId: childId, slot });
    }
}

/**
 * @param {BehaviorTreeEdge} edge
 * @param {Map<string, BehaviorTreeNode>} nodesById
 * @param {Map<string, NormalizedBehaviorTreePort>} portsById
 * @param {NormalizedBehaviorTreeDataEdge[]} dataEdges
 * @param {string[]} diagnostics
 */
function linkData(edge, nodesById, portsById, dataEdges, diagnostics) {
    const fromRef = normalizePortRef(edge.from, edge.fromNodeId, edge.fromPortId);
    const toRef = normalizePortRef(edge.to, edge.toNodeId, edge.toPortId);
    if (!fromRef.nodeId || !fromRef.portId || !toRef.nodeId || !toRef.portId) return;
    if (!nodesById.has(fromRef.nodeId)) {
        diagnostics.push(`Data edge references missing source node "${fromRef.nodeId}"`);
        return;
    }
    if (!nodesById.has(toRef.nodeId)) {
        diagnostics.push(`Data edge references missing target node "${toRef.nodeId}"`);
        return;
    }
    const fromPort = portsById.get(`${fromRef.nodeId}:${fromRef.portId}`);
    const toPort = portsById.get(`${toRef.nodeId}:${toRef.portId}`);
    if (!fromPort) {
        diagnostics.push(`Data edge references missing output port "${fromRef.nodeId}.${fromRef.portId}"`);
        return;
    }
    if (!toPort) {
        diagnostics.push(`Data edge references missing input port "${toRef.nodeId}.${toRef.portId}"`);
        return;
    }
    const check = canConnect(/** @type {NormalizedBehaviorTree} */ ({ portsById, dataEdges }), `${fromRef.nodeId}:${fromRef.portId}`, `${toRef.nodeId}:${toRef.portId}`);
    if (!check.ok) {
        diagnostics.push(`Data edge "${fromRef.nodeId}.${fromRef.portId}" -> "${toRef.nodeId}.${toRef.portId}" ignored: ${check.reason}`);
        return;
    }
    dataEdges.push({
        kind: "data",
        id: edge.id,
        fromNodeId: fromRef.nodeId,
        fromPortId: fromRef.portId,
        toNodeId: toRef.nodeId,
        toPortId: toRef.portId
    });
}

/**
 * @param {string | undefined} compact
 * @param {string | undefined} nodeId
 * @param {string | undefined} portId
 */
function normalizePortRef(compact, nodeId, portId) {
    if (nodeId || portId) return { nodeId: String(nodeId || ""), portId: String(portId || "") };
    const value = String(compact || "");
    const match = value.match(/^([^.:]+)[.:](.+)$/);
    return match ? { nodeId: match[1], portId: match[2] } : { nodeId: "", portId: "" };
}

/**
 * @param {Map<string, BehaviorTreeNode>} nodesById
 * @param {Record<string, BehaviorTreeNodeType>} nodeTypes
 * @returns {Map<string, {inputs:NormalizedBehaviorTreePort[], outputs:NormalizedBehaviorTreePort[]}>}
 */
function normalizeNodePorts(nodesById, nodeTypes) {
    const byNode = new Map();
    for (const node of nodesById.values()) {
        const typePorts = splitPorts(nodeTypes[node.type || ""]?.ports);
        const nodePorts = splitPorts(node.ports);
        byNode.set(node.id, {
            inputs: mergePorts(node.id, "input", typePorts.inputs, nodePorts.inputs),
            outputs: mergePorts(node.id, "output", typePorts.outputs, nodePorts.outputs)
        });
    }
    return byNode;
}

/**
 * @param {BehaviorTreePorts | undefined} value
 * @returns {{inputs:BehaviorTreePort[], outputs:BehaviorTreePort[]}}
 */
function splitPorts(value) {
    const inputs = [];
    const outputs = [];
    if (Array.isArray(value)) {
        for (const port of value) {
            if (!port || typeof port !== "object") continue;
            const direction = normalizeDirection(port.direction);
            if (direction === "input") inputs.push(port);
            else if (direction === "output") outputs.push(port);
        }
        return { inputs, outputs };
    }
    if (value && typeof value === "object") {
        if (Array.isArray(value.inputs)) inputs.push(...value.inputs.filter(port => port && typeof port === "object"));
        if (Array.isArray(value.outputs)) outputs.push(...value.outputs.filter(port => port && typeof port === "object"));
    }
    return { inputs, outputs };
}

/**
 * @param {string} nodeId
 * @param {BehaviorTreePortDirection} direction
 * @param {BehaviorTreePort[]} typePorts
 * @param {BehaviorTreePort[]} nodePorts
 * @returns {NormalizedBehaviorTreePort[]}
 */
function mergePorts(nodeId, direction, typePorts, nodePorts) {
    const byId = new Map();
    for (const port of [...typePorts, ...nodePorts]) {
        const id = String(port.id || port.name || "");
        if (!id) continue;
        byId.set(id, {
            ...byId.get(id),
            ...port,
            id,
            fullId: `${nodeId}:${id}`,
            nodeId,
            direction,
            dataType: normalizeDataType(port.dataType ?? port.type)
        });
    }
    return [...byId.values()];
}

/** @param {any} value */
function normalizeDirection(value) {
    const key = String(value || "").toLowerCase();
    if (key === "in" || key === "input") return "input";
    if (key === "out" || key === "output") return "output";
    return "";
}

/** @param {any} value */
function normalizeDataType(value) {
    return String(value || "any").trim().toLowerCase() || "any";
}

/**
 * @param {NormalizedBehaviorTree} normalized
 * @param {string | {nodeId?:string, portId?:string, id?:string}} ref
 * @returns {NormalizedBehaviorTreePort | null}
 */
function resolvePort(normalized, ref) {
    if (typeof ref === "string") return normalized.portsById.get(ref) || normalized.portsById.get(ref.replace(".", ":")) || null;
    if (ref && typeof ref === "object") {
        if (ref.id && normalized.portsById.has(ref.id)) return normalized.portsById.get(ref.id) || null;
        const nodeId = String(ref.nodeId || "");
        const portId = String(ref.portId || ref.id || "");
        if (nodeId && portId) return normalized.portsById.get(`${nodeId}:${portId}`) || null;
    }
    return null;
}

/**
 * @param {string} fromType
 * @param {string} toType
 */
function areDataTypesCompatible(fromType, toType) {
    const from = normalizeDataType(fromType);
    const to = normalizeDataType(toType);
    return from === "any" || to === "any" || from === to;
}

/**
 * @param {BehaviorTreePort} port
 * @param {BehaviorTreePortDirection} direction
 * @returns {NormalizedBehaviorTreePort}
 */
function normalizePalettePort(port, direction) {
    return /** @type {NormalizedBehaviorTreePort} */ ({
        ...port,
        id: String(port.id || port.name || ""),
        fullId: "",
        nodeId: "",
        direction,
        dataType: normalizeDataType(port.dataType ?? port.type)
    });
}

/** @param {NormalizedBehaviorTreePort} port */
function hasDetachedPortCapacity(port) {
    return getMaxConnections(port) > 0;
}

/**
 * @param {NormalizedBehaviorTree} normalized
 * @param {NormalizedBehaviorTreePort} port
 */
function hasConnectionCapacity(normalized, port) {
    const max = getMaxConnections(port);
    if (!Number.isFinite(max)) return true;
    return countPortConnections(normalized, port) < max;
}

/** @param {NormalizedBehaviorTreePort} port */
function getMaxConnections(port) {
    if (port.multiple === true || port.acceptsMany === true) return Number.POSITIVE_INFINITY;
    if (port.maxConnections === null) return Number.POSITIVE_INFINITY;
    if (Number.isFinite(port.maxConnections)) return Math.max(0, Number(port.maxConnections));
    return port.direction === "input" ? 1 : Number.POSITIVE_INFINITY;
}

/**
 * @param {NormalizedBehaviorTree} normalized
 * @param {NormalizedBehaviorTreePort} port
 */
function countPortConnections(normalized, port) {
    const edges = normalized.dataEdges || [];
    let count = 0;
    for (const edge of edges) {
        if (port.direction === "input" && edge.toNodeId === port.nodeId && edge.toPortId === port.id) count += 1;
        if (port.direction === "output" && edge.fromNodeId === port.nodeId && edge.fromPortId === port.id) count += 1;
    }
    return count;
}

/**
 * @param {NormalizedBehaviorTree} normalized
 * @param {BehaviorTreeNode} node
 */
function isOperationNode(normalized, node) {
    const type = normalized.nodeTypes[node.type || ""] || {};
    return String(node.category || type.category || "").toLowerCase() === "operation";
}

/**
 * @param {NormalizedBehaviorTree} normalized
 * @param {BehaviorTreeNode} parent
 */
function canAcceptAdditionalChild(normalized, parent) {
    if (isOperationNode(normalized, parent)) return false;
    const capacity = childCapacity(normalized, parent);
    return !Number.isFinite(capacity.max) || capacity.count < capacity.max;
}

/**
 * @param {NormalizedBehaviorTree} normalized
 * @param {BehaviorTreeNode} parent
 */
function childCapacity(normalized, parent) {
    const type = normalized.nodeTypes[parent.type || ""] || {};
    const max = type.maxChildren == null ? Number.POSITIVE_INFINITY : Number(type.maxChildren);
    const count = (normalized.childrenById.get(parent.id) || []).length;
    return { max, count };
}

/**
 * @param {NormalizedBehaviorTree} normalized
 * @param {string} parentId
 * @param {string} childId
 */
function wouldCreateChildCycle(normalized, parentId, childId) {
    const visit = (id) => {
        if (id === parentId) return true;
        for (const next of normalized.childrenById.get(id) || []) {
            if (visit(next)) return true;
        }
        return false;
    };
    return visit(childId);
}

/**
 * @param {string | undefined} configuredRootId
 * @param {Map<string, BehaviorTreeNode>} nodesById
 * @param {Map<string, string>} parentById
 * @param {string[]} diagnostics
 * @returns {string}
 */
function resolveRootId(configuredRootId, nodesById, parentById, diagnostics) {
    const requested = String(configuredRootId || "");
    if (requested && nodesById.has(requested)) return requested;
    if (requested) diagnostics.push(`Behavior tree root "${requested}" was not found`);

    const roots = [...nodesById.keys()].filter(id => !parentById.has(id));
    if (roots.length > 1) diagnostics.push(`Behavior tree has ${roots.length} root candidates`);
    return roots[0] || "";
}

/**
 * @param {string} rootId
 * @param {Map<string, string[]>} childrenById
 * @param {string[]} diagnostics
 */
function detectCycles(rootId, childrenById, diagnostics) {
    const visiting = new Set();
    const visited = new Set();

    /** @param {string} id */
    const visit = (id) => {
        if (visiting.has(id)) {
            diagnostics.push(`Behavior tree cycle detected at "${id}"`);
            return;
        }
        if (visited.has(id)) return;
        visiting.add(id);
        for (const childId of childrenById.get(id) || []) visit(childId);
        visiting.delete(id);
        visited.add(id);
    };

    visit(rootId);
}

/**
 * @param {Map<string, BehaviorTreeNode>} nodesById
 * @param {Map<string, string[]>} childrenById
 * @param {Record<string, BehaviorTreeNodeType>} nodeTypes
 * @param {string[]} diagnostics
 */
function validateChildren(nodesById, childrenById, nodeTypes, diagnostics) {
    for (const node of nodesById.values()) {
        const type = nodeTypes[node.type || ""] || {};
        const children = childrenById.get(node.id) || [];
        const min = Number.isFinite(type.minChildren) ? Number(type.minChildren) : 0;
        const max = type.maxChildren == null ? Number.POSITIVE_INFINITY : Number(type.maxChildren);
        if (children.length < min) diagnostics.push(`Node "${node.id}" requires at least ${min} children`);
        if (Number.isFinite(max) && children.length > max) diagnostics.push(`Node "${node.id}" allows at most ${max} children`);
    }
}

export { layoutBehaviorTree } from "./layout.js";
