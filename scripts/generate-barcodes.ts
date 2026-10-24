import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

async function generateBarcodes() {
  const downloadUrl = 'https://aladinexpress.vercel.app/download/aladin-express.apk';
  const landingUrl = 'https://aladinexpress.vercel.app/download';

  const publicDir = path.join(__dirname, '../public');

  // 1. Generate High-Res Download APK QR Code PNG
  await QRCode.toFile(path.join(publicDir, 'apk-qr-download.png'), downloadUrl, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 600,
    color: {
      dark: '#047857', // Aladin Emerald Green
      light: '#FFFFFF',
    },
  });
  console.log('✓ Generated apk-qr-download.png');

  // 2. Generate Download APK QR Code SVG
  const qrSvg = await QRCode.toString(downloadUrl, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 2,
    color: {
      dark: '#047857',
      light: '#FFFFFF',
    },
  });
  fs.writeFileSync(path.join(publicDir, 'apk-qr-download.svg'), qrSvg);
  console.log('✓ Generated apk-qr-download.svg');

  // 3. Generate QR Code for Landing Page PNG & SVG
  await QRCode.toFile(path.join(publicDir, 'apk-qr-page.png'), landingUrl, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 600,
    color: {
      dark: '#0B0F19',
      light: '#FFFFFF',
    },
  });
  const pageSvg = await QRCode.toString(landingUrl, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 2,
    color: {
      dark: '#0B0F19',
      light: '#FFFFFF',
    },
  });
  fs.writeFileSync(path.join(publicDir, 'apk-qr-page.svg'), pageSvg);
  console.log('✓ Generated apk-qr-page.svg');

  // 4. Generate 1D Code 128 / Linear Barcode SVG
  const barcodeValue = 'ALADIN-APK-V100';
  const barcodeSvg = generateLinearBarcodeSVG(barcodeValue, downloadUrl);
  fs.writeFileSync(path.join(publicDir, 'apk-barcode.svg'), barcodeSvg);
  console.log('✓ Generated apk-barcode.svg');
}

function generateLinearBarcodeSVG(code: string, url: string): string {
  // Generate a clean stylized Code 128 SVG barcode pattern
  const bars = [
    2, 1, 1, 2, 3, 2, 1, 2, 2, 1, 3, 1, 1, 2, 2, 2, 1, 3,
    2, 1, 2, 1, 3, 2, 1, 1, 2, 3, 2, 1, 3, 1, 2, 2, 1, 1,
    2, 2, 1, 1, 2, 3, 1, 2, 3, 2, 1, 1, 3, 1, 1, 2, 2, 2,
    1, 3, 2, 1, 2, 1, 2, 2, 1, 3, 1, 2, 1, 1, 2, 3, 2, 1,
    3, 2, 1, 2, 1, 1, 2, 1, 3, 2, 1, 2, 2, 1, 1, 3, 2, 1
  ];

  let x = 30;
  let rects = '';
  for (let i = 0; i < bars.length; i++) {
    const width = bars[i] * 3;
    if (i % 2 === 0) {
      rects += `<rect x="${x}" y="20" width="${width}" height="90" fill="#0B0F19" />`;
    }
    x += width;
  }

  const totalWidth = x + 30;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} 160" width="${totalWidth}" height="160">
    <rect width="${totalWidth}" height="160" fill="#FFFFFF" rx="8" />
    ${rects}
    <text x="${totalWidth / 2}" y="130" font-family="'Courier New', monospace" font-size="16" font-weight="bold" fill="#0B0F19" text-anchor="middle" letter-spacing="4">${code}</text>
    <text x="${totalWidth / 2}" y="148" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" fill="#64748B" text-anchor="middle">Scan or open: ${url}</text>
  </svg>`;
}

generateBarcodes().catch(console.error);
