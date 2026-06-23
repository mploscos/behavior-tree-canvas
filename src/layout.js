/**
 * @import {
 *   BehaviorTreeLayoutOptions,
 *   BehaviorTreeNode,
 *   BehaviorTreePoint,
 *   NormalizedBehaviorTree
 * } from './core.js'
 */

/**
 * Compute a compact top-down tree layout. Nodes that are not reachable from the
 * execution root, such as operation/dataflow nodes, are placed in a side column.
 *
 * @param {NormalizedBehaviorTree} normalized
 * @param {BehaviorTreeLayoutOptions} [options]
 * @returns {Map<string, BehaviorTreePoint>}
 */
export function layoutBehaviorTree(normalized, options = {}) {
    const nodeWidth = options.nodeWidth ?? 180;
    const nodeHeight = options.nodeHeight ?? 64;
    const horizontalGap = options.horizontalGap ?? 48;
    const verticalGap = options.verticalGap ?? 84;
    const preservePositions = options.preservePositions !== false;
    const existingPositions = options.existingPositions || new Map();
    const positions = new Map();
    const subtreeWidthById = new Map();
    const visiting = new Set();
    let hasPreservedPosition = false;

    /** @param {string} id @returns {number} */
    const measure = (id) => {
        if (visiting.has(id)) return nodeWidth;
        visiting.add(id);
        const children = normalized.childrenById.get(id) || [];
        if (!children.length) {
            subtreeWidthById.set(id, nodeWidth);
            visiting.delete(id);
            return nodeWidth;
        }

        const childrenWidth = children.reduce((sum, childId, index) => {
            return sum + measure(childId) + (index > 0 ? horizontalGap : 0);
        }, 0);
        const width = Math.max(nodeWidth, childrenWidth);
        subtreeWidthById.set(id, width);
        visiting.delete(id);
        return width;
    };

    /**
     * @param {string} id
     * @param {number} left
     * @param {number} depth
     */
    const place = (id, left, depth) => {
        const width = subtreeWidthById.get(id) || nodeWidth;
        const fallback = {
            x: left + (width / 2),
            y: depth * (nodeHeight + verticalGap)
        };
        const node = normalized.nodesById.get(id);
        const configured = node?.position;
        const existing = existingPositions.get(id);
        if (preservePositions && (configured || existing)) {
            hasPreservedPosition = true;
            positions.set(id, { ...(configured || existing) });
        } else {
            positions.set(id, fallback);
        }

        const children = normalized.childrenById.get(id) || [];
        let childrenWidth = 0;
        for (let index = 0; index < children.length; index += 1) {
            childrenWidth += subtreeWidthById.get(children[index]) || nodeWidth;
            if (index > 0) childrenWidth += horizontalGap;
        }
        let childLeft = left + ((width - childrenWidth) / 2);

        for (const childId of children) {
            const childWidth = subtreeWidthById.get(childId) || nodeWidth;
            place(childId, childLeft, depth + 1);
            childLeft += childWidth + horizontalGap;
        }
    };

    if (normalized.rootId) {
        measure(normalized.rootId);
        place(normalized.rootId, 0, 0);
    }

    placeDetachedNodes(normalized, positions, {
        nodeWidth,
        nodeHeight,
        horizontalGap,
        verticalGap,
        preservePositions,
        existingPositions,
        onPreservedPosition: () => { hasPreservedPosition = true; }
    });
    const shouldCenter = options.center ?? !hasPreservedPosition;
    if (shouldCenter) centerLayout(positions);
    return positions;
}

/**
 * @param {NormalizedBehaviorTree} normalized
 * @param {Map<string, BehaviorTreePoint>} positions
 * @param {Required<Pick<BehaviorTreeLayoutOptions, 'nodeWidth'|'nodeHeight'|'horizontalGap'|'verticalGap'>> & {preservePositions:boolean, existingPositions:Map<string, BehaviorTreePoint>, onPreservedPosition?:() => void}} options
 */
function placeDetachedNodes(normalized, positions, options) {
    const detached = normalized.nodes.filter(node => !positions.has(node.id));
    if (!detached.length) return;

    let minX = 0;
    let maxX = 0;
    let minY = 0;
    for (const point of positions.values()) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
    }

    const stepY = options.nodeHeight + Math.max(32, options.verticalGap * 0.5);
    const leftX = minX - options.nodeWidth - (options.horizontalGap * 2);
    const rightX = maxX + options.nodeWidth + (options.horizontalGap * 2);
    const left = [];
    const right = [];

    for (const node of detached) {
        const targetY = dataTargetY(normalized, positions, node.id);
        if (targetY != null) {
            left.push({ node, desiredY: targetY });
            continue;
        }
        const sourceY = dataSourceY(normalized, positions, node.id);
        right.push({ node, desiredY: sourceY ?? minY + (right.length * stepY) });
    }

    placeDetachedColumn(left, leftX, stepY, positions, options);
    placeDetachedColumn(right, rightX, stepY, positions, options);
}

/**
 * @param {Array<{node:BehaviorTreeNode,desiredY:number}>} entries
 * @param {number} x
 * @param {number} stepY
 * @param {Map<string, BehaviorTreePoint>} positions
 * @param {{preservePositions:boolean, existingPositions:Map<string, BehaviorTreePoint>, onPreservedPosition?:() => void}} options
 */
function placeDetachedColumn(entries, x, stepY, positions, options) {
    entries.sort((a, b) => a.desiredY - b.desiredY);
    let nextY = Number.NEGATIVE_INFINITY;
    for (const entry of entries) {
        const node = entry.node;
        const configured = node.position;
        const existing = options.existingPositions.get(node.id);
        const y = Math.max(entry.desiredY, Number.isFinite(nextY) ? nextY : entry.desiredY);
        const fallback = { x, y };
        if (options.preservePositions && (configured || existing)) {
            options.onPreservedPosition?.();
            positions.set(node.id, { ...(configured || existing) });
        } else {
            positions.set(node.id, fallback);
        }
        nextY = y + stepY;
    }
}

/**
 * Return the average Y of positioned nodes consumed by a detached data source.
 *
 * @param {NormalizedBehaviorTree} normalized
 * @param {Map<string, BehaviorTreePoint>} positions
 * @param {string} nodeId
 */
function dataTargetY(normalized, positions, nodeId) {
    const ys = [];
    for (const edge of normalized.dataEdges || []) {
        if (edge.fromNodeId !== nodeId) continue;
        const target = positions.get(edge.toNodeId);
        if (target) ys.push(target.y);
    }
    return average(ys);
}

/**
 * Return the average Y of positioned nodes that feed a detached data target.
 *
 * @param {NormalizedBehaviorTree} normalized
 * @param {Map<string, BehaviorTreePoint>} positions
 * @param {string} nodeId
 */
function dataSourceY(normalized, positions, nodeId) {
    const ys = [];
    for (const edge of normalized.dataEdges || []) {
        if (edge.toNodeId !== nodeId) continue;
        const source = positions.get(edge.fromNodeId);
        if (source) ys.push(source.y);
    }
    return average(ys);
}

/** @param {number[]} values */
function average(values) {
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** @param {Map<string, BehaviorTreePoint>} positions */
function centerLayout(positions) {
    if (!positions.size) return;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;

    for (const point of positions.values()) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
    }

    const dx = -((minX + maxX) / 2);
    const dy = -minY + 80;
    for (const point of positions.values()) {
        point.x += dx;
        point.y += dy;
    }
}
