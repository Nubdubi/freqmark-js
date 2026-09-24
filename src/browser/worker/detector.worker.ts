/// <reference lib="webworker" />
import { processDecodeRequest } from './processor.js';
import type { DecodeWorkerRequest, DecodeWorkerResponse } from './protocol.js';

const workerScope = self as unknown as DedicatedWorkerGlobalScope;
workerScope.onmessage = (event: MessageEvent<DecodeWorkerRequest>) => {
  let response: DecodeWorkerResponse;
  try {
    response = processDecodeRequest(event.data);
  } catch (error) {
    response = {
      type: 'error',
      id: event.data.id,
      message: error instanceof Error ? error.message : String(error),
    };
  }
  workerScope.postMessage(response);
};
