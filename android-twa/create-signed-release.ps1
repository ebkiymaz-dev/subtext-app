[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$projectRoot = $PSScriptRoot
$ecosystemRoot = (Resolve-Path (Join-Path $projectRoot "..\..")).Path
$javaHome = Join-Path $ecosystemRoot "FOUNDRY\android-tooling\.jdk\jdk-17.0.20+8"
if (-not (Test-Path (Join-Path $javaHome "bin\java.exe"))) {
    $javaHome = (Get-ChildItem (Join-Path $projectRoot ".jdk17") -Directory | Select-Object -First 1).FullName
}
$androidSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$java = Join-Path $javaHome "bin\java.exe"
$keytool = Join-Path $javaHome "bin\keytool.exe"
$jarsigner = Join-Path $javaHome "bin\jarsigner.exe"
$apksignerJar = Join-Path $androidSdk "build-tools\36.1.0\lib\apksigner.jar"
$keystore = Join-Path $projectRoot "android.keystore"
$unsignedApk = Join-Path $projectRoot "build-v6\app\outputs\apk\release\app-release-unsigned.apk"
$unsignedBundle = Join-Path $projectRoot "build-v6\app\outputs\bundle\release\app-release.aab"
$alias = "subtext"
$releaseDir = Join-Path $projectRoot "release"
$logPath = Join-Path $projectRoot "signing-diagnostic.log"

function Write-Diagnostic([string]$Message) {
    Add-Content -LiteralPath $logPath -Value ("[{0:yyyy-MM-dd HH:mm:ss}] {1}" -f (Get-Date), $Message) -Encoding UTF8
}

function Get-Sha256([string]$Path) {
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try {
            return ([System.BitConverter]::ToString($sha.ComputeHash($stream))).Replace("-", "")
        }
        finally {
            $sha.Dispose()
        }
    }
    finally {
        $stream.Dispose()
    }
}

function Get-ReleasePasswords {
    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Subtext Google Play signing"
    $form.Size = New-Object System.Drawing.Size(485, 330)
    $form.StartPosition = "CenterScreen"
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.MinimizeBox = $false
    $form.TopMost = $true

    $intro = New-Object System.Windows.Forms.Label
    $intro.Location = New-Object System.Drawing.Point(24, 18)
    $intro.Size = New-Object System.Drawing.Size(420, 52)
    $intro.Text = "Enter the password used when the Subtext upload key was created. Passwords are used only in memory and are never logged."
    $form.Controls.Add($intro)

    $storeLabel = New-Object System.Windows.Forms.Label
    $storeLabel.Location = New-Object System.Drawing.Point(24, 79)
    $storeLabel.Size = New-Object System.Drawing.Size(200, 20)
    $storeLabel.Text = "Keystore password"
    $form.Controls.Add($storeLabel)

    $storeBox = New-Object System.Windows.Forms.TextBox
    $storeBox.Location = New-Object System.Drawing.Point(24, 102)
    $storeBox.Size = New-Object System.Drawing.Size(420, 24)
    $storeBox.UseSystemPasswordChar = $true
    $form.Controls.Add($storeBox)

    $sameBox = New-Object System.Windows.Forms.CheckBox
    $sameBox.Location = New-Object System.Drawing.Point(24, 139)
    $sameBox.Size = New-Object System.Drawing.Size(300, 24)
    $sameBox.Text = "Key password is the same"
    $sameBox.Checked = $true
    $form.Controls.Add($sameBox)

    $keyLabel = New-Object System.Windows.Forms.Label
    $keyLabel.Location = New-Object System.Drawing.Point(24, 171)
    $keyLabel.Size = New-Object System.Drawing.Size(200, 20)
    $keyLabel.Text = "Different key password"
    $keyLabel.Enabled = $false
    $form.Controls.Add($keyLabel)

    $keyBox = New-Object System.Windows.Forms.TextBox
    $keyBox.Location = New-Object System.Drawing.Point(24, 194)
    $keyBox.Size = New-Object System.Drawing.Size(420, 24)
    $keyBox.UseSystemPasswordChar = $true
    $keyBox.Enabled = $false
    $form.Controls.Add($keyBox)

    $sameBox.Add_CheckedChanged({
        $keyLabel.Enabled = -not $sameBox.Checked
        $keyBox.Enabled = -not $sameBox.Checked
        if ($sameBox.Checked) {
            $keyBox.Clear()
        }
    })

    $ok = New-Object System.Windows.Forms.Button
    $ok.Location = New-Object System.Drawing.Point(279, 243)
    $ok.Size = New-Object System.Drawing.Size(80, 30)
    $ok.Text = "Sign"
    $form.Controls.Add($ok)

    $cancel = New-Object System.Windows.Forms.Button
    $cancel.Location = New-Object System.Drawing.Point(364, 243)
    $cancel.Size = New-Object System.Drawing.Size(80, 30)
    $cancel.Text = "Cancel"
    $cancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $form.Controls.Add($cancel)

    $form.AcceptButton = $ok
    $form.CancelButton = $cancel

    $ok.Add_Click({
        if ($storeBox.Text.Length -lt 6) {
            [System.Windows.Forms.MessageBox]::Show("Enter the keystore password (at least 6 characters).", "Password required") | Out-Null
            return
        }
        if (-not $sameBox.Checked -and $keyBox.Text.Length -lt 6) {
            [System.Windows.Forms.MessageBox]::Show("Enter the different key password.", "Key password required") | Out-Null
            return
        }
        $form.Tag = [pscustomobject]@{
            StorePassword = $storeBox.Text
            KeyPassword = if ($sameBox.Checked) { $storeBox.Text } else { $keyBox.Text }
        }
        $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
        $form.Close()
    })

    $form.Add_Shown({ $storeBox.Focus() })
    $result = $form.ShowDialog()
    if ($result -ne [System.Windows.Forms.DialogResult]::OK) {
        return $null
    }
    return $form.Tag
}

function Convert-ToArgumentString([string[]]$Arguments) {
    return (($Arguments | ForEach-Object { '"' + $_.Replace('"', '\"') + '"' }) -join ' ')
}

function Invoke-RedirectedProcess {
    param(
        [string]$FileName,
        [string[]]$Arguments,
        [string[]]$InputLines = @()
    )

    $start = New-Object System.Diagnostics.ProcessStartInfo
    $start.FileName = $FileName
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
    Set-Content -LiteralPath $logPath -Value "Subtext signing diagnostic (contains no passwords)" -Encoding UTF8
    Write-Diagnostic "Signing started."

    foreach ($path in @($java, $keytool, $jarsigner, $apksignerJar, $keystore, $unsignedApk, $unsignedBundle)) {
        if (-not (Test-Path -LiteralPath $path)) {
            throw "Required release file or tool is missing: $path"
        }
    }

    $passwords = Get-ReleasePasswords
    if ($null -eq $passwords) {
        throw "Signing was cancelled."
    }

    $validated = Invoke-RedirectedProcess `
        -FileName $keytool `
        -Arguments @("-list", "-v", "-keystore", $keystore, "-alias", $alias) `
        -InputLines @($passwords.StorePassword)
    if ($validated.ExitCode -ne 0) {
        throw "The keystore password was not accepted. Reopen the signer and try again."
    }
    Write-Diagnostic "Keystore password accepted."

    $documents = [Environment]::GetFolderPath("MyDocuments")
    $backupDir = Join-Path $documents "Neon Jungle\Release Keys\Subtext"
    $backupPath = Join-Path $backupDir "subtext-upload-key.keystore"
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    if (Test-Path -LiteralPath $backupPath) {
        $sourceHash = Get-Sha256 $keystore
        $backupHash = Get-Sha256 $backupPath
        if ($sourceHash -ne $backupHash) {
            throw "A different Subtext key already exists at the backup path. Nothing was overwritten."
        }
    }
    else {
        Copy-Item -LiteralPath $keystore -Destination $backupPath
    }
    Write-Diagnostic "Permanent key backup verified."

    New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
    $releaseApk = Join-Path $releaseDir "subtext-v6-signed.apk"
    $releaseBundle = Join-Path $releaseDir "subtext-v6-play.aab"

    $env:SUBTEXT_STORE_PASSWORD = $passwords.StorePassword
    $env:SUBTEXT_KEY_PASSWORD = $passwords.KeyPassword
    try {
        $apkResult = Invoke-RedirectedProcess `
            -FileName $java `
            -Arguments @(
                "-jar", $apksignerJar, "sign",
                "--ks", $keystore,
                "--ks-key-alias", $alias,
                "--ks-pass", "env:SUBTEXT_STORE_PASSWORD",
                "--key-pass", "env:SUBTEXT_KEY_PASSWORD",
                "--out", $releaseApk,
                $unsignedApk
            )
        if ($apkResult.ExitCode -ne 0) {
            Write-Diagnostic ("APK signing tool failed: " + ($apkResult.Output -replace "[\r\n]+", " "))
            throw "The key password was not accepted, or APK signing failed. If you created a different key password, uncheck 'Key password is the same' and enter it separately."
        }
        Write-Diagnostic "APK signed."

        $bundleResult = Invoke-RedirectedProcess `
            -FileName $jarsigner `
            -Arguments @("-keystore", $keystore, "-storetype", "JKS", "-signedjar", $releaseBundle, $unsignedBundle, $alias) `
            -InputLines @($passwords.StorePassword, $passwords.KeyPassword)
        if ($bundleResult.ExitCode -ne 0) {
            Write-Diagnostic ("Bundle signing tool failed: " + ($bundleResult.Output -replace "[\r\n]+", " "))
            throw "The Android App Bundle could not be signed. If the key password differs, reopen the signer and enter it separately."
        }
        Write-Diagnostic "Android App Bundle signed."
    }
    finally {
        Remove-Item Env:\SUBTEXT_STORE_PASSWORD -ErrorAction SilentlyContinue
        Remove-Item Env:\SUBTEXT_KEY_PASSWORD -ErrorAction SilentlyContinue
    }

    $apkVerify = Invoke-RedirectedProcess -FileName $java -Arguments @("-jar", $apksignerJar, "verify", "--verbose", "--print-certs", $releaseApk)
    if ($apkVerify.ExitCode -ne 0) {
        throw "APK signature verification failed."
    }
    $bundleVerify = Invoke-RedirectedProcess -FileName $jarsigner -Arguments @("-verify", $releaseBundle)
    if ($bundleVerify.ExitCode -ne 0) {
        throw "App Bundle signature verification failed."
    }
    Write-Diagnostic "Both release signatures verified."

    $fingerprintMatch = [regex]::Match($validated.Output, "SHA256:\s*([0-9A-F:]+)")
    if (-not $fingerprintMatch.Success) {
        throw "The files were signed, but the SHA-256 certificate fingerprint could not be read."
    }
    $fingerprint = $fingerprintMatch.Groups[1].Value
    Set-Content -LiteralPath (Join-Path $releaseDir "upload-key-sha256.txt") -Value $fingerprint -Encoding ASCII
    Write-Diagnostic "Signing completed successfully."

    Clear-Variable passwords -ErrorAction SilentlyContinue
    [System.Windows.Forms.MessageBox]::Show(
        "Success. The signed Subtext version-6 Google Play bundle is ready and verified.",
        "Subtext release ready"
    ) | Out-Null
}
catch {
    Remove-Item Env:\SUBTEXT_STORE_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:\SUBTEXT_KEY_PASSWORD -ErrorAction SilentlyContinue
    Write-Diagnostic ("Stopped: " + $_.Exception.Message)
    [System.Windows.Forms.MessageBox]::Show(
        $_.Exception.Message + "`r`n`r`nA non-secret diagnostic was saved to:`r`n" + $logPath,
        "Subtext signing stopped"
    ) | Out-Null
}
