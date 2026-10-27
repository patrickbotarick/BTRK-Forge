import { useEffect, useRef, useState } from 'react';
import { previewDocument } from '../../../packages/preview-runtime/document';
import type { Project } from '../../../packages/project-schema';
import { runtimeEventSchema,type RuntimeEvent,type RuntimeState } from '../../../packages/blueprint-core';
import { z } from 'zod';
const messageSchema=z.discriminatedUnion('type',[z.object({type:z.literal('ready')}).strict(),z.object({type:z.literal('event'),event:runtimeEventSchema}).strict()]);
export function Preview({ project, runtime, run }: { project: Project; runtime:RuntimeState; run: (event:RuntimeEvent) => void }) {
  const iframe = useRef<HTMLIFrameElement>(null); const port = useRef<MessagePort | null>(null);
  const [width, setWidth] = useState('desktop');
  const current = useRef({ project, runtime, run }); current.current = { project, runtime, run };
  function render() {
    const { project, runtime } = current.current;
    const screen=structuredClone(project.screens[0]);for(const c of screen.components){if(c.type==='Text')c.props.text=runtime.properties[c.id]??c.props.text;if(c.type==='Input')c.props.initialValue=runtime.properties[c.id]??c.props.initialValue;}
    port.current?.postMessage({ type: 'render', screen, value: runtime.variables.count ?? 0 });
  }
  function connect() {
    port.current?.close();
    const channel = new MessageChannel(); port.current = channel.port1;
    channel.port1.onmessage = event => {
      const message=messageSchema.safeParse(event.data);if(!message.success)return;
      if(message.data.type==='ready')render();else current.current.run(message.data.event);
    };
    channel.port1.start();
    iframe.current?.contentWindow?.postMessage('forge:init', '*', [channel.port2]);
  }
  useEffect(render, [project, runtime]);
  useEffect(() => () => port.current?.close(), []);
  return <section className="preview-panel"><div className="preview-tools"><label>Viewport <select aria-label="Viewport" value={width} onChange={e => setWidth(e.target.value)}><option value="desktop">Desktop · fluido</option><option value="web">Web · 768 px</option><option value="mobile">Celular · 375 px</option></select></label><span>Simulação responsiva · não é emulação nativa</span></div><div className="viewport"><iframe title="Preview isolado" sandbox="allow-scripts" srcDoc={previewDocument} onLoad={connect} ref={iframe} style={{ width: width === 'desktop' ? '100%' : width === 'web' ? 768 : 375 }} /></div></section>;
}
