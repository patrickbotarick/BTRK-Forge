# Fase 1E — proposta de infraestrutura segura de build

## Escopo mínimo e fronteira de confiança

Entregar um broker Rust no host Tauri do Studio para compilar um artefato de prova com template próprio, insumos declarativos validados e toolchain fixada. A prova exercita preparação, compilação e coleta. A exportação de projetos reais pertence à 1F. Scripts de projeto, plugins, comandos de shell, hooks de dependências e código de terceiros ficam fora do contrato da 1E. O harness atual e o Worker do Preview continuam com seus papéis existentes.

## Arquitetura proposta

1. **IPC tipado.** Iniciar, consultar e cancelar por ID opaco vinculado à sessão. O Studio envia o tipo de tarefa e a revisão do documento. Rust autoriza o workspace, valida o snapshot e resolve executável absoluto, argumentos fixos, versões e hashes por catálogo interno. A API não aceita comando, caminho de executável, diretório de trabalho ou variáveis de ambiente fornecidos pelo projeto.
2. **Preparação.** Criar uma raiz exclusiva por tarefa, com entrada somente leitura, temporários e saída dedicada. Copiar somente entradas permitidas. Rejeitar traversal, caminhos absolutos, junctions, symlinks e hard links na fronteira de importação e coleta. Usar diretórios sob controle do broker e validação por handle quando necessário para reduzir corridas de substituição. Toolchain e dependências provisionadas antes da execução, por manifestos fixados.
3. **Execução Windows.** Validar em spike um perfil AppContainer ou isolamento equivalente, com acesso apenas à toolchain de leitura e aos diretórios concedidos, rede fechada e ambiente sem credenciais. Job Object limita memória do grupo e encerra a árvore. Criar o processo suspenso, associá-lo ao Job sem breakaway e retomar somente após configurar as restrições. Bloquear a tarefa se o ambiente não permitir aplicar o perfil. Job Objects gerenciam recursos e ciclo de vida. A contenção de arquivos e rede exige a fronteira de segurança separada.
4. **Orçamento inicial para a prova.** Um build ativo, 120 s de tempo de parede, 1 GiB de memória do grupo, 2 MiB de logs e 512 MiB de área de trabalho. Valores propostos para medir no spike. Aplicar a quota de armazenamento de forma verificável e drenar stdout/stderr mesmo depois do teto de retenção. Redigir caminhos sensíveis e nunca registrar ambiente ou credenciais.
5. **Ciclo de vida.** Estados em fila, executando e terminal, com falhas tipadas de preparação, execução, limite ou isolamento. Cancelamento idempotente, sujeito à autorização da sessão. Aguardar a árvore terminar antes de remover temporários. Limpar sobras identificadas após reiniciar. Validar artefatos regulares e tamanho, calcular SHA-256 e promover somente saídas completas para o destino autorizado.
6. **Studio.** Comando explícito de build controlado, status, logs limitados e cancelar. Associar progresso à revisão que disparou a tarefa. Exibir erros de isolamento e resultados sem afetar o documento, histórico ou Preview.

## Entregas e gates

| Etapa proposta | Entrega | Verificação exigida |
|---|---|---|
| A — Contrato e spike | Modelo de ameaças, catálogo e prova do perfil Windows com toolchain fixada. | Em usuário padrão, leitura de arquivos externos, acesso a credenciais e rede negados. Com perfil indisponível, tarefa recusada. |
| B — Broker e runner | IPC autorizado, staging, quotas, logs, cancelamento, limpeza e recibos de artefato. | Testes Rust e adversariais reais para injeção em argumentos/ambiente, path traversal, reparse points, tentativa de sair do Job, concorrência, memória, disco, timeout, flood de saída e falha parcial. Validar ausência de descendentes depois de cancelamento e encerramento do host. |
| C — Integração e homologação | Controle do build no Studio, roteiro Windows, logs e matriz de evidência. | Usuário executa a tarefa de prova, cancela outra, recebe diagnóstico de falha e verifica hash do artefato. Testar duas sessões, acesso cruzado recusado e recuperação após reiniciar. |

Para aprovar a 1E, exigir sucesso do build de prova em ambiente limpo e offline, limites exercitados sob carga, ausência de escrita fora das concessões, falha fechada, logs contidos e nenhum artefato promovido em erro ou cancelamento. Registrar limitações da fronteira e versões suportadas. Se a toolchain não funcionar sob o isolamento, retornar com evidências e proposta de revisão antes de liberar o build. A homologação Windows da 1D segue como pendência independente e deve estar concluída para o aceite da v1.0.

**Estado.** Proposta para aprovação. Implementação não iniciada.

## Revisão após a validação decisiva da 1E-A

A arquitetura candidata para a próxima validação passa a ser **VM Windows descartável**. O desenho AppContainer das seções anteriores fica como registro da proposta inicial e das evidências já obtidas. O broker da 1E-B permanece em **NO-GO**. [Decisão e comparação](RELATORIO_FASE_01E_A.md#validação-decisiva--arquitetura-recomendada)

A prova anterior deve ser reproduzida dentro de uma VM preparada offline com MSVC pinado, sem adaptador de rede, com discos de capacidade limitada e sem compartilhamentos de diretórios. O host medeia entrada e coleta, valida identidade e hash do artefato após desligamento e registra o inventário descartável para recuperação. Verificar limites de vCPU, memória, tempo e disco sob carga, ausência de rede com endpoints controlados, segurança da coleta, compatibilidade do PE no destino e falha fechada diante de configuração inválida. O modelo de IPC e a integração do Studio continuam propostas para revisão posterior.
