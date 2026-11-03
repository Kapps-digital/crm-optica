import { pool } from '../backend/base_datos/conexion.mjs';

async function migrar() {
  console.log('Iniciando migración de unicidad de usuario por óptica...');

  // 1. Eliminar la restricción UNIQUE global previa sobre 'usuario'
  await pool.query(`
    ALTER TABLE "CRM_Opticas".usuarios 
    DROP CONSTRAINT IF EXISTS usuarios_usuario_key;
  `);
  console.log('Restricción usuarios_usuario_key eliminada con éxito.');

  // 2. Eliminar posibles índices únicos globales previos sobre 'usuario'
  await pool.query(`
    DROP INDEX IF EXISTS "CRM_Opticas".usuarios_usuario_key;
  `);

  // 3. Crear la restricción UNIQUE compuesta (optica_id, usuario)
  await pool.query(`
    ALTER TABLE "CRM_Opticas".usuarios 
    ADD CONSTRAINT usuarios_optica_usuario_key UNIQUE (optica_id, usuario);
  `);
  console.log('Restricción compuesta (optica_id, usuario) creada.');

  // 4. Crear índice único insensible a mayúsculas/minúsculas por óptica (optica_id, LOWER(usuario))
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_optica_usuario_lower 
    ON "CRM_Opticas".usuarios (optica_id, LOWER(usuario));
  `);
  console.log('Índice único (optica_id, LOWER(usuario)) creado.');

  // 5. Verificar estado de restricciones
  const res = await pool.query(`
    SELECT tc.constraint_name, tc.constraint_type, kcu.column_name 
    FROM information_schema.table_constraints tc 
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema 
    WHERE tc.table_name = 'usuarios' AND tc.table_schema = 'CRM_Opticas'
  `);
  console.log('Nuevas restricciones:', res.rows);

  process.exit(0);
}

migrar().catch(err => {
  console.error('Error durante la migración:', err);
  process.exit(1);
});

