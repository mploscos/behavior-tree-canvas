import { BehaviorTreeCanvas } from "../src/index.js";

const nodeTypes = {
  Sequence: {
    label: "Sequence",
    category: "composite",
    minChildren: 1,
    maxChildren: null,
    color: "#60a5fa"
  },
  Fallback: {
    label: "Fallback",
    category: "composite",
    minChildren: 1,
    maxChildren: null,
    color: "#38bdf8"
  },
  Repeat: {
    label: "Repeat",
    category: "decorator",
    minChildren: 1,
    maxChildren: 1,
    color: "#c084fc",
    paramsSchema: {
      attempts: { label: "Attempts", type: "number", min: 1, required: true }
    },
    ports: {
      inputs: [{ id: "count", label: "count", dataType: "number" }]
    }
  },
  Compare: {
    label: "Condition",
    category: "condition",
    minChildren: 0,
    maxChildren: 0,
    color: "#fbbf24",
    paramsSchema: {
      operator: { label: "Operator", type: "select", options: [">", ">=", "<", "<=", "==", "!="], required: true }
    },
    ports: {
      inputs: [
        { id: "left", label: "left", dataType: "number" },
        { id: "right", label: "right", dataType: "number" }
      ]
    }
  },
  RunTask: {
    label: "Action",
    category: "action",
    minChildren: 0,
    maxChildren: 0,
    color: "#34d399",
    paramsSchema: {
      task: { label: "Task", type: "string", required: true }
    },
    ports: {
      inputs: [
        { id: "target", label: "target", dataType: "string" },
        { id: "priority", label: "priority", dataType: "number" }
      ]
    }
  },
  EmitEvent: {
    label: "Action",
    category: "action",
    minChildren: 0,
    maxChildren: 0,
    color: "#34d399",
    paramsSchema: {
      event: { label: "Event", type: "string", required: true }
    },
    ports: {
      inputs: [{ id: "message", label: "message", dataType: "string" }]
    }
  },
  BlackboardValue: {
    label: "Blackboard",
    category: "operation",
    minChildren: 0,
    maxChildren: 0,
    color: "#fb7185",
    paramsSchema: {
      key: { label: "Key", type: "string", required: true }
    },
    ports: {
      outputs: [{ id: "value", label: "value", dataType: "any" }]
    }
  },
  ConstantNumber: {
    label: "Number",
    category: "operation",
    minChildren: 0,
    maxChildren: 0,
    color: "#38bdf8",
    paramsSchema: {
      value: { label: "Value", type: "number", required: true }
    },
    ports: {
      outputs: [{ id: "value", label: "value", dataType: "number" }]
    }
  },
  ConstantText: {
    label: "Text",
    category: "operation",
    minChildren: 0,
    maxChildren: 0,
    color: "#a78bfa",
    paramsSchema: {
      value: { label: "Value", type: "string", required: true }
    },
    ports: {
      outputs: [{ id: "value", label: "value", dataType: "string" }]
    }
  }
};

const tree = {
  rootId: "root",
  nodeTypes,
  blackboard: {
    currentScore: 0.78,
    selectedTarget: "item-42"
  },
  nodes: [
    { id: "root", type: "Sequence", label: "Decision", category: "root", status: "running", children: ["isReady", "mainBranch"] },
    { id: "isReady", type: "Compare", label: "Score Above Threshold", status: "success", params: { operator: ">=" } },
    { id: "mainBranch", type: "Fallback", label: "Try Primary Or Notify", status: "running", children: ["repeatPrimary", "notify"] },
    { id: "repeatPrimary", type: "Repeat", label: "Retry Primary", status: "running", children: ["runPrimary"], params: { attempts: 3 } },
    { id: "runPrimary", type: "RunTask", label: "Run Primary Task", status: "running", params: { task: "primary" } },
    { id: "notify", type: "EmitEvent", label: "Notify Fallback", status: "idle", params: { event: "fallback" } },
    { id: "scoreValue", type: "BlackboardValue", label: "currentScore", category: "operation", params: { key: "currentScore" }, position: { x: -500, y: 112 } },
    { id: "thresholdValue", type: "ConstantNumber", label: "0.65", category: "operation", params: { value: 0.65 }, position: { x: -500, y: 196 } },
    { id: "targetValue", type: "BlackboardValue", label: "selectedTarget", category: "operation", params: { key: "selectedTarget" }, position: { x: -500, y: 360 } },
    { id: "priorityValue", type: "ConstantNumber", label: "priority 2", category: "operation", params: { value: 2 }, position: { x: -500, y: 444 } },
    { id: "repeatCount", type: "ConstantNumber", label: "3 attempts", category: "operation", params: { value: 3 }, position: { x: -500, y: 528 } },
    { id: "fallbackMessage", type: "ConstantText", label: "fallback message", category: "operation", params: { value: "fallback message" }, position: { x: -500, y: 612 } }
  ],
  edges: [
    { kind: "data", fromNodeId: "scoreValue", fromPortId: "value", toNodeId: "isReady", toPortId: "left" },
    { kind: "data", fromNodeId: "thresholdValue", fromPortId: "value", toNodeId: "isReady", toPortId: "right" },
    { kind: "data", fromNodeId: "targetValue", fromPortId: "value", toNodeId: "runPrimary", toPortId: "target" },
    { kind: "data", fromNodeId: "priorityValue", fromPortId: "value", toNodeId: "runPrimary", toPortId: "priority" },
    { kind: "data", fromNodeId: "repeatCount", fromPortId: "value", toNodeId: "repeatPrimary", toPortId: "count" },
    { kind: "data", fromNodeId: "fallbackMessage", fromPortId: "value", toNodeId: "notify", toPortId: "message" }
  ]
};

const target = document.getElementById("canvas");
const selection = document.getElementById("selection");
const palette = document.getElementById("palette");
const inspector = document.getElementById("inspector");
const diagnosticsPanel = document.getElementById("diagnostics-panel");
const undoButton = document.getElementById("undo");
const redoButton = document.getElementById("redo");
const exportButton = document.getElementById("export-json");
const importButton = document.getElementById("import-json");
const importFileInput = document.getElementById("import-json-file");
let generatedNodeCount = 0;
let pendingConnection = null;
let paletteSearch = "";
let selectedNodeId = "";
let selectedEdgeId = "";
let currentDiagnostics = [];
const statuses = ["idle", "running", "success", "failure", "skipped", "halted", "disabled", "unknown"];
const statusColors = {
  idle: "#64748b",
  running: "#38bdf8",
  success: "#22c55e",
  failure: "#ef4444",
  skipped: "#94a3b8",
  halted: "#f97316",
  disabled: "#475569",
  unknown: "#a78bfa"
};

const viewer = new BehaviorTreeCanvas({
  target,
  tree,
  nodeTypes,
  resizeTo: target
});

await viewer.mount();

viewer.on("selectionchange", ({ nodeId, node, nodeIds = [], edgeId }) => {
  selectedNodeId = nodeId || "";
  selectedEdgeId = edgeId || "";
  if (nodeIds.length > 1) selection.textContent = `${nodeIds.length} nodes selected`;
  else if (node) selection.textContent = `${nodeId} · ${node.type || "node"}`;
  else if (edgeId) selection.textContent = `${edgeId}`;
  else selection.textContent = "No selection";
  renderInspector(nodeIds.length > 1 ? null : node, edgeId);
});

viewer.on("diagnostics", ({ diagnostics }) => {
  currentDiagnostics = diagnostics;
  renderDiagnostics();
  renderInspector(selectedNodeId ? findDemoNode(selectedNodeId) : null, selectedEdgeId);
});

viewer.on("nodedrag", ({ nodeId, position }) => {
  const node = tree.nodes.find(item => item.id === nodeId);
  if (node) node.position = { ...position };
});

viewer.on("connectionstart", ({ port, suggestions }) => {
  hidePalette();
  selection.textContent = `${port.nodeId}.${port.id} · ${suggestions.length}`;
});

viewer.on("connectionrequest", request => {
  pendingConnection = { kind: "data", ...request };
  showPalette(pendingConnection);
});

viewer.on("connectioncancel", () => {
  hidePalette();
});

viewer.on("portconnect", ({ from, to }) => {
  hidePalette();
  selection.textContent = `${from.nodeId}.${from.id} -> ${to.nodeId}.${to.id}`;
});

viewer.on("childconnectionstart", ({ nodeId, portKind, suggestions }) => {
  hidePalette();
  selection.textContent = `${nodeId}.${portKind} · ${suggestions.length}`;
});

viewer.on("childconnectionrequest", request => {
  pendingConnection = { kind: "child", ...request };
  showPalette(pendingConnection);
});

viewer.on("childconnect", ({ parentId, childId, reparent }) => {
  hidePalette();
  selection.textContent = reparent ? `${childId} -> ${parentId}` : `${parentId} -> ${childId}`;
});

viewer.on("treechange", ({ tree: nextTree }) => {
  Object.assign(tree, nextTree);
  renderInspector(selectedNodeId ? findDemoNode(selectedNodeId) : null, selectedEdgeId);
});

viewer.on("historychange", ({ canUndo, canRedo }) => {
  undoButton.disabled = !canUndo;
  redoButton.disabled = !canRedo;
});

document.getElementById("fit").addEventListener("click", () => viewer.fit());
document.getElementById("arrange").addEventListener("click", () => viewer.arrange());
undoButton.addEventListener("click", () => viewer.undo());
redoButton.addEventListener("click", () => viewer.redo());
exportButton.addEventListener("click", () => exportTreeJson());
importButton.addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", () => importTreeJson(importFileInput.files?.[0]));

document.addEventListener("pointerdown", event => {
  if (palette.hidden) return;
  if (event.button === 2) {
    event.preventDefault();
    cancelPalette();
    return;
  }
  if (!palette.contains(event.target)) cancelPalette();
});

document.addEventListener("contextmenu", event => {
  if (palette.hidden) return;
  event.preventDefault();
  cancelPalette();
});

document.addEventListener("keydown", event => {
  const textInput = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
  if (event.key === "Escape" && !palette.hidden) {
    event.preventDefault();
    cancelPalette();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
    if (viewer.undo()) event.preventDefault();
    return;
  }
  if (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") || ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "z")) {
    if (viewer.redo()) event.preventDefault();
    return;
  }
  if (!textInput && event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
    const childEdge = parseChildEdgeId(selectedEdgeId);
    const delta = event.key === "ArrowLeft" ? -1 : 1;
    if (childEdge && viewer.moveChildRelative(childEdge.parentId, childEdge.childId, delta)) {
      event.preventDefault();
    }
    return;
  }
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  if (textInput) return;
  if (viewer.deleteSelection()) {
    event.preventDefault();
    hidePalette();
  }
}, true);

function showPalette(request) {
  pendingConnection = request;
  paletteSearch = "";
  renderPalette();
}

function renderPalette() {
  palette.replaceChildren();
  if (!pendingConnection?.suggestions?.length) {
    hidePalette();
    return;
  }

  const heading = document.createElement("div");
  heading.className = "palette-heading";
  heading.textContent = pendingConnection.kind === "child" ? "Create child" : "Create connected node";
  palette.appendChild(heading);

  if (pendingConnection.suggestions.length > 6) {
    const search = document.createElement("input");
    search.className = "palette-search";
    search.type = "search";
    search.placeholder = "Filter nodes";
    search.value = paletteSearch;
    search.addEventListener("input", () => {
      paletteSearch = search.value;
      renderPalette();
    });
    palette.appendChild(search);
    requestAnimationFrame(() => {
      if (!palette.hidden) search.focus({ preventScroll: true });
    });
  }

  const suggestions = filterPaletteSuggestions(pendingConnection.suggestions, paletteSearch);
  if (!suggestions.length) {
    const empty = document.createElement("div");
    empty.className = "palette-empty";
    empty.textContent = "No compatible nodes";
    palette.appendChild(empty);
  } else {
    for (const [category, items] of groupPaletteSuggestions(suggestions)) {
      const group = document.createElement("section");
      group.className = "palette-group";
      const label = document.createElement("div");
      label.className = "palette-group-label";
      label.textContent = category;
      group.appendChild(label);
      for (const suggestion of items) {
        group.appendChild(paletteButton(suggestion));
      }
      palette.appendChild(group);
    }
  }

  palette.hidden = false;
  palette.style.visibility = "hidden";
  requestAnimationFrame(() => {
    if (palette.hidden) return;
    placePalette(pendingConnection?.screen || { x: 0, y: 0 });
    palette.style.visibility = "";
  });
}

function paletteButton(suggestion) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "palette-item";
  button.addEventListener("click", () => createSuggestedNode(suggestion));

  const swatch = document.createElement("span");
  swatch.className = "palette-swatch";
  swatch.style.background = suggestion.nodeType.color || "#64748b";

  const text = document.createElement("span");
  text.className = "palette-text";
  const name = document.createElement("strong");
  name.textContent = suggestion.label || suggestion.nodeType.label || suggestion.typeId;
  const meta = document.createElement("span");
  meta.textContent = suggestion.typeId;
  text.append(name, meta);
  button.append(swatch, text);
  return button;
}

function filterPaletteSuggestions(suggestions, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return suggestions;
  return suggestions.filter(suggestion => {
    const label = String(suggestion.label || suggestion.nodeType.label || "").toLowerCase();
    const typeId = String(suggestion.typeId || "").toLowerCase();
    const category = String(suggestion.category || suggestion.nodeType.category || "").toLowerCase();
    return label.includes(needle) || typeId.includes(needle) || category.includes(needle);
  });
}

function groupPaletteSuggestions(suggestions) {
  const groups = new Map();
  for (const suggestion of suggestions) {
    const category = normalizePaletteCategory(suggestion.category || suggestion.nodeType.category);
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(suggestion);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function normalizePaletteCategory(value) {
  const text = String(value || "Other").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : "Other";
}

function placePalette(screen) {
  const margin = 8;
  const width = palette.offsetWidth || 260;
  const height = palette.offsetHeight || 320;
  const x = clampNumber(Math.round(screen.x + 12), margin, Math.max(margin, window.innerWidth - width - margin));
  const y = clampNumber(Math.round(screen.y + 12), margin, Math.max(margin, window.innerHeight - height - margin));
  palette.style.left = `${x}px`;
  palette.style.top = `${y}px`;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function renderInspector(node, edgeId = "") {
  inspector.replaceChildren();
  if (!node) {
    const empty = document.createElement("div");
    empty.className = "inspector-empty";
    empty.textContent = edgeId ? "Edge selected" : "No selection";
    inspector.appendChild(empty);
    renderDiagnostics();
    return;
  }

  const type = nodeTypes[node.type] || {};
  const title = document.createElement("div");
  title.className = "inspector-title";
  const dot = document.createElement("span");
  dot.className = "status-dot";
  dot.style.background = statusColors[node.status || "idle"] || statusColors.unknown;
  const name = document.createElement("strong");
  name.textContent = node.label || node.name || node.id;
  title.append(dot, name);
  inspector.appendChild(title);

  inspector.appendChild(field("Id", readonlyInput(node.id)));
  inspector.appendChild(field("Label", textInput(node.label || "", value => viewer.updateNode(node.id, { label: value }))));

  const typeSelect = selectInput(Object.keys(nodeTypes), node.type || "", value => {
    const nextType = nodeTypes[value] || {};
    viewer.updateNode(node.id, { type: value, category: nextType.category || node.category });
  });
  const statusSelect = selectInput(statuses, node.status || "idle", value => viewer.updateNode(node.id, { status: value }));
  const row = document.createElement("div");
  row.className = "field-row";
  row.append(field("Type", typeSelect), field("Status", statusSelect));
  inspector.appendChild(row);

  const category = type.category || node.category || "";
  if (category) inspector.appendChild(field("Category", readonlyInput(category)));

  const schema = type.paramsSchema || {};
  const schemaKeys = Object.keys(schema);
  if (schemaKeys.length) {
    inspector.appendChild(sectionLabel("Params"));
    for (const key of schemaKeys) {
      const definition = normalizeParamDefinition(schema[key]);
      const value = node.params?.[key] ?? definition.default ?? "";
      inspector.appendChild(field(definition.label || key, paramInput(definition, value, nextValue => {
        viewer.updateNodeParams(node.id, { [key]: nextValue });
      })));
    }
    renderDiagnostics();
    return;
  }

  inspector.appendChild(sectionLabel("Params"));
  inspector.appendChild(jsonParamsField(node));
  renderDiagnostics();
}

function renderDiagnostics() {
  diagnosticsPanel.replaceChildren();
  const header = document.createElement("div");
  header.className = "diagnostics-header";
  const title = document.createElement("span");
  title.textContent = "Diagnostics";
  const count = document.createElement("span");
  count.textContent = String(currentDiagnostics.length);
  header.append(title, count);
  diagnosticsPanel.appendChild(header);

  if (!currentDiagnostics.length) {
    const empty = document.createElement("div");
    empty.className = "inspector-empty";
    empty.textContent = "No diagnostics";
    diagnosticsPanel.appendChild(empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "diagnostic-list";
  for (const diagnostic of currentDiagnostics) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `diagnostic-item ${diagnostic.severity}`;
    item.disabled = !diagnostic.nodeId;
    item.addEventListener("click", () => {
      if (diagnostic.nodeId) viewer.selectNode(diagnostic.nodeId);
    });
    const dot = document.createElement("span");
    dot.className = "diagnostic-dot";
    const content = document.createElement("span");
    const message = document.createElement("span");
    message.className = "diagnostic-message";
    message.textContent = diagnostic.message;
    content.appendChild(message);
    if (diagnostic.nodeId || diagnostic.portId) {
      const meta = document.createElement("div");
      meta.className = "diagnostic-meta";
      meta.textContent = diagnostic.portId || diagnostic.nodeId;
      content.appendChild(meta);
    }
    item.append(dot, content);
    list.appendChild(item);
  }
  diagnosticsPanel.appendChild(list);
}

function field(labelText, control) {
  const wrapper = document.createElement("div");
  wrapper.className = "field";
  const label = document.createElement("label");
  label.textContent = labelText;
  wrapper.append(label, control);
  return wrapper;
}

function sectionLabel(text) {
  const label = document.createElement("div");
  label.className = "section-label";
  label.textContent = text;
  return label;
}

function readonlyInput(value) {
  const input = document.createElement("input");
  input.readOnly = true;
  input.value = String(value ?? "");
  return input;
}

function textInput(value, onChange) {
  const input = document.createElement("input");
  input.value = String(value ?? "");
  input.addEventListener("change", () => onChange(input.value));
  return input;
}

function numberInput(value, onChange) {
  const input = document.createElement("input");
  input.type = "number";
  input.value = value === "" || value == null ? "" : String(value);
  input.addEventListener("change", () => onChange(input.value === "" ? null : Number(input.value)));
  return input;
}

function checkboxInput(value, onChange) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = value === true;
  input.addEventListener("change", () => onChange(input.checked));
  return input;
}

function selectInput(options, value, onChange) {
  const select = document.createElement("select");
  for (const optionValue of options) {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionValue;
    select.appendChild(option);
  }
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

function paramInput(definition, value, onChange) {
  if (definition.type === "number") return numberInput(value, onChange);
  if (definition.type === "boolean") return checkboxInput(value, onChange);
  if (definition.type === "select") return selectInput(definition.options || [], String(value ?? ""), onChange);
  return textInput(value, onChange);
}

function jsonParamsField(node) {
  const wrapper = document.createElement("div");
  const textarea = document.createElement("textarea");
  textarea.value = JSON.stringify(node.params || {}, null, 2);
  const error = document.createElement("div");
  error.className = "inspector-error";
  textarea.addEventListener("change", () => {
    try {
      error.textContent = "";
      viewer.updateNode(node.id, { params: JSON.parse(textarea.value || "{}") });
    } catch (reason) {
      error.textContent = "Invalid JSON";
    }
  });
  wrapper.append(textarea, error);
  return field("JSON", wrapper);
}

function normalizeParamDefinition(value) {
  if (typeof value === "string") return { type: value };
  if (value && typeof value === "object") return value;
  return { type: "string" };
}

function hidePalette() {
  palette.hidden = true;
  paletteSearch = "";
  pendingConnection = null;
}

function cancelPalette() {
  viewer.cancelConnection();
  hidePalette();
}

function exportTreeJson() {
  const blob = new Blob([viewer.toJSON(2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "behavior-tree.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importTreeJson(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const nextTree = viewer.loadJSON(text);
    Object.assign(tree, nextTree);
    selectedNodeId = "";
    selectedEdgeId = "";
    hidePalette();
    renderInspector(null);
  } catch (reason) {
    selection.textContent = "Invalid JSON";
  } finally {
    importFileInput.value = "";
  }
}

function createSuggestedNode(suggestion) {
  if (!pendingConnection) return;
  if (pendingConnection.kind === "child") {
    createSuggestedChildNode(suggestion);
    return;
  }
  const sourcePort = pendingConnection.port;
  const targetPort = suggestion.ports[0];
  const nodeId = `${suggestion.typeId}-${++generatedNodeCount}`;
  const node = {
    id: nodeId,
    type: suggestion.typeId,
    label: suggestion.nodeType.label || suggestion.typeId,
    category: suggestion.nodeType.category || "operation",
    position: nextNodePosition(pendingConnection, suggestion)
  };

  viewer.editTree(model => {
    model.nodes.push(node);
    model.edges ||= [];
    if (sourcePort.direction === "output") {
      model.edges.push({
        kind: "data",
        fromNodeId: sourcePort.nodeId,
        fromPortId: sourcePort.id,
        toNodeId: nodeId,
        toPortId: targetPort.id
      });
    } else {
      model.edges.push({
        kind: "data",
        fromNodeId: nodeId,
        fromPortId: targetPort.id,
        toNodeId: sourcePort.nodeId,
        toPortId: sourcePort.id
      });
    }
  }, "create-node");
  hidePalette();
  viewer.selectNode(nodeId);
}

function createSuggestedChildNode(suggestion) {
  if (!pendingConnection?.parentId) return;
  const nodeId = `${suggestion.typeId}-${++generatedNodeCount}`;
  const node = {
    id: nodeId,
    type: suggestion.typeId,
    label: suggestion.nodeType.label || suggestion.typeId,
    category: suggestion.nodeType.category || "action",
    position: nextNodePosition(pendingConnection, suggestion)
  };
  viewer.createChildNode(pendingConnection.parentId, node);
  hidePalette();
}

function nextNodePosition(request, suggestion) {
  if (request.kind === "child") {
    const port = request.portWorld || request.world;
    return avoidNodeOverlap({ x: port.x, y: port.y + 150 }, suggestion);
  }
  const side = request.port.direction === "input" ? -1 : 1;
  const port = request.portWorld || request.world;
  const preferred = {
    x: port.x + (side * 300),
    y: port.y
  };
  return avoidNodeOverlap(preferred, suggestion);
}

function avoidNodeOverlap(preferred, suggestion) {
  const width = 220;
  const height = estimatedNodeHeight(suggestion);
  const gap = 24;
  const candidates = [0, 1, -1, 2, -2, 3, -3, 4, -4].map(step => ({
    x: preferred.x,
    y: preferred.y + (step * (height + gap))
  }));

  for (const candidate of candidates) {
    if (!overlapsAnyNode(candidate, width, height, gap)) return candidate;
  }
  return candidates.at(-1);
}

function overlapsAnyNode(point, width, height, gap) {
  return tree.nodes.some(node => {
    const position = node.position;
    if (!position) return false;
    const nodeHeight = estimatedExistingNodeHeight(node);
    return Math.abs(position.x - point.x) < ((width + 220) / 2 + gap) &&
      Math.abs(position.y - point.y) < ((height + nodeHeight) / 2 + gap);
  });
}

function estimatedNodeHeight(suggestion) {
  const inputCount = suggestion.nodeType.ports?.inputs?.length || 0;
  const outputCount = suggestion.nodeType.ports?.outputs?.length || 0;
  return Math.max(66, 34 + (Math.max(inputCount, outputCount) * 16));
}

function estimatedExistingNodeHeight(node) {
  const type = nodeTypes[node.type] || {};
  return estimatedNodeHeight({ nodeType: type });
}

function parseChildEdgeId(edgeId) {
  const match = String(edgeId || "").match(/^child:(.+)->(.+)$/);
  if (!match) return null;
  return { parentId: match[1], childId: match[2] };
}

function findDemoNode(nodeId) {
  return tree.nodes.find(node => node.id === nodeId) || null;
}
