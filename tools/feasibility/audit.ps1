$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force -Path artifacts | Out-Null
$audit = [ordered]@{
  os = [System.Runtime.InteropServices.RuntimeInformation]::OSDescription
  architecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
  node = (node --version)
  npm = (npm --version)
  rust = (rustc --version)
  cargo = (cargo --version)
  git = (git --version)
  toolchain = (rustup show active-toolchain)
  webview2 = @(Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\*' -ErrorAction SilentlyContinue | Where-Object { $_.name -like '*WebView2*' } | Select-Object name,pv)
  cpp = (& 'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe' -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationVersion)
}
$audit | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 artifacts/environment.json
$audit | ConvertTo-Json -Depth 5
