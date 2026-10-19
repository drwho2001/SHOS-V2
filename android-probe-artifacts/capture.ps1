param([string]$Name = "shot")

$adb = "C:\Users\kanem\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$serial = "100.65.57.110:41159"
$dir = "C:\Users\kanem\SHOS-V2\android-probe-artifacts"
$remote = "/sdcard/$Name.png"
$full = Join-Path $dir "$Name.png"
$small = Join-Path $dir "$Name-small.png"

# Capture on-device then pull. Never `> file` from adb exec-out: Windows PowerShell
# 5.1 redirects through the text encoder and corrupts binary bytes.
& $adb -s $serial shell screencap -p $remote | Out-Null
& $adb -s $serial pull $remote $full 2>$null | Out-Null

Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($full)
$w = 460
$h = [int]($img.Height * $w / $img.Width)
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img, 0, 0, $w, $h)
$bmp.Save($small, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $img.Dispose()

"$Name  $($img.Width)x$($img.Height) -> ${w}x${h}"