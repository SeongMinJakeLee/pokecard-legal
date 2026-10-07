# Starts the Android emulator (if needed), forwards the Metro port and runs the Expo dev server.
# Usage: powershell -File scripts/dev-emulator.ps1 [-Avd Pixel_8]
# JS/TS changes hot-reload on the emulator; native changes (new native libs, app.json) need a rebuild:
#   cd mobile; npx expo prebuild --platform android --no-install; cd android; .\gradlew.bat assembleDebug
param([string]$Avd = "Pixel_8")

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
$adb = "$sdk\platform-tools\adb.exe"
$emulator = "$sdk\emulator\emulator.exe"
$root = Split-Path -Parent $PSScriptRoot

$running = (& $adb devices) -match "emulator-\d+\s+device"
if (-not $running) {
  Start-Process -FilePath $emulator -ArgumentList "-avd", $Avd
  & $adb wait-for-device
  do { Start-Sleep 3; $boot = (& $adb shell getprop sys.boot_completed 2>$null) -join "" } until ($boot.Trim() -eq "1")
}

& $adb reverse tcp:8081 tcp:8081 | Out-Null
$apk = "$root\mobile\android\app\build\outputs\apk\debug\app-debug.apk"
if (Test-Path $apk) { & $adb install -r $apk | Out-Null }

Set-Location "$root\mobile"
Start-Process -FilePath $adb -ArgumentList "shell", "monkey", "-p", "com.pokecard.app", "-c", "android.intent.category.LAUNCHER", "1" -NoNewWindow -Wait | Out-Null
npx expo start --port 8081 --offline
