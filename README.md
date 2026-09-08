# Behavior Tree Canvas

**Build interactive behavior tree editors and visualize execution in your web app.**

Connect actions and conditions, wire typed data ports, and follow running branches
on a PixiJS canvas. Use plain JavaScript or bring your own UI framework; TypeScript
declarations are included.

[Install](#install) · [Your first tree](#your-first-tree) · [Try the demo](#try-the-demo) · [API reference](#api-reference)

![Demo showing a behavior tree with typed data connections, animated execution links, and node selection updating the inspector.](https://raw.githubusercontent.com/mploscos/behavior-tree-canvas/main/docs/assets/demo.gif)

*Recorded from the included demo. Its toolbar, palette and inspector show how to
build an application around the canvas.* [View a still image](https://raw.githubusercontent.com/mploscos/behavior-tree-canvas/main/docs/assets/demo.png).

## What you can build

- **Visual editors:** drag nodes, connect execution branches, reparent children and wire compatible data ports.
- **Runtime viewers:** show node status and animate active execution paths, with an optional read-only canvas.
- **Editing tools:** combine selection, automatic layout, undo/redo and JSON import/export with your own controls.
- **Domain-specific workflows:** define node types, child limits, typed inputs/outputs and parameter schemas, with validation feedback.

The library renders and edits the tree. Your application supplies the behavior
execution engine, toolbar, palette, inspector and storage. The [demo](./demo/main.js)
includes working examples of these UI controls.

## Install

```bash
npm install behavior-tree-canvas pixi.js@^8
```

PixiJS 8 is a peer dependency. Use a browser application with an ES module bundler
to resolve the package imports below. Create and mount the viewer on the client,
after its container is in the document.

## Your first tree

Give the canvas a container with an explicit height:

```html
<div id="tree" style="width: 100%; height: 560px;"></div>
```

Then add this to your application's JavaScript entry point:

```js
import { BehaviorTreeCanvas } from "behavior-tree-canvas";

const tree = {
  rootId: "root",
  nodeTypes: {
    Sequence: { category: "composite", minChildren: 1, maxChildren: null },
    Condition: { category: "condition", maxChildren: 0 },
    Action: { category: "action", maxChildren: 0 }
  },
  nodes: [
    { id: "root", type: "Sequence", label: "Patrol", children: ["ready", "move"] },
    { id: "ready", type: "Condition", label: "Path clear?" },
    { id: "move", type: "Action", label: "Move to waypoint" }
  ]
};

const target = document.getElementById("tree");
const viewer = new BehaviorTreeCanvas({ target, tree });
await viewer.mount();
```

The viewer arranges the nodes, fits the tree and follows the container's size by
default. You can now select and drag nodes, pan the canvas and zoom with the wheel.

When the view is removed, release its canvas, listeners and PixiJS application:

```js
viewer.destroy();
```

In a UI framework, create the viewer after the component mounts and call
`destroy()` during cleanup, once `mount()` has completed. Create a new viewer for
a new view.

## Try the demo

```bash
git clone https://github.com/mploscos/behavior-tree-canvas.git
cd behavior-tree-canvas
npm install
npm run demo
```

Open [localhost:4174/demo/](http://localhost:4174/demo/). The demo command uses
Python 3 to serve the files locally.

Select a node to edit its properties, drag a port onto empty space to open a
compatible-node palette, or use **Arrange**, **Undo**, **Redo**, **Export** and
**Import**. The demo's status values illustrate runtime visualization; they are
sample data, not a running behavior engine.

After changing library or demo code, run `npm run demo:build` and refresh the page.

### Canvas controls

| Action | Gesture |
| --- | --- |
| Pan | Drag empty canvas |
| Zoom | Mouse wheel |
| Move a node | Drag the node |
| Select multiple nodes | Shift, Ctrl or Cmd + click |
| Select an area | Shift + drag empty canvas |
| Connect data | Drag between compatible data ports |
| Connect or reparent a child | Drag execution ports |

Keyboard shortcuts belong to the application. The demo wires Delete/Backspace to
`deleteSelection()`, Ctrl/Cmd+Z to `undo()`, and Escape to dismiss its palette and
call `cancelConnection()`.

## Common tasks

The following examples continue from the `viewer` and `tree` above.

### Edit and arrange a tree

```js
viewer.updateNode("move", { label: "Move to checkpoint" });
viewer.updateNodeParams("move", { speed: 12 });
viewer.createChildNode("root", { id: "report", type: "Action", label: "Report arrival" });

viewer.arrange(); // Recompute node positions.
viewer.fit();     // Fit the current layout into the viewport.
viewer.undo();
viewer.redo();
```

Use `linkChild()`, `reparentChild()` and `moveChildRelative()` to manage branches
from your own controls. `deleteSelection()` removes selected nodes or an edge.

### Save and restore

```js
const json = viewer.toJSON(2);
localStorage.setItem("patrol-tree", json);

const saved = localStorage.getItem("patrol-tree");
if (saved) viewer.loadJSON(saved);
```

For object-based storage, use `getTree()` and `loadTree(snapshot)`. `getTree()`
returns a copy. Loading replaces the model, clears selection, renders the tree
and emits `treechange`.

### Show execution status

Forward updates from your execution engine to the viewer:

```js
viewer.updateNode("ready", { status: "success" });
viewer.updateNode("root", { status: "running" });
viewer.updateNode("move", { status: "running" });
viewer.setExecutionFlow({ nodeIds: ["root", "move"] });
```

Use `clearExecutionFlow()` to remove the explicit path. Without an explicit path,
links to nodes whose status is `running` animate by default. To create a viewer
without interactive editing, pass `readonly: true` to the constructor.

### Connect data ports

Execution order and data connections are separate. `children` lists execution
children in order; `edges` with `kind: "data"` connect outputs to inputs. Nodes
with category `operation` can supply data without being execution children.

```js
const dataTree = {
  rootId: "check",
  nodeTypes: {
    Compare: {
      category: "condition",
      maxChildren: 0,
      ports: {
        inputs: [{ id: "threshold", dataType: "number", required: true }]
      },
      paramsSchema: {
        operator: { type: "select", options: [">", ">=", "<", "<="] }
      }
    },
    NumberValue: {
      category: "operation",
      maxChildren: 0,
      ports: { outputs: [{ id: "value", dataType: "number" }] }
    }
  },
  nodes: [
    { id: "check", type: "Compare", label: "Score check", params: { operator: ">=" } },
    { id: "limit", type: "NumberValue", label: "Threshold", params: { value: 0.75 } }
  ],
  edges: [{
    kind: "data",
    fromNodeId: "limit", fromPortId: "value",
    toNodeId: "check", toPortId: "threshold"
  }]
};

viewer.loadTree(dataTree);
```

To connect existing ports from your UI, call
`viewer.connectPorts("source:value", "target:input")` with their `nodeId:portId`
identifiers. Inputs accept one connection by default; use `maxConnections: null`,
`multiple: true` or `acceptsMany: true` on an input for multiple connections.

### Validate a model

Validation can run independently of the renderer:

```js
import { validateBehaviorTree } from "behavior-tree-canvas/core";

const diagnostics = validateBehaviorTree(dataTree);
console.table(diagnostics);
```

Diagnostics include severity, a code, a message and, where applicable, node,
edge, port or path references. The canvas marks affected nodes and emits a
`diagnostics` event after rendering.

### Customize the appearance

Pass partial `theme` overrides to the constructor or update them later:

```js
viewer.setTheme({
  canvas: {
    background: "#07111f",
    animation: { enabled: false }
  }
});
```

Node types can also define their own `color`. Explore the
[theme defaults](./src/theme.js) for node, port, link, grid and animation options.

## Add your own controls

Subscribe to events to keep your UI and model in sync. `on()` returns an
unsubscribe function:

```js
const unsubscribe = viewer.on("selectionchange", ({ node, nodeIds, edge }) => {
  // Display the selected node(s) or edge in your inspector.
});

viewer.on("treechange", ({ tree, reason }) => {
  // Save the edited model or update application state.
});

viewer.on("connectionrequest", request => {
  // Open a palette at request.screen after a data port is dropped on empty space.
  // request.suggestions lists compatible node types and ports.
});

viewer.on("childconnectionrequest", request => {
  // Offer compatible execution children in your palette.
});

// When an individual subscription is no longer needed:
unsubscribe();
```

Listen to `historychange` to enable or disable undo/redo buttons. Call
`cancelConnection()` when your palette is dismissed. See the
[demo source](./demo/main.js) for complete palette, inspector, keyboard and
import/export implementations.

## API reference

The package includes [TypeScript declarations](./src/index.d.ts) for the model,
constructor options, methods and event payloads.

| Import | Use |
| --- | --- |
| `behavior-tree-canvas` | Viewer and public model utilities |
| `behavior-tree-canvas/core` | Normalization, validation and connection checks without the renderer |
| `behavior-tree-canvas/renderer` | `BehaviorTreeCanvas` renderer |
| `behavior-tree-canvas/theme` | Theme defaults and helpers |

## License

[MIT](./LICENSE).
