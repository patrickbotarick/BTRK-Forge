import { handleRuntimeRequest } from '../blueprint-core';
import { handleDebugRequest } from '../blueprint-core/runtime';
import { debugReplySchema } from '../runtime-debug';
self.onmessage=(event:MessageEvent<unknown>)=>{
  if(typeof event.data==='object'&&event.data!==null&&'debugSession' in event.data){
    if(JSON.stringify(event.data).length>3_000_000)return;
    const result=handleDebugRequest(event.data);if(result)self.postMessage(debugReplySchema.parse(result));
  }else self.postMessage(handleRuntimeRequest(event.data));
};
