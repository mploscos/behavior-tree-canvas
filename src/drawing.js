import { DRAWING_THEME, portColor, toColor } from "./theme.js";

/**
 * @import { Graphics } from 'pixi.js'
 * @import { NormalizedBehaviorTreePort } from './core.js'
 */

/**
 * @param {Graphics} g
 * @param {{width:number,height:number,accent:number|string,statusColor:number|string,selected:boolean,disabled:boolean,validationSeverity?:'error'|'warning'|''}} options
 * @param {typeof DRAWING_THEME} [drawingTheme]
 */
export function drawNodeBackground(g, options, drawingTheme = DRAWING_THEME) {
    const theme = drawingTheme.node;
    const { width, height, accent, statusColor, selected, disabled, validationSeverity } = options;
    const x = -(width / 2);
    const y = -(height / 2);
    const validationColor = validationSeverity === "error" ? toColor(theme.validationError, 0) : validationSeverity === "warning" ? toColor(theme.validationWarning, 0) : 0;
    const strokeColor = selected ? toColor(theme.selectedStroke, 0) : validationColor || toColor(theme.stroke, 0);
    const strokeWidth = selected ? theme.selectedStrokeWidth : validationSeverity ? theme.validationStrokeWidth : theme.strokeWidth;
    g.clear();
    g.roundRect(x, y, width, height, theme.radius);
    g.fill({ color: disabled ? toColor(theme.disabledFill, 0) : toColor(theme.fill, 0), alpha: disabled ? theme.disabledFillAlpha : theme.fillAlpha });
    g.stroke({ width: strokeWidth, color: strokeColor, alpha: selected || validationSeverity ? theme.activeStrokeAlpha : theme.strokeAlpha });
    g.roundRect(x + theme.accentInset, y + theme.accentInset, theme.accentWidth, height - (theme.accentInset * 2), theme.accentRadius);
    g.fill({ color: toColor(accent, 0), alpha: disabled ? theme.disabledAccentAlpha : theme.accentAlpha });
    g.circle(x + width - theme.statusRight, y + theme.statusTop, theme.statusRadius);
    g.fill({ color: toColor(statusColor, 0), alpha: disabled ? theme.disabledStatusAlpha : theme.statusAlpha });
    g.stroke({ width: theme.statusStrokeWidth, color: toColor(theme.statusStroke, 0), alpha: theme.statusStrokeAlpha });
}

/**
 * @param {Graphics} g
 * @param {NormalizedBehaviorTreePort} port
 * @param {'normal'|'source'|'compatible'|'hover'|'invalid'} state
 * @param {typeof DRAWING_THEME} [drawingTheme]
 */
export function drawPort(g, port, state, drawingTheme = DRAWING_THEME) {
    const theme = drawingTheme.port;
    const fill = toColor(portColor(port.dataType), 0);
    const size = state === "source" || state === "hover" ? theme.activeSize : theme.size;
    const strokeColor = state === "invalid" ? toColor(theme.invalidStroke, 0) : state === "compatible" || state === "hover" ? toColor(theme.activeStroke, 0) : toColor(theme.normalStroke, 0);
    const strokeWidth = state === "normal" ? theme.normalStrokeWidth : theme.activeStrokeWidth;
    const alpha = state === "compatible" ? theme.compatibleAlpha : state === "normal" ? theme.normalAlpha : theme.activeAlpha;
    g.clear();
    if (state === "compatible" || state === "hover") {
        drawPortHalo(g, size, theme.haloPadding, theme.haloRadius);
        g.fill({ color: toColor(theme.compatibleHalo, 0), alpha: state === "hover" ? theme.hoverHaloAlpha : theme.compatibleHaloAlpha });
    }
    if (state === "invalid") {
        drawPortHalo(g, size, theme.haloPadding, theme.haloRadius);
        g.fill({ color: toColor(theme.invalidHalo, 0), alpha: theme.invalidHaloAlpha });
    }
    g.roundRect(-(size / 2), -(size / 2), size, size, theme.radius);
    g.fill({ color: fill, alpha });
    g.stroke({ width: strokeWidth, color: strokeColor, alpha: theme.strokeAlpha });
}

/**
 * @param {Graphics} g
 * @param {'parent'|'child'} kind
 * @param {'normal'|'available'|'full'|'source'|'compatible'|'hover'|'invalid'} state
 * @param {typeof DRAWING_THEME} [drawingTheme]
 */
export function drawExecutionPort(g, kind, state, drawingTheme = DRAWING_THEME) {
    const theme = drawingTheme.executionPort;
    const fill = state === "available" ? theme.availableFill : state === "full" ? theme.fullFill : kind === "child" ? theme.childFill : theme.parentFill;
    const size = state === "source" || state === "hover" ? theme.activeSize : theme.size;
    const strokeColor = state === "invalid" ? theme.invalidStroke : state === "compatible" || state === "hover" || state === "available" ? theme.activeStroke : state === "full" ? theme.fullStroke : theme.normalStroke;
    const strokeWidth = state === "normal" || state === "available" || state === "full" ? theme.normalStrokeWidth : theme.activeStrokeWidth;
    g.clear();
    if (state === "compatible" || state === "hover") {
        drawPortHalo(g, size, theme.haloPadding, theme.haloRadius);
        g.fill({ color: toColor(theme.compatibleHalo, 0), alpha: state === "hover" ? theme.hoverHaloAlpha : theme.compatibleHaloAlpha });
    }
    if (state === "invalid") {
        drawPortHalo(g, size, theme.haloPadding, theme.haloRadius);
        g.fill({ color: toColor(theme.invalidHalo, 0), alpha: theme.invalidHaloAlpha });
    }
    g.roundRect(-(size / 2), -(size / 2), size, size, theme.radius);
    g.fill({ color: toColor(fill, 0), alpha: state === "full" ? theme.fullAlpha : theme.normalAlpha });
    g.stroke({ width: strokeWidth, color: toColor(strokeColor, 0), alpha: theme.strokeAlpha });
}

function drawPortHalo(g, size, padding, radius) {
    g.roundRect(-(size / 2) - padding, -(size / 2) - padding, size + (padding * 2), size + (padding * 2), radius);
}
