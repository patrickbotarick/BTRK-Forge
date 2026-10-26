# BTRK Forge

**BTRK Studio · Da ideia ao aplicativo.**

Studio de desenvolvimento visual híbrido para web e Windows. Produto em desenvolvimento, com Fase 0 concluída e aprovada como prova de viabilidade. Interface em português brasileiro, projetos locais e funcionamento essencial sem IA.

Tecnologias em avaliação: Tauri 2/Rust, React/TypeScript, Rete.js 2, Monaco, Vite e persistência estruturada versionada. Nenhuma licença de distribuição foi definida.

Fase 0 concluída e aprovada para evolução: modelo próprio versionado, Blueprint Core, editor Rete, preview isolado e exportação controlada web/Windows. Arquitetura: **Go com ressalvas**. Não é uma IDE completa; a Fase 1 não foi iniciada. O [registro de encerramento](docs/phases/ENCERRAMENTO_FASE_00.md) preserva os resultados e as pendências.

## Executar

Pré-requisitos verificados: Node 24.11.1/npm 11.6.2. Para Windows: Rust/Cargo 1.99.0 MSVC, Visual Studio C++ Build Tools e WebView2. Dependências são locais, sem instalação global necessária.

```powershell
npm ci
npm run dev              # interface local em http://127.0.0.1:1420
npm run desktop:dev      # aplicativo Tauri de desenvolvimento
```

Na interface: crie constantes, arraste nodes, conecte sockets, altere propriedades, execute o evento, use os viewports e salve/abra JSON. Monaco permite editar o modelo com validação ao aplicar. A recuperação automática usa rascunho local; salve JSON como backup. Para desenvolver offline, prepare npm/Cargo e o navegador de teste previamente. Nenhum provedor de IA é necessário.

## Validar e exportar

```powershell
npm run audit:environment
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
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

`desktop:dev` inicia Vite automaticamente; não precisa iniciar outro servidor na mesma porta. Rust sem testes de domínio nesta PoC: `cargo test` comprova compilação do host, e o domínio é testado com Vitest. Ao alterar o script fixo do iframe, execute `npm run sync:csp` e repita os testes de produção.

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
- [Decisões e comparação Tauri/Electron](docs/DECISOES_TECNICAS.md)
- [Relatório da Fase 0](docs/phases/RELATORIO_FASE_00.md)
- [Validação e limitações](docs/qa/VALIDACAO_FASE_00.md)
- [Roadmap / plano detalhado de Fase 1](docs/ROADMAP.md)

A Fase 1 proposta prioriza persistência atômica, editor mínimo utilizável, sandbox de build e exportação de projetos reais. IA, plugins e atualizações permanecem desabilitados. A integração da Fase 0 à `main` foi autorizada após revisão; a branch de desenvolvimento foi preservada. Nenhuma release ou tag de produto foi criada. Marca e licença comercial ainda dependem de definição jurídica.
