param([string]$Destination = (Join-Path $PSScriptRoot '..\.m2-local'))

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force $Destination | Out-Null

$repositories = @(
  'https://dl.google.com/dl/android/maven2',
  'https://repo1.maven.org/maven2'
)
$queue = [System.Collections.Generic.Queue[object]]::new()
$queue.Enqueue(@('com.android.billingclient', 'billing', '9.1.0', 'aar'))
$queue.Enqueue(@('com.google.androidbrowserhelper', 'androidbrowserhelper', '2.6.2', 'aar'))
$seen = @{}

function Download-Artifact([string]$relative, [string]$target, [bool]$required) {
  foreach ($repository in $repositories) {
    try {
      Invoke-WebRequest -Uri "$repository/$relative" -OutFile $target
      return $true
    } catch {
      if (Test-Path $target) { Remove-Item -LiteralPath $target -Force }
    }
  }
  if ($required) { throw "Could not download $relative from Google Maven or Maven Central." }
  return $false
}

while ($queue.Count -gt 0) {
  $coordinate = $queue.Dequeue()
  $group, $artifact, $version, $packaging = $coordinate
  if (-not $version -or $version -match '\$\{') { continue }
  $key = "$group`:$artifact`:$version"
  if ($seen.ContainsKey($key)) { continue }
  $seen[$key] = $true

  $folder = $group.Replace('.', '/') + "/$artifact/$version"
  $stem = "$artifact-$version"
  $artifactFolder = Join-Path $Destination $folder
  New-Item -ItemType Directory -Force $artifactFolder | Out-Null
  $pomPath = Join-Path $artifactFolder "$stem.pom"
  Download-Artifact "$folder/$stem.pom" $pomPath $true | Out-Null

  [xml]$pom = Get-Content -Raw $pomPath
  $ns = [System.Xml.XmlNamespaceManager]::new($pom.NameTable)
  $ns.AddNamespace('m', 'http://maven.apache.org/POM/4.0.0')
  $declaredPackaging = [string]$pom.project.packaging
  $extension = if ($declaredPackaging -eq 'aar') { 'aar' } elseif ($packaging -in @('aar', 'jar')) { $packaging } else { 'jar' }
  $binaryPath = Join-Path $artifactFolder "$stem.$extension"
  Download-Artifact "$folder/$stem.$extension" $binaryPath $false | Out-Null

  $properties = @{}
  foreach ($node in $pom.SelectNodes('/m:project/m:properties/*', $ns)) { $properties[$node.LocalName] = $node.InnerText }
  $properties['project.version'] = $version
  $properties['pom.version'] = $version

  foreach ($dependency in $pom.SelectNodes('/m:project/m:dependencies/m:dependency', $ns)) {
    $scope = $dependency.scope
    $optional = $dependency.optional
    if ($scope -in @('test', 'provided', 'system') -or $optional -eq 'true') { continue }
    $depVersion = [string]$dependency.version
    if ($depVersion -match '^\$\{(.+)\}$') { $depVersion = [string]$properties[$Matches[1]] }
    if ($depVersion -match '^\[([^,]+)\]$') { $depVersion = $Matches[1] }
    if (-not $depVersion) { continue }
    $depType = if ($dependency.type) { [string]$dependency.type } else { 'jar' }
    $queue.Enqueue(@([string]$dependency.groupId, [string]$dependency.artifactId, $depVersion, $depType))
  }
}

Write-Host "Downloaded $($seen.Count) Play Billing artifacts to $Destination"
