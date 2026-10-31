export function obtener_o_crear_contacto(parametros: { nombre?: string | null; telefono?: string | null; bsuid?: string | null; correo?: string | null; optica_id?: number | string | null }): Promise<number>;
export function obtener_o_crear_conversacion(parametros: { contacto_id: number; canal?: string; id_cuenta_zernio?: string; id_conversacion_zernio: string; es_entrante?: boolean; fecha_mensaje?: string | null }): Promise<number>;
export function procesar_evento_webhook(payload: any): Promise<any>;
export function procesar_evento(evento_bruto: any, optica_id?: number): Promise<any>;
