# Depuração transitória — Fase 1D-D

Implementação candidata à revisão, sem encerramento da Fase 1D ou autorização da próxima fase. O Studio continua executando o interpretador declarativo; não executa o TypeScript gerado.

## Autoridade e compatibilidade

O documento schema v3 é a fonte persistente. Nenhum campo de trace, runtime, variável mutada ou histórico é acrescentado ao manifesto. IR v1, Codegen v1, semantic-runtime, orçamento de 10.000 visitas, transações e respostas legadas permanecem compatíveis. As APIs `executeEvent` e `handleRuntimeRequest` admitem um observador opcional; sem observador mantêm o resultado original. `executeLegacy` continua sem instrumentação.

O protocolo de diagnóstico é separado de `RuntimeReply`. Não foi acrescentado campo obrigatório ao contrato compartilhado pelo executável TypeScript: o harness e seus oráculos/mutações continuam comparando as respostas completas originais. Testes específicos comparam a resposta do interpretador instrumentado com a resposta sem instrumentação para sucesso, falha, leitura após escrita, ingestão/rollback e orçamento excedido. Não se promete equivalência de trace com TypeScript, pois ele não emite este novo protocolo.

## Protocolo v1

`packages/runtime-debug` contém schemas Zod estritos, limites, coletor e política de histórico. O Worker reconhece o pedido legado acrescido de `debugSession` UUID, valida-o e remove esse campo antes de chamar o contrato legado. A resposta diagnóstica é `{version:1, session, reply:RuntimeReply, debug}`. Pedidos legados continuam recebendo resposta legada.

`debug` contém `entries`, `truncated`, `dropped` e `outcome` (commit, rollback ou error). A versão, sessão, resposta, tipos, ordem contígua e limites são validados ao emitir e receber. O resultado da transação deve concordar com a resposta. No Studio, sessões, instância do Worker e pedido ativo são conferidos antes de aplicar os dados. O pedido recebe ID monotônico; cada registro herda sessão, pedido e evento de seu envelope/histórico.

Cada entrada contém ordem base zero, `kind` e `nodeId` ou null. Conforme o tipo, pode trazer target/scope, before/after, value, branch ou message. Valores são string de até 1000 unidades UTF-16, number finito ou boolean; não são executados como código. O painel explicita tipos, distingue -0 e usa renderização React escapada, com quebra de strings longas/Unicode. Identificadores obedecem ao contrato existente. Não há stack nativo, token Rust ou dados externos ao projeto no envelope.

## Ordem real e transação

- `event`: entrada autorizada, com o node associado quando existente. Validações anteriores à entrada podem falhar globalmente e não inventam um node.
- `evaluate` entra na expressão depois de uma visita semântica bem-sucedida; `value` registra o resultado validado. Reavaliações aparecem novamente. Não há cache de expressões ou visita adicional para depuração.
- `read-variable` e `read-property` observam o valor efetivamente lido naquele ponto.
- `condition` precede a avaliação; `branch` registra yes/no depois do teste real. O ramo não percorrido não aparece como executado.
- `action` precede a avaliação da atribuição/atualização. `assign`, `set-text` e `binding` registram a escrita efetiva, inclusive quando before e after são iguais.
- `ingest` registra primeiro Input.value, depois a variável vinculada, quando houver; a sincronização dos bindings segue a ordem dos componentes. Isso acontece antes da transação de ações e não provoca eventos recursivos.
- `commit` confirma as ações. Em falha, `error` identifica a origem disponível; entradas `rollback` com target mostram diferenças entre o estado de trabalho e a base pós-ingestão; a entrada final de rollback identifica o encerramento lógico. Essas diferenças são uma explicação da restauração integral, não operações de escrita adicionais do interpretador.

Rollback conserva ingestão válida e reverte ações, conforme a semântica anterior. A inspeção não desliga orçamento, watchdog ou validação. Erro de orçamento conserva o node responsável mesmo se o trace já estiver truncado, por meio do campo nodeId do histórico derivado da resposta.

## Limites e retenção

| Item | Limite / política |
|---|---|
| Entradas por evento | 200, prefixo ordenado |
| Dados de trace por evento | até aproximadamente 64.000 unidades UTF-16 serializadas, incluindo reserva para envelope |
| Histórico | 20 eventos; remove primeiro o mais antigo |
| Histórico serializado | 512.000 unidades UTF-16; remove eventos antigos até caber |
| Pedido Worker | 3.000.000 caracteres serializados |
| Resposta recebida | 3.100.000 caracteres serializados |
| Fila pendente | 32 eventos além do ativo, como anteriormente |
| Watchdog | 2 segundos, como anteriormente |

O coletor interrompe retenção de entradas quando um limite é atingido, conta omissões e mantém o resultado final fora da lista truncada. Limites em unidades serializadas não são medição exata do heap V8, mas restringem cardinalidade e tamanho dos dados retidos. O histórico informa quantidade de eventos removidos. Rejeição por fila cheia mantém o aviso existente; evento não admitido não ganha execução ou pedido fictício.

Limpar histórico remove somente registros; não altera runtime/documento. Reiniciar estado cria nova sessão de diagnóstico e limpa histórico/estado. Interromper ou timeout mantém o registro de interrupção na sessão atual e recria o Worker/estado inicial; não afirma rollback confirmado pelo Worker e informa que não há trace parcial disponível. A fila descartada não é apresentada como executada. Mudança efetiva de documento, projeto, fechamento ou nova sessão Rust limpa os dados; metadata de salvamento não reinicia. Callbacks de Worker anterior e replies de outro pedido/sessão são descartados. Histórico não sobrevive ao reinício do aplicativo.

Para compatibilidade com consumidores legados e testes de coordenação, uma resposta legada válida pode produzir histórico com detalhes indisponíveis. Não se fabrica trace ausente. Resposta inválida ou erro do Worker é mostrado como falha global; mensagem excessiva/não serializável não é aplicada e permanece sujeita ao watchdog.

## Interface e navegação

A aba Depuração separa a inspeção da interface principal. À esquerda há eventos em ordem cronológica e estados textuais/símbolos: concluído, falha, interrompido ou tempo excedido. À direita, tabelas somente leitura mostram valores iniciais/atuais das variáveis e propriedades transitórias de Input/Text. A sequência do evento selecionado apresenta ações, ramos e valores anteriores/posteriores; esses detalhes históricos não são confundidos com a tabela do estado atual.

Botões Blueprint/Código usam apenas IDs de origem disponíveis. Blueprint seleciona e enquadra o node; Código revela sua definição e ocorrências usando o mapa atual da 1D-C, aguardando regeneração quando necessário. Não há persistência de linhas como identidade nem aplicação de mapa obsoleto. Alterações do documento descartam o histórico correspondente. Rascunhos JSON nativos conservam as proteções existentes.

Ao voltar ao Blueprint, os participantes do evento inspecionado são destacados. Labels EXECUTADO, ERRO/INVÁLIDO e SELECIONADO complementam as cores. O estado de erro tem prioridade visual; seleção e execução são identificadas separadamente. Nodes fora de um prefixo truncado não são inventados como observados. Navegação não grava posições, não modifica o manifesto e não cria transação undo/redo.

Layouts foram exercitados em 1366×768 e Full HD com área rolável. Isso não é homologação universal de DPI/acessibilidade ou de grafos grandes. Não foram implementados breakpoints, step-into, step-over, edição pelo painel, execução arbitrária ou TypeScript no Preview.

## Segurança e evidências

Preview mantém iframe `sandbox=allow-scripts`, MessageChannel e mensagens validadas, sem bridge Tauri. Worker declarativo, CSP, permissões nativas, Rust, schema/migrações e dependências não foram ampliados. O trace é retornado em mensagem estruturada limitada; não é persistido, enviado a serviço externo ou carregado como código.

[Relatório](phases/RELATORIO_FASE_01D_D.md) e [QA](qa/VALIDACAO_FASE_01D_D.md) distinguem execução automatizada, driver Rust/filesystem e janela Windows real. O aceite da subetapa e o encerramento da Fase 1D exigem revisão posterior.

Continuam abertas as cinco ressalvas: durabilidade física sob falta de energia; corrida externa residual sem CAS de kernel; RustSec; instalação/desinstalação limpa; mensagem histórica WebView2 no encerramento. Permanecem harness sem sandbox de SO, corpus diferencial finito, runtime companheiro fixo, revisão CommonJS antes de TS7, custo inicial do compiler Worker, exportação geral, edição bidirecional, assinatura/atualização e demais limites anteriores.
