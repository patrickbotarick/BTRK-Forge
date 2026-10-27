import { handleRuntimeRequest } from '../blueprint-core';
self.onmessage=(event:MessageEvent<unknown>)=>self.postMessage(handleRuntimeRequest(event.data));
