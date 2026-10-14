import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { pool } from '../base_datos/conexion.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jwctsfnkyfokrgtcjtxs.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3Y3RzZm5reWZva3JndGNqdHhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3OTE2NjgsImV4cCI6MjEwNjM2NzY2OH0.I5jL8UKofVyZCFqt2FxxqnTCxgmRNypoB3AsESKYNNo';

async function subirLogo() {
  const rutaArchivo = path.resolve('cliente/public/logo.jpeg');
  if (!fs.existsSync(rutaArchivo)) {
    console.error('No se encontró el archivo logo.jpeg en cliente/public');
    process.exit(1);
  }

  const buffer = fs.readFileSync(rutaArchivo);
  const nombreDestino = 'optica_1/logo.jpeg';
  const urlSubida = `${SUPABASE_URL}/storage/v1/object/logos-opticas/${nombreDestino}`;

  console.log(`Subiendo archivo a Supabase Storage: ${urlSubida}...`);

  const respuesta = await fetch(urlSubida, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body: buffer,
  });

  if (!respuesta.ok) {
    const errorTexto = await respuesta.text();
    console.error('Error al subir a Supabase Storage:', respuesta.status, errorTexto);
    process.exit(1);
  }

  const datosSubida = await respuesta.json();
  console.log('✓ Archivo subido exitosamente a Storage:', datosSubida);

  const urlPublica = `${SUPABASE_URL}/storage/v1/object/public/logos-opticas/${nombreDestino}`;
  console.log('✓ URL Pública generada:', urlPublica);

  // Actualizar en base de datos
  const resBd = await pool.query(
    'UPDATE "CRM_Opticas".opticas SET logo_url = $1 WHERE id = 1 RETURNING id, nombre, logo_url',
    [urlPublica]
  );

  console.log('✓ Base de datos actualizada con URL de Supabase:', resBd.rows[0]);
  process.exit(0);
}

subirLogo().catch((err) => {
  console.error('Error general:', err);
  process.exit(1);
});
