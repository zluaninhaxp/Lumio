# Preserve the upstream artwork and reduce its zoom by six percent.
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$source = [System.Drawing.Image]::FromFile((Join-Path $root 'assets/lumio-app-icon.png'))
$bitmap = [System.Drawing.Bitmap]::new($source.Width, $source.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#00A878'))
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $size = [int]($source.Width * 0.94)
  $offset = [int](($source.Width - $size) / 2)
  $attributes = [System.Drawing.Imaging.ImageAttributes]::new()
  $attributes.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
  $graphics.DrawImage($source, [System.Drawing.Rectangle]::new($offset, $offset, $size, $size), 0, 0, $source.Width, $source.Height, [System.Drawing.GraphicsUnit]::Pixel, $attributes)
  $attributes.Dispose()
  # Extend the nearest green edge pixels into the added margin to avoid a flat-color seam.
  for ($y = 0; $y -lt $bitmap.Height; $y++) {
    for ($x = 0; $x -lt $bitmap.Width; $x++) {
      if ($x -lt $offset -or $x -ge $offset + $size -or $y -lt $offset -or $y -ge $offset + $size) {
        $edgeX = [Math]::Max($offset, [Math]::Min($offset + $size - 1, $x))
        $edgeY = [Math]::Max($offset, [Math]::Min($offset + $size - 1, $y))
        $bitmap.SetPixel($x, $y, $bitmap.GetPixel($edgeX, $edgeY))
      }
    }
  }
  $bitmap.Save((Join-Path $root 'assets/lumio-app-icon-padded.png'), [System.Drawing.Imaging.ImageFormat]::Png)
} finally { $graphics.Dispose(); $bitmap.Dispose(); $source.Dispose() }
