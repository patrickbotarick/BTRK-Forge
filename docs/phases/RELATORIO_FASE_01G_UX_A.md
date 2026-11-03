# Relatório da Fase 1G-UX-A — Workspace redimensionável

**GO COM RESSALVAS para revisão.** O Designer ganhou divisórias entre Biblioteca/Hierarquia, canvas e Inspector. O console inferior pode ser redimensionado em qualquer modo. A Biblioteca e a Hierarquia rolam separadamente, assim como o Inspector e a saída de execução.

| Região | Padrão | Limites |
| --- | ---: | --- |
| Biblioteca e Hierarquia | 220 px | 160–420 px, limitado pelo espaço |
| Inspector | 270 px | 180–460 px, limitado pelo espaço |
| Saída do console | 158 px | 80–360 px, limitado também a 45% da altura disponível |

As divisórias têm 12 px de área de interação, captura de ponteiro e sobreposição durante o arraste para manter a interação sobre o iframe. As setas ajustam em 8 px, Shift acelera para 32 px e Home/End levam aos extremos. Escape e cancelamento por ponteiro restauram o valor inicial do gesto. Os botões permitem recolher, reabrir e restaurar os padrões. O console recolhido mantém visível o status. Recolher mantém as regiões montadas e não encerra a execução. O Designer mantém os valores enquanto está montado e volta aos padrões na troca de modo. A persistência e o docking ficam para UX-B.

O cálculo reserva 320 px para o centro nos tamanhos suportados. As viewports fixas conservam 375 e 768 px, com rolagem quando necessário. Os controles do workspace ficam fora do documento e do histórico de edição. Schema v4, Blueprint, IR, codegen, runtime e persistência Rust permanecem no contrato vigente.

O primeiro teste nativo revelou que a ocultação de uma lateral deslocava o canvas na grade. A correção fixa a coluna das regiões e foi verificada no Tauri e com nova asserção geométrica no Chromium. A [validação](../qa/VALIDACAO_FASE_01G_UX_A.md) separa a regressão web da verificação parcial em Windows.

A 1G-B3-B segue suspensa e em NO-GO. A importação física de assets segue desabilitada. A 1E-A permanece suspensa, a 1E-B em NO-GO e a 1F sem início. Permanecem abertas as homologações anteriores e as ressalvas de durabilidade, CAS, RustSec, WebView2, instalação limpa, sandbox e distribuição.
