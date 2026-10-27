# Gerador TypeScript v1 — Fase 1D-B

Estado: implementado e candidato à revisão. Não há encerramento oficial, integração Monaco 1D-C, exportador geral ou execução do TypeScript no Preview.

## Arquitetura e autoridade

Documento v3 → Blueprint Core/validação → IR v1 → validação do gerador → AST TypeScript → impressor determinístico → código, revisão e mapa de origens.

O documento continua sendo a fonte persistente de verdade. A IR v1 não mudou. Nenhum código gerado, mapa ou estado transitório é inserido automaticamente no manifesto. O gerador não importa Rete, React, Monaco ou Tauri. TypeScript já era uma dependência de desenvolvimento; não houve instalação ou alteração de lockfile.

`packages/typescript-codegen/validate.ts` valida formato, versão, limites e completude de uma IR recebida como unknown. Reconstrói uma definição sintética de comportamento e a passa pelo lowering oficial, comparando a projeção resultante com a IR recebida. Assim, executable=true ou uma anotação TypeScript não bastam para aceitar referências/portas adulteradas. A reconstrução existe apenas para validação; não é executada pelo programa emitido. Layout e estilos não pertencem à IR de comportamento.

`packages/typescript-codegen/index.ts` emite uma função tipada por node, com nomes derivados de índice e ID sanitizado. Índice evita colisões como a-b/a_b. Dados usam chamadas sob demanda; controle usa chamadas explícitas e if/else. Não há memoização, expansão de expressões compartilhadas, otimização de ordem, grafo JSON embutido ou delegação ao interpretador.

## API e artefato

`await generateTypeScript(input: unknown): GenerationResult`:

- Sucesso: ok=true, artifact e diagnostics=[].
- Falha: ok=false, artifact=null e diagnósticos INVALID_IR ou GENERATION_FAILED, com nodeId quando identificável. Erros globais podem ter nodeId=null.
- artifact: code, irVersion=1, generatorVersion=1, runtimeVersion=1, revision SHA-256, nodeRanges e helperRanges.
- A revisão usa representação canônica da IR: chaves de objetos ordenadas, ordem dos arrays preservada e zero negativo distinguido de zero positivo. Não representa o documento visual completo nem promete igualdade para arrays permutados.
- A geração é assíncrona por usar Web Crypto para SHA-256. A impressão usa LF, AST e literais escapados. Mesmo objeto lógico, mesma revisão, código e mapa.

O código importa somente `./runtime.js`, um módulo companheiro fixo e versionado. A infraestrutura de build do consumidor deverá fornecê-lo; o projeto não escolhe imports. Metadata é exportada, e um guard recusa runtime com versão diferente. A presença de metadata não autoriza executar código editado pelo usuário.

O entrypoint emitido é `execute(input: unknown): RuntimeReply`, para um projeto fixo. Recebe requestId, event e runtime opcional. O envelope compilado não recebe o documento project: a definição já foi validada e compilada. O harness acrescenta project somente ao pedido equivalente do interpretador. Respostas de ambos são comparadas integralmente, sem remover ou normalizar diferenças.

## Matriz dos 11 nodes

| Node | Emissão e contrato |
|---|---|
| event | Função de entrada que registra controle e segue next; dispatch por componente/tipo, incluindo legado |
| constant | Literal number finito/string/boolean; preserva -0 e caracteres escapados |
| variable | Leitura tipada do estado atual em cada demanda |
| set | Avalia value, escreve variável, sincroniza bindings e segue next |
| component-value | Lê propriedade transitória de Input ou Text |
| set-text | Avalia value e atualiza Text transitório |
| add | Number(a()) + Number(b()), nessa ordem, resultado finito |
| greater | Number(a()) > Number(b()), nessa ordem |
| empty | String(value()).trim().length === 0 |
| concat | String(a()) + String(b()), sem interpolação executável |
| condition | if/else que chama somente o ramo escolhido |

Cada função visita o node antes de avaliar filhos ou registrar controle. Valores são validados/registrados após avaliação. Dados compartilhados têm uma definição e múltiplas chamadas, sem cache. Leituras após set observam as alterações do mesmo evento.

Exemplo real do cenário de leitura após escrita (trecho do artefato completo em [evidência](qa/evidencias/fase01d-b/read-after-write.generated.ts.txt)):

```typescript
function n7_assign(ctx: SemanticRuntime, state: SemanticState): void {
    ctx.visit({
        "nodeId": "assign"
    });
    ctx.recordControl({
        "nodeId": "assign"
    });
    ctx.writeVariable(state, "count", n3_sum(ctx, state));
    n6_branch(ctx, state);
}
```

sum é chamado novamente pelo teste e pela atribuição posterior. O resultado esperado independente é count=2, não um valor pré-calculado antes da primeira escrita.

## Runtime básico e extração incremental

`packages/semantic-runtime/primitives.ts`: RuntimeFault, VisitBudget de 10.000 visitas e checkScalar. O interpretador e o executor compilado compartilham essas operações. Visitas repetidas contam; o conjunto de executados registra primeira visita, incluindo o node cujo consumo esgota o orçamento. A trilha de controle só registra depois de uma visita bem-sucedida.

`protocol.ts`: schemas de estado, eventos, pedidos e respostas extraídos sem mudança de contrato, com reexports compatíveis no Blueprint Core. O pedido compilado é a variante sem project.

`index.ts`: SemanticRuntime implementa os contratos básicos preparados em 1D-A: estado inicial/validado, leitura/escrita, bindings, ingestão, begin/commit/rollback, validação e rastreamento. runProgram valida o envelope, seleciona o evento autorizado, ingere Input, inicia transação e chama a função de controle emitida. Ele não conhece nodes, conexões ou operações de grafo.

O interpretador mantém sua própria travessia e sua lógica existente de estado/transação/binding. A extração foi limitada a primitivas e schemas, com 68 testes existentes aprovados antes, após as primitivas e após o protocolo. Não se afirma que toda a implementação do interpretador tenha sido substituída pela nova classe.

Input com binding inicia pelo initial da variável. Input number/email continua string. Ingestão e set sincronizam todos os Inputs vinculados, sem emitir eventos recursivos. A transação copia a base pós-ingestão; falha descarta todas as ações, mas preserva a ingestão. Commit/rollback retornam estado separado do manifesto e da transação. Erros preservam mensagem, node e trilha parcial; erros anteriores às ações retornam runtime=null.

## Coordenação separada

FIFO, 32 eventos aguardando, IDs monotônicos, sessão, reset, interrupção, consolidação de renderização e watchdog de dois segundos continuam em use-runtime, que não foi alterado. O TypeScript gerado implementa a semântica de um evento, não um scheduler concorrente.

O harness chama eventos sequencialmente, entregando o estado retornado ao seguinte. Os E2E novos exercitam a coordenação real do Studio com Worker fixo de teste: excesso de fila, eventos Input distintos, estado encadeado, resposta atrasada e reset/terminação da sessão anterior. A regressão existente cobre interrupção e timeout sem exigir igualdade exata de tempo de parede. A suíte nativa mantém a cobertura de fechar/reabrir e estado de sessão.

## Convenção do mapa de origens

- start/end: offsets em unidades UTF-16, base zero, intervalo [start,end).
- Linhas e colunas: base um, também em unidades UTF-16; fim exclusivo.
- Quebra de linha emitida: LF. Literais podem conter escapes; posições se referem ao código efetivamente impresso, não ao texto desescapado do projeto.
- nodeRanges[nodeId]: definição e zero ou várias chamadas, com role=definition/call. Uma expressão compartilhada tem múltiplos trechos. Nodes desconectados também possuem definição.
- helperRanges: imports, guard de versão, modelo básico, metadata e entrypoint auxiliar, sem node associado.
- Intervalos podem se sobrepor: uma chamada a outro node está dentro da definição do chamador. A futura navegação deverá escolher o menor intervalo pertinente e distinguir a role. IDs, revisão e código são a identidade; números de linha não são persistidos como IDs.

O mapa é calculado reanalisando o código impresso, usando os nomes gerados conhecidos. Testes conferem todos os nodes, chamadas compartilhadas, coordenadas, Unicode, escapes e LF. Não é um arquivo Source Map v3 de JS/transpilação nem integração Monaco pronta.

## Harness e oráculos

`tests/codegen/harness.ts` recebe somente projetos de teste, passa por lowering/geração e grava fontes em artifacts/phase01d-b-20261027/harness/run-*. Executa ts.createProgram, getPreEmitDiagnostics e emit com noEmitOnError/strict. Um teste com erro de tipo deliberado confirma recusa antes de executar. Não usa transpileModule como substituto do typecheck.

O build de teste é CommonJS, para os imports sem extensão existentes. O resolver legado suportado pelo TypeScript 6 usa ignoreDeprecations=6.0 apenas para o aviso de depreciação da configuração, sem ignorar erros de tipos. A futura atualização para TypeScript 7 exige revisar essa configuração do harness. O código público emitido continua TypeScript com import/export.

O runner fixo executa somente os módulos compilados de uma lista fechada. A compilação recusa dependência do Blueprint Core no programa gerado. Cada cenário roda em processo Node separado; eventos sucessivos do cenário compartilham o mesmo módulo compilado e encadeiam o estado real retornado pelo programa. O intérprete encadeia seu próprio estado, independentemente. IPC advanced preserva -0/NaN nos dados de teste. Há limite de 64 eventos/cenário, cinco segundos, saída de 64.000 bytes e heap antigo V8 de 128 MiB. Esses limites são do harness, não o watchdog do Studio. Código e mapas ficam como artefatos de QA, nunca no manifesto.

Comparações após cada evento: sucesso/falha, requestId, evento, variáveis, propriedades, trilha, ordem de primeira visita dos executados, últimos valores disponíveis, mensagem, origem e rollback. Na falha, o contrato atual não expõe values/executedNodes; não são inventados. A comparação acontece antes de gravar diagnóstico JSON, sem coerção ou normalização do esperado.

Oráculos independentes: fixtures manuais da 1D-A; expectativas adicionais de overflow, visitas, limites UTF-16, zero negativo, transações, binding, eventos encadeados e estados. Corpus reproduzível: seeds 1, 2, 42, 4096, 65535, 1793047, 3735928559 e 4294967295, cada uma com três eventos. Divergências gravam índice, seed, evento, entradas e respostas em failure.json, além das fontes/mapas e diagnósticos do compilador.

Quatro mutações allowlisted em AST de teste foram detectadas: soma trocada por subtração; escrita omitida; ramo forçado para no; visitas omitidas. Mutantes não integram a API pública nem seus mapas são utilizados como resultados válidos. Resultados independentes reduzem, mas não eliminam, o risco de um defeito compartilhado no runtime.

## Segurança e limites

O compilador recebe apenas IR estrita, revalidada e executável. Texto vira literal AST; identificadores, imports e operadores são definidos pela implementação. Os testes incluem aspas, barras, Unicode, quebras, texto semelhante a código e fechamento de script, executados como dados. Projetos não escolhem módulos, comandos, dependências ou acesso ao filesystem.

**O processo Node do harness não é uma sandbox de SO para código hostil.** Ele herda permissões do usuário; o heap V8 não limita toda a memória do processo. A garantia é executar apenas código produzido pelo gerador allowlisted e o runtime fixo em testes controlados. Não oferecer esse harness como serviço para TypeScript editado, plugins ou código de terceiros.

Não há eval em produção, import escolhido pelo projeto, bridge Tauri, mudança de permissões ou execução gerada no Preview/Rust. O Studio segue usando o Worker/intérprete validado. A geração não foi conectada ao produto nesta subetapa; desempenho do compilador no navegador e consumo de mapas em Monaco pertencem à 1D-C, mediante nova aprovação.

Schema v3, IR v1, migrações, Designer, Blueprint Editor, persistência Rust, Preview, Worker, Monaco JSON, histórico e exportador histórico permanecem compatíveis. Exportação visual generalizada e execução livre continuam pendentes. Permanecem abertas as cinco ressalvas herdadas: energia, corrida externa residual sem CAS de kernel, RustSec, instalação/desinstalação limpa e mensagem histórica WebView2 sem correção demonstrada.
