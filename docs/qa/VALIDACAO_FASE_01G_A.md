# Validação — Fase 1G-A

## Regressão automatizada

| Execução | Aprovados | Reprovados | Ignorados |
|---|---:|---:|---:|
| TypeScript, execução anterior | 137 | 0 | 0 |
| Rust persistência, execução anterior | 26 | 0 | 0 |
| UI com driver Rust, execução anterior | 12 | 0 | 0 |
| Produção Chromium, execução anterior | 5 | 0 | 0 |
| E2E web completo, finalização | 28 | 0 | 0 |

Typecheck, lint, build web e scanner estático foram aprovados na execução anterior. O Vite registrou aviso de tamanho de chunks. A regressão web completa usa o Chromium com servidor local em porta separada. Casos focados já incluídos na suíte completa são contados uma vez. A falha de Worker injetada pelo teste de recuperação é parte do cenário esperado. A finalização preservou a implementação existente.

A regressão cobre Inspector e persistência de propriedades, pesquisa contextual, gesto Rete, incompatibilidade, Escape e foco, undo/redo, navegação Código e Debug, Preview, troca de projeto e reabertura por driver Rust. O teste de domínio recusa tipo incorreto e porta ocupada sem alteração parcial.

- [Inspector no Chromium](evidencias/fase01g-a/inspector-web.png)
- [Paleta no Chromium](evidencias/fase01g-a/paleta-web.png)

## Janela Tauri real

Uma janela do executável apps/studio/src-tauri/target/release/btrk-forge.exe foi iniciada e observada na origem tauri.localhost. O seletor nativo foi aberto. A seleção manual foi solicitada para a cópia sintética artifacts/phase01g-a/tauri-qa/project.btrk.json, nome Paleta v3, 9 nodes e 9 conexões, SHA-256 1D631D557E03CD3F4DD47856175613961A3297F42877BBDF39C6FB9EAEA15E6C.

Após a seleção assistida, a janela exibiu um projeto salvo com 8 nodes e 8 conexões. O caminho efetivamente selecionado ficou sem confirmação. O projeto pretendido ficou sem confirmação visual. A janela foi deixada sem edição, e Inspector, paleta, undo/redo, salvamento, reabertura, Código e Depuração ficaram pendentes no Tauri real. As evidências Chromium e UI/Rust são independentes desta tentativa.
