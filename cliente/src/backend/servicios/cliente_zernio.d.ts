export class ClienteZernio {
  clave_api: string;
  url_base: string;
  constructor(clave_api?: string);
  obtener_cuentas(): Promise<any>;
  obtener_conversaciones(id_cuenta: string, parametros?: any): Promise<any>;
  obtener_mensajes(id_cuenta: string, id_conversacion: string, parametros?: any): Promise<any>;
  enviar_mensaje(id_cuenta: string, datos_mensaje: any): Promise<any>;
  eliminar_cuenta(id_cuenta: string): Promise<any>;
  obtener_plantillas(id_cuenta: string): Promise<any>;
  enviar_plantilla(id_cuenta: string, datos_plantilla: any): Promise<any>;
}

export const cliente_zernio: ClienteZernio;
