import { MAX_COMPONENTS, MAX_DEPTH, type Component, type GraphNode } from '../project-schema';
export function validateComponents(components: Component[], graph: GraphNode[], unique: (id:string) => void) {
  if (components.length > MAX_COMPONENTS) throw new Error('Limite de 200 componentes excedido');
  const byId = new Map(components.map(c => [c.id,c]));
  for(const c of components) {
    unique(c.id);
    const visited = new Set([c.id]); let parent = c.parentId; let depth = 1;
    while(parent !== null) {
      if(visited.has(parent)) throw new Error('Ciclo na hierarquia de componentes');
      visited.add(parent); const p = byId.get(parent);
      if(!p || p.type !== 'Container') throw new Error('Pai inválido: somente Container admite filhos');
      if(++depth > MAX_DEPTH) throw new Error('Profundidade máxima de 12 componentes excedida');
      parent = p.parentId;
    }
    if(c.type === 'Button' && c.events.click !== null && !graph.some(n => n.id === c.events.click && n.kind === 'event')) throw new Error('Referência de evento inválida');
  }
}
