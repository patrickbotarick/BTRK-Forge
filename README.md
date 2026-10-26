# BTRK Forge

**BTRK Studio · Da ideia ao aplicativo.**

Studio de desenvolvimento visual híbrido para web e Windows. Produto em desenvolvimento, com Fase 0 concluída e aprovada como prova de viabilidade. Interface em português brasileiro, projetos locais e funcionamento essencial sem IA.

Tecnologias em avaliação: Tauri 2/Rust, React/TypeScript, Rete.js 2, Monaco, Vite e persistência estruturada versionada. Nenhuma licença de distribuição foi definida.

Fase 0 concluída e aprovada para evolução; a **Fase 1A está implementada e candidata à revisão**, com projetos locais e persistência nativa Rust. Arquitetura: **Go com ressalvas**. Não é uma IDE completa. O [encerramento da Fase 0](docs/phases/ENCERRAMENTO_FASE_00.md) permanece preservado; a Fase 1B não foi iniciada.

No Studio Windows, use **Novo projeto** para informar nome e escolher uma pasta; **Abrir projeto** seleciona `project.btrk.json`. Salvar, Salvar como, Fechar projeto, aviso de alterações pendentes e recuperação de backup estão operacionais. O principal e o backup são validados no backend; conflitos preservam o conteúdo em memória e oferecem recarga/cópia/cancelamento. Veja [garantias e limites Windows](docs/ARQUITETURA_V0_2.md) e o [formato oficial](docs/FORMATO_PROJETO_V1.md).

## Executar

Pré-requisitos verificados: Node 24.11.1/npm 11.6.2. Para Windows: Rust/Cargo 1.99.0 MSVC, Visual Studio C++ Build Tools e WebView2. Dependências são locais, sem instalação global necessária.

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
npm run test:persistence # 19 casos Rust reais de persistência (Windows)
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

`desktop:dev` inicia Vite automaticamente; não precisa iniciar outro servidor na mesma porta. `test:persistence` executa os testes da biblioteca Rust; o host Tauri tem um teste adicional de rejeição de sessão inválida. O núcleo visual continua coberto por Vitest. `test:native` compila um driver de testes separado, que não é distribuído com o Studio, e usa Vite na porta 1422. Ao alterar o script fixo do iframe, execute `npm run sync:csp` e repita os testes de produção. Mudanças de contrato exigem `npm run schema:generate` e testes de compatibilidade.

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
- [Formato de projeto v1](docs/FORMATO_PROJETO_V1.md)
- [Decisões e comparação Tauri/Electron](docs/DECISOES_TECNICAS.md)
- [Relatório da Fase 0](docs/phases/RELATORIO_FASE_00.md)
- [Validação e limitações](docs/qa/VALIDACAO_FASE_00.md)
- [Relatório da Fase 1A](docs/phases/RELATORIO_FASE_01A.md)
- [Validação da Fase 1A](docs/qa/VALIDACAO_FASE_01A.md)
- [Roadmap / plano detalhado de Fase 1](docs/ROADMAP.md)

A persistência da Fase 1A solicita sincronização e troca de arquivos no mesmo volume, mantendo backup válido e tratando resultados incertos. Não é uma garantia contra queda de energia, todos os filesystems ou qualquer corrida com editor externo. Continuam pendentes sandbox de código arbitrário, exportação generalizada, máquina limpa, assinatura, atualizações e auditorias adicionais. IA, plugins e atualizações permanecem desabilitados. A Fase 1A fica na branch `codex/phase-01a-project-persistence`, sem merge na `main`, release ou tag de produto. Marca e licença comercial ainda dependem de definição jurídica.
