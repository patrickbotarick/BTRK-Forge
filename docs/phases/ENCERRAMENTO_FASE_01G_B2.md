# Encerramento oficial da Fase 1G-B2

**GO COM RESSALVAS em 03/11/2026.** Encerramento restrito e integração autorizada à main. A Fase 1G-B continua em andamento.

## Escopo aceito

O Inspector permite editar largura e altura em seleção única ou múltipla com valores auto, fill e pixels inteiros de 0 a 2000. A interface sinaliza valores mistos, valida antes da aplicação e registra cada operação como uma transação atômica com undo/redo. Os presets de 375 px, 768 px e desktop são compartilhados entre Designer e Preview e ficam fora do manifesto. A persistência mantém o schema v3, com IR v1, eventos, bindings, Blueprint e codegen preservados.

Grid, percentuais livres, min/max configuráveis, expansão Flex adicional, alças e posicionamento absoluto permanecem fora do aceite e dependem de contrato persistente futuro.

## Revisão de lotes

O comportamento suspeito não se reproduziu no commit anterior. Pai e filho já recebiam a propriedade corretamente. A revisão separou a validação dos IDs explícitos de propriedades do cálculo de raízes para operações estruturais. A cobertura adicional verifica pai, filho, neto, seleção inválida, atomicidade e undo/redo. A mudança esclarece a regra de alvos e amplia sua cobertura.

## Evidências e testes registrados

| Verificação | Rodada inicial | Revisão pontual |
|---|---:|---:|
| TypeScript | 141 aprovados | 142 aprovados |
| E2E Chromium | 31 aprovados | 32 aprovados |
| UI/Rust | 14 cenários aprovados | 1 cenário direcionado aprovado |
| Rust persistência | 26 aprovados | Sem nova execução |
| Produção Chromium | 5 aprovados | Sem nova execução |
| Typecheck e lint | Aprovados | Aprovados |
| Build web e scanner estático | Aprovados | Sem nova execução |

Os resultados de cada rodada são registrados separadamente. O encerramento documental reutiliza essas evidências. A [validação](../qa/VALIDACAO_FASE_01G_B2.md) reúne as capturas Chromium e distingue a integração UI/Rust da janela nativa. O [relatório técnico](RELATORIO_FASE_01G_B2.md) descreve o contrato v3 e a revisão de lotes.

## Ressalvas abertas

- Homologação funcional Tauri da 1G-B2, 1G-B1 e 1G-A e homologação Windows integral da 1D.
- Durabilidade sob perda de energia, corrida externa residual sem CAS, RustSec, instalação e desinstalação limpas e mensagem histórica WebView2.
- Sandbox, isolamento, distribuição e limites de exportação, escala, DPI e acessibilidade.

A 1E-A segue suspensa por dependência de laboratório. A 1E-B permanece em NO-GO. A 1F e a 1G-B3 não foram iniciadas.

## Git

O responsável aprovou o commit 48291c460f0a9394fdd7777b42049f65e0d42150 na branch codex/phase-01g-b2-responsive-layout e autorizou o encerramento documental e a integração por fast-forward sobre a main 1f2640f0dd73afb03d5c6054fc6e56000f683fb4. As verificações iniciais confirmaram árvore limpa, referências sincronizadas e ancestralidade. A branch de desenvolvimento é preservada.
