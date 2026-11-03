# Validação da Fase 1G-UX-A

## Automatizada

- 183 testes Vitest aprovados, incluindo clamp, janela estreita, espaço liberado por recolhimento e padrões.
- 34 E2E Chromium aprovados na regressão da implementação inicial. Após a correção do recolhimento, o cenário direcionado passou novamente com asserções da largura do centro.
- Typecheck, lint, build web e scanner estático aprovados. O build manteve o aviso Vite de tamanho de chunks. O scanner não encontrou ocorrências no escopo declarado.

O E2E cobre arraste das três divisórias, teclado, recolhimento, restauração, seleção, manifesto web, edição após resize e preservação do iframe ao mudar o tamanho do console. Verifica a troca para Blueprint e Código. Os retângulos medidos em pixels CSS abaixo correspondem ao cenário com laterais nos padrões e artboard de 768 px.

| Viewport Chromium | Centro | Artboard |
| --- | --- | --- |
| 1440 × 920 | 926 × 530 | 768 × 320 |
| 1000 × 700 | 486 × 310 | 768 × 320 |
| 1920 × 1080 | 1406 × 690 | 768 × 320 |

## Tauri real

Sessão reutilizada pelo script npm run desktop:dev, com frontend entregue pelo Vite na porta 1420. O seletor recebeu intervenção manual para abrir artifacts/ux-a-native/project.btrk.json. O Studio exibiu Workspace UX-A, dois componentes incluindo o Panel persistido como Container, 8 nodes e 8 conexões e estado salvo no disco.

A janela mostrou o Blueprint e o Designer do manifesto descartável. O console foi recolhido com status visível. Na primeira tentativa de recolher a biblioteca, o canvas foi deslocado para a coluna oculta. Após a correção por HMR, o canvas expandiu com a lateral fechada. Restaurar layout do Designer trouxe ambas as laterais de volta, mantendo o projeto salvo. A janela ficou aberta no Designer.

A captura nativa observada tem aproximadamente 1442 × 954 pixels de imagem, incluindo moldura. A área cliente e o DPI efetivo não foram medidos. A matriz nativa de tamanho mínimo e escalas 100%, 125% e 150%, arraste dos três separadores, Inspector editando, Preview e Código com projeto aberto permanece pendente. Nenhum resultado Chromium foi usado como evidência Tauri.
