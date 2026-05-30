Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$flyerDir = Join-Path $root "assets\flyers"
$logoPath = Join-Path $root "assets\rankd-bot.png"
$outputPath = Join-Path $flyerDir "rankd-command-guide-grey.png"

if (-not (Test-Path $flyerDir)) {
    New-Item -ItemType Directory -Path $flyerDir | Out-Null
}

$width = 1200
$height = 1600
$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

function New-Color([int]$a, [int]$r, [int]$g, [int]$b) {
    return [System.Drawing.Color]::FromArgb($a, $r, $g, $b)
}

function New-SolidBrush([System.Drawing.Color]$color) {
    return New-Object System.Drawing.SolidBrush $color
}

function New-Pen([System.Drawing.Color]$color, [float]$width = 1) {
    return New-Object System.Drawing.Pen $color, $width
}

function Draw-Capsule($g, [System.Drawing.RectangleF]$rect, [float]$radius, [System.Drawing.Brush]$brush, [System.Drawing.Pen]$pen = $null) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $radius * 2
    $path.AddArc($rect.X, $rect.Y, $diameter, $diameter, 180, 90)
    $path.AddArc($rect.Right - $diameter, $rect.Y, $diameter, $diameter, 270, 90)
    $path.AddArc($rect.Right - $diameter, $rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($rect.X, $rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    $g.FillPath($brush, $path)
    if ($pen -ne $null) {
        $g.DrawPath($pen, $path)
    }
    $path.Dispose()
}

function Draw-String($g, [string]$text, [System.Drawing.Font]$font, [System.Drawing.Brush]$brush, [float]$x, [float]$y, [float]$w, [float]$h, [string]$align = "Near") {
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::$align
    $format.LineAlignment = [System.Drawing.StringAlignment]::Near
    $format.Trimming = [System.Drawing.StringTrimming]::Word
    $g.DrawString($text, $font, $brush, ([System.Drawing.RectangleF]::new($x, $y, $w, $h)), $format)
    $format.Dispose()
}

function Draw-CommandCard($g, [float]$x, [float]$y, [float]$w, [string]$command, [string]$description, [System.Drawing.Brush]$textBrush, [System.Drawing.Brush]$mutedBrush, [System.Drawing.Brush]$accentBrush, [System.Drawing.Font]$cmdFont, [System.Drawing.Font]$descFont) {
    $cardBrush = New-SolidBrush (New-Color 178 22 22 25)
    $borderPen = New-Pen (New-Color 110 128 128 138) 1.2
    Draw-Capsule $g ([System.Drawing.RectangleF]::new($x, $y, $w, 82)) 12 $cardBrush $borderPen
    $g.FillRectangle($accentBrush, $x, ($y + 16), 5, 50)
    Draw-String $g $command $cmdFont $textBrush ($x + 22) ($y + 13) ($w - 42) 24
    Draw-String $g $description $descFont $mutedBrush ($x + 22) ($y + 42) ($w - 42) 36
    $cardBrush.Dispose()
    $borderPen.Dispose()
}

try {
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        ([System.Drawing.Rectangle]::new(0, 0, $width, $height)),
        (New-Color 255 8 8 10),
        (New-Color 255 42 42 45),
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
    )
    $graphics.FillRectangle($bgBrush, 0, 0, $width, $height)
    $bgBrush.Dispose()

    $vignettePath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $vignettePath.AddEllipse(-330, -220, $width + 660, $height + 440)
    $vignetteBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush $vignettePath
    $vignetteBrush.CenterColor = New-Color 0 0 0 0
    $vignetteBrush.SurroundColors = @((New-Color 210 0 0 0))
    $graphics.FillRectangle($vignetteBrush, 0, 0, $width, $height)
    $vignetteBrush.Dispose()
    $vignettePath.Dispose()

    $spotPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $spotPath.AddEllipse(225, 130, 750, 610)
    $spotBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush $spotPath
    $spotBrush.CenterColor = New-Color 92 198 198 205
    $spotBrush.SurroundColors = @((New-Color 0 198 198 205))
    $graphics.FillPath($spotBrush, $spotPath)
    $spotBrush.Dispose()
    $spotPath.Dispose()

    $iceBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        ([System.Drawing.Rectangle]::new(150, 680, 900, 230)),
        (New-Color 108 235 235 238),
        (New-Color 0 235 235 238),
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical
    )
    $graphics.FillEllipse($iceBrush, 160, 690, 880, 180)
    $iceBrush.Dispose()

    $rand = New-Object System.Random 516
    for ($i = 0; $i -lt 76; $i++) {
        $sx = 160 + $rand.Next(880)
        $sy = 520 + $rand.Next(330)
        $sw = 80 + $rand.Next(260)
        $sh = 22 + $rand.Next(86)
        $alpha = 8 + $rand.Next(18)
        $smoke = New-SolidBrush (New-Color $alpha 215 215 220)
        $graphics.FillEllipse($smoke, $sx, $sy, $sw, $sh)
        $smoke.Dispose()
    }

    for ($i = 0; $i -lt 120; $i++) {
        $linePen = New-Pen (New-Color (8 + $rand.Next(18)) 225 225 230) (0.6 + ($rand.NextDouble() * 1.5))
        $x1 = 130 + $rand.Next(930)
        $y1 = 748 + $rand.Next(150)
        $graphics.DrawLine($linePen, $x1, $y1, $x1 + 80 + $rand.Next(170), $y1 - 12 + $rand.Next(24))
        $linePen.Dispose()
    }

    $shadow = New-SolidBrush (New-Color 110 0 0 0)
    $graphics.FillEllipse($shadow, 490, 660, 220, 44)
    $shadow.Dispose()

    $playerBrush = New-SolidBrush (New-Color 155 8 8 10)
    $playerAccent = New-SolidBrush (New-Color 190 145 42 235)
    $stickPen = New-Pen (New-Color 170 205 205 210) 5
    $bladePen = New-Pen (New-Color 160 30 30 32) 7
    $graphics.FillEllipse($playerBrush, 552, 295, 72, 82)
    $graphics.FillRectangle($playerBrush, 530, 368, 118, 160)
    $graphics.FillRectangle($playerAccent, 533, 470, 112, 17)
    $graphics.FillRectangle($playerBrush, 512, 510, 42, 148)
    $graphics.FillRectangle($playerBrush, 628, 510, 42, 148)
    $graphics.DrawLine($stickPen, 612, 472, 398, 706)
    $graphics.DrawLine($bladePen, 398, 706, 315, 723)
    $playerBrush.Dispose()
    $playerAccent.Dispose()
    $stickPen.Dispose()
    $bladePen.Dispose()

    $purple = New-Color 255 126 47 236
    $yellow = New-Color 255 251 237 50
    $white = New-Color 255 246 246 250
    $muted = New-Color 255 196 198 207
    $panel = New-SolidBrush (New-Color 214 16 16 19)
    $panel2 = New-SolidBrush (New-Color 226 22 22 26)
    $textBrush = New-SolidBrush $white
    $mutedBrush = New-SolidBrush $muted
    $purpleBrush = New-SolidBrush $purple
    $yellowBrush = New-SolidBrush $yellow
    $panelPen = New-Pen (New-Color 120 142 142 152) 1.3

    $fontFamily = "Segoe UI"
    $titleFont = New-Object System.Drawing.Font $fontFamily, 58, ([System.Drawing.FontStyle]::Bold)
    $subFont = New-Object System.Drawing.Font $fontFamily, 19, ([System.Drawing.FontStyle]::Regular)
    $sectionFont = New-Object System.Drawing.Font $fontFamily, 28, ([System.Drawing.FontStyle]::Bold)
    $cmdFont = New-Object System.Drawing.Font $fontFamily, 17, ([System.Drawing.FontStyle]::Bold)
    $descFont = New-Object System.Drawing.Font $fontFamily, 13.2, ([System.Drawing.FontStyle]::Regular)
    $footerFont = New-Object System.Drawing.Font $fontFamily, 18, ([System.Drawing.FontStyle]::Bold)
    $smallFont = New-Object System.Drawing.Font $fontFamily, 13, ([System.Drawing.FontStyle]::Bold)

    $logo = [System.Drawing.Image]::FromFile($logoPath)
    $logoW = 250
    $logoH = [int]($logo.Height * ($logoW / $logo.Width))
    $graphics.DrawImage($logo, 72, 58, $logoW, $logoH)
    $logo.Dispose()

    Draw-String $graphics "RANKD BOT" $titleFont $textBrush 348 76 770 78
    Draw-String $graphics "COMMAND GUIDE" $sectionFont $yellowBrush 352 148 760 46
    Draw-String $graphics "EA NHL 26 EASHL 6v6 matchmaking, rooms, results, and Elo tracking." $subFont $mutedBrush 354 202 740 66

    $tagBrush = New-SolidBrush (New-Color 235 126 47 236)
    Draw-Capsule $graphics ([System.Drawing.RectangleF]::new(73, 275, 470, 42)) 18 $tagBrush $null
    Draw-String $graphics "RANKD, ONLY SKILL WILL HELP YOU CLIMB" $smallFont $textBrush 92 286 432 24 "Center"
    $tagBrush.Dispose()

    $leftX = 70
    $rightX = 632
    $panelY = 352
    $panelW = 498
    $panelH = 820

    Draw-Capsule $graphics ([System.Drawing.RectangleF]::new($leftX, $panelY, $panelW, $panelH)) 22 $panel $panelPen
    Draw-Capsule $graphics ([System.Drawing.RectangleF]::new($rightX, $panelY, $panelW, $panelH)) 22 $panel2 $panelPen
    $graphics.FillRectangle($purpleBrush, $leftX, ($panelY + 38), 7, 88)
    $graphics.FillRectangle($yellowBrush, $rightX, ($panelY + 38), 7, 88)

    Draw-String $graphics "PLAYER COMMANDS" $sectionFont $textBrush ($leftX + 38) ($panelY + 34) 430 46
    Draw-String $graphics "Queue up, check rooms, and track your climb." $subFont $mutedBrush ($leftX + 40) ($panelY + 84) 420 58

    Draw-String $graphics "STAFF COMMANDS" $sectionFont $textBrush ($rightX + 38) ($panelY + 34) 430 46
    Draw-String $graphics "Manage rooms, tests, and match results." $subFont $mutedBrush ($rightX + 40) ($panelY + 84) 420 58

    $playerCommands = @(
        @("/join position", "Join the 6v6 queue at your selected position."),
        @("/queue", "View queue slots and checked-in players."),
        @("/leave", "Leave the queue before your match is created."),
        @("/rooms", "See available or occupied match rooms."),
        @("/matches", "Review active matches currently being set up."),
        @("/rating player", "View a player's Elo and record."),
        @("/leaderboard", "Show the RANKD Elo leaderboard.")
    )

    $staffCommands = @(
        @("/setuprooms", "Create or reset the five RANKD match rooms."),
        @("/closematch match_id", "Close a match and reopen its room."),
        @("/reportmatch", "Submit final scores and update Elo."),
        @("/testmatch", "Create a test match with selected users."),
        @("/ping", "Confirm the bot is online and responding.")
    )

    $y = $panelY + 164
    foreach ($cmd in $playerCommands) {
        Draw-CommandCard $graphics ($leftX + 34) $y ($panelW - 68) $cmd[0] $cmd[1] $textBrush $mutedBrush $purpleBrush $cmdFont $descFont
        $y += 94
    }

    $y = $panelY + 164
    foreach ($cmd in $staffCommands) {
        Draw-CommandCard $graphics ($rightX + 34) $y ($panelW - 68) $cmd[0] $cmd[1] $textBrush $mutedBrush $yellowBrush $cmdFont $descFont
        $y += 94
    }

    $rulePen = New-Pen (New-Color 160 126 47 236) 2
    $graphics.DrawLine($rulePen, 126, 1265, 1074, 1265)
    $rulePen.Dispose()

    Draw-String $graphics "QUEUE REQUIREMENT" $cmdFont $yellowBrush 125 1304 300 28
    Draw-String $graphics "Two players at every position: Center, Left Wing, Right Wing, Left Defense, Right Defense, and Goalie." $subFont $textBrush 125 1338 950 66
    Draw-String $graphics "The first two players queued at each position are guaranteed for the next match." $subFont $mutedBrush 125 1410 950 34

    $footerRect = [System.Drawing.RectangleF]::new(70, 1468, 1060, 74)
    $footerBrush = New-SolidBrush (New-Color 205 13 13 15)
    Draw-Capsule $graphics $footerRect 22 $footerBrush $panelPen
    Draw-String $graphics "RANKD, ONLY SKILL WILL HELP YOU CLIMB" $footerFont $textBrush 95 1492 1010 32 "Center"
    $footerBrush.Dispose()

    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output $outputPath
}
finally {
    if ($graphics) { $graphics.Dispose() }
    if ($bitmap) { $bitmap.Dispose() }
}
