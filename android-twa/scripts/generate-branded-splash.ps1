param()

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$androidRoot = Split-Path -Parent $PSScriptRoot
$projectRoot = Split-Path -Parent $androidRoot
$sourcePath = Join-Path $projectRoot "store-assets\app-icon-512.png"
$resourceRoot = Join-Path $androidRoot "app\src\main\res"

$targets = @(
    @{ Folder = "drawable-mdpi"; Width = 320; Height = 480 },
    @{ Folder = "drawable-hdpi"; Width = 480; Height = 800 },
    @{ Folder = "drawable-xhdpi"; Width = 720; Height = 1280 },
    @{ Folder = "drawable-xxhdpi"; Width = 960; Height = 1600 },
    @{ Folder = "drawable-xxxhdpi"; Width = 1280; Height = 1920 }
)

$source = [System.Drawing.Image]::FromFile($sourcePath)
try {
    foreach ($target in $targets) {
        $bitmap = New-Object System.Drawing.Bitmap($target.Width, $target.Height)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#1F1D1A"))

            $iconSize = [int]([Math]::Min($target.Width * 0.42, $target.Height * 0.25))
            $iconX = [int](($target.Width - $iconSize) / 2)
            $iconY = [int](($target.Height - $iconSize) / 2 - ($target.Height * 0.025))
            $graphics.DrawImage($source, $iconX, $iconY, $iconSize, $iconSize)

            $gold = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#B08D3F"), [Math]::Max(1, $target.Width / 320))
            try {
                $ruleWidth = [int]($iconSize * 0.72)
                $ruleY = [int]($iconY + $iconSize + ($target.Height * 0.045))
                $graphics.DrawLine($gold, [int](($target.Width - $ruleWidth) / 2), $ruleY, [int](($target.Width + $ruleWidth) / 2), $ruleY)
            } finally {
                $gold.Dispose()
            }

            $outputPath = Join-Path (Join-Path $resourceRoot $target.Folder) "subtext_splash_static.png"
            $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $graphics.Dispose()
            $bitmap.Dispose()
        }
    }
} finally {
    $source.Dispose()
}

Write-Output "Generated branded Subtext splash images for all Android densities."
