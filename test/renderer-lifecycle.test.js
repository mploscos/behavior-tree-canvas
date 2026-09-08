import assert from "node:assert/strict";
import test from "node:test";
import { Application } from "pixi.js";
import { BehaviorTreeCanvas } from "../src/index.js";

test("destroy completes mounted viewer cleanup and can be called twice", async (t) => {
  // Keep real Pixi scene objects; only replace browser/GPU services.
  const replaceGlobal = (name, value) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    });
  };
  replaceGlobal("window", new EventTarget());
  const disconnect = t.mock.fn();
  replaceGlobal("ResizeObserver", class {
    observe() {}
    disconnect = disconnect;
  });
  const canvas = new EventTarget();
  const removeCanvas = t.mock.fn();
  const removeAnimation = t.mock.fn();
  t.mock.method(Application.prototype, "init", async function () {
    this.renderer = { canvas, screen: { width: 800, height: 600 } };
    this.ticker = { add() {}, remove: removeAnimation };
  });
  const destroyApp = t.mock.method(Application.prototype, "destroy", function (rendererOptions, sceneOptions) {
    this.stage.destroy(sceneOptions);
    if (rendererOptions.removeView) removeCanvas();
  });
  const viewer = new BehaviorTreeCanvas({ target: { appendChild() {} } });
  await viewer.mount();

  assert.doesNotThrow(() => viewer.destroy());
  assert.equal(viewer.app, null);
  assert.equal(destroyApp.mock.callCount(), 1);
  assert.equal(removeCanvas.mock.callCount(), 1);
  assert.equal(disconnect.mock.callCount(), 1);
  assert.equal(removeAnimation.mock.callCount(), 1);

  assert.doesNotThrow(() => viewer.destroy());
  assert.equal(destroyApp.mock.callCount(), 1);
  assert.equal(disconnect.mock.callCount(), 1);
});
