export function obtenerSegmentosConConteo(optica_id?: number): Promise<any[]>;
export function obtenerPacientesDeSegmento(segmento_id: string | number, optica_id?: number): Promise<any[]>;
export function crearSegmentoPersonalizado(optica_id: number, datos: any): Promise<any>;
export function actualizarSegmentoPersonalizado(segmento_id: string | number, optica_id: number, datos: any): Promise<any>;
export function eliminarSegmentoPersonalizado(segmento_id: string | number, optica_id?: number): Promise<any>;
