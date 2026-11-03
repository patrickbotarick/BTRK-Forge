# Encerramento oficial da Fase 1G-UX-A — Workspace redimensionável

**GO COM RESSALVAS para encerramento restrito e integração à main.** O aceite cobre o commit 9bc7bc43d191e91ea600f09c5b5304eb168cad51. A 1G-UX permanece aberta e a UX-B segue sem início.

## Escopo aceito

WorkspaceShell e divisórias próprias em React/CSS permitem redimensionar e recolher Biblioteca e Hierarquia, Inspector e console. As regiões têm rolagem independente. As divisórias aceitam ponteiro e teclado, com cancelamento do arraste e restauração dos padrões. O console recolhido mantém o status visível e preserva o runtime. O canvas permanece na região central ao recolher as laterais, e as viewports fixas mantêm 375 e 768 px de largura lógica.

| Região | Padrão | Limites |
| --- | ---: | --- |
| Esquerda | 220 px | 160–420 px, conforme o espaço disponível |
| Direita | 270 px | 180–460 px, conforme o espaço disponível |
| Console | 158 px | 80–360 px, com máximo de 45% da altura disponível |

As dimensões são transitórias e separadas do manifesto, do estado de edição e do histórico do projeto. As laterais retornam ao padrão ao sair e voltar ao Designer. A persistência entre sessões pertence à UX-B.

## Evidências históricas

- **Regressão inicial.** 183 testes Vitest e 34 E2E Chromium aprovados. Typecheck, lint, build web e scanner estático aprovados.
- **Correção posterior.** O Tauri revelou deslocamento do canvas ao recolher a biblioteca. Após fixar as colunas da grade, a janela nativa confirmou a expansão correta do canvas. O E2E direcionado passou com novas asserções geométricas. A regressão de 217 testes corresponde à rodada inicial.
- **Encerramento.** Revisão documental, sem nova execução de suítes funcionais. [Relatório de implementação](RELATORIO_FASE_01G_UX_A.md) · [Validação](../qa/VALIDACAO_FASE_01G_UX_A.md)

## Ressalvas preservadas

- Homologação Tauri completa da UX-A, incluindo área cliente e DPI efetivos, janela mínima de 1000 × 700, escalas de 100%, 125% e 150%, arraste das três divisórias, edição do Inspector após resize, Preview e Código com projeto aberto, ciclo de vida de Rete, Monaco e iframe, acessibilidade e foco.
- A 1G-B3-B permanece suspensa por laboratório e em NO-GO. A importação física de assets segue desabilitada.
- A 1E-A segue suspensa, a 1E-B em NO-GO e a 1F sem início.
- Permanecem abertas as homologações históricas e as ressalvas de persistência, durabilidade, corrida residual sem CAS, RustSec, WebView2, instalação limpa, sandbox e distribuição.
