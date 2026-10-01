import { MongoClient, Db } from 'mongodb';

// ─── Reportes DB (read-only: students, courses) ───────────────────────────────
const MONGODB_URI_REPORTES = process.env.MONGODB_URI_REPORTES!;
let clientReportes: MongoClient;
let dbReportes: Db;

export async function getDbReportes(): Promise<Db> {
  if (dbReportes) return dbReportes;
  if (!clientReportes) {
    clientReportes = new MongoClient(MONGODB_URI_REPORTES);
    await clientReportes.connect();
  }
  dbReportes = clientReportes.db('reportes-cnslg');
  return dbReportes;
}

// ─── Exámenes DB (read-write) ─────────────────────────────────────────────────
const MONGODB_URI_EXAMENES = process.env.MONGODB_URI_EXAMENES!;
let clientExamenes: MongoClient;
let dbExamenes: Db;

export async function getDb(): Promise<Db> {
  if (dbExamenes) return dbExamenes;
  if (!clientExamenes) {
    clientExamenes = new MongoClient(MONGODB_URI_EXAMENES);
    await clientExamenes.connect();
  }
  dbExamenes = clientExamenes.db('examenes-cnslg');
  return dbExamenes;
}
