# Checkpoint da Fase 1E-A

**Investigação suspensa por dependência externa. NO-GO para a 1E-B.** O encerramento administrativo preserva as evidências do spike. A homologação técnica do isolamento segue pendente. A 1E-B e a 1F aguardam autorização posterior.

## Evidências e bloqueios

- **AppContainer + Job Object.** MSVC 14.44.35207 fixado por SHA-256 compilou e linkou offline um PE x64 mínimo, que retornou 42 sob isolamento. Os ensaios demonstraram limites de CPU, memória, tempo e retenção de logs, encerramento de descendentes, recuperação sintética após morte do host e recusa de iniciar sem SID. Os canários de leitura e escrita externas e os acessos via junction e hard link foram negados nos casos testados.
- **Motivo do NO-GO.** O loopback expirou sem evidência de bloqueio atribuível à política e faltou um segundo endpoint controlado. A transação WFP foi negada ao usuário padrão. A quota preventiva de todas as superfícies graváveis ficou sem prova. A criação de symlink exigia privilégio indisponível e o hard link tardio foi criado durante a coleta, embora detectado na segunda inspeção.
- **VM descartável.** Candidata recomendada. O diagnóstico do host conferiu os 16 hashes do MSVC, mas faltavam gestão de VM acessível e imagem licenciada de laboratório. Build, isolamento e custos em VM continuam sem medição. [Relatório técnico](RELATORIO_FASE_01E_A.md) · [Matrizes Windows](../qa/VALIDACAO_FASE_01E_A.md)

## Condições de retomada

Retomar somente em laboratório Windows autorizado, com hipervisor operacional e permissões verificadas, imagem Windows x64 licenciada e identificada por SHA-256, MSVC offline fixado, capacidade reservada e endpoints controlados para os ensaios. Aplicar o [contrato de laboratório](RELATORIO_FASE_01E_A.md#spike-de-vm--contrato-de-laboratório).

A qualificação exige evidência real de build e execução do PE no destino, rede e canais de integração controlados, falha de escrita no limite dos discos, entrada imutável, coleta após desligamento com recusa de links, caminhos inválidos e saídas parciais, limites de CPU/RAM/tempo, recuperação e descarte após falha, e recusa de iniciar quando um controle estiver indisponível. Medir provisionamento, boot, build, coleta e pico de recursos. A 1E-B depende dos resultados e de nova aprovação.

Em computadores sem hipervisor, o Forge pode usar um host de build independente caso essa arquitetura seja aprovada. Essa opção depende de autenticação, transferência mediada, verificação de recibos e disponibilidade do host. A execução local exige compatibilidade de hardware e Windows, licenciamento, permissões e orçamento de recursos.

Continuam abertas a homologação integral Windows da 1D, durabilidade física sob falha de energia, corrida externa residual sem CAS, RustSec, instalação/desinstalação limpa e mensagem WebView2 no encerramento.
