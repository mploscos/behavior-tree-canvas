import assert from "node:assert/strict";
import test from "node:test";
import { BehaviorTreeCanvas } from "../src/index.js";

test("serializes and loads tree copies without sharing references", () => {
  const viewer = new BehaviorTreeCanvas({
    target: {},
    tree: {
      rootId: "root",
      nodes: [{ id: "root", type: "Sequence", params: { value: 1 } }]
    }
  });

  const snapshot = viewer.getTree();
  snapshot.nodes[0].params.value = 9;
  assert.equal(viewer.getTree().nodes[0].params.value, 1);

  const json = viewer.toJSON(0);
  assert.equal(JSON.parse(json).rootId, "root");

  const loaded = viewer.loadJSON('{"rootId":"next","nodes":[{"id":"next","type":"Action"}]}');
  assert.equal(loaded.rootId, "next");
  assert.equal(viewer.getTree().nodes[0].id, "next");
});

test("public APIs reject invalid input instead of applying silent defaults", () => {
  assert.throws(() => new BehaviorTreeCanvas(), /options/);
  assert.throws(() => new BehaviorTreeCanvas({ target: {}, tree: null }), /tree/);
  assert.throws(() => new BehaviorTreeCanvas({ target: {}, minZoom: 0 }), /minZoom/);
  assert.throws(() => new BehaviorTreeCanvas({ target: {}, minZoom: 3, maxZoom: 2 }), /maxZoom/);

  const viewer = new BehaviorTreeCanvas({
    target: {},
    tree: { rootId: "root", nodes: [{ id: "root" }] }
  });

  assert.throws(() => viewer.setTree(null), /tree/);
  assert.throws(() => viewer.setNodeTypes(null), /nodeTypes/);
  assert.throws(() => viewer.setTheme(null), /theme/);
  assert.throws(() => viewer.setExecutionFlow({ nodeIds: "root" }), /nodeIds/);
});

test("tracks and deletes multiple selected nodes", () => {
  const viewer = new BehaviorTreeCanvas({
    target: {},
    tree: {
      rootId: "root",
      nodes: [
        { id: "root", children: ["a", "b"] },
        { id: "a" },
        { id: "b" }
      ]
    }
  });

  viewer.selectNodes(["a", "b"]);
  assert.deepEqual(viewer.getSelectedNodeIds(), ["a", "b"]);
  assert.equal(viewer.selectedNodeId, "b");

  assert.equal(viewer.deleteSelection(), true);
  assert.deepEqual(viewer.getTree().nodes.map(node => node.id), ["root"]);
  assert.deepEqual(viewer.getSelectedNodeIds(), []);
});

test("deletes single selected nodes and selected edges", () => {
  const viewer = new BehaviorTreeCanvas({
    target: {},
    tree: {
      rootId: "root",
      nodeTypes: {
        Target: { ports: { inputs: [{ id: "value", dataType: "number" }] } },
        Source: { ports: { outputs: [{ id: "value", dataType: "number" }] } }
      },
      nodes: [
        { id: "root", type: "Target", children: ["leaf"] },
        { id: "leaf" },
        { id: "source", type: "Source" }
      ],
      edges: [
        { kind: "data", fromNodeId: "source", fromPortId: "value", toNodeId: "root", toPortId: "value" }
      ]
    }
  });

  viewer.selectNode("leaf");
  assert.equal(viewer.deleteSelection(), true);
  assert.deepEqual(viewer.getTree().nodes.map(node => node.id), ["root", "source"]);

  viewer.selectDataEdge("data:source.value->root.value");
  assert.equal(viewer.deleteSelection(), true);
  assert.deepEqual(viewer.getTree().edges, []);
});

test("creates, links, reparents and reorders execution children", () => {
  const viewer = new BehaviorTreeCanvas({
    target: {},
    tree: {
      rootId: "root",
      nodeTypes: {
        Sequence: { category: "composite", maxChildren: null },
        Action: { category: "action", maxChildren: 0 }
      },
      nodes: [
        { id: "root", type: "Sequence", children: ["left"] },
        { id: "left", type: "Sequence" },
        { id: "right", type: "Sequence" }
      ]
    }
  });

  const created = viewer.createChildNode("left", { id: "leaf", type: "Action", position: { x: 10, y: 20 } });
  assert.equal(created?.id, "leaf");
  assert.deepEqual(viewer.getTree().nodes.find(node => node.id === "left").children, ["leaf"]);
  assert.deepEqual(viewer.getTree().nodes.find(node => node.id === "leaf").position, { x: 10, y: 20 });

  assert.equal(viewer.reparentChild("right", "leaf"), true);
  assert.deepEqual(viewer.getTree().nodes.find(node => node.id === "left").children, []);
  assert.deepEqual(viewer.getTree().nodes.find(node => node.id === "right").children, ["leaf"]);

  assert.equal(viewer.linkChild("root", "right"), true);
  assert.deepEqual(viewer.getTree().nodes.find(node => node.id === "root").children, ["left", "right"]);
  assert.equal(viewer.moveChildRelative("root", "right", -1), true);
  assert.deepEqual(viewer.getTree().nodes.find(node => node.id === "root").children, ["right", "left"]);
});

test("connects compatible data ports, prevents duplicates and supports undo", () => {
  const viewer = new BehaviorTreeCanvas({
    target: {},
    tree: {
      rootId: "target",
      nodeTypes: {
        Target: { ports: { inputs: [{ id: "value", dataType: "number" }] } },
        Source: { category: "operation", ports: { outputs: [{ id: "value", dataType: "number" }] } },
        TextSource: { category: "operation", ports: { outputs: [{ id: "value", dataType: "string" }] } }
      },
      nodes: [
        { id: "target", type: "Target" },
        { id: "source", type: "Source", category: "operation" },
        { id: "text", type: "TextSource", category: "operation" }
      ]
    }
  });

  assert.equal(viewer.canConnect("source:value", "target:value").ok, true);
  assert.equal(viewer.canConnect("text:value", "target:value").ok, false);

  const edge = viewer.connectPorts("source:value", "target:value");
  assert.equal(edge?.kind, "data");
  assert.equal(edge.fromNodeId, "source");
  assert.equal(edge.toNodeId, "target");
  assert.equal(viewer.getTree().edges.length, 1);
  const duplicate = viewer.connectPorts("source:value", "target:value");
  assert.equal(duplicate, null);
  assert.equal(viewer.getTree().edges.length, 1);

  assert.equal(viewer.undo(), true);
  assert.equal(viewer.getTree().edges?.length || 0, 0);
  assert.equal(viewer.redo(), true);
  assert.equal(viewer.getTree().edges.length, 1);
});

test("emits selection and treechange events from headless edit operations", () => {
  const viewer = new BehaviorTreeCanvas({
    target: {},
    tree: {
      rootId: "root",
      nodes: [{ id: "root", label: "Root" }]
    }
  });
  const events = [];
  viewer.on("selectionchange", event => events.push(["selectionchange", event.nodeId]));
  viewer.on("treechange", event => events.push(["treechange", event.reason]));

  const updated = viewer.updateNode("root", { label: "Updated", children: ["ignored"] });

  assert.equal(updated?.label, "Updated");
  assert.equal(viewer.getTree().nodes[0].children, undefined);
  assert.deepEqual(events, [
    ["treechange", "update-node"],
    ["selectionchange", "root"]
  ]);
});

test("accepts runtime execution flow updates independently from tree data", () => {
  const viewer = new BehaviorTreeCanvas({
    target: {},
    tree: {
      rootId: "root",
      nodes: [
        { id: "root", children: ["child"] },
        { id: "child", status: "running" }
      ]
    }
  });

  const before = viewer.toJSON(0);
  viewer.setExecutionFlow({ nodeIds: ["root", "child"], edgeIds: ["child:root->child"] });
  viewer.clearExecutionFlow();

  assert.equal(viewer.toJSON(0), before);
});
