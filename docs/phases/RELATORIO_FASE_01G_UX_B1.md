# Relatório da Fase 1G-UX-B1 — Preferências do workspace

**GO COM RESSALVAS para revisão.** A B1 introduz um registro tipado de ferramentas com IDs estáveis para Biblioteca, Hierarquia, Inspector, Designer, Blueprint, Código, Preview, Depuração e Console. Cada entrada descreve região, modos, recolhimento, possibilidade futura de movimentação, centralidade e ciclo de vida. As ferramentas centrais continuam obrigatórias, uma por modo. As ferramentas atuais mantêm o ciclo de vida da UX-A. O console permanece montado ao mudar de modo ou recolher.

O contrato local v1 guarda um layout por modo com grupos nas regiões esquerda, centro, direita e inferior. Os grupos registram ordem, aba ativa quando aplicável e estado recolhido. A Biblioteca e a Hierarquia continuam agrupadas na mesma lateral com rolagens separadas. A colocação e a ordem são estáticas nesta etapa. A validação rejeita formatos incompletos, versões futuras, regiões incompatíveis, IDs desconhecidos, duplicação, ausência de ferramenta obrigatória e recolhimento central. Dimensões positivas inteiras são limitadas pelos intervalos da UX-A. Dados inválidos recuperam os defaults.

A chave btrk-forge:studio:workspace usa localStorage da origem do Studio, no perfil local do WebView2 em modo nativo. O arraste mantém uma prévia em memória e grava no término. Teclado, recolhimento e restauração gravam ao concluir a ação. Se houver erro de acesso ao armazenamento, o Studio mantém o layout em memória e mostra um aviso discreto. O manifesto e o histórico de edição ficam separados dessas preferências.

O menu Exibir mostra as regiões disponíveis e permite recuperar painéis, restaurar o modo atual ou restaurar todos os modos. O layout do Designer é restaurado ao retornar de outra ferramenta. Docking e movimentação livre permanecem para revisão futura. Mudanças de topologia dependem de validar remontagem, foco, rascunhos, listeners e estado de Rete, Monaco e iframe.

A [validação](../qa/VALIDACAO_FASE_01G_UX_B1.md) separa Chromium de Tauri real. UX-B2 permanece sem início. A 1G-B3-B e a 1E-A seguem suspensas. A importação física continua desabilitada, a 1E-B em NO-GO e a 1F sem início. As ressalvas anteriores de homologação, persistência e distribuição permanecem abertas.

## Diagnóstico complementar do aviso de projeto bloqueado

O retorno busy é emitido pelo mapeamento dos erros Win32 32 e 33. Em uma abertura, a sessão tenta adquirir .forge.lock com compartilhamento zero. O handle permanece na sessão Rust. Fechar projeto remove a sessão do registro e encerrar o processo libera os handles. O arquivo pode permanecer no diretório depois do fechamento. Sua presença isolada não indica lock ativo.

O comando de abertura tenta criar a nova sessão antes de o frontend substituir a sessão anterior. Uma nova seleção do mesmo manifesto enquanto o projeto está aberto pode falhar com busy até dentro do mesmo processo. O frontend mantém o documento e o recibo anteriores e exibe a falha no status do console. O indicador Salvo no disco diz respeito ao documento ativo. O status do console é a última mensagem e pode continuar após mudar de modo. A tentativa que originou a mensagem histórica da homologação anterior não pôde ser identificada de forma conclusiva.

A prova com o driver Rust em cópia descartável confirmou exclusão concorrente, liberação, salvamento e reabertura. A janela Tauri existente permaneceu aberta no Designer com Workspace UX-A e recusou uma tentativa concorrente do driver. Não houve mudança funcional nem remoção manual de lock. A [validação complementar](../qa/VALIDACAO_FASE_01G_UX_B1.md#diagnóstico-complementar) detalha o que ainda falta na janela nativa.

**NO-GO para integração nesta rodada.** A funcionalidade de workspace mantém o GO COM RESSALVAS. Antes de propor integração, completar no Tauri a sequência de fechar, reabrir, editar e salvar uma cópia descartável e confirmar as duas larguras entre processos.
