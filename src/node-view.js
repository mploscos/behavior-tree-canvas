import { Container, Graphics, Rectangle, Text } from "pixi.js";
import { drawExecutionPort, drawNodeBackground, drawPort } from "./drawing.js";
import { portY } from "./geometry.js";
import { DEFAULT_BEHAVIOR_TREE_THEME, normalizeCategory, normalizeStatus, toColor } from "./theme.js";

/**
 * @import {
 *   BehaviorTreeNode,
 *   BehaviorTreeNodeType,
 *   NormalizedBehaviorTreePort
 * } from './core.js'
 */

/**
 * @param {{
 *   node:BehaviorTreeNode,
 *   type:BehaviorTreeNodeType,
 *   ports?:{inputs:NormalizedBehaviorTreePort[], outputs:NormalizedBehaviorTreePort[]},
 *   selectedNodeId:string,
 *   selectedNodeIds?:Set<string>,
 *   theme?:Record<string, any>,
 *   readonly:boolean,
 *   nodeWidth:number,
 *   nodeHeight:number,
 *   canHaveChildren:boolean,
 *   canReceiveParent:boolean,
 *   childCapacity?:{count:number,max:number,hasCapacity:boolean,label:string},
 *   childOrder?:number|null,
 *   validationSeverity?:'error'|'warning'|'',
 *   onNodePointerDown:(event:any,node:BehaviorTreeNode) => void,
 *   onNodeTap:(event:any,node:BehaviorTreeNode) => void,
 *   onPortPointerDown:(event:any,port:NormalizedBehaviorTreePort) => void,
 *   onExecutionPortPointerDown:(event:any,node:BehaviorTreeNode,kind:'parent'|'child') => void
 * }} options
 */
export function createNodeView(options) {
    const { node, type, ports, selectedNodeId, readonly, nodeWidth, nodeHeight } = options;
    const theme = options.theme || DEFAULT_BEHAVIOR_TREE_THEME;
    const viewTheme = theme.nodeView;
    const view = new Container();
    const bg = new Graphics();
    const category = normalizeCategory(node.category || type.category);
    const status = normalizeStatus(node.status);
    const accent = toColor(type.color, theme.categoryColor[category]);
    const height = nodeVisualHeight(nodeHeight, ports);
    const selected = options.selectedNodeIds?.has(node.id) || node.id === selectedNodeId;

    drawNodeBackground(bg, {
        width: nodeWidth,
        height,
        accent,
        statusColor: theme.statusColor[status],
        selected,
        disabled: status === "disabled",
        validationSeverity: options.validationSeverity
    }, theme.drawing);

    const label = new Text({
        text: String(node.label || node.name || node.id),
        style: {
            fontFamily: viewTheme.fontFamily,
            fontSize: viewTheme.label.fontSize,
            fill: toColor(viewTheme.label.fill, 0),
            fontWeight: viewTheme.label.fontWeight,
            align: viewTheme.label.align,
            wordWrap: true,
            wordWrapWidth: nodeWidth - viewTheme.label.wordWrapPadding,
            lineHeight: viewTheme.label.lineHeight,
            letterSpacing: viewTheme.label.letterSpacing
        }
    });
    label.anchor.set(0.5, 0.5);
    label.y = viewTheme.label.y;
    label.resolution = viewTheme.textResolution;

    const typeLabel = new Text({
        text: String(type.label || node.type || category).toUpperCase(),
        style: {
            fontFamily: viewTheme.fontFamily,
            fontSize: viewTheme.typeLabel.fontSize,
            fill: toColor(viewTheme.typeLabel.fill, 0),
            fontWeight: viewTheme.typeLabel.fontWeight,
            align: viewTheme.typeLabel.align,
            letterSpacing: viewTheme.typeLabel.letterSpacing
        }
    });
    typeLabel.anchor.set(0.5, 0.5);
    typeLabel.y = viewTheme.typeLabel.y;
    typeLabel.alpha = viewTheme.typeLabel.alpha;
    typeLabel.resolution = viewTheme.textResolution;

    /** @type {Map<string, {x:number,y:number,direction:'input'|'output',dataType:string,nodeId:string,portId:string,fullId:string}>} */
    const portAnchors = new Map();
    /** @type {Map<string, Graphics>} */
    const portViews = new Map();
    /** @type {Map<string, {x:number,y:number,kind:'parent'|'child',nodeId:string,state?:'normal'|'available'|'full'}>} */
    const executionAnchors = new Map();
    /** @type {Map<string, Graphics>} */
    const executionViews = new Map();

    view.addChild(bg, label, typeLabel);
    addExecutionPorts(view, {
        node,
        height,
        readonly,
        canHaveChildren: options.canHaveChildren,
        canReceiveParent: options.canReceiveParent,
        childCapacity: options.childCapacity,
        theme,
        executionAnchors,
        executionViews,
        onExecutionPortPointerDown: options.onExecutionPortPointerDown
    });
    addPorts(view, {
        nodeId: node.id,
        ports,
        height,
        nodeWidth,
        readonly,
        theme,
        portAnchors,
        portViews,
        onPortPointerDown: options.onPortPointerDown
    });
    addNodeIndicators(view, {
        height,
        nodeWidth,
        childCapacity: options.childCapacity,
        childOrder: options.childOrder,
        theme
    });

    view.eventMode = "static";
    view.cursor = readonly ? "pointer" : "grab";
    view.hitArea = new Rectangle(
        -(nodeWidth / 2) - viewTheme.hitArea.horizontalPadding,
        -(height / 2),
        nodeWidth + (viewTheme.hitArea.horizontalPadding * 2),
        height
    );
    view.on("pointerdown", event => options.onNodePointerDown(event, node));
    view.on("pointertap", event => options.onNodeTap(event, node));
    view.on("pointerover", () => { view.alpha = viewTheme.hoverAlpha; });
    view.on("pointerout", () => { view.alpha = viewTheme.normalAlpha; });

    return { view, height, portAnchors, portViews, executionAnchors, executionViews };
}

/**
 * @param {number} nodeHeight
 * @param {{inputs:NormalizedBehaviorTreePort[], outputs:NormalizedBehaviorTreePort[]} | undefined} ports
 */
export function nodeVisualHeight(nodeHeight, ports) {
    const count = Math.max(ports?.inputs.length || 0, ports?.outputs.length || 0);
    return Math.max(nodeHeight, 34 + (count * 16));
}

/**
 * @param {Container} view
 * @param {{
 *   nodeId:string,
 *   ports?:{inputs:NormalizedBehaviorTreePort[], outputs:NormalizedBehaviorTreePort[]},
 *   height:number,
 *   nodeWidth:number,
 *   readonly:boolean,
 *   portAnchors:Map<string, {x:number,y:number,direction:'input'|'output',dataType:string,nodeId:string,portId:string,fullId:string}>,
 *   portViews:Map<string, Graphics>,
 *   onPortPointerDown:(event:any,port:NormalizedBehaviorTreePort) => void
 * }} options
 */
function addPorts(view, options) {
    if (!options.ports) return;
    addPortGroup(view, { ...options, ports: options.ports.inputs, direction: "input" });
    addPortGroup(view, { ...options, ports: options.ports.outputs, direction: "output" });
}

/**
 * @param {Container} view
 * @param {{
 *   node:BehaviorTreeNode,
 *   height:number,
 *   readonly:boolean,
 *   canHaveChildren:boolean,
 *   canReceiveParent:boolean,
 *   childCapacity?:{count:number,max:number,hasCapacity:boolean,label:string},
 *   theme:Record<string, any>,
 *   executionAnchors:Map<string, {x:number,y:number,kind:'parent'|'child',nodeId:string,state?:'normal'|'available'|'full'}>,
 *   executionViews:Map<string, Graphics>,
 *   onExecutionPortPointerDown:(event:any,node:BehaviorTreeNode,kind:'parent'|'child') => void
 * }} options
 */
function addExecutionPorts(view, options) {
    if (options.canReceiveParent) addExecutionPort(view, options, "parent", 0, -(options.height / 2));
    if (options.canHaveChildren) {
        const childState = options.childCapacity?.hasCapacity === false ? "full" : "available";
        addExecutionPort(view, options, "child", 0, options.height / 2, childState);
    }
}

/**
 * @param {Container} view
 * @param {{
 *   node:BehaviorTreeNode,
 *   readonly:boolean,
 *   theme:Record<string, any>,
 *   executionAnchors:Map<string, {x:number,y:number,kind:'parent'|'child',nodeId:string,state?:'normal'|'available'|'full'}>,
 *   executionViews:Map<string, Graphics>,
 *   onExecutionPortPointerDown:(event:any,node:BehaviorTreeNode,kind:'parent'|'child') => void
 * }} options
 * @param {'parent'|'child'} kind
 * @param {number} x
 * @param {number} y
 * @param {'normal'|'available'|'full'} [state]
 */
function addExecutionPort(view, options, kind, x, y, state = "normal") {
    const key = `${options.node.id}:${kind}`;
    const g = new Graphics();
    drawExecutionPort(g, kind, state, options.theme.drawing);
    g.x = x;
    g.y = y;
    g.eventMode = "static";
    g.cursor = options.readonly || state === "full" ? "default" : "crosshair";
    g.hitArea = centeredHitArea(options.theme.nodeView.executionPortHitArea);
    g.on("pointerdown", event => options.onExecutionPortPointerDown(event, options.node, kind));
    view.addChild(g);
    options.executionAnchors.set(key, { x, y, kind, nodeId: options.node.id, state });
    options.executionViews.set(key, g);
}

/**
 * @param {Container} view
 * @param {{
 *   nodeId:string,
 *   ports:NormalizedBehaviorTreePort[],
 *   direction:'input'|'output',
 *   height:number,
 *   nodeWidth:number,
 *   theme:Record<string, any>,
 *   readonly:boolean,
 *   portAnchors:Map<string, {x:number,y:number,direction:'input'|'output',dataType:string,nodeId:string,portId:string,fullId:string}>,
 *   portViews:Map<string, Graphics>,
 *   onPortPointerDown:(event:any,port:NormalizedBehaviorTreePort) => void
 * }} options
 */
function addPortGroup(view, options) {
    const viewTheme = options.theme.nodeView;
    const { nodeId, ports, direction, height, nodeWidth } = options;
    if (!ports.length) return;
    const x = direction === "input" ? -(nodeWidth / 2) : (nodeWidth / 2);
    const labelAnchor = direction === "input" ? 1 : 0;
    const labelX = direction === "input" ? x - viewTheme.portLabel.gap : x + viewTheme.portLabel.gap;
    const maxLabels = viewTheme.portLabel.maxVisible;

    for (let index = 0; index < ports.length; index += 1) {
        const port = ports[index];
        const y = portY(index, ports.length, height);
        const g = new Graphics();
        drawPort(g, port, "normal", options.theme.drawing);
        g.x = x;
        g.y = y;
        g.eventMode = "static";
        g.cursor = options.readonly ? "default" : "crosshair";
        g.hitArea = centeredHitArea(viewTheme.dataPortHitArea);
        g.on("pointerdown", event => options.onPortPointerDown(event, port));
        view.addChild(g);
        options.portAnchors.set(port.fullId, { x, y, direction, dataType: port.dataType, nodeId, portId: port.id, fullId: port.fullId });
        options.portAnchors.set(`${nodeId}:${port.id}`, { x, y, direction, dataType: port.dataType, nodeId, portId: port.id, fullId: port.fullId });
        options.portViews.set(port.fullId, g);

        if (ports.length <= maxLabels) addPortLabel(view, { port, direction, labelAnchor, labelX, y, theme: options.theme });
    }
}

/**
 * @param {Container} view
 * @param {{port:NormalizedBehaviorTreePort,direction:'input'|'output',labelAnchor:number,labelX:number,y:number,theme:Record<string, any>}} options
 */
function addPortLabel(view, options) {
    const viewTheme = options.theme.nodeView;
    const { port, direction, labelAnchor, labelX, y } = options;
    const labelText = String(port.label || port.name || port.id);
    const labelBg = new Graphics();
    const text = new Text({
        text: labelText,
        style: {
            fontFamily: viewTheme.fontFamily,
            fontSize: viewTheme.portLabel.fontSize,
            fill: toColor(viewTheme.portLabel.fill, 0),
            fontWeight: viewTheme.portLabel.fontWeight,
            align: direction === "input" ? viewTheme.portLabel.inputAlign : viewTheme.portLabel.outputAlign,
            letterSpacing: viewTheme.portLabel.letterSpacing
        }
    });
    text.anchor.set(labelAnchor, 0.5);
    text.x = labelX;
    text.y = y;
    text.resolution = viewTheme.textResolution;
    const padX = viewTheme.portLabel.paddingX;
    const padY = viewTheme.portLabel.paddingY;
    const bgWidth = Math.ceil(text.width + (padX * 2));
    const bgHeight = Math.ceil(text.height + (padY * 2));
    labelBg.roundRect(
        direction === "input" ? labelX - bgWidth + padX : labelX - padX,
        y - (bgHeight / 2),
        bgWidth,
        bgHeight,
        viewTheme.portLabel.radius
    );
    labelBg.fill({ color: toColor(viewTheme.portLabel.background, 0), alpha: viewTheme.portLabel.backgroundAlpha });
    labelBg.stroke({
        width: viewTheme.portLabel.strokeWidth,
        color: toColor(viewTheme.portLabel.stroke, 0),
        alpha: viewTheme.portLabel.strokeAlpha
    });
    view.addChild(labelBg, text);
}

/**
 * @param {Container} view
 * @param {{
 *   height:number,
 *   nodeWidth:number,
 *   childCapacity?:{count:number,max:number,hasCapacity:boolean,label:string},
 *   childOrder?:number|null,
 *   theme:Record<string, any>
 * }} options
 */
function addNodeIndicators(view, options) {
    const { badge } = options.theme.nodeView;
    if (Number.isFinite(options.childOrder)) {
        const order = badge.childOrder;
        addNodeBadge(view, {
            text: String(options.childOrder),
            x: -(options.nodeWidth / 2) + order.xInset,
            y: -(options.height / 2) + order.yInset,
            fill: order.fill,
            stroke: order.stroke,
            textFill: order.textFill,
            alpha: order.alpha
        }, options.theme);
    }

    if (options.childCapacity?.label) {
        const capacity = badge.childCapacity;
        const hasCapacity = options.childCapacity.hasCapacity;
        addNodeBadge(view, {
            text: options.childCapacity.label,
            x: (options.nodeWidth / 2) - capacity.xInset,
            y: (options.height / 2) - capacity.yInset,
            fill: hasCapacity ? capacity.availableFill : capacity.fullFill,
            stroke: hasCapacity ? capacity.availableStroke : capacity.fullStroke,
            textFill: hasCapacity ? capacity.availableTextFill : capacity.fullTextFill,
            alpha: hasCapacity ? capacity.availableAlpha : capacity.fullAlpha,
            anchorX: capacity.anchorX
        }, options.theme);
    }
}

/**
 * @param {Container} view
 * @param {{
 *   text:string,
 *   x:number,
 *   y:number,
 *   fill:number,
 *   stroke:number,
 *   textFill:number,
 *   alpha:number,
 *   anchorX?:number
 * }} options
 * @param {Record<string, any>} theme
 */
function addNodeBadge(view, options, theme) {
    const badge = theme.nodeView.badge;
    const text = new Text({
        text: options.text,
        style: {
            fontFamily: theme.nodeView.fontFamily,
            fontSize: badge.fontSize,
            fill: toColor(options.textFill, 0),
            fontWeight: badge.fontWeight,
            align: badge.align,
            letterSpacing: badge.letterSpacing
        }
    });
    text.anchor.set(0.5, 0.5);
    text.resolution = theme.nodeView.textResolution;

    const width = Math.max(badge.minWidth, Math.ceil(text.width + badge.horizontalPadding));
    const height = badge.height;
    const anchorX = options.anchorX ?? 0.5;
    const bg = new Graphics();
    bg.roundRect(-(width * anchorX), -(height / 2), width, height, badge.radius);
    bg.fill({ color: toColor(options.fill, 0), alpha: options.alpha });
    bg.stroke({ width: badge.strokeWidth, color: toColor(options.stroke, 0), alpha: badge.strokeAlpha });
    bg.position.set(options.x, options.y);
    text.position.set(options.x - (width * (anchorX - 0.5)), options.y);
    view.addChild(bg, text);
}

/** @param {number} size */
function centeredHitArea(size) {
    return new Rectangle(-(size / 2), -(size / 2), size, size);
}
