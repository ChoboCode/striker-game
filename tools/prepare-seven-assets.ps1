param([string]$Manifest = "$PSScriptRoot\..\assets\seven-stage-imagegen-v1.json")
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$project = [IO.Path]::GetFullPath("$PSScriptRoot\..")
$sourceDir = [IO.Path]::GetFullPath("$project\..\output\imagegen\seven-stage-v1")
[IO.Directory]::CreateDirectory($sourceDir) | Out-Null
$items = Get-Content -Encoding UTF8 -LiteralPath $Manifest | ConvertFrom-Json
foreach ($item in $items) {
  $destination = Join-Path "$project\assets" $item.file
  $archive = Join-Path $sourceDir ($item.key + '-source.png')
  Copy-Item -LiteralPath $item.source -Destination $archive
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
    $format = if ($item.file.EndsWith('.jpg')) { [Drawing.Imaging.ImageFormat]::Jpeg } else { [Drawing.Imaging.ImageFormat]::Png }
    $bitmap.Save($destination, $format)
    Write-Output "$($item.file): $($bitmap.Width)x$($bitmap.Height)"
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
    $original.Dispose()
  }
}
