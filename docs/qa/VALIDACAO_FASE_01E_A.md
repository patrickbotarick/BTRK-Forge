# Validação Windows — Fase 1E-A

Executado em 03/11/2026, Windows build 26300, MSVC Build Tools 17.14.41 x64. A execução com endpoint de controle reportou papel administrativo inativo. O listener local aceitou conexão do host. A matriz final retornou código 1, pois o grupo de sondas exigia negação explícita em todos os casos.

| Cenário | Resultado observado |
|---|---|
| Compilar o spike | MSVC com /W4 e /WX aprovado. |
| Build de recurso permitido | Processo AppContainer exit 0. A saída de 11 bytes correspondeu ao formato e conteúdo esperados. |
| Leitura e escrita externas | Três acessos a arquivos sintéticos fora do staging negados com Win32 5, incluindo leitura do canário de credencial. |
| Ambiente | Canário do host e USERPROFILE ausentes no processo filho. Cofres, registro e credenciais reais ficaram fora da prova. |
| TCP loopback | Ensaio inicial sem listener retornou 10013. Com listener acessível ao host, a sonda final expirou com 10060. Nenhuma conexão foi observada no prazo, porém a negação com endpoint ativo e o bloqueio de rede geral continuam inconclusivos. |
| Symlink | Fixture indisponível e sonda com Win32 3. Junctions, hard links e corridas ficam pendentes. |
| Memória | Job limitado a 96 MiB. A alocação comprometida de 256 MiB falhou e o processo saiu com 0. |
| Saída | 2.000.000 bytes drenados e 4.096 retidos. |
| Tempo | Tarefa bloqueada interrompida no timeout de 250 ms, com saída 42 e Job vazio. |
| Cancelamento | Descendente observado pelo contador do Job. Cancelamento interno encerrou o pai com 42 e o Job reportou zero processos ativos. |
| Falha fechada | SID ausente recusado no preflight. Invocação direta de um modo filho fora do AppContainer recusada com código 1. Em ensaio inicial com ambiente mínimo sem LOCALAPPDATA, a criação suspensa retornou Win32 203 e abortou a execução. |
| CPU, disco, saída inesperada e recuperação após crash | Pendentes. |

## Reprodução

Em Developer Command Prompt x64 do MSVC, a partir da raiz do repositório:

```bat
mkdir artifacts\phase01e-a
cl /nologo /std:c++17 /EHsc /W4 /WX /MT /utf-8 /Fo:artifacts\phase01e-a\spike.obj /Fe:artifacts\phase01e-a\spike.exe tools\isolation-spike\main.cpp /link userenv.lib advapi32.lib ws2_32.lib
```

Para a sonda controlada, usar PowerShell com usuário padrão. O listener serve apenas localhost e é encerrado ao sair.

```powershell
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 49177)
try {
    $listener.Start()
    $client = [Net.Sockets.TcpClient]::new()
    try {
        $client.Connect([Net.IPAddress]::Loopback, 49177)
        $accepted = $listener.AcceptTcpClient()
        $accepted.Dispose()
        "Host loopback baseline: $($client.Connected)"
    } finally { $client.Dispose() }
    & .\artifacts\phase01e-a\spike.exe
    "Conexão adicional pendente: $($listener.Pending())"
} finally { $listener.Stop() }
```

Logs locais em artifacts/phase01e-a. O spike é independente do Studio. A validação acima não é homologação da 1D e não inclui reexecução da suíte histórica.

## Segunda rodada

Executada no Windows build 26300 com papel de administrador inativo. O spike compilou com /W4 e /WX. A matriz principal terminou com código 1. O roteiro separado de encerramento abrupto e recuperação terminou com código 0.

| Cenário | Classificação e evidência nova |
|---|---|
| Rede de controle | **Permitido.** O host conectou a localhost:49177 e o servidor aceitou a conexão em 2.033 ms. |
| Rede no AppContainer | **Inconclusivo.** localhost resolveu com código 0. A conexão IPv4 retornou 10060 após 1.016 ms e o servidor não observou nova conexão. O timeout não comprova bloqueio. Sem segundo endpoint controlado disponível, TCP fora de loopback e DNS externo ficaram sem teste. |
| Acesso externo e traversal | **Bloqueado.** Leitura, escrita e leitura do canário de credencial por caminhos relativos fora do staging negadas com Win32 5. Escrita no insumo concedido para leitura também negada com Win32 5. |
| Junction e hard link | **Bloqueado.** Fixtures reais criadas. A inspeção por handle detectou o reparse point e a identidade NTFS comum entre o canário e o hard link. A sonda confinada recebeu Win32 5 nas quatro tentativas de leitura e escrita. |
| Symlink | **Inconclusivo.** Fixture indisponível com usuário padrão. A sonda retornou Win32 3. |
| Troca concorrente | **Bloqueada no cenário ensaiado.** A thread concorrente recebeu Win32 32 ao tentar renomear o insumo aberto sem compartilhamento de exclusão. Volume e índice do arquivo por handle permaneceram iguais. Isso não cobre trocas pré-abertura nem todos os ancestrais. |
| CPU | **Aprovado no ensaio.** Para a mesma carga de 1,5 s, o Job contabilizou 1.500 ms sem cap e 234 ms com hard cap de 1% da capacidade agregada. |
| Disco | **Pendente.** Nenhum volume de teste com quota de escrita foi provisionado. O tamanho do PE não é evidência de quota. |
| Memória, tempo, logs e cancelamento | **Aprovados novamente.** Alocação de 256 MiB recusada com Job limitado a 96 MiB. Timeout de 250 ms e cancelamento deixaram zero processos ativos no Job. Drenados 2.000.000 bytes, retidos 4.096. |
| Morte do host e recuperação | **Aprovados no cenário sintético.** O roteiro capturou handles de quatro membros vivos antes de matar exclusivamente o host do spike. Os quatro terminaram em até 5 s após a morte. O perfil e a árvore conhecida foram removidos com exclusão não recursiva e verificação de reparse. As execuções normais retêm artefatos sintéticos para inspeção. |
| Falha fechada | **Aprovada.** O host recusou iniciar a tarefa com SID ausente. |

### Build MSVC real

Toolchain MSVC Build Tools 17.14.41, árvore 14.44.35207 x64, provisionada da instalação local em Program Files (x86)/Microsoft Visual Studio/2022/BuildTools/VC/Tools/MSVC/14.44.35207/bin/Hostx64/x64. O [manifesto SHA-256](../../tools/isolation-spike/msvc-14.44.35207.sha256) fixa os binários, DLLs e recursos de idioma utilizados. O roteiro valida origem e cópia, e o host copia a lista fixa do staging confiável. O sistema operacional fornece as DLLs de sistema. O ambiente explícito contém SystemRoot, LOCALAPPDATA exigido pelo lançamento, PATH restrito à toolchain, TEMP/TMP na saída e um marcador do spike. A tarefa usa somente C fixo do host, sem includes, CRT no artefato, bibliotecas de projeto, downloads ou scripts. Os processos de compilação e link usam o mesmo perfil AppContainer sem capacidades e recebem Jobs próprios.

Os erros iniciais C1510 e C1356 foram resolvidos provisionando o recurso de idioma e as dependências transitivas do PDB. O C1056 foi resolvido com herança do SID restrita à saída, permitindo reabrir o objeto criado sem conceder escrita na entrada ou fora do staging. Resultado final: compilador e linker saíram com 0, a coleta verificou um PE x64 de console e o PE executado dentro do isolamento retornou 42. SHA-256 observado: E9F54D18B52299C71E813A325524631EA1E6B5C22A34BE2E38B522518489A4C4. Isso demonstra um build nativo mínimo offline, com a cadeia de exportação completa e o bloqueio de rede ainda pendentes.

### Repetição

Compilar com o comando MSVC da primeira rodada. Depois rodar, em PowerShell, na raiz do repositório:

```powershell
& ./tools/isolation-spike/validate.ps1
& ./tools/isolation-spike/validate-crash.ps1
```

Os logs locais são artifacts/phase01e-a/round2.log e artifacts/phase01e-a/round2-crash.log. Nenhum componente do Studio mudou e a suíte do Studio não foi repetida.

## Validação decisiva

O spike foi recompilado com MSVC /W4 /WX e executado somente no modo --pending-file-tests. Nenhuma prova já aprovada foi repetida. O token Windows normal reportou papel administrativo inativo. A matriz nova retornou código 1.

| Sonda | Resultado observado no token normal |
|---|---|
| Troca antes da abertura | A substituição foi realizada e a comparação com a identidade esperada detectou a divergência. O ensaio demonstra detecção com identidade previamente capturada, sem resolver a obtenção confiável dessa identidade em um namespace hostil. |
| Troca de ancestral durante preparação | Renomear o diretório stage enquanto os handles estavam abertos foi recusado com Win32 5. O ensaio cobre o ancestral sintético pinado. |
| Substituição durante coleta | A renomeação do artefato aberto foi recusada com Win32 32. |
| Hard link concorrente | **Falha do controle preventivo.** A thread criou o hard link mesmo com o handle aberto. A segunda inspeção detectou duas ligações com a mesma identidade. Ainda existe uma janela depois da inspeção. |
| Symlink real | **Inconclusivo.** O Windows retornou 1314, privilégio necessário ausente. |
| Loopback | Evidência anterior preservada. Controle positivo aceito pelo servidor em 2.033 ms. AppContainer expirou com 10060 em 1.016 ms e o servidor observou zero conexões adicionais. Sem evento de negação atribuído à política. |
| Segundo endpoint | **Inconclusivo.** Não havia endpoint não loopback sob controle disponível. Nenhum serviço externo foi utilizado. |
| WFP | Sessão local aberta com código 0 por FwpmEngineOpen0. FwpmTransactionBegin0, em modo de escrita, devolveu 5. Nenhum filtro foi instalado, portanto aplicação pré-resume, auditoria do bloqueio e falha fechada da política continuam sem demonstração. |
| Volume e quota | **Pendente.** Nenhum volume descartável disponível para o ensaio. New-VHD, New-VM e serviço vmms indisponíveis na consulta. Nenhum volume foi alterado. TEMP/TMP e saída no staging cobrem apenas os caminhos escolhidos pela tarefa. Armazenamento do perfil AppContainer e outros destinos com ACL permissiva precisam ser inventariados e contidos. Crescimento adversarial, falta de espaço e recuperação do volume ficaram sem teste. |
| VM Windows | **Não executada.** Avaliação arquitetural no relatório. |

Para repetir os casos novos de arquivo, recompilar conforme o comando da primeira rodada e executar:

```powershell
& ./artifacts/phase01e-a/spike.exe --pending-file-tests
```

Logs locais em artifacts/phase01e-a/decisive-files-standard.log e artifacts/phase01e-a/decisive-files-low.log. O token de execução restrito negou também o hard link com código 5. A decisão usa o resultado com o token normal, que permitiu a criação.

## Spike de VM Windows

### Pré-requisitos efetivamente verificados

| Item | Resultado |
|---|---|
| SO e CPU | Windows 11 Pro build 26300, Intel Core i5-12400F, 12 processadores lógicos. |
| Firmware e virtualização | HypervisorPresent=True. systeminfo detectou hipervisor e integridade de código imposta por hipervisor em execução. Os campos CIM de firmware, monitor e SLAT retornaram False e systeminfo omitiu esses requisitos individuais. O estado de cada capacidade de firmware permanece inconclusivo nesta configuração. |
| Gestão de VM | Nenhum serviço vmms ou vmcompute visível na consulta. Get-VM, New-VM e New-VHD indisponíveis, assim como VBoxManage, vmrun e qemu-system-x86_64 no PATH. |
| Privilégios | Papel administrativo inativo na sessão de diagnóstico. Delegação para operação de hipervisor sem comprovação. |
| Capacidade do host | 31,84 GiB de RAM visível, 16,74 GiB livre na amostra e 485,3 GiB livres em C:. Valores instantâneos, sem reserva para VM. |
| Imagem Windows | Nenhuma imagem ISO, VHD/VHDX, WIM ou VMDK identificada na busca do workspace. Imagem de laboratório licenciada e autorizada ainda necessária. |
| Toolchain | 16 de 16 arquivos da instalação local MSVC 14.44.35207 conferiram com o manifesto SHA-256. A verificação foi no host. |

### Matriz reservada ao laboratório

| Prova | Evidência exigida | Resultado desta execução |
|---|---|---|
| Build offline e destino | MSVC pinado em VM, compilação e link com código 0, PE x64 e SHA-256, execução no Windows de destino com retorno 42. | Bloqueada por infraestrutura e imagem. |
| Rede, canais e host | Inventário pré-boot e sondas contra endpoints controlados, canário do host e canais de integração, com controles positivos externos e evidência da barreira. | Não executada. |
| Capacidade | Crescimento adversarial até falha real de escrita nos discos virtuais, com medição da ocupação do host e verificação das demais superfícies. | Não executada. |
| Limites e interrupções | Registrar CPU, RAM e timeout sob carga, desligamento forçado durante build e recuperação após morte do controlador. | Não executada. |
| Coleta | Aceitar somente PE esperado após desligamento. Recusar links, caminhos inválidos, arquivos inesperados, substituição e saída parcial, com falha fechada diante de controle ausente. | Não executada. |
| Custo | Medir provisionamento, boot, build, desligamento e coleta separadamente, com pico de RAM, disco e impacto no host. | Não medido. |

Nenhuma VM, disco ou mídia de laboratório foi criada. O diagnóstico não alterou recursos do Windows, firmware, políticas ou hipervisor. A suíte do Studio e as provas anteriores do AppContainer não foram repetidas. A homologação integral Windows da 1D e as cinco ressalvas históricas permanecem abertas.
