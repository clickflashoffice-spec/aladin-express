$ErrorActionPreference = "Stop"

$adb = "C:\Users\alamo\AppData\Local\Android\Sdk\platform-tools\adb.exe"
$apk = "c:\Users\alamo\Downloads\delivery\dist\apk\AladinExpress-v1.0.0-release.apk"
$screenshotPath = "c:\Users\alamo\Downloads\delivery\public\emulator-screenshot.png"
$artifactPath = "C:\Users\alamo\.gemini\antigravity\brain\3d990a60-de1d-4371-8e34-f2f8cd006450\emulator-screenshot.png"

Write-Host "Waiting for Android Emulator device..." -ForegroundColor Cyan
& $adb wait-for-device

Write-Host "Waiting for Android system boot..." -ForegroundColor Cyan
for ($i = 0; $i -lt 30; $i++) {
    $boot = & $adb shell getprop sys.boot_completed
    if ($boot -match "1") {
        Write-Host "Android Boot Completed!" -ForegroundColor Green
        break
    }
    Start-Sleep -Seconds 2
}

Write-Host "Installing Aladin Express Release APK: $apk" -ForegroundColor Yellow
$installOutput = & $adb install -r $apk
Write-Host "Install Result: $installOutput" -ForegroundColor Green

Write-Host "Launching com.aladin.express/.MainActivity..." -ForegroundColor Yellow
& $adb shell am start -n com.aladin.express/.MainActivity

Write-Host "Waiting 5 seconds for webview and map rendering..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

Write-Host "Capturing screenshot..." -ForegroundColor Yellow
& $adb exec-out screencap -p > $screenshotPath
Copy-Item $screenshotPath $artifactPath -Force

Write-Host "Screenshot saved to: $screenshotPath" -ForegroundColor Green
Write-Host "Checking running process..." -ForegroundColor Cyan
$ps = & $adb shell pidof com.aladin.express
Write-Host "PID of com.aladin.express: $ps" -ForegroundColor Green

Write-Host "Checking recent logcat output..." -ForegroundColor Cyan
& $adb logcat -d -s Chromium:I,WebView:I,com.aladin.express:V -t 30
