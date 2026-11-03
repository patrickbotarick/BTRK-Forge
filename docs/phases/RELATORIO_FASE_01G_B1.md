# Fase 1G-B1 — hierarquia avançada e seleção múltipla

**Candidata a GO COM RESSALVAS para revisão.** A implementação cobre a hierarquia e a seleção múltipla do Designer, com validação funcional na janela Tauri ainda pendente.

A árvore e o canvas compartilham seleção transitória. Clique seleciona um item, Ctrl alterna sua inclusão e Shift seleciona o intervalo inclusivo na ordem de apresentação da árvore, em profundidade. Setas, Home e End movem o foco na árvore, Shift estende o intervalo e Enter/Espaço confirmam a seleção. A navegação não altera o manifesto. Seleções desaparecem ao trocar ou fechar projetos e IDs removidos são descartados. Após remoção, o foco retorna à tela na árvore. Undo restaura o documento e não seleciona automaticamente itens restaurados.

O Inspector exibe a quantidade de itens, apresenta o alinhamento de texto como propriedade comum e sinaliza valores mistos antes da aplicação explícita. Duplicar e remover operam sobre as raízes selecionadas, uma vez por subárvore. Mover e reordenar exigem raízes irmãs. O movimento mantém a ordem relativa e coloca o grupo ao fim do destino. Subir/Descer deslocam a seleção sobre irmãos não selecionados e mantêm a ordem interna. Destinos contidos na seleção são recusados. Duplicação preserva bindings e aplica as regras já existentes para eventos escopados.

Cada lote produz uma única alteração validada. O domínio trabalha em cópias e a interface publica o resultado somente após a validação. Falhas deixam o documento original intacto. Permanecem preservados schema v3, IR v1, 11 nodes, TypeScript gerado, Preview isolado, persistência Rust e contratos de eventos e bindings.

O [registro de validação](../qa/VALIDACAO_FASE_01G_B1.md) separa Chromium, driver Rust e Tauri. A homologação Tauri da 1G-A e a homologação Windows integral da 1D seguem pendentes. A 1E-A continua suspensa por dependência de laboratório, a 1E-B em NO-GO e a 1F sem início. Permanecem as ressalvas de energia, corrida externa sem CAS, RustSec, instalação limpa, WebView2, sandbox e distribuição. A 1G-B2 aguarda autorização.
