# BTRK Forge

**BTRK Studio · Da ideia ao aplicativo.**

Studio de desenvolvimento visual híbrido para web e Windows. Produto em desenvolvimento, com Fase 0 concluída e aprovada como prova de viabilidade. Interface em português brasileiro, projetos locais e funcionamento essencial sem IA.

Tecnologias em avaliação: Tauri 2/Rust, React/TypeScript, Rete.js 2, Monaco, Vite e persistência estruturada versionada. Nenhuma licença de distribuição foi definida.

Fase 0 concluída e aprovada para evolução; a **Fase 1A está concluída e homologada tecnicamente com GO COM RESSALVAS**, com projetos locais e persistência nativa Rust. O [encerramento oficial da Fase 1A](docs/phases/ENCERRAMENTO_FASE_01A.md) registra a aprovação e os limites das duas máquinas Windows. Não é uma IDE completa. O [encerramento da Fase 0](docs/phases/ENCERRAMENTO_FASE_00.md) permanece preservado; a Fase 1B foi posteriormente autorizada para implementação em branch própria.

A **Fase 1B está concluída e aprovada com GO COM RESSALVAS**, com modo Design, Text/Button/Input/Container, hierarquia, Inspector e undo/redo. O [encerramento oficial](docs/phases/ENCERRAMENTO_FASE_01B.md) registra o aceite limitado ao Visual Designer e às garantias demonstradas. Veja também o [relatório de implementação](docs/phases/RELATORIO_FASE_01B.md), a [validação](docs/qa/VALIDACAO_FASE_01B.md) e a [matriz suportada](docs/COMPONENTES_FASE_01B.md). A **Fase 1C está oficialmente concluída e aprovada com GO COM RESSALVAS**, com catálogo de Blueprints, eventos por componente, Input/binding string, ações de Text e depuração inicial. O [encerramento oficial](docs/phases/ENCERRAMENTO_FASE_01C.md) registra a aprovação, a revalidação de 95 testes e a integração autorizada à main. Veja o [relatório](docs/phases/RELATORIO_FASE_01C.md), a [validação](docs/qa/VALIDACAO_FASE_01C.md) e o [contrato do motor](docs/BLUEPRINT_ENGINE.md). A Fase 1D está autorizada somente para planejamento e não foi iniciada.

No Studio Windows, use **Novo projeto** para informar nome e escolher uma pasta; **Abrir projeto** seleciona `project.btrk.json`. Salvar, Salvar como, Fechar projeto, aviso de alterações pendentes e recuperação de backup estão operacionais. O principal e o backup são validados no backend; conflitos preservam o conteúdo em memória e oferecem recarga/cópia/cancelamento. Entre em **Design**, selecione um Container ou a tela e adicione componentes pelo catálogo; organize pela árvore e edite no Inspector. Salve explicitamente. Veja [garantias e limites Windows](docs/ARQUITETURA_V0_2.md) e o [formato v3](docs/FORMATO_PROJETO_V3.md). Projetos v0/v1/v2 migram em memória, sem gravação automática.

## Executar

Ambientes verificados: Node 24.11.1/npm 11.6.2 e Node 24.16.0/npm 12.0.2. Para Windows: Rust/Cargo 1.99.0 ou 1.99.1 MSVC, Visual Studio C++ Build Tools e WebView2; a homologação no segundo computador usou MSVC v143 e Windows SDK 26100. Essas são versões exercitadas, não uma matriz exaustiva de versões mínimas. Dependências do projeto são locais; as ferramentas nativas são pré-requisitos de sistema.

```powershell
npm ci
npm run dev              # interface local em http://127.0.0.1:1420
npm run desktop:dev      # aplicativo Tauri de desenvolvimento
```

Na interface: crie constantes, arraste nodes, conecte sockets, altere propriedades, execute o evento e use os viewports. Monaco permite editar o modelo com validação ao aplicar. No desktop, salvamentos são explícitos no workspace autorizado; não há autosave nativo em localStorage. No navegador, o laboratório da Fase 0 mantém importação/exportação JSON e rascunho local, sem acesso nativo a pastas. Para desenvolver offline, prepare npm/Cargo e o navegador de teste previamente. Nenhum provedor de IA é necessário.

## Validar e exportar

```powershell
npm run audit:environment
npm run typecheck
npm run lint
npm test
npm run test:persistence # persistência, componentes e schema v3 em filesystem real (Windows)
npx playwright install chromium
npm run test:e2e
npm run test:native      # UI com biblioteca Rust real; seletores substituídos por destinos de teste
npm run build
npm run export:web
npm run test:production  # servidor estático sem Vite e CSP de produção
npm run check:security
npm audit
cargo test --manifest-path apps/studio/src-tauri/Cargo.toml --locked
cargo fmt --manifest-path apps/studio/src-tauri/Cargo.toml -- --check
npm run desktop:build
npm run export:windows
```

`desktop:dev` inicia Vite automaticamente; não precisa iniciar outro servidor na mesma porta. `test:persistence` executa os testes da biblioteca Rust; o host Tauri tem um teste adicional de rejeição de sessão inválida. O núcleo visual continua coberto por Vitest. `test:native` compila um driver de testes separado, que não é distribuído com o Studio, e usa Vite na porta 1422. Ao alterar o renderizador compartilhado, execute `npm run renderer:generate`; ao alterar o script fixo do iframe, execute `npm run sync:csp` e repita os testes de produção. Mudanças de contrato exigem `npm run schema:generate` e testes de compatibilidade.

Saídas locais (ignoradas pelo Git):

- `dist/studio`: frontend de produção.
- `dist/export-web`: aplicativo controlado exportado, pronto para hospedagem estática.
- `apps/studio/src-tauri/target/release/btrk-forge.exe`: Studio independente.
- `apps/studio/src-tauri/target/release/bundle/nsis/`: instalador do Studio.
- `tools/feasibility/windows/target/release/btrk-counter.exe`: aplicativo Windows exportado.
- `tools/feasibility/windows/target/release/bundle/nsis/`: instalador do aplicativo.
- `artifacts/`: resultados JSON, imagens e inventário do ambiente.

Os instaladores são provas locais sem assinatura comercial. Não foram publicados como releases nem testados em máquina limpa. Exportação é do exemplo controlado, sem exportador geral ou shell arbitrário.

## Estrutura

```text
apps/studio/                  React, Rete, Monaco e host Tauri
packages/project-schema/      schema e migração
packages/blueprint-core/      portas, validação e execução
packages/forge-core/          exemplo e contratos IA/SDK/atualizações
packages/native-persistence/ Rust: validação, sessão autorizada, escrita e recuperação
packages/designer-core/       comandos, hierarquia e histórico de edição
packages/preview-runtime/     documento isolado e Worker
tools/feasibility/            auditoria, helper, exportação e host do app
tests/                       domínio, integração, navegador e produção
docs/architecture/           segurança e contratos
docs/phases/                 relatório de engenharia
docs/qa/                     validação e evidências
```

Módulos compartilham o lockfile npm da raiz; não são pacotes publicados. Nenhum pacote vazio foi criado.

## Documentação e próximos passos

- [Briefing oficial](docs/BRIEFING_OFICIAL.md)
- [Arquitetura v0.1](docs/ARQUITETURA_V0_1.md)
- [Arquitetura v0.2 — persistência nativa](docs/ARQUITETURA_V0_2.md)
- [Formato v1 histórico](docs/FORMATO_PROJETO_V1.md) e [formato v2 / migração](docs/FORMATO_PROJETO_V2.md)
- [Arquitetura v0.3 — Visual Designer](docs/ARQUITETURA_V0_3.md)
- [Componentes e operações disponíveis](docs/COMPONENTES_FASE_01B.md)
- [Decisões e comparação Tauri/Electron](docs/DECISOES_TECNICAS.md)
- [Relatório da Fase 0](docs/phases/RELATORIO_FASE_00.md)
- [Validação e limitações](docs/qa/VALIDACAO_FASE_00.md)
- [Relatório da Fase 1A](docs/phases/RELATORIO_FASE_01A.md)
- [Validação da Fase 1A](docs/qa/VALIDACAO_FASE_01A.md)
- [Encerramento oficial e homologação nas duas máquinas — Fase 1A](docs/phases/ENCERRAMENTO_FASE_01A.md)
- [Encerramento oficial e limites aprovados — Fase 1B](docs/phases/ENCERRAMENTO_FASE_01B.md)
- [Encerramento oficial e limites aprovados — Fase 1C](docs/phases/ENCERRAMENTO_FASE_01C.md)
- [Roadmap / plano detalhado de Fase 1](docs/ROADMAP.md)

A persistência da Fase 1A solicita sincronização e troca de arquivos no mesmo volume, mantendo backup válido e tratando resultados incertos. Permanecem abertas a durabilidade física sob falha de energia, a janela residual de corrida externa, a auditoria RustSec, a instalação em máquina limpa e a mensagem WebView2 observada no encerramento. O Visual Designer permanece limitado a uma tela, quatro componentes, binding de Input restrito a string, sem seleção múltipla, layout por containers, sem edição livre bidirecional código/Blueprint e sem exportação generalizada. Sandbox de código arbitrário, assinatura e atualizações também continuam pendentes. IA, plugins e atualizações permanecem desabilitados. O encerramento da Fase 1C consolida o Blueprint Engine na `main` e preserva as branches de desenvolvimento das Fases 1A, 1B e 1C, sem release ou tag de produto. Marca e licença comercial ainda dependem de definição jurídica.

Na Fase 1C, selecione Button/Input no Design e use **Abrir comportamento no Blueprint**. Crie nodes pelo catálogo, configure referências por ID e conecte portas tipadas. A criação de variáveis e o binding estão nos Inspectors. Use Preview para eventos reais, console para trilha e Reiniciar estado para voltar aos valores iniciais. O estado digitado não é salvo como definição. [Arquitetura v0.4](docs/ARQUITETURA_V0_4.md), [schema v3](docs/FORMATO_PROJETO_V3.md) e [matriz de limites atuais](docs/LIMITACOES_FASE_01C.md). TypeScript derivado e exportação visual geral permanecem futuros.
