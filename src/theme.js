export const STATUS_COLOR = {
    idle: "#64748b",
    running: "#38bdf8",
    success: "#22c55e",
    failure: "#ef4444",
    skipped: "#94a3b8",
    halted: "#f59e0b",
    disabled: "#475569",
    unknown: "#64748b"
};

export const CATEGORY_COLOR = {
    root: "#f8fafc",
    composite: "#60a5fa",
    decorator: "#c084fc",
    action: "#34d399",
    condition: "#fbbf24",
    subtree: "#2dd4bf",
    operation: "#fb7185",
    unknown: "#94a3b8"
};

export const NODE_VIEW_THEME = {
    fontFamily: "Inter, system-ui, sans-serif",
    textResolution: 2,
    label: {
        fontSize: 13,
        fill: "#f8fafc",
        fontWeight: "700",
        align: "center",
        y: -7,
        lineHeight: 16,
        wordWrapPadding: 34,
        letterSpacing: 0
    },
    typeLabel: {
        fontSize: 9,
        fill: "#cbd5e1",
        fontWeight: "700",
        align: "center",
        y: 14,
        alpha: 0.78,
        letterSpacing: 0
    },
    hitArea: {
        horizontalPadding: 12
    },
    hoverAlpha: 0.94,
    normalAlpha: 1,
    executionPortHitArea: 24,
    dataPortHitArea: 20,
    portLabel: {
        gap: 13,
        maxVisible: 7,
        fontSize: 10,
        fill: "#e2e8f0",
        fontWeight: "600",
        inputAlign: "left",
        outputAlign: "right",
        letterSpacing: 0,
        paddingX: 5,
        paddingY: 2,
        radius: 4,
        background: "#0b1120",
        backgroundAlpha: 0.74,
        stroke: "#1e293b",
        strokeWidth: 0.6,
        strokeAlpha: 0.85
    },
    badge: {
        fontSize: 9,
        fontWeight: "800",
        align: "center",
        letterSpacing: 0,
        minWidth: 18,
        height: 15,
        horizontalPadding: 11,
        radius: 6,
        strokeWidth: 0.9,
        strokeAlpha: 0.92,
        childOrder: {
            xInset: 28,
            yInset: 10,
            fill: "#0f172a",
            stroke: "#475569",
            textFill: "#cbd5e1",
            alpha: 0.86
        },
        childCapacity: {
            xInset: 6,
            yInset: 10,
            availableFill: "#052e1a",
            fullFill: "#111827",
            availableStroke: "#22c55e",
            fullStroke: "#64748b",
            availableTextFill: "#bbf7d0",
            fullTextFill: "#cbd5e1",
            availableAlpha: 0.9,
            fullAlpha: 0.72,
            anchorX: 1
        }
    }
};

export const DRAWING_THEME = {
    node: {
        radius: 7,
        fill: "#111827",
        disabledFill: "#0f172a",
        fillAlpha: 0.96,
        disabledFillAlpha: 0.72,
        stroke: "#334155",
        selectedStroke: "#e2e8f0",
        strokeAlpha: 0.9,
        activeStrokeAlpha: 1,
        strokeWidth: 1.2,
        selectedStrokeWidth: 2.4,
        validationStrokeWidth: 2,
        validationError: "#fb7185",
        validationWarning: "#fbbf24",
        accentWidth: 8,
        accentInset: 1,
        accentRadius: 6,
        accentAlpha: 0.88,
        disabledAccentAlpha: 0.32,
        statusRadius: 4.6,
        statusRight: 12,
        statusTop: 12,
        statusAlpha: 0.95,
        disabledStatusAlpha: 0.42,
        statusStroke: "#020617",
        statusStrokeWidth: 1,
        statusStrokeAlpha: 0.9
    },
    port: {
        size: 10.4,
        activeSize: 12.8,
        radius: 3,
        haloPadding: 4,
        haloRadius: 5,
        normalStroke: "#020617",
        activeStroke: "#e0f2fe",
        invalidStroke: "#ef4444",
        normalStrokeWidth: 1.2,
        activeStrokeWidth: 2.1,
        normalAlpha: 0.96,
        activeAlpha: 0.98,
        compatibleAlpha: 1,
        compatibleHalo: "#22d3ee",
        compatibleHaloAlpha: 0.12,
        hoverHaloAlpha: 0.22,
        invalidHalo: "#ef4444",
        invalidHaloAlpha: 0.16,
        strokeAlpha: 0.96
    },
    executionPort: {
        size: 10.4,
        activeSize: 12.4,
        radius: 3,
        haloPadding: 4,
        haloRadius: 5,
        childFill: "#94a3b8",
        parentFill: "#64748b",
        availableFill: "#22c55e",
        fullFill: "#475569",
        fullAlpha: 0.82,
        normalAlpha: 0.96,
        normalStroke: "#020617",
        availableStroke: "#bbf7d0",
        fullStroke: "#94a3b8",
        activeStroke: "#bbf7d0",
        invalidStroke: "#ef4444",
        normalStrokeWidth: 1.2,
        activeStrokeWidth: 2.1,
        strokeAlpha: 0.96,
        compatibleHalo: "#22c55e",
        compatibleHaloAlpha: 0.12,
        hoverHaloAlpha: 0.22,
        invalidHalo: "#ef4444",
        invalidHaloAlpha: 0.16
    }
};

export const CANVAS_THEME = {
    background: "#0b1120",
    backgroundAlpha: 1,
    grid: {
        span: 6000,
        minorStep: 40,
        majorEvery: 5,
        minorWidth: 0.6,
        majorWidth: 1.2,
        minorColor: "#1e293b",
        majorColor: "#334155",
        minorAlpha: 0.42,
        majorAlpha: 0.58
    },
    childEdge: {
        idleColor: "#64748b",
        hitWidth: 8,
        selectedHitWidth: 10,
        hitColor: "#020617",
        hitAlpha: 0.001,
        width: 2,
        runningWidth: 3,
        selectedWidth: 3.6,
        selectedColor: "#e0f2fe",
        alpha: 0.9,
        idleAlpha: 0.58,
        selectedAlpha: 0.95
    },
    dataEdge: {
        curveMinDx: 56,
        curveFactor: 0.38,
        hitWidth: 6,
        selectedHitWidth: 8,
        hitColor: "#020617",
        hitAlpha: 0.001,
        width: 1.8,
        selectedWidth: 3.2,
        selectedColor: "#e0f2fe",
        compatibleColor: "#7c8aa3",
        incompatibleColor: "#f97316",
        alpha: 0.62,
        selectedAlpha: 0.95,
        endpointRadius: 2.8,
        endpointAlpha: 0.88
    },
    connectionPreview: {
        validColor: "#22d3ee",
        invalidColor: "#ef4444",
        emptyColor: "#94a3b8",
        curveMinDx: 48,
        curveFactor: 0.4,
        width: 2.4,
        targetAlpha: 0.95,
        emptyAlpha: 0.68
    },
    selectionBox: {
        fill: "#38bdf8",
        fillAlpha: 0.1,
        stroke: "#7dd3fc",
        strokeAlpha: 0.85,
        strokeWidth: 1.2
    },
    animation: {
        enabled: true,
        enterOnMount: true,
        enterDurationMs: 160,
        enterScale: 0.96,
        runningPulse: true,
        pulseDurationMs: 1100,
        runningNodeMinAlpha: 0.9,
        runningNodeMaxAlpha: 1,
        runningEdgeMinAlpha: 0.78,
        runningEdgeMaxAlpha: 1,
        executionFlow: true,
        flowColor: "#f8fafc",
        flowAlpha: 0.92,
        flowParticleRadius: 3.2,
        flowTrailLength: 0.2,
        flowTrailSteps: 7,
        flowDurationMs: 900
    }
};

export const DEFAULT_BEHAVIOR_TREE_THEME = {
    statusColor: STATUS_COLOR,
    categoryColor: CATEGORY_COLOR,
    nodeView: NODE_VIEW_THEME,
    drawing: DRAWING_THEME,
    canvas: CANVAS_THEME
};

/** @param {Record<string, any>} [overrides] */
export function createBehaviorTreeTheme(overrides = {}) {
    return mergeTheme(DEFAULT_BEHAVIOR_TREE_THEME, overrides);
}

/** @param {string | undefined} value */
export function normalizeCategory(value) {
    const key = String(value || "unknown").toLowerCase();
    return /** @type {keyof typeof CATEGORY_COLOR} */ (
        Object.prototype.hasOwnProperty.call(CATEGORY_COLOR, key) ? key : "unknown"
    );
}

/** @param {string | undefined} value */
export function normalizeStatus(value) {
    const key = String(value || "idle").toLowerCase();
    return /** @type {keyof typeof STATUS_COLOR} */ (
        Object.prototype.hasOwnProperty.call(STATUS_COLOR, key) ? key : "unknown"
    );
}

const COLOR_CACHE = new Map();

/**
 * @param {number|string|undefined} value
 * @param {number|string} fallback
 * @returns {number}
 */
export function toColor(value, fallback) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const key = value.trim().toLowerCase();
        if (COLOR_CACHE.has(key)) return COLOR_CACHE.get(key);
        const hex = key.replace(/^#/, "");
        const parsed = Number.parseInt(hex, 16);
        if (Number.isFinite(parsed)) {
            COLOR_CACHE.set(key, parsed);
            return parsed;
        }
    }
    return typeof fallback === "string" ? toColor(fallback, 0) : fallback;
}

/** @param {string | undefined} dataType */
export function portColor(dataType) {
    const type = String(dataType || "any").toLowerCase();
    if (type === "number" || type === "float" || type === "integer") return "#38bdf8";
    if (type === "boolean" || type === "bool") return "#fbbf24";
    if (type === "string") return "#a78bfa";
    if (type === "vector" || type === "vector2" || type === "vector3" || type === "point") return "#34d399";
    if (type === "entity" || type === "object") return "#fb7185";
    return "#94a3b8";
}

/**
 * @param {string | undefined} a
 * @param {string | undefined} b
 */
export function areSameDataType(a, b) {
    const left = String(a || "any").toLowerCase();
    const right = String(b || "any").toLowerCase();
    return left === right || left === "any" || right === "any";
}

function mergeTheme(base, overrides) {
    const result = {};
    for (const [key, value] of Object.entries(base || {})) {
        result[key] = isPlainObject(value) ? mergeTheme(value, {}) : value;
    }
    for (const [key, value] of Object.entries(overrides || {})) {
        result[key] = isPlainObject(value) && isPlainObject(result[key])
            ? mergeTheme(result[key], value)
            : value;
    }
    return result;
}

function isPlainObject(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
}
