# Builds the Android APK. Usage: .\build-apk.ps1 -ApiUrl https://your-server.com
# The address is compiled into the APK, so it is required: a LAN IP stops working when it changes.
param([Parameter(Mandatory = $true)][string]$ApiUrl)
$ErrorActionPreference = "Stop"
$env:JAVA_HOME = "D:\android-build\jdk-21.0.13.0.2+1"
$env:GRADLE_USER_HOME = "D:\android-build\gradle"
$env:TMP = $env:TEMP = "D:\android-build\tmp"
$env:VITE_API_URL = $ApiUrl

Set-Location $PSScriptRoot
npm run build
npx cap sync android
Push-Location android
.\gradlew.bat assembleDebug --no-daemon "-Djava.io.tmpdir=D:\android-build\tmp"
Pop-Location
Copy-Item android\app\build\outputs\apk\debug\app-debug.apk ..\..\CalSnap.apk -Force
Write-Host "APK ready: D:\new_platform\CalSnap.apk (server: $ApiUrl)"
