Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$bannerDir = Join-Path $root "assets\banners"
$logoPath = Join-Path $root "assets\rankd-bot.png"
$outputPath = Join-Path $bannerDir "rankd-welcome-banner-v2.png"

if (-not (Test-Path $bannerDir)) {
    New-Item -ItemType Directory -Path $bannerDir | Out-Null
}

$width = 960
$height = 540
$bitmap = [System.Drawing.Bitmap]::new($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

function New-Color([int]$a, [int]$r, [int]$g, [int]$b) {
    return [System.Drawing.Color]::FromArgb($a, $r, $g, $b)
}

function New-SolidBrush([System.Drawing.Color]$color) {
    return [System.Drawing.SolidBrush]::new($color)
}

function New-Pen([System.Drawing.Color]$color, [float]$width = 1) {
    return [System.Drawing.Pen]::new($color, $width)
}

function Draw-String($g, [string]$text, [System.Drawing.Font]$font, [System.Drawing.Brush]$brush, [float]$x, [float]$y, [float]$w, [float]$h, [string]$align = "Near") {
    $format = [System.Drawing.StringFormat]::new()
    $format.Alignment = [System.Drawing.StringAlignment]::$align
    $format.LineAlignment = [System.Drawing.StringAlignment]::Near
    $format.Trimming = [System.Drawing.StringTrimming]::Word
    $g.DrawString($text, $font, $brush, ([System.Drawing.RectangleF]::new($x, $y, $w, $h)), $format)
    $format.Dispose()
}

function Draw-SpacedString($g, [string]$text, [System.Drawing.Font]$font, [System.Drawing.Brush]$brush, [float]$x, [float]$y, [float]$spacing) {
    $currentX = $x
    foreach ($char in $text.ToCharArray()) {
        $letter = [string]$char
        $g.DrawString($letter, $font, $brush, $currentX, $y)
        $size = $g.MeasureString($letter, $font)
        $currentX += $size.Width + $spacing
    }
}

function Draw-DaggerTitle($g, [string]$text, [float]$x, [float]$y) {
    $family = [System.Drawing.FontFamily]::new("Impact")
    $format = [System.Drawing.StringFormat]::new()
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddString($text, $family, [int][System.Drawing.FontStyle]::Regular, 100, [System.Drawing.PointF]::new($x, $y), $format)

    $slant = [System.Drawing.Drawing2D.Matrix]::new()
    $slant.Shear(-0.11, 0)
    $path.Transform($slant)
    $slant.Dispose()

    $shadowMatrix = [System.Drawing.Drawing2D.Matrix]::new()
    $shadowMatrix.Translate(7, 8)
    $shadow = $path.Clone()
    $shadow.Transform($shadowMatrix)
    $shadowBrush = New-SolidBrush (New-Color 118 0 0 0)
    $g.FillPath($shadowBrush, $shadow)
    $shadowBrush.Dispose()
    $shadow.Dispose()
    $shadowMatrix.Dispose()

    $purplePen = New-Pen (New-Color 225 126 47 236) 8
    $blackPen = New-Pen (New-Color 235 4 4 6) 15
    $thinBlackPen = New-Pen (New-Color 235 4 4 6) 3
    $whiteBrush = New-SolidBrush (New-Color 255 248 248 252)
    $g.DrawPath($blackPen, $path)
    $g.DrawPath($purplePen, $path)
    $g.FillPath($whiteBrush, $path)

    $g.SetClip($path)
    $cutPen = New-Pen (New-Color 210 15 15 18) 9
    $highlightPen = New-Pen (New-Color 116 251 237 50) 3
    for ($i = 0; $i -lt 12; $i++) {
        $sx = $x - 86 + ($i * 48)
        $g.DrawLine($cutPen, $sx, $y + 2, $sx + 88, $y + 104)
        $g.DrawLine($highlightPen, $sx + 12, $y + 2, $sx + 100, $y + 104)
    }
    $g.ResetClip()

    $slashPen = New-Pen (New-Color 235 251 237 50) 3
    $g.DrawLine($slashPen, $x - 7, $y + 109, $x + 342, $y + 109)
    $g.DrawLine($purplePen, $x - 7, $y + 118, $x + 248, $y + 118)
    $g.DrawLine($thinBlackPen, $x - 6, $y + 126, $x + 292, $y + 126)

    $slashPen.Dispose()
    $highlightPen.Dispose()
    $cutPen.Dispose()
    $whiteBrush.Dispose()
    $thinBlackPen.Dispose()
    $blackPen.Dispose()
    $purplePen.Dispose()
    $path.Dispose()
    $format.Dispose()
    $family.Dispose()
}

function Convert-WhiteToTransparent([string]$path) {
    $source = [System.Drawing.Bitmap]::new($path)
    $trimmed = [System.Drawing.Bitmap]::new($source.Width, $source.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

    for ($y = 0; $y -lt $source.Height; $y++) {
        for ($x = 0; $x -lt $source.Width; $x++) {
            $pixel = $source.GetPixel($x, $y)
            if ($pixel.R -gt 238 -and $pixel.G -gt 238 -and $pixel.B -gt 238) {
                $trimmed.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, $pixel.R, $pixel.G, $pixel.B))
            }
            else {
                $trimmed.SetPixel($x, $y, $pixel)
            }
        }
    }

    $source.Dispose()
    return $trimmed
}

try {
    $bg = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        [System.Drawing.Rectangle]::new(0, 0, $width, $height),
        (New-Color 255 4 4 5),
        (New-Color 255 58 58 61),
        [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
    )
    $graphics.FillRectangle($bg, 0, 0, $width, $height)
    $bg.Dispose()

    $topSafe = New-SolidBrush (New-Color 145 0 0 0)
    $graphics.FillRectangle($topSafe, 0, 0, $width, 52)
    $topSafe.Dispose()

    $rand = [System.Random]::new(2605)
    for ($i = 0; $i -lt 96; $i++) {
        $smoke = New-SolidBrush (New-Color (10 + $rand.Next(26)) 205 205 212)
        $sx = -120 + $rand.Next($width + 190)
        $sy = 120 + $rand.Next(330)
        $sw = 90 + $rand.Next(280)
        $sh = 22 + $rand.Next(86)
        $graphics.FillEllipse($smoke, $sx, $sy, $sw, $sh)
        $smoke.Dispose()
    }

    $spotPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $spotPath.AddEllipse(130, 40, 700, 460)
    $spot = [System.Drawing.Drawing2D.PathGradientBrush]::new($spotPath)
    $spot.CenterColor = New-Color 74 188 188 196
    $spot.SurroundColors = @((New-Color 0 188 188 196))
    $graphics.FillPath($spot, $spotPath)
    $spot.Dispose()
    $spotPath.Dispose()

    $purple = New-Color 255 126 47 236
    $yellow = New-Color 255 251 237 50
    $white = New-Color 255 246 246 250
    $muted = New-Color 255 186 187 194
    $purpleBrush = New-SolidBrush $purple
    $yellowBrush = New-SolidBrush $yellow
    $whiteBrush = New-SolidBrush $white
    $mutedBrush = New-SolidBrush $muted

    $trophyBrush = New-SolidBrush (New-Color 54 245 245 248)
    $trophyPen = New-Pen (New-Color 78 245 245 248) 4
    $graphics.FillRectangle($trophyBrush, 448, 158, 86, 156)
    $graphics.FillEllipse($trophyBrush, 393, 100, 196, 124)
    $graphics.FillRectangle($trophyBrush, 423, 321, 136, 28)
    $graphics.FillRectangle($trophyBrush, 378, 350, 226, 35)
    $graphics.DrawArc($trophyPen, 315, 134, 142, 124, 92, 160)
    $graphics.DrawArc($trophyPen, 525, 134, 142, 124, 288, 160)
    $trophyBrush.Dispose()
    $trophyPen.Dispose()

    for ($i = 0; $i -lt 16; $i++) {
        $alpha = 18 + ($i * 3)
        $p = New-Pen (New-Color $alpha 126 47 236) (1.2 + ($i % 3))
        $offset = $i * 35
        $graphics.DrawLine($p, -80 + $offset, 520, 230 + $offset, 220)
        $p.Dispose()
    }

    for ($i = 0; $i -lt 9; $i++) {
        $p = New-Pen (New-Color (26 + ($i * 5)) 251 237 50) 1.2
        $x = 710 + ($i * 26)
        $graphics.DrawLine($p, $x, 72, $x - 210, 500)
        $p.Dispose()
    }

    $archPen = New-Pen (New-Color 68 115 115 124) 3
    $archBrush = New-SolidBrush (New-Color 48 0 0 0)
    for ($i = 0; $i -lt 5; $i++) {
        $x = 64 + ($i * 185)
        $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
        $path.AddArc($x, 112, 124, 180, 180, 180)
        $path.AddLine($x, 202, $x, 500)
        $path.AddLine($x + 124, 500, $x + 124, 202)
        $path.CloseFigure()
        $graphics.FillPath($archBrush, $path)
        $graphics.DrawPath($archPen, $path)
        $path.Dispose()
    }
    $archBrush.Dispose()
    $archPen.Dispose()

    $ice = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        [System.Drawing.Rectangle]::new(0, 330, $width, 175),
        (New-Color 76 220 220 225),
        (New-Color 0 220 220 225),
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
    )
    $graphics.FillEllipse($ice, 55, 354, 850, 150)
    $ice.Dispose()

    for ($i = 0; $i -lt 60; $i++) {
        $linePen = New-Pen (New-Color (10 + $rand.Next(30)) 225 225 230) (0.6 + ($rand.NextDouble() * 1.2))
        $x1 = 80 + $rand.Next(780)
        $y1 = 378 + $rand.Next(86)
        $graphics.DrawLine($linePen, $x1, $y1, $x1 + 60 + $rand.Next(150), $y1 - 8 + $rand.Next(16))
        $linePen.Dispose()
    }

    $logo = Convert-WhiteToTransparent $logoPath
    $logoW = 360
    $logoH = [int]($logo.Height * ($logoW / $logo.Width))
    $logoShadow = New-SolidBrush (New-Color 105 0 0 0)
    $graphics.FillEllipse($logoShadow, 70, 354, 405, 54)
    $logoShadow.Dispose()
    $graphics.DrawImage($logo, 70, 138, $logoW, $logoH)
    $logo.Dispose()

    $subFont = [System.Drawing.Font]::new("Segoe UI", 18, [System.Drawing.FontStyle]::Regular)
    $tagFont = [System.Drawing.Font]::new("Bahnschrift", 16, [System.Drawing.FontStyle]::Bold)
    $scriptFont = [System.Drawing.Font]::new("Gabriola", 25, [System.Drawing.FontStyle]::Bold)
    $smallFont = [System.Drawing.Font]::new("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)

    Draw-String $graphics "WELCOME TO" $smallFont $mutedBrush 493 104 320 24
    Draw-DaggerTitle $graphics "RANKD" 503 114
    Draw-SpacedString $graphics "EA NHL 26 EASHL 6V6" $tagFont $yellowBrush 510 284 0.4
    Draw-String $graphics "Queue Up, Lock In," $scriptFont $whiteBrush 512 314 385 36
    Draw-String $graphics "And Rise Through The Ranks" $scriptFont $whiteBrush 512 344 385 36
    Draw-String $graphics "Or Fall To The Bottom" $scriptFont $mutedBrush 513 374 385 36

    $vignettePath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $vignettePath.AddEllipse(-190, -130, $width + 380, $height + 260)
    $vignette = [System.Drawing.Drawing2D.PathGradientBrush]::new($vignettePath)
    $vignette.CenterColor = New-Color 0 0 0 0
    $vignette.SurroundColors = @((New-Color 190 0 0 0))
    $graphics.FillRectangle($vignette, 0, 0, $width, $height)
    $vignette.Dispose()
    $vignettePath.Dispose()

    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output $outputPath
}
finally {
    if ($graphics) { $graphics.Dispose() }
    if ($bitmap) { $bitmap.Dispose() }
}
