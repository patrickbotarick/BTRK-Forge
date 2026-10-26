# Segurança e contratos de evolução

## Fronteiras de confiança

| Origem | Confiança e tratamento |
|---|---|
| Modelo importado / IA | Não confiável: JSON limitado, schema estrito, validação semântica, nenhuma expressão executável |
| Editor visual | Adaptador; alterações entram no modelo próprio; conexão passa pelo contrato de portas |
| Preview | Origem opaca, CSP restritiva, sem bridge nativa ou armazenamento do Studio |
| Host Tauri | Sem comandos de aplicação registrados e sem plugins de shell, arquivos, HTTP ou updater; capabilities vazias |
| Worker | Interpretador limitado e watchdog; não aceita código livre |
| Helper experimental | Binário/operação fixos com IPC; não é sandbox de SO para código hostil |
| Dependências de build | Código confiado no desenvolvimento; npm/Cargo executam ferramentas locais; não são conteúdo fornecido pelo projeto |

O Studio não deve carregar HTML remoto na janela privilegiada. A PoC não oferece APIs de rede, leitura de caminhos arbitrários ou instalação de pacotes solicitados por projetos. A política CSP permite apenas tráfego local do próprio host/IPC; preview não tem connect-src. Um comprometimento do próprio frontend/bibliotecas ainda exige análise; ausência de comandos não é auditoria de segurança completa do Tauri.

## Arquivos e processos futuros

Selecionar uma pasta concede acesso apenas ao workspace canônico. Broker deverá validar caminhos normalizados, traversal, junctions, symlinks e destino final no momento da abertura; acesso a arquivos pessoais dependerá de concessão explícita e escopo mínimo. IPC terá mensagens versionadas, IDs de solicitação, validação em ambas as pontas, limite de bytes, timeout/cancelamento, logs sem segredos e tratamento de processos órfãos. Shell não será API pública.

## SDK de nodes e plugins

Versão inicial proposta `1.0.0`, tipos em namespace `vendor/node`, schema de configuração, portas declarativas, versões suportadas de modelo, plataformas, permissões e migrações próprias. Nodes puros portáveis são separados de nodes com capacidades nativas. Build web deve recusar dependências Windows sem fallback explícito. SemVer major para alterações de contrato, matriz de compatibilidade registrada no projeto e dependências com digest/lock.

Código de terceiros não será importado no contexto privilegiado do Studio. UI de plugin e execução devem ficar em processos/origens isolados, com broker de capacidades. Assinatura não prova segurança: exigir confiança do publicador, revisão e confirmação dos escopos. Marketplace e execução dinâmica permanecem ausentes. Rollback deve restaurar versão bloqueada do plugin e snapshot do projeto, sem reverter schema de forma silenciosa.

## IA configurável e offline

`AIProvider` define provedor, sinal de cancelamento e proposta estruturada `unknown`; `credentialHandle` é referência opaca, nunca segredo. O desenho recomendado usa Windows Credential Manager no host. Nenhum adaptador ou armazenamento de credenciais foi implementado. Endpoints configuráveis precisam bloquear destinos locais/metadata não autorizados e validar HTTPS, redirects e tamanho/tempo de resposta. Provedor remoto só recebe conteúdo após consentimento para o escopo específico.

Proposta não é aplicada diretamente: schema→validação semântica→checagem de capacidades→diff por ID/caminho→aprovação humana→snapshot→aplicação atômica. Digest da base impede aplicar sobre projeto alterado. Reversão restaura snapshot validado. Texto de IA, comentários e documentos são dados, sem autoridade para executar comandos ou conceder permissões. Credenciais nunca entram no JSON/exportação/log. A PoC funciona inteiramente sem provedor e sem internet após preparar dependências.

## Atualizações independentes

Studio e cada aplicativo têm IDs, versões SemVer, feeds e chaves independentes. Canal stable/beta selecionado explicitamente; mudança de canal não implica downgrade automático. Manifesto inclui plataforma, versão mínima de esquema, digest e assinatura. Host verifica assinatura com chave pública fixada, produto, plataforma, tamanho e digest antes de executar pacote. HTTPS sozinho não basta. Contrato `UpdateManifest` não implementa verificação; updater está desativado.

Studio usa diretório de dados separado do binário. Atualização não apaga projetos; backup/migração ocorre em cópia transacional e com teste de recuperação. Guardar última versão utilizável e snapshot compatível para rollback; impedir downgrade de dados incompatíveis. Assinatura do feed (por exemplo updater Tauri) e assinatura Authenticode do instalador são mecanismos distintos. Rotação/revogação de chaves exige procedimento e testes antes de disponibilizar atualizações. Não foram criados feed, serviço, chave ou publicação nesta fase.
