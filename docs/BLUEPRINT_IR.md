# Blueprint IR v1 — contrato da Fase 1D-A

Status: implementada, candidata à revisão. Não há gerador TypeScript, executor IR ou integração Monaco nesta subetapa.

## Autoridade e responsabilidades

O documento BTRK schema v3 continua sendo a única fonte persistente de verdade. `parseProject` migra v0/v1/v2 em cópia. `validateProject` continua sendo a autoridade de aceitação de tipos, referências, portas, unicidade, limites e ausência de ciclos. A IR não substitui esses validadores.

- Grafo: definição declarativa, IDs, referências, portas, associações e posições persistentes.
- IR: projeção tipada, determinística, destacada da entrada e congelada profundamente. Expõe significado e origem; não avalia expressões, não aplica efeitos e não otimiza o grafo.
- Runtime atual: valida estado/evento, interpreta o grafo, aplica ingestão, avaliação, transação, orçamento e falhas. Não foi refatorado nesta fase.
- Coordenação (`use-runtime`): FIFO, pedido ativo, identidade monotônica, sessão, timeout, interrupção, reset e consolidação da renderização. Não é responsabilidade da IR.
- Rete, React, Monaco e Tauri não são dependências de implementação da IR. A validação de árvore existente é alcançada pelo Blueprint Core, sem importar bibliotecas visuais.

## API e versões

`lowerBlueprint(input: unknown, {mode?: 'editable' | 'executable'})` retorna `IRResult`. O modo padrão é `executable`. A entrada é um objeto de documento, não texto JSON; parsing textual continua no formato oficial.

- `ok:false`: `ir:null` e diagnósticos; nunca retorna uma IR parcialmente validada para um documento estruturalmente inválido.
- `ok:true`: IR derivada. Em modo `editable`, entradas obrigatórias ausentes são representadas por `null`, retornam diagnósticos e tornam `ir.executable:false`.
- No modo `executable`, as mesmas entradas ausentes recusam a transformação. Um consumidor futuro deve verificar `executable`; `ok` isoladamente não autoriza execução.
- `executable:true` significa documento estruturalmente pronto, não sucesso garantido: valores/eventos futuros ainda podem causar overflow, limite de visitas ou outras falhas runtime.
- `irVersion:1` é independente de `source.schemaVersion:3`. A versão dos contratos básicos também é 1. Não foi criado schema v4, novo campo no manifesto ou arquivo de IR salvo automaticamente.

Uma transformação repetida do mesmo documento produz os mesmos dados. Arrays preservam a ordem do documento, inclusive nodes desconectados, associações nulas e eventos sem associação. Isso preserva também precedência de validação; não se promete igualdade byte a byte para documentos com arrays permutados.

## Estrutura e origem

`BlueprintIR` contém `source`, `executable`, `variables`, `components`, `bindings`, `entrypoints`, `nodes` e `connections`.

- Variáveis: ID, nome, tipo e valor inicial, sem estado mutado.
- Componentes: identidade dos quatro tipos, estado disabled quando aplicável e propriedade inicial runtime de Input/Text. Hierarquia, estilos e layout continuam no documento original; esta IR é de comportamento, não de renderização.
- Bindings: referência explícita variável string → Input.value. O initial da variável prevalece sobre initialValue do Input.
- Entrypoints: componente, tipo, node associado ou null, enabled e indicador de evento legado global. Nodes de evento não associados permanecem representados, sem receber disparo automático.
- Nodes: união discriminada dos 11 tipos existentes. Cada um possui `origin.nodeId` e portas tipadas. Referências de dados preservam tipo, node, conexão e saída `value`; referências de controle preservam node e conexão. Todas as conexões originais também são retidas.
- Condições preservam test/yes/no; ausência de saída significa fim de fluxo, não erro. Ausência de entrada obrigatória significa rascunho incompleto.

Exemplo: no fixture `readAfterWriteFixture`, `assign.value` e `second.value` apontam para `sum`; a IR contém somente um node sum, preservando seus operandos `a=counter` e `b=one`. Não copia nem pré-calcula a expressão. O intérprete obtém count=2, e não 1, porque volta a ler count após a primeira atribuição.

O mapa de linhas/colunas ainda não existe: só será possível após emitir código em 1D-B. IDs de origem são a fundação desse mapa, não um source map pronto. Revisões de geração e invalidação de resultados são trabalho futuro do gerador/Studio.

## Semântica obrigatória para consumidores futuros

1. Validar todo o documento e todas as entradas obrigatórias antes da ingestão, inclusive nodes desconectados. Não remover nodes inválidos por serem inalcançáveis.
2. Avaliar dados somente quando demandados por uma ação/teste. Consumir visita antes de avaliar os filhos. Avaliar `a` antes de `b`; validar e registrar o resultado depois dos operandos.
3. Não memorizar expressões entre ações. Toda demanda conta, inclusive visitas repetidas ao mesmo node. Leitura de variável/propriedade observa estado vigente.
4. Controle segue next ou somente o ramo escolhido. O catálogo possui 11 tipos semânticos, com três variantes de literal no mesmo tipo constant.
5. Binding é string. Inicializar pelo initial da variável, sincronizar todos os Inputs vinculados em ingestão/set e nunca emitir onChange recursivo. Input number/email continua entregando string.
6. Ingerir input.change antes de iniciar a transação das ações. A transação usa cópia do estado pós-ingestão. Sucesso confirma efeitos; falha descarta todas as ações daquele evento, mas retém a ingestão válida.
7. Eventos inexistentes/incompatíveis/desabilitados são recusados. Evento null ainda permite ingestão de Input; evento não associado não dispara automaticamente. Preservar associação global legada de button.click.
8. Preservar finiteza numérica, `trim` JavaScript de empty, concatenação sem interpolação executável e comprimento JavaScript de strings. Não introduzir coerções diferentes.
9. A trilha atual contém controle; executedNodes contém primeira visita única na ordem de encontro; values guarda último resultado por node. Na falha, o protocolo atual retorna trilha parcial, node quando disponível e estado de rollback; não retorna values/executedNodes. A IR não amplia esse protocolo.

Limites atuais descritos por `SEMANTIC_CONTRACT`: 10.000 visitas/evento, 1.000 caracteres/string, 200 nodes, 500 conexões, 100 variáveis, 32 eventos/documento, 2.000.000 caracteres/documento e 3.000.000 caracteres/mensagem. A transformação aplica o limite documental ao JSON compacto do objeto recebido; não é limite UTF-8 em bytes. A fila tem 32 eventos aguardando além do pedido ativo e watchdog de 2 segundos. Fila/watchdog continuam fora da IR. O objeto de contrato descreve valores atuais, não configura ou altera os limites do interpretador.

## Interfaces para runtime compartilhado

`runtime-contract.ts` define `SemanticState`, `SemanticFault`, `ActionTransaction` e `SharedRuntimeContract`. São interfaces, não implementações. A futura instância de execução é por evento, com orçamento novo. Contratos incluem inicialização/validação de estado; leitura de variável/propriedade; escrita de variável/Text; sincronização; ingestão; begin/commit/rollback; validação de valor; visita; registro de controle/valor e falha.

Escrita de variável deve sincronizar bindings. `ingestInput` valida e atualiza o Input e sua variável antes de `beginActions`. `base` da transação é pós-ingestão, working é cópia; commit/rollback retornam estado separado do manifesto. Falhas precisam preservar mensagem, origem, trilha parcial e base quando disponível. Visita precede registro de controle: se orçamento estourar, esse node não entra na trilha de controle, preservando o runtime existente.

Nenhum executor atual foi conectado a essas interfaces. A futura extração de operações compartilhadas exige regressão e testes diferenciais independentes; a mera existência dessas interfaces não demonstra equivalência.

## Diagnósticos

Codes: SIZE_LIMIT, SCHEMA_INVALID, GRAPH_INVALID e INCOMPLETE_INPUT. Todos têm severidade error e `nodeId` ou null; podem trazer componentId, connectionId, socket e path. SCHEMA_INVALID preserva caminho Zod e atribui node pelo índice do documento recebido quando possível. GRAPH_INVALID conserva a mensagem do validador oficial; um localizador auxiliar adiciona origem para referências, portas, conexões, ciclos, duplicatas, eventos e bindings quando identificável. O localizador não decide a validade. Falhas documentais, de hierarquia ou limites globais podem não ter node responsável. Diagnósticos não são uma API de correção automática nem um relatório exaustivo de todos os erros estruturais: a validação estrutural conserva a primeira falha; entradas ausentes são enumeradas na ordem do grafo/portas.

## Segurança, compatibilidade e limites da entrega

Não há eval, comandos, execução livre, imports fornecidos pelo projeto, dependências novas ou permissões nativas novas. IR e interfaces não são sandbox de código arbitrário. Schema/migrações, persistência Rust, Worker, Design, Preview, Monaco JSON, undo/redo e exportador histórico permanecem intactos.

Fixtures versionadas em `tests/fixtures/semantic-ir/` combinam projetos de teste e resultados escritos manualmente. Exercitam os dois ramos, sequência de eventos, ordem de primeira visita, expressão compartilhada, leitura após escrita e rollback pós-ingestão. Atualmente são comparadas somente ao intérprete. A 1D-B deverá compilar TypeScript real e comparar resultados/estado/ordem, mantendo expectativas independentes para evitar falha comum entre executores.

As cinco ressalvas herdadas continuam abertas: durabilidade física sob falta de energia; corrida externa residual sem CAS de kernel; auditoria RustSec; instalação/desinstalação limpa; mensagem histórica WebView2 sem correção demonstrada.
