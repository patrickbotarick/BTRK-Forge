# Validação da Fase 1G-B1

| Verificação | Resultado |
|---|---|
| Typecheck e lint | Aprovados |
| TypeScript, incluindo domínio de lotes | 140 aprovados |
| Chromium E2E | 30 aprovados, zero falhas e zero ignorados na rodada final |
| Interface com driver Rust e filesystem real | 13 aprovados |
| Produção Chromium e CSP | 5 aprovados |
| Build web e scanner estático | Aprovados. Vite reportou aviso de tamanho de chunks. |

O domínio cobre pai e descendente, duplicação sem IDs repetidos, movimento e ordem relativa, alinhamento comum, serialização v3, undo/redo e recusa atômica de referência em uso, ciclo, seleção obsoleta e pais incompatíveis. O Chromium cobre seleção simples, Ctrl no canvas, intervalo Shift na árvore, teclado, ausência de alteração no manifesto por seleção, alteração comum e undo/redo, remoção com foco previsível e recarga. A integração UI/Rust salva e reabre a estrutura sem seleção persistida, e a regressão inclui migração de manifesto legado.

Uma rodada web iniciada durante o ajuste de sessão registrou timeout no primeiro cenário de Código. A rodada final foi executada em servidor separado com o código estabilizado.

**Evidência Chromium.** [Seleção sincronizada entre árvore, canvas e Inspector](evidencias/fase01g-b1/multiselect-web.png).

**Tauri real.** Nenhum cenário foi executado na janela nativa nesta subetapa. A validação UI/Rust usa navegador e driver Rust, com evidência de persistência em disco. A homologação de interação no WebView2 segue pendente.
