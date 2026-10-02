const fs = require('fs');
const path = require('path');

const srcDir = path.join(process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Local'), 'Temp', 'examenes-cnslg-dist');
const destDir = path.join(__dirname, '..', 'instalador');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

if (fs.existsSync(srcDir)) {
  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    if (file.endsWith('.exe')) {
      const srcFile = path.join(srcDir, file);
      const destFile = path.join(destDir, file);
      try {
        fs.copyFileSync(srcFile, destFile);
        console.log(`✓ Copiado a instalador: ${file}`);
      } catch (err) {
        if (err.code === 'EBUSY') {
          console.warn(`⚠️ Archivo en uso (${file}). No se pudo sobrescribir directamente porque la aplicación está abierta.`);
        } else {
          console.error(`Error copiando ${file}:`, err.message);
        }
      }
    }
  }
} else {
  console.log('No se encontró el directorio temporal de origen.');
}
