# Fase 1G-B3-B2 — Supervisor experimental Windows

**Decisão: NO-GO para publicação segura de assets e integração da 1G-B3-B.**

O supervisor está restrito à [suíte do spike](../../tools/image-decoder-spike/tests/windows_job.rs). Usa windows-sys 0.61.2, sem integração com o Studio. O caminho do decoder é definido pelo Cargo e o SHA-256 é comparado ao binário incorporado ao teste. A comparação seguida de abertura pelo caminho ainda admite substituição concorrente. O processo é iniciado diretamente, com ambiente limpo, dois pipes e stderr descartado. O teste não audita todos os handles herdados.

CreateJobObjectW e SetInformationJobObject configuram um processo ativo, limite de memória comprometida de 192 MiB para o Job e encerramento ao fechar o último handle. A atribuição é conferida antes de enviar o quadro. O código de inicialização do auxiliar roda antes da atribuição, pois o lançamento ainda não é suspenso. Em falha de atribuição, o supervisor tenta encerrar e aguardar o auxiliar. A prova aceita apenas as fixtures sintéticas do próprio teste.

O orçamento inicial considera até 8 MiB de entrada, até cerca de 61 MiB de raster RGBA16 antes da conversão, cerca de 31 MiB em RGBA8, até 8 MiB de saída e o restante para intermediários, codec, encoder e processo. O orçamento é hipótese de trabalho. QueryInformationJobObject informa o pico de memória comprometida, e o ensaio ainda não induz alocação acima do limite. [Limites do Windows Job Object](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information)

O slot estático vale em todo o processo de teste. A leitura e a escrita de pipes ocorrem em threads separadas. O supervisor limita o quadro recebido e a resposta, lê um byte adicional para detectar excesso e exige tamanho exato. A espera monitora o prazo e, ao expirar, fecha o Job e espera a saída do processo. O prazo cobre o fluxo ensaiado, mas operações síncronas de preparação e de criação de processo não têm cancelamento próprio.

## Fronteira de arquivos

O Job Object não restringe acesso ao filesystem. O experimento ainda roda com o token ambiente, sem sonda ativa de criação, sobrescrita, renomeação, exclusão ou acesso por link. Nenhum projeto real foi usado. Na branch da 1E-A, o spike usa AppContainer e lançamento suspenso. Isso é referência de implementação e suas evidências pertencem ao outro experimento.

O próximo incremento deve testar lançamento suspenso com lista explícita de handles e token restrito ou AppContainer, usando ACLs mínimas para carregar o binário. Token restrito exige verificar os direitos efetivos em conjunto com ACLs. AppContainer exige conferir capacidades e acessos já concedidos a aplicativos. ACLs isoladas em um diretório de teste não demonstram ausência de acesso a outros caminhos. Se a fronteira local não puder ser qualificada, a alternativa é repetir a prova em VM descartável. A matriz de canários deve rodar sob a mesma política do decoder e validar o conteúdo e a identidade dos alvos após cada ataque.

A [validação](../qa/VALIDACAO_FASE_01G_B3_B2.md) registra os resultados e gates. O resolver somente leitura e o schema v4 permanecem preservados. Importação, publicação, integração com Studio e 1G-B3-C continuam fora da entrega.
