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
