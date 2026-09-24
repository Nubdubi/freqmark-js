import { computeHomography, invertHomography, transformPoint, type Homography, type Quad } from './homography.js';

function sample(source: ImageData, x: number, y: number, channel: number): number {
  if (x < 0 || y < 0 || x > source.width - 1 || y > source.height - 1) return channel === 3 ? 255 : 0;
  const x0 = Math.floor(x); const y0 = Math.floor(y);
  const x1 = Math.min(source.width - 1, x0 + 1); const y1 = Math.min(source.height - 1, y0 + 1);
  const tx = x - x0; const ty = y - y0;
  const top = source.data[(y0 * source.width + x0) * 4 + channel] * (1 - tx) + source.data[(y0 * source.width + x1) * 4 + channel] * tx;
  const bottom = source.data[(y1 * source.width + x0) * 4 + channel] * (1 - tx) + source.data[(y1 * source.width + x1) * 4 + channel] * tx;
  return Math.round(top * (1 - ty) + bottom * ty);
}

/** Warp with a source-to-destination homography. */
export function warpPerspective(source: ImageData, sourceToDestination: Homography, width: number, height: number): ImageData {
  const destinationToSource = invertHomography(sourceToDestination);
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sourcePoint = transformPoint(destinationToSource, { x, y });
    const index = (y * width + x) * 4;
    for (let c = 0; c < 4; c++) out[index + c] = sample(source, sourcePoint.x, sourcePoint.y, c);
  }
  return new ImageData(out, width, height);
}

export function rectifyPerspective(source: ImageData, corners: Quad, width = source.width, height = source.height): ImageData {
  const rectangle: Quad = [{ x: 0, y: 0 }, { x: width - 1, y: 0 }, { x: width - 1, y: height - 1 }, { x: 0, y: height - 1 }];
  const sourceToRectangle = computeHomography(corners, rectangle);
  return warpPerspective(source, sourceToRectangle, width, height);
}
