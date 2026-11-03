# Validação da Fase 1G-B3-C1

| Verificação | Resultado |
| --- | --- |
| Vitest | 180 aprovados, zero falhas finais |
| E2E Chromium direcionado | 9 aprovados, zero falhas |
| Typecheck e build web | Aprovados pelo npm run build. Vite emitiu aviso de tamanho de chunks |
| Lint | Aprovado |
| Scanner estático | 241 arquivos, zero achados no escopo do scanner |

O teste de domínio insere Panel em projeto v1 migrado para v4, grava e relê o documento, valida os padrões, duplica com ID novo, move, reordena e remove. A IR inclui inventário de componentes, por isso a comparação usa Containers comuns com os mesmos IDs e pais. A IR e a saída do gerador são idênticas nessa comparação. A primeira asserção comparava com o projeto sem os componentes e foi ajustada para verificar equivalência semântica.

O cenário Chromium confirma botão acessível, Enter, arraste como filho, seleção por teclado e Ctrl, Inspector e dimensões comuns, undo/redo por inserção e reabertura do documento web. Confere o fundo, padding e direção Flex nas superfícies compartilhadas em 375 px, 768 px e Desktop. A troca de viewport não muda o documento. A porta padrão estava ocupada e a rodada final usou configuração temporária na porta 1437.

A reabertura validada usa a persistência web e a serialização de domínio. Homologação em janela Tauri, integração UI/Rust e smoke do executável Windows não foram executados.
