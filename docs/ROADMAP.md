# Roadmap e plano de Fase 1

## Fase 0 — concluída e aprovada para evolução

Fundação modular, modelo próprio, interpreter, editor Rete, preview, exportação controlada web/Windows, QA, contratos e relatório. A revisão aprovou a prova de viabilidade com arquitetura **Go com ressalvas**. Ver [encerramento oficial](phases/ENCERRAMENTO_FASE_00.md). A Fase 1A foi posteriormente autorizada e implementada em branch própria.

## Fase 1A — concluída e homologada com GO COM RESSALVAS

Novo/Abrir/Salvar/Salvar como/Fechar projeto, workspace autorizado por seleção nativa, persistência Rust, backup/recuperação, conflito externo, indicador de alterações e proteção ao fechar. Formato e fixtures versionados; testes Rust reais, regressões e smoke WebView2. Homologação em duas máquinas Windows, com 55 testes aprovados no computador atual e persistência conferida após encerrar/reabrir o processo. [Relatório original](phases/RELATORIO_FASE_01A.md), [validação original](qa/VALIDACAO_FASE_01A.md) e [encerramento oficial](phases/ENCERRAMENTO_FASE_01A.md).

O responsável aprovou o encerramento e a integração à `main`, preservando a branch de desenvolvimento. Permanecem abertas: durabilidade física sob falha de energia, janela residual de corrida externa, auditoria RustSec, instalação em máquina limpa e mensagem WebView2 no encerramento. Matriz de filesystems/DPI e política de retenção de snapshots também exigem evolução. A decisão é GO COM RESSALVAS dentro das garantias documentadas, sem aceite de distribuição comercial.

## Fase 1B — concluída e aprovada com GO COM RESSALVAS

Após autorização específica, foram implementados Design, catálogo Text/Button/Input/Container, hierarquia, Inspector, operações transacionais e undo/redo, schema v2 e migração, Preview compartilhado e persistência Rust da árvore. O responsável aprovou o encerramento e a integração à main por fast-forward, preservando a branch codex/phase-01b-visual-designer. A revalidação repetiu 75 testes aprovados, sem falhas finais. Veja [encerramento oficial](phases/ENCERRAMENTO_FASE_01B.md), [relatório de implementação](phases/RELATORIO_FASE_01B.md), [QA](qa/VALIDACAO_FASE_01B.md) e [limites do catálogo](COMPONENTES_FASE_01B.md).

O aceite é restrito ao Visual Designer demonstrado. Continuam os limites de uma tela, Input sem binding de variáveis, quatro tipos de componentes, ausência de seleção múltipla, layout por containers, ausência de edição livre bidirecional código/Blueprint e de exportação generalizada de projetos visuais. As cinco ressalvas herdadas — energia, corrida externa residual, RustSec, máquina limpa e mensagem WebView2 — permanecem abertas, sem serem consideradas resolvidas pelo encerramento.

## Fase 1C — concluída e aprovada com GO COM RESSALVAS

Blueprint Engine entregue em `codex/phase-01c-blueprint-engine`, a partir da main aprovada. Catálogo funcional, portas tipadas, eventos por ID, binding string de Input, leitura/escrita de Text, histórico integrado, Worker com fila/limites e depuração inicial. Schema v3 migra v0/v1/v2; Forge Logic Demo montado visualmente e reaberto em processo Windows novo. [Relatório](phases/RELATORIO_FASE_01C.md), [QA](qa/VALIDACAO_FASE_01C.md), [contrato](BLUEPRINT_ENGINE.md) e [limitações atuais](LIMITACOES_FASE_01C.md). O responsável aprovou o encerramento e a integração à main por fast-forward, preservando a branch de desenvolvimento. A revalidação de encerramento repetiu 95 testes aprovados, zero falhas, sem alterações funcionais. Veja o [encerramento oficial](phases/ENCERRAMENTO_FASE_01C.md). As cinco ressalvas herdadas e todas as limitações funcionais registradas continuam abertas; builds Windows e janela desktop permanecem evidências históricas, sem repetição nesta operação. Não há aceite de distribuição comercial.

## Fase 1D-A — concluída e aprovada com GO COM RESSALVAS

O responsável aprovou a subetapa 1D-A no commit 75473dc907fecb47568540fe38f435a4fc22dd7b e autorizou seu encerramento e integração por fast-forward à main, preservando a branch de desenvolvimento. A IR v1 tipada, imutável e transitória cobre os 11 nodes, portas, eventos, bindings, fluxo, origens e diagnósticos; distingue documentos editáveis/executáveis, define interfaces futuras do runtime e inclui fixtures com resultados manuais independentes. O documento schema v3 continua sendo a fonte oficial. [Encerramento oficial](phases/ENCERRAMENTO_FASE_01D_A.md), [contrato](BLUEPRINT_IR.md), [relatório de candidatura](phases/RELATORIO_FASE_01D_A.md) e [QA anterior](qa/VALIDACAO_FASE_01D_A.md). A revalidação do encerramento repetiu 118 testes aprovados, zero falhas e zero ignorados, sem alterações funcionais. A homologação Windows anterior permanece histórica; não foi repetido smoke Tauri nesta operação. As cinco ressalvas herdadas permanecem abertas.

## Fase 1D-B — concluída e aprovada com GO COM RESSALVAS

O responsável aprovou o commit d838bad2f44bc554b26185eb2aafc4f5107d1116 e autorizou o encerramento e integração por fast-forward à main, preservando a branch de desenvolvimento. Gerador AST TypeScript v1 para os 11 nodes, runtime semântico básico, revisão SHA-256 e mapas UTF-16 foram homologados nos cenários executados. O código tem controle próprio, sem delegar ao interpretador; o harness realiza typecheck, compilação e execução reais. Fixtures independentes, oito seeds reproduzíveis e quatro mutações verificam os contratos. O encerramento repetiu 160 testes aprovados, zero falhas e zero ignorados, sem alterações funcionais. [Encerramento oficial](phases/ENCERRAMENTO_FASE_01D_B.md), [contrato](CODEGEN_TYPESCRIPT.md), [relatório de candidatura](phases/RELATORIO_FASE_01D_B.md) e [QA anterior](qa/VALIDACAO_FASE_01D_B.md). Build Windows e smoke anteriores permanecem históricos; não foram repetidos nesta operação. Cinco ressalvas herdadas e limites do harness, corpus, runtime companheiro e configuração CommonJS continuam abertos. O harness não é sandbox de SO; código gerado ainda não integra Studio/Monaco.

## Fase 1D-C — concluída e aprovada com GO COM RESSALVAS

O responsável aprovou o commit `4cc38c5231ee0aedeb052b4bdb75ebe1d0a31e4e` e autorizou o encerramento documental e integração por fast-forward à main, preservando a branch `codex/phase-01d-c-monaco-integration`. Monaco TypeScript somente leitura, JSON preservado, geração real em Worker, revisões e navegação node ↔ trechos/canvas foram aceitos no escopo demonstrado. O encerramento repetiu 183 testes aprovados, zero falhas finais e zero ignorados, sem alteração funcional. [Encerramento oficial](phases/ENCERRAMENTO_FASE_01D_C.md), [relatório de implementação](phases/RELATORIO_FASE_01D_C.md), [QA histórico](qa/VALIDACAO_FASE_01D_C.md) e [contrato](MONACO_CODE_INTEGRATION.md). Evidências Windows reais parciais e Demo automatizado UI/Rust permanecem separados. Homologação manual integral e as cinco ressalvas herdadas continuam abertas. Não há aceite de distribuição comercial. A 1D-D foi posteriormente autorizada e implementada; Preview continua declarativo, sem edição bidirecional ou exportação geral.

## Fase 1D-D — concluída e aprovada com GO COM RESSALVAS, em escopo restrito

O responsável aprovou o commit `2d851682c0c24bd48eac33ba3dc77b79b340b50d` e autorizou o encerramento exclusivamente documental e a integração por fast-forward à main, preservando a branch `codex/phase-01d-d-debugging-validation`. Histórico transitório, inspeção de estado, sequência real, ramos, ações/rollback e navegação de diagnóstico foram aceitos no escopo demonstrado. O encerramento repetiu 204 testes aprovados, zero falhas e zero ignorados, sem alteração funcional. [Encerramento oficial restrito](phases/ENCERRAMENTO_FASE_01D_D.md), [contrato](RUNTIME_DEBUGGING.md), [relatório de implementação](phases/RELATORIO_FASE_01D_D.md) e [QA histórico com lacuna Windows](qa/VALIDACAO_FASE_01D_D.md). As cinco ressalvas herdadas e todas as limitações registradas permanecem abertas. Não há aceite comercial nem autorização de outra fase.

| Subetapa | Estado após integração |
|---|---|
| 1D-A | Concluída e integrada |
| 1D-B | Concluída e integrada |
| 1D-C | Concluída e integrada, com homologação manual restante |
| 1D-D | Concluída e integrada, com homologação manual restante |

## Fase 1D — encerrada em escopo restrito com GO COM RESSALVAS

O responsável autorizou o [encerramento geral restrito](phases/ENCERRAMENTO_FASE_01D.md) em modo econômico, sem alterações funcionais ou repetição dos 204 testes anteriormente aprovados. IR, codegen/equivalência testada, Monaco/navegação e depuração ficam consolidados. **Homologação Windows integral permanece pendência obrigatória**, separada da evidência UI/Rust. As cinco ressalvas históricas e os limites de sandbox, exportação, edição bidirecional e escala continuam abertos. Não há autorização comercial nem início de outra fase. A validação futura dedicada deverá identificar e verificar visualmente o Forge Debug Demo completo na janela Tauri real, incluindo código, navegação, depuração, ramos/onChange, rollback, persistência, IDs/conexões/binding e reabertura. Confirmações de diálogo, UI automatizada e driver Rust não substituem essa observação. Nenhuma outra fase começou.

## Fase 1 proposta — primeira fatia funcional

Ordem por dependência, sem estimativas artificiais de prazo. Cada etapa deve gerar demonstração, testes e decisão de aceite.

1. **Revisão e contrato do formato — entregue no escopo 1A.** Schema v1, fixtures históricas, IDs/referências e migração conhecida foram implementados e testados. Formatos futuros são recusados; a compatibilidade permanece limitada aos contratos documentados.
2. **Persistência nativa confiável — entregue no escopo 1A, com ressalvas.** Broker Rust limitado ao workspace selecionado, escrita por temporário/troca no mesmo volume, backup validado, recuperação explícita e conflitos externos. Foram exercitados Unicode, traversal, junctions, hard links, ACL e falhas de gravação injetadas. Durabilidade física, disco cheio real, matriz de filesystems e seleção cronológica de snapshots não são garantias homologadas; não há transação única de manifesto e backup nem CAS de kernel. SQLite não foi necessário nesta subfase.
3. **Editor de tela e Blueprint utilizável — primeira fatia entregue na Fase 1B.** Text/Button/Input/Container, árvore, propriedades, seleção, operações e histórico são funcionais; editor completo de Blueprint, acessibilidade avançada e demais itens continuam futuros. Escopo original de evolução: Catálogo mínimo (texto, botão, campo, container), árvore, propriedades, seleção de nodes, adição dos tipos suportados, remoção, desfazer/refazer, erros localizados, sockets visuais por tipo e acessibilidade. Aceite: construir exemplo sem editar JSON; salvar/reabrir posições/conexões; nenhum botão fictício.
4. **Semântica e correspondência com código.** Definir estado/eventos/funções; gerar TypeScript legível com mapa node↔trecho. Código gerado será inicialmente leitura/áreas controladas. Definir antes qualquer edição livre e round trip, com rejeição explícita de código sem representação. Aceite: testes equivalentes no interpretador e no aplicativo exportado, ramos e erros mapeados.
5. **Execução/build com isolamento.** Broker de tarefas allowlisted, diretório de trabalho temporário, versão de ferramentas fixada, Job Objects, cancelamento e coleta de logs limitada. Rede/arquivos por concessão explícita. Testar subprocessos órfãos, excesso de saída, timeouts e acesso negado. Aceite: nenhum projeto ou plugin pode escolher executável/argumentos de shell arbitrários.
6. **Exportação de projetos reais.** Generalizar o exportador além do exemplo, manifestos de plataforma, assets locais sanitizados, build reproduzível e pacote Windows independente. Testar web em Chromium/Edge e Windows em VM limpa com/sem WebView2, DPI 100/125/150%, caminhos longos e usuário sem admin. Aceite: app funciona com Studio fechado e sem dev server.
7. **Qualidade e distribuição interna.** CI Windows com typecheck/lint/unit/integration/e2e/Rust/build, revisão de segredos, npm e RustSec/SBOM, artefatos com SHA-256, teste de instalação/desinstalação e recuperação. Definir licença e assinatura antes da distribuição comercial. Aceite: gates verdes em máquina limpa; pacote e relatório rastreáveis por commit.

IA/atualizações podem receber implementações somente depois dessas bases: armazenamento seguro de credenciais, diff/aprovação/rollback e feeds assinados independentes. Marketplace, nuvem e suporte macOS/Linux permanecem etapas futuras.

## Riscos que bloqueiam a liberação funcional

- Processo separado não basta para executar código de terceiros: sandbox de SO e testes adversariais são obrigatórios.
- A persistência nativa da Fase 1A substitui o rascunho localStorage no Studio Windows; durabilidade física, corrida externa residual e política de recuperação continuam condicionando suas garantias. O laboratório web mantém o rascunho local.
- Instalação em máquina limpa e pacote assinado ainda não verificados.
- Regras para edição de código livre e representação visual precisam ser aprovadas antes de prometer round trip.
- Escala de grafo, consumo, acessibilidade e versões mínimas suportadas de Windows/WebView2 ainda precisam de matriz formal.

## Roadmap até a v1.0 — proposta consolidada para aprovação

A sequência recomendada é **1E → 1F → 1G → 1H**, com CI e validação de distribuição iniciados em paralelo quando houver artefatos verificáveis. A ordem coloca o isolamento antes da exportação e permite testar a primeira cadeia de ponta a ponta com o catálogo existente. Se o piloto da 1F revelar uma lacuna indispensável de modelagem, antecipar apenas esse requisito da 1G mediante aprovação. O [registro Windows da retomada](qa/HOMOLOGACAO_WINDOWS_01D_RETOMADA.md) mantém a homologação integral da 1D aberta.

| Etapa | Escopo e dependências | Evidência para aceite |
|---|---|---|
| **1E — Infraestrutura Segura de Build** | Broker Windows, tarefas fixas, ambiente descartável, isolamento, quotas, cancelamento e logs no Studio. [Plano técnico](phases/PLANO_FASE_01E.md). | Testes adversariais do runner e demonstração controlada na janela real. |
| **1F — Exportação de Aplicativos** | Após 1E, generalizar o exportador experimental para documentos visuais válidos. Empacotar UI, runtime versionado, assets locais validados e dependências fixadas. Publicar saída web estática e instalador Windows independente. | Dois projetos criados no Designer, com eventos, bindings e ramos, exportados nos dois destinos. Comparar comportamento com o Preview, testar caminhos Unicode e executar com Studio fechado e sem servidor de desenvolvimento. |
| **1G — Evolução do Designer e Blueprint** | Usar os resultados da 1F para priorizar catálogo, propriedades, estilos, múltiplas telas, responsividade, novos nodes, comportamentos reutilizáveis e organização do grafo. Preservar a experiência inspirada nos Blueprints da Unreal Engine. | Montar, salvar, reabrir e exportar um projeto representativo sem edição manual de JSON. Cobrir migração e validar regressões semânticas de cada node novo. |
| **1H — Qualidade e Distribuição** | CI Windows, RustSec e SBOM, assinatura, cadeia de distribuição, matriz WebView2/DPI/acessibilidade, instalação limpa e recuperação. Convergência dos gates de 1E–1G. | Pipeline rastreável por SHA, pacotes assinados e verificados, resultados publicados por ambiente e incidentes de segurança/recovery classificados antes do aceite. |

### Critérios preliminares de aceite da v1.0

- **Obrigatório.** Criar projeto → montar interface → criar Blueprint → visualizar TypeScript → executar e depurar → exportar → executar aplicativo independente. QA repete o fluxo em dois projetos autorados na interface, cobrindo click/change, binding, dois ramos, erro e rollback. Reabrir após novo processo com IDs e conexões preservados e histórico de depuração ausente. Conferir equivalência observável no navegador e no Windows.
- **Obrigatório.** Passar pelo CI com typecheck, lint, suítes TS/Rust, E2E, build e auditorias. Publicar matriz de Windows/WebView2 suportados e testar com usuário sem admin, WebView2 presente/ausente, DPI 100/125/150%, navegação por teclado e leitor de tela no fluxo principal. Validar instalação, execução e desinstalação em VM limpa. Verificar assinatura e SHA-256 do pacote.
- **Obrigatório.** Demonstrar limites e contenção do build, validar recuperação diante de interrupção e conflito externo e registrar garantias efetivamente medidas. Definir máquina de referência, tamanho de projeto suportado e orçamento de latência antes da homologação de escala. Exigir zero defeitos críticos ou altos abertos em segurança e no fluxo principal.
- **Desejável.** Mais componentes e layouts, múltiplas telas além do mínimo validado, reutilização avançada de comportamentos, melhorias de ergonomia e depuração.
- **Pós-1.0.** IA, marketplace, nuvem, colaboração, macOS/Linux e edição bidirecional irrestrita. Execução de código de terceiros depende de sandbox e homologação próprios.

Continuam abertas a durabilidade física sob falha de energia, corrida externa sem CAS, RustSec, instalação/desinstalação limpa, mensagem histórica WebView2, sandbox de terceiros, exportação generalizada, edição bidirecional e limites de escala, desempenho, DPI e acessibilidade. A classificação só muda com evidência específica. O plano não autoriza distribuição comercial ou início de implementação.

**1G-A concluída e integrada com GO COM RESSALVAS, em escopo restrito.** Inspector categorizado e paleta contextual com transação única foram aceitos. A homologação funcional Tauri permanece pendente. [Encerramento oficial](phases/ENCERRAMENTO_FASE_01G_A.md), [relatório](phases/RELATORIO_FASE_01G_A.md) e [validação](qa/VALIDACAO_FASE_01G_A.md).

**1G-B1 concluída e integrada com GO COM RESSALVAS, em escopo restrito.** Hierarquia, seleção múltipla e operações atômicas em lote foram aceitas. A homologação funcional Tauri permanece pendente e a Fase 1G-B continua em andamento. [Encerramento oficial](phases/ENCERRAMENTO_FASE_01G_B1.md), [relatório](phases/RELATORIO_FASE_01G_B1.md) e [validação](qa/VALIDACAO_FASE_01G_B1.md).

**1G-B2 concluída com GO COM RESSALVAS, em escopo restrito.** O aceite cobre dimensões individuais e em lote no schema v3 e viewport compartilhada entre Designer e Preview. A homologação Tauri permanece pendente e a 1G-B continua em andamento. [Encerramento oficial](phases/ENCERRAMENTO_FASE_01G_B2.md).

**1G-B3-A concluída em escopo restrito com GO COM RESSALVAS.** O aceite cobre a fundação persistente v4, migrações e compatibilidade semântica. A 1G-B3 continua em andamento. [Encerramento oficial](phases/ENCERRAMENTO_FASE_01G_B3_A.md).

**1G-B3-B suspensa por dependência de laboratório, em NO-GO para integração e publicação.** A importação permanece desabilitada. [Checkpoint experimental](https://github.com/patrickbotarick/BTRK-Forge/blob/0f5826b1b855726ad9498d94fb917494113f24d4/docs/phases/CHECKPOINT_FASE_01G_B3_B.md).

**1G-B3-C1 concluída em escopo restrito com GO COM RESSALVAS.** Panel é um preset visual que cria Container no schema v4. A homologação funcional Tauri permanece pendente. A 1G-B3-C segue aberta e a 1G-B3-C2 não foi iniciada. [Encerramento oficial](phases/ENCERRAMENTO_FASE_01G_B3_C1.md).

**1G-UX-P em revisão.** Proposta documental para workspace modular e evolução incremental do Designer e Blueprint. [Plano 1G-UX](phases/PLANO_FASE_01G_UX.md).

**1G-UX-A concluída em escopo restrito com GO COM RESSALVAS.** Workspace redimensionável e recolhível no Designer e no console. A homologação Tauri completa segue pendente. A 1G-UX permanece aberta e a UX-B segue sem início. [Encerramento oficial](phases/ENCERRAMENTO_FASE_01G_UX_A.md).

**1G-UX-B1 em revisão.** Registro tipado de painéis e preferências locais por modo, com recuperação pelo menu Exibir. Docking e movimentação livre permanecem fora da entrega. [Relatório](phases/RELATORIO_FASE_01G_UX_B1.md).
