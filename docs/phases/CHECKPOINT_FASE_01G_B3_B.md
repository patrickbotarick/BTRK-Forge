# Checkpoint da Fase 1G-B3-B

**Investigação suspensa por dependência de laboratório Windows descartável. NO-GO para integração e publicação de assets.** A importação permanece desabilitada. A 1G-B3-C segue sem início e a 1G-B3 continua aberta.

A base experimental preservada é o commit 06920ff34faaa85519b309f77aa0183987521451 na branch codex/phase-01g-b3-b-secure-assets. A main permanece em 6fdf34db985780240bdd78098655ba337027ae8b. Este checkpoint altera somente documentação e reutiliza evidências históricas.

| Rodada | Controle implementado | Garantia demonstrada e limite |
| --- | --- | --- |
| [B](RELATORIO_FASE_01G_B3_B.md) | Resolução Rust somente leitura vinculada à sessão e revisão, com abertura por handle e verificação do objeto | Resolução nos cenários testados. A interface ainda não consome o resolver |
| [B1](RELATORIO_FASE_01G_B3_B1.md) | Decodificador independente com quadros limitados, normalização PNG RGBA8 e SHA-256 | Fixtures sintéticas PNG, JPEG e WebP reabertas e verificadas. Seis testes aprovados. Contenção do processo não era coberta |
| [B2](RELATORIO_FASE_01G_B3_B2.md) | Job Object de 192 MiB, timeout, pipes e slot por processo | Timeout em stdin, recuperação após timeout e falha de protocolo e recusa do segundo solicitante. Seis regressões e um cenário Windows aprovados. Fixtures de 7.996.000 pixels atingiram aproximadamente 54–55 MiB de pico de commit no Job. O decoder ainda inicia antes da atribuição |
| [B3](RELATORIO_FASE_01G_B3_B3.md) | Sonda criada suspensa, sem herança de handles, atribuída ao Job antes de retomar | Controle de 256 MiB tocou 200 MiB. Job de 192 MiB recusou o bloco seguinte a 188 MiB, com Win32 1455. O pico reportado excedeu o teto em 1,14 MiB, ainda sem reconciliação. Oito testes de nível superior passaram. A sonda filha, ignorada na seleção externa, foi executada duas vezes pelo teste pai |

**GO COM RESSALVAS** para resolução somente leitura nos cenários testados, normalização sintética, timeout no caso de stdin bloqueado, recusa diferencial de alocação, recuperação após protocolo inválido e timeout e concorrência limitada à instância do supervisor.

**NO-GO** para token efetivamente restrito antes da execução do decoder, vínculo da identidade do binário ao lançamento, negação de escrita, links e caminhos indiretos sob essa política, auditoria de handles, encerramento de descendentes e do supervisor abrupto e recuperação após falta de memória real no decoder. Importação e publicação física, quota física, transporte em Save As e coleta de órfãos seguem bloqueados.

As fixtures e medições permanecem no spike e nas validações [B1](../qa/VALIDACAO_FASE_01G_B3_B1.md), [B2](../qa/VALIDACAO_FASE_01G_B3_B2.md) e [B3](../qa/VALIDACAO_FASE_01G_B3_B3.md). Evidências da 1E-A pertencem àquela investigação.

Retomar após provisionar e registrar os pré-requisitos do [plano de laboratório](../qa/PLANO_LABORATORIO_FASE_01G_B3_B.md). Qualificar primeiro o lançamento e os canários sob a mesma política do decoder. Exigir resultado favorável em cada gate antes de propor nova decisão de integração ou publicação.

A 1E-A segue suspensa por laboratório, a 1E-B em NO-GO e a 1F sem início. Continuam pendentes as homologações Tauri da 1G e Windows integral da 1D, a durabilidade sob falha de energia, a corrida externa residual sem CAS, RustSec, instalação e desinstalação limpas, a mensagem histórica WebView2, sandbox e distribuição.
