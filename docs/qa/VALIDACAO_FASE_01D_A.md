# Validação da Fase 1D-A

Data: 27/10/2026, America/Sao_Paulo. Branch `codex/phase-01d-a-semantic-ir`, base `3a67177131f09bcef8725287fedd1b031cea0585`. Candidata à revisão com **GO COM RESSALVAS**, sem merge à main ou início da 1D-B.

Ambiente confirmado: Node v24.11.1, npm 11.6.2, rustc 1.99.0 e Cargo 1.99.0, Windows/MSVC. Sem instalação adicional de ferramentas.

## Testes efetivamente executados

| Suíte | Comando | Aprovados | Reprovados finais | Ignorados |
|---|---|---:|---:|---:|
| TypeScript/domínio/helper/IR | npm test | 68 | 0 | 0 |
| Persistência Rust | cargo test --manifest-path packages/native-persistence/Cargo.toml --lib --locked | 26 | 0 | 0 |
| Host Tauri | cargo test --manifest-path apps/studio/src-tauri/Cargo.toml --locked | 1 | 0 | 0 |
| E2E web | npm run test:e2e | 11 | 0 | 0 |
| UI e driver Rust/filesystem real | npm run test:native | 9 | 0 | 0 |
| Produção/CSP/exportador histórico | npm run test:production | 3 | 0 | 0 |
| **Total** | | **118** | **0** | **0** |

Não são somadas as repetições dos mesmos testes. Os 23 testes novos cobrem representação dos 11 nodes; portas e origens; eventos por componente, legado, desabilitado e null; variáveis/literais number/string/boolean; binding compartilhado; ramificações; expressão compartilhada; ordenação de operandos; leitura após escrita; congelamento/destacamento; determinismo; entradas ausentes; referências, tipos, ciclos, duplicatas e eventos inválidos; atribuição de erros de schema; migrações sem mutação; limites de nodes, variáveis, conexões, eventos, texto e tamanho documental; orçamento de avaliação; ingestão e rollback com trilha parcial.

Os resultados manuais em fixtures são conferidos contra o intérprete atual. Testes estruturais da IR e expectativas do intérprete **não comprovam equivalência de TypeScript**, pois não há gerador ou executor novo nesta subetapa.

## Verificações adicionais

- npm run typecheck e npm run lint: aprovados.
- Cargo check --locked e Cargo fmt --check: aprovados para persistência e host Tauri.
- npm run build: aprovado; npm run export:web: aprovado para o exportador histórico.
- npm run desktop:build: aprovado após liberação do executável em uso; release x64 em apps/studio/src-tauri/target/release/btrk-forge.exe e instalador NSIS BTRK Forge_0.0.1_x64-setup.exe (4,00 MiB). O instalador foi gerado, não instalado nesta execução.
- O executável recém-gerado foi aberto e observado pelo controle Windows: janela BTRK Forge — BTRK Studio, “Nenhum projeto aberto”, “Pronto · núcleo local”. Mantido aberto sem projeto. A interface continua identificando Fase 1C, coerentemente com a ausência de integração visual da IR. Esse smoke confirma abertura, não repete toda a demonstração funcional manual da 1C.
- npm run check:security: zero achados de padrões conhecidos de segredos/configuração estática de permissões; escopo limitado, não auditoria exaustiva.
- npm audit: zero vulnerabilidades reportadas; não substitui RustSec.
- Nenhuma dependência ou lockfile foi alterado. Nenhuma capacidade nativa, schema ou política de isolamento foi ampliada.

Avisos de chunks maiores que 500 kB e NO_COLOR/FORCE_COLOR continuam não bloqueantes. Não foram tratados como falhas nem como itens resolvidos nesta subetapa.

SHA-256 dos artefatos locais gerados: executável `803a8ded1ab7354f4b1b0300d321e718d1da0069206cf8b3161eb4d541cbf447`; NSIS `ceba6669a77907a3b63fdaeb81f3f9a6d03e1ecbc48e27a56044ffc7e4173453`. Não publicados como release.

## Tentativas e condições do ambiente

A primeira suíte Rust, dentro do sandbox, teve 5 aprovações e 21 falhas de operações reais de filesystem/ACL/junction, incluindo acesso negado/troca de arquivos. A repetição fora do sandbox passou 26/26. Nenhum código Rust foi alterado. O E2E restrito foi interrompido durante inicialização do servidor; a execução fora do sandbox passou 11/11. O npm audit restrito falhou por DNS; a consulta com rede passou. Logs dessas tentativas não são apresentados como aprovações.

O primeiro build Windows encontrou o executável bloqueado pelo Studio deixado aberto na validação anterior. Foi conferido visualmente “Nenhum projeto aberto” e o aplicativo foi fechado normalmente. Houve uma tentativa adicional antes de o fechamento concluir; ambas as falhas foram preservadas. O build foi repetido somente após confirmar ausência da janela/processo. Não foi encerrado projeto com alterações pendentes nem usado término forçado de processo.

Integração nativa automatizada usa navegador e driver Rust real. Não equivale a homologar instalação em máquina limpa ou repetir integralmente a demonstração manual da Fase 1C em WebView2. O pacote de IR é puro e não foi integrado à UI nesta fase.

## Evidências e preservação

Logs desta execução: `artifacts/phase01d-a-20261027/`. Incluem unit.log, typecheck.log, lint.log, build-web.log, export-web.log, rust-*-test/check/fmt.log, e2e.log, e2e-unrestricted.log, native.log, production.log, desktop-build*.log, security.log e npm-audit.json. Os relatórios JSON correntes permanecem em artifacts; cópias anteriores foram guardadas em previous-results. A revalidação anterior permanece em artifacts/continuity-20261027-7af38b57. Evidências e documentos históricos versionados não foram substituídos.

O [contrato](../BLUEPRINT_IR.md) e o [relatório](../phases/RELATORIO_FASE_01D_A.md) descrevem decisões, limites, interfaces e riscos. SHA de publicação deve ser conferido no histórico Git e na entrega final, evitando autorreferência de hash no próprio commit.

## Ressalvas abertas

Durabilidade física sob falha de energia; corrida externa residual sem CAS de kernel; RustSec pendente; instalação/desinstalação em máquina limpa; mensagem histórica WebView2 sem correção demonstrada. Nenhuma foi descrita como resolvida. Sem aceite de distribuição comercial, release, tag, merge ou avanço à 1D-B.
