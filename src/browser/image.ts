export type BrowserImageInput = Blob | ImageBitmap | HTMLImageElement | HTMLCanvasElement;

export interface LoadedImage {
  imageData: ImageData;
  width: number;
  height: number;
}

function makeCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
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

function get2d(canvas: OffscreenCanvas | HTMLCanvasElement): OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || !('getImageData' in ctx)) {
    throw new Error('Unable to acquire a 2D canvas context.');
  }
  return ctx as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
}

export async function loadImage(input: BrowserImageInput): Promise<LoadedImage> {
  let source: CanvasImageSource;
  let width: number;
  let height: number;
  let disposable: ImageBitmap | null = null;

  if (input instanceof Blob) {
    const bitmap = await createImageBitmap(input);
    disposable = bitmap;
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
  } else if (typeof ImageBitmap !== 'undefined' && input instanceof ImageBitmap) {
    source = input;
    width = input.width;
    height = input.height;
  } else if (typeof HTMLImageElement !== 'undefined' && input instanceof HTMLImageElement) {
    source = input;
    width = input.naturalWidth || input.width;
    height = input.naturalHeight || input.height;
  } else if (typeof HTMLCanvasElement !== 'undefined' && input instanceof HTMLCanvasElement) {
    source = input;
    width = input.width;
    height = input.height;
  } else {
    throw new Error('Unsupported browser image input.');
  }

  const canvas = makeCanvas(width, height);
  const ctx = get2d(canvas);
  ctx.drawImage(source, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  disposable?.close();

  return { imageData, width, height };
}

export async function imageDataToBlob(
  imageData: ImageData,
  type = 'image/png',
  quality = 0.92,
): Promise<Blob> {
  const canvas = makeCanvas(imageData.width, imageData.height);
  const ctx = get2d(canvas);
  ctx.putImageData(imageData, 0, 0);

  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type, quality });
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas encoding failed.'))),
      type,
      quality,
    );
  });
}
