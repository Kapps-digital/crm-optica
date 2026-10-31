import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { base_datos } from '@/backend/base_datos/conexion.mjs';
import { procesar_evento_webhook } from '@/backend/servicios/procesador_eventos.mjs';

const SECRETO_WEBHOOK = process.env.ZERNIO_WEBHOOK_SECRET;

function validarFirmaWebhook(cuerpoCrudo: string, firmaRecibida: string | null, secreto?: string): boolean {
  if (!secreto || !firmaRecibida || typeof cuerpoCrudo !== 'string') {
    return false;
  }

  const hashEsperado = crypto
    .createHmac('sha256', secreto)
    .update(cuerpoCrudo, 'utf8')
    .digest('hex');

  const bufferEsperado = Buffer.from(hashEsperado, 'utf8');
  const bufferRecibido = Buffer.from(firmaRecibida, 'utf8');

  if (bufferEsperado.length !== bufferRecibido.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferEsperado, bufferRecibido);
}

export async function GET() {
  return NextResponse.json({
    estado: 'activo',
    servicio: 'Webhook Zernio CRM Óptica en Vercel Serverless',
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const cuerpoCrudo = await request.text();
    const firma = request.headers.get('x-zernio-signature');

    let payload: any = null;
    try {
      payload = JSON.parse(cuerpoCrudo);
    } catch {
      return NextResponse.json({ error: 'Payload JSON inválido' }, { status: 400 });
    }

    if (!payload || !payload.event) {
      return NextResponse.json({ error: 'Payload de webhook sin evento' }, { status: 400 });
    }

    // 1. Validación de firma HMAC (Global o por Óptica)
    let firmaValida = SECRETO_WEBHOOK ? validarFirmaWebhook(cuerpoCrudo, firma, SECRETO_WEBHOOK) : true;

    // Si falló con el secreto global, verificar si la cuenta pertenece a una óptica con secreto propio
    if (!firmaValida && firma) {
      const idCuenta = payload.accountId || payload.account_id || payload.data?.accountId || payload.data?.account_id;
      if (idCuenta) {
        const linea: any = await base_datos.prepare(`
          SELECT o.zernio_webhook_secret 
          FROM lineas_canales lc
          JOIN opticas o ON o.id = lc.optica_id
          WHERE lc.id_cuenta_zernio = ? AND o.zernio_webhook_secret IS NOT NULL
          LIMIT 1
        `).get(idCuenta);

        if (linea && typeof linea === 'object' && linea.zernio_webhook_secret) {
          firmaValida = validarFirmaWebhook(cuerpoCrudo, firma, String(linea.zernio_webhook_secret));
        }
      }
    }

    if (SECRETO_WEBHOOK && !firmaValida) {
      console.warn('⚠️ Webhook rechazado: Firma HMAC inválida o ausente.');
      return NextResponse.json({ error: 'Firma de webhook inválida' }, { status: 401 });
    }

    const idEvento =
      request.headers.get('x-zernio-event-id') ||
      payload.id ||
      crypto.createHash('sha256').update(cuerpoCrudo).digest('hex');

    // Idempotencia en Supabase
    const insercion = await base_datos.prepare(`
      INSERT OR IGNORE INTO eventos_webhook (id_evento, tipo_evento, payload_json, estado)
      VALUES (?, ?, ?, 'recibido')
    `).run(idEvento, payload.event, cuerpoCrudo);

    if (insercion.changes === 0) {
      return NextResponse.json({ duplicado: true, mensaje: 'Evento ya registrado previamente.' }, { status: 200 });
    }

    // Procesar evento directamente
    try {
      await procesar_evento_webhook(payload);
      await base_datos.prepare(
        "UPDATE eventos_webhook SET estado = 'procesado', actualizado_en = datetime('now') WHERE id_evento = ?"
      ).run(idEvento);
    } catch (error: any) {
      console.error(`❌ Error procesando evento webhook (${idEvento}):`, error);
      await base_datos.prepare(
        "UPDATE eventos_webhook SET estado = 'fallido', error_mensaje = ?, actualizado_en = datetime('now') WHERE id_evento = ?"
      ).run(error?.message || 'Error desconocido', idEvento);
    }

    return NextResponse.json({ exito: true, id_evento: idEvento }, { status: 200 });
  } catch (err: any) {
    console.error('Error no controlado en webhook:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
