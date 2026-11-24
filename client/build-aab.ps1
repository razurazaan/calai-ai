# Builds the signed Android App Bundle (.aab) to upload to the Google Play Console.
# Usage:  .\build-aab.ps1            (raises the build number by 1, which every Play upload needs)
#         .\build-aab.ps1 -NoBump    (rebuild with the same build number, e.g. if an upload failed)
#
# The first run creates the upload key (D:\android-build\keys\calsnap-upload.jks) and asks for its
# password. BACK UP THAT FILE AND PASSWORD. Every future update must be signed with the same key.
#
# The app talks to the production server (https://calai-ai.onrender.com, see src/api.js).
# For a test APK pointing at another server, use build-apk.ps1 instead.
param([switch]$NoBump)
$ErrorActionPreference = "Stop"
$env:JAVA_HOME = "D:\android-build\jdk-21.0.13.0.2+1"
$env:GRADLE_USER_HOME = "D:\android-build\gradle"
$env:TMP = $env:TEMP = "D:\android-build\tmp"
Remove-Item Env:VITE_API_URL -ErrorAction SilentlyContinue # the release build always uses production

Set-Location $PSScriptRoot
$props = Join-Path $PSScriptRoot "android\keystore.properties"
$keyDir = "D:\android-build\keys"
$keystore = Join-Path $keyDir "calsnap-upload.jks"

# ---- 1. Upload key (first run only) ----
if (-not (Test-Path $props)) {
    if (Test-Path $keystore) {
        throw "$keystore exists but android\keystore.properties is missing. Recreate keystore.properties (storeFile, storePassword, keyAlias=calsnap-upload, keyPassword) instead of making a new key."
    }
    Write-Host "Creating the Play Store upload key. Choose a strong password (at least 6 characters) and write it down." -ForegroundColor Yellow
    $s1 = Read-Host "Key password" -AsSecureString
    $s2 = Read-Host "Repeat password" -AsSecureString
    $plain = { param($s) [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)) }
    $pw = & $plain $s1
    if ($pw -ne (& $plain $s2)) { throw "The passwords don't match." }
    if ($pw.Length -lt 6) { throw "The password must be at least 6 characters." }

    New-Item -ItemType Directory -Force $keyDir | Out-Null
    & "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v -keystore $keystore -alias calsnap-upload `
        -keyalg RSA -keysize 2048 -validity 10000 -storepass $pw -keypass $pw `
        -dname "CN=CalSnap, O=Fantek, C=IN"
    if ($LASTEXITCODE -ne 0) { throw "keytool failed" }
    @(
        "storeFile=$($keystore -replace '\\', '/')",
        "storePassword=$pw",
        "keyAlias=calsnap-upload",
        "keyPassword=$pw"
    ) | Set-Content -Encoding ASCII $props
    Write-Host ""
    Write-Host "Upload key created: $keystore" -ForegroundColor Green
    Write-Host "BACK UP this file and its password now (e.g. to a password manager). Without them you can't publish updates." -ForegroundColor Yellow
    Write-Host ""
}

# ---- 2. Build number (versionCode) ----
if (-not $NoBump) {
    node -e "const f='package.json',fs=require('fs'),p=JSON.parse(fs.readFileSync(f,'utf8'));p.nativeBuild=(p.nativeBuild||0)+1;fs.writeFileSync(f,JSON.stringify(p,null,2)+'\n')"
    if ($LASTEXITCODE -ne 0) { throw "Could not raise the build number" }
}
$version = node -p "require('./package.json').nativeVersion"
$build = node -p "require('./package.json').nativeBuild"
Write-Host "Building CalSnap $version (build $build)..."

# ---- 3. Web code -> Android project -> signed bundle ----
npm run build
if ($LASTEXITCODE -ne 0) { throw "Web build failed" }
npx cap sync android
if ($LASTEXITCODE -ne 0) { throw "cap sync failed" }
Push-Location android
try {
    .\gradlew.bat bundleRelease --no-daemon "-Djava.io.tmpdir=D:\android-build\tmp"
    if ($LASTEXITCODE -ne 0) { throw "Gradle build failed" }
} finally {
    Pop-Location
}

$out = "..\..\CalSnap-$version-build$build.aab"
Copy-Item android\app\build\outputs\bundle\release\app-release.aab $out -Force
Write-Host ""
Write-Host "AAB ready: $((Resolve-Path $out).Path)" -ForegroundColor Green
Write-Host "Upload it in Play Console -> Test and release -> (Internal testing or Production) -> Create new release."
