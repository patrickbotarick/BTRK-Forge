import type { GraphNode, Scalar } from '../../../packages/project-schema';

export const catalog:{label:string;kind:GraphNode['kind'];value?:Scalar}[]=[{label:'Evento do componente',kind:'event'},{label:'Ler variável',kind:'variable'},{label:'Definir variável',kind:'set'},{label:'Constante de texto',kind:'constant',value:''},{label:'Constante numérica',kind:'constant',value:1},{label:'Constante booleana',kind:'constant',value:false},{label:'Ler componente',kind:'component-value'},{label:'Definir texto',kind:'set-text'},{label:'Texto vazio',kind:'empty'},{label:'Concatenar',kind:'concat'},{label:'Somar',kind:'add'},{label:'Maior que',kind:'greater'},{label:'Condição',kind:'condition'}];

export function matchesNode(label: string, kind: GraphNode['kind'], query: string) {
  const terms: Record<GraphNode['kind'], string> = {
    event: 'eventos clique alteração onClick onChange fluxo execução',
    variable: 'dados estado leitura', set: 'dados estado atribuir ação definir escrita',
    constant: 'dados literal valor string number boolean',
    'component-value': 'interface dados propriedade input texto',
    'set-text': 'interface ação atualizar conteúdo',
    empty: 'texto vazio string validar', concat: 'texto juntar unir string',
    add: 'matemática soma adicionar número mais', greater: 'matemática comparar comparação maior número',
    condition: 'fluxo decisão se ramo ramificação boolean'
  };
  const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
  const searchable = normalize(label + ' ' + terms[kind]);
  return normalize(query).trim().split(/\s+/).every(word => searchable.includes(word));
}
