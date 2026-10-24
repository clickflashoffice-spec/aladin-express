$ErrorActionPreference = "Stop"

$sdkPath = "$env:LOCALAPPDATA\Android\Sdk"
$buildToolsVersion = "35.0.0"
$buildTools = "$sdkPath\build-tools\$buildToolsVersion"
$androidJar = "$sdkPath\platforms\android-36\android.jar"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "🚀 COMPILING ALADIN DRIVER ANDROID APK (RELEASE BUNDLE)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Using Android SDK: $sdkPath"
Write-Host "Using Build-Tools: $buildTools"
Write-Host "Using Platform:    $androidJar"

# Create build workspace directories
$buildDir = "c:\Users\alamo\Downloads\delivery\android-driver\build"
$genDir = "$buildDir\gen"
$classesDir = "$buildDir\classes"
$dexDir = "$buildDir\dex"
$outDir = "c:\Users\alamo\Downloads\delivery\dist\apk"

Remove-Item -Recurse -Force $genDir, $classesDir, $dexDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $buildDir, $genDir, $classesDir, $dexDir, $outDir | Out-Null

$resDir = "c:\Users\alamo\Downloads\delivery\android-driver\app\src\main\res"
$assetsDir = "c:\Users\alamo\Downloads\delivery\android-driver\app\src\main\assets"
$manifest = "c:\Users\alamo\Downloads\delivery\android-driver\app\src\main\AndroidManifest.xml"
$srcDir = "c:\Users\alamo\Downloads\delivery\android-driver\app\src\main\java"

# Step 1: Compile Android resources with aapt2
Write-Host "`n[1/7] Compiling Driver resources with aapt2..." -ForegroundColor Yellow
$compiledRes = "$buildDir\compiled_res.zip"
Remove-Item $compiledRes -Force -ErrorAction SilentlyContinue
& "$buildTools\aapt2.exe" compile --dir $resDir -o $compiledRes

# Step 2: Link resources and produce R.java + base APK with embedded offline assets
Write-Host "[2/7] Linking resources, assets, and generating R.java..." -ForegroundColor Yellow
$unalignedApk = "$buildDir\app-base.apk"
Remove-Item $unalignedApk -Force -ErrorAction SilentlyContinue
& "$buildTools\aapt2.exe" link -I $androidJar $compiledRes -A $assetsDir --manifest $manifest --java $genDir -o $unalignedApk --auto-add-overlay

# Step 3: Compile Java sources
Write-Host "[3/7] Compiling Java sources with javac..." -ForegroundColor Yellow
$javaFiles = Get-ChildItem -Path $srcDir, $genDir -Filter "*.java" -Recurse | Select-Object -ExpandProperty FullName
javac -target 17 -source 17 -cp $androidJar -d $classesDir $javaFiles

# Step 4: Convert Java bytecode to Dalvik DEX (d8)
Write-Host "[4/7] Generating classes.dex with d8..." -ForegroundColor Yellow
$classFiles = Get-ChildItem -Path $classesDir -Filter "*.class" -Recurse | Select-Object -ExpandProperty FullName
& "$buildTools\d8.bat" --release --min-api 24 --lib $androidJar --output $dexDir $classFiles

# Step 5: Package classes.dex into the APK
Write-Host "[5/7] Adding classes.dex to APK package..." -ForegroundColor Yellow
Set-Location $dexDir
jar -uf $unalignedApk classes.dex
Set-Location "c:\Users\alamo\Downloads\delivery"

# Step 6: 4-byte boundary alignment with zipalign
Write-Host "[6/7] Aligning APK with zipalign..." -ForegroundColor Yellow
$alignedApk = "$buildDir\app-aligned.apk"
Remove-Item $alignedApk -Force -ErrorAction SilentlyContinue
& "$buildTools\zipalign.exe" -p -f 4 $unalignedApk $alignedApk

# Step 7: Cryptographic signing with apksigner
Write-Host "[7/7] Signing release APK with apksigner (v1, v2, v3)..." -ForegroundColor Yellow
$keystore = "$buildDir\aladin-driver-release.jks"
$storePass = "aladindriver123"
$keyAlias = "aladin_driver"

if (-not (Test-Path $keystore)) {
    Write-Host "  Generating release signing key for Aladin Driver..." -ForegroundColor Gray
    keytool -genkeypair -validity 10000 -dname "CN=Aladin Driver, OU=Courier Logistics, O=Aladin Technologies, L=Tunis, C=TN" `
        -keystore $keystore -storepass $storePass -keypass $storePass -alias $keyAlias -keyalg RSA -keysize 2048
}

$finalApk = "$outDir\AladinDriver-v1.0.0-release.apk"
Remove-Item $finalApk -Force -ErrorAction SilentlyContinue
Copy-Item $alignedApk $finalApk

& "$buildTools\apksigner.bat" sign --ks $keystore --ks-pass "pass:$storePass" --ks-key-alias $keyAlias --key-pass "pass:$storePass" $finalApk

Write-Host "`nVerifying Driver APK cryptographic signature:" -ForegroundColor Cyan
& "$buildTools\apksigner.bat" verify --verbose $finalApk

$apkInfo = Get-Item $finalApk

# Synchronize final signed APK to web download directories
if (-not (Test-Path "c:\Users\alamo\Downloads\delivery\public\download")) {
    New-Item -ItemType Directory -Path "c:\Users\alamo\Downloads\delivery\public\download" -Force | Out-Null
}
Copy-Item $finalApk "c:\Users\alamo\Downloads\delivery\public\download\aladin-driver.apk" -Force
Copy-Item $finalApk "c:\Users\alamo\Downloads\delivery\public\aladin-driver.apk" -Force
Write-Host "Synchronized Driver APK to public web download stations." -ForegroundColor Cyan
Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "🎉 ALADIN DRIVER ANDROID APK BUILT & SIGNED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "Path:    $($apkInfo.FullName)" -ForegroundColor Green
Write-Host "Size:    $($apkInfo.Length) bytes ($([math]::Round($apkInfo.Length / 1KB, 2)) KB)" -ForegroundColor Green
Write-Host "Target:  Android 7.0+ (API 24 to API 35/36)" -ForegroundColor Green
Write-Host "Package: com.aladin.driver" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
