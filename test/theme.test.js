import assert from 'node:assert/strict';
import test from 'node:test';
import { createBehaviorTreeTheme } from '../src/theme.js';

test('light theme keeps readable node text and merges partial renderer overrides', () => {
    const dark = createBehaviorTreeTheme();
    const light = createBehaviorTreeTheme({ canvas: { animation: { enabled: false } } }, 'light');
    assert.notEqual(light.canvas.background, dark.canvas.background);
    assert.notEqual(light.nodeView.label.fill, dark.nodeView.label.fill);
    assert.notEqual(light.drawing.node.fill, dark.drawing.node.fill);
    assert.equal(light.canvas.animation.enabled, false);
    assert.equal(light.canvas.animation.flowColor, '#007c99');
    assert.equal(light.canvas.grid.minorStep, dark.canvas.grid.minorStep);
    assert.throws(() => createBehaviorTreeTheme({}, 'sepia'), /Unknown behavior tree theme/);
});
