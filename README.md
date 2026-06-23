# behavior-tree-canvas

PixiJS viewer/editor for behavior trees.

It renders behavior tree nodes, execution links, typed data ports, data links,
pan/zoom, selection, drag editing, validation, history and a small host-facing
event API. The canvas is UI-framework agnostic: applications provide their own
palette, inspector, toolbar and persistence.

## Quick Start

```js
import { BehaviorTreeCanvas } from "behavior-tree-canvas";

const viewer = new BehaviorTreeCanvas({
  target: document.getElementById("tree"),
  tree: {
    rootId: "root",
    nodeTypes: {
      Sequence: { category: "composite", minChildren: 1, maxChildren: null },
      MoveTo: { category: "action", minChildren: 0, maxChildren: 0 }
    },
    nodes: [
      { id: "root", type: "Sequence", label: "Plan", children: ["move"] },
      { id: "move", type: "MoveTo", label: "Move to point" }
    ]
  }
});

await viewer.mount();
```

## Model

A tree model has node type definitions, nodes and optional edges.

```js
const tree = {
  rootId: "root",
  nodeTypes: {
    Compare: {
      category: "condition",
      maxChildren: 0,
      ports: {
        inputs: [
          { id: "left", dataType: "number", required: true },
          { id: "right", dataType: "number", required: true }
        ]
      },
      paramsSchema: {
        operator: { type: "select", options: [">", ">=", "<", "<="] }
      }
    },
    NumberValue: {
      category: "operation",
      maxChildren: 0,
      ports: {
        outputs: [{ id: "value", dataType: "number" }]
      }
    }
  },
  nodes: [
    { id: "root", type: "Compare", params: { operator: ">=" } },
    { id: "threshold", type: "NumberValue", params: { value: 0.75 } }
  ],
  edges: [
    {
      kind: "data",
      fromNodeId: "threshold",
      fromPortId: "value",
      toNodeId: "root",
      toPortId: "right"
    }
  ]
};
```

Execution children are stored in `children`, `parentId` or child edges. Data
links are stored as `edges` with `kind: "data"`.

Input ports accept one connection by default. Use `maxConnections: null`,
`multiple: true` or `acceptsMany: true` for multi-input ports.

## User Interaction

- Drag the canvas to pan.
- Use the mouse wheel to zoom.
- Drag nodes to move them.
- Drag data ports to connect compatible inputs and outputs.
- Drag execution ports to connect or reparent parent/child nodes.
- Use `Shift`, `Ctrl` or `Cmd` click for multi-selection.
- Use `Shift` drag on empty canvas for marquee selection.
- Press `Delete` or `Backspace` in the host app to call `deleteSelection()`.
- Press `Esc` or dismiss the host palette to call `cancelConnection()`.

## Host Integration

The canvas does not render a node palette or property inspector internally.
Hosts wire those controls through events and methods.

```js
viewer.on("selectionchange", ({ node, nodeIds, edge }) => {
  // Update an external inspector.
});

viewer.on("connectionrequest", request => {
  // Open a palette at request.screen.
  // request.suggestions contains compatible node types and ports.
});

viewer.on("childconnectionrequest", request => {
  // Open a palette for child node creation.
});

viewer.on("treechange", ({ tree }) => {
  // Persist or mirror the edited model.
});
```

Common commands:

```js
viewer.updateNode(nodeId, { label: "New label" });
viewer.updateNodeParams(nodeId, { speed: 12 });
viewer.connectPorts("source:value", "target:input");
viewer.createChildNode("parent", { id: "child", type: "Action" });
viewer.deleteSelection();
viewer.undo();
viewer.redo();
viewer.arrange();
viewer.fit();
```

Execution flow can be driven from runtime events. If no explicit flow is set,
links to nodes with `status: "running"` are animated by default.

```js
viewer.setExecutionFlow({
  nodeIds: ["root", "selectTarget", "moveToTarget"],
  edgeIds: ["child:root->selectTarget"]
});

viewer.clearExecutionFlow();
```

When a host palette is cancelled:

```js
viewer.cancelConnection();
```

## Persistence

```js
const snapshot = viewer.getTree();
const json = viewer.toJSON(2);

viewer.loadTree(snapshot);
viewer.loadJSON(json);
```

`getTree()` returns a copy. `loadTree()` and `loadJSON()` replace the current
model, clear selection, re-render and emit `treechange`.

## Validation

```js
import { validateBehaviorTree } from "behavior-tree-canvas";

const diagnostics = validateBehaviorTree(tree);
```

Diagnostics include `severity`, `code`, `message` and optional node, edge, port
or path references. The canvas also emits diagnostics after render and marks
nodes with warning/error borders.

## Theme

Pass partial theme overrides when creating the canvas or later with
`setTheme()`.

```js
const viewer = new BehaviorTreeCanvas({
  target,
  tree,
  theme: {
    nodeView: {
      badge: {
        childOrder: { xInset: 30 }
      }
    },
    canvas: {
      background: "#07111f",
      animation: {
        enabled: true,
        runningPulse: true,
        executionFlow: true
      }
    }
  }
});

viewer.setTheme({
  canvas: {
    background: "#0b1220",
    animation: { enabled: false }
  }
});
```

## Demo

From this directory:

```bash
npm install
npm run demo
```

Open `http://localhost:4174/demo/`.

After changing source files, rebuild the demo bundle with:

```bash
npm run demo:build
```
