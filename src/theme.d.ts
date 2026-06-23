import type { BehaviorTreeColor, BehaviorTreeNodeCategory, BehaviorTreeNodeStatus } from "./index.js";

export const STATUS_COLOR: Record<BehaviorTreeNodeStatus | "unknown", BehaviorTreeColor>;
export const CATEGORY_COLOR: Record<BehaviorTreeNodeCategory | "unknown", BehaviorTreeColor>;
export const NODE_VIEW_THEME: Record<string, any>;
export const DRAWING_THEME: Record<string, any>;
export const CANVAS_THEME: Record<string, any>;
export const DEFAULT_BEHAVIOR_TREE_THEME: Record<string, any>;
export function createBehaviorTreeTheme(overrides?: Record<string, any>): Record<string, any>;
export function normalizeCategory(value?: string): keyof typeof CATEGORY_COLOR;
export function normalizeStatus(value?: string): keyof typeof STATUS_COLOR;
export function toColor(value: number | string | undefined, fallback: number | string): number;
export function portColor(dataType?: string): BehaviorTreeColor;
export function areSameDataType(a?: string, b?: string): boolean;
