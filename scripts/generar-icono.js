const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createIcon() {
  const isotipoPath = path.resolve('D:/Proyectos/reportes/frontend/public/logo/isotipo.png');
  const outDir = path.resolve(__dirname, '../public');

  if (!fs.existsSync(isotipoPath)) {
    console.error('No se encontró el isotipo en:', isotipoPath);
    return;
  }

  // Target canvas size: 512x512
  const size = 512;

  // Resize isotipo to fit nicely with margin for badge
  const isotipoBuffer = await sharp(isotipoPath)
    .resize(400, 360, { fit: 'inside' })
    .toBuffer();

  // Create SVG badge with bold "TEST" text
  const badgeSvg = `
  <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Shadow for badge -->
      <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
        <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000000" flood-opacity="0.35"/>
      </filter>
      <!-- Gradient for badge -->
      <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0284c7" />
        <stop offset="100%" stop-color="#0f172a" />
      </linearGradient>
    </defs>

    <!-- Badge Container at bottom -->
    <rect x="76" y="380" width="360" height="96" rx="28" fill="url(#badgeGrad)" stroke="#38bdf8" stroke-width="5" filter="url(#shadow)" />
    
    <!-- Accent line -->
    <rect x="136" y="392" width="240" height="4" rx="2" fill="#38bdf8" opacity="0.8" />

    <!-- "TEST" Text -->
    <text x="256" y="450" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="52" fill="#ffffff" text-anchor="middle" letter-spacing="8">TEST</text>
  </svg>
  `;

  const badgeBuffer = Buffer.from(badgeSvg);

  // Composite isotipo (centered top) + badge (bottom) on 512x512 transparent background
  const composite512 = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: isotipoBuffer, top: 20, left: 56 },
      { input: badgeBuffer, top: 0, left: 0 },
    ])
    .png()
    .toBuffer();

  const pngPath = path.join(outDir, 'icon.png');
  const logoPath = path.join(outDir, 'logo-cnslg.png');
  fs.writeFileSync(pngPath, composite512);
  fs.writeFileSync(logoPath, composite512);
  console.log('✓ Icono PNG 512x512 creado en:', pngPath);

  // Generate 256x256 PNG
  const png256 = await sharp(composite512).resize(256, 256).png().toBuffer();
  fs.writeFileSync(path.join(outDir, 'icon-256.png'), png256);

  // Generate real Windows .ICO file with multiple resolutions (16, 32, 48, 64, 128, 256)
  await generateIcoFile([16, 32, 48, 64, 128, 256], composite512, path.join(outDir, 'icon.ico'));
}

async function generateIcoFile(sizes, srcPngBuffer, destIcoPath) {
  const pngBuffers = [];
  for (const s of sizes) {
    const buf = await sharp(srcPngBuffer).resize(s, s).png().toBuffer();
    pngBuffers.push({ size: s, buffer: buf });
  }

  // ICO Header (6 bytes)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // 1 = ICO
  header.writeUInt16LE(pngBuffers.length, 4); // Number of images

  // Calculate directory entries
  let offset = 6 + pngBuffers.length * 16;
  const dirEntries = [];
  const imageBodies = [];

  for (const item of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(item.size === 256 ? 0 : item.size, 0); // Width (0 means 256)
    entry.writeUInt8(item.size === 256 ? 0 : item.size, 1); // Height (0 means 256)
    entry.writeUInt8(0, 2); // Color count (0 = no palette)
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(item.buffer.length, 8); // Size of image data
    entry.writeUInt32LE(offset, 12); // Offset of image data

    dirEntries.push(entry);
    imageBodies.push(item.buffer);
    offset += item.buffer.length;
  }

  const finalIcoBuffer = Buffer.concat([header, ...dirEntries, ...imageBodies]);
  fs.writeFileSync(destIcoPath, finalIcoBuffer);
  console.log('✓ Icono Windows .ICO creado exitosamente en:', destIcoPath);
}

createIcon().catch(console.error);
