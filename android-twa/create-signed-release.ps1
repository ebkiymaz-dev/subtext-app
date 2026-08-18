[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$projectRoot = $PSScriptRoot
$ecosystemRoot = (Resolve-Path (Join-Path $projectRoot "..\..")).Path
$javaHome = Join-Path $ecosystemRoot "FOUNDRY\android-tooling\.jdk\jdk-17.0.20+8"
$bubblewrap = Join-Path $ecosystemRoot "FOUNDRY\android-tooling\node_modules\.bin\bubblewrap.cmd"
$androidSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$keytool = Join-Path $javaHome "bin\keytool.exe"
$jarsigner = Join-Path $javaHome "bin\jarsigner.exe"
$apksigner = Join-Path $androidSdk "build-tools\36.1.0\apksigner.bat"
$keystore = Join-Path $projectRoot "android.keystore"
$alias = "subtext"

function Get-ReleasePassword {
    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Subtext Google Play signing"
    $form.Size = New-Object System.Drawing.Size(470, 285)
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.TopMost = $true

    $intro = New-Object System.Windows.Forms.Label
    $intro.Location = New-Object System.Drawing.Point(24, 18)
    $intro.Size = New-Object System.Drawing.Size(405, 48)
    $intro.Text = "Enter the password you just created. It stays in memory only long enough to sign and verify this release."
    $form.Controls.Add($intro)

    $passwordLabel = New-Object System.Windows.Forms.Label
    $passwordLabel.Location = New-Object System.Drawing.Point(24, 78)
    $passwordLabel.Size = New-Object System.Drawing.Size(180, 20)
    $passwordLabel.Text = "Keystore/key password"
    $form.Controls.Add($passwordLabel)

    $passwordBox = New-Object System.Windows.Forms.TextBox
    $passwordBox.Location = New-Object System.Drawing.Point(24, 101)
    $passwordBox.Size = New-Object System.Drawing.Size(405, 24)
    $passwordBox.UseSystemPasswordChar = $true
    $form.Controls.Add($passwordBox)

    $confirmLabel = New-Object System.Windows.Forms.Label
    $confirmLabel.Location = New-Object System.Drawing.Point(24, 137)
    $confirmLabel.Size = New-Object System.Drawing.Size(180, 20)
    $confirmLabel.Text = "Confirm password"
    $form.Controls.Add($confirmLabel)

    $confirmBox = New-Object System.Windows.Forms.TextBox
    $confirmBox.Location = New-Object System.Drawing.Point(24, 160)
    $confirmBox.Size = New-Object System.Drawing.Size(405, 24)
    $confirmBox.UseSystemPasswordChar = $true
    $form.Controls.Add($confirmBox)

    $ok = New-Object System.Windows.Forms.Button
    $ok.Location = New-Object System.Drawing.Point(264, 205)
    $ok.Size = New-Object System.Drawing.Size(80, 30)
    $ok.Text = "Sign"
    $form.Controls.Add($ok)

    $cancel = New-Object System.Windows.Forms.Button
    $cancel.Location = New-Object System.Drawing.Point(349, 205)
    $cancel.Size = New-Object System.Drawing.Size(80, 30)
    $cancel.Text = "Cancel"
    $cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $form.Controls.Add($cancel)

    $form.AcceptButton = $ok
    $form.CancelButton = $cancel

    $ok.Add_Click({
        if ($passwordBox.Text.Length -lt 6) {
            [System.Windows.Forms.MessageBox]::Show("Use at least 6 characters.", "Password too short") | Out-Null
            return
        }
        if ($passwordBox.Text -cne $confirmBox.Text) {
            [System.Windows.Forms.MessageBox]::Show("The two passwords do not match.", "Try again") | Out-Null
            return
        }
        $form.Tag = $passwordBox.Text
        $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
        $form.Close()
    })

    $form.Add_Shown({ $passwordBox.Focus() })
    $result = $form.ShowDialog()
    if ($result -ne [System.Windows.Forms.DialogResult]::OK) {
        return $null
    }
    return [string]$form.Tag
}

function Convert-ToArgumentString([string[]]$Arguments) {
    return (($Arguments | ForEach-Object { '"' + $_.Replace('"', '\"') + '"' }) -join ' ')
}

function Invoke-KeytoolWithInput {
    param(
        [string[]]$Arguments,
        [string[]]$InputLines
    )

    $start = New-Object System.Diagnostics.ProcessStartInfo
    $start.FileName = $keytool
    $start.Arguments = Convert-ToArgumentString $Arguments
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $start
    [void]$process.Start()
    foreach ($line in $InputLines) {
        $process.StandardInput.WriteLine($line)
    }
    $process.StandardInput.Close()
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    return [pscustomobject]@{
        ExitCode = $process.ExitCode
        Output = $stdout + $stderr
    }
}

try {
    foreach ($path in @($keytool, $jarsigner, $bubblewrap, $apksigner)) {
        if (-not (Test-Path -LiteralPath $path)) {
            throw "Required release tool is missing: $path"
        }
    }

    Write-Host ""
    Write-Host "SUBTEXT GOOGLE PLAY RELEASE" -ForegroundColor Cyan
    Write-Host "The secure password dialog is opening. The password is not saved by this script."

    $password = Get-ReleasePassword
    if ($null -eq $password) {
        throw "Signing was cancelled."
    }

    if (-not (Test-Path -LiteralPath $keystore)) {
        $created = Invoke-KeytoolWithInput `
            -Arguments @(
                "-genkeypair", "-v", "-keystore", $keystore, "-alias", $alias,
                "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000",
                "-storetype", "JKS", "-dname", "CN=Subtext Upload Key, OU=Mobile Apps, O=Neon Jungle"
            ) `
            -InputLines @($password, $password, "")
        if ($created.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $keystore)) {
            throw "The upload key could not be created. $($created.Output)"
        }
    }

    $validated = Invoke-KeytoolWithInput `
        -Arguments @("-list", "-v", "-keystore", $keystore, "-alias", $alias) `
        -InputLines @($password)
    if ($validated.ExitCode -ne 0) {
        throw "That password did not unlock the Subtext keystore. Reopen the script and try again."
    }

    $documents = [Environment]::GetFolderPath("MyDocuments")
    $backupDir = Join-Path $documents "Neon Jungle\Release Keys\Subtext"
    $backupPath = Join-Path $backupDir "subtext-upload-key.keystore"
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    if (Test-Path -LiteralPath $backupPath) {
        $sourceHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $keystore).Hash
        $backupHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $backupPath).Hash
        if ($sourceHash -ne $backupHash) {
            throw "A different Subtext key already exists at the backup path. Nothing was overwritten."
        }
    }
    else {
        Copy-Item -LiteralPath $keystore -Destination $backupPath
    }

    $env:JAVA_HOME = $javaHome
    $env:ANDROID_HOME = $androidSdk
    $env:ANDROID_SDK_ROOT = $androidSdk
    $env:GRADLE_USER_HOME = Join-Path $env:USERPROFILE ".gradle"
    $env:BUBBLEWRAP_KEYSTORE_PASSWORD = $password
    $env:BUBBLEWRAP_KEY_PASSWORD = $password

    Write-Host "Password accepted. Building and signing now..." -ForegroundColor Yellow
    Push-Location $projectRoot
    try {
        & $bubblewrap build
        if ($LASTEXITCODE -ne 0) {
            throw "Bubblewrap did not complete the signed release build."
        }
    }
    finally {
        Pop-Location
        Remove-Item Env:\BUBBLEWRAP_KEYSTORE_PASSWORD -ErrorAction SilentlyContinue
        Remove-Item Env:\BUBBLEWRAP_KEY_PASSWORD -ErrorAction SilentlyContinue
    }

    $signedApk = Join-Path $projectRoot "app-release-signed.apk"
    $signedBundle = Join-Path $projectRoot "app-release-bundle.aab"
    if (-not (Test-Path -LiteralPath $signedApk) -or -not (Test-Path -LiteralPath $signedBundle)) {
        throw "The signed APK or Android App Bundle is missing."
    }

    & $apksigner verify --verbose $signedApk
    if ($LASTEXITCODE -ne 0) {
        throw "APK signature verification failed."
    }
    & $jarsigner -verify $signedBundle
    if ($LASTEXITCODE -ne 0) {
        throw "App Bundle signature verification failed."
    }

    $releaseDir = Join-Path $projectRoot "release"
    New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
    $releaseApk = Join-Path $releaseDir "subtext-v1-signed.apk"
    $releaseBundle = Join-Path $releaseDir "subtext-v1-play.aab"
    Copy-Item -LiteralPath $signedApk -Destination $releaseApk -Force
    Copy-Item -LiteralPath $signedBundle -Destination $releaseBundle -Force

    $fingerprintMatch = [regex]::Match($validated.Output, "SHA256:\s*([0-9A-F:]+)")
    if (-not $fingerprintMatch.Success) {
        throw "The bundle was signed, but the SHA-256 certificate fingerprint could not be read."
    }
    $fingerprint = $fingerprintMatch.Groups[1].Value
    Set-Content -LiteralPath (Join-Path $releaseDir "upload-key-sha256.txt") -Value $fingerprint -Encoding ASCII

    Clear-Variable password -ErrorAction SilentlyContinue

    Write-Host ""
    Write-Host "SIGNED RELEASE READY" -ForegroundColor Green
    Write-Host "Play upload bundle: $releaseBundle"
    Write-Host "Device-test APK:   $releaseApk"
    Write-Host "Key backup:         $backupPath"
    Write-Host "SHA-256 fingerprint: $fingerprint"
    [System.Windows.Forms.MessageBox]::Show(
        "The signed Subtext Google Play bundle is ready and verified.",
        "Subtext release ready"
    ) | Out-Null
}
catch {
    Remove-Item Env:\BUBBLEWRAP_KEYSTORE_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:\BUBBLEWRAP_KEY_PASSWORD -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host $_.Exception.Message -ForegroundColor Red
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, "Subtext signing stopped") | Out-Null
}

Write-Host ""
Read-Host "Press Enter to close this window"
