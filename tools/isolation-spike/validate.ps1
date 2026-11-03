$ErrorActionPreference = 'Stop'
$source = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/2022/BuildTools/VC/Tools/MSVC/14.44.35207/bin/Hostx64/x64'
$root = Join-Path $PSScriptRoot '../../artifacts/phase01e-a'
$destination = Join-Path $root 'msvc-pinned'
foreach ($line in Get-Content -LiteralPath (Join-Path $PSScriptRoot 'msvc-14.44.35207.sha256')) {
    $hash, $name = $line -split ' ', 2
    $inputFile = Join-Path $source $name
    if ((Get-FileHash -LiteralPath $inputFile).Hash -ne $hash) {
        throw "MSVC hash mismatch: $name"
    }
    $outputFile = Join-Path $destination $name
    New-Item -ItemType Directory -Force (Split-Path $outputFile) | Out-Null
    Copy-Item -LiteralPath $inputFile -Destination $outputFile
    if ((Get-FileHash -LiteralPath $outputFile).Hash -ne $hash) {
        throw "Staged MSVC hash mismatch: $name"
    }
}

$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 49177)
try {
    $listener.Start()
    $client = [Net.Sockets.TcpClient]::new()
    try {
        $elapsed = [Diagnostics.Stopwatch]::StartNew()
        $client.Connect('localhost', 49177)
        $accepted = $listener.AcceptTcpClient()
        $accepted.Dispose()
        "Host TCP localhost: connected, elapsed-ms=$($elapsed.ElapsedMilliseconds)"
    } finally { $client.Dispose() }
    & (Join-Path $root 'spike.exe')
    $result = $LASTEXITCODE
    $unexpected = $listener.Pending()
    "Additional server connection: $unexpected"
    "Matrix exit: $result"
    if ($unexpected) { exit 1 }
    exit $result
} finally { $listener.Stop() }
