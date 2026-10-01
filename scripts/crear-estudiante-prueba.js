const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env.local or .env
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...vals] = trimmed.split('=');
      if (key && vals.length > 0) {
        process.env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  });
}

async function seedTestStudent() {
  const uriReportes = process.env.MONGODB_URI_REPORTES;
  const uriExamenes = process.env.MONGODB_URI_EXAMENES;

  const testStudent = {
    numeroDocumento: '12345678',
    nombreCompleto: 'JUAN PÉREZ (ESTUDIANTE PRUEBA 2°)',
    nombres: 'JUAN',
    apellidos: 'PÉREZ',
    curso: '201',
    grado: '2',
    esAdmision: true,
    activo: true,
    updatedAt: new Date(),
  };

  if (uriReportes) {
    const clientRep = new MongoClient(uriReportes);
    await clientRep.connect();
    await clientRep.db('reportes-cnslg').collection('students').updateOne(
      { numeroDocumento: '12345678' },
      { $set: testStudent },
      { upsert: true }
    );
    console.log('✓ Estudiante de prueba (Doc: 12345678) guardado en reportes-cnslg');
    await clientRep.close();
  }

  if (uriExamenes) {
    const clientEx = new MongoClient(uriExamenes);
    await clientEx.connect();
    await clientEx.db('examenes-cnslg').collection('students').updateOne(
      { numeroDocumento: '12345678' },
      { $set: testStudent },
      { upsert: true }
    );
    console.log('✓ Estudiante de prueba (Doc: 12345678) guardado en examenes-cnslg');
    await clientEx.close();
  }
}

seedTestStudent().catch(console.error);
