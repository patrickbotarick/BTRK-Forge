# Fase 1G-B3-C1 — Panel na biblioteca visual

**GO COM RESSALVAS para revisão.** Panel é uma opção de inserção do Designer que cria um Container v4. Clique, teclado e arraste usam o mesmo comando validado e geram uma transação. A inserção respeita o destino da biblioteca existente. A hierarquia e o Inspector exibem Container desde a criação, inclusive após reabrir. O manifesto guarda as propriedades efetivas e o tipo Container.

O preset inicial usa fundo #F1F5F9, cor de texto #1E293B, borda de 1 px em #64748B, padding de 16 px, gap de 12 px, Flex vertical, largura fill e altura auto. Os filhos mantêm suas próprias cores. Os controles de Container permitem editar o resultado, selecionar em lote, mover, reordenar, duplicar e remover com o histórico existente. O renderizador compartilhado continua responsável pelo Designer e pelo Preview.

A [validação](../qa/VALIDACAO_FASE_01G_B3_C1.md) cobre persistência web, migração, equivalência com Container comum e as três viewports. Homologação funcional Tauri segue pendente. A C1 está em revisão na branch dedicada e a 1G-B3-C permanece aberta.

A [1G-B3-B permanece suspensa](https://github.com/patrickbotarick/BTRK-Forge/blob/0f5826b1b855726ad9498d94fb917494113f24d4/docs/phases/CHECKPOINT_FASE_01G_B3_B.md) por laboratório, em NO-GO, com importação desabilitada. A 1E-A segue suspensa, a 1E-B em NO-GO e a 1F sem início. Continuam abertas a homologação Windows integral da 1D e as ressalvas de durabilidade, CAS, RustSec, instalação limpa, WebView2, sandbox e distribuição.
