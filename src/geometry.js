/**
 * @param {number} index
 * @param {number} count
 * @param {number} height
 */
export function portY(index, count, height) {
    if (count <= 1) return 0;
    const top = -(height / 2) + 17;
    const bottom = (height / 2) - 17;
    return top + ((bottom - top) * (index / (count - 1)));
}

/**
 * @param {any} event
 * @param {HTMLCanvasElement} canvas
 * @returns {{clientX:number, clientY:number, pointerId?:number}}
 */
export function pointerClient(event, canvas) {
    const native = /** @type {PointerEvent | MouseEvent | undefined} */ (event?.nativeEvent || event?.originalEvent);
    if (native && Number.isFinite(native.clientX) && Number.isFinite(native.clientY)) {
        return { clientX: native.clientX, clientY: native.clientY, pointerId: /** @type {PointerEvent} */ (native).pointerId };
    }
    const rect = canvas.getBoundingClientRect();
    return {
        clientX: rect.left + (event?.global?.x ?? 0),
        clientY: rect.top + (event?.global?.y ?? 0),
        pointerId: event?.pointerId
    };
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
