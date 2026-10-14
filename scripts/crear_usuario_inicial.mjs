import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../cliente/src/backend/base_datos/conexion.mjs';

async function crearUsuarios() {
  try {
    console.log('--- Creando Usuarios Iniciales en CRM_Opticas ---');

    // 1. Asegurar tabla lineas_canales en CRM_Opticas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "CRM_Opticas".lineas_canales (
        id SERIAL PRIMARY KEY,
        optica_id INTEGER NOT NULL REFERENCES "CRM_Opticas".opticas(id) ON DELETE CASCADE,
        canal VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
        numero VARCHAR(50) NOT NULL,
        id_cuenta_zernio VARCHAR(100),
        etiqueta VARCHAR(100) DEFAULT 'Línea Principal',
        estado VARCHAR(20) DEFAULT 'activa',
        es_predeterminada BOOLEAN DEFAULT true,
        creado_en TIMESTAMPTZ DEFAULT now(),
        actualizado_en TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log('✓ Tabla lineas_canales verificada/creada');

    // 2. Óptica 1: Tu Visión Óptica (Azul Institucional)
    const optica1Res = await pool.query(`
      INSERT INTO "CRM_Opticas".opticas (id, nombre, slug, logo_url, color_primario, color_secundario, activo)
      VALUES (1, 'Tu Visión Óptica', 'tu-vision', 'https://jwctsfnkyfokrgtcjtxs.supabase.co/storage/v1/object/public/logos-opticas/optica_1/logo.jpeg', '#0284c7', '#0369a1', true)
      ON CONFLICT (id) DO UPDATE SET 
        nombre = EXCLUDED.nombre,
        logo_url = EXCLUDED.logo_url,
        color_primario = EXCLUDED.color_primario,
        color_secundario = EXCLUDED.color_secundario,
        activo = true
      RETURNING id, nombre, logo_url;
    `);
    console.log('✓ Óptica 1 asegurada:', optica1Res.rows[0]);

    // 3. Óptica 2: Óptica Lumina (Verde Esmeralda)
    const optica2Res = await pool.query(`
      INSERT INTO "CRM_Opticas".opticas (id, nombre, slug, logo_url, color_primario, color_secundario, activo)
      VALUES (2, 'Óptica Lumina', 'optica-lumina', null, '#059669', '#047857', true)
      ON CONFLICT (id) DO UPDATE SET 
        nombre = EXCLUDED.nombre,
        color_primario = EXCLUDED.color_primario,
        color_secundario = EXCLUDED.color_secundario,
        activo = true
      RETURNING id, nombre;
    `);
    console.log('✓ Óptica 2 asegurada:', optica2Res.rows[0]);

    // Hashes para contraseñas
    const salt = bcrypt.genSaltSync(10);
    const hashSamir = bcrypt.hashSync('samand1904220122', salt);
    const hashAdmin = bcrypt.hashSync('admin123', salt);
    const hashLumina = bcrypt.hashSync('lumina123', salt);

    // 4. Usuario Superadministrador: 'admin' (rol: 'admin')
    const resAdmin = await pool.query(`
      INSERT INTO "CRM_Opticas".usuarios (optica_id, nombre, usuario, hash_contrasena, rol, activo)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (usuario) DO UPDATE SET 
        hash_contrasena = EXCLUDED.hash_contrasena,
        optica_id = EXCLUDED.optica_id,
        rol = EXCLUDED.rol,
        activo = true
      RETURNING id, usuario, nombre, rol, optica_id;
    `, [1, 'Super Administrador', 'admin', hashAdmin, 'admin']);
    console.log('✓ Superadministrador asegurado:', resAdmin.rows[0]);

    // 5. Usuario Óptica 1: 'samir' (rol: 'admin_optica')
    const resSamir = await pool.query(`
      INSERT INTO "CRM_Opticas".usuarios (optica_id, nombre, usuario, hash_contrasena, rol, activo)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (usuario) DO UPDATE SET 
        hash_contrasena = EXCLUDED.hash_contrasena,
        optica_id = EXCLUDED.optica_id,
        rol = EXCLUDED.rol,
        activo = true
      RETURNING id, usuario, nombre, rol, optica_id;
    `, [1, 'Dr. Samir Bolívar', 'samir', hashSamir, 'admin_optica']);
    console.log('✓ Admin Óptica 1 asegurado:', resSamir.rows[0]);

    // 6. Usuario Óptica 2: 'lumina' (rol: 'admin_optica')
    const resLumina = await pool.query(`
      INSERT INTO "CRM_Opticas".usuarios (optica_id, nombre, usuario, hash_contrasena, rol, activo)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (usuario) DO UPDATE SET 
        hash_contrasena = EXCLUDED.hash_contrasena,
        optica_id = EXCLUDED.optica_id,
        rol = EXCLUDED.rol,
        activo = true
      RETURNING id, usuario, nombre, rol, optica_id;
    `, [2, 'Dra. Elena Gómez', 'lumina', hashLumina, 'admin_optica']);
    console.log('✓ Admin Óptica 2 asegurado:', resLumina.rows[0]);

    // 7. Línea telefónica inicial
    await pool.query(`
      INSERT INTO "CRM_Opticas".lineas_canales (optica_id, canal, numero, id_cuenta_zernio, etiqueta, estado, es_predeterminada)
      VALUES (1, 'whatsapp', '+57 313 2531694', 'waba_principal_01', 'Línea WhatsApp Principal', 'activa', true)
      ON CONFLICT DO NOTHING;
    `);

    console.log('\n✅ Base de datos configurada para 2 roles y multi-inquilino:');
    console.log('  1. Superadmin: "admin" | Clave: "admin123" | Rol: "admin"');
    console.log('  2. Admin Óptica 1: "samir" | Clave: "samand1904220122" | Óptica: "Tu Visión Óptica" (Azul)');
    console.log('  3. Admin Óptica 2: "lumina" | Clave: "lumina123" | Óptica: "Óptica Lumina" (Verde)');

    await pool.end();
  } catch (error) {
    console.error('❌ Error al crear usuarios:', error);
    process.exit(1);
  }
}

crearUsuarios();
