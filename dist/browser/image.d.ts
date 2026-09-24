export type BrowserImageInput = Blob | ImageBitmap | HTMLImageElement | HTMLCanvasElement;
export interface LoadedImage {
    imageData: ImageData;
    width: number;
    height: number;
}
export declare function loadImage(input: BrowserImageInput): Promise<LoadedImage>;
export declare function imageDataToBlob(imageData: ImageData, type?: string, quality?: number): Promise<Blob>;
//# sourceMappingURL=image.d.ts.map