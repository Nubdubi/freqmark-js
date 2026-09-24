export interface Point2D {
    x: number;
    y: number;
}
export type Quad = readonly [Point2D, Point2D, Point2D, Point2D];
export type Homography = Float64Array;
export declare function computeHomography(source: Quad, destination: Quad): Homography;
export declare function transformPoint(h: Homography, point: Point2D): Point2D;
export declare function invertHomography(h: Homography): Homography;
//# sourceMappingURL=homography.d.ts.map