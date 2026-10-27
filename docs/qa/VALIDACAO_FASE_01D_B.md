# Validação da Fase 1D-B

Data: 27/10/2026, America/Sao_Paulo. Branch codex/phase-01d-b-typescript-codegen; base main aprovada e56e716ea639ceb7c1bfdc2014c21cc476e9734c. Candidata à revisão com **GO COM RESSALVAS**, sem encerramento oficial, merge ou início da 1D-C.

Ambiente confirmado: Node v24.11.1, npm 11.6.2, rustc/Cargo 1.99.0, Windows/MSVC, TypeScript 6.0.3 já instalado pelo lockfile existente. Não houve instalação adicional.

## Casos realmente executados

| Suíte | Comando | Aprovados | Reprovados finais | Ignorados |
|---|---|---:|---:|---:|
| TypeScript/domínio/helper/IR/gerador/diferenciais | npm test | 107 | 0 | 0 |
| Persistência Rust | cargo test --manifest-path packages/native-persistence/Cargo.toml --lib --locked | 26 | 0 | 0 |
| Host Rust | cargo test --manifest-path apps/studio/src-tauri/Cargo.toml --locked | 1 | 0 | 0 |
| E2E web e coordenação | npm run test:e2e | 14 | 0 | 0 |
| UI e driver Rust/filesystem real | npm run test:native | 9 | 0 | 0 |
| Produção/CSP/exportador histórico | npm run test:production | 3 | 0 | 0 |
| **Total** | | **160** | **0** | **0** |

Os 42 casos novos são 39 TypeScript (11 gerador/mapas, 25 diferenciais/oráculos/mutações, 3 primitivas) e 3 E2E de coordenação. Não se somam repetições, assertions, programas compilados, eventos ou builds à quantidade de testes.

Os testes diferenciais executam lowering, gerador AST, typecheck real com ts.createProgram/getPreEmitDiagnostics, emit com noEmitOnError e programa JavaScript compilado em processo Node. A dependência do Blueprint Core é recusada no programa compilado. Sequências compartilham módulo e estado gerado dentro do cenário. Comparações integrais sem normalização abrangem estados, resultados, mensagens/origem, trilha/ordem/valores e rollback. Expectativas independentes da 1D-A e novas expectativas de limites/estado são mantidas.

Cobertura: 11 nodes; constantes number/string/boolean; dois ramos; reavaliação compartilhada; leitura após escrita; Text transitório; múltiplos Inputs/binding/set; eventos sucessivos/legado/nulos/desabilitados; Unicode/escapes/conteúdo semelhante a código; vazio/espaços; 1000/1001 caracteres; overflow; zero negativo; estados/eventos inválidos; IR/documento incompleto; orçamento; rollback após várias ações e ingestão; reset e sessões. A fila cheia, estado encadeado e respostas antigas são exercitados na coordenação real via Worker fixo de teste, sem trocar o executor do produto pelo código gerado. O teste existente cobre interrupção/timeout sem igualdade exata de tempo.

Corpus reproduzível: 8 seeds, 3 eventos cada. Seeds: 1, 2, 42, 4096, 65535, 1793047, 3735928559, 4294967295. Failure.json registra seed e cenário se ocorrer divergência. Mutações controladas detectadas: subtração, remoção de escrita, ramo no forçado e remoção de visita. Erro de tipo deliberado é recusado; não se executa emissão com diagnóstico de erro.

## Outras verificações executadas

- npm run typecheck e npm run lint: aprovados.
- Cargo check --locked e fmt --check para persistência e host: aprovados.
- npm run build e npm run export:web: aprovados. Exportação continua sendo a histórica.
- npm run desktop:build: aprovado, executável x64 e instalador NSIS de 3,99 MiB gerados em artifacts/phase01d-b-20261027/windows-target/release, usando CARGO_TARGET_DIR isolado. Não foi instalado ou publicado como release.
- Scanner estático de padrões conhecidos de segredos/permissões: zero achados; escopo limitado, não auditoria exaustiva.
- npm audit: zero vulnerabilidades reportadas; não substitui RustSec.
- git fsck --full sem corrupção, apenas objetos dangling já observados; sem limpeza destrutiva.
- git diff --check e links locais da documentação conferidos. Sem mudança de dependência, lockfile, schema v3, IR v1 ou permissões.

SHA-256 Windows: executável `b296b302a364dbff3635484f33ec8ded15b893e105e648519adb1b14ebb50ef0`; NSIS `ca0388a417daa7f1d0984a8dc132db714ea374a29dd7bd5ac9da9e075bd46c4e`. A fonte gerada de evidência possui SHA-256 `b7f09060680d5447a520ce0d7b989fda01e503f759f2099a430a81fd89161e4d`.

O Studio previamente aberto foi preservado. Não foi repetido smoke manual da nova janela Tauri nem instalação em máquina limpa. Teste nativo automatizado significa UI em navegador e driver Rust/filesystem real; não comprova um novo smoke WebView2. As evidências anteriores continuam históricas.

## Preparação e resultados intermediários

Os 68 casos TypeScript existentes passaram antes da extração, após primitivas e após protocolo, com logs separados. Na implementação, o typecheck identificou narrowing de entry possivelmente ausente e tentativas de alterar cópias com tipo readonly nos testes negativos; esses pontos foram corrigidos. A primeira configuração CommonJS do harness encontrou TS5107 no TypeScript 6, bloqueando 25 casos diferenciais naquele ensaio; somente os 11 testes então executados passaram. Casos bloqueados não foram contados como aprovados. A configuração final usa ignoreDeprecations=6.0 apenas para o resolver legado, sem suprimir diagnósticos de tipos, e o teste negativo comprova essa recusa.

Não houve divergência semântica residual nos cenários finais. Os quatro mutantes foram divergências intencionais reconhecidas pela suíte. A execução sequencial no mesmo módulo foi acrescentada para não ocultar caches/globais indevidos; estados de referência e gerados são encadeados independentemente. Resultados não foram normalizados para produzir igualdade.

Avisos de chunks maiores que 500 kB e NO_COLOR/FORCE_COLOR continuam não bloqueantes. A configuração do resolver CommonJS do harness deve ser revisada antes da atualização para TypeScript 7.

O Git alertou que a amostra de fonte .txt poderia receber CRLF em outro checkout. Foi acrescentada regra específica *.generated.ts.txt eol=lf em .gitattributes e conferida uma cópia via checkout-index com core.autocrlf=true, mantendo o SHA-256. A regra preserva os offsets UTF-16 e o teste de reprodução da evidência; não altera código funcional.

## Evidências e limitações

Logs locais: artifacts/phase01d-b-20261027/{baseline-unit,post-extraction-unit,post-protocol-unit,codegen-initial,unit,typecheck,lint,build-web,export-web,rust-*,e2e,native,production,desktop-build,security,git-fsck}.log e npm-audit.json. Os relatórios anteriores foram copiados para previous-results; os correntes permanecem em artifacts. Programas/mapas emitidos, diagnósticos de typecheck e executáveis do harness ficam em harness/run-*. O erro de tipo deliberado também deixa seu diagnóstico ali, como evidência de teste negativo, não falha final.

Evidências versionadas: [programa gerado](evidencias/fase01d-b/read-after-write.generated.ts.txt), [origens](evidencias/fase01d-b/read-after-write.origins.json) e [resumo](evidencias/fase01d-b/verification.json). [Contrato](../CODEGEN_TYPESCRIPT.md) e [relatório](../phases/RELATORIO_FASE_01D_B.md) registram arquitetura e riscos. O SHA final da branch é confirmado na entrega, sem autorreferência no próprio commit.

O processo do harness herda permissões do usuário, não é sandbox de SO, e só admite projetos processados pelo gerador allowlisted e mutações de teste enumeradas. Limites de saída, tempo e heap não autorizam execução hostil. Corpus e mutações são limitados, não prova formal para todos os grafos. O mapa é node/trechos TypeScript, não Source Map v3 nem integração Monaco.

Permanecem abertas as cinco ressalvas herdadas: durabilidade física sob falha de energia; corrida externa residual sem CAS de kernel; RustSec; instalação/desinstalação limpa; mensagem histórica WebView2 sem correção demonstrada. Exportação geral, sandbox de código de terceiros e diagnóstico avançado continuam separados. Nenhum aceite comercial, merge, tag, release ou início da 1D-C.
