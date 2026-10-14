export function subir_logo_storage_optica(
  optica_id?: number,
  opciones?: {
    buffer: Buffer;
    tipo_mime?: string;
    nombre_original?: string;
  }
): Promise<any>;

export function obtener_canales_optica(optica_id?: number): Promise<any>;
export function obtener_url_conexion_whatsapp(optica_id?: number, redirect_url?: string): Promise<any>;
export function vincular_cuenta_whatsapp_activa(optica_id?: number): Promise<any>;
export function desconectar_canal_whatsapp(optica_id?: number, opciones?: { cambiar_numero?: boolean }): Promise<any>;
export function reconectar_canal_whatsapp(optica_id?: number): Promise<any>;
export function actualizar_datos_optica(optica_id: number, datos: any): Promise<any>;
