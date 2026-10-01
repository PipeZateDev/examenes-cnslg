#!/usr/bin/env node
/**
 * Script de setup inicial — crea el primer usuario administrador
 * Ejecutar: node scripts/setup.js
 */

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const MONGODB_URI = process.env.MONGODB_URI_EXAMENES ||
  'mongodb+srv://admin:Sandekrfsc.1@pipezate-dev.hc8amla.mongodb.net/examenes-cnslg?retryWrites=true&w=majority&appName=pipezate-dev';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

async function main() {
  console.log('\n🏫 exámenes CNSLG — Setup Inicial\n');
  
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db('examenes-cnslg');

  // Check if admin already exists
  const existing = await db.collection('ex_usuarios').findOne({ rol: 'admin' });
  if (existing) {
    console.log(`⚠️  Ya existe un administrador: ${existing.username}`);
    const confirm = await ask('¿Crear otro admin de todas formas? (s/N): ');
    if (confirm.toLowerCase() !== 's') {
      await client.close();
      rl.close();
      return;
    }
  }

  const username = await ask('Nombre de usuario (ej: admin): ');
  const password = await ask('Contraseña (mínimo 8 caracteres): ');
  const nombre = await ask('Nombre completo: ');

  if (!username || !password || password.length < 8) {
    console.error('❌ Datos inválidos');
    await client.close();
    rl.close();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  
  await db.collection('ex_usuarios').insertOne({
    username: username.toLowerCase().trim(),
    passwordHash,
    rol: 'admin',
    nombre,
    apellido: '',
    email: '',
    cursosAsignados: [],
    materiasAsignadas: [],
    activo: true,
    creadoEn: new Date(),
  });

  console.log(`\n✅ Administrador "${username}" creado exitosamente.`);
  console.log(`\nYa puedes iniciar el servidor y acceder con estas credenciales.\n`);

  await client.close();
  rl.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
