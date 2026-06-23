import assert from "node:assert/strict";
import test from "node:test";
import { canConnect, canLinkChild, canReparentChild, layoutBehaviorTree, normalizeBehaviorTree, suggestNodeTypesForChild, suggestNodeTypesForPort, validateBehaviorTree } from "../src/core.js";

test("normalizes children, parentId and edges into a single tree index", () => {
  const normalized = normalizeBehaviorTree({
    rootId: "root",
    nodes: [
      { id: "root", children: ["a"] },
      { id: "a" },
      { id: "b", parentId: "a" },
      { id: "c" }
    ],
    edges: [{ from: "b", to: "c" }]
  });

  assert.equal(normalized.rootId, "root");
  assert.deepEqual(normalized.childrenById.get("root"), ["a"]);
  assert.deepEqual(normalized.childrenById.get("a"), ["b"]);
  assert.deepEqual(normalized.childrenById.get("b"), ["c"]);
  assert.equal(normalized.parentById.get("c"), "b");
  assert.equal(normalized.childEdges.length, 3);
});

test("reports missing links and node type child limits", () => {
  const normalized = normalizeBehaviorTree({
    rootId: "root",
    nodes: [
      { id: "root", type: "Decorator", children: ["a", "missing"] },
      { id: "a" },
      { id: "b", parentId: "root" }
    ],
    nodeTypes: {
      Decorator: { minChildren: 1, maxChildren: 1 }
    }
  });

  assert.ok(normalized.diagnostics.some(line => line.includes('missing child "missing"')));
  assert.ok(normalized.diagnostics.some(line => line.includes("allows at most 1 children")));
});

test("computes a top-down layout", () => {
  const normalized = normalizeBehaviorTree({
    rootId: "root",
    nodes: [
      { id: "root", children: ["left", "right"] },
      { id: "left" },
      { id: "right" }
    ]
  });
  const positions = layoutBehaviorTree(normalized);

  assert.equal(positions.size, 3);
  assert.equal(positions.get("root").y, 80);
  assert.ok(positions.get("left").x < positions.get("right").x);
  assert.ok(positions.get("left").y > positions.get("root").y);
});

test("normalizes typed ports and data edges separately from child edges", () => {
  const normalized = normalizeBehaviorTree({
    rootId: "root",
    nodeTypes: {
      Action: {
        category: "action",
        ports: { inputs: [{ id: "value", dataType: "number" }] }
      },
      NumberSource: {
        category: "operation",
        ports: { outputs: [{ id: "result", dataType: "number" }] }
      }
    },
    nodes: [
      { id: "root", children: ["action"] },
      { id: "action", type: "Action" },
      { id: "source", type: "NumberSource", category: "operation" }
    ],
    edges: [
      { kind: "data", fromNodeId: "source", fromPortId: "result", toNodeId: "action", toPortId: "value" }
    ]
  });

  assert.deepEqual(normalized.childrenById.get("root"), ["action"]);
  assert.equal(normalized.dataEdges.length, 1);
  assert.equal(normalized.dataEdges[0].fromNodeId, "source");
  assert.equal(normalized.portsByNodeId.get("action").inputs[0].dataType, "number");
  assert.equal(normalized.diagnostics.length, 0);
});

test("checks port compatibility and suggests palette node types", () => {
  const normalized = normalizeBehaviorTree({
    rootId: "root",
    nodeTypes: {
      Action: {
        ports: { inputs: [{ id: "amount", dataType: "number" }, { id: "label", dataType: "string" }] }
      },
      NumberSource: {
        category: "operation",
        ports: { outputs: [{ id: "value", dataType: "number" }] }
      },
      TextSource: {
        category: "operation",
        ports: { outputs: [{ id: "value", dataType: "string" }] }
      }
    },
    nodes: [
      { id: "root", type: "Action" },
      { id: "num", type: "NumberSource", category: "operation" },
      { id: "text", type: "TextSource", category: "operation" }
    ]
  });

  assert.equal(canConnect(normalized, "num:value", "root:amount").ok, true);
  assert.equal(canConnect(normalized, "text:value", "root:amount").ok, false);

  const suggestions = suggestNodeTypesForPort(normalized, "root:amount").map(item => item.typeId);
  assert.deepEqual(suggestions, ["NumberSource"]);
  assert.deepEqual(suggestNodeTypesForPort(normalized, "root:amount").map(item => item.category), ["operation"]);
});

test("rejects multiple connections to a single input port by default", () => {
  const normalized = normalizeBehaviorTree({
    rootId: "target",
    nodeTypes: {
      Target: {
        ports: { inputs: [{ id: "value", dataType: "number" }] }
      },
      NumberSource: {
        category: "operation",
        ports: { outputs: [{ id: "value", dataType: "number" }] }
      }
    },
    nodes: [
      { id: "target", type: "Target" },
      { id: "a", type: "NumberSource", category: "operation" },
      { id: "b", type: "NumberSource", category: "operation" }
    ],
    edges: [
      { kind: "data", fromNodeId: "a", fromPortId: "value", toNodeId: "target", toPortId: "value" },
      { kind: "data", fromNodeId: "b", fromPortId: "value", toNodeId: "target", toPortId: "value" }
    ]
  });

  assert.equal(normalized.dataEdges.length, 1);
  assert.ok(normalized.diagnostics.some(line => line.includes("no free connection slots")));
  assert.equal(canConnect(normalized, "b:value", "target:value").ok, false);
  assert.deepEqual(suggestNodeTypesForPort(normalized, "target:value"), []);
});

test("allows multiple connections when an input port opts in", () => {
  const normalized = normalizeBehaviorTree({
    rootId: "target",
    nodeTypes: {
      Target: {
        ports: { inputs: [{ id: "items", dataType: "string", maxConnections: null }] }
      },
      TextSource: {
        category: "operation",
        ports: { outputs: [{ id: "value", dataType: "string" }] }
      }
    },
    nodes: [
      { id: "target", type: "Target" },
      { id: "a", type: "TextSource", category: "operation" },
      { id: "b", type: "TextSource", category: "operation" }
    ],
    edges: [
      { kind: "data", fromNodeId: "a", fromPortId: "value", toNodeId: "target", toPortId: "items" },
      { kind: "data", fromNodeId: "b", fromPortId: "value", toNodeId: "target", toPortId: "items" }
    ]
  });

  assert.equal(normalized.dataEdges.length, 2);
  assert.equal(normalized.diagnostics.length, 0);
});

test("validates execution child links", () => {
  const normalized = normalizeBehaviorTree({
    rootId: "root",
    nodeTypes: {
      Sequence: { category: "composite", maxChildren: null },
      Decorator: { category: "decorator", maxChildren: 1 },
      Operation: { category: "operation", maxChildren: 0 }
    },
    nodes: [
      { id: "root", type: "Sequence", children: ["decorator"] },
      { id: "decorator", type: "Decorator", children: ["leaf"] },
      { id: "leaf" },
      { id: "candidate" },
      { id: "op", type: "Operation", category: "operation" }
    ]
  });

  assert.equal(canLinkChild(normalized, "root", "candidate").ok, true);
  assert.equal(canLinkChild(normalized, "decorator", "candidate").ok, false);
  assert.equal(canLinkChild(normalized, "leaf", "root").ok, false);
  assert.equal(canLinkChild(normalized, "root", "op").ok, false);
});

test("suggests execution child node types only when parent has capacity", () => {
  const normalized = normalizeBehaviorTree({
    rootId: "root",
    nodeTypes: {
      Sequence: { category: "composite", maxChildren: null },
      Repeat: { category: "decorator", maxChildren: 1 },
      Action: { category: "action", maxChildren: 0 },
      Operation: { category: "operation", maxChildren: 0 }
    },
    nodes: [
      { id: "root", type: "Sequence" },
      { id: "decorator", type: "Repeat", children: ["leaf"] },
      { id: "leaf", type: "Sequence" }
    ]
  });

  assert.deepEqual(suggestNodeTypesForChild(normalized, "root").map(item => item.typeId), ["Sequence", "Repeat", "Action"]);
  assert.deepEqual(suggestNodeTypesForChild(normalized, "decorator"), []);
});

test("validates execution reparenting without allowing cycles", () => {
  const normalized = normalizeBehaviorTree({
    rootId: "root",
    nodeTypes: {
      Sequence: { category: "composite", maxChildren: null },
      Action: { category: "action", maxChildren: 0 }
    },
    nodes: [
      { id: "root", type: "Sequence", children: ["left", "right"] },
      { id: "left", type: "Sequence", children: ["leaf"] },
      { id: "right", type: "Sequence" },
      { id: "leaf", type: "Action" }
    ]
  });

  assert.equal(canReparentChild(normalized, "right", "leaf").ok, true);
  assert.equal(canReparentChild(normalized, "leaf", "left").ok, false);
  assert.equal(canReparentChild(normalized, "root", "right").ok, false);
});

test("returns structured validation diagnostics", () => {
  const diagnostics = validateBehaviorTree({
    rootId: "root",
    nodeTypes: {
      Action: {
        category: "action",
        maxChildren: 0,
        ports: { inputs: [{ id: "target", dataType: "string", required: true }] },
        paramsSchema: { task: { type: "string", required: true } }
      }
    },
    nodes: [
      { id: "root", type: "Action", children: ["child", "missing"] },
      { id: "child", type: "Action", params: { task: "child" } },
      { id: "unknown", type: "MissingType" }
    ]
  });
  const codes = diagnostics.map(diagnostic => diagnostic.code);

  assert.ok(codes.includes("normalize"));
  assert.ok(codes.includes("max-children"));
  assert.ok(codes.includes("required-input"));
  assert.ok(codes.includes("required-param"));
  assert.ok(codes.includes("unknown-node-type"));
  assert.ok(diagnostics.every(diagnostic => diagnostic.id && diagnostic.severity));
});

test("lays out operation nodes that are not execution children", () => {
  const normalized = normalizeBehaviorTree({
    rootId: "root",
    nodes: [
      { id: "root", children: ["action"] },
      { id: "action" },
      { id: "constant", category: "operation" }
    ]
  });
  const positions = layoutBehaviorTree(normalized);

  assert.equal(positions.size, 3);
  assert.ok(positions.has("constant"));
  assert.notEqual(positions.get("constant").x, positions.get("action").x);
});

test("arranges detached data sources to the left of their execution consumers", () => {
  const normalized = normalizeBehaviorTree({
    rootId: "root",
    nodeTypes: {
      Action: { ports: { inputs: [{ id: "value", dataType: "number" }] } },
      Source: { category: "operation", ports: { outputs: [{ id: "value", dataType: "number" }] } }
    },
    nodes: [
      { id: "root", children: ["top", "bottom"] },
      { id: "top", type: "Action" },
      { id: "bottom", type: "Action" },
      { id: "sourceTop", type: "Source", category: "operation" },
      { id: "sourceBottom", type: "Source", category: "operation" }
    ],
    edges: [
      { kind: "data", fromNodeId: "sourceTop", fromPortId: "value", toNodeId: "top", toPortId: "value" },
      { kind: "data", fromNodeId: "sourceBottom", fromPortId: "value", toNodeId: "bottom", toPortId: "value" }
    ]
  });
  const positions = layoutBehaviorTree(normalized, { preservePositions: false, center: true });

  assert.ok(positions.get("sourceTop").x < positions.get("top").x);
  assert.ok(positions.get("sourceBottom").x < positions.get("bottom").x);
  assert.ok(positions.get("sourceTop").y < positions.get("sourceBottom").y);
});

test("does not recenter preserved positions during editing layout", () => {
  const normalized = normalizeBehaviorTree({
    rootId: "root",
    nodes: [
      { id: "root", position: { x: 320, y: 140 }, children: ["action"] },
      { id: "action", position: { x: 340, y: 280 } },
      { id: "created", category: "operation", position: { x: 90, y: 360 } }
    ]
  });
  const positions = layoutBehaviorTree(normalized);

  assert.deepEqual(positions.get("root"), { x: 320, y: 140 });
  assert.deepEqual(positions.get("action"), { x: 340, y: 280 });
  assert.deepEqual(positions.get("created"), { x: 90, y: 360 });
});

test("can still force centering when arranging", () => {
  const normalized = normalizeBehaviorTree({
    rootId: "root",
    nodes: [
      { id: "root", position: { x: 320, y: 140 }, children: ["action"] },
      { id: "action", position: { x: 340, y: 280 } }
    ]
  });
  const positions = layoutBehaviorTree(normalized, { preservePositions: false, center: true });

  assert.equal(positions.get("root").y, 80);
  assert.ok(positions.get("action").y > positions.get("root").y);
});
