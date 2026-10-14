#!/usr/bin/env node
/**
 * Script para gestionar suscripciones de webhooks en Zernio por API para CRM Óptica.
 * 
 * Uso:
 *   node scripts/gestor_webhook.mjs                  -> Lista suscripciones y estado de fallos
 *   node scripts/gestor_webhook.mjs --url <URL>      -> Purgar duplicados y registrar/actualizar webhook único
 *   node scripts/gestor_webhook.mjs --purgar         -> Eliminar todos los webhooks registrados
 *   node scripts/gestor_webhook.mjs --url <URL> --probar -> Dispara evento de prueba (webhook.test)
 */
import { ClienteZernio } from '../cliente/src/backend/servicios/cliente_zernio.mjs';

const NOMBRE_SUSCRIPCION = 'CRM_Optica_Principal';

const EVENTOS_REQUERIDOS = [
  'conversation.started',
  'message.received',
  'message.sent',
  'message.delivered',
  'message.read',
  'message.failed',
  'message.edited',
  'message.deleted',
  'account.connected',
  'account.disconnected'
];

async function ejecutar() {
  const cliente = new ClienteZernio();
  const argumentos = process.argv.slice(2);

  const indice_url = argumentos.indexOf('--url');
  const url_objetivo = indice_url !== -1 ? argumentos[indice_url + 1] : null;
  const es_prueba = argumentos.includes('--probar') || argumentos.includes('--test');
  const es_purgar = argumentos.includes('--purgar');

  console.log('====================================================');
  console.log('       GESTOR DE WEBHOOKS ZERNIO - CRM ÓPTICA       ');
  console.log('====================================================\n');

  if (!cliente.clave_api) {
    console.log('⚠️  ZERNIO_API_KEY no está configurada en .env.');
    process.exit(1);
  }

  // 1. Obtener suscripciones existentes
  const resultado_listado = await cliente.solicitar('/webhooks/settings');
  if (!resultado_listado.exito) {
    console.error('❌ Error al consultar webhooks:', resultado_listado.error);
    process.exit(1);
  }

  const datos_webhooks = resultado_listado.datos;
  let suscripciones = [];
  if (Array.isArray(datos_webhooks)) {
    suscripciones = datos_webhooks;
  } else if (Array.isArray(datos_webhooks?.data)) {
    suscripciones = datos_webhooks.data;
  } else if (Array.isArray(datos_webhooks?.webhooks)) {
    suscripciones = datos_webhooks.webhooks;
  } else if (Array.isArray(datos_webhooks?.settings)) {
    suscripciones = datos_webhooks.settings;
  } else if (datos_webhooks && typeof datos_webhooks === 'object') {
    if (datos_webhooks.url || datos_webhooks.id || datos_webhooks._id) {
      suscripciones = [datos_webhooks];
    }
  }

  // 2. Si se solicitó --purgar
  if (es_purgar) {
    console.log(`Purgando ${suscripciones.length} webhooks registrados en Zernio...`);
    for (const sub of suscripciones) {
      const id = sub.id || sub._id;
      if (id) {
        const resDel = await cliente.solicitar(`/webhooks/settings?id=${id}`, { metodo: 'DELETE' });
        if (resDel.exito) {
          console.log(`  ✅ Eliminado: ${id} (${sub.url})`);
        } else {
          console.warn(`  ❌ Error al eliminar ${id}:`, resDel.error);
        }
      }
    }
    console.log('\n✅ Purga completada. No quedan webhooks registrados.');
    return;
  }

  // 3. Si solo se ejecuta sin argumentos, listar y auditar estado
  if (!url_objetivo) {
    console.log(`Suscripciones registradas encontradas: ${suscripciones.length}\n`);
    if (suscripciones.length === 0) {
      console.log('No tienes ningún webhook registrado aún en Zernio.');
    } else {
      for (const sub of suscripciones) {
        const id = sub.id || sub._id;
        const fallos = sub.failureCount ?? 0;
        const estado = sub.status || (fallos >= 10 ? 'INACTIVO_POR_FALLOS' : 'ACTIVO');
        console.log(`- [${estado}] ID: ${id} | Nombre: "${sub.name || 'Sin nombre'}"`);
        console.log(`  URL: ${sub.url}`);
        console.log(`  Fallos consecutivos: ${fallos}/10 | Eventos: ${(sub.events || []).join(', ')}`);

        if (fallos >= 10) {
          console.warn(`  ⚠️ ALERTA: Esta suscripción fue desactivada por Zernio debido a ${fallos} fallos consecutivos.`);
        }
      }
    }
    console.log('\nComandos disponibles:');
    console.log('  node scripts/gestor_webhook.mjs --url https://tu-dominio.com/api/webhook/zernio');
    console.log('  node scripts/gestor_webhook.mjs --purgar\n');
    return;
  }

  // 4. Registrar o actualizar garantizando webhook ÚNICO (sin acumular)
  const secreto_webhook = process.env.ZERNIO_WEBHOOK_SECRET;
  if (!secreto_webhook) {
    console.error('❌ Error: ZERNIO_WEBHOOK_SECRET no está configurado en .env.');
    process.exit(1);
  }

  // Eliminar cualquier webhook previo para evitar duplicados o eventos múltiples
  if (suscripciones.length > 0) {
    console.log(`Eliminando ${suscripciones.length} webhook(s) previo(s) para evitar duplicados...`);
    for (const sub of suscripciones) {
      const id = sub.id || sub._id;
      if (id) {
        await cliente.solicitar(`/webhooks/settings?id=${id}`, { metodo: 'DELETE' });
      }
    }
  }

  console.log(`Registrando webhook único "${NOMBRE_SUSCRIPCION}"...`);
  const resultado_creacion = await cliente.solicitar('/webhooks/settings', {
    metodo: 'POST',
    cuerpo: {
      name: NOMBRE_SUSCRIPCION,
      url: url_objetivo,
      secret: secreto_webhook,
      events: EVENTOS_REQUERIDOS,
    },
  });

  if (resultado_creacion.exito) {
    console.log('✅ Webhook registrado con éxito como único endpoint.');
  } else {
    console.error('❌ Error al registrar el webhook:', resultado_creacion.error);
  }

  // 5. Disparo de prueba si se solicitó
  if (es_prueba) {
    console.log('\nDisparando evento de prueba (webhook.test)...');
    const resultado_prueba = await cliente.solicitar('/webhooks/test', {
      metodo: 'POST',
      cuerpo: { url: url_objetivo },
    });

    if (resultado_prueba.exito) {
      console.log('✅ Evento de prueba emitido correctamente. Verifica que tu servidor responda 200.');
    } else {
      console.error('❌ Error al disparar la prueba de webhook:', resultado_prueba.error);
    }
  }
}

ejecutar();
