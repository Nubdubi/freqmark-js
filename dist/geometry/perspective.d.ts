import { type Homography, type Quad } from './homography.js';
/** Warp with a source-to-destination homography. */
export declare function warpPerspective(source: ImageData, sourceToDestination: Homography, width: number, height: number): ImageData;
export declare function rectifyPerspective(source: ImageData, corners: Quad, width?: number, height?: number): ImageData;
//# sourceMappingURL=perspective.d.ts.map