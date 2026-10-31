import type {
  Contacto,
  Conversacion,
  Mensaje,
  FormulaOptica,
  RespuestaLogin,
  Usuario,
  Optica,
  LineaCanal,
  Cita,
  Segmento,
  CriteriosSegmento,
  PacienteSegmento,
  PlantillaWhatsApp,
  CuotaDiariaWhatsApp,
  CalculoAudienciaLote,
  CampanaEnvioHistorial,
  CuentaCanalWhatsApp,
  EstadoCanalesRespuesta,
  ConfiguracionIA,
  DatosRespuestaUsuarios,
  NotificacionCRM,
  RespuestaNotificaciones,
  TipologiaPaciente,
} from '@/tipos/crm';
import { TIEMPO_MAXIMO_INACTIVIDAD_MS, CLAVE_ULTIMA_ACTIVIDAD } from '@/constantes/sesion';

const CLAVE_TOKEN = 'crm_token';
const CLAVE_USUARIO = 'crm_usuario';
const CLAVE_OPTICA = 'crm_optica';

// Helpers de Sesión en Navegador
export function obtenerTokenAutenticacion(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CLAVE_TOKEN);
}

export function obtenerUsuarioSesion(): Usuario | null {
  if (typeof window === 'undefined') return null;
  const guardado = localStorage.getItem(CLAVE_USUARIO);
  if (!guardado) return null;
  try {
    return JSON.parse(guardado);
  } catch {
    return null;
  }
}

export function obtenerOpticaSesion(): Optica | null {
  if (typeof window === 'undefined') return null;
  const guardado = localStorage.getItem(CLAVE_OPTICA);
  if (!guardado) return null;
  try {
    return JSON.parse(guardado);
  } catch {
    return null;
  }
}

export function guardarOpticaSesion(optica: Optica): void {
  if (typeof window === 'undefined' || !optica) return;
  localStorage.setItem(CLAVE_OPTICA, JSON.stringify(optica));
}

const CLAVE_OPTICA_ACTIVA = 'crm_optica_activa_id';

export function obtenerIdOpticaActiva(): number | null {
  if (typeof window === 'undefined') return null;
  const guardado = localStorage.getItem(CLAVE_OPTICA_ACTIVA);
  return guardado ? Number(guardado) : null;
}

export function establecerIdOpticaActiva(id: number | null): void {
  if (typeof window === 'undefined') return;
  if (id === null) {
    localStorage.removeItem(CLAVE_OPTICA_ACTIVA);
  } else {
    localStorage.setItem(CLAVE_OPTICA_ACTIVA, String(id));
  }
}

export function aplicarTemaOptica(optica?: Optica | null): void {
  if (typeof window === 'undefined' || !optica) return;
  const raiz = document.documentElement;
  if (optica.color_primario) {
    raiz.style.setProperty('--color-primario', optica.color_primario);
    raiz.style.setProperty('--color-primario-rgb', convertirHexARgb(optica.color_primario));
    raiz.style.setProperty('--color-primario-claro', optica.color_primario);
  }
  if (optica.color_secundario) {
    raiz.style.setProperty('--color-primario-oscuro', optica.color_secundario);
  }
}

function convertirHexARgb(hex: string): string {
  const limpio = hex.replace('#', '');
  if (limpio.length === 6) {
    const r = parseInt(limpio.substring(0, 2), 16);
    const g = parseInt(limpio.substring(2, 4), 16);
    const b = parseInt(limpio.substring(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }
  return '2, 132, 199';
}

export function registrarActividadUsuario(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CLAVE_ULTIMA_ACTIVIDAD, String(Date.now()));
}

export function verificarSesionExpirada(): boolean {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem(CLAVE_TOKEN);
  if (!token) return false;

  const ultimaActividad = localStorage.getItem(CLAVE_ULTIMA_ACTIVIDAD);
  if (!ultimaActividad) {
    // Si hay token pero no había registro de actividad, inicializarlo
    registrarActividadUsuario();
    return false;
  }

  const transcurrido = Date.now() - Number(ultimaActividad);
  if (transcurrido > TIEMPO_MAXIMO_INACTIVIDAD_MS) {
    cerrarSesion();
    return true;
  }

  return false;
}

export function guardarSesion(datos: RespuestaLogin): void {
  if (typeof window === 'undefined') return;
  if (datos.token) localStorage.setItem(CLAVE_TOKEN, datos.token);
  if (datos.usuario) localStorage.setItem(CLAVE_USUARIO, JSON.stringify(datos.usuario));
  if (datos.optica) {
    localStorage.setItem(CLAVE_OPTICA, JSON.stringify(datos.optica));
    localStorage.setItem(CLAVE_OPTICA_ACTIVA, String(datos.optica.id));
    aplicarTemaOptica(datos.optica);
  }
  registrarActividadUsuario();
}

export function restaurarTemaPorDefecto(): void {
  if (typeof window === 'undefined') return;
  const raiz = document.documentElement;
  raiz.style.removeProperty('--color-primario');
  raiz.style.removeProperty('--color-primario-rgb');
  raiz.style.removeProperty('--color-primario-claro');
  raiz.style.removeProperty('--color-primario-oscuro');
}

export function cerrarSesion(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CLAVE_TOKEN);
  localStorage.removeItem(CLAVE_USUARIO);
  localStorage.removeItem(CLAVE_OPTICA);
  localStorage.removeItem(CLAVE_OPTICA_ACTIVA);
  localStorage.removeItem(CLAVE_ULTIMA_ACTIVIDAD);
  window.location.href = '/login';
}

function crearEncabezados(adicionales: Record<string, string> = {}): HeadersInit {
  if (verificarSesionExpirada()) {
    return { ...adicionales };
  }
  registrarActividadUsuario();

  const encabezados: Record<string, string> = { ...adicionales };
  const token = obtenerTokenAutenticacion();
  if (token) {
    encabezados['Authorization'] = `Bearer ${token}`;
  }
  const idOpticaActiva = obtenerIdOpticaActiva();
  if (idOpticaActiva) {
    encabezados['x-optica-id'] = String(idOpticaActiva);
  }
  return encabezados;
}

function registrarErrorApi(modulo: string, error: unknown): void {
  const mensaje = error instanceof Error ? error.message : String(error);
  if (
    mensaje.includes('Failed to fetch') ||
    mensaje.includes('NetworkError') ||
    mensaje.includes('fetch failed') ||
    (error as any)?.name === 'TypeError'
  ) {
    // Desconexión transitoria por suspensión de equipo o reconexión de socket de desarrollo
    console.warn(`[API CRM] Desconexión temporal en ${modulo}: ${mensaje}`);
  } else {
    console.error(`[API CRM] Error en ${modulo}:`, error);
  }
}

// Endpoints de Autenticación
export async function iniciarSesion(usuario: string, contrasena: string): Promise<RespuestaLogin> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, contrasena }),
    });

    const data = await res.json();
    if (res.ok && data.exito) {
      guardarSesion(data);
      return data;
    }

    return {
      exito: false,
      error: data.error || 'Credenciales inválidas',
      codigo: data.codigo,
    };
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    return {
      exito: false,
      error: 'No se pudo conectar con el servidor',
    };
  }
}

export async function consultarUsuarioRecuperacion(usuario: string): Promise<{
  exito: boolean;
  nombre?: string;
  correo_censurado?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/recuperar/consultar-usuario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario }),
    });
    const data = await res.json();
    return data;
  } catch {
    return { exito: false, error: 'Error de conexión con el servidor.' };
  }
}

export async function verificarCorreoYEnviarCodigo(usuario: string, correo: string): Promise<{
  exito: boolean;
  mensaje?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/recuperar/verificar-correo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, correo }),
    });
    const data = await res.json();
    return data;
  } catch {
    return { exito: false, error: 'Error de conexión con el servidor.' };
  }
}

export async function restablecerContrasenaApi(
  usuario: string,
  correo: string,
  codigo: string,
  nueva_contrasena: string
): Promise<{
  exito: boolean;
  mensaje?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/recuperar/restablecer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, correo, codigo, nueva_contrasena }),
    });
    const data = await res.json();
    return data;
  } catch {
    return { exito: false, error: 'Error de conexión con el servidor.' };
  }
}

export async function obtenerPerfilUsuario(): Promise<RespuestaLogin> {
  try {
    const res = await fetch('/api/auth/perfil', {
      headers: crearEncabezados(),
    });
    if (!res.ok) {
      if (res.status === 401) {
        cerrarSesion();
      }
      return { exito: false };
    }
    const data = await res.json();
    if (data.exito && data.optica && !obtenerIdOpticaActiva()) {
      aplicarTemaOptica(data.optica);
    }
    return data;
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    return { exito: false };
  }
}

// Conversaciones y Mensajería
export async function obtenerConversaciones(): Promise<Conversacion[]> {
  try {
    const res = await fetch(`/api/conversaciones?_t=${Date.now()}`, {
      headers: crearEncabezados(),
      cache: 'no-store',
    });
    if (!res.ok) {
      if (res.status === 401) cerrarSesion();
      return [];
    }
    const data = await res.json();
    return data.conversaciones || [];
  } catch (error) {
    registrarErrorApi('obtenerConversaciones', error);
    return [];
  }
}

export async function sincronizarConversaciones(): Promise<{ exito: boolean; total_conversaciones?: number }> {
  try {
    const res = await fetch('/api/conversaciones/sincronizar', {
      method: 'POST',
      headers: crearEncabezados(),
      cache: 'no-store',
    });
    if (!res.ok) return { exito: false };
    return await res.json();
  } catch (error) {
    console.error('Error al sincronizar conversaciones:', error);
    return { exito: false };
  }
}

export async function obtenerMensajes(conversacionId: number): Promise<Mensaje[]> {
  try {
    const res = await fetch(`/api/conversaciones/${conversacionId}/mensajes?_t=${Date.now()}`, {
      headers: crearEncabezados(),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.mensajes || [];
  } catch (error) {
    registrarErrorApi('obtenerMensajes', error);
    return [];
  }
}

export async function marcarConversacionLeida(conversacionId: number): Promise<{ exito: boolean }> {
  try {
    const res = await fetch(`/api/conversaciones/${conversacionId}/marcar-leido`, {
      method: 'POST',
      headers: crearEncabezados(),
    });
    if (!res.ok) return { exito: false };
    return await res.json();
  } catch (error) {
    console.error('Error al marcar conversación leída:', error);
    return { exito: false };
  }
}

export async function obtenerDetalleContacto(
  contactoId: number
): Promise<{ contacto: Contacto; formulas: FormulaOptica[]; citas: Cita[] } | null> {
  try {
    const res = await fetch(`/api/contactos/${contactoId}`, {
      headers: crearEncabezados(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.exito) return null;
    return {
      contacto: data.contacto,
      formulas: data.formulas || [],
      citas: data.citas || [],
    };
  } catch (error) {
    console.error('Error al obtener detalle del contacto:', error);
    return null;
  }
}

export async function obtenerPacientes(): Promise<Contacto[]> {
  try {
    const res = await fetch('/api/contactos', {
      headers: crearEncabezados(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.contactos || [];
  } catch (error) {
    registrarErrorApi('obtenerPacientes', error);
    return [];
  }
}

export interface DatosRegistroPaciente {
  nombre: string;
  nombre_completo?: string;
  tipo_documento?: string;
  cedula?: string;
  documento?: string;
  telefono?: string;
  correo?: string;
  edad?: number;
  sexo?: 'masculino' | 'femenino' | string;
  es_paciente?: boolean;
  tipologia_id?: number | null;
}

export async function registrarPaciente(
  datos: DatosRegistroPaciente
): Promise<{ exito: boolean; contacto?: Contacto; error?: string }> {
  for (let intento = 0; intento < 2; intento++) {
    try {
      const res = await fetch('/api/contactos', {
        method: 'POST',
        headers: crearEncabezados({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ...datos, es_paciente: true }),
      });
      const texto = await res.text();
      let data;
      try {
        data = JSON.parse(texto);
      } catch {
        throw new Error(res.ok ? 'Respuesta del servidor no válida' : `Error del servidor HTTP ${res.status}`);
      }
      return data;
    } catch (error) {
      if (intento === 0) {
        await new Promise((r) => setTimeout(r, 350));
        continue;
      }
      console.error('Error al registrar paciente:', error);
      return {
        exito: false,
        error: error instanceof Error ? error.message : 'Error de conexión al registrar paciente',
      };
    }
  }
  return { exito: false, error: 'Error de conexión al registrar paciente' };
}

export async function actualizarContactoPaciente(
  id: number | string,
  datos: Partial<DatosRegistroPaciente>
): Promise<{ exito: boolean; contacto?: Contacto; error?: string }> {
  const idLimpio = Number(id);
  if (!idLimpio || isNaN(idLimpio)) {
    return { exito: false, error: 'Identificador de contacto no válido' };
  }

  for (let intento = 0; intento < 2; intento++) {
    try {
      const res = await fetch(`/api/contactos/${idLimpio}`, {
        method: 'PUT',
        headers: crearEncabezados({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(datos),
      });
      const texto = await res.text();
      let data;
      try {
        data = JSON.parse(texto);
      } catch {
        throw new Error(res.ok ? 'Respuesta del servidor no válida' : `Error del servidor HTTP ${res.status}`);
      }
      return data;
    } catch (error) {
      if (intento === 0) {
        await new Promise((r) => setTimeout(r, 350));
        continue;
      }
      console.error('Error al actualizar paciente:', error);
      return {
        exito: false,
        error: error instanceof Error ? error.message : 'Error de conexión al actualizar paciente',
      };
    }
  }
  return { exito: false, error: 'Error de conexión al actualizar paciente' };
}

export async function enviarMensajeChat(
  conversacionId: number,
  texto: string,
  usarPlantilla: boolean = false,
  nombrePlantilla?: string,
  idiomaPlantilla?: string
): Promise<{ exito: boolean; mensaje_id?: number; id_mensaje_zernio?: string; mensaje?: Mensaje; error?: string }> {
  const idLimpio = Number(conversacionId);
  if (isNaN(idLimpio) || idLimpio <= 0) {
    return { exito: false, error: 'Identificador de conversación no válido o inexistente.' };
  }

  for (let intento = 0; intento < 2; intento++) {
    try {
      const res = await fetch('/api/mensajes/enviar', {
        method: 'POST',
        headers: crearEncabezados({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          conversacion_id: idLimpio,
          texto,
          usar_plantilla: usarPlantilla,
          nombre_plantilla: nombrePlantilla,
          idioma_plantilla: idiomaPlantilla,
        }),
      });

      if (!res.ok) {
        let detalleError = `HTTP ${res.status}`;
        try {
          const cuerpo = await res.json();
          detalleError = cuerpo.error?.mensaje || cuerpo.error || cuerpo.mensaje || detalleError;
        } catch {
          try {
            const textoPlano = await res.text();
            if (textoPlano && textoPlano.length < 150 && !textoPlano.includes('<!DOCTYPE')) {
              detalleError = textoPlano;
            }
          } catch {}
        }

        if (intento === 0) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        return { exito: false, error: detalleError };
      }

      return await res.json();
    } catch (error) {
      if (intento === 0) {
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
      console.error('Error al enviar mensaje:', error);
      return { exito: false, error: 'Fallo de conexión con el servidor' };
    }
  }

  return { exito: false, error: 'Fallo de conexión' };
}

export async function registrarFormulaOptica(datos: Partial<FormulaOptica>): Promise<{ exito: boolean; id?: number; error?: string }> {
  try {
    const res = await fetch('/api/formulas', {
      method: 'POST',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(datos),
    });
    return await res.json();
  } catch (error) {
    console.error('Error al registrar fórmula óptica:', error);
    return { exito: false, error: 'Error de red' };
  }
}

export async function registrarCita(datos: {
  contacto_id: number;
  fecha_cita: string;
  hora_cita: string;
  motivo?: string;
  especialista?: string;
  observaciones?: string;
}): Promise<{ exito: boolean; cita_id?: number; duplicada?: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/contactos/${datos.contacto_id}/citas`, {
      method: 'POST',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(datos),
    });
    return await res.json();
  } catch (error) {
    console.error('Error al agendar cita:', error);
    return { exito: false, error: 'Error de red al agendar cita' };
  }
}

export async function obtenerOpticas(): Promise<Optica[]> {
  try {
    const res = await fetch('/api/opticas', {
      headers: crearEncabezados(),
    });
    const datos = await res.json();
    return datos.exito ? (datos.opticas || []).map((o: any) => ({ ...o, id: Number(o.id) })) : [];
  } catch (error) {
    console.error('Error al obtener ópticas:', error);
    return [];
  }
}

export async function obtenerLineas(): Promise<LineaCanal[]> {
  try {
    const res = await fetch('/api/lineas', {
      headers: crearEncabezados(),
    });
    const datos = await res.json();
    return datos.exito ? (datos.lineas || []) : [];
  } catch (error) {
    console.error('Error al obtener líneas:', error);
    return [];
  }
}

export async function obtenerCitas(filtros?: {
  fecha_inicio?: string;
  fecha_fin?: string;
  estado?: string;
  especialista?: string;
}): Promise<Cita[]> {
  try {
    const params = new URLSearchParams();
    if (filtros?.fecha_inicio) params.set('fecha_inicio', filtros.fecha_inicio);
    if (filtros?.fecha_fin) params.set('fecha_fin', filtros.fecha_fin);
    if (filtros?.estado) params.set('estado', filtros.estado);
    if (filtros?.especialista) params.set('especialista', filtros.especialista);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/citas${query}`, {
      headers: crearEncabezados(),
    });
    const datos = await res.json();
    return datos.exito ? (datos.citas || []) : [];
  } catch (error) {
    registrarErrorApi('obtenerCitas', error);
    return [];
  }
}

export async function actualizarCita(
  id: number,
  datos: Partial<Cita>
): Promise<{ exito: boolean; cita?: Cita; duplicada?: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/citas/${id}`, {
      method: 'PUT',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(datos),
    });
    return await res.json();
  } catch (error) {
    console.error('Error al actualizar cita:', error);
    return { exito: false, error: 'Error de red al actualizar la cita' };
  }
}

export async function cancelarCita(id: number): Promise<{ exito: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/citas/${id}`, {
      method: 'DELETE',
      headers: crearEncabezados(),
    });
    return await res.json();
  } catch (error) {
    console.error('Error al cancelar cita:', error);
    return { exito: false, error: 'Error de red al cancelar la cita' };
  }
}

// ============================================================================
// AUTO-SEGMENTACIÓN DE PACIENTES
// ============================================================================

export interface RespuestaSegmentos {
  segmentos: Segmento[];
  total_pacientes_optica: number;
  total_pacientes_calificados_unicos: number;
}

export async function obtenerSegmentos(): Promise<RespuestaSegmentos> {
  try {
    const res = await fetch('/api/segmentos', {
      headers: crearEncabezados(),
    });
    const datos = await res.json();
    return {
      segmentos: datos.exito ? (datos.segmentos || []) : [],
      total_pacientes_optica: datos.total_pacientes_optica || 0,
      total_pacientes_calificados_unicos: datos.total_pacientes_calificados_unicos || 0,
    };
  } catch (error) {
    registrarErrorApi('obtenerSegmentos', error);
    return { segmentos: [], total_pacientes_optica: 0, total_pacientes_calificados_unicos: 0 };
  }
}

export async function obtenerPacientesSegmento(
  idSegmento: number
): Promise<{ segmento?: Segmento; pacientes: PacienteSegmento[]; error?: string }> {
  try {
    const res = await fetch(`/api/segmentos/${idSegmento}/pacientes`, {
      headers: crearEncabezados(),
    });
    const datos = await res.json();
    if (!datos.exito) {
      return { pacientes: [], error: datos.error || 'Error al obtener pacientes del segmento' };
    }
    return { segmento: datos.segmento, pacientes: datos.pacientes || [] };
  } catch (error) {
    registrarErrorApi('obtenerPacientesSegmento', error);
    return { pacientes: [], error: 'Error de conexión al cargar pacientes del segmento' };
  }
}

export async function crearSegmentoPersonalizado(datos: {
  nombre: string;
  descripcion?: string;
  icono?: string;
  color?: string;
  criterios: CriteriosSegmento;
}): Promise<{ exito: boolean; segmento?: Segmento; error?: string }> {
  try {
    const res = await fetch('/api/segmentos', {
      method: 'POST',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(datos),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status}): ${texto || res.statusText}` };
    }
  } catch (error) {
    registrarErrorApi('crearSegmentoPersonalizado', error);
    return { exito: false, error: 'Error de red al crear segmento personalizado' };
  }
}

export async function actualizarSegmentoPersonalizado(
  idSegmento: number,
  datos: {
    nombre: string;
    descripcion?: string;
    icono?: string;
    color?: string;
    criterios: CriteriosSegmento;
  }
): Promise<{ exito: boolean; segmento?: Segmento; error?: string }> {
  try {
    const res = await fetch(`/api/segmentos/${idSegmento}`, {
      method: 'PUT',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(datos),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status}): ${texto || res.statusText}` };
    }
  } catch (error) {
    registrarErrorApi('actualizarSegmentoPersonalizado', error);
    return { exito: false, error: 'Error de red al actualizar segmento personalizado' };
  }
}

export async function eliminarSegmentoPersonalizado(
  idSegmento: number
): Promise<{ exito: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/segmentos/${idSegmento}`, {
      method: 'DELETE',
      headers: crearEncabezados(),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status}): ${texto || res.statusText}` };
    }
  } catch (error) {
    registrarErrorApi('eliminarSegmentoPersonalizado', error);
    return { exito: false, error: 'Error de red al eliminar segmento' };
  }
}

// ==================== FUNCIONES API: PLANTILLAS Y ENVÍOS POR LOTES ====================

export async function obtenerPlantillasYCuota(): Promise<{
  exito: boolean;
  plantillas?: PlantillaWhatsApp[];
  cuota?: CuotaDiariaWhatsApp;
  error?: string;
}> {
  try {
    const res = await fetch('/api/plantillas', {
      headers: crearEncabezados(),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status}): ${texto || res.statusText}` };
    }
  } catch (error) {
    registrarErrorApi('obtenerPlantillasYCuota', error);
    return { exito: false, error: 'Error de red al obtener plantillas' };
  }
}

export async function crearPlantillaNueva(datos: {
  etiqueta: string;
  categoria?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  idioma?: string;
  encabezado_tipo?: 'TEXTO' | 'IMAGEN' | 'NINGUNO';
  encabezado_contenido?: string | null;
  cuerpo: string;
  pie?: string | null;
  botones?: { tipo: string; texto: string; url?: string; telefono?: string }[];
}): Promise<{ exito: boolean; plantilla?: PlantillaWhatsApp; error?: string }> {
  try {
    const res = await fetch('/api/plantillas', {
      method: 'POST',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(datos),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status}): ${texto || res.statusText}` };
    }
  } catch (error) {
    registrarErrorApi('crearPlantillaNueva', error);
    return { exito: false, error: 'Error de red al crear plantilla' };
  }
}

export async function calcularAudienciaLoteCampana(parametros: {
  plantillaId: number;
  segmentoId?: number | null;
  telefonosDirectos?: (string | { nombre?: string; telefono: string })[];
  diasExclusion?: number;
  forzarReenvio?: boolean;
}): Promise<{ exito: boolean; error?: string } & Partial<CalculoAudienciaLote>> {
  try {
    const res = await fetch('/api/plantillas/calcular-lote', {
      method: 'POST',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(parametros),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status}): ${texto || res.statusText}` };
    }
  } catch (error) {
    registrarErrorApi('calcularAudienciaLoteCampana', error);
    return { exito: false, error: 'Error de red al calcular lote' };
  }
}

export async function lanzarLoteCampanaApi(parametros: {
  plantillaId: number;
  segmentoId?: number | null;
  telefonosDirectos?: (string | { nombre?: string; telefono: string })[];
  nombreCampana?: string;
  diasExclusion?: number;
  tamanoLoteDeseado?: number;
  forzarReenvio?: boolean;
}): Promise<{
  exito: boolean;
  campana_id?: number;
  lote_numero?: number;
  nombre_campana?: string;
  total_enviados?: number;
  restantes_para_proximos_dias?: number;
  error?: string;
}> {
  for (let intento = 0; intento < 2; intento++) {
    try {
      const res = await fetch('/api/plantillas/lanzar-lote', {
        method: 'POST',
        headers: crearEncabezados({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(parametros),
      });
      const texto = await res.text();
      try {
        const json = JSON.parse(texto);
        if (!res.ok && json.error && (json.error.includes('ECONNRESET') || json.error.includes('ETIMEDOUT')) && intento === 0) {
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        return json;
      } catch {
        if ((texto.includes('ECONNRESET') || res.status === 502 || res.status === 504) && intento === 0) {
          await new Promise((r) => setTimeout(r, 800));
          continue;
        }
        return { exito: false, error: `Error del servidor (${res.status}): ${texto || res.statusText}` };
      }
    } catch (error: any) {
      if (intento === 0) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      registrarErrorApi('lanzarLoteCampanaApi', error);
      return { exito: false, error: 'Error de red al lanzar lote' };
    }
  }

  return { exito: false, error: 'Error de comunicación persistente con el servidor' };
}

export async function obtenerHistorialLotesApi(): Promise<{
  exito: boolean;
  historial?: CampanaEnvioHistorial[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/plantillas/historial-lotes', {
      headers: crearEncabezados(),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status}): ${texto || res.statusText}` };
    }
  } catch (error) {
    registrarErrorApi('obtenerHistorialLotesApi', error);
    return { exito: false, error: 'Error de red al obtener historial de lotes' };
  }
}

export async function eliminarLoteApi(id: number): Promise<{ exito: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/plantillas/lotes/${id}`, {
      method: 'DELETE',
      headers: crearEncabezados(),
    });
    return await res.json();
  } catch (error) {
    registrarErrorApi('eliminarLoteApi', error);
    return { exito: false, error: 'Error al eliminar el lote' };
  }
}

export async function sincronizarPlantillasConMetaApi(): Promise<{
  exito: boolean;
  total_sincronizadas?: number;
  plantillas?: PlantillaWhatsApp[];
  cuota?: CuotaDiariaWhatsApp;
  error?: string;
}> {
  try {
    const res = await fetch('/api/plantillas/sincronizar-meta', {
      method: 'POST',
      headers: crearEncabezados(),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status}): ${texto || res.statusText}` };
    }
  } catch (error) {
    registrarErrorApi('sincronizarPlantillasConMetaApi', error);
    return { exito: false, error: 'Error de red al sincronizar plantillas' };
  }
}

// --- Funciones de Configuración y Canales de Atención ---

export async function obtenerEstadoCanalesApi(): Promise<EstadoCanalesRespuesta> {
  try {
    const res = await fetch('/api/canales/estado', {
      headers: crearEncabezados(),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, optica: null, cuenta_whatsapp: null, total_cuentas_zernio: 0, error: `Error del servidor (${res.status})` };
    }
  } catch (error) {
    registrarErrorApi('obtenerEstadoCanalesApi', error);
    return { exito: false, optica: null, cuenta_whatsapp: null, total_cuentas_zernio: 0, error: 'Error al consultar estado de canales' };
  }
}

export async function obtenerUrlConexionWhatsAppApi(): Promise<{
  exito: boolean;
  url_autorizacion?: string;
  estado?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/canales/conectar/whatsapp', {
      headers: crearEncabezados(),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status})` };
    }
  } catch (error) {
    registrarErrorApi('obtenerUrlConexionWhatsAppApi', error);
    return { exito: false, error: 'Error al generar URL de conexión' };
  }
}

export async function reconectarCanalWhatsAppApi(): Promise<{
  exito: boolean;
  mensaje?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/canales/reconectar', {
      method: 'POST',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status})` };
    }
  } catch (error) {
    registrarErrorApi('reconectarCanalWhatsAppApi', error);
    return { exito: false, error: 'Error al reconectar el canal de WhatsApp' };
  }
}

export async function vincularCanalWhatsAppApi(): Promise<{
  exito: boolean;
  id_cuenta_zernio?: string;
  numero?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/canales/vincular', {
      method: 'POST',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status})` };
    }
  } catch (error) {
    registrarErrorApi('vincularCanalWhatsAppApi', error);
    return { exito: false, error: 'Error al vincular cuenta de WhatsApp' };
  }
}

export async function desconectarCanalWhatsAppApi(cambiarNumero = false): Promise<{
  exito: boolean;
  mensaje?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/canales/desconectar', {
      method: 'POST',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ cambiar_numero: cambiarNumero }),
    });
    const texto = await res.text();
    let datos: { exito: boolean; mensaje?: string; error?: string } | null = null;
    try {
      datos = JSON.parse(texto);
    } catch {
      datos = null;
    }

    if (datos && typeof datos.exito === 'boolean') {
      return datos;
    }

    if (!res.ok) {
      return { exito: false, error: `Error del servidor (${res.status})` };
    }

    return { exito: true, mensaje: 'Canal desconectado correctamente' };
  } catch (error) {
    registrarErrorApi('desconectarCanalWhatsAppApi', error);
    return { exito: false, error: 'Error al desconectar canal' };
  }
}

export async function actualizarDatosOpticaApi(datos: Partial<Optica> & { optica_id?: number }): Promise<{
  exito: boolean;
  optica?: Optica;
  error?: string;
}> {
  try {
    const idOpticaActiva = obtenerIdOpticaActiva();
    const payload = {
      ...datos,
      optica_id: datos.optica_id || idOpticaActiva || 1,
    };
    const res = await fetch('/api/configuracion/optica', {
      method: 'PUT',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    const texto = await res.text();
    try {
      const parsed = JSON.parse(texto);
      if (typeof parsed.exito === 'boolean') {
        return parsed;
      }
      return { exito: res.ok, optica: parsed.optica, error: parsed.error };
    } catch {
      return { exito: false, error: `Error del servidor (${res.status})` };
    }
  } catch (error) {
    registrarErrorApi('actualizarDatosOpticaApi', error);
    return { exito: false, error: 'Error de conexión al actualizar la configuración' };
  }
}

export async function subirLogoOpticaApi(datos: {
  imagen_base64: string;
  tipo_mime: string;
  nombre_archivo?: string;
  optica_id?: number;
}): Promise<{
  exito: boolean;
  logo_url?: string;
  error?: string;
}> {
  try {
    const idOpticaActiva = obtenerIdOpticaActiva();
    const payload = {
      ...datos,
      optica_id: datos.optica_id || idOpticaActiva || 1,
    };
    const res = await fetch('/api/configuracion/optica/logo', {
      method: 'POST',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    const texto = await res.text();
    try {
      const parsed = JSON.parse(texto);
      if (typeof parsed.exito === 'boolean') {
        return parsed;
      }
      return { exito: res.ok, logo_url: parsed.logo_url, error: parsed.error };
    } catch {
      return { exito: false, error: `Error del servidor (${res.status})` };
    }
  } catch (error) {
    registrarErrorApi('subirLogoOpticaApi', error);
    return { exito: false, error: 'Error de conexión al subir el logotipo' };
  }
}

// ==================== FUNCIONES API: AGENTE DE INTELIGENCIA ARTIFICIAL ====================

export async function obtenerConfiguracionIAApi(): Promise<{
  exito: boolean;
  configuracion?: ConfiguracionIA;
  error?: string;
}> {
  try {
    const res = await fetch('/api/configuracion/ia', {
      headers: crearEncabezados(),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status})` };
    }
  } catch (error) {
    registrarErrorApi('obtenerConfiguracionIAApi', error);
    return { exito: false, error: 'Error de red al consultar configuración de IA' };
  }
}

export async function guardarConfiguracionIAApi(datos: ConfiguracionIA): Promise<{
  exito: boolean;
  error?: string;
}> {
  try {
    const res = await fetch('/api/configuracion/ia', {
      method: 'PUT',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(datos),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status})` };
    }
  } catch (error) {
    registrarErrorApi('guardarConfiguracionIAApi', error);
    return { exito: false, error: 'Error de red al guardar configuración de IA' };
  }
}

export async function alternarIAChatApi(
  conversacion_id: number,
  activo: boolean
): Promise<{
  exito: boolean;
  ia_activa?: boolean;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/conversaciones/${conversacion_id}/ia-toggle`, {
      method: 'POST',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ activo }),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status})` };
    }
  } catch (error) {
    registrarErrorApi('alternarIAChatApi', error);
    return { exito: false, error: 'Error de red al cambiar estado de IA en chat' };
  }
}

export interface ConsumoTokensIA {
  modelo: string;
  tokens_entrada: number;
  tokens_salida: number;
  tokens_totales: number;
}

export interface ResumenConsumoIA {
  total_mensajes_respondidos: number;
  total_conversaciones: number;
  total_tokens_entrada: number;
  total_tokens_salida: number;
  total_tokens_acumulados: number;
  promedio_tokens_entrada: number;
  promedio_tokens_salida: number;
  promedio_tokens_totales: number;
}

export interface TendenciaDiariaConsumoIA {
  fecha: string;
  total_mensajes: number;
  tokens_entrada: number;
  tokens_salida: number;
  tokens_totales: number;
}

export interface RegistroConsumoIA {
  id: number;
  optica_id: number;
  nombre_optica?: string;
  conversacion_id: number | null;
  mensaje_id: number | null;
  modelo: string;
  tokens_entrada: number;
  tokens_salida: number;
  tokens_totales: number;
  tipo_evento: string;
  creado_en: string;
}

export interface FiltrosMetricasConsumoIA {
  optica_id?: number | 'todas';
  desde?: string;
  hasta?: string;
  tipo_evento?: string;
  modelo?: string;
}

export async function probarAgenteIAApi(datos: {
  mensaje_prueba: string;
  prompt_personalizado?: string;
  faq_personalizado?: string;
  tono?: string;
  api_key_prueba?: string;
  modelo?: string;
}): Promise<{
  exito: boolean;
  respuesta?: string;
  consumo?: ConsumoTokensIA;
  error?: string;
}> {
  try {
    const res = await fetch('/api/configuracion/ia/probar', {
      method: 'POST',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(datos),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status})` };
    }
  } catch (error) {
    registrarErrorApi('probarAgenteIAApi', error);
    return { exito: false, error: 'Error de red al probar agente IA' };
  }
}

export async function obtenerMetricasConsumoIAApi(
  filtros?: number | FiltrosMetricasConsumoIA
): Promise<{
  exito: boolean;
  resumen?: ResumenConsumoIA;
  tendencia_diaria?: TendenciaDiariaConsumoIA[];
  historial?: RegistroConsumoIA[];
  modelos_disponibles?: string[];
  tipos_evento_disponibles?: string[];
  error?: string;
}> {
  try {
    const params = new URLSearchParams();
    if (typeof filtros === 'number') {
      params.set('optica_id', String(filtros));
    } else if (filtros && typeof filtros === 'object') {
      if (filtros.optica_id !== undefined && filtros.optica_id !== null) {
        params.set('optica_id', String(filtros.optica_id));
      }
      if (filtros.desde) params.set('desde', filtros.desde);
      if (filtros.hasta) params.set('hasta', filtros.hasta);
      if (filtros.tipo_evento) params.set('tipo_evento', filtros.tipo_evento);
      if (filtros.modelo) params.set('modelo', filtros.modelo);
    }
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/configuracion/ia/metricas-consumo${queryStr}`, {
      method: 'GET',
      headers: crearEncabezados(),
      cache: 'no-store',
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status})` };
    }
  } catch (error) {
    registrarErrorApi('obtenerMetricasConsumoIAApi', error);
    return { exito: false, error: 'Error de red al consultar métricas de consumo de IA' };
  }
}

export async function resolverUrgenciaAsesorHumano(
  conversacion_id: number
): Promise<{ exito: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/conversaciones/${conversacion_id}/resolver-urgencia`, {
      method: 'POST',
      headers: crearEncabezados(),
    });
    return await res.json();
  } catch (error) {
    registrarErrorApi('resolverUrgenciaAsesorHumano', error);
    return { exito: false, error: 'Error al resolver urgencia' };
  }
}

export async function obtenerMotivosCitasApi(): Promise<string[]> {
  try {
    const res = await fetch(`/api/configuracion/motivos-citas?_t=${Date.now()}`, {
      headers: crearEncabezados(),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.motivos || [];
  } catch (error) {
    registrarErrorApi('obtenerMotivosCitasApi', error);
    return [];
  }
}

// -------------------------------------------------------------
// GESTIÓN DE USUARIOS Y ÓPTICAS (Solo Administrador Global)
// -------------------------------------------------------------
export async function obtenerUsuariosApi(): Promise<DatosRespuestaUsuarios> {
  try {
    const res = await fetch(`/api/usuarios?_t=${Date.now()}`, {
      headers: crearEncabezados(),
      cache: 'no-store',
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status}): ${texto || res.statusText}` };
    }
  } catch (error) {
    registrarErrorApi('obtenerUsuariosApi', error);
    return { exito: false, error: 'Error de red al consultar usuarios' };
  }
}

export async function crearUsuarioApi(datos: {
  optica_id?: number | null;
  nombre: string;
  usuario: string;
  correo?: string | null;
  contrasena: string;
  rol: 'admin' | 'admin_optica';
  activo?: boolean;
}): Promise<{ exito: boolean; usuario?: Usuario; error?: string }> {
  try {
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(datos),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status}): ${texto || res.statusText}` };
    }
  } catch (error) {
    registrarErrorApi('crearUsuarioApi', error);
    return { exito: false, error: 'Error de red al crear usuario' };
  }
}

export async function actualizarUsuarioApi(datos: {
  id: number;
  optica_id?: number | null;
  nombre?: string;
  usuario?: string;
  correo?: string | null;
  contrasena?: string;
  rol?: 'admin' | 'admin_optica';
  activo?: boolean;
}): Promise<{ exito: boolean; usuario?: Usuario; error?: string }> {
  try {
    const res = await fetch('/api/usuarios', {
      method: 'PUT',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(datos),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status}): ${texto || res.statusText}` };
    }
  } catch (error) {
    registrarErrorApi('actualizarUsuarioApi', error);
    return { exito: false, error: 'Error de red al actualizar usuario' };
  }
}

export async function cambiarEstadoUsuarioApi(
  id: number,
  activo: boolean
): Promise<{ exito: boolean; mensaje?: string; error?: string }> {
  try {
    const res = await fetch('/api/usuarios/estado', {
      method: 'PATCH',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id, activo }),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status}): ${texto || res.statusText}` };
    }
  } catch (error) {
    registrarErrorApi('cambiarEstadoUsuarioApi', error);
    return { exito: false, error: 'Error de red al cambiar estado del usuario' };
  }
}

export async function eliminarUsuarioApi(
  id: number
): Promise<{ exito: boolean; mensaje?: string; error?: string }> {
  try {
    const res = await fetch(`/api/usuarios?id=${id}`, {
      method: 'DELETE',
      headers: crearEncabezados(),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status}): ${texto || res.statusText}` };
    }
  } catch (error) {
    registrarErrorApi('eliminarUsuarioApi', error);
    return { exito: false, error: 'Error de red al eliminar usuario' };
  }
}

/**
 * Crea una nueva óptica/sede en la plataforma (exclusivo Administrador Global)
 */
export async function crearOpticaApi(
  datos: Partial<Optica>
): Promise<{ exito: boolean; optica?: Optica; error?: string }> {
  try {
    const res = await fetch('/api/opticas', {
      method: 'POST',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(datos),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status}): ${texto || res.statusText}` };
    }
  } catch (error) {
    registrarErrorApi('crearOpticaApi', error);
    return { exito: false, error: 'Error de red al crear la óptica' };
  }
}

/**
 * Actualiza los datos de una óptica existente (exclusivo Administrador Global)
 */
export async function actualizarOpticaApi(
  datos: Partial<Optica>
): Promise<{ exito: boolean; optica?: Optica; error?: string }> {
  try {
    const res = await fetch('/api/opticas', {
      method: 'PUT',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(datos),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status}): ${texto || res.statusText}` };
    }
  } catch (error) {
    registrarErrorApi('actualizarOpticaApi', error);
    return { exito: false, error: 'Error de red al actualizar la óptica' };
  }
}

/**
 * Alterna el estado activo/inactivo de una sede clínica
 */
export async function cambiarEstadoOpticaApi(
  id: number,
  activo: boolean
): Promise<{ exito: boolean; id?: number; activo?: boolean; error?: string }> {
  try {
    const res = await fetch('/api/opticas/estado', {
      method: 'PATCH',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id, activo }),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status}): ${texto || res.statusText}` };
    }
  } catch (error) {
    registrarErrorApi('cambiarEstadoOpticaApi', error);
    return { exito: false, error: 'Error de red al cambiar estado de la óptica' };
  }
}

/**
 * Alterna la habilitación del servicio de IA para una óptica
 */
export async function cambiarIaOpticaApi(
  id: number,
  ia_habilitada: boolean
): Promise<{ exito: boolean; id?: number; ia_habilitada?: boolean; error?: string }> {
  try {
    const res = await fetch('/api/opticas/ia', {
      method: 'PATCH',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id, ia_habilitada }),
    });
    const texto = await res.text();
    try {
      return JSON.parse(texto);
    } catch {
      return { exito: false, error: `Error del servidor (${res.status}): ${texto || res.statusText}` };
    }
  } catch (error) {
    registrarErrorApi('cambiarIaOpticaApi', error);
    return { exito: false, error: 'Error de red al cambiar servicio IA de la óptica' };
  }
}

/**
 * Consulta las notificaciones inteligentes calculadas al vuelo para la óptica activa
 */
export async function obtenerNotificacionesApi(): Promise<RespuestaNotificaciones> {
  try {
    const res = await fetch('/api/notificaciones', {
      headers: crearEncabezados(),
    });
    if (!res.ok) {
      return { exito: false, notificaciones: [], error: `Error del servidor (${res.status})` };
    }
    const datos: RespuestaNotificaciones = await res.json();
    return {
      exito: Boolean(datos.exito),
      notificaciones: Array.isArray(datos.notificaciones) ? datos.notificaciones : [],
      total_no_leidas: datos.total_no_leidas || 0,
      total_urgentes: datos.total_urgentes || 0,
    };
  } catch (error) {
    registrarErrorApi('obtenerNotificacionesApi', error);
    return { exito: false, notificaciones: [], error: 'Error de red al obtener notificaciones' };
  }
}

/**
 * Renueva o actualiza la fecha de vencimiento de suscripción de una óptica (Superadmin)
 */
export async function actualizarSuscripcionOpticaApi(
  id: number,
  accion: 'mas_un_mes' | 'fecha_manual',
  fecha_manual?: string
): Promise<{ exito: boolean; optica?: Optica; error?: string }> {
  try {
    const res = await fetch('/api/opticas/suscripcion', {
      method: 'PATCH',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id, accion, fecha_manual }),
    });
    const texto = await res.text();
    let datos;
    try {
      datos = JSON.parse(texto);
    } catch {
      return { exito: false, error: 'Respuesta inválida del servidor' };
    }
    if (!res.ok) {
      return { exito: false, error: datos.error || 'Error al actualizar suscripción' };
    }
    return datos;
  } catch (error) {
    registrarErrorApi('actualizarSuscripcionOpticaApi', error);
    return { exito: false, error: 'Error de red al actualizar suscripción de la óptica' };
  }
}

/**
 * Obtiene las tipologías de pacientes configuradas para la óptica activa
 */
export async function obtenerTipologiasPacientesApi(): Promise<{
  exito: boolean;
  tipologias: TipologiaPaciente[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/configuracion/tipologias-pacientes', {
      method: 'GET',
      headers: crearEncabezados(),
    });
    const datos = await res.json();
    if (!res.ok) {
      return { exito: false, tipologias: [], error: datos.error || 'Error al obtener tipologías' };
    }
    return { exito: true, tipologias: datos.tipologias || [] };
  } catch (error) {
    registrarErrorApi('obtenerTipologiasPacientesApi', error);
    return { exito: false, tipologias: [], error: 'Error de red al cargar tipologías' };
  }
}

/**
 * Crea una nueva tipología de pacientes para la óptica activa
 */
export async function crearTipologiaPacienteApi(
  nombre: string,
  color?: string
): Promise<{
  exito: boolean;
  tipologia?: TipologiaPaciente;
  error?: string;
}> {
  try {
    const res = await fetch('/api/configuracion/tipologias-pacientes', {
      method: 'POST',
      headers: crearEncabezados({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ nombre, color }),
    });
    const datos = await res.json();
    if (!res.ok || !datos.exito) {
      return { exito: false, error: datos.error || 'No se pudo crear la tipología' };
    }
    return { exito: true, tipologia: datos.tipologia };
  } catch (error) {
    registrarErrorApi('crearTipologiaPacienteApi', error);
    return { exito: false, error: 'Error de conexión al crear tipología' };
  }
}

/**
 * Elimina o desactiva una tipología de pacientes en la óptica activa
 */
export async function eliminarTipologiaPacienteApi(
  id: number
): Promise<{
  exito: boolean;
  error?: string;
}> {
  try {
    const res = await fetch(`/api/configuracion/tipologias-pacientes?id=${id}`, {
      method: 'DELETE',
      headers: crearEncabezados(),
    });
    const datos = await res.json();
    if (!res.ok || !datos.exito) {
      return { exito: false, error: datos.error || 'No se pudo eliminar la tipología' };
    }
    return { exito: true };
  } catch (error) {
    registrarErrorApi('eliminarTipologiaPacienteApi', error);
    return { exito: false, error: 'Error de conexión al eliminar tipología' };
  }
}
