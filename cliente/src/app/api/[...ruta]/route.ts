import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import fs from 'node:fs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export const ENCABEZADOS_NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

import { base_datos as bdModulo } from '@/backend/base_datos/conexion.mjs';
import { compararCitasPorFechaYHora } from '@/utilidades/formato';
import { ClienteZernio } from '@/backend/servicios/cliente_zernio.mjs';
import { enviar_mensaje, esta_en_ventana_24_horas } from '@/backend/servicios/gestor_mensajeria.mjs';
import { sincronizar_conversaciones_zernio, sincronizar_mensajes_conversacion } from '@/backend/servicios/sincronizador_zernio.mjs';
import {
  obtenerSegmentosConConteo,
  obtenerPacientesDeSegmento,
  crearSegmentoPersonalizado,
  actualizarSegmentoPersonalizado,
  eliminarSegmentoPersonalizado,
} from '@/backend/servicios/gestor_segmentacion.mjs';
import {
  obtenerPlantillas,
  crearPlantilla,
  sincronizarPlantillasConZernio,
  obtenerCuotaDiaria,
  calcularAudienciaLote,
  lanzarLoteCampana,
  obtenerHistorialLotes,
  eliminarLoteCampana,
  obtenerMapaPlantillasPorNombre,
} from '@/backend/servicios/gestor_plantillas.mjs';
import {
  obtener_canales_optica,
  obtener_url_conexion_whatsapp,
  vincular_cuenta_whatsapp_activa,
  desconectar_canal_whatsapp,
  reconectar_canal_whatsapp,
  actualizar_datos_optica,
  subir_logo_storage_optica,
  eliminar_logo_storage_optica,
} from '@/backend/servicios/gestor_canales.mjs';
import {
  obtenerConfiguracionIA,
  guardarConfiguracionIA,
  alternarEstadoIAChat,
  obtenerMotivosDisponiblesOpticaBD,
  registrarConsumoIA,
  obtenerMetricasConsumoIA,
  obtenerDirectivaTonoIA,
} from '@/backend/servicios/motor_ia.mjs';

const base_datos = bdModulo as any;
const subirLogoStorage: any = subir_logo_storage_optica;

const SECRETO_JWT = process.env.JWT_SECRET || 'crm_optica_secreto_super_seguro_2026';

function extraerSesion(request: NextRequest): { usuario: any; optica_id: number } {
  const authHeader = request.headers.get('authorization');
  const opticaSolicitada = request.headers.get('x-optica-id') || request.nextUrl.searchParams.get('optica_id');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const usuario: any = jwt.verify(token, SECRETO_JWT);
      let optica_id = Number(usuario.optica_id) || 1;
      if (usuario.rol === 'admin' && opticaSolicitada) {
        optica_id = Number(opticaSolicitada);
      }
      return { usuario, optica_id };
    } catch {
      return { usuario: null, optica_id: 1 };
    }
  }

  return { usuario: null, optica_id: 1 };
}

async function procesarPeticion(
  metodo: string,
  request: NextRequest,
  segmentosRuta: string[]
): Promise<NextResponse | Response> {
  const rutaStr = segmentosRuta.join('/');
  const { usuario, optica_id } = extraerSesion(request);
  const searchParams = request.nextUrl.searchParams;

  let body: any = {};
  if (metodo === 'POST' || metodo === 'PUT' || metodo === 'PATCH') {
    try {
      body = await request.json();
    } catch {
      body = {};
    }
  }

  try {
    // 1. ESTADO DEL SISTEMA
    if (metodo === 'GET' && rutaStr === 'estado') {
      const total_contactos = (await base_datos.prepare('SELECT COUNT(*) AS total FROM contactos WHERE optica_id = ?').get(optica_id))?.total || 0;
      const total_conversaciones = (await base_datos.prepare('SELECT COUNT(*) AS total FROM conversaciones WHERE optica_id = ?').get(optica_id))?.total || 0;
      const total_mensajes = (await base_datos.prepare('SELECT COUNT(*) AS total FROM mensajes').get())?.total || 0;
      const eventos_recibidos = (await base_datos.prepare("SELECT COUNT(*) AS total FROM eventos_webhook WHERE estado = 'recibido'").get())?.total || 0;

      return NextResponse.json({
        sistema: 'CRM Óptica Serverless Vercel',
        estado: 'en_linea',
        motor_bd: 'Supabase PostgreSQL (CRM_Opticas)',
        optica_id,
        metricas: {
          total_contactos: Number(total_contactos),
          total_conversaciones: Number(total_conversaciones),
          total_mensajes: Number(total_mensajes),
          eventos_pendientes_sweeper: Number(eventos_recibidos),
        },
      });
    }

    // 2. AUTENTICACIÓN
    if (metodo === 'POST' && rutaStr === 'auth/login') {
      const { usuario: uNombre, contrasena } = body;
      if (!uNombre || !contrasena) {
        return NextResponse.json({ exito: false, error: 'Debe ingresar usuario y contraseña' }, { status: 400 });
      }
      const usuarioLimpio = String(uNombre).trim().toLowerCase();
      const usuarioDb = await base_datos.prepare(`
        SELECT 
          u.id, u.optica_id, u.nombre, u.usuario, u.hash_contrasena, u.rol, u.activo,
          o.nombre AS optica_nombre, o.slug AS optica_slug, o.logo_url AS optica_logo,
          o.color_primario, o.color_secundario, o.telefono AS optica_telefono,
          COALESCE(o.ia_habilitada, true) AS optica_ia_habilitada
        FROM usuarios u
        JOIN opticas o ON u.optica_id = o.id
        WHERE LOWER(u.usuario) = ? AND u.activo = true AND o.activo = true
      `).get(usuarioLimpio);

      if (!usuarioDb) {
        return NextResponse.json({ exito: false, error: 'Usuario o contraseña incorrectos' }, { status: 401 });
      }

      const coincide = bcrypt.compareSync(contrasena, usuarioDb.hash_contrasena);
      if (!coincide) {
        return NextResponse.json({ exito: false, error: 'Usuario o contraseña incorrectos' }, { status: 401 });
      }

      const token = jwt.sign(
        {
          id: Number(usuarioDb.id),
          usuario: usuarioDb.usuario,
          nombre: usuarioDb.nombre,
          rol: usuarioDb.rol,
          optica_id: Number(usuarioDb.optica_id),
        },
        SECRETO_JWT,
        { expiresIn: '7d' }
      );

      base_datos.prepare("UPDATE usuarios SET ultimo_acceso = datetime('now') WHERE id = ?").run(usuarioDb.id).catch(() => {});

      return NextResponse.json({
        exito: true,
        token,
        usuario: {
          id: Number(usuarioDb.id),
          usuario: usuarioDb.usuario,
          nombre: usuarioDb.nombre,
          rol: usuarioDb.rol,
          optica_id: Number(usuarioDb.optica_id),
        },
        optica: {
          id: Number(usuarioDb.optica_id),
          nombre: usuarioDb.optica_nombre,
          slug: usuarioDb.optica_slug,
          logo_url: usuarioDb.optica_logo,
          color_primario: usuarioDb.color_primario || '#0284c7',
          color_secundario: usuarioDb.color_secundario || '#0369a1',
          telefono: usuarioDb.optica_telefono,
          ia_habilitada: Boolean(usuarioDb.optica_ia_habilitada ?? true),
        },
      });
    }

    if (metodo === 'GET' && rutaStr === 'auth/perfil') {
      if (!usuario) {
        return NextResponse.json({ exito: false, error: 'Sesión no iniciada' }, { status: 401 });
      }
      const usuarioDb = await base_datos.prepare(`
        SELECT id, optica_id, nombre, usuario, rol FROM usuarios WHERE id = ? AND activo = true
      `).get(usuario.id);

      if (!usuarioDb) {
        return NextResponse.json({ exito: false, error: 'Usuario no encontrado' }, { status: 404 });
      }

      const opticaDb = await base_datos.prepare(`
        SELECT 
          id, nombre, slug, logo_url, color_primario, color_secundario, telefono,
          duracion_cita_minutos, control_meses_defecto, especialista_defecto,
          registro_profesional_defecto, motivo_cita_defecto, notificacion_auto_citas_whatsapp,
          dias_atencion, hora_inicio_atencion, hora_fin_atencion,
          COALESCE(ia_activa, true) AS ia_activa,
          COALESCE(ia_habilitada, true) AS ia_habilitada
        FROM opticas WHERE id = ? AND activo = true
      `).get(optica_id);

      return NextResponse.json({
        exito: true,
        usuario: {
          id: Number(usuarioDb.id),
          usuario: usuarioDb.usuario,
          nombre: usuarioDb.nombre,
          rol: usuarioDb.rol,
          optica_id: Number(usuarioDb.optica_id),
        },
        optica: opticaDb ? {
          id: Number(opticaDb.id),
          nombre: opticaDb.nombre,
          slug: opticaDb.slug,
          logo_url: opticaDb.logo_url,
          color_primario: opticaDb.color_primario || '#0284c7',
          color_secundario: opticaDb.color_secundario || '#0369a1',
          telefono: opticaDb.telefono,
          duracion_cita_minutos: Number(opticaDb.duracion_cita_minutos) || 30,
          control_meses_defecto: Number(opticaDb.control_meses_defecto) || 12,
          especialista_defecto: opticaDb.especialista_defecto || '',
          registro_profesional_defecto: opticaDb.registro_profesional_defecto || '',
          motivo_cita_defecto: opticaDb.motivo_cita_defecto || '',
          notificacion_auto_citas_whatsapp: opticaDb.notificacion_auto_citas_whatsapp !== false,
          dias_atencion: opticaDb.dias_atencion || 'Lunes a Domingo',
          hora_inicio_atencion: opticaDb.hora_inicio_atencion || '08:00 AM',
          hora_fin_atencion: opticaDb.hora_fin_atencion || '06:00 PM',
          ia_activa: Boolean(opticaDb.ia_activa ?? true),
          ia_habilitada: Boolean(opticaDb.ia_habilitada ?? true),
        } : null,
      });
    }

    if (metodo === 'GET' && rutaStr === 'opticas') {
      const opticas = await base_datos.prepare(`
        SELECT id, nombre, slug, logo_url, color_primario, color_secundario, telefono, activo,
               COALESCE(ia_activa, true) AS ia_activa,
               COALESCE(ia_habilitada, true) AS ia_habilitada
        FROM opticas WHERE activo = true ORDER BY id ASC
      `).all();
      return NextResponse.json({
        exito: true,
        opticas: opticas.map((o: any) => ({
          ...o,
          id: Number(o.id),
          ia_activa: Boolean(o.ia_activa ?? true),
          ia_habilitada: Boolean(o.ia_habilitada ?? true),
        })),
      });
    }

    // 3. CONVERSACIONES Y MENSAJES
    if (metodo === 'GET' && rutaStr === 'conversaciones') {
      const conversaciones = await base_datos.prepare(`
        SELECT 
          c.id, c.contacto_id, c.canal, c.id_cuenta_zernio, c.id_conversacion_zernio,
          c.ultimo_mensaje_entrante_en, c.ultimo_leido_en, c.estado,
          COALESCE(c.ia_activa, true) AS ia_activa,
          COALESCE(c.ia_pausada_por_humano, false) AS ia_pausada_por_humano,
          COALESCE(c.requiere_asesor_humano, false) AS requiere_asesor_humano,
          COALESCE(c.atendido_por_ia, false) AS atendido_por_ia,
          COALESCE(c.mensajes_no_leidos, 0) AS mensajes_no_leidos,
          co.nombre_completo AS contacto_nombre, co.telefono AS contacto_telefono,
          co.business_scoped_user_id AS contacto_bsuid,
          (SELECT texto FROM mensajes WHERE conversacion_id = c.id ORDER BY creado_en DESC, id DESC LIMIT 1) AS ultimo_mensaje_texto,
          (SELECT creado_en FROM mensajes WHERE conversacion_id = c.id ORDER BY creado_en DESC, id DESC LIMIT 1) AS ultimo_mensaje_fecha,
          (SELECT direccion FROM mensajes WHERE conversacion_id = c.id ORDER BY creado_en DESC, id DESC LIMIT 1) AS ultimo_mensaje_direccion,
          (
            SELECT COUNT(*)::int 
            FROM mensajes m 
            WHERE m.conversacion_id = c.id 
              AND m.direccion = 'entrante' 
              AND (c.ultimo_leido_en IS NULL OR m.creado_en > c.ultimo_leido_en)
          ) AS mensajes_entrantes_sin_leer
        FROM conversaciones c
        JOIN contactos co ON c.contacto_id = co.id
        WHERE c.optica_id = ?
        ORDER BY COALESCE(
          (SELECT MAX(creado_en) FROM mensajes WHERE conversacion_id = c.id),
          c.ultimo_mensaje_entrante_en,
          c.actualizado_en,
          c.creado_en
        ) DESC
      `).all(optica_id);

      const mapaPlantillas = await obtenerMapaPlantillasPorNombre(optica_id);

      const enriquecidas = conversaciones.map((conv: any) => {
        const entrantesSinLeer = Number(conv.mensajes_entrantes_sin_leer || 0);
        const enTablaNoLeidos = Number(conv.mensajes_no_leidos || 0);

        let cantidad_no_leidos = 0;
        if (conv.ultimo_mensaje_direccion !== 'saliente') {
          cantidad_no_leidos = Math.max(entrantesSinLeer, enTablaNoLeidos);
          const fechaMsg = conv.ultimo_mensaje_fecha ? new Date(conv.ultimo_mensaje_fecha).getTime() : 0;
          const fechaLeido = conv.ultimo_leido_en ? new Date(conv.ultimo_leido_en).getTime() : 0;
          if (conv.ultimo_mensaje_direccion === 'entrante' && (!fechaLeido || fechaMsg > fechaLeido) && cantidad_no_leidos === 0) {
            cantidad_no_leidos = 1;
          }
        }

        let ultimoTexto = conv.ultimo_mensaje_texto || '';
        const matchTemplate = ultimoTexto.match(/\[Template:\s*([a-zA-Z0-9_-]+)\]/i);
        if (matchTemplate) {
          const nombrePlantilla = matchTemplate[1].toLowerCase();
          const pInfo = mapaPlantillas.get(nombrePlantilla);
          if (pInfo) {
            const prefijo = pInfo.encabezado_tipo === 'IMAGEN' ? '📷 ' : (pInfo.encabezado_tipo === 'VIDEO' ? '📹 ' : '');
            ultimoTexto = `${prefijo}${pInfo.cuerpo || pInfo.etiqueta || pInfo.nombre}`;
          } else {
            ultimoTexto = `Plantilla: ${matchTemplate[1]}`;
          }
        }

        return {
          ...conv,
          ultimo_mensaje_texto: ultimoTexto,
          mensajes_no_leidos: cantidad_no_leidos,
          no_leido: cantidad_no_leidos > 0,
          ventana_24h_activa: esta_en_ventana_24_horas(conv.ultimo_mensaje_entrante_en),
          sin_contestar: conv.ultimo_mensaje_direccion === 'entrante',
          requiere_asesor_humano: Boolean(conv.requiere_asesor_humano),
          atendido_por_ia: Boolean(conv.atendido_por_ia),
        };
      });

      return NextResponse.json({ exito: true, conversaciones: enriquecidas }, { headers: ENCABEZADOS_NO_CACHE });
    }

    if (rutaStr === 'conversaciones/sincronizar') {
      const resultado = await sincronizar_conversaciones_zernio({ sincronizar_mensajes_profundo: true, max_conversaciones_mensajes: 15 });
      return NextResponse.json(resultado, { headers: ENCABEZADOS_NO_CACHE });
    }

    // Mensajes de conversación: conversaciones/:id/mensajes
    if (metodo === 'GET' && segmentosRuta[0] === 'conversaciones' && segmentosRuta[2] === 'mensajes') {
      const conversacion_id = segmentosRuta[1];
      const mensajes = await base_datos.prepare(`
        SELECT * FROM mensajes 
        WHERE conversacion_id = ? 
        AND (texto != '[Unsupported message]' OR url_adjunto IS NOT NULL)
        ORDER BY creado_en ASC, id ASC
      `).all(conversacion_id);

      const mapaPlantillas = await obtenerMapaPlantillasPorNombre(optica_id);
      const mensajesEnriquecidos = mensajes.map((m: any) => {
        let plantillaInfo = null;
        const match = (m.texto || '').match(/\[Template:\s*([a-zA-Z0-9_-]+)\]/i);
        if (match) {
          const p = mapaPlantillas.get(match[1].toLowerCase());
          if (p) plantillaInfo = p;
        }

        let tipoContenido = m.tipo_contenido;
        if (m.texto === '[reaction]' || (m.texto && /^\[reaction(?::\s*[^\]]+)?\]$/i.test(m.texto.trim()))) {
          tipoContenido = 'reaction';
        }

        let reaccionesNormalizadas: any[] = [];
        if (Array.isArray(m.reacciones)) {
          reaccionesNormalizadas = m.reacciones.map((r: any) => ({
            emoji: r.emoji,
            direccion: r.de_mi ? 'saliente' : (r.direccion || 'entrante'),
            id: r.id || undefined,
          }));
        } else if (typeof m.reacciones === 'string') {
          try {
            const parsed = JSON.parse(m.reacciones);
            if (Array.isArray(parsed)) {
              reaccionesNormalizadas = parsed.map((r: any) => ({
                emoji: r.emoji,
                direccion: r.de_mi ? 'saliente' : (r.direccion || 'entrante'),
                id: r.id || undefined,
              }));
            }
          } catch {}
        }

        return {
          ...m,
          tipo_contenido: tipoContenido,
          plantilla: plantillaInfo,
          reacciones: reaccionesNormalizadas,
          enviado_por_ia: Boolean(m.enviado_por_ia),
        };
      });

      return NextResponse.json({ exito: true, mensajes: mensajesEnriquecidos }, { headers: ENCABEZADOS_NO_CACHE });
    }

    // Resolver atención de asesor humano: conversaciones/:id/resolver-urgencia
    if (metodo === 'POST' && segmentosRuta[0] === 'conversaciones' && segmentosRuta[2] === 'resolver-urgencia') {
      const conversacion_id = segmentosRuta[1];
      await base_datos.prepare('UPDATE conversaciones SET requiere_asesor_humano = false, actualizado_en = now() WHERE id = ?').run(conversacion_id);
      return NextResponse.json({ exito: true, requiere_asesor_humano: false }, { headers: ENCABEZADOS_NO_CACHE });
    }

    // Motivos dinámicos de citas de la óptica
    if (metodo === 'GET' && rutaStr === 'configuracion/motivos-citas') {
      const motivos = await obtenerMotivosDisponiblesOpticaBD(optica_id);
      return NextResponse.json({ exito: true, motivos }, { headers: ENCABEZADOS_NO_CACHE });
    }

    // Marcar leído: conversaciones/:id/marcar-leido
    if (metodo === 'POST' && segmentosRuta[0] === 'conversaciones' && segmentosRuta[2] === 'marcar-leido') {
      const conversacion_id = segmentosRuta[1];
      await base_datos.prepare('UPDATE conversaciones SET mensajes_no_leidos = 0, ultimo_leido_en = now() WHERE id = ?').run(conversacion_id);
      const conv = await base_datos.prepare('SELECT * FROM conversaciones WHERE id = ?').get(conversacion_id);
      if (conv && conv.id_conversacion_zernio && conv.id_cuenta_zernio) {
        try {
          const cliente = new ClienteZernio();
          await cliente.solicitar(`/inbox/conversations/${conv.id_conversacion_zernio}/read`, {
            metodo: 'POST',
            cuerpo: { accountId: conv.id_cuenta_zernio },
            sin_reintentos: true,
          });
        } catch {}
      }
      return NextResponse.json({ exito: true });
    }

    // Enviar mensaje
    if (metodo === 'POST' && rutaStr === 'mensajes/enviar') {
      const { usar_plantilla, nombre_plantilla, idioma_plantilla, componentes_plantilla } = body;
      if (usar_plantilla || nombre_plantilla) {
        let plantilla_aprobada = null;
        if (nombre_plantilla) {
          plantilla_aprobada = await base_datos.prepare(`
            SELECT * FROM plantillas 
            WHERE (nombre = ? OR etiqueta = ?) AND (estado = 'APPROVED' OR estado = 'APROBADA')
            LIMIT 1
          `).get(nombre_plantilla, nombre_plantilla);
        }
        if (!plantilla_aprobada && usar_plantilla) {
          plantilla_aprobada = await base_datos.prepare(`
            SELECT * FROM plantillas 
            WHERE estado = 'APPROVED' OR estado = 'APROBADA'
            ORDER BY (CASE WHEN nombre = 'optica_digital' THEN 1 ELSE 2 END), id ASC LIMIT 1
          `).get();
        }

        if (plantilla_aprobada) {
          body.nombre_plantilla = plantilla_aprobada.nombre;
          body.idioma_plantilla = idioma_plantilla || plantilla_aprobada.idioma || 'es';
          if (!body.texto || body.texto.trim() === '') {
            body.texto = `[Template: ${plantilla_aprobada.nombre}]`;
          }
        }
      }

      // Los mensajes manuales enviados desde la interfaz son enviados por humanos
      body.enviado_por_ia = false;

      const resultado = await enviar_mensaje(body);
      if (!resultado.exito) {
        return NextResponse.json(resultado, { status: 400 });
      }

      // Si el asesor humano envió un mensaje manual, pausar la IA y resolver la alerta de urgencia
      if (body.conversacion_id) {
        try {
          await base_datos.prepare('UPDATE conversaciones SET ia_pausada_por_humano = TRUE, requiere_asesor_humano = FALSE WHERE id = ?').run(body.conversacion_id);
        } catch {}
      }

      return NextResponse.json(resultado);
    }

    // 4. CONTACTOS Y PACIENTES
    if (metodo === 'GET' && rutaStr === 'contactos') {
      const contactos = await base_datos.prepare(`
        SELECT 
          c.*, c.nombre_completo AS nombre,
          COALESCE(c.es_paciente, false) AS es_paciente,
          CAST((SELECT COUNT(*) FROM formulas_opticas WHERE contacto_id = c.id) AS INTEGER) AS total_formulas,
          CAST((SELECT COUNT(*) FROM citas WHERE contacto_id = c.id) AS INTEGER) AS total_citas,
          (SELECT fecha_examen FROM formulas_opticas WHERE contacto_id = c.id ORDER BY id DESC LIMIT 1) AS ultima_formula_fecha,
          (SELECT tipo_lente FROM formulas_opticas WHERE contacto_id = c.id ORDER BY id DESC LIMIT 1) AS ultimo_tipo_lente
        FROM contactos c
        WHERE c.optica_id = ?
        ORDER BY LOWER(TRIM(COALESCE(c.nombre_completo, ''))) ASC, c.actualizado_en DESC
      `).all(optica_id);
      return NextResponse.json({ exito: true, contactos });
    }

    if (metodo === 'POST' && rutaStr === 'contactos') {
      const { nombre, nombre_completo, tipo_documento = 'CC', cedula, documento, telefono, correo, edad, sexo = 'masculino', es_paciente = true } = body;
      const nombreFinal = String(nombre_completo || nombre || '').trim();
      const doc = String(cedula || documento || '').trim();
      const sexoFinal = sexo ? String(sexo).trim().toLowerCase() : 'masculino';

      if (!nombreFinal) {
        return NextResponse.json({ exito: false, error: 'El nombre completo es obligatorio' }, { status: 400 });
      }

      let existente = null;
      if (doc) {
        existente = await base_datos.prepare('SELECT * FROM contactos WHERE optica_id = ? AND TRIM(cedula) = TRIM(?)').get(optica_id, doc);
      }
      if (!existente && telefono && String(telefono).trim()) {
        existente = await base_datos.prepare('SELECT * FROM contactos WHERE optica_id = ? AND TRIM(telefono) = TRIM(?)').get(optica_id, String(telefono).trim());
      }

      if (existente) {
        await base_datos.prepare(`
          UPDATE contactos SET 
            nombre_completo = COALESCE(?, nombre_completo),
            tipo_documento = COALESCE(?, tipo_documento),
            cedula = COALESCE(?, cedula),
            telefono = COALESCE(?, telefono),
            correo = COALESCE(?, correo),
            edad = COALESCE(?, edad),
            sexo = COALESCE(?, sexo),
            es_paciente = ?,
            actualizado_en = datetime('now')
          WHERE id = ?
        `).run(nombreFinal, tipo_documento ? String(tipo_documento).trim().toUpperCase() : 'CC', doc || null, telefono ? String(telefono).trim() : null, correo ? String(correo).trim() : null, edad ? Number(edad) : null, sexoFinal, Boolean(es_paciente), existente.id);
        const actualizado = await base_datos.prepare('SELECT *, nombre_completo AS nombre FROM contactos WHERE id = ?').get(existente.id);
        return NextResponse.json({ exito: true, contacto: actualizado, actualizado: true });
      }

      const insercion = await base_datos.prepare(`
        INSERT INTO contactos (optica_id, nombre_completo, tipo_documento, cedula, telefono, correo, edad, sexo, es_paciente)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(optica_id, nombreFinal, tipo_documento ? String(tipo_documento).trim().toUpperCase() : 'CC', doc || null, telefono ? String(telefono).trim() : null, correo ? String(correo).trim() : null, edad ? Number(edad) : null, sexoFinal, Boolean(es_paciente));

      const nuevo = await base_datos.prepare('SELECT *, nombre_completo AS nombre FROM contactos WHERE id = ?').get(insercion.lastInsertRowid);
      return NextResponse.json({ exito: true, contacto: nuevo, creado: true });
    }

    if (metodo === 'GET' && segmentosRuta[0] === 'contactos' && segmentosRuta.length === 2) {
      const contactoId = segmentosRuta[1];
      const contacto = await base_datos.prepare('SELECT *, nombre_completo AS nombre FROM contactos WHERE id = ?').get(contactoId);
      if (!contacto) {
        return NextResponse.json({ exito: false, mensaje: 'Paciente no encontrado' }, { status: 404 });
      }
      const formulas = await base_datos.prepare(`
        SELECT 
          id, contacto_id, fecha_examen,
          od_esfera AS esfera_od, od_cilindro AS cilindro_od, od_eje AS eje_od, od_adicion AS adicion_od, od_agudeza_visual AS av_od,
          oi_esfera AS esfera_oi, oi_cilindro AS cilindro_oi, oi_eje AS eje_oi, oi_adicion AS adicion_oi, oi_agudeza_visual AS av_oi,
          distancia_pupilar, tipo_lente, observaciones, optometra, proximo_control AS proximo_control_en_meses, creado_en
        FROM formulas_opticas WHERE contacto_id = ? ORDER BY id DESC
      `).all(contactoId);
      const citas = await base_datos.prepare('SELECT * FROM citas WHERE contacto_id = ? ORDER BY fecha_cita DESC, hora_cita DESC').all(contactoId);
      return NextResponse.json({ exito: true, contacto, formulas, citas });
    }

    if (metodo === 'PUT' && segmentosRuta[0] === 'contactos' && segmentosRuta.length === 2) {
      const id = Number(segmentosRuta[1]);
      const actual = await base_datos.prepare('SELECT * FROM contactos WHERE id = ?').get(id);
      if (!actual) return NextResponse.json({ exito: false, error: 'Contacto no encontrado' }, { status: 404 });

      const { nombre, nombre_completo, tipo_documento, cedula, documento, telefono, correo, edad, sexo, es_paciente } = body;
      const nombreFinal = nombre_completo !== undefined ? nombre_completo : nombre;
      const doc = cedula !== undefined ? cedula : documento;

      await base_datos.prepare(`
        UPDATE contactos SET 
          nombre_completo = ?, tipo_documento = ?, cedula = ?, telefono = ?, correo = ?, edad = ?, sexo = ?, es_paciente = ?, actualizado_en = datetime('now')
        WHERE id = ?
      `).run(
        nombreFinal !== undefined ? (nombreFinal ? String(nombreFinal).trim() : null) : actual.nombre_completo,
        tipo_documento !== undefined ? (tipo_documento ? String(tipo_documento).trim().toUpperCase() : 'CC') : (actual.tipo_documento || 'CC'),
        doc !== undefined ? (doc ? String(doc).trim() : null) : actual.cedula,
        telefono !== undefined ? (telefono ? String(telefono).trim() : null) : actual.telefono,
        correo !== undefined ? (correo ? String(correo).trim() : null) : actual.correo,
        edad !== undefined ? (edad ? Number(edad) : null) : actual.edad,
        sexo !== undefined ? (sexo ? String(sexo).trim().toLowerCase() : 'masculino') : (actual.sexo || 'masculino'),
        es_paciente !== undefined ? Boolean(es_paciente) : actual.es_paciente,
        id
      );

      const actualizado = await base_datos.prepare('SELECT *, nombre_completo AS nombre FROM contactos WHERE id = ?').get(id);
      return NextResponse.json({ exito: true, contacto: actualizado });
    }

    // 5. FÓRMULAS
    if (metodo === 'POST' && (rutaStr === 'formulas' || (segmentosRuta[0] === 'contactos' && segmentosRuta[2] === 'formulas'))) {
      const contacto_id = segmentosRuta[1] || body.contacto_id;
      if (!contacto_id) return NextResponse.json({ exito: false, error: 'contacto_id es obligatorio' }, { status: 400 });

      const {
        esfera_od, od_esfera, cilindro_od, od_cilindro, eje_od, od_eje, adicion_od, od_adicion, av_od, od_agudeza_visual,
        esfera_oi, oi_esfera, cilindro_oi, oi_cilindro, eje_oi, oi_eje, adicion_oi, oi_adicion, av_oi, oi_agudeza_visual,
        distancia_pupilar, tipo_lente, observaciones, optometra, proximo_control, proximo_control_en_meses, fecha_examen,
      } = body;

      const insercion = await base_datos.prepare(`
        INSERT INTO formulas_opticas (
          contacto_id, optica_id, od_esfera, od_cilindro, od_eje, od_adicion, od_agudeza_visual,
          oi_esfera, oi_cilindro, oi_eje, oi_adicion, oi_agudeza_visual, distancia_pupilar, tipo_lente,
          observaciones, optometra, fecha_examen, proximo_control
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        contacto_id, optica_id,
        esfera_od ?? od_esfera ?? '+0.00', cilindro_od ?? od_cilindro ?? '-0.00', eje_od ?? od_eje ?? '0', adicion_od ?? od_adicion ?? '+0.00', av_od ?? od_agudeza_visual ?? '20/20',
        esfera_oi ?? oi_esfera ?? '+0.00', cilindro_oi ?? oi_cilindro ?? '-0.00', eje_oi ?? oi_eje ?? '0', adicion_oi ?? oi_adicion ?? '+0.00', av_oi ?? oi_agudeza_visual ?? '20/20',
        distancia_pupilar || '62 mm', tipo_lente || 'Monofocal Antirreflejo', observaciones || null, optometra || 'Dr. Samir Bolívar',
        fecha_examen ? fecha_examen.split('T')[0] : new Date().toISOString().split('T')[0],
        proximo_control_en_meses ? String(proximo_control_en_meses) : (proximo_control || '12')
      );

      await base_datos.prepare("UPDATE contactos SET actualizado_en = datetime('now') WHERE id = ?").run(contacto_id);
      return NextResponse.json({ exito: true, formula_id: Number(insercion.lastInsertRowid) });
    }

    // 6. CITAS
    if (metodo === 'GET' && rutaStr === 'citas') {
      const fecha_inicio = searchParams.get('fecha_inicio');
      const fecha_fin = searchParams.get('fecha_fin');
      const estado = searchParams.get('estado');
      const especialista = searchParams.get('especialista');

      let consulta = `
        SELECT c.*, COALESCE(c.estado, 'pendiente') AS estado,
          co.nombre_completo AS contacto_nombre, co.telefono AS contacto_telefono, co.correo AS contacto_correo,
          co.cedula AS contacto_cedula, co.tipo_documento AS contacto_tipo_documento, co.edad AS contacto_edad,
          co.sexo AS contacto_sexo
        FROM citas c LEFT JOIN contactos co ON co.id = c.contacto_id WHERE c.optica_id = ?
      `;
      const paramsSql: any[] = [optica_id];

      if (fecha_inicio && fecha_fin) {
        consulta += ` AND c.fecha_cita >= ? AND c.fecha_cita <= ?`;
        paramsSql.push(fecha_inicio, fecha_fin);
      } else if (fecha_inicio) {
        consulta += ` AND c.fecha_cita = ?`;
        paramsSql.push(fecha_inicio);
      }

      if (estado && estado !== 'todos') {
        consulta += ` AND c.estado = ?`;
        paramsSql.push(estado);
      }

      if (especialista && especialista !== 'todos') {
        consulta += ` AND c.especialista = ?`;
        paramsSql.push(especialista);
      }

      consulta += ` ORDER BY c.fecha_cita ASC, c.id ASC`;
      const citas = await base_datos.prepare(consulta).all(...paramsSql);
      const citasOrdenadas = (citas || []).sort(compararCitasPorFechaYHora);
      return NextResponse.json({ exito: true, citas: citasOrdenadas }, { headers: ENCABEZADOS_NO_CACHE });
    }

    // 6.1. NOTIFICACIONES INTELIGENTES CALCULADAS AL VUELO (HORA COLOMBIA)
    if (metodo === 'GET' && rutaStr === 'notificaciones') {
      try {
        const ahora = new Date();
        const fechaHoyCol = ahora.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

        const partesManana = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/Bogota',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).formatToParts(ahora);
        const ano = parseInt(partesManana.find((p) => p.type === 'year')?.value || '2026', 10);
        const mes = parseInt(partesManana.find((p) => p.type === 'month')?.value || '1', 10) - 1;
        const dia = parseInt(partesManana.find((p) => p.type === 'day')?.value || '1', 10);
        const fechaMananaObj = new Date(Date.UTC(ano, mes, dia));
        fechaMananaObj.setUTCDate(fechaMananaObj.getUTCDate() + 1);
        const fechaMananaCol = fechaMananaObj.toISOString().slice(0, 10);

        const notificaciones: any[] = [];

        // 1. Resumen de citas de HOY en Colombia (Solo si total > 0)
        const resHoy = await base_datos.prepare(
          `SELECT COUNT(*)::int AS total FROM citas WHERE optica_id = ? AND fecha_cita = ? AND estado != 'cancelada'`
        ).get(optica_id, fechaHoyCol);
        const totalCitasHoy = Number(resHoy?.total || 0);

        if (totalCitasHoy > 0) {
          notificaciones.push({
            id: `resumen_hoy_${fechaHoyCol}`,
            clave: `resumen_hoy_${fechaHoyCol}`,
            tipo: 'resumen_hoy',
            titulo: 'Citas programadas para hoy',
            subtitulo: totalCitasHoy === 1 ? '1 cita en agenda' : `${totalCitasHoy} citas en agenda`,
            mensaje: totalCitasHoy === 1
              ? 'Tienes 1 cita programada para el día de hoy.'
              : `Tienes ${totalCitasHoy} citas programadas para el día de hoy.`,
            etiqueta: 'Hoy',
            nivel_alerta: 'VERDE',
            es_urgente: false,
            es_resumen_diario: true,
            fecha_referencia: fechaHoyCol,
            fecha_creado: new Date().toISOString(),
            fecha_texto: 'Hoy',
            enlace_vista: 'citas',
            datos: { fecha: fechaHoyCol, total: totalCitasHoy },
          });
        }

        // 2. Resumen de citas de MAÑANA en Colombia (Solo si total > 0)
        const resManana = await base_datos.prepare(
          `SELECT COUNT(*)::int AS total FROM citas WHERE optica_id = ? AND fecha_cita = ? AND estado != 'cancelada'`
        ).get(optica_id, fechaMananaCol);
        const totalCitasManana = Number(resManana?.total || 0);

        if (totalCitasManana > 0) {
          notificaciones.push({
            id: `resumen_manana_${fechaMananaCol}`,
            clave: `resumen_manana_${fechaMananaCol}`,
            tipo: 'resumen_manana',
            titulo: 'Citas agendadas para mañana',
            subtitulo: totalCitasManana === 1 ? '1 cita programada' : `${totalCitasManana} citas programadas`,
            mensaje: totalCitasManana === 1
              ? 'Tienes 1 cita agendada para el día de mañana.'
              : `Tienes ${totalCitasManana} citas agendadas para el día de mañana.`,
            etiqueta: 'Mañana',
            nivel_alerta: 'AZUL',
            es_urgente: false,
            es_resumen_diario: true,
            fecha_referencia: fechaMananaCol,
            fecha_creado: new Date().toISOString(),
            fecha_texto: 'Mañana',
            enlace_vista: 'citas',
            datos: { fecha: fechaMananaCol, total: totalCitasManana },
          });
        }

        // 3. Pacientes que requieren asesor humano URGENTE (Chats en WhatsApp)
        const chatsUrgentes = await base_datos.prepare(`
          SELECT conv.id, conv.contacto_id, conv.actualizado_en,
            co.nombre_completo AS contacto_nombre, co.telefono AS contacto_telefono,
            (SELECT texto FROM mensajes WHERE conversacion_id = conv.id ORDER BY id DESC LIMIT 1) AS ultimo_texto
          FROM conversaciones conv
          LEFT JOIN contactos co ON co.id = conv.contacto_id
          WHERE conv.optica_id = ? AND conv.requiere_asesor_humano = TRUE
          ORDER BY conv.actualizado_en DESC
          LIMIT 8
        `).all(optica_id);

        for (const chat of (chatsUrgentes || [])) {
          const textoCorto = chat.ultimo_texto
            ? (chat.ultimo_texto.length > 70 ? `${chat.ultimo_texto.substring(0, 70)}...` : chat.ultimo_texto)
            : 'El paciente solicitó atención de un asesor humano.';

          notificaciones.push({
            id: `asesor_chat_${chat.id}`,
            clave: `asesor_chat_${chat.id}`,
            tipo: 'ia_requiere_asesor',
            titulo: chat.contacto_nombre || 'Paciente por WhatsApp',
            subtitulo: 'Requiere asesor humano',
            mensaje: textoCorto,
            etiqueta: 'Urgente',
            nivel_alerta: 'ROJO',
            es_urgente: true,
            fecha_creado: chat.actualizado_en,
            fecha_texto: 'Atención requerida',
            enlace_vista: 'mensajeria',
            datos: { conversacion_id: chat.id },
          });
        }

        // 4. Citas agendadas o reprogramadas recientemente por la IA
        const citasIa = await base_datos.prepare(`
          SELECT c.id, c.fecha_cita, c.hora_cita, c.motivo, c.especialista, c.creado_en, c.observaciones,
            co.nombre_completo AS contacto_nombre, co.telefono AS contacto_telefono
          FROM citas c
          LEFT JOIN contactos co ON co.id = c.contacto_id
          WHERE c.optica_id = ?
            AND (c.observaciones ILIKE '%Asistente Virtual%' OR c.observaciones ILIKE '%IA%')
            AND c.estado != 'cancelada'
          ORDER BY c.creado_en DESC, c.id DESC
          LIMIT 12
        `).all(optica_id);

        const formatearFechaLegible = (fechaIso: string): string => {
          if (!fechaIso) return '';
          const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
          const partes = String(fechaIso).split('-');
          if (partes.length === 3) {
            const ano = partes[0];
            const mes = meses[parseInt(partes[1], 10) - 1] || partes[1];
            const dia = parseInt(partes[2], 10);
            return `${dia} ${mes} ${ano}`;
          }
          return fechaIso;
        };

        const formatearFechaCorta = (fechaIso: string): string => {
          if (!fechaIso) return '';
          const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
          const partes = String(fechaIso).split('-');
          if (partes.length === 3) {
            const mes = meses[parseInt(partes[1], 10) - 1] || partes[1];
            const dia = parseInt(partes[2], 10);
            return `${dia} ${mes}`;
          }
          return fechaIso;
        };

        for (const cita of (citasIa || [])) {
          const esReprogramada = cita.observaciones?.toLowerCase().includes('reprogramada');
          const fechaAmigable = formatearFechaLegible(cita.fecha_cita);
          const fechaCorta = formatearFechaCorta(cita.fecha_cita);
          notificaciones.push({
            id: `cita_ia_${cita.id}`,
            clave: `cita_ia_${cita.id}`,
            tipo: esReprogramada ? 'cita_reprogramada_ia' : 'cita_agendada_ia',
            titulo: cita.contacto_nombre || 'Nuevo Paciente',
            subtitulo: cita.motivo || 'Examen de optometría',
            mensaje: `${esReprogramada ? 'Cita reprogramada para el' : 'Agendada para el'} ${fechaAmigable} a las ${cita.hora_cita}${cita.especialista ? ' con ' + cita.especialista : ''}.`,
            etiqueta: esReprogramada ? 'Reprogramada IA' : 'Agendada IA',
            nivel_alerta: esReprogramada ? 'AMARILLO' : 'VERDE',
            es_urgente: false,
            fecha_creado: cita.creado_en,
            fecha_texto: cita.fecha_cita === fechaHoyCol ? `Hoy • ${cita.hora_cita}` : `${fechaCorta} • ${cita.hora_cita}`,
            enlace_vista: 'citas',
            datos: { cita_id: cita.id, fecha_cita: cita.fecha_cita, fecha: cita.fecha_cita },
          });
        }

        return NextResponse.json({
          exito: true,
          notificaciones,
          total: notificaciones.length,
          total_urgentes: notificaciones.filter((n: any) => n.es_urgente).length,
        }, { headers: ENCABEZADOS_NO_CACHE });
      } catch (err: any) {
        console.error('Error al calcular notificaciones:', err.message);
        return NextResponse.json({ exito: false, notificaciones: [], error: err.message }, { status: 500 });
      }
    }

    if (metodo === 'POST' && (rutaStr === 'citas' || (segmentosRuta[0] === 'contactos' && segmentosRuta[2] === 'citas'))) {
      const contacto_id = segmentosRuta[1] || body.contacto_id;
      if (!contacto_id) return NextResponse.json({ exito: false, error: 'contacto_id es obligatorio' }, { status: 400 });

      const { fecha_cita, hora_cita, motivo, especialista, observaciones } = body;
      if (!fecha_cita || !hora_cita) return NextResponse.json({ exito: false, error: 'Fecha y hora requeridas' }, { status: 400 });

      const citaExistente = await base_datos.prepare(`
        SELECT id FROM citas 
        WHERE contacto_id = ? AND TRIM(fecha_cita) = TRIM(?) AND LOWER(TRIM(hora_cita)) = LOWER(TRIM(?))
          AND (estado IS NULL OR estado NOT IN ('cancelada', 'anulada'))
      `).get(contacto_id, fecha_cita, hora_cita);

      if (citaExistente) {
        return NextResponse.json({ exito: false, duplicada: true, error: 'Este paciente ya tiene una cita para esa fecha y hora.' }, { status: 409 });
      }

      const insercion = await base_datos.prepare(`
        INSERT INTO citas (contacto_id, optica_id, fecha_cita, hora_cita, motivo, especialista, observaciones)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(contacto_id, optica_id, fecha_cita, hora_cita, motivo || 'Examen visual y control', especialista || null, observaciones || null);

      await base_datos.prepare("UPDATE contactos SET actualizado_en = datetime('now') WHERE id = ?").run(contacto_id);
      return NextResponse.json({ exito: true, cita_id: Number(insercion.lastInsertRowid) });
    }

    if (metodo === 'PUT' && segmentosRuta[0] === 'citas' && segmentosRuta.length === 2) {
      const idCita = Number(segmentosRuta[1]);
      const citaActual = await base_datos.prepare('SELECT * FROM citas WHERE id = ?').get(idCita);
      if (!citaActual) return NextResponse.json({ exito: false, error: 'Cita no encontrada' }, { status: 404 });

      const { fecha_cita, hora_cita, motivo, especialista, observaciones, estado } = body;
      const nuevaFecha = fecha_cita || citaActual.fecha_cita;
      const nuevaHora = hora_cita || citaActual.hora_cita;
      const nuevoEstado = estado || citaActual.estado || 'pendiente';

      if (nuevoEstado !== 'cancelada' && (fecha_cita || hora_cita)) {
        const conflicto = await base_datos.prepare(`
          SELECT id FROM citas 
          WHERE contacto_id = ? AND TRIM(fecha_cita) = TRIM(?) AND LOWER(TRIM(hora_cita)) = LOWER(TRIM(?)) AND id != ?
            AND (estado IS NULL OR estado NOT IN ('cancelada', 'anulada'))
        `).get(citaActual.contacto_id, nuevaFecha, nuevaHora, idCita);
        if (conflicto) return NextResponse.json({ exito: false, duplicada: true, error: 'Horario ocupado' }, { status: 409 });
      }

      await base_datos.prepare(`
        UPDATE citas SET fecha_cita = ?, hora_cita = ?, motivo = ?, especialista = ?, observaciones = ?, estado = ? WHERE id = ?
      `).run(nuevaFecha, nuevaHora, motivo ?? citaActual.motivo, especialista ?? citaActual.especialista, observaciones ?? citaActual.observaciones, nuevoEstado, idCita);

      const citaActualizada = await base_datos.prepare('SELECT * FROM citas WHERE id = ?').get(idCita);
      return NextResponse.json({ exito: true, cita: citaActualizada });
    }

    if (metodo === 'DELETE' && segmentosRuta[0] === 'citas' && segmentosRuta.length === 2) {
      const idCita = Number(segmentosRuta[1]);
      await base_datos.prepare("UPDATE citas SET estado = 'cancelada' WHERE id = ?").run(idCita);
      return NextResponse.json({ exito: true, mensaje: 'Cita cancelada' });
    }

    // 7. AUTO-SEGMENTACIÓN
    if (metodo === 'GET' && rutaStr === 'segmentos') {
      const resultado = await obtenerSegmentosConConteo(optica_id);
      return NextResponse.json({ exito: true, ...resultado });
    }

    if (metodo === 'GET' && segmentosRuta[0] === 'segmentos' && segmentosRuta[2] === 'pacientes') {
      const resultado = await obtenerPacientesDeSegmento(segmentosRuta[1], optica_id);
      return NextResponse.json({ exito: true, ...resultado });
    }

    if (metodo === 'POST' && rutaStr === 'segmentos') {
      const nuevo = await crearSegmentoPersonalizado({ opticaId: optica_id, ...body });
      return NextResponse.json({ exito: true, segmento: nuevo }, { status: 201 });
    }

    if (metodo === 'PUT' && segmentosRuta[0] === 'segmentos' && segmentosRuta.length === 2) {
      const actualizado = await actualizarSegmentoPersonalizado({ idSegmento: segmentosRuta[1], opticaId: optica_id, ...body });
      return NextResponse.json({ exito: true, segmento: actualizado });
    }

    if (metodo === 'DELETE' && segmentosRuta[0] === 'segmentos' && segmentosRuta.length === 2) {
      const resultado = await eliminarSegmentoPersonalizado(segmentosRuta[1], optica_id);
      return NextResponse.json(resultado);
    }

    // 8. PLANTILLAS Y LOTES
    if (metodo === 'GET' && rutaStr === 'plantillas') {
      const plantillas = await obtenerPlantillas(optica_id);
      const cuota = await obtenerCuotaDiaria(optica_id);
      return NextResponse.json({ exito: true, plantillas, cuota });
    }

    if (metodo === 'POST' && rutaStr === 'plantillas') {
      const nueva = await crearPlantilla(optica_id, body);
      return NextResponse.json({ exito: true, plantilla: nueva });
    }

    if (metodo === 'POST' && rutaStr === 'plantillas/sincronizar-meta') {
      const resultado = await sincronizarPlantillasConZernio(optica_id);
      const plantillas = await obtenerPlantillas(optica_id);
      const cuota = await obtenerCuotaDiaria(optica_id);
      return NextResponse.json({ ...resultado, plantillas, cuota });
    }

    if (metodo === 'GET' && rutaStr === 'plantillas/cuota-diaria') {
      const cuota = await obtenerCuotaDiaria(optica_id);
      return NextResponse.json({ exito: true, cuota });
    }

    if (metodo === 'POST' && rutaStr === 'plantillas/calcular-lote') {
      const resultado = await calcularAudienciaLote(optica_id, body);
      return NextResponse.json(resultado);
    }

    if (metodo === 'POST' && rutaStr === 'plantillas/lanzar-lote') {
      const resultado = await lanzarLoteCampana(optica_id, body);
      return NextResponse.json(resultado);
    }

    if (metodo === 'GET' && rutaStr === 'plantillas/historial-lotes') {
      const historial = await obtenerHistorialLotes(optica_id);
      return NextResponse.json({ exito: true, historial });
    }

    if (metodo === 'DELETE' && segmentosRuta[0] === 'plantillas' && segmentosRuta[1] === 'lotes' && segmentosRuta.length === 3) {
      const resultado = await eliminarLoteCampana(optica_id, segmentosRuta[2]);
      return NextResponse.json(resultado);
    }

    // 9. CANALES Y CONFIGURACIÓN
    if (metodo === 'GET' && rutaStr === 'canales/estado') {
      const resultado = await obtener_canales_optica(optica_id);
      return NextResponse.json(resultado);
    }

    if (metodo === 'GET' && rutaStr === 'canales/conectar/whatsapp') {
      const redirect_url = searchParams.get('redirect_url') || `${request.nextUrl.origin}/api/canales/callback`;
      const resultado = await obtener_url_conexion_whatsapp(optica_id, redirect_url);
      return NextResponse.json(resultado);
    }

    if (metodo === 'POST' && rutaStr === 'canales/vincular') {
      const resultado = await vincular_cuenta_whatsapp_activa(optica_id);
      return NextResponse.json(resultado);
    }

    if (metodo === 'POST' && rutaStr === 'canales/reconectar') {
      const resultado = await reconectar_canal_whatsapp(optica_id);
      return NextResponse.json(resultado);
    }

    if (metodo === 'POST' && rutaStr === 'canales/desconectar') {
      const resultado = await desconectar_canal_whatsapp(optica_id, body);
      return NextResponse.json(resultado);
    }

    if (metodo === 'PUT' && rutaStr === 'configuracion/optica') {
      const resultado = await actualizar_datos_optica(optica_id, body);
      return NextResponse.json(resultado, { status: resultado.exito ? 200 : 400 });
    }

    if (metodo === 'POST' && rutaStr === 'configuracion/optica/logo') {
      const { imagen_base64, tipo_mime, nombre_archivo, optica_id: opticaIdBody } = body;
      if (!imagen_base64) return NextResponse.json({ exito: false, error: 'Imagen requerida' }, { status: 400 });
      const base64Limpio = imagen_base64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Limpio, 'base64');
      const idOpticaDestino = opticaIdBody ? Number(opticaIdBody) : optica_id;
      const resultado = await subirLogoStorage(idOpticaDestino, {
        buffer,
        tipo_mime: tipo_mime || 'image/png',
        nombre_original: nombre_archivo || 'logo.png',
      });
      return NextResponse.json(resultado);
    }

    if (metodo === 'DELETE' && rutaStr === 'configuracion/optica/logo') {
      const idOpticaDestino = body.optica_id ? Number(body.optica_id) : optica_id;
      await eliminar_logo_storage_optica(idOpticaDestino);
      await base_datos.prepare('UPDATE opticas SET logo_url = NULL WHERE id = ?').run(idOpticaDestino);
      return NextResponse.json({ exito: true });
    }

    // 9. CONFIGURACIÓN DEL AGENTE DE INTELIGENCIA ARTIFICIAL
    if (metodo === 'GET' && rutaStr === 'configuracion/ia') {
      const config = await obtenerConfiguracionIA(optica_id);
      return NextResponse.json({ exito: true, configuracion: config });
    }

    if (metodo === 'PUT' && rutaStr === 'configuracion/ia') {
      const resultado = await guardarConfiguracionIA(optica_id, body);
      return NextResponse.json(resultado);
    }

    if (metodo === 'POST' && segmentosRuta[0] === 'conversaciones' && segmentosRuta[2] === 'ia-toggle') {
      const conversacion_id = segmentosRuta[1];
      const resultado = await alternarEstadoIAChat(conversacion_id, body.activo !== false);
      return NextResponse.json(resultado);
    }

    if (metodo === 'POST' && rutaStr === 'configuracion/ia/probar') {
      const { mensaje_prueba, prompt_personalizado, faq_personalizado, tono, api_key_prueba, modelo } = body;
      const config = await obtenerConfiguracionIA(optica_id);
      if (config.ia_habilitada === false) {
        return NextResponse.json(
          { exito: false, error: 'El servicio de IA no está contratado o habilitado para esta óptica.' },
          { status: 403 }
        );
      }
      const mod = modelo || config.ia_modelo || 'gpt-4o-mini';
      let claveApi = api_key_prueba || config.ia_api_key;

      const esGemini = Boolean(
        (claveApi && (claveApi.startsWith('AQ.') || claveApi.startsWith('AIza'))) ||
        (mod && mod.toLowerCase().includes('gemini')) ||
        (process.env.GEMINI_API_KEY && claveApi === process.env.GEMINI_API_KEY)
      );

      if (!claveApi) {
        if (esGemini || (mod && mod.toLowerCase().includes('gemini'))) {
          claveApi = process.env.GEMINI_API_KEY;
        } else {
          claveApi = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
        }
      }

      if (!claveApi) {
        return NextResponse.json({
          exito: false,
          error: 'No hay ninguna clave de API configurada. Ingresa tu clave de OpenAI o Google Gemini para realizar pruebas.',
        }, { status: 400 });
      }

      try {
        const promptSistema = `Eres ${config.ia_nombre || 'Asistente Óptico'}, asistente virtual oficial de "${config.nombre || 'Óptica'}".
Tono y estilo de comunicación: ${obtenerDirectivaTonoIA(tono || config.ia_tono)}.
Reglas: Temperatura 0. No inventes precios ni diagnósticos. Si no sabes, ofrece contactar con un asesor humano.
Instrucciones del negocio: ${prompt_personalizado || config.ia_instrucciones || 'Atender amablemente.'}
Preguntas Frecuentes y Políticas: ${faq_personalizado || config.ia_preguntas_frecuentes || 'Horario regular de atención.'}
Paciente de prueba: Juan Pérez (Sin citas previas)`;

        if (esGemini || (claveApi && (claveApi.startsWith('AQ.') || claveApi.startsWith('AIza')))) {
          const modelosPrueba = [
            'gemini-flash-latest',
            'gemini-1.5-flash',
            mod,
            'gemini-3.5-flash',
            'gemini-3.1-flash-lite',
          ].filter((v, i, a) => v && a.indexOf(v) === i);

          let exitoGemini = false;
          let ultimoError = '';
          let textoRespuesta = '';
          let modeloUsado = modelosPrueba[0];
          let tokensEntrada = 0;
          let tokensSalida = 0;
          let tokensTotales = 0;

          for (const m of modelosPrueba) {
            const urlGemini = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${claveApi}`;
            const resp = await fetch(urlGemini, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: mensaje_prueba || 'Hola, ¿qué horario de atención tienen?' }] }],
                systemInstruction: { parts: [{ text: promptSistema }] },
                generationConfig: { temperature: 0.0, maxOutputTokens: 1500 },
              }),
            });

            if (resp.ok) {
              const data = await resp.json();
              textoRespuesta = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('').trim() || 'Sin respuesta generada.';
              modeloUsado = m;
              exitoGemini = true;

              if (data.usageMetadata) {
                tokensEntrada = Number(data.usageMetadata.promptTokenCount || 0);
                const salidaTexto = Number(data.usageMetadata.candidatesTokenCount || 0);
                const razonamiento = Number(data.usageMetadata.thoughtsTokenCount || 0);
                const totalApi = Number(data.usageMetadata.totalTokenCount || 0);
                
                if (totalApi > (tokensEntrada + salidaTexto)) {
                  tokensSalida = totalApi - tokensEntrada;
                  tokensTotales = totalApi;
                } else {
                  tokensSalida = salidaTexto + razonamiento;
                  tokensTotales = tokensEntrada + tokensSalida;
                }
              }
              break;
            } else {
              ultimoError = await resp.text();
            }
          }

          if (exitoGemini) {
            await registrarConsumoIA({
              optica_id,
              conversacion_id: null,
              mensaje_id: null,
              modelo: modeloUsado,
              tokens_entrada: tokensEntrada,
              tokens_salida: tokensSalida,
              tokens_totales: tokensTotales,
              tipo_evento: 'simulador_prueba',
            });

            return NextResponse.json({
              exito: true,
              respuesta: textoRespuesta,
              consumo: {
                modelo: modeloUsado,
                tokens_entrada: tokensEntrada,
                tokens_salida: tokensSalida,
                tokens_totales: tokensTotales,
              },
            });
          } else {
            return NextResponse.json({ exito: false, error: `Error de Google Gemini: ${ultimoError}` }, { status: 400 });
          }
        }

        const urlApi = 'https://api.openai.com/v1/chat/completions';
        const modeloOpenAI = mod || 'gpt-4o-mini';
        const cuerpoPrueba: Record<string, any> = {
          model: modeloOpenAI,
          messages: [
            { role: 'system', content: promptSistema },
            { role: 'user', content: mensaje_prueba || 'Hola, ¿qué horario de atención tienen?' },
          ],
          temperature: 0.0,
          max_completion_tokens: 1500,
        };
        if (modeloOpenAI.includes('luna') || modeloOpenAI.startsWith('o1') || modeloOpenAI.startsWith('o3')) {
          cuerpoPrueba.reasoning_effort = 'none';
        }

        const resp = await fetch(urlApi, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${claveApi}`,
          },
          body: JSON.stringify(cuerpoPrueba),
        });

        if (!resp.ok) {
          const errTxt = await resp.text();
          return NextResponse.json({ exito: false, error: `Error de OpenAI (${resp.status}): ${errTxt}` }, { status: 400 });
        }

        const data = await resp.json();
        const textoRespuesta = data.choices?.[0]?.message?.content || 'Sin respuesta generada.';
        const tokensEntrada = Number(data.usage?.prompt_tokens || 0);
        const tokensSalida = Number(data.usage?.completion_tokens || 0);
        const tokensTotales = Number(data.usage?.total_tokens || (tokensEntrada + tokensSalida));

        // Registrar consumo de tokens de prueba
        await registrarConsumoIA({
          optica_id,
          conversacion_id: null,
          mensaje_id: null,
          modelo: mod,
          tokens_entrada: tokensEntrada,
          tokens_salida: tokensSalida,
          tokens_totales: tokensTotales,
          tipo_evento: 'simulador_prueba',
        });

        return NextResponse.json({
          exito: true,
          respuesta: textoRespuesta,
          consumo: {
            modelo: mod,
            tokens_entrada: tokensEntrada,
            tokens_salida: tokensSalida,
            tokens_totales: tokensTotales,
          },
        });
      } catch (err: any) {
        return NextResponse.json({ exito: false, error: err.message }, { status: 500 });
      }
    }

    if (metodo === 'GET' && rutaStr === 'configuracion/ia/metricas-consumo') {
      if (usuario?.rol !== 'admin') {
        return NextResponse.json(
          { exito: false, error: 'Acceso restringido: solo el administrador general puede consultar las métricas de consumo.' },
          { status: 403 }
        );
      }
      const opticaParam = searchParams.get('optica_id');
      const opticaFiltro = opticaParam === 'todas' ? 'todas' : (opticaParam ? Number(opticaParam) : optica_id);
      const desde = searchParams.get('desde') || null;
      const hasta = searchParams.get('hasta') || null;
      const tipo_evento = searchParams.get('tipo_evento') || null;
      const modelo = searchParams.get('modelo') || null;

      const metricas = await obtenerMetricasConsumoIA({
        optica_id: opticaFiltro,
        desde,
        hasta,
        tipo_evento,
        modelo,
      });
      return NextResponse.json({ exito: true, ...metricas }, { headers: ENCABEZADOS_NO_CACHE });
    }

    // 10. PROXY MULTIMEDIA WHATSAPP / ZERNIO (IMÁGENES, AUDIOS, VIDEOS, DOCUMENTOS)
    if (
      metodo === 'GET' &&
      ((segmentosRuta[0] === 'media' && segmentosRuta[1] === 'whatsapp' && segmentosRuta.length >= 3) ||
       (segmentosRuta[0] === 'v1' && segmentosRuta[1] === 'whatsapp' && segmentosRuta[2] === 'media' && segmentosRuta.length >= 4))
    ) {
      const media_id = segmentosRuta[0] === 'media' ? segmentosRuta[2] : segmentosRuta[3];
      const account_id = searchParams.get('accountId') || searchParams.get('account_id') || process.env.ZERNIO_ACCOUNT_ID || '6ab6a5ade55ed05c5f3a902b';

      try {
        const url_zernio = `https://zernio.com/api/v1/whatsapp/media/${encodeURIComponent(media_id)}?accountId=${encodeURIComponent(account_id)}`;
        const respZernio = await fetch(url_zernio, {
          headers: {
            'Authorization': `Bearer ${process.env.ZERNIO_API_KEY}`,
          },
        });

        if (respZernio.status === 410) {
          return NextResponse.json({
            exito: false,
            expirado: true,
            error: 'Este archivo multimedia ha caducado en los servidores de WhatsApp.',
          }, { status: 410 });
        }

        if (!respZernio.ok) {
          return NextResponse.json({
            exito: false,
            error: `Error al obtener multimedia (${respZernio.status})`,
          }, { status: respZernio.status >= 500 ? 502 : respZernio.status });
        }

        const tipoContenido = respZernio.headers.get('content-type') || 'application/octet-stream';
        const buffer = await respZernio.arrayBuffer();

        return new Response(buffer, {
          status: 200,
          headers: {
            'Content-Type': tipoContenido,
            'Content-Length': String(buffer.byteLength),
            'Cache-Control': 'public, max-age=604800, immutable',
          },
        });
      } catch (errMedia: any) {
        console.error(`[Proxy Multimedia] Error al servir medio ${media_id}:`, errMedia);
        return NextResponse.json({ exito: false, error: 'Error al procesar archivo multimedia' }, { status: 502 });
      }
    }

    // 16. GESTIÓN DE USUARIOS DEL SISTEMA (SOLO ADMINISTRADOR GLOBAL)
    if (segmentosRuta[0] === 'usuarios') {
      if (!usuario || usuario.rol !== 'admin') {
        return NextResponse.json(
          { exito: false, error: 'Acceso no autorizado. Se requiere rol de Administrador Global.' },
          { status: 403 }
        );
      }

      // GET /api/usuarios
      if (metodo === 'GET' && rutaStr === 'usuarios') {
        const usuarios = await base_datos.prepare(`
          SELECT 
            u.id, u.optica_id, u.nombre, u.usuario, u.correo, u.rol, u.activo, u.ultimo_acceso, u.creado_en,
            o.nombre AS optica_nombre, o.color_primario AS optica_color
          FROM usuarios u
          LEFT JOIN opticas o ON u.optica_id = o.id
          ORDER BY u.id ASC
        `).all();

        const opticas = await base_datos.prepare(`
          SELECT 
            o.id, o.nombre, o.slug, o.telefono, o.color_primario, o.color_secundario, o.logo_url, o.activo, o.ia_activa,
            COALESCE(o.ia_habilitada, true) AS ia_habilitada,
            COUNT(u.id) AS total_usuarios
          FROM opticas o
          LEFT JOIN usuarios u ON u.optica_id = o.id
          GROUP BY o.id, o.nombre, o.slug, o.telefono, o.color_primario, o.color_secundario, o.logo_url, o.activo, o.ia_activa, o.ia_habilitada
          ORDER BY o.id ASC
        `).all();

        const totalUsuarios = usuarios.length;
        const totalActivos = usuarios.filter((u: any) => u.activo === true || u.activo === 1).length;
        const totalInactivos = totalUsuarios - totalActivos;
        const totalAdmins = usuarios.filter((u: any) => u.rol === 'admin').length;
        const totalAdminsOptica = usuarios.filter((u: any) => u.rol === 'admin_optica').length;

        return NextResponse.json({
          exito: true,
          usuarios,
          opticas,
          estadisticas: {
            total_usuarios: totalUsuarios,
            total_activos: totalActivos,
            total_inactivos: totalInactivos,
            total_opticas: opticas.length,
            total_admins: totalAdmins,
            total_admins_optica: totalAdminsOptica,
          },
        }, { headers: ENCABEZADOS_NO_CACHE });
      }

      // POST /api/usuarios (Crear nuevo usuario)
      if (metodo === 'POST' && rutaStr === 'usuarios') {
        const { nombre, usuario: uNombre, correo, contrasena, rol, optica_id: optId, activo = true } = body;

        if (!nombre || !String(nombre).trim()) {
          return NextResponse.json({ exito: false, error: 'El nombre completo es obligatorio.' }, { status: 400 });
        }
        if (!uNombre || !String(uNombre).trim()) {
          return NextResponse.json({ exito: false, error: 'El nombre de usuario es obligatorio.' }, { status: 400 });
        }
        if (!contrasena || String(contrasena).length < 4) {
          return NextResponse.json({ exito: false, error: 'La contraseña debe tener al menos 4 caracteres.' }, { status: 400 });
        }

        const rolValido = rol === 'admin_optica' ? 'admin_optica' : 'admin';
        const usuarioLimpio = String(uNombre).trim().toLowerCase();
        const idOpticaNumerico = Number(optId) || 1;

        // Verificar si el username ya está ocupado
        const usuarioExistente = await base_datos.prepare('SELECT id FROM usuarios WHERE LOWER(usuario) = ?').get(usuarioLimpio);
        if (usuarioExistente) {
          return NextResponse.json({ exito: false, error: `El nombre de usuario "${usuarioLimpio}" ya se encuentra registrado.` }, { status: 400 });
        }

        const hash = bcrypt.hashSync(contrasena, 10);
        const insercion = await base_datos.prepare(`
          INSERT INTO usuarios (optica_id, nombre, usuario, correo, hash_contrasena, rol, activo, creado_en)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          idOpticaNumerico,
          String(nombre).trim(),
          usuarioLimpio,
          correo ? String(correo).trim().toLowerCase() : null,
          hash,
          rolValido,
          activo !== false
        );

        const nuevoId = Number(insercion.lastInsertRowid);
        const usuarioCreado = await base_datos.prepare(`
          SELECT u.id, u.optica_id, u.nombre, u.usuario, u.correo, u.rol, u.activo, u.ultimo_acceso, u.creado_en, o.nombre AS optica_nombre
          FROM usuarios u LEFT JOIN opticas o ON u.optica_id = o.id WHERE u.id = ?
        `).get(nuevoId);

        return NextResponse.json({ exito: true, usuario: usuarioCreado });
      }

      // PUT /api/usuarios (Actualizar usuario existente)
      if (metodo === 'PUT' && rutaStr === 'usuarios') {
        const { id, nombre, usuario: uNombre, correo, contrasena, rol, optica_id: optId, activo } = body;
        const idNum = Number(id || segmentosRuta[1]);

        if (!idNum) {
          return NextResponse.json({ exito: false, error: 'ID de usuario no especificado.' }, { status: 400 });
        }

        const actual = await base_datos.prepare('SELECT * FROM usuarios WHERE id = ?').get(idNum);
        if (!actual) {
          return NextResponse.json({ exito: false, error: 'Usuario no encontrado.' }, { status: 404 });
        }

        // Protección: Si es el mismo usuario en sesión
        const esMismoUsuario = Number(usuario.id) === idNum;
        if (esMismoUsuario && activo === false) {
          return NextResponse.json({ exito: false, error: 'No puedes desactivar tu propia cuenta de administrador en sesión.' }, { status: 400 });
        }
        if (esMismoUsuario && rol !== 'admin') {
          return NextResponse.json({ exito: false, error: 'No puedes degradar tu propio rol de Administrador Global.' }, { status: 400 });
        }

        const usuarioLimpio = uNombre !== undefined ? String(uNombre).trim().toLowerCase() : actual.usuario;
        if (usuarioLimpio !== actual.usuario) {
          const conflicto = await base_datos.prepare('SELECT id FROM usuarios WHERE LOWER(usuario) = ? AND id != ?').get(usuarioLimpio, idNum);
          if (conflicto) {
            return NextResponse.json({ exito: false, error: `El nombre de usuario "${usuarioLimpio}" ya está en uso por otra persona.` }, { status: 400 });
          }
        }

        const rolFinal = rol === 'admin' || rol === 'admin_optica' ? rol : actual.rol;
        const hashFinal = contrasena && String(contrasena).trim().length >= 4
          ? bcrypt.hashSync(contrasena, 10)
          : actual.hash_contrasena;

        await base_datos.prepare(`
          UPDATE usuarios SET
            nombre = ?,
            usuario = ?,
            correo = ?,
            hash_contrasena = ?,
            rol = ?,
            optica_id = ?,
            activo = ?
          WHERE id = ?
        `).run(
          nombre !== undefined ? String(nombre).trim() : actual.nombre,
          usuarioLimpio,
          correo !== undefined ? (correo ? String(correo).trim().toLowerCase() : null) : actual.correo,
          hashFinal,
          rolFinal,
          optId !== undefined ? Number(optId) : actual.optica_id,
          activo !== undefined ? Boolean(activo) : actual.activo,
          idNum
        );

        const usuarioActualizado = await base_datos.prepare(`
          SELECT u.id, u.optica_id, u.nombre, u.usuario, u.correo, u.rol, u.activo, u.ultimo_acceso, u.creado_en, o.nombre AS optica_nombre
          FROM usuarios u LEFT JOIN opticas o ON u.optica_id = o.id WHERE u.id = ?
        `).get(idNum);

        return NextResponse.json({ exito: true, usuario: usuarioActualizado });
      }

      // PATCH /api/usuarios/estado (Alternar activo / inactivo)
      if (metodo === 'PATCH' && rutaStr === 'usuarios/estado') {
        const { id, activo } = body;
        const idNum = Number(id);
        if (!idNum) {
          return NextResponse.json({ exito: false, error: 'ID de usuario inválido.' }, { status: 400 });
        }

        if (Number(usuario.id) === idNum && activo === false) {
          return NextResponse.json({ exito: false, error: 'No puedes desactivar tu propia cuenta de administrador en sesión.' }, { status: 400 });
        }

        await base_datos.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').run(Boolean(activo), idNum);
        return NextResponse.json({ exito: true, id: idNum, activo: Boolean(activo) });
      }

      // DELETE /api/usuarios (Eliminar usuario)
      if (metodo === 'DELETE' && rutaStr === 'usuarios') {
        const idABorrar = Number(searchParams.get('id') || body.id);
        if (!idABorrar) {
          return NextResponse.json({ exito: false, error: 'ID de usuario obligatorio para eliminar.' }, { status: 400 });
        }

        if (Number(usuario.id) === idABorrar) {
          return NextResponse.json({ exito: false, error: 'No puedes eliminar tu propia cuenta de administrador en sesión.' }, { status: 400 });
        }

        await base_datos.prepare('DELETE FROM usuarios WHERE id = ?').run(idABorrar);
        return NextResponse.json({ exito: true, eliminado_id: idABorrar });
      }
    }

    // 17. GESTIÓN DE ÓPTICAS / SEDES
    if (segmentosRuta[0] === 'opticas') {
      // GET /api/opticas (Listar todas las sedes registradas para selectores y módulos)
      if (metodo === 'GET' && rutaStr === 'opticas') {
        const opticas = await base_datos.prepare(`
          SELECT 
            o.id, o.nombre, o.slug, o.telefono, o.color_primario, o.color_secundario, o.logo_url, o.activo, o.ia_activa,
            COALESCE(o.ia_habilitada, true) AS ia_habilitada,
            COUNT(u.id) AS total_usuarios
          FROM opticas o
          LEFT JOIN usuarios u ON u.optica_id = o.id
          GROUP BY o.id, o.nombre, o.slug, o.telefono, o.color_primario, o.color_secundario, o.logo_url, o.activo, o.ia_activa, o.ia_habilitada
          ORDER BY o.id ASC
        `).all();

        return NextResponse.json({ exito: true, opticas }, { headers: ENCABEZADOS_NO_CACHE });
      }

      // Solo administradores globales pueden crear o modificar sedes
      if (!usuario || usuario.rol !== 'admin') {
        return NextResponse.json(
          { exito: false, error: 'Acceso no autorizado. Se requieren privilegios de Administrador Global.' },
          { status: 403 }
        );
      }

      // POST /api/opticas (Crear nueva óptica)
      if (metodo === 'POST' && rutaStr === 'opticas') {
        const { nombre, slug, telefono, color_primario, color_secundario, logo_url, activo = true, ia_habilitada = true } = body;

        if (!nombre || !String(nombre).trim()) {
          return NextResponse.json({ exito: false, error: 'El nombre de la óptica es obligatorio.' }, { status: 400 });
        }

        const nombreLimpio = String(nombre).trim();
        let slugBase = slug && String(slug).trim()
          ? String(slug).trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-')
          : nombreLimpio
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '');

        if (!slugBase) slugBase = 'optica';

        // Asegurar que el slug sea único
        let slugFinal = slugBase;
        let contadorSlug = 1;
        while (true) {
          const existente = await base_datos.prepare('SELECT id FROM opticas WHERE slug = ?').get(slugFinal);
          if (!existente) break;
          contadorSlug++;
          slugFinal = `${slugBase}-${contadorSlug}`;
        }

        const colorPrimarioLimpio = color_primario && String(color_primario).trim()
          ? String(color_primario).trim()
          : '#0d2167';

        const colorSecundarioLimpio = color_secundario && String(color_secundario).trim()
          ? String(color_secundario).trim()
          : '#08133f';

        const telefonoLimpio = telefono && String(telefono).trim() ? String(telefono).trim() : null;
        const logoUrlLimpio = logo_url && String(logo_url).trim() ? String(logo_url).trim() : null;

        const resultado = await base_datos.prepare(`
          INSERT INTO opticas (nombre, slug, telefono, color_primario, color_secundario, logo_url, activo, ia_activa, ia_habilitada, creado_en)
          VALUES (?, ?, ?, ?, ?, ?, ?, true, ?, datetime('now'))
        `).run(
          nombreLimpio,
          slugFinal,
          telefonoLimpio,
          colorPrimarioLimpio,
          colorSecundarioLimpio,
          logoUrlLimpio,
          activo !== false,
          ia_habilitada !== false
        );

        const nuevaId = Number(resultado.lastInsertRowid);
        const opticaCreada = await base_datos.prepare(`
          SELECT o.id, o.nombre, o.slug, o.telefono, o.color_primario, o.color_secundario, o.logo_url, o.activo, o.ia_activa,
                 COALESCE(o.ia_habilitada, true) AS ia_habilitada,
                 0 AS total_usuarios
          FROM opticas o WHERE o.id = ?
        `).get(nuevaId);

        return NextResponse.json({ exito: true, optica: opticaCreada });
      }

      // PUT /api/opticas (Actualizar óptica existente)
      if (metodo === 'PUT' && rutaStr === 'opticas') {
        const { id, nombre, slug, telefono, color_primario, color_secundario, logo_url, activo, ia_habilitada } = body;
        const idNum = Number(id || segmentosRuta[1]);

        if (!idNum) {
          return NextResponse.json({ exito: false, error: 'ID de óptica obligatorio para actualizar.' }, { status: 400 });
        }

        const opticaActual = await base_datos.prepare('SELECT * FROM opticas WHERE id = ?').get(idNum);
        if (!opticaActual) {
          return NextResponse.json({ exito: false, error: 'La óptica especificada no existe.' }, { status: 404 });
        }

        const nombreFinal = nombre !== undefined ? String(nombre).trim() : opticaActual.nombre;
        if (!nombreFinal) {
          return NextResponse.json({ exito: false, error: 'El nombre de la óptica no puede estar vacío.' }, { status: 400 });
        }

        let slugFinal = opticaActual.slug;
        if (slug !== undefined && String(slug).trim()) {
          const slugPropuesto = String(slug).trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
          const conflictoSlug = await base_datos.prepare('SELECT id FROM opticas WHERE slug = ? AND id != ?').get(slugPropuesto, idNum);
          if (conflictoSlug) {
            return NextResponse.json({ exito: false, error: `El identificador "${slugPropuesto}" ya está en uso por otra óptica.` }, { status: 400 });
          }
          slugFinal = slugPropuesto;
        }

        const telefonoFinal = telefono !== undefined ? (String(telefono).trim() || null) : opticaActual.telefono;
        const colorPrimarioFinal = color_primario !== undefined ? String(color_primario).trim() : opticaActual.color_primario;
        const colorSecundarioFinal = color_secundario !== undefined ? String(color_secundario).trim() : opticaActual.color_secundario;
        const logoUrlFinal = logo_url !== undefined
          ? (logo_url && String(logo_url).trim() !== '' && String(logo_url).trim() !== 'null' ? String(logo_url).trim() : null)
          : opticaActual.logo_url;
        const activoFinal = activo !== undefined ? Boolean(activo) : Boolean(opticaActual.activo);
        const iaHabilitadaFinal = ia_habilitada !== undefined ? Boolean(ia_habilitada) : (opticaActual.ia_habilitada !== false);

        // Si se eliminó el logo corporativo, purgar físicamente los archivos de Storage
        if (logo_url !== undefined && logoUrlFinal === null && opticaActual.logo_url) {
          try {
            await eliminar_logo_storage_optica(idNum);
          } catch (errStorage) {
            console.warn('[Storage] Error purgando logo eliminado:', errStorage);
          }
        }

        await base_datos.prepare(`
          UPDATE opticas SET
            nombre = ?,
            slug = ?,
            telefono = ?,
            color_primario = ?,
            color_secundario = ?,
            logo_url = ?,
            activo = ?,
            ia_habilitada = ?
          WHERE id = ?
        `).run(nombreFinal, slugFinal, telefonoFinal, colorPrimarioFinal, colorSecundarioFinal, logoUrlFinal, activoFinal, iaHabilitadaFinal, idNum);

        const opticaActualizada = await base_datos.prepare(`
          SELECT o.id, o.nombre, o.slug, o.telefono, o.color_primario, o.color_secundario, o.logo_url, o.activo, o.ia_activa,
                 COALESCE(o.ia_habilitada, true) AS ia_habilitada,
                 COUNT(u.id) AS total_usuarios
          FROM opticas o
          LEFT JOIN usuarios u ON u.optica_id = o.id
          WHERE o.id = ?
          GROUP BY o.id, o.nombre, o.slug, o.telefono, o.color_primario, o.color_secundario, o.logo_url, o.activo, o.ia_activa, o.ia_habilitada
        `).get(idNum);

        return NextResponse.json({ exito: true, optica: opticaActualizada });
      }

      // PATCH /api/opticas/estado (Alternar activo / inactivo)
      if (metodo === 'PATCH' && rutaStr === 'opticas/estado') {
        const { id, activo } = body;
        const idNum = Number(id);
        if (!idNum) {
          return NextResponse.json({ exito: false, error: 'ID de óptica inválido.' }, { status: 400 });
        }

        // Si se va a desactivar, verificar que no sea la única óptica activa
        if (!activo) {
          const activas = await base_datos.prepare('SELECT COUNT(*) AS total FROM opticas WHERE activo = true').get();
          if (Number(activas?.total || 0) <= 1) {
            return NextResponse.json({ exito: false, error: 'Debe existir al menos una óptica activa en la plataforma.' }, { status: 400 });
          }
        }

        await base_datos.prepare('UPDATE opticas SET activo = ? WHERE id = ?').run(Boolean(activo), idNum);
        return NextResponse.json({ exito: true, id: idNum, activo: Boolean(activo) });
      }

      // PATCH /api/opticas/ia (Alternar servicio de IA habilitado / deshabilitado)
      if (metodo === 'PATCH' && (rutaStr === 'opticas/ia' || rutaStr === 'opticas/ia-habilitada')) {
        const { id, ia_habilitada } = body;
        const idNum = Number(id);
        if (!idNum) {
          return NextResponse.json({ exito: false, error: 'ID de óptica inválido.' }, { status: 400 });
        }

        await base_datos.prepare('UPDATE opticas SET ia_habilitada = ? WHERE id = ?').run(Boolean(ia_habilitada), idNum);
        return NextResponse.json({ exito: true, id: idNum, ia_habilitada: Boolean(ia_habilitada) });
      }
    }

    return NextResponse.json(
      { exito: false, error: `Ruta no encontrada: ${metodo} /api/${rutaStr}` },
      { status: 404 }
    );
  } catch (err: any) {
    console.error(`Error procesando API [${metodo} /api/${rutaStr}]:`, err);
    return NextResponse.json({ exito: false, error: err?.message || 'Error interno del servidor' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ ruta: string[] }> }) {
  const { ruta } = await context.params;
  return procesarPeticion('GET', request, ruta);
}

export async function POST(request: NextRequest, context: { params: Promise<{ ruta: string[] }> }) {
  const { ruta } = await context.params;
  return procesarPeticion('POST', request, ruta);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ ruta: string[] }> }) {
  const { ruta } = await context.params;
  return procesarPeticion('PUT', request, ruta);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ ruta: string[] }> }) {
  const { ruta } = await context.params;
  return procesarPeticion('DELETE', request, ruta);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ ruta: string[] }> }) {
  const { ruta } = await context.params;
  return procesarPeticion('PATCH', request, ruta);
}
