const { MongoClient } = require('mongodb');

async function syncStudentsCourses() {
  const uriReportes = 'mongodb+srv://admin:Sandekrfsc.1@pipezate-dev.hc8amla.mongodb.net/reportes-cnslg?retryWrites=true&w=majority&appName=pipezate-dev';
  const uriExamenes = 'mongodb+srv://admin:Sandekrfsc.1@pipezate-dev.hc8amla.mongodb.net/examenes-cnslg?retryWrites=true&w=majority&appName=pipezate-dev';

  const clientRep = new MongoClient(uriReportes);
  await clientRep.connect();
  const dbRep = clientRep.db('reportes-cnslg');

  const clientEx = new MongoClient(uriExamenes);
  await clientEx.connect();
  const dbEx = clientEx.db('examenes-cnslg');

  console.log('--- Obteniendo cursos más recientes por estudiante desde graderecords ---');
  const gradesAgg = await dbRep.collection('graderecords').aggregate([
    { $sort: { anioLectivo: -1, periodo: -1, updatedAt: -1 } },
    {
      $group: {
        _id: '$numeroDocumento',
        curso: { $first: '$curso' },
        cursoId: { $first: '$cursoId' },
        estudianteNombre: { $first: '$estudianteNombre' },
        tipoDocumento: { $first: '$tipoDocumento' }
      }
    }
  ]).toArray();

  console.log(`Encontrados ${gradesAgg.length} estudiantes con cursos en graderecords.`);

  const bulkOps = gradesAgg
    .filter(item => item._id && item.curso)
    .map(item => ({
      updateOne: {
        filter: { numeroDocumento: String(item._id).trim() },
        update: { $set: { curso: String(item.curso).trim() } },
        upsert: false
      }
    }));

  if (bulkOps.length > 0) {
    const res = await dbRep.collection('students').bulkWrite(bulkOps, { ordered: false });
    console.log(`BulkWrite completado en reportes-cnslg.students: ${res.modifiedCount} modificados, ${res.matchedCount} encontrados.`);
  }

  // Sync courses collection from reportes-cnslg to examenes-cnslg
  const courses = await dbRep.collection('courses').find().toArray();
  console.log(`Sincronizando ${courses.length} cursos a examenes-cnslg...`);
  const courseBulk = courses.map(c => ({
    updateOne: {
      filter: { nombre: c.nombre },
      update: { $set: { nombre: c.nombre, ordenDisplay: c.ordenDisplay, anioLectivo: c.anioLectivo || 2026, activo: true } },
      upsert: true
    }
  }));
  if (courseBulk.length > 0) {
    await dbEx.collection('courses').bulkWrite(courseBulk, { ordered: false });
  }

  // Check students count per course in reportes-cnslg
  const studentsPerCourse = await dbRep.collection('students').aggregate([
    { $match: { esAdmision: { $ne: true } } },
    { $group: { _id: '$curso', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]).toArray();

  console.log('\n--- Conteo de estudiantes por curso en reportes-cnslg.students ---');
  console.table(studentsPerCourse);

  const sinCurso = await dbRep.collection('students').countDocuments({
    esAdmision: { $ne: true },
    $or: [
      { curso: { $exists: false } },
      { curso: null },
      { curso: '' },
      { curso: 'Sin Curso' },
      { curso: 'sin_curso' }
    ]
  });
  console.log('Estudiantes sin curso en reportes-cnslg:', sinCurso);

  await clientRep.close();
  await clientEx.close();
}

syncStudentsCourses().catch(console.error);
