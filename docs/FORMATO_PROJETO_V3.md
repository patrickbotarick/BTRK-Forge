# Formato BTRK v3 — eventos e lógica visual

O schemaVersion 3 substitui o formato corrente v2 para representar eventos escopados, binding de Input e quatro novos tipos de node. O envelope metadata.documentVersion continua 1. O único manifesto persistente continua project.btrk.json. Não há segundo arquivo de estado runtime.

## Estrutura e migração

`project.schema.json` é gerado de Zod e consumido pelo Rust. `project-v1.schema.json` e `project-v2.schema.json` ficam congelados. Execute `npm run schema:generate` após mudanças deliberadas; o gerador atualiza a fixture logic-v3, preservando visual-v2 histórica.

Migrações em cópia: v0 → v1 (campos reservados), v1 → v2 (árvore visual), v2 → v3. O legado é validado contra seu schema antes de transformar; o resultado passa pelo schema atual e validação semântica de IDs, referências, tipos, eventos, hierarquia e ciclos. V2 continua exigindo exatamente um evento legado. Versões futuras/campos desconhecidos são recusados.

V2 → v3 preserva IDs, posições, conexões, variáveis, estilos, textos e metadados. Input recebe `props.binding:null` e `events:{change:null}`. Demais componentes mantêm a forma. O evento button.click antigo continua sem componentId e preserva os vínculos compartilhados. Abrir migra somente em memória. Salvar explicitamente grava v3 e mantém os bytes antigos como backup válido.

## Diferenças do contrato

- Input: binding obrigatório, null ou ID de variável string; change obrigatório, null ou ID de evento input.change do mesmo Input.
- Button: events.click referencia button.click global legado ou escopado ao mesmo Button.
- event: event button.click ou input.change; componentId opcional somente para legado button.click. Entre 1 e 32 eventos por documento.
- empty: entrada string/value e saída boolean/value.
- concat: entradas string/a,b e saída string/value.
- component-value: componentId e property value (Input) ou text (Text), saída string/value.
- set-text: componentId de Text, entradas exec/in e string/value, saída exec/next.
- Tipos existentes conservam os contratos anteriores.

Projetos podem persistir conexões incompletas, porém não referências inválidas, ciclos, tipos incompatíveis, IDs duplicados ou portas inexistentes. Execução exige todas as entradas obrigatórias. Limites anteriores de componentes/profundidade/estilos/permissões continuam; até 200 nodes, 500 conexões e 100 variáveis. Só há uma tela.

A paridade TS/Rust é verificada com fixtures compartilhadas e testes positivos/negativos de referências, portas, eventos, binding, migração e gravação real. Não é uma prova formal sobre todos os documentos possíveis. O runtime é TypeScript no Worker; Rust valida/persiste documentos e não é um segundo intérprete.

Fixtures: greeting-v3 exercita os dois ramos e onChange; logic-v3 preserva o exemplo contador migrado; visual-v2, phase0-v1 e phase0-v0 permanecem legadas. [Semântica e política de referências](BLUEPRINT_ENGINE.md).
