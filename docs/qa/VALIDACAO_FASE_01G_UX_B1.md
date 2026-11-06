# Validação da Fase 1G-UX-B1

## Automatizada

- Vitest: 187 aprovados. Cobertura de defaults, rejeição de dados incompatíveis, clamp, armazenamento e separação da chave do projeto.
- E2E Chromium: 35 aprovados. O cenário de workspace verifica que o arraste só grava ao terminar, alternância por modo, seleção, recarga, JSON inválido, recuperação pelo menu Exibir e restauração por modo e global. A regressão verifica a preservação do iframe durante resize e o documento web.
- Typecheck, lint, build web e scanner estático aprovados. O build mantém o aviso de chunks do Vite. O scanner informou 255 arquivos e zero achados no seu escopo.

## Tauri real

A sessão inicial carregou o menu Exibir via Vite na porta 1420. O console do modo inicial foi recolhido pelo menu. A janela foi fechada e o processo reiniciado com npm run desktop:dev, após confirmar que a sessão anterior terminou. Na nova janela, o console do modo inicial permaneceu recolhido.

O manifesto descartável artifacts/ux-a-native/project.btrk.json foi selecionado com intervenção manual. O Studio exibiu Workspace UX-A, dois componentes, oito nodes e oito conexões, e indicou projeto salvo. No Designer, a lateral esquerda passou de 220 para 260 px e o Inspector de 270 para 300 px por arraste. Restaurar layout deste modo no menu Exibir voltou a 220 e 270 px. A janela ficou aberta no Designer.

Durante a reabertura, a saída exibiu uma mensagem de projeto bloqueado, embora o projeto estivesse carregado e marcado como salvo. A origem da mensagem não foi determinada nesta rodada. O SHA-256 do manifesto permaneceu 04B72AF7D96218E8FA478CE7AFEE4BE8FB49D22E470318AF7B3012B1891B8185.

A persistência entre processos no Tauri foi confirmada para o recolhimento do console. A recuperação das dimensões das laterais entre processos foi coberta por recarga no Chromium. Permanecem pendentes a matriz de DPI e tamanho mínimo, a homologação integral do ciclo de vida dos editores no Tauri e os cenários de movimentação de painéis da UX-B2.

## Diagnóstico complementar

A evidência histórica acima foi preservada. A rodada complementar compilou o exemplo persistence_driver do crate Rust com Cargo offline e lockfile. O driver é um harness de teste e não passa pelo seletor nem pelo IPC do Tauri.

| Cenário executado | Evidência |
| --- | --- |
| Abrir cópia descartável em artifacts/ux-b1-lock-vLJqpV/Disposable | Recibo válido do processo 32168 |
| Reabrir enquanto a primeira sessão está ativa | busy e committed false tanto no processo 32168 quanto no processo concorrente 30280, com a mesma mensagem histórica |
| Fechar e reabrir na mesma execução | Novo ID de sessão. O arquivo .forge.lock continuava presente após fechar |
| Encerrar o processo com sessão aberta | O segundo processo abriu após a saída normal do primeiro |
| Editar, salvar, fechar e reabrir a cópia | O título UX-B1 — salvamento controlado coincidiu no recibo e no JSON em disco. A comparação foi do documento completo |
| Tauri com Workspace UX-A ativo | Uma janela e um PID do executável. A árvore confirmou Designer, título correto e indicador salvo. Uma tentativa do driver de abrir esse manifesto retornou busy sem commit |
| Regressão Rust | workspace_locks_reject_second_instance_and_root_rename passou, com 26 casos filtrados |

O aviso ainda estava visível no console com o projeto ativo. Não foi possível atribuir o aviso histórico a uma seleção específica. A reprodução mostra que um segundo processo do Studio não é condição necessária. O projeto Workspace UX-A preservado tem SHA-256 04B72AF7D96218E8FA478CE7AFEE4BE8FB49D22E470318AF7B3012B1891B8185.

O salvamento e a reabertura desta rodada foram verificados pelo driver Rust em outra cópia. O ciclo integral pelo seletor e pelo comando Salvar do Tauri ainda está pendente. A prova anterior de reinício do Tauri cobre console recolhido. A restauração de 260 e 300 px após reiniciar o processo nativo, junto com a restauração dos padrões pelo menu Exibir, ainda precisa de uma rodada conjunta. Nenhum teste Chromium, typecheck, lint, build web ou scanner foi repetido nesta revisão documental.

## Homologação final Tauri

O ciclo de projeto foi executado na janela BTRK Forge — BTRK Studio com o frontend local da porta 1420 e o executável apps/studio/src-tauri/target/debug/btrk-forge.exe. As capturas da janela e leituras da árvore de acessibilidade foram inspecionadas durante as ações. A primeira seleção de arquivo teve intervenção manual. Nas reaberturas seguintes, o manifesto foi selecionado diretamente na lista do seletor Windows. Os ensaios de reinício confirmaram o fim da sessão anterior antes de executar novamente npm run desktop:dev.

| Gate nativo | Resultado efetivamente observado |
| --- | --- |
| Abertura livre | Cópia independente carregada com título Workspace UX-A, dois componentes, oito nodes e oito conexões |
| Edição e salvamento | Título alterado para Workspace UX-B1 - homologacao. O indicador passou para alterações não salvas e voltou a salvo após Salvar. O JSON em disco contém o novo título |
| Fechar e reabrir | Fechar projeto removeu o documento da interface. O driver conseguiu abrir a cópia após o fechamento, demonstrando liberação do lock. A reabertura pelo seletor Tauri mostrou o título gravado |
| Abertura concorrente | Driver recebeu busy e committed false enquanto a cópia estava aberta. Selecionar novamente o mesmo manifesto no Tauri também produziu o aviso esperado, preservando título, componentes e estado salvo |
| Reinício do Studio | A cópia reabriu no novo processo com o título salvo. O código da aplicação e a política de locks permaneceram sem alterações |
| Preferências entre processos | Estado acessível no Designer após reiniciar indicou esquerda 260, direita 300 e botão Reabrir console |
| Reset persistente | Exibir → Restaurar layout deste modo retornou esquerda 220, direita 270 e console 158. Novo reinício e reabertura confirmaram os mesmos três valores |
| Histórico e integridade | Desfazer e Refazer desabilitados após reabertura e durante o reset. O indicador permaneceu salvo. O hash do manifesto foi igual antes e depois dos gestos de layout |
| Comparação integral do documento | Salvar sem edição após reabrir no Tauri produziu o mesmo SHA-256 do manifesto salvo na primeira parte. A comparação envolve a serialização completa do projeto |
| Console | O busy foi reproduzido por uma operação concreta de reabertura concorrente. A mensagem permaneceu como última falha até nova operação. Abertura e salvamento válidos seguintes exibiram o status de persistência nativa, sem reapresentar o busy |

O teste de edição deliberada mudou o SHA-256 da cópia de 04B72AF7D96218E8FA478CE7AFEE4BE8FB49D22E470318AF7B3012B1891B8185 para A74AC7CDBA153B076EB19E384E807436C5BFF6B18A705B93E30B0BEE5C7BB3DD. Após os testes de layout, reaberturas e o salvamento de comparação, o segundo hash continuou igual. O grafo, as variáveis e os componentes foram comparados com o original e preservados integralmente. O manifesto original Workspace UX-A manteve o primeiro hash.

O documento local tests/Testes/Projeto Teste - 01/project.btrk.json manteve SHA-256 D0AE7B521A32DEE601C9E2AB8F17CE85D3C7367E5C0733A3BC0336F49634D471. Nenhum lock foi removido manualmente. A janela final permanece única, com a cópia no Designer e preferências padrão.

Esta rodada acrescenta evidência manual Tauri e comparações de arquivos. Os 187 Vitest e 35 E2E Chromium anteriores permanecem históricos. Não houve correção funcional nem repetição dessas suítes. A exportação JSON foi acionada durante uma tentativa auxiliar de comparação, mas não produziu arquivo observável e não integra a evidência aprovada. A comparação completa foi feita pelo salvamento do documento reaberto.

**Resultado final: GO COM RESSALVAS para integração, mediante aprovação posterior.** Permanecem abertas DPI de 100%, 125% e 150%, janela mínima, acessibilidade e a homologação completa de montagem, foco e estado de Rete, Monaco e iframe.
