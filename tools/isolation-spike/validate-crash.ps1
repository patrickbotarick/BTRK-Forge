$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../artifacts/phase01e-a')).Path
$info = [Diagnostics.ProcessStartInfo]::new((Join-Path $root 'spike.exe'), '--crash-test')
$info.UseShellExecute = $false
$info.CreateNoWindow = $true
$info.RedirectStandardOutput = $true
$spike = [Diagnostics.Process]::Start($info)
$runName = $null
$children = @()
try {
    $clock = [Diagnostics.Stopwatch]::StartNew()
    while ($clock.ElapsedMilliseconds -lt 10000 -and $children.Count -eq 0) {
        $read = $spike.StandardOutput.ReadLineAsync()
        if (!$read.Wait(10000 - [int]$clock.ElapsedMilliseconds) -or $null -eq $read.Result) {
            throw 'Host failed to report its live Job members'
        }
        $line = $read.Result
        $line
        if ($line -match "^crash-root=(run-$($spike.Id)-[0-9]+)$") {
            $runName = $Matches[1]
        }
        if ($line -match '^crash-children=([0-9]+(?:,[0-9]+)+)$') {
            $children = @($Matches[1].Split(',') | ForEach-Object { [Diagnostics.Process]::GetProcessById([int]$_) })
        }
    }
    if (!$runName -or $children.Count -lt 2) { throw 'Missing crash evidence' }
    foreach ($child in $children) { $null = $child.Handle }
    $spike.Kill()
    if (!$spike.WaitForExit(5000)) { throw 'Host did not exit' }
    foreach ($child in $children) {
        if (!$child.WaitForExit(5000)) { throw "Orphan detected: $($child.Id)" }
        "Job member exited after host death: $($child.Id)"
    }

    Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public static class SpikeProfile {
    [DllImport("userenv.dll", CharSet = CharSet.Unicode, ExactSpelling = true)]
    public static extern int DeleteAppContainerProfile(string name);
}
"@
    $profileResult = [SpikeProfile]::DeleteAppContainerProfile("$runName-BTRK")
    if ($profileResult -ne 0) { throw ('Profile recovery failed: 0x{0:X8}' -f $profileResult) }

    # Crash mode creates this exact tree without links. Delete only validated entries,
    # deepest first, and let nonrecursive directory deletion reject unknown contents.
    $run = Join-Path $root $runName
    $directories = @($run, "$run/stage", "$run/stage/out", "$run/outside")
    $files = @("$run/stage/input.txt", "$run/stage/spike.exe", "$run/outside/secret.txt",
               "$run/outside/write.txt", "$run/outside/credential.txt")
    foreach ($path in $directories + $files) {
        $item = Get-Item -LiteralPath $path -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Unexpected reparse point: $path" }
    }
    foreach ($path in $files) { [IO.File]::Delete($path) }
    for ($index = $directories.Count - 1; $index -ge 0; $index--) {
        [IO.Directory]::Delete($directories[$index], $false)
    }
    'Crash profile and known staging files recovered'
} finally {
    if (!$spike.HasExited) { $spike.Kill(); $null = $spike.WaitForExit(5000) }
    foreach ($child in $children) { $child.Dispose() }
    $spike.Dispose()
}
