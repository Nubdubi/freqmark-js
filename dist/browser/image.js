function makeCanvas(width, height) {
    if (typeof OffscreenCanvas !== 'undefined') {
        return new OffscreenCanvas(width, height);
    }
    if (typeof document === 'undefined') {
        throw new Error('Canvas is not available in this environment.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}
function get2d(canvas) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || !('getImageData' in ctx)) {
        throw new Error('Unable to acquire a 2D canvas context.');
    }
    return ctx;
}
export async function loadImage(input) {
    let source;
    let width;
    let height;
    let disposable = null;
    if (input instanceof Blob) {
        const bitmap = await createImageBitmap(input);
        disposable = bitmap;
        source = bitmap;
        width = bitmap.width;
        height = bitmap.height;
    }
    else if (typeof ImageBitmap !== 'undefined' && input instanceof ImageBitmap) {
        source = input;
        width = input.width;
        height = input.height;
    }
    else if (typeof HTMLImageElement !== 'undefined' && input instanceof HTMLImageElement) {
        source = input;
        width = input.naturalWidth || input.width;
        height = input.naturalHeight || input.height;
    }
    else if (typeof HTMLCanvasElement !== 'undefined' && input instanceof HTMLCanvasElement) {
        source = input;
        width = input.width;
        height = input.height;
    }
    else {
        throw new Error('Unsupported browser image input.');
    }
    const canvas = makeCanvas(width, height);
    const ctx = get2d(canvas);
    ctx.drawImage(source, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    disposable?.close();
    return { imageData, width, height };
}
export async function imageDataToBlob(imageData, type = 'image/png', quality = 0.92) {
    const canvas = makeCanvas(imageData.width, imageData.height);
    const ctx = get2d(canvas);
    ctx.putImageData(imageData, 0, 0);
    if (canvas instanceof OffscreenCanvas) {
        return canvas.convertToBlob({ type, quality });
    }
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas encoding failed.'))), type, quality);
    });
}
//# sourceMappingURL=image.js.map