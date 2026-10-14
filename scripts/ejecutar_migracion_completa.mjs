import fs from 'node:fs';
import path from 'node:path';

const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'jwctsfnkyfokrgtcjtxs';
const SUPABASE_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';

async function ejecutarSqlSupabase(query) {
  const url = `https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const errorTexto = await res.text();
    throw new Error(`Error Supabase API (${res.status}): ${errorTexto}`);
  }

  return await res.json();
}

async function migrar() {
  console.log('--- Iniciando Migración SQLite a Supabase [CRM_Opticas] ---');
  const rutaLotes = path.resolve('datos/migracion_supabase/lotes.json');
  const lotes = JSON.parse(fs.readFileSync(rutaLotes, 'utf8'));

  console.log(`Cargados ${lotes.length} lotes de inserción.`);

  // Nota: Lotes 0, 1 y 2 ya fueron ejecutados previamente, pero ON CONFLICT DO NOTHING garantiza idempotencia total
  for (let i = 0; i < lotes.length; i++) {
    console.log(`Ejecutando lote ${i + 1}/${lotes.length}...`);
    try {
      await ejecutarSqlSupabase(lotes[i]);
      console.log(`✓ Lote ${i + 1} ejecutado exitosamente.`);
    } catch (err) {
      console.error(`✗ Error en lote ${i + 1}:`, err.message);
      process.exit(1);
    }
  }

  // Verificación de conteos en Supabase
  console.log('\n--- Verificando Conteos en Supabase CRM_Opticas ---');
  const tablas = ['eventos_webhook', 'contactos', 'conversaciones', 'mensajes', 'formulas_opticas', 'citas'];
  for (const tabla of tablas) {
    const res = await ejecutarSqlSupabase(`SELECT COUNT(*) as total FROM "CRM_Opticas".${tabla};`);
    console.log(`📊 "CRM_Opticas".${tabla}: ${res[0]?.total || 0} registros`);
  }

  console.log('\n¡MIGRACIÓN COMPLETADA EXITOSAMENTE!');
}

migrar();
