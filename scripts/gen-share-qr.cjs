const QRCode = require('qrcode');
const path = require('path');

const APK_URL = 'https://github.com/drwho2001/SHOS-V2/releases/latest';
const WEB_URL = 'https://drwho2001.github.io/SHOS-V2/';

(async () => {
  await QRCode.toFile(path.join('public', 'share-qr-apk.png'), APK_URL, {
    width: 400, margin: 2,
    color: { dark: '#1B1B1F', light: '#FFFFFF' },
  });
  await QRCode.toFile(path.join('public', 'share-qr-web.png'), WEB_URL, {
    width: 400, margin: 2,
    color: { dark: '#1B1B1F', light: '#FFFFFF' },
  });
  console.log('generated');
  console.log('APK ->', APK_URL);
  console.log('WEB ->', WEB_URL);
})();
