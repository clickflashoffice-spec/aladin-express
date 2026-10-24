Add-Type -AssemblyName System.Drawing

function Generate-DriverIcon([string]$outPath, [int]$size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    # Clear transparent
    $g.Clear([System.Drawing.Color]::Transparent)

    # Outer rounded rect / squircle
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $radius = [int]($size * 0.22)
    $dia = $radius * 2

    $path.AddArc(0, 0, $dia, $dia, 180, 90)
    $path.AddArc($size - $dia, 0, $dia, $dia, 270, 90)
    $path.AddArc($size - $dia, $size - $dia, $dia, $dia, 0, 90)
    $path.AddArc(0, $size - $dia, $dia, $dia, 90, 90)
    $path.CloseFigure()

    # Gradient fill: Deep Navy to Black (#0F172A to #020617)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 15, 23, 42),
        [System.Drawing.Color]::FromArgb(255, 2, 6, 23),
        45.0
    )
    $g.FillPath($brush, $path)

    # Gold/Amber border ring
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 245, 158, 11), [float]($size * 0.04))
    $g.DrawPath($pen, $path)

    # Inner Amber Circle
    $circleSize = [int]($size * 0.58)
    $circleX = [int](($size - $circleSize) / 2)
    $circleY = [int]($size * 0.16)
    $circleBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Rectangle($circleX, $circleY, $circleSize, $circleSize)),
        [System.Drawing.Color]::FromArgb(255, 245, 158, 11),
        [System.Drawing.Color]::FromArgb(255, 217, 119, 6),
        90.0
    )
    $g.FillEllipse($circleBrush, $circleX, $circleY, $circleSize, $circleSize)

    # Inner Emblem (Stylized "D" & Scooter Lightning in Black)
    $symbolFont = New-Object System.Drawing.Font("Arial", [float]($size * 0.32), [System.Drawing.FontStyle]::Bold)
    $symbolBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 11, 15, 25))
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString("D", $symbolFont, $symbolBrush, ($size / 2.0), ($circleY + $circleSize / 2.0 + 2), $sf)

    # Bottom Text "DRIVER"
    $labelFont = New-Object System.Drawing.Font("Arial", [float]($size * 0.13), [System.Drawing.FontStyle]::Bold)
    $labelBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 245, 158, 11))
    $g.DrawString("DRIVER", $labelFont, $labelBrush, ($size / 2.0), [float]($size * 0.84), $sf)

    # Save PNG
    $dir = [System.IO.Path]::GetDirectoryName($outPath)
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Generated: $outPath ($size x $size)"
}

$baseRes = "c:\Users\alamo\Downloads\delivery\android-driver\app\src\main\res"

# Generate Mipmaps
Generate-DriverIcon "$baseRes\mipmap-hdpi\ic_launcher.png" 72
Generate-DriverIcon "$baseRes\mipmap-xhdpi\ic_launcher.png" 96
Generate-DriverIcon "$baseRes\mipmap-xxhdpi\ic_launcher.png" 144
Generate-DriverIcon "$baseRes\drawable\logo.png" 256
Generate-DriverIcon "c:\Users\alamo\Downloads\delivery\public\driver-icon.png" 512
Generate-DriverIcon "c:\Users\alamo\Downloads\delivery\android-driver\app\src\main\assets\logo.png" 256
