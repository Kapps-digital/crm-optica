export interface SuscripcionPushCliente {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export function guardarSuscripcionPush(datos: {
  usuario_id?: number | string | null;
  optica_id: number | string;
  suscripcion: SuscripcionPushCliente;
  user_agent?: string;
}): Promise<{ id: string | number }>;

export function eliminarSuscripcionPush(endpoint: string): Promise<void>;

export function enviarNotificacionPushAOptica(parametros: {
  optica_id: number | string;
  titulo: string;
  cuerpo: string;
  icono?: string;
  url?: string;
  etiqueta?: string;
  datos?: Record<string, unknown>;
}): Promise<{ enviadas: number; fallidas: number; motivo?: string; error?: string }>;

