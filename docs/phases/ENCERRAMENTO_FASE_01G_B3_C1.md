# Encerramento oficial da Fase 1G-B3-C1 — Panel

**GO COM RESSALVAS para encerramento restrito e integração à main.** O aceite cobre o commit b731755890816aaa4d24a131a795ec37df109bb9 sobre a base 6fdf34db985780240bdd78098655ba337027ae8b. A 1G-B3-C permanece aberta para incrementos posteriores.

## Escopo aceito

Panel está disponível na biblioteca do Designer por clique, teclado e arraste. A inserção na raiz ou como filho válido de Container usa um comando e uma transação atômica com undo/redo. O manifesto v4 grava o tipo Container e suas propriedades. O rótulo Panel pertence à biblioteca. A hierarquia e o Inspector exibem Container desde a inserção e após a reabertura.

| Propriedade | Padrão aprovado |
| --- | --- |
| Fundo | #F1F5F9 |
| Cor do texto | #1E293B |
| Borda | 1 px, #64748B |
| Padding | 16 px |
| Gap | 12 px |
| Direção Flex | column |
| Largura | fill |
| Altura | auto |

O Inspector e a hierarquia suportam seleção, duplicação, movimentação, reordenação e remoção. Designer e Preview usam o renderizador compartilhado nas viewports de 375 px, 768 px e Desktop. A equivalência de IR e TypeScript gerado foi verificada contra Containers comuns com os mesmos IDs e pais.

## Evidências históricas

| Verificação | Resultado |
| --- | --- |
| TypeScript/Vitest | 180 aprovados |
| E2E Chromium | 9 aprovados |
| Total | 189 aprovados |
| Typecheck, lint, build web e scanner estático | Aprovados |

Vite emitiu aviso de tamanho dos chunks e o build passou. O E2E usou a porta temporária 1437 e a reabertura foi validada na persistência web. A homologação funcional Tauri, a integração UI/Rust e o smoke do executável Windows não foram executados. As suítes acima são evidências anteriores ao encerramento. [Validação](../qa/VALIDACAO_FASE_01G_B3_C1.md) · [Relatório de implementação](RELATORIO_FASE_01G_B3_C1.md)

## Ressalvas preservadas

- A 1G-B3-B segue suspensa por dependência de laboratório e em NO-GO. A importação permanece desabilitada, e publicação e transporte de assets seguem bloqueados. [Checkpoint experimental](https://github.com/patrickbotarick/BTRK-Forge/blob/0f5826b1b855726ad9498d94fb917494113f24d4/docs/phases/CHECKPOINT_FASE_01G_B3_B.md)
- Image permanece indisponível para inserção e renderização. Icon ainda carece de implementação visual. A 1G-B3-C2 segue sem início.
- Permanecem pendentes a homologação funcional Tauri da C1, as homologações Tauri anteriores da 1G e a homologação Windows integral da 1D.
- A 1E-A segue suspensa, a 1E-B em NO-GO e a 1F sem início.
- Permanecem abertas as ressalvas de durabilidade sob perda de energia, corrida externa residual sem CAS, RustSec, instalação e desinstalação limpas, mensagem histórica WebView2, sandbox e distribuição.
