import { useEffect, useRef, useState } from 'react';
import { previewDocument } from '../../../packages/preview-runtime/document';
import type { Project, Scalar } from '../../../packages/project-schema';
export function Preview({ project, state, run }: { project: Project; state: Record<string, Scalar>; run: () => void }) {
  const iframe = useRef<HTMLIFrameElement>(null); const port = useRef<MessagePort | null>(null);
  const [width, setWidth] = useState('desktop');
  const current = useRef({ project, state, run }); current.current = { project, state, run };
  function render() {
    const { project, state } = current.current;
    const screen = project.screens[0];
    port.current?.postMessage({ type: 'render', screen, value: state.count ?? 0 });
  }
  function connect() {
    port.current?.close();
    const channel = new MessageChannel(); port.current = channel.port1;
    channel.port1.onmessage = event => {
      if (event.data?.type === 'ready') render();
      if (event.data?.type === 'button.click' && current.current.project.screens[0].components.some(c=>c.type==='Button' && !c.props.disabled && c.events.click===event.data.eventId)) current.current.run();
    };
    channel.port1.start();
    iframe.current?.contentWindow?.postMessage('forge:init', '*', [channel.port2]);
  }
  useEffect(render, [project, state]);
  useEffect(() => () => port.current?.close(), []);
  return <section className="preview-panel"><div className="preview-tools"><label>Viewport <select aria-label="Viewport" value={width} onChange={e => setWidth(e.target.value)}><option value="desktop">Desktop · fluido</option><option value="web">Web · 768 px</option><option value="mobile">Celular · 375 px</option></select></label><span>Simulação responsiva · não é emulação nativa</span></div><div className="viewport"><iframe title="Preview isolado" sandbox="allow-scripts" srcDoc={previewDocument} onLoad={connect} ref={iframe} style={{ width: width === 'desktop' ? '100%' : width === 'web' ? 768 : 375 }} /></div></section>;
}
