# Encerramento oficial da Fase 1G-B1

**Decisão em 03/11/2026. GO COM RESSALVAS para encerramento restrito e integração à main.** A Fase 1G-B continua em andamento.

## Escopo e critérios de aceite

A seleção múltipla sincroniza árvore e canvas. Ctrl alterna itens, Shift seleciona um intervalo na ordem da árvore e o teclado permite navegar e confirmar a seleção. O estado de seleção é transitório e fica fora do manifesto. O Inspector mostra a quantidade selecionada, oferece alinhamento de texto em lote e indica valores mistos antes de qualquer alteração.

Duplicação e remoção operam uma vez por subárvore quando pai e descendente estão selecionados. Movimento e reordenação exigem componentes irmãos e preservam a ordem relativa. O domínio valida o lote em cópia e só publica a alteração completa. Um único undo ou redo afeta todo o lote. Referências inválidas, ciclos e seleções obsoletas são recusados. Schema v3, IR v1, Blueprint Engine, TypeScript gerado, Preview, bindings e persistência Rust preservam seus contratos.

O [relatório técnico](RELATORIO_FASE_01G_B1.md) descreve a arquitetura e os limites. A [captura Chromium](../qa/evidencias/fase01g-b1/multiselect-web.png) mostra a seleção na árvore, no canvas e no Inspector. A integração UI/Rust confirmou salvamento e reabertura em disco, com a estrutura preservada e a seleção fora do manifesto. A homologação de interação no Tauri real segue pendente.

## Validação registrada

| Suíte | Aprovados | Falhas finais |
|---|---:|---:|
| TypeScript | 140 | 0 |
| E2E web | 30 | 0 |
| Integrações UI/Rust | 13 | 0 |
| Produção Chromium | 5 | 0 |
| **Total registrado** | **188** | **0** |

Typecheck, lint, build web e scanner estático também passaram. A primeira rodada E2E registrou timeout no cenário de Código durante uma recarga. A rodada final, em servidor separado e com o código estabilizado, aprovou os 30 cenários. O encerramento documental reutiliza os [resultados registrados](../qa/VALIDACAO_FASE_01G_B1.md) e não inclui nova execução das suítes.

## Ressalvas abertas

1. Homologação funcional da 1G-B1 no Tauri real.
2. Homologação funcional da 1G-A no Tauri real.
3. Homologação Windows integral da 1D.
4. Durabilidade sob falta de energia.
5. Corrida externa residual sem CAS.
6. Auditoria RustSec.
7. Instalação e desinstalação limpas.
8. Mensagem histórica WebView2.
9. Sandbox, isolamento e distribuição.
10. Limites de exportação, escala, DPI e acessibilidade.

A 1E-A continua suspensa por dependência de laboratório e a 1E-B permanece em NO-GO. A 1F e a 1G-B2 não foram iniciadas.

## Git

Commit aprovado 482fc06b9bea8ae575d1dd7bb11da362263d0e75 na branch codex/phase-01g-b1-hierarchy-multiselect, com main de referência 5a3b82025855488317fc934d4cd1b0323ae70c49. O responsável autorizou o encerramento documental, a publicação e a integração por fast-forward. A verificação inicial confirmou árvore limpa, igualdade das referências locais e remotas e ancestralidade. A branch de desenvolvimento é preservada.
