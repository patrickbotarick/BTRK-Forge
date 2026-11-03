# Encerramento oficial da Fase 1G-B3-A

**GO COM RESSALVAS em 03/11/2026.** Aceite restrito da fundação persistente v4 e integração autorizada à main. A 1G-B3 continua em andamento.

## Escopo aceito

Schema v4 com contratos persistentes de Image, Icon e resources. A cadeia v0 → v1 → v2 → v3 → v4 valida os formatos históricos e migra em cópia, preservando os dados e o arquivo original até o salvamento explícito. A matriz compartilhada demonstrou paridade entre TypeScript e Rust. Referências lógicas inválidas são recusadas. Recursos declarados sem resolução são identificados no recibo nativo, sem inspeção dos arquivos físicos. Salvamento e reabertura foram verificados. Salvar como recusa manifestos com recursos cujo transporte ainda não está disponível.

O documento completo é validado antes da projeção semântica na IR v1. Os testes demonstraram equivalência do TypeScript gerado, revisão SHA-256 e mapas de origem, além da preservação de eventos, bindings, trace e rollback. Image e Icon são declarações persistentes. Inserção no Designer, renderização e armazenamento físico ficam fora do aceite. [Relatório técnico](RELATORIO_FASE_01G_B3_A.md) · [Validação](../qa/VALIDACAO_FASE_01G_B3_A.md)

## Resultados registrados

| Suíte | Aprovados |
|---|---:|
| TypeScript | 179 |
| Rust persistência | 27 |
| Rust host | 1 |
| E2E Chromium | 32 |
| UI/Rust | 14 |
| Produção Chromium | 5 |
| **Total** | **258** |

Typecheck, lint, build, scanner estático e Cargo fmt também passaram. Uma divergência no limite UTF-16 de rótulos acessíveis foi corrigida e revalidada antes da publicação da implementação. Os resultados são das execuções anteriores. Este encerramento é exclusivamente documental.

## Ressalvas abertas

- Importação física, decodificação e reencodificação seguras, quota física e verificação de integridade dos bytes.
- Transporte de assets em Salvar como, resolução para o Preview e renderização Image/Icon.
- Homologação funcional Tauri da 1G-B3-A, 1G-A, 1G-B1 e 1G-B2, além da homologação Windows integral da 1D.
- Durabilidade sob perda de energia, corrida externa residual sem CAS, RustSec, instalação e desinstalação limpas e mensagem histórica WebView2.
- Sandbox, isolamento, distribuição e limites de exportação, escala, DPI e acessibilidade.

A 1E-A segue suspensa por dependência de laboratório, a 1E-B permanece em NO-GO e a 1F e a 1G-B3-B não foram iniciadas.

## Git

O responsável aprovou 56d714810fa800ff91dfe79e02a25d9cc8787d11 na branch codex/phase-01g-b3-a-schema-v4 e autorizou a publicação do encerramento e a integração por fast-forward sobre a main de referência 478503bef9d25c50db2a566a28ddf48f08e32959. As verificações iniciais confirmaram árvore limpa, referências sincronizadas e ancestralidade. A branch de desenvolvimento é preservada.
