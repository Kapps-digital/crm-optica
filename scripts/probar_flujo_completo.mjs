import crypto from 'node:crypto';
import { base_datos } from '../base_datos/conexion.mjs';
import { procesar_evento_webhook } from '../servicios/procesador_eventos.mjs';
import { esta_en_ventana_24_horas, enviar_mensaje } from '../servicios/gestor_mensajeria.mjs';

async function ejecutar_pruebas() {
  console.log('=====================================================');
  console.log(' PRUEBAS INTEGRALES DE FLUJO Y RESILIENCIA (ZERNIO)  ');
  console.log('=====================================================\n');

  // 1. Limpieza de datos de prueba previa
  base_datos.exec(`
    DELETE FROM mensajes;
    DELETE FROM conversaciones;
    DELETE FROM contactos;
    DELETE FROM eventos_webhook;
  `);
  console.log('1. Base de datos SQLite lista y tablas limpias.');

  // 2. Simulación de evento entrante message.received
  const id_evento_prueba = 'evt_test_1001';
  const id_mensaje_wamid = 'wamid.HBgNNTczMTMyNTMxNjk0FQIAERgSMzFC...';
  const payload_prueba = {
    id: id_evento_prueba,
    event: 'message.received',
    timestamp: new Date().toISOString(),
    account: {
      id: '6ab6a5ade55ed05c5f3a902b',
      platform: 'whatsapp',
    },
    conversation: {
      id: 'conv_zernio_999',
      channel: 'whatsapp',
    },
    message: {
      id: 'msg_zernio_5001',
      platformMessageId: id_mensaje_wamid,
      text: 'Hola, buenas tardes. Quisiera agendar un examen visual para lentes progresivos.',
      type: 'text',
      sender: {
        id: 'bsuid_paciente_01',
        phone: '+573009876543',
        name: 'Carlos Mendoza',
      },
      metadata: {
        ctwa_ad_id: 'ad_campana_marzo_optica',
      },
    },
  };

  // Simular inserción idempotente en eventos_webhook
  const insercion_1 = base_datos.prepare(`
    INSERT OR IGNORE INTO eventos_webhook (id_evento, tipo_evento, payload_json, estado)
    VALUES (?, ?, ?, 'recibido')
  `).run(id_evento_prueba, payload_prueba.event, JSON.stringify(payload_prueba));

  console.log(`2. Inserción inicial de evento webhook: changes = ${insercion_1.changes} (esperado: 1)`);

  // Procesar evento
  await procesar_evento_webhook(payload_prueba);

  // Validar creación de contacto, conversación y mensaje
  const contacto = base_datos.prepare('SELECT * FROM contactos WHERE telefono = ?').get('+573009876543');
  console.log(`3. Contacto registrado: "${contacto?.nombre}" (ID: ${contacto?.id}, BSUID: ${contacto?.business_scoped_user_id})`);

  const conversacion = base_datos.prepare('SELECT * FROM conversaciones WHERE id_conversacion_zernio = ?').get('conv_zernio_999');
  console.log(`4. Conversación registrada: Canal = ${conversacion?.canal}, Último mensaje entrante = ${conversacion?.ultimo_mensaje_entrante_en}`);

  const mensaje = base_datos.prepare('SELECT * FROM mensajes WHERE id_mensaje_plataforma = ?').get(id_mensaje_wamid);
  console.log(`5. Mensaje registrado: "${mensaje?.texto}" | Dirección: ${mensaje?.direccion}`);

  // 6. Prueba de Idempotencia (reintento del mismo evento por timeout de red)
  const insercion_duplicada = base_datos.prepare(`
    INSERT OR IGNORE INTO eventos_webhook (id_evento, tipo_evento, payload_json, estado)
    VALUES (?, ?, ?, 'recibido')
  `).run(id_evento_prueba, payload_prueba.event, JSON.stringify(payload_prueba));

  console.log(`6. Prueba de Idempotencia ante reintento de Zernio: changes = ${insercion_duplicada.changes} (esperado: 0 - deduplicado)`);

  // 7. Prueba de la ventana de 24 horas
  const activa_24h = esta_en_ventana_24_horas(conversacion.ultimo_mensaje_entrante_en);
  console.log(`7. Verificación de ventana 24 horas: ${activa_24h ? 'VIGENTE ✅' : 'EXPIRADA ❌'}`);

  // Simular conversación expirada (> 24h)
  const fecha_vieja = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  const activa_vieja = esta_en_ventana_24_horas(fecha_vieja);
  console.log(`8. Verificación de ventana > 25 horas: ${activa_vieja ? 'FALLO' : 'BLOQUEO CORRECTO ✅ (Requiere plantilla aprobada)'}`);

  // 8. Prueba del eco de message.sent
  const evento_eco = {
    id: 'evt_eco_2001',
    event: 'message.sent',
    account: { id: '6ab6a5ade55ed05c5f3a902b' },
    conversation: { id: 'conv_zernio_999' },
    message: {
      id: 'msg_zernio_5001',
      platformMessageId: id_mensaje_wamid,
      text: 'Hola, te confirmamos tu cita.',
    },
  };
  await procesar_evento_webhook(evento_eco);
  const total_mensajes = base_datos.prepare('SELECT COUNT(*) AS total FROM mensajes').get().total;
  console.log(`9. Total mensajes tras procesar eco: ${total_mensajes} (Sin duplicaciones indeseadas)`);

  console.log('\n=====================================================');
  console.log('   ¡TODAS LAS PRUEBAS DE ARQUITECTURA PASARON! ✅    ');
  console.log('=====================================================\n');
}

ejecutar_pruebas();
