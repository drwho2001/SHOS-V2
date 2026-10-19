param(
  [string]$Src,
  [string]$Name,
  [int]$X, [int]$Y, [int]$W, [int]$H,
  [double]$Scale = 2.0
)

Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($Src)
$r = New-Object System.Drawing.Rectangle($X, $Y, $W, $H)
$crop = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($crop)
$g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $W, $H)), $r, [System.Drawing.GraphicsUnit]::Pixel)
$ow = [int]($W * $Scale); $oh = [int]($H * $Scale)
$b = New-Object System.Drawing.Bitmap($ow, $oh)
$g2 = [System.Drawing.Graphics]::FromImage($b)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.DrawImage($crop, 0, 0, $ow, $oh)
$out = Join-Path (Split-Path $Src) "$Name.png"
$b.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $g2.Dispose(); $crop.Dispose(); $b.Dispose(); $img.Dispose()
"saved $Name.png ${ow}x${oh} $((Get-Item $out).Length) bytes"