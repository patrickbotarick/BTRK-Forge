Add-Type -AssemblyName System.Drawing
foreach ($relative in @('apps/studio/src-tauri/icons', 'tools/feasibility/windows/icons')) {
  $destination = Join-Path (Get-Location) $relative
  New-Item -ItemType Directory -Force -Path $destination | Out-Null
  $bitmap = [System.Drawing.Bitmap]::new(64, 64)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#111820'))
  $brush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#FF934F'))
  $graphics.FillRectangle($brush, 16, 12, 10, 40)
  $graphics.FillRectangle($brush, 16, 12, 34, 9)
  $graphics.FillRectangle($brush, 16, 29, 27, 8)
  $bitmap.Save((Join-Path $destination 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
  $icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
  $stream = [System.IO.File]::Create((Join-Path $destination 'icon.ico'))
  $icon.Save($stream)
  $stream.Dispose(); $icon.Dispose(); $graphics.Dispose(); $brush.Dispose(); $bitmap.Dispose()
}
