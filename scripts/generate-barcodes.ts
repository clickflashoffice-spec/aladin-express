import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

async function generateBarcodes() {
  const consumerDownloadUrl = 'https://aladinexpress.vercel.app/download/aladin-express.apk';
  const driverDownloadUrl = 'https://aladinexpress.vercel.app/download/aladin-driver.apk';
  const landingUrl = 'https://aladinexpress.vercel.app/download';

  const publicDir = path.join(__dirname, '../public');

  // 1. Consumer App Download QR Code (Emerald Green)
  await QRCode.toFile(path.join(publicDir, 'apk-qr-download.png'), consumerDownloadUrl, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 600,
    color: {
      dark: '#047857', // Aladin Emerald Green
      light: '#FFFFFF',
    },
  });
  const consumerQrSvg = await QRCode.toString(consumerDownloadUrl, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 2,
    color: {
      dark: '#047857',
      light: '#FFFFFF',
    },
  });
  fs.writeFileSync(path.join(publicDir, 'apk-qr-download.svg'), consumerQrSvg);
  console.log('✓ Generated apk-qr-download.png & svg (Consumer)');

  // 2. Driver App Download QR Code (Amber Gold)
  await QRCode.toFile(path.join(publicDir, 'apk-qr-driver.png'), driverDownloadUrl, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 600,
    color: {
      dark: '#F59E0B', // Aladin Driver Amber
      light: '#FFFFFF',
    },
  });
  const driverQrSvg = await QRCode.toString(driverDownloadUrl, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 2,
    color: {
      dark: '#F59E0B',
      light: '#FFFFFF',
    },
  });
  fs.writeFileSync(path.join(publicDir, 'apk-qr-driver.svg'), driverQrSvg);
  console.log('✓ Generated apk-qr-driver.png & svg (Driver)');

  // 3. Portal Landing Page QR Code
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
  console.log('✓ Generated apk-qr-page.png & svg');

  // 4. Consumer 1D Barcode
  const consumerBarcode = generateLinearBarcodeSVG('ALADIN-EXP-V100', consumerDownloadUrl, '#047857');
  fs.writeFileSync(path.join(publicDir, 'apk-barcode.svg'), consumerBarcode);
  console.log('✓ Generated apk-barcode.svg');

  // 5. Driver 1D Barcode
  const driverBarcode = generateLinearBarcodeSVG('ALADIN-DRV-V100', driverDownloadUrl, '#D97706');
  fs.writeFileSync(path.join(publicDir, 'driver-barcode.svg'), driverBarcode);
  console.log('✓ Generated driver-barcode.svg');
}

function generateLinearBarcodeSVG(code: string, url: string, brandColor: string = '#0B0F19'): string {
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
    <text x="${totalWidth / 2}" y="130" font-family="'Courier New', monospace" font-size="16" font-weight="bold" fill="${brandColor}" text-anchor="middle" letter-spacing="4">${code}</text>
    <text x="${totalWidth / 2}" y="148" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="10" fill="#64748B" text-anchor="middle">Scan or open: ${url}</text>
  </svg>`;
}

generateBarcodes().catch(console.error);
