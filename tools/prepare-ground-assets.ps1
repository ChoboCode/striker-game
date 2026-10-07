param([string]$Manifest = "$PSScriptRoot\..\assets\ground\imagegen-v1.json")
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$project = [IO.Path]::GetFullPath("$PSScriptRoot\..")
$archiveDir = [IO.Path]::GetFullPath("$project\..\output\imagegen\ground-v1")
[IO.Directory]::CreateDirectory($archiveDir) | Out-Null
$items = Get-Content -Encoding UTF8 -LiteralPath $Manifest | ConvertFrom-Json
foreach ($item in $items) {
  $destination = Join-Path "$project\assets\ground" $item.file
  Copy-Item -LiteralPath $item.source -Destination (Join-Path $archiveDir ($item.key + '-source.png'))
  $original = [Drawing.Image]::FromFile($item.source)
  $height = [int][Math]::Round($item.width * $original.Height / $original.Width)
  $bitmap = New-Object Drawing.Bitmap($item.width, $height, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([Drawing.Color]::Transparent)
    $graphics.DrawImage($original, 0, 0, $bitmap.Width, $bitmap.Height)
    $bitmap.Save($destination, [Drawing.Imaging.ImageFormat]::Png)
    Write-Output "$($item.file): $($bitmap.Width)x$($bitmap.Height)"
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
    $original.Dispose()
  }
}
