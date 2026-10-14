import 'dotenv/config';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ClienteZernio } from '../servicios/cliente_zernio.mjs';

const cliente_zernio = new ClienteZernio();
const SECRETO = process.env.ZERNIO_WEBHOOK_SECRET;

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
  'account.disconnected',
];

let urlActual = null;
let procesoSsh = null;
let temporizadorPing = null;
let actualizandoWebhook = false;

function actualizarEnv(url) {
  try {
    const rutaEnv = path.resolve('.env');
    if (fs.existsSync(rutaEnv)) {
      let contenido = fs.readFileSync(rutaEnv, 'utf8');
      if (contenido.includes('URL_BASE_APLICACION=')) {
        contenido = contenido.replace(/URL_BASE_APLICACION=.*/g, `URL_BASE_APLICACION=${url}`);
      } else {
        contenido += `\nURL_BASE_APLICACION=${url}\n`;
      }
      fs.writeFileSync(rutaEnv, contenido, 'utf8');
      console.log(`📝 [Túnel] Archivo .env actualizado con URL_BASE_APLICACION=${url}`);
    }
  } catch (err) {
    console.warn('⚠️ [Túnel] No se pudo actualizar .env:', err.message);
  }
}

async function purgarWebhooksExistentes() {
  try {
    const res = await cliente_zernio.solicitar('/webhooks/settings');
    if (!res.exito) return;
    const datos = res.datos;
    let subs = [];
    if (Array.isArray(datos)) subs = datos;
    else if (Array.isArray(datos?.data)) subs = datos.data;
    else if (Array.isArray(datos?.webhooks)) subs = datos.webhooks;
    else if (Array.isArray(datos?.settings)) subs = datos.settings;

    if (subs.length > 0) {
      console.log(`🧹 [Zernio] Purgando ${subs.length} webhook(s) previo(s) para evitar acumulación...`);
      for (const item of subs) {
        const id = item.id || item._id;
        if (id) {
          await cliente_zernio.solicitar(`/webhooks/settings?id=${id}`, { metodo: 'DELETE' });
        }
      }
    }
  } catch (err) {
    console.warn(`⚠️ [Zernio] Error al purgar webhooks:`, err.message);
  }
}

async function actualizarWebhookEnZernio(nuevaUrl) {
  if (nuevaUrl === urlActual || actualizandoWebhook) return;
  actualizandoWebhook = true;
  urlActual = nuevaUrl;

  console.log(`\n🌐 [Túnel] Nueva URL detectada: ${nuevaUrl}`);
  actualizarEnv(nuevaUrl);

  const endpointWebhook = `${nuevaUrl}/api/webhook/zernio`;

  try {
    // 1. Purgar cualquier webhook anterior para garantizar que SIEMPRE exista exactamente 1
    await purgarWebhooksExistentes();

    // 2. Registrar el único webhook activo con todos los eventos requeridos
    const res = await cliente_zernio.solicitar('/webhooks/settings', {
      metodo: 'POST',
      cuerpo: {
        name: 'CRM_Optica_Principal_Auto',
        url: endpointWebhook,
        secret: SECRETO,
        events: EVENTOS_REQUERIDOS,
      },
    });

    if (res.exito) {
      console.log(`✅ [Zernio] Webhook único sincronizado exitosamente con: ${endpointWebhook}`);
    } else {
      console.warn(`⚠️ [Zernio] No se pudo registrar webhook:`, res.error);
    }
  } catch (err) {
    console.error(`❌ [Zernio] Error al actualizar webhook:`, err.message);
  } finally {
    actualizandoWebhook = false;
  }
}

function iniciarPingActividad() {
  if (temporizadorPing) clearInterval(temporizadorPing);
  temporizadorPing = setInterval(async () => {
    if (!urlActual) return;
    try {
      await fetch(`${urlActual}/api/estado`, { signal: AbortSignal.timeout(5000) });
    } catch {
      // Ignorar fallos de ping
    }
  }, 45000);
}

function iniciarTunel() {
  console.log('🚀 [Túnel] Iniciando conexión SSH con localhost.run...');

  procesoSsh = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=3',
    '-R', '80:127.0.0.1:3000',
    'nokey@localhost.run',
  ], {
    shell: true,
  });

  const procesarSalida = async (chunk) => {
    const texto = chunk.toString();
    const match = texto.match(/https:\/\/([a-z0-9]+\.lhr\.life)/i);
    if (match && match[0]) {
      const urlEncontrada = match[0].trim();
      await actualizarWebhookEnZernio(urlEncontrada);
      iniciarPingActividad();
    }
  };

  procesoSsh.stdout.on('data', procesarSalida);

  procesoSsh.stderr.on('data', async (chunk) => {
    await procesarSalida(chunk);
    const texto = chunk.toString();
    if (texto.includes('disconnect') || texto.includes('timeout')) {
      console.warn('⚠️ [Túnel] Advertencia SSH:', texto.trim());
    }
  });

  procesoSsh.on('close', (codigo) => {
    console.log(`🔄 [Túnel] Desconectado (código ${codigo}). Reiniciando en 3s...`);
    if (temporizadorPing) clearInterval(temporizadorPing);
    setTimeout(iniciarTunel, 3000);
  });

  procesoSsh.on('error', (err) => {
    console.error('❌ [Túnel] Error de proceso:', err.message);
    setTimeout(iniciarTunel, 3000);
  });
}

// Iniciar demonio permanente
iniciarTunel();
