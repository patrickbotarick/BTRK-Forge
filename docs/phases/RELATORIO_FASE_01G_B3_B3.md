# Fase 1G-B3-B3 — Prova de memória e lançamento suspenso

**Decisão: NO-GO para integração da 1G-B3-B e publicação de assets.**

A [sonda Windows](../../tools/image-decoder-spike/tests/windows_job.rs) executa o próprio binário de testes com um cenário fixo. CreateProcessW cria o processo suspenso com herança de handles desativada. O host atribui o Job antes de ResumeThread, aguarda a saída e coleta o código e o pico. A sonda usa o token ambiente e não processa imagens nem recebe caminhos do projeto. O supervisor do decoder permanece no escopo sintético da [B2](RELATORIO_FASE_01G_B3_B2.md). Lançamento protegido por identidade e token, lista explícita de pipes e auditoria de handles seguem pendentes. [CreateProcessW](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw)

A sonda compromete e toca páginas em blocos de 4 MiB. O controle de 256 MiB completou 200 MiB de blocos. Com 192 MiB, o Windows recusou o 48º bloco. O contador de pico reportou cerca de 1,14 MiB acima do orçamento nesse ensaio. A recusa diferencial comprova a negativa para a alocação ensaiada. A causa da diferença contábil permanece aberta. [VirtualAlloc](https://learn.microsoft.com/en-us/windows/win32/api/memoryapi/nf-memoryapi-virtualalloc)

## Política candidata

Preferir avaliar AppContainer sem capacidades com ACL mínima para ler e executar o binário fixado. O spike da 1E-A serve de referência para lançamento suspenso e inspeção de token. Seus ensaios não qualificam o decoder. Token restrito é alternativa a ensaiar com ACLs verificadas em todas as superfícies relevantes. O Job controla recursos e não controla filesystem. O token, as capacidades, os diretórios legíveis e graváveis, a rede e os handles do decoder sob política restrita ainda não foram medidos.

A próxima qualificação depende de laboratório Windows descartável com imagem licenciada e hash registrado, conta sem privilégios administrativos durante a execução, permissões de preparação conhecidas, binários fixados em diretório protegido contra substituição, fixtures NTFS sintéticas e configuração de rede registrada. Executar a matriz com uma sonda sob a mesma política do decoder. Se houver escrita indevida ou alguma etapa obrigatória falhar, bloquear o processamento externo. Testar também descendentes, falhas de token e atribuição e morte abrupta do host.

## Prazo

O prazo de 250 ms é um teste de bloqueio, enquanto o teste com imagens usa até 5 s para a chamada. A duração externa de 2,7 a 3,3 s inclui a reabertura e verificação no host, fora do Job. Para a próxima rodada, instrumentar separadamente startup, entrega da entrada, processamento, drenagem da saída e validação da resposta. Manter 5 s como orçamento experimental total da chamada e medir os marcos internos sem impor subprazos antes de ter uma distribuição de latência. O supervisor B2 não pode cancelar preparação síncrona de startup. O teto da sonda suspensa é uma espera de 5 s após o resume. Nenhum dos valores foi homologado para produção.

Os [resultados e gates](../qa/VALIDACAO_FASE_01G_B3_B3.md) registram o trabalho incompleto. Resolver, normalizador e contratos permanecem no escopo anterior. A importação continua desabilitada.
