# Roadmap e plano de Fase 1

## Fase 0 — concluída e aprovada para evolução

Fundação modular, modelo próprio, interpreter, editor Rete, preview, exportação controlada web/Windows, QA, contratos e relatório. A revisão aprovou a prova de viabilidade com arquitetura **Go com ressalvas**. Ver [encerramento oficial](phases/ENCERRAMENTO_FASE_00.md). A Fase 1A foi posteriormente autorizada e implementada em branch própria.

## Fase 1A — implementada, candidata à revisão

Novo/Abrir/Salvar/Salvar como/Fechar projeto, workspace autorizado por seleção nativa, persistência Rust, backup/recuperação, conflito externo, indicador de alterações e proteção ao fechar. Formato e fixtures versionados; testes Rust reais, regressões e smoke WebView2. [Relatório](phases/RELATORIO_FASE_01A.md) e [validação](qa/VALIDACAO_FASE_01A.md).

Permanecem para revisão/evolução: limites de concorrência com escritores externos, durabilidade frente a falha física, matriz de filesystems/máquinas limpas, auditoria adicional e política de retenção de snapshots. A implementação não significa aprovação automática. A `main` permanece na entrega da Fase 0; a Fase 1B não foi iniciada.

## Fase 1 proposta — primeira fatia funcional

Ordem por dependência, sem estimativas artificiais de prazo. Cada etapa deve gerar demonstração, testes e decisão de aceite.

1. **Revisão e contrato do formato.** Aprovar escopo de uma aplicação local pequena; formalizar schema v1 público, fixtures históricas, IDs/referências e política de versões. Aceite: abrir, migrar e salvar projetos reais sem perda, rejeitar versão futura e preservar original em falha.
2. **Persistência nativa confiável.** Broker Rust limitado ao workspace selecionado, save atômico, backups, journal/recuperação e conflitos externos. Testar queda durante gravação, corrupção, disco cheio, nomes/caminhos Unicode, traversal e junctions. SQLite apenas se necessário para índice reconstruível. Aceite: recuperar última versão válida sem acesso fora do escopo.
3. **Editor de tela e Blueprint utilizável.** Catálogo mínimo (texto, botão, campo, container), árvore, propriedades, seleção de nodes, adição dos tipos suportados, remoção, desfazer/refazer, erros localizados, sockets visuais por tipo e acessibilidade. Aceite: construir exemplo sem editar JSON; salvar/reabrir posições/conexões; nenhum botão fictício.
4. **Semântica e correspondência com código.** Definir estado/eventos/funções; gerar TypeScript legível com mapa node↔trecho. Código gerado será inicialmente leitura/áreas controladas. Definir antes qualquer edição livre e round trip, com rejeição explícita de código sem representação. Aceite: testes equivalentes no interpretador e no aplicativo exportado, ramos e erros mapeados.
5. **Execução/build com isolamento.** Broker de tarefas allowlisted, diretório de trabalho temporário, versão de ferramentas fixada, Job Objects, cancelamento e coleta de logs limitada. Rede/arquivos por concessão explícita. Testar subprocessos órfãos, excesso de saída, timeouts e acesso negado. Aceite: nenhum projeto ou plugin pode escolher executável/argumentos de shell arbitrários.
6. **Exportação de projetos reais.** Generalizar o exportador além do exemplo, manifestos de plataforma, assets locais sanitizados, build reproduzível e pacote Windows independente. Testar web em Chromium/Edge e Windows em VM limpa com/sem WebView2, DPI 100/125/150%, caminhos longos e usuário sem admin. Aceite: app funciona com Studio fechado e sem dev server.
7. **Qualidade e distribuição interna.** CI Windows com typecheck/lint/unit/integration/e2e/Rust/build, revisão de segredos, npm e RustSec/SBOM, artefatos com SHA-256, teste de instalação/desinstalação e recuperação. Definir licença e assinatura antes da distribuição comercial. Aceite: gates verdes em máquina limpa; pacote e relatório rastreáveis por commit.

IA/atualizações podem receber implementações somente depois dessas bases: armazenamento seguro de credenciais, diff/aprovação/rollback e feeds assinados independentes. Marketplace, nuvem e suporte macOS/Linux permanecem etapas futuras.

## Riscos que bloqueiam a liberação funcional

- Processo separado não basta para executar código de terceiros: sandbox de SO e testes adversariais são obrigatórios.
- localStorage não é persistência de projeto profissional; escrita atômica e recuperação são gates.
- Instalação em máquina limpa e pacote assinado ainda não verificados.
- Regras para edição de código livre e representação visual precisam ser aprovadas antes de prometer round trip.
- Escala de grafo, consumo, acessibilidade e versões mínimas suportadas de Windows/WebView2 ainda precisam de matriz formal.
