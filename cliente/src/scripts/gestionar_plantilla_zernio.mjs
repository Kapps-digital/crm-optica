import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: 'cliente/.env.local' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const optica = (await pool.query('SELECT zernio_api_key FROM "CRM_Opticas".opticas WHERE id = 2')).rows[0];
  const accountId = '6ae61c65629d278f3e7b2aee';

  const res = await fetch(`https://zernio.com/api/v1/whatsapp/templates?accountId=${accountId}`, {
    headers: { 'Authorization': `Bearer ${optica.zernio_api_key}` }
  });
  const data = await res.json();
  const plantillas = (data.templates || []);
  console.log("Total templates en Zernio:", plantillas.length);
  for (const t of plantillas) {
    console.log("---------------------------------------");
    console.log("Template:", t.id, t.name, t.status);
    console.log("Components:", JSON.stringify(t.components, null, 2));
  }

  await pool.end();
}

main().catch(console.error);
