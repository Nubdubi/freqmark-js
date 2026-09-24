/// <reference lib="webworker" />
import { processDecodeRequest } from './processor.js';
const workerScope = self;
workerScope.onmessage = (event) => {
    let response;
    try {
        response = processDecodeRequest(event.data);
    }
    catch (error) {
        response = {
            type: 'error',
            id: event.data.id,
            message: error instanceof Error ? error.message : String(error),
        };
    }
    workerScope.postMessage(response);
};
//# sourceMappingURL=detector.worker.js.map