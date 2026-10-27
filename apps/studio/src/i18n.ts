const ptBR = {
  brand: 'BTRK Forge', tagline: 'Da ideia ao aplicativo.',
  design: 'Design', graph: 'Blueprint', preview: 'Preview', code: 'Modelo JSON',
  save: 'Salvar JSON', load: 'Abrir JSON', reset: 'Restaurar exemplo',
  run: 'Executar evento', properties: 'Propriedades',
  ready: 'Pronto · núcleo local', phase: 'FASE 1C / LABORATÓRIO WEB',
  offline: 'Sem IA · operação local',
} as const;
export type Locale = 'pt-BR';
const dictionaries: Record<Locale, typeof ptBR> = { 'pt-BR': ptBR };
export const t = (key: keyof typeof ptBR, locale: Locale = 'pt-BR') => dictionaries[locale][key];
