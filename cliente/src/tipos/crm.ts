// Definición de Tipos TypeScript para el CRM Óptica en Español

export type TipoCanal = 'whatsapp' | 'instagram' | 'messenger';
export type DireccionMensaje = 'entrante' | 'saliente';
export type EstadoEntrega = 'enviado' | 'entregado' | 'leido' | 'fallido';

export interface Contacto {
  id: number;
  nombre_completo?: string | null;
  nombre?: string | null;
  tipo_documento?: string | null;
  cedula?: string | null;
  documento?: string | null;
  edad?: number | null;
  sexo?: 'masculino' | 'femenino' | string | null;
  es_paciente?: boolean;
  telefono: string | null;
  correo: string | null;
  business_scoped_user_id: string | null;
  creado_en: string;
  actualizado_en: string;
  total_formulas?: number;
  total_citas?: number;
  ultima_formula_fecha?: string;
  ultimo_tipo_lente?: string;
}

export interface Conversacion {
  id: number;
  contacto_id: number;
  canal: TipoCanal;
  id_cuenta_zernio: string | null;
  id_conversacion_zernio: string;
  ultimo_mensaje_entrante_en: string | null;
  estado: string;
  creado_en: string;
  actualizado_en: string;
  // Campos calculados / unidos en consultas
  contacto_nombre?: string;
  contacto_telefono?: string;
  contacto_correo?: string;
  contacto_bsuid?: string | null;
  ultimo_mensaje_texto?: string;
  ultimo_mensaje_fecha?: string;
  ultimo_mensaje_direccion?: DireccionMensaje | null;
  sin_contestar?: boolean;
  no_leido?: boolean;
  ventana_24h_activa?: boolean;
  mensajes_no_leidos?: number;
  ia_activa?: boolean;
  ia_pausada_por_humano?: boolean;
  requiere_asesor_humano?: boolean;
  atendido_por_ia?: boolean;
}

export interface ConfiguracionIA {
  ia_activa: boolean;
  ia_nombre: string;
  ia_tono: 'cercano' | 'formal' | 'comercial' | string;
  ia_instrucciones: string;
  ia_preguntas_frecuentes: string;
  ia_api_key?: string;
  ia_modelo?: string;
}

export interface Mensaje {
  id: number;
  conversacion_id: number;
  id_mensaje_plataforma: string;
  id_mensaje_zernio: string | null;
  direccion: DireccionMensaje;
  tipo_mensaje: string;
  tipo_contenido?: string | null;
  url_adjunto?: string | null;
  texto: string | null;
  payload_json: string | null;
  estado_entrega: EstadoEntrega;
  enviado_por_ia?: boolean;
  creado_en: string;
  plantilla?: PlantillaWhatsApp | null;
  reacciones?: Array<{
    emoji: string;
    direccion: DireccionMensaje;
    id?: number | string;
  }>;
}

export interface FormulaOptica {
  id: number;
  contacto_id: number;
  fecha_examen: string;
  esfera_od: string | null;
  cilindro_od: string | null;
  eje_od: string | null;
  adicion_od: string | null;
  av_od: string | null;
  esfera_oi: string | null;
  cilindro_oi: string | null;
  eje_oi: string | null;
  adicion_oi: string | null;
  av_oi: string | null;
  distancia_pupilar: string | null;
  tipo_lente: string | null;
  optometra: string | null;
  proximo_control_en_meses: number | null;
  observaciones: string | null;
  creado_en: string;
}

export interface Optica {
  id: number;
  nombre: string;
  slug: string;
  logo_url: string | null;
  color_primario: string;
  color_secundario: string;
  telefono: string | null;
  activo?: boolean;
  duracion_cita_minutos?: number;
  control_meses_defecto?: number;
  especialista_defecto?: string;
  registro_profesional_defecto?: string;
  motivo_cita_defecto?: string;
  motivos_citas_json?: string[];
  notificacion_auto_citas_whatsapp?: boolean;
  dias_atencion?: string;
  hora_inicio_atencion?: string;
  hora_fin_atencion?: string;
  ia_activa?: boolean;
  ia_nombre?: string;
  ia_tono?: string;
  ia_instrucciones?: string;
  ia_preguntas_frecuentes?: string;
  ia_api_key?: string;
  ia_modelo?: string;
}

export type RolUsuario = 'admin' | 'admin_optica';

export interface LineaCanal {
  id: number;
  optica_id: number;
  canal: TipoCanal;
  numero: string;
  id_cuenta_zernio?: string | null;
  etiqueta: string;
  estado: 'activa' | 'inactiva';
  es_predeterminada: boolean;
  creado_en?: string;
}

export interface Usuario {
  id: number;
  optica_id: number;
  nombre: string;
  usuario: string;
  correo?: string | null;
  rol: RolUsuario | string;
  optica?: Optica;
}

export interface RespuestaLogin {
  exito: boolean;
  token?: string;
  usuario?: Usuario;
  optica?: Optica;
  error?: string;
}

export interface RespuestaApi<T> {
  exito: boolean;
  datos?: T;
  error?: string;
}

export type EstadoCita = 'pendiente' | 'confirmada' | 'completada' | 'cancelada';

export interface Cita {
  id: number;
  contacto_id: number;
  optica_id?: number;
  fecha_cita: string;
  hora_cita: string;
  motivo: string;
  especialista: string;
  observaciones?: string | null;
  estado: EstadoCita;
  creado_en?: string;
  contacto_nombre?: string | null;
  contacto_telefono?: string | null;
  contacto_correo?: string | null;
}

export interface CriteriosSegmento {
  control_vencido_meses?: number | null;
  edad_minima?: number | null;
  edad_maxima?: number | null;
  tiene_adicion?: boolean;
  tipo_lente?: string | null;
  cilindro_minimo?: number | null;
  dias_sin_cita?: number | null;
  sexo?: 'masculino' | 'femenino' | string | null;
}

export interface Segmento {
  id: number;
  optica_id: number | null;
  nombre: string;
  descripcion: string | null;
  icono: string;
  color: string;
  es_sistema: boolean;
  criterios_json: string | CriteriosSegmento;
  criterios: CriteriosSegmento;
  total_pacientes: number;
  segmento_origen_id?: number | null;
  creado_en?: string;
  actualizado_en?: string;
}

export interface PacienteSegmento extends Contacto {
  formula_id?: number | null;
  fecha_examen?: string | null;
  proximo_control?: string | null;
  tipo_lente?: string | null;
  od_esfera?: string | null;
  od_cilindro?: string | null;
  od_adicion?: string | null;
  oi_esfera?: string | null;
  oi_cilindro?: string | null;
  oi_adicion?: string | null;
  fecha_control_calculada?: string | null;
  ultima_cita?: string | null;
}

export interface BotonPlantilla {
  tipo: string;
  texto: string;
  url?: string;
  telefono?: string;
  codigo?: string;
}

export interface PlantillaWhatsApp {
  id: number;
  optica_id?: number | null;
  nombre: string;
  etiqueta: string;
  categoria: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  idioma: string;
  encabezado_tipo: 'TEXTO' | 'IMAGEN' | 'VIDEO' | 'NINGUNO';
  encabezado_contenido?: string | null;
  cuerpo: string;
  pie?: string | null;
  botones_json?: string | BotonPlantilla[];
  botones?: BotonPlantilla[];
  estado: 'APROBADA' | 'APPROVED' | 'PENDING' | 'PENDIENTE' | 'REJECTED' | 'RECHAZADA' | 'PAUSED';
  es_sistema: boolean;
  meta_template_id?: string | null;
  creado_en?: string;
  actualizado_en?: string;
}

export interface CuotaDiariaWhatsApp {
  limite_diario: number;
  tier_meta?: string;
  calidad_meta?: string;
  telefono_cuenta?: string;
  enviados_hoy: number;
  disponibles_hoy: number;
  porcentaje_consumido: number;
}

export interface DestinatarioLote {
  contacto_id?: number | null;
  nombre: string;
  telefono: string;
}

export interface CalculoAudienciaLote {
  plantilla: {
    id: number;
    nombre: string;
    etiqueta: string;
    categoria: string;
  };
  lote_numero: number;
  total_audiencia_inicial: number;
  ya_contactados_recientes: number;
  pendientes_elegibles: number;
  limite_diario_disponible: number;
  cantidad_a_enviar_hoy: number;
  destinatarios_lote_hoy: DestinatarioLote[];
  muestra_destinatarios: DestinatarioLote[];
}

export interface CampanaEnvioHistorial {
  id: number;
  optica_id: number;
  plantilla_id: number;
  nombre_campana: string;
  segmento_id?: number | null;
  origen_tipo: string;
  total_destinatarios: number;
  total_enviados: number;
  total_fallidos: number;
  estado: string;
  error_mensaje?: string | null;
  creado_en: string;
  plantilla_etiqueta: string;
  plantilla_categoria: string;
  segmento_nombre?: string | null;
}

export interface CuentaCanalWhatsApp {
  id_cuenta_zernio: string;
  numero: string;
  nombre_mostrado: string;
  conectado: boolean;
  es_coexistencia: boolean;
  calidad: string;
  estado_meta: string;
  limite_mensajeria: string;
  conectado_en?: string;
  tiene_cuenta_guardada?: boolean;
}

export interface EstadoCanalesRespuesta {
  exito: boolean;
  optica: Optica | null;
  cuenta_whatsapp: CuentaCanalWhatsApp | null;
  total_cuentas_zernio: number;
  error?: string;
}



