export function obtenerConfiguracionIA(opticaId: any): Promise<any>;
export function guardarConfiguracionIA(opticaId: any, datos: any): Promise<any>;
export function alternarEstadoIAChat(conversacionId: any, activo: boolean): Promise<any>;
export function procesarMensajeConIA(params: {
  conversacion_id: any;
  mensaje_id?: any;
  contacto_id?: any;
  optica_id: any;
  texto_mensaje: string;
}): Promise<any>;
