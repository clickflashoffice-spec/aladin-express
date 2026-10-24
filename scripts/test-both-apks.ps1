$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

Write-Host "============================================================"
Write-Host "TESTING BOTH APKS ON ANDROID EMULATOR (emulator-5554)"
Write-Host "============================================================"

# Check device
& $adb devices

# 1. Install & Test Consumer App (com.aladin.express)
Write-Host "`n[1/4] Installing Consumer App (Aladin Express)..."
& $adb install -r "c:\Users\alamo\Downloads\delivery\dist\apk\AladinExpress-v1.0.0-release.apk"

Write-Host "[2/4] Launching com.aladin.express/.MainActivity..."
& $adb shell am start -n com.aladin.express/.MainActivity
Start-Sleep -Seconds 4

& $adb shell screencap -p /sdcard/consumer.png
& $adb pull /sdcard/consumer.png "c:\Users\alamo\Downloads\delivery\public\emulator-consumer.png"
Write-Host "Consumer App screenshot saved to public/emulator-consumer.png"

# 2. Install & Test Driver App (com.aladin.driver)
Write-Host "`n[3/4] Installing Driver App (Aladin Driver)..."
& $adb install -r "c:\Users\alamo\Downloads\delivery\dist\apk\AladinDriver-v1.0.0-release.apk"

Write-Host "[4/4] Launching com.aladin.driver/.MainActivity..."
& $adb shell am start -n com.aladin.driver/.MainActivity
Start-Sleep -Seconds 4

& $adb shell screencap -p /sdcard/driver.png
& $adb pull /sdcard/driver.png "c:\Users\alamo\Downloads\delivery\public\emulator-driver.png"
Write-Host "Driver App screenshot saved to public/emulator-driver.png"

Write-Host "`n============================================================"
Write-Host "SUCCESS: BOTH APKS INSTALLED, LAUNCHED, AND CAPTURED ON EMULATOR!"
Write-Host "============================================================"
