# Relatório da Fase 1D-B — Gerador TypeScript e equivalência semântica

Data: 27/10/2026, America/Sao_Paulo. Produto BTRK Forge — BTRK Studio. Estado: **implementada e candidata à revisão**, recomendação **GO COM RESSALVAS**. Sem encerramento oficial, merge ou autorização automática da 1D-C.

## Base e arquitetura

Diretório C:\Projetos_VS_code\BTRK Forge, remote oficial https://github.com/patrickbotarick/BTRK-Forge.git. Main local/remota e HEAD iniciais: e56e716ea639ceb7c1bfdc2014c21cc476e9734c. Árvore limpa, fetch origin --prune executado antes da criação de codex/phase-01d-b-typescript-codegen. Main preservada; somente a branch de desenvolvimento é publicada.

Commits de implementação: `8123fe521b9ddde4f1d87afffbc2c4d57adac907` (runtime/protocolo), `82cfca4cee08154122778f059e880a6da390ab42` (gerador, diferenciais e evidências) e `fd95f89e6e736e7d24c093fd246df8d581dd73d1` (LF de evidência para preservar mapas no Windows). Relatório, QA, resumo e roadmap são registrados no commit documental final, cujo SHA é confirmado na entrega.

Pipeline implementado: documento v3 → validação/lowering → IR v1 executável revalidada → AST → TypeScript e mapa → typecheck real → compilação → execução controlada. O documento continua sendo a fonte persistente. Não houve schema v4 ou mudança da IR v1.

| Módulo | Entrega |
|---|---|
| packages/typescript-codegen/validate.ts | Validação estrita da IR, conferência pelo lowering oficial, diagnóstico de origem e canonicalização que preserva -0 |
| packages/typescript-codegen/index.ts | Gerador AST, impressor determinístico, metadata/versionamento, hash SHA-256 e intervalos node/trecho |
| packages/semantic-runtime/primitives.ts | Falha tipada, contagem de visitas e validação de resultados compartilhadas com o interpretador |
| packages/semantic-runtime/protocol.ts | Schemas extraídos de pedidos, eventos, estado e respostas, preservando exports existentes |
| packages/semantic-runtime/index.ts | Implementação das operações básicas da 1D-A e dispatch do programa compilado, sem travessia de grafo |
| tests/codegen/ | Harness real, gerador, diferenciais, mutações, limites e corpus reproduzível |
| tests/e2e/coordination.spec.ts | Fila cheia, FIFO, estado encadeado, descarte de respostas antigas e reset de Worker |

O código emitido tem funções tipadas por node e controle próprio com chamadas e if/else. Não embute conexões/grafo nem delega ao interpretador. Importa somente o runtime companheiro fixo e verifica sua versão. Literais do projeto são emitidos como AST; identificadores são gerados sem colisões. IDs/origens são preservados.

O [contrato técnico](../CODEGEN_TYPESCRIPT.md) inclui API, exemplo real, matriz dos 11 nodes, convenção UTF-16 dos mapas, segurança e limitações. [Fonte gerada de evidência](../qa/evidencias/fase01d-b/read-after-write.generated.ts.txt) e [mapa](../qa/evidencias/fase01d-b/read-after-write.origins.json) foram preservados para revisão.

## Semântica demonstrada

Suportados event, constant, variable, set, component-value, set-text, add, greater, empty, concat e condition. Três tipos de literal; ambos os ramos; eventos por identidade e legado; leitura transitória de Input/Text; binding string com múltiplos Inputs; atualização de variáveis number/string/boolean; expressões compartilhadas e leitura após escrita.

Dados são avaliados sob demanda, sem cache entre ações, com operandos na ordem atual. Toda visita conta, inclusive repetidas; apenas um ramo executa. Ingestão precede a transação, sincroniza bindings sem eventos recursivos e é retida quando ações falham. A falha reverte múltiplas ações e preserva node, mensagem e trilha parcial. Estado, valores, ordem dos executados e limites são comparados ao interpretador.

FIFO, cancelamento, sessão e timeout continuam na coordenação do Studio, sem alterações de implementação. Novos E2E exercitam a fila real com Worker controlado; a regressão existente cobre interrupção/timeout, sem comparação exata de tempo de parede. A execução do TypeScript continua exclusiva do harness, não do Preview.

## Evidência de equivalência e oráculos

107 testes TypeScript aprovados, dos quais 39 novos: 11 do gerador/mapas, 25 diferenciais/oráculos/mutações e 3 de primitivas independentes. Os diferenciais compilam programas reais e os executam em processo Node separado do Vitest. Eventos sucessivos de um cenário compartilham o mesmo módulo e encadeiam o estado real do programa; o interpretador encadeia seu estado independentemente.

Cada resposta é comparada integralmente: sucesso/falha, requestId, evento, variáveis, propriedades, trilha, ordem de primeira visita, valores disponíveis, mensagem e node da falha e rollback. Não há normalização de diferenças. Testes manuais herdados da 1D-A continuam como expectativas independentes. Casos adicionais cobrem Unicode, texto semelhante a código, -0, 1000/1001 caracteres, overflow, estado/evento inválido, documento incompleto, orçamento, eventos nulos/desabilitados e reinício.

Corpus adicional: oito seeds registradas no contrato, cada uma com três cliques. Foram detectadas quatro mutações semânticas intencionais em código emitido: subtração, escrita omitida, ramo forçado e visita omitida. Um erro de tipo deliberado foi recusado pelo compilador antes de executar. Isso demonstra a sensibilidade desses cenários, sem constituir prova formal para todos os grafos possíveis.

Regressão completa: **160 testes aprovados, zero falhas finais e zero ignorados**. São 107 TypeScript, 26 persistência Rust, 1 host Rust, 14 E2E web, 9 integrações nativas e 3 produção. Typecheck/lint, Cargo check/fmt, builds web/Windows/NSIS, scanner, npm audit e Git foram validados. Detalhes e condições em [QA](../qa/VALIDACAO_FASE_01D_B.md).

## Diferenças e correções intermediárias

Não restaram divergências semânticas observadas nos cenários executados. Os mutantes são divergências deliberadas de teste, não defeitos entregues. Durante preparação foram corrigidos narrowing de entrada de evento, mutação tipada de cópias nos testes negativos e a configuração de resolução CommonJS do harness para TypeScript 6. A primeira tentativa de compilação teve TS5107 e impediu os diferenciais; os testes então não executados não foram contabilizados como aprovados. A configuração final mantém strict/noEmitOnError e um teste negativo real de tipos.

Zero negativo foi preservado deliberadamente na canonicalização, AST e IPC advanced, sem converter -0 para 0 no esperado. O harness passou a executar sequências no mesmo módulo para não esconder caches/globais indevidos entre eventos. Nenhuma diferença de resultado foi mascarada.

## Compatibilidade, riscos e limites

Preservados schema v3/migrações, IR v1, Rust, Designer, editor Blueprint, Preview, Worker, Monaco JSON, histórico e exportador histórico. A extração no interpretador é incremental: primitivas e schemas, mantendo travessia e API. Os 68 testes anteriores passaram antes e após cada etapa dessa extração. Não houve dependência nova, mudança de lockfile ou permissão nativa adicional.

O harness executa apenas programas de gerador allowlisted, com tempo/saída/heap limitados, mas **não é sandbox de SO** e herda permissões do usuário. Não deve receber TS editado, plugins ou código hostil. Compartilhar primitivas não elimina risco de defeito comum; os oráculos independentes e mutações reduzem esse risco. O corpus é limitado, não um teste exaustivo.

O runtime companheiro precisa ser fornecido pelo consumidor. O resolver legado do harness é suportado no TypeScript 6 fixado e requer revisão antes de TypeScript 7. O mapa é node/intervalos TS, não Source Map v3 de transpilação. Desempenho do gerador em navegador e integração ao produto ainda não foram homologados.

O build Windows/NSIS foi realizado em CARGO_TARGET_DIR de artefatos separado, sem encerrar à força o Studio aberto. Não foi repetido smoke manual da nova janela nem instalação do NSIS. A suíte nativa UI/driver Rust não é apresentada como nova homologação WebView2 completa.

Permanecem abertas as cinco ressalvas herdadas: (1) durabilidade física sob falha de energia; (2) corrida externa residual sem CAS de kernel; (3) auditoria RustSec; (4) instalação/desinstalação em máquina limpa; (5) mensagem histórica WebView2 sem correção demonstrada. Nenhuma foi descrita como resolvida.

## Próximos passos sujeitos a aprovação

A revisão deve avaliar os contratos, amostras e resultados antes de encerrar a 1D-B ou integrar à main. A futura 1D-C poderá consumir código, revisão e mapas em Monaco somente leitura e implementar navegação por origem. Não foi iniciada nesta entrega. Diagnóstico avançado, exportação geral, edição livre e sandbox de código de terceiros permanecem separados. Sem merge, tag ou release.
