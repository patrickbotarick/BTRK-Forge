# Plano de laboratório Windows — Fase 1G-B3-B

## Pré-requisitos de retomada

- VM Windows x64 descartável com imagem licenciada, versão, build e SHA-256 da imagem base registrados. Restaurar snapshot limpo entre rodadas e registrar seu identificador.
- NTFS para workspace sintético e alvos externos ao workspace, todos dentro da VM. Usar canários descartáveis e preservar conteúdo, hash, identidade e ACL antes e depois. Registrar privilégios necessários para symlinks e outros links. Falha de preparação é inconclusiva.
- Conta de execução sem privilégios administrativos. Registrar separadamente as permissões de preparação, o token efetivo do auxiliar, SID, capacidades e ACLs de leitura, execução e escrita. Preparar o diretório do binário de modo que o auxiliar e a conta de execução não possam substituí-lo.
- Fixar versões de Rust, Cargo, alvo, MSVC e SDK. Registrar Cargo.lock, hashes dos executáveis e das fixtures e perfil de compilação. Provisionar dependências antes do teste offline.
- Rede desabilitada por padrão, sem compartilhamento de pastas ou redirecionamento de discos do host. Registrar adaptadores, regras e exceções efetivas caso o ambiente exija uma rede controlada.
- Coletar log de eventos por rodada com horário, PID, pai, identidade e token, handles, configuração e pico do Job, memória, códigos Win32 e de saída, timeout e hashes. Preservar os dados brutos fora da VM pelo fluxo de coleta autorizado.

## Matriz futura

Os critérios abaixo são condições de GO por cenário. Falha, pré-condição ausente ou evidência insuficiente mantém NO-GO no gate correspondente. Executar canários com a mesma política do decoder.

| Cenário | Resultado esperado para GO | Evidência exigida |
| --- | --- | --- |
| Inicialização e identidade | Processo suspenso. Token restrito ou AppContainer e Job confirmados antes da retomada. Tentativa de troca do executável recusada ou execução vinculada à identidade já validada | Identidade de arquivo e hash, inspeção de token, ordem dos eventos e resultado da tentativa concorrente |
| Falha de configuração | Falhas injetadas de token e atribuição ao Job impedem retomada e recolhem o processo, sem fallback | Códigos das APIs, ausência de marcador de execução, espera e inventário de PIDs |
| Filesystem direto | Criação, sobrescrita, exclusão, renomeação e subdiretórios recusados no workspace sintético e fora dele. Executável e entrada permanecem intactos | Resultado e código Win32 por operação, inventário, identidade e hashes antes e depois |
| Filesystem indireto | Acesso de escrita via junction, symlink e hard link recusado ou incapaz de alterar alvo não autorizado | Tipo e identidade de cada link e alvo, tentativa real, código e estado antes e depois |
| Memória de controle | A sonda toca 200 MiB no controle de 256 MiB. Sob 192 MiB, alocação excedente falha e a divergência do pico é reconciliada com os contadores observados | Logs por bloco, código Win32, pico do Job, contadores do processo e saída em ambas as execuções |
| Memória no decoder | Excesso real no decoder falha de forma identificável, libera processo e Job e permite nova chamada válida | Evento de limite, saída ou erro, contadores, PID encerrado e hash da chamada seguinte |
| Handles | Só os pipes autorizados são utilizáveis. Um handle canário herdável permanece inacessível | Lista explícita, inventário ou sondagem no auxiliar e código da tentativa |
| Descendentes e supervisor | Descendente é impedido pela política. Timeout e morte abrupta do supervisor de teste deixam zero processos da tarefa | Tentativa real, árvore por PID, eventos do Job e verificação de ausência após prazo documentado |
| Prazo e bloqueios | Bloqueios em stdin e stdout encerram a tarefa automaticamente. Operação válida subsequente passa | Timestamps separados para startup, envio, decodificação, saída e total, motivo do encerramento e resultado da nova chamada |
| IPC inválido | Saída excessiva, pipe quebrado e resposta incompleta são recusados sem publicar bytes parciais ou reter o slot | Quantidade de bytes, status, códigos dos pipes, ausência de resultado aceito e nova chamada válida |

## Reprodução da evidência existente

Executar a partir da raiz do repositório em PowerShell. O comando de teste roda apenas as provas que já existem. O teste pai B3 seleciona a sonda filha sob Job. Não invocar a sonda diretamente fora desse teste.

```powershell
git status --short --branch
git rev-parse HEAD main
rustc -Vv
cargo -V
where.exe cl.exe
cargo build --locked --offline --manifest-path tools/image-decoder-spike/Cargo.toml
Get-FileHash -Algorithm SHA256 -LiteralPath tools/image-decoder-spike/target/debug/forge-image-decoder-spike.exe
Get-ChildItem tools/image-decoder-spike/tests/fixtures -File | Get-FileHash -Algorithm SHA256
cargo test --locked --offline --manifest-path tools/image-decoder-spike/Cargo.toml -- --nocapture --test-threads=1
```

Rodar a descoberta do MSVC no Developer PowerShell da toolchain provisionada. Se CARGO_TARGET_DIR estiver definido, usar o caminho de saída efetivo para os hashes. Registrar também o SHA-256 do executável de testes indicado na linha Running do Cargo. Salvar a saída completa e o código de saída por rodada. Comparar os resultados com as validações do [checkpoint](../phases/CHECKPOINT_FASE_01G_B3_B.md), sob o mesmo perfil, fixture e configuração de Job. Separar pico reportado, bytes tocados, tempo total e tempo de verificação no host. Comparar saídas de normalização pela verificação já exercitada nos testes, sem exigir hashes entre versões diferentes de codecs.

O protocolo de lançamento restrito, a instrumentação por etapa e a automação dos canários, descendentes, handles e falhas injetadas precisam ser implementados no laboratório. Esta matriz não representa testes executados.
