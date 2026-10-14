export function obtenerPlantillas(optica_id?: number): Promise<any[]>;
export function crearPlantilla(optica_id: number, datos: any): Promise<any>;
export function sincronizarPlantillasConZernio(optica_id?: number): Promise<any>;
export function obtenerCuotaDiaria(optica_id?: number): Promise<any>;
export function calcularAudienciaLote(optica_id: number, datos: any): Promise<any>;
export function lanzarLoteCampana(optica_id: number, datos: any): Promise<any>;
export function obtenerHistorialLotes(optica_id?: number): Promise<any[]>;
export function eliminarLoteCampana(optica_id: number, lote_id: string | number): Promise<any>;
export function obtenerMapaPlantillasPorNombre(optica_id?: number): Promise<Record<string, any>>;
