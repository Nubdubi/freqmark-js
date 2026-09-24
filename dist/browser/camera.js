import { createDecodeWorker } from './detector.js';
export function confidenceLabel(confidence, found = confidence >= 0.5) {
    if (!found || confidence < 0.5)
        return 'Not detected';
    if (confidence < 0.7)
        return 'Possible';
    if (confidence < 0.85)
        return 'Likely';
    return 'Strong';
}
export function trackingDecodeOptions(base, previous, trackedScans, fullSearchEvery = 10) {
    const canTrack = Boolean(previous?.found && previous.transform && previous.confidence >= 0.7 && trackedScans < fullSearchEvery);
    if (!canTrack)
        return { options: { ...base, robust: base.robust ?? true }, tracked: false };
    const blockSize = previous.transform.blockSize;
    const rotation = previous.sync.rotationDeg;
    return {
        tracked: true,
        options: {
            ...base,
            robust: true,
            blockSizes: [...new Set([Math.round(blockSize), Math.round(blockSize - 1), Math.round(blockSize + 1)])]
                .filter((value) => value >= 4 && value <= 16),
            rotationCandidates: base.searchRotation
                ? [rotation - 1, rotation, rotation + 1]
                : undefined,
        },
    };
}
function makeCaptureCanvas(width, height) {
    if (typeof OffscreenCanvas !== 'undefined')
        return new OffscreenCanvas(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}
export function createCameraDetector(options) {
    const callbacks = new Set();
    const worker = options.worker ?? createDecodeWorker();
    const ownsWorker = !options.worker;
    let ownedStream = null;
    let active = false;
    let timer = null;
    let previous = null;
    let trackedScans = 0;
    const scan = async () => {
        if (!active)
            return;
        const videoWidth = options.video.videoWidth;
        const videoHeight = options.video.videoHeight;
        if (videoWidth > 0 && videoHeight > 0) {
            const limit = Math.max(160, options.resolution ?? 720);
            const scale = Math.min(1, limit / Math.max(videoWidth, videoHeight));
            const width = Math.max(1, Math.round(videoWidth * scale));
            const height = Math.max(1, Math.round(videoHeight * scale));
            const canvas = makeCaptureCanvas(width, height);
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (context && 'getImageData' in context) {
                context.drawImage(options.video, 0, 0, width, height);
                const frame = context.getImageData(0, 0, width, height);
                const base = {
                    robust: options.robust ?? true,
                    searchRotation: options.searchRotation ?? true,
                    placementSeed: options.placementSeed,
                    pilotSeed: options.pilotSeed,
                };
                const plan = trackingDecodeOptions(base, previous, trackedScans, options.fullSearchEvery ?? 10);
                try {
                    const result = await worker.decodeImageData(frame, plan.options);
                    if (!active)
                        return;
                    previous = result;
                    trackedScans = plan.tracked && result.found && result.confidence >= 0.7 ? trackedScans + 1 : 0;
                    const cameraResult = {
                        ...result,
                        label: confidenceLabel(result.confidence, result.found),
                        tracked: plan.tracked,
                        frameWidth: width,
                        frameHeight: height,
                    };
                    for (const callback of callbacks)
                        callback(cameraResult);
                }
                catch {
                    previous = null;
                    trackedScans = 0;
                }
            }
        }
        if (active)
            timer = setTimeout(() => void scan(), Math.max(100, options.scanIntervalMs ?? 200));
    };
    return {
        get running() { return active; },
        async start() {
            if (active)
                return;
            if (!options.video.srcObject) {
                if (!navigator.mediaDevices?.getUserMedia)
                    throw new Error('getUserMedia is not available.');
                ownedStream = await navigator.mediaDevices.getUserMedia(options.mediaConstraints ?? {
                    video: { facingMode: 'environment', height: { ideal: options.resolution ?? 720 } }, audio: false,
                });
                options.video.srcObject = ownedStream;
            }
            await options.video.play();
            active = true;
            void scan();
        },
        stop() {
            active = false;
            if (timer)
                clearTimeout(timer);
            timer = null;
            if (ownedStream) {
                for (const track of ownedStream.getTracks())
                    track.stop();
                if (options.video.srcObject === ownedStream)
                    options.video.srcObject = null;
                ownedStream = null;
            }
            if (ownsWorker)
                worker.terminate();
        },
        onResult(callback) {
            callbacks.add(callback);
            return () => callbacks.delete(callback);
        },
    };
}
//# sourceMappingURL=camera.js.map