# Validação da Fase 1G-B3-B3

    cargo test --locked --offline --manifest-path tools/image-decoder-spike/Cargo.toml -- --nocapture

Oito testes de nível superior passaram, sem falhas finais. A entrada da sonda filha é marcada como ignorada na suíte externa e foi chamada em dois processos suspensos pelo teste pai. Typecheck, lint e scanner estático passaram. O scanner verificou 256 arquivos e encontrou zero ocorrências. Sem mudanças no host ou na persistência, essas suítes ficaram fora da rodada.

| Job | Blocos tocados | Pico reportado | Saída |
| --- | ---: | ---: | --- |
| 256 MiB, controle | 50 de 4 MiB | 210.989.056 B | 0 |
| 192 MiB | 47 de 4 MiB | 202.522.624 B | 147, Win32 1455 na alocação seguinte |

A primeira rodada falhou na asserção de pico menor ou igual ao teto, embora o Windows tenha negado a alocação. A rodada final testa a recusa por código de saída e registra o pico separadamente. Não houve encerramento automático por OOM. A sonda encerrou após detectar a recusa. A suíte B2 repetiu o bloqueio em stdin com saída em 255 ms e chamadas válidas posteriores, inclusive PNG, JPEG e WebP grandes. A recuperação em uma nova chamada do mesmo supervisor após falta de memória no decoder ainda não foi ensaiada.

| Gate | Decisão | Evidência |
| --- | --- | --- |
| Inicialização | NO-GO | Lançamento suspenso observado na sonda. Token restrito e pinagem do decoder até a criação pendentes |
| Filesystem | NO-GO | Canários de criação, sobrescrita, renomeação, exclusão, subdiretório, junction, symlink, workspace sintético, destino externo e alteração do executável ou entrada não executados |
| Memória | GO COM RESSALVAS | Recusa diferencial demonstrada na sonda. Contador acima do orçamento sem explicação e recuperação no decoder ainda pendentes |
| Processos | NO-GO | Herança desativada na sonda sem auditoria ativa. Descendentes, injeções de falha de atribuição e token e morte do supervisor pendentes |
| Tempo | GO COM RESSALVAS | Regressão de timeout em stdin aprovada. Falta instrumentar as etapas e testar bloqueio na saída e carga contínua |
| IPC | GO COM RESSALVAS | Quadros inválidos e recuperação da B2 revalidados. Pipe quebrado, resposta excessiva e morte antes da resposta ainda pendentes |

Não foram usados projetos reais. Nenhum resultado de filesystem da 1E-A foi contabilizado nesta validação.
