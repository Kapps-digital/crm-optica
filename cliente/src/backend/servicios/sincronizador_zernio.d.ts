export interface OpcionesSincronizacionZernio {
  optica_id?: number | string | null;
  sincronizar_mensajes_profundo?: boolean;
  max_conversaciones_mensajes?: number;
}

export function sincronizar_conversaciones_zernio(opciones?: OpcionesSincronizacionZernio): Promise<any>;
export function sincronizar_mensajes_conversacion(id_conversacion_zernio: string, id_cuenta_zernio: string, id_conversacion_local?: number | string | null): Promise<any>;
