# Validação — Fase 1G-B3-A

A matriz compartilhada usa manifestos JSON independentes e cobre v4 mínimo, recursos declarados, Image/Icon, referências ausentes, IDs, tipo, mídia, hash, limites de bytes/pixels/quantidade, metadados conflitantes, acessibilidade, campos indevidos, hierarquia, versões históricas inválidas e versão futura. Fixtures válidas v0–v3 verificam normalização, preservação de grafo e variáveis e idempotência. Rust exercita abertura sem regravar, backup, reabertura, diagnóstico de recurso não provisionado e Save As com e sem recursos.

| Verificação | Resultado final |
|---|---|
| TypeScript | 179 aprovados |
| Persistência Rust | 27 aprovados |
| Host Rust | 1 aprovado |
| E2E Chromium | 32 aprovados |
| UI/Rust | 14 aprovados |
| Produção Chromium | 5 aprovados |
| Typecheck, lint, build, scanner e Cargo fmt | Aprovados |

A equivalência compara IR, TypeScript, revisão e mapas de origem entre v3 e v4 com mídia declarada. O teste diferencial compila e executa o código gerado e verifica eventos, bindings, trace e rollback. A regressão exercita os 11 nodes e o undo/redo já existente.

Na primeira rodada, a matriz revelou diferença no limite de texto acessível em UTF-16, alinhado explicitamente entre os validadores. O scanner apontou o hash CSP antigo do Preview, regenerado a partir do script estático. O teste de junction exigiu o token Windows normal para criar a fixture. Os resultados acima usam a validação final.

Chromium e driver Rust são evidências distintas da janela Tauri real. Bytes de assets, quota física, importação e renderização Image/Icon permanecem pendentes.
