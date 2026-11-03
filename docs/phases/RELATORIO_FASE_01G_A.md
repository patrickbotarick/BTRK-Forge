# Fase 1G-A — relatório para revisão

**Recomendação: GO COM RESSALVAS para revisão.** A homologação funcional na janela Tauri permanece pendente.

O Inspector agrupa os controles existentes em Geral, Aparência, Layout, Comportamento e Eventos conforme o tipo selecionado. A edição preserva o comando de domínio, a seleção e o histórico. Validação numérica e erro ao mover componente aparecem junto ao controle.

A paleta contextual abre ao soltar uma conexão sobre o canvas ou por botão de porta do node selecionado. Ela pesquisa termos em português, apresenta portas de destino distintas e explica opções incompatíveis. Setas, Enter e Escape operam na paleta. A operação add-connected valida uma cópia com node e edge antes de publicá-la em uma única transação. Undo/redo, persistência e reabertura preservam a estrutura. O contexto transitório é descartado quando muda o documento ou a sessão.

O schema v3, a IR v1, o gerador, o Worker declarativo, o Preview isolado e a persistência Rust conservam seus contratos. Os 11 tipos de node permanecem disponíveis. A paleta usa variáveis existentes por tipo e a configuração padrão do catálogo, preservando o Inspector de parâmetros para ajustes posteriores. O branch fica disponível para revisão antes da integração.

A [validação](../qa/VALIDACAO_FASE_01G_A.md) separa Chromium, driver Rust e Tauri. Continuam abertas a homologação Windows integral da 1D, durabilidade física, corrida externa sem CAS, RustSec, instalação limpa, mensagem WebView2, isolamento e distribuição. A 1E-A segue suspensa por falta de laboratório, a 1E-B permanece em NO-GO e a 1F e a 1G-B aguardam autorização.
