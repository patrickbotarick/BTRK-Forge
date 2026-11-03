# Homologação Windows da 1D — retomada em 03/11/2026

**Resultado.** Abertura do Studio confirmada pela árvore de acessibilidade da janela Tauri. Homologação integral pendente. Base funcional da retomada em a2832ba5167454577b3b93195afec3ccba7da848.

| Evidência | Observação |
|---|---|
| Manifesto em disco | artifacts/homologacao-1d-20261027/copias/completo-21/project.btrk.json |
| Identidade e integridade | Forge Debug Demo, schema 3, project-411ceea7-2763-4338-b3a5-4d6a57d2862e. SHA-256 826b63c795ad84e9653f666b7dae30e8ca35891b1af33816adf9f894b9cbeb58. |
| Estrutura em disco | 5 componentes, 21 nodes, 21 conexões. Input com evento change e binding para variável string, Button com evento click. |
| Executável | artifacts/phase01d-d-20261027/windows-target/release/btrk-forge.exe. SHA-256 61cf00b496f5a5636a3bf7e5a1633cf067b46820c033fd78c1d359fa9729f6d8. |
| Janela real | Uma instância aberta, identificador de janela 134506, origem tauri.localhost, cabeçalho FASE 1D-D / RUNTIME DEBUGGING e estado “Nenhum projeto aberto”. |
| Bloqueio atual | A ação Abrir projeto falhou porque o controlador não tinha geometria para o clique. A captura mostrou outra janela, portanto foi descartada como evidência. O seletor não chegou a ser observado nesta retomada e não houve seleção manual. |

Os 12 cenários funcionais ficaram sem observação nesta retomada: abertura do Demo, Designer/Blueprint, geração no Monaco, navegação bidirecional, ramos vazio/preenchido, click/change, histórico, variáveis, rollback, salvar/reabrir em novo processo, preservação de nodes/conexões/binding e ausência de histórico persistido. Os 204 testes do [encerramento restrito](../phases/ENCERRAMENTO_FASE_01D.md) são evidência histórica.

O relatório anterior em artifacts/homologacao-1d-20261027/RELATORIO_HOMOLOGACAO_FASE_1D.md documentou o Demo antigo exibido. A investigação em artifacts/investigacao-1d-20261027/RELATORIO_INVESTIGACAO_ABERTURA.md localizou a primeira divergência no caminho retornado pelo seletor, antes da abertura Rust. Nenhum defeito funcional foi comprovado na investigação ou nesta retomada.

Para concluir, obter uma captura da janela correta, selecionar o manifesto temporário no diálogo nativo e conferir o projeto ativo antes de testar. Usar uma cópia separada para rollback, validar IDs e bindings após reabertura e registrar somente observações da janela Tauri real.
