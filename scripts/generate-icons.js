// Generate Apex app icons at all required sizes
// Run: node scripts/generate-icons.js
const fs = require('fs');
const path = require('path');
const { nativeImage } = require('electron');

const assetsDir = path.join(__dirname, '..', 'assets');

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4, 0);
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.4;
  const innerR = size * 0.22;
  const pad = size * 0.12;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // Background: rounded rect, dark
      const inBg = x > pad && x < size - pad && y > pad && y < size - pad;
      const bgCorner = Math.min(
        Math.min(x - pad, y - pad),
        Math.min(size - pad - x, size - pad - y)
      );

      if (inBg && bgCorner > 0) {
        // Dark background with subtle gradient
        const gradY = (y - pad) / (size - 2 * pad);
        const r = Math.floor(10 + gradY * 8);
        const g = Math.floor(10 + gradY * 12);
        const b = Math.floor(24 + gradY * 16);
        buf[i] = r;
        buf[i + 1] = g;
        buf[i + 2] = b;
        buf[i + 3] = 255;
      }

      // Diamond shape (A logo)
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy + size * 0.03);
      const dist = dx / outerR + dy / outerR;
      const innerDist = dx / innerR + dy / innerR;

      if (dist <= 1.0) {
        if (innerDist <= 1.0) {
          // Inner cutout - darker
          buf[i] = 8;
          buf[i + 1] = 8;
          buf[i + 2] = 20;
          buf[i + 3] = 255;
        } else {
          // Gold diamond
          const edgeAlpha = dist > 0.85 ? Math.floor(255 * (1 - dist) / 0.15) : 255;
          buf[i] = Math.floor(0xC9 * edgeAlpha / 255);
          buf[i + 1] = Math.floor(0xA5 * edgeAlpha / 255);
          buf[i + 2] = Math.floor(0x5C * edgeAlpha / 255);
          buf[i + 3] = 255;
        }
      }
    }
  }

  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

// Generate icons
const sizes = [16, 32, 48, 64, 128, 256];
sizes.forEach((s) => {
  const img = drawIcon(s);
  const png = img.toPNG();
  fs.writeFileSync(path.join(assetsDir, `icon-${s}.png`), png);
  console.log(`icon-${s}.png generated`);
});

// Generate .ico (just use 256 as source)
const big = drawIcon(256);
fs.writeFileSync(path.join(assetsDir, 'icon.ico'), big.toPNG()); // Simplified; real .ico needs special format
console.log('icon.ico generated');
console.log('All icons generated in assets/');
