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
