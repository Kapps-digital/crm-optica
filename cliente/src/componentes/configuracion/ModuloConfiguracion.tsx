'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  MessageSquare,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Power,
  Plug,
  ShieldCheck,
  Check,
  AlertTriangle,
  X,
  Phone,
  Save,
  Upload,
  Image as ImageIcon,
  Pipette,
  RotateCcw,
  Sparkles,
  UserCheck,
  Award,
  Clock,
  Bot,
  Send,
  HelpCircle,
  Wand2,
  Zap,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  BarChart3,
  Plus,
  Tag,
  Trash2,
  Users,
} from 'lucide-react';
import { SelectorDesplegable } from '../comunes/SelectorDesplegable';
import { SelectorColorPopover } from '../comunes/SelectorColorPopover';
import { SelectorHoraPopover } from '../comunes/SelectorHoraPopover';
import { BarraPestanas, ElementoPestana } from '../comunes/BarraPestanas';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';
import {
  obtenerEstadoCanalesApi,
  obtenerUrlConexionWhatsAppApi,
  vincularCanalWhatsAppApi,
  desconectarCanalWhatsAppApi,
  reconectarCanalWhatsAppApi,
  actualizarDatosOpticaApi,
  subirLogoOpticaApi,
  obtenerUsuarioSesion,
  obtenerConfiguracionIAApi,
  guardarConfiguracionIAApi,
  probarAgenteIAApi,
  obtenerMetricasConsumoIAApi,
  obtenerTipologiasPacientesApi,
  crearTipologiaPacienteApi,
  eliminarTipologiaPacienteApi,
  type ResumenConsumoIA,
  type ConsumoTokensIA,
} from '@/servicios/api_crm';
import type { Optica, CuentaCanalWhatsApp, ConfiguracionIA, Usuario, TipologiaPaciente } from '@/tipos/crm';
import { formatearTelefono, formatearNombreEspecialista } from '@/utilidades/formato';

interface PropiedadesModuloConfiguracion {
  opticaActual?: Optica | null;
  alActualizarOptica?: (optica: Optica) => void;
  usuarioActual?: Usuario | null;
}
 
const normalizarHoraTexto = (h?: string | null): string => {
  if (!h) return '';
  const limpio = h.trim();
  const match24 = limpio.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    let numH = parseInt(match24[1], 10);
    const m = match24[2];
    const j = numH >= 12 ? 'PM' : 'AM';
    if (numH > 12) numH -= 12;
    if (numH === 0) numH = 12;
    return `${String(numH).padStart(2, '0')}:${m} ${j}`;
  }
  const match12 = limpio.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    return `${String(parseInt(match12[1], 10)).padStart(2, '0')}:${match12[2]} ${match12[3].toUpperCase()}`;
  }
  return limpio;
};

const OPCIONES_MOTIVOS_CITA = [
  { valor: '', etiqueta: 'Ninguno (sin preselección)' },
  { valor: 'Examen Visual y Control Anual', etiqueta: 'Examen Visual y Control Anual' },
  { valor: 'Primera Vez - Examen Computarizado', etiqueta: 'Primera Vez - Examen Computarizado' },
  { valor: 'Adaptación de Lentes de Contacto', etiqueta: 'Adaptación de Lentes de Contacto' },
  { valor: 'Control de Miopía y Astigmatismo', etiqueta: 'Control de Miopía y Astigmatismo' },
  { valor: 'Revisión de Montura y Graduación', etiqueta: 'Revisión de Montura y Graduación' },
  { valor: 'Molestia Ocular / Urgencia Visual', etiqueta: 'Molestia Ocular / Urgencia Visual' },
];

const OPCIONES_MODELOS_IA = [
  { valor: 'gpt-4o-mini', etiqueta: 'GPT-4o Mini (OpenAI)' },
  { valor: 'gpt-6-luna', etiqueta: 'GPT-6 Luna (OpenAI)' },
  { valor: 'gemini-flash-latest', etiqueta: 'Gemini Flash (Google)' },
];

const DIAS_SEMANA_OPCIONES = [
  { id: 'Lun', etiqueta: 'Lunes', corto: 'Lun' },
  { id: 'Mar', etiqueta: 'Martes', corto: 'Mar' },
  { id: 'Mie', etiqueta: 'Miércoles', corto: 'Mié' },
  { id: 'Jue', etiqueta: 'Jueves', corto: 'Jue' },
  { id: 'Vie', etiqueta: 'Viernes', corto: 'Vie' },
  { id: 'Sab', etiqueta: 'Sábado', corto: 'Sáb' },
  { id: 'Dom', etiqueta: 'Domingo', corto: 'Dom' },
];

const obtenerDiasActivos = (textoDias?: string | null): Record<string, boolean> => {
  const texto = (textoDias || 'Lunes a Domingo').toLowerCase().trim();
  if (texto === 'lunes a domingo' || texto === 'todos los días' || texto === 'todos los dias') {
    return { Lun: true, Mar: true, Mie: true, Jue: true, Vie: true, Sab: true, Dom: true };
  }
  if (texto === 'lunes a sábado' || texto === 'lunes a sabado') {
    return { Lun: true, Mar: true, Mie: true, Jue: true, Vie: true, Sab: true, Dom: false };
  }
  if (texto === 'lunes a viernes') {
    return { Lun: true, Mar: true, Mie: true, Jue: true, Vie: true, Sab: false, Dom: false };
  }
  if (texto.includes('fin de semana') || texto.includes('fines de semana')) {
    return { Lun: false, Mar: false, Mie: false, Jue: false, Vie: false, Sab: true, Dom: true };
  }
  return {
    Lun: /lun/i.test(texto),
    Mar: /mar/i.test(texto),
    Mie: /mi[eé]/i.test(texto),
    Jue: /jue/i.test(texto),
    Vie: /vie/i.test(texto),
    Sab: /s[aá]b/i.test(texto),
    Dom: /dom/i.test(texto),
  };
};

const generarTextoDias = (activos: Record<string, boolean>): string => {
  const lista = DIAS_SEMANA_OPCIONES.filter((d) => activos[d.id]);
  if (lista.length === 7) return 'Lunes a Domingo';
  if (lista.length === 6 && !activos.Dom) return 'Lunes a Sábado';
  if (lista.length === 5 && !activos.Sab && !activos.Dom) return 'Lunes a Viernes';
  if (lista.length === 2 && activos.Sab && activos.Dom) return 'Sábados y Domingos';
  if (lista.length === 0) return 'Lunes a Domingo';
  return lista.map((d) => d.corto).join(', ');
};

export const ModuloConfiguracion: React.FC<PropiedadesModuloConfiguracion> = ({
  opticaActual,
  alActualizarOptica,
  usuarioActual,
}) => {
  // Pestañas del módulo: 'canales' | 'perfil' | 'citas' | 'ia'
  const [pestanaActiva, setPestanaActiva] = useState<'canales' | 'perfil' | 'citas' | 'ia'>('canales');

  // Rol del usuario: el selector de modelo de IA solo es visible para 'admin'
  const usuarioSesion = useMemo(() => {
    return usuarioActual || obtenerUsuarioSesion();
  }, [usuarioActual]);
  const esAdmin = usuarioSesion?.rol === 'admin';

  // Estados de Agente IA
  const [cargandoIA, setCargandoIA] = useState(false);
  const [guardandoIA, setGuardandoIA] = useState(false);
  const [iaActiva, setIaActiva] = useState(false);
  const [iaNombre, setIaNombre] = useState('Sofía - Asistente Óptico');
  const [iaTono, setIaTono] = useState('cercano');
  const [iaModelo, setIaModelo] = useState('gpt-4o-mini');
  const [iaInstrucciones, setIaInstrucciones] = useState('');
  const [iaPreguntasFrecuentes, setIaPreguntasFrecuentes] = useState('');

  // Probador de IA en vivo
  const [mensajePrueba, setMensajePrueba] = useState('Hola, ¿qué horario de atención tienen y cómo puedo agendar una cita?');
  const [respuestaPrueba, setRespuestaPrueba] = useState<string | null>(null);
  const [consumoPrueba, setConsumoPrueba] = useState<ConsumoTokensIA | null>(null);
  const [probandoIA, setProbandoIA] = useState(false);
  const [errorPrueba, setErrorPrueba] = useState<string | null>(null);

  // Métricas de Consumo de Tokens por Óptica
  const [cargandoMetricasIA, setCargandoMetricasIA] = useState(false);
  const [resumenConsumoIA, setResumenConsumoIA] = useState<ResumenConsumoIA | null>(null);

  // Estados de Canales
  const [cargandoCanales, setCargandoCanales] = useState(true);
  const [cuentaWhatsApp, setCuentaWhatsApp] = useState<CuentaCanalWhatsApp | null>(null);
  const [opticaData, setOpticaData] = useState<Optica | null>(opticaActual || null);
  const [desconectandoCanal, setDesconectandoCanal] = useState(false);
  const [reconectandoCanal, setReconectandoCanal] = useState(false);
  const [abriendoConexion, setAbriendoConexion] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  // Sincronizar estado interno cuando cambie la óptica seleccionada globalmente
  useEffect(() => {
    if (opticaActual) {
      setOpticaData((prev) => ({
        ...(prev || {}),
        ...opticaActual,
        ia_habilitada:
          opticaActual.ia_habilitada !== undefined
            ? Boolean(opticaActual.ia_habilitada)
            : prev?.ia_habilitada !== undefined
            ? Boolean(prev.ia_habilitada)
            : false,
      }));
    }
  }, [opticaActual]);

  // Habilitación comercial de IA para la sede activa:
  // Si cualquiera de las fuentes marca false, queda deshabilitada; solo se habilita con confirmación explícita true.
  const iaHabilitada = useMemo(() => {
    if (opticaData?.ia_habilitada === false) return false;
    if (opticaActual?.ia_habilitada === false) return false;
    if (opticaData?.ia_habilitada === true) return true;
    if (opticaActual?.ia_habilitada === true) return true;
    return false;
  }, [opticaData?.ia_habilitada, opticaActual?.ia_habilitada]);

  // Redirigir a canales si la pestaña seleccionada es IA pero la óptica no tiene el servicio
  useEffect(() => {
    if (!iaHabilitada && pestanaActiva === 'ia') {
      setPestanaActiva('canales');
    }
  }, [iaHabilitada, pestanaActiva]);

  // Configuración de pestañas del módulo estandarizada con BarraPestanas
  const pestanasConfiguracion = useMemo<ElementoPestana<'canales' | 'perfil' | 'citas' | 'ia'>[]>(() => {
    const pestañas: ElementoPestana<'canales' | 'perfil' | 'citas' | 'ia'>[] = [
      {
        id: 'canales',
        etiqueta: 'Canales de Atención',
        icono: MessageSquare,
        conteo: cuentaWhatsApp?.conectado ? 1 : undefined,
      },
      {
        id: 'perfil',
        etiqueta: 'Perfil de la Óptica',
        icono: Building2,
      },
      {
        id: 'citas',
        etiqueta: 'Parámetros Clínicos & Citas',
        icono: Calendar,
      },
    ];

    if (iaHabilitada) {
      pestañas.push({
        id: 'ia',
        etiqueta: 'Agente de IA',
        icono: Bot,
        conteo: iaActiva ? 1 : undefined,
      });
    }

    return pestañas;
  }, [cuentaWhatsApp?.conectado, iaActiva, iaHabilitada]);

  // Modal de confirmación para cambiar de número
  const [modalCambiarNumeroAbierto, setModalCambiarNumeroAbierto] = useState(false);
  const [procesandoCambioNumero, setProcesandoCambioNumero] = useState(false);

  // Estados de edición de Perfil de Óptica
  const [formPerfil, setFormPerfil] = useState({
    nombre: opticaActual?.nombre || '',
    color_primario: opticaActual?.color_primario || '#0284c7',
    color_secundario: opticaActual?.color_secundario || '#0369a1',
  });
  const [archivoNuevoLogo, setArchivoNuevoLogo] = useState<File | null>(null);
  const [previsualizacionNuevoLogo, setPrevisualizacionNuevoLogo] = useState<string | null>(null);
  const refInputLogo = useRef<HTMLInputElement>(null);

  // Estados para gestión de Tipologías de Pacientes por Óptica
  const [tipologias, setTipologias] = useState<TipologiaPaciente[]>([]);
  const [cargandoTipologias, setCargandoTipologias] = useState(false);
  const [modalNuevaTipologiaAbierto, setModalNuevaTipologiaAbierto] = useState(false);
  const [nombreNuevaTipologia, setNombreNuevaTipologia] = useState('');
  const [colorNuevaTipologia, setColorNuevaTipologia] = useState('#2563eb');
  const [guardandoTipologia, setGuardandoTipologia] = useState(false);
  const [errorTipologia, setErrorTipologia] = useState<string | null>(null);
  const [tipologiaParaEliminar, setTipologiaParaEliminar] = useState<TipologiaPaciente | null>(null);
  const [eliminandoTipologia, setEliminandoTipologia] = useState(false);

  // Modal de confirmación de cambios del perfil
  const [modalConfirmarPerfilAbierto, setModalConfirmarPerfilAbierto] = useState(false);
  const [listaCambiosPerfil, setListaCambiosPerfil] = useState<
    Array<{
      campo: string;
      anterior: string;
      nuevo: string;
      tipo: 'texto' | 'color' | 'logo';
    }>
  >([]);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);

  // Estados de Parámetros de Citas y Fórmulas
  const [duracionConsulta, setDuracionConsulta] = useState('30');
  const [controlDefectoMeses, setControlDefectoMeses] = useState('12');
  const [especialistaDefecto, setEspecialistaDefecto] = useState('');
  const [registroProfesionalDefecto, setRegistroProfesionalDefecto] = useState('');
  const [motivoCitaDefecto, setMotivoCitaDefecto] = useState('');
  const [notificacionAutoCitas, setNotificacionAutoCitas] = useState(true);
  const [diasAtencion, setDiasAtencion] = useState('Lunes a Domingo');
  const [horaInicioAtencion, setHoraInicioAtencion] = useState('08:00 AM');
  const [horaFinAtencion, setHoraFinAtencion] = useState('06:00 PM');
  const [guardandoClinica, setGuardandoClinica] = useState(false);

  const diasActivos = useMemo(() => {
    return obtenerDiasActivos(diasAtencion);
  }, [diasAtencion]);

  const alternarDia = (idDia: string) => {
    const nuevos = { ...diasActivos, [idDia]: !diasActivos[idDia] };
    const totalActivos = Object.values(nuevos).filter(Boolean).length;
    if (totalActivos === 0) return;
    setDiasAtencion(generarTextoDias(nuevos));
  };

  // Modal de confirmación de cambios clínicos y agenda
  const [modalConfirmarClinicaAbierto, setModalConfirmarClinicaAbierto] = useState(false);
  const [listaCambiosClinicos, setListaCambiosClinicos] = useState<
    Array<{
      campo: string;
      anterior: string;
      nuevo: string;
    }>
  >([]);

  // Cargar estado de canales desde el backend
  const cargarEstadoCanales = useCallback(async () => {
    setCargandoCanales(true);
    try {
      const res = await obtenerEstadoCanalesApi();
      if (res.exito) {
        setCuentaWhatsApp(res.cuenta_whatsapp);
        if (res.optica) {
          const opticaMapeada = {
            ...opticaActual,
            ...res.optica,
            id: Number(res.optica.id),
            fecha_vencimiento: res.optica.fecha_vencimiento || opticaActual?.fecha_vencimiento,
            dias_restantes: res.optica.dias_restantes ?? opticaActual?.dias_restantes,
            plan_vencido: res.optica.plan_vencido ?? opticaActual?.plan_vencido,
            estado_plan: res.optica.estado_plan || opticaActual?.estado_plan,
            ia_activa: res.optica.ia_activa !== undefined ? Boolean(res.optica.ia_activa) : (opticaActual?.ia_activa !== false),
            ia_habilitada:
              res.optica.ia_habilitada !== undefined
                ? Boolean(res.optica.ia_habilitada)
                : opticaActual?.ia_habilitada !== undefined
                ? Boolean(opticaActual.ia_habilitada)
                : false,
          };
          setOpticaData(opticaMapeada);
          setFormPerfil({
            nombre: opticaMapeada.nombre || '',
            color_primario: opticaMapeada.color_primario || '#0284c7',
            color_secundario: opticaMapeada.color_secundario || '#0369a1',
          });
          setDuracionConsulta(String(opticaMapeada.duracion_cita_minutos || 30));
          setControlDefectoMeses(String(opticaMapeada.control_meses_defecto || 12));
          setEspecialistaDefecto(opticaMapeada.especialista_defecto || '');
          setRegistroProfesionalDefecto(opticaMapeada.registro_profesional_defecto || '');
          setMotivoCitaDefecto(opticaMapeada.motivo_cita_defecto || '');
          setNotificacionAutoCitas(opticaMapeada.notificacion_auto_citas_whatsapp !== false);
          setDiasAtencion(opticaMapeada.dias_atencion || 'Lunes a Domingo');
          setHoraInicioAtencion(normalizarHoraTexto(opticaMapeada.hora_inicio_atencion) || '08:00 AM');
          setHoraFinAtencion(normalizarHoraTexto(opticaMapeada.hora_fin_atencion) || '06:00 PM');

          if (alActualizarOptica) {
            alActualizarOptica(opticaMapeada);
          }
          if (typeof window !== 'undefined') {
            localStorage.setItem('crm_optica', JSON.stringify(opticaMapeada));
            window.dispatchEvent(new Event('crm_cambio_optica'));
          }
        }
      }
    } catch (e) {
      console.error('Error al cargar estado de canales:', e);
    } finally {
      setCargandoCanales(false);
    }
  }, []);

  useEffect(() => {
    cargarEstadoCanales();
  }, [cargarEstadoCanales]);

  // Cargar métricas de consumo de IA por óptica
  const cargarMetricasConsumo = useCallback(async () => {
    setCargandoMetricasIA(true);
    try {
      const res = await obtenerMetricasConsumoIAApi(opticaData?.id ? Number(opticaData.id) : undefined);
      if (res.exito && res.resumen) {
        setResumenConsumoIA(res.resumen);
      }
    } catch (e) {
      console.warn('Error al cargar métricas de consumo de IA:', e);
    } finally {
      setCargandoMetricasIA(false);
    }
  }, [opticaData?.id]);

  // Cargar configuración de IA
  const cargarConfiguracionIA = useCallback(async () => {
    setCargandoIA(true);
    try {
      const res = await obtenerConfiguracionIAApi();
      if (res.exito && res.configuracion) {
        setIaActiva(Boolean(res.configuracion.ia_activa));
        setIaNombre(res.configuracion.ia_nombre || 'Sofía - Asistente Óptico');
        setIaTono(res.configuracion.ia_tono || 'cercano');
        setIaModelo(res.configuracion.ia_modelo || 'gpt-4o-mini');
        setIaInstrucciones(res.configuracion.ia_instrucciones || '');
        setIaPreguntasFrecuentes(res.configuracion.ia_preguntas_frecuentes || '');
      }
    } catch (e) {
      console.error('Error al cargar configuración de IA:', e);
    } finally {
      setCargandoIA(false);
    }
  }, []);

  useEffect(() => {
    cargarConfiguracionIA();
    cargarMetricasConsumo();
  }, [cargarConfiguracionIA, cargarMetricasConsumo]);

  // Cargar tipologías de pacientes de la óptica
  const cargarTipologias = useCallback(async () => {
    setCargandoTipologias(true);
    try {
      const res = await obtenerTipologiasPacientesApi();
      if (res.exito) {
        setTipologias(res.tipologias || []);
      }
    } catch (e) {
      console.error('Error al cargar tipologías:', e);
    } finally {
      setCargandoTipologias(false);
    }
  }, []);

  useEffect(() => {
    cargarTipologias();
  }, [cargarTipologias]);

  const manejarCrearTipologia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreNuevaTipologia.trim()) return;
    setGuardandoTipologia(true);
    setErrorTipologia(null);
    try {
      const res = await crearTipologiaPacienteApi(nombreNuevaTipologia.trim(), colorNuevaTipologia);
      if (res.exito && res.tipologia) {
        setTipologias((prev) => [...prev, res.tipologia!].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        setNombreNuevaTipologia('');
        setColorNuevaTipologia('#2563eb');
        setModalNuevaTipologiaAbierto(false);
        setMensajeExito(`✓ Tipología "${res.tipologia.nombre}" creada correctamente.`);
        setTimeout(() => setMensajeExito(null), 3500);
      } else {
        setErrorTipologia(res.error || 'No se pudo crear la tipología');
      }
    } catch {
      setErrorTipologia('Error de conexión al guardar tipología');
    } finally {
      setGuardandoTipologia(false);
    }
  };

  const abrirModalEliminarTipologia = (tipologia: TipologiaPaciente) => {
    setTipologiaParaEliminar(tipologia);
  };

  const confirmarEliminarTipologia = async () => {
    if (!tipologiaParaEliminar) return;
    setEliminandoTipologia(true);
    try {
      const res = await eliminarTipologiaPacienteApi(tipologiaParaEliminar.id);
      if (res.exito) {
        setTipologias((prev) => prev.filter((t) => t.id !== tipologiaParaEliminar.id));
        setMensajeExito(`✓ Tipología "${tipologiaParaEliminar.nombre}" eliminada.`);
        setTimeout(() => setMensajeExito(null), 3500);
        setTipologiaParaEliminar(null);
      } else {
        setMensajeError(res.error || 'No se pudo eliminar la tipología');
        setTimeout(() => setMensajeError(null), 3500);
      }
    } catch {
      setMensajeError('Error al eliminar tipología');
      setTimeout(() => setMensajeError(null), 3500);
    } finally {
      setEliminandoTipologia(false);
    }
  };

  // Escuchar mensaje emitido por el callback de popup
  useEffect(() => {
    const manejarMensajePopup = async (evento: MessageEvent) => {
      if (evento.data?.tipo === 'CONEXION_WHATSAPP_EXITOSA' || evento.data?.tipo === 'CONEXION_ZERNIO_COMPLETADA') {
        setAbriendoConexion(false);
        setMensajeExito('¡Cuenta de WhatsApp conectada y vinculada correctamente!');
        await vincularCanalWhatsAppApi();
        await cargarEstadoCanales();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('crm_canal_whatsapp_actualizado'));
        }
        setTimeout(() => setMensajeExito(null), 5000);
      }
    };

    window.addEventListener('message', manejarMensajePopup);
    return () => window.removeEventListener('message', manejarMensajePopup);
  }, [cargarEstadoCanales]);

  // 1. Desconectar canal (mantiene el número guardado)
  const manejarDesconectarCanal = async () => {
    setDesconectandoCanal(true);
    setMensajeError(null);
    setMensajeExito(null);

    try {
      const res = await desconectarCanalWhatsAppApi(false);
      if (res.exito) {
        setMensajeExito('Canal de WhatsApp desconectado.');
        if (cuentaWhatsApp) {
          setCuentaWhatsApp({
            ...cuentaWhatsApp,
            conectado: false,
          });
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('crm_canal_whatsapp_actualizado'));
        }
        await cargarEstadoCanales();
        setTimeout(() => setMensajeExito(null), 4000);
      } else {
        setMensajeError(res.error || 'Error al desconectar el canal');
        await cargarEstadoCanales();
      }
    } catch (e) {
      console.error('Error al desconectar canal:', e);
      setMensajeError('Error de red al desconectar el canal');
      await cargarEstadoCanales();
    } finally {
      setDesconectandoCanal(false);
    }
  };

  // 2. Reconectar canal con número existente (sin ventanas emergentes)
  const manejarReconectarCanal = async () => {
    setReconectandoCanal(true);
    setMensajeError(null);
    setMensajeExito(null);

    try {
      const res = await reconectarCanalWhatsAppApi();
      if (res.exito) {
        setMensajeExito('Canal de WhatsApp reconectado con éxito.');
        if (cuentaWhatsApp) {
          setCuentaWhatsApp({
            ...cuentaWhatsApp,
            conectado: true,
          });
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('crm_canal_whatsapp_actualizado'));
        }
        await cargarEstadoCanales();
        setTimeout(() => setMensajeExito(null), 4000);
      } else {
        setMensajeError(res.error || 'No se pudo reconectar el canal');
      }
    } catch (e) {
      console.error('Error al reconectar canal:', e);
      setMensajeError('Error de red al reconectar el canal');
    } finally {
      setReconectandoCanal(false);
    }
  };

  // 3. Confirmar desvinculación para registrar un nuevo número
  const manejarConfirmarCambiarNumero = async () => {
    setProcesandoCambioNumero(true);
    setMensajeError(null);

    try {
      const res = await desconectarCanalWhatsAppApi(true);
      if (res.exito) {
        setCuentaWhatsApp(null);
        setModalCambiarNumeroAbierto(false);
        setMensajeExito('Número desvinculado con éxito. Ahora puedes conectar una nueva línea.');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('crm_canal_whatsapp_actualizado'));
        }
        await cargarEstadoCanales();
        setTimeout(() => setMensajeExito(null), 4000);
      } else {
        setMensajeError(res.error || 'Error al desvincular el número');
      }
    } catch (e) {
      console.error('Error al cambiar de número:', e);
      setMensajeError('Error de red al desvincular el número');
    } finally {
      setProcesandoCambioNumero(false);
    }
  };

  // 4. Conectar nueva línea (abre ventana de autorización oficial)
  const manejarConectarNuevoNumero = async () => {
    setAbriendoConexion(true);
    setMensajeError(null);
    setMensajeExito(null);

    try {
      const res = await obtenerUrlConexionWhatsAppApi();
      if (!res.exito || !res.url_autorizacion) {
        setMensajeError(res.error || 'No se pudo generar la URL de conexión');
        setAbriendoConexion(false);
        return;
      }

      const ancho = 640;
      const alto = 750;
      const izquierda = window.screenX + (window.outerWidth - ancho) / 2;
      const arriba = window.screenY + (window.outerHeight - alto) / 2;

      const popup = window.open(
        res.url_autorizacion,
        'whatsapp_meta_auth',
        `width=${ancho},height=${alto},left=${izquierda},top=${arriba},scrollbars=yes,status=no,toolbar=no`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        window.open(res.url_autorizacion, '_blank');
      }

      const intervalo = setInterval(async () => {
        if (!popup || popup.closed) {
          clearInterval(intervalo);
          setAbriendoConexion(false);
          await vincularCanalWhatsAppApi();
          await cargarEstadoCanales();
        }
      }, 1000);
    } catch (e) {
      console.error('Error al conectar WhatsApp:', e);
      setMensajeError('Ocurrió un error al intentar abrir la conexión');
      setAbriendoConexion(false);
    }
  };

  // Manejar selección de nuevo archivo para el logotipo
  const manejarSeleccionarArchivoLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    if (!archivo.type.startsWith('image/')) {
      setMensajeError('Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP, SVG)');
      setTimeout(() => setMensajeError(null), 3500);
      return;
    }

    setArchivoNuevoLogo(archivo);
    const urlPrevia = URL.createObjectURL(archivo);
    setPrevisualizacionNuevoLogo(urlPrevia);
  };

  // Descartar nuevo archivo de logotipo seleccionado
  const manejarDescartarNuevoLogo = () => {
    if (previsualizacionNuevoLogo) {
      URL.revokeObjectURL(previsualizacionNuevoLogo);
    }
    setArchivoNuevoLogo(null);
    setPrevisualizacionNuevoLogo(null);
    if (refInputLogo.current) {
      refInputLogo.current.value = '';
    }
  };

  // Convertir archivo File a Base64 para envío al backend
  const convertirArchivoABase64 = (archivo: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.readAsDataURL(archivo);
      lector.onload = () => resolve(lector.result as string);
      lector.onerror = (error) => reject(error);
    });
  };

  // Detectar cambios y solicitar confirmación para guardar perfil
  const manejarSolicitarGuardarPerfil = (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError(null);
    setMensajeExito(null);

    const cambios: Array<{
      campo: string;
      anterior: string;
      nuevo: string;
      tipo: 'texto' | 'color' | 'logo';
    }> = [];

    const nombreOriginal = (opticaData?.nombre || '').trim();
    const nombreActual = (formPerfil.nombre || '').trim();
    if (nombreActual !== nombreOriginal) {
      cambios.push({
        campo: 'Nombre Comercial',
        anterior: nombreOriginal || 'Sin nombre',
        nuevo: nombreActual,
        tipo: 'texto',
      });
    }

    const colorPrimarioOriginal = (opticaData?.color_primario || '#0284c7').toLowerCase();
    const colorPrimarioActual = (formPerfil.color_primario || '#0284c7').toLowerCase();
    if (colorPrimarioActual !== colorPrimarioOriginal) {
      cambios.push({
        campo: 'Color Primario',
        anterior: colorPrimarioOriginal,
        nuevo: colorPrimarioActual,
        tipo: 'color',
      });
    }

    const colorSecundarioOriginal = (opticaData?.color_secundario || '#0369a1').toLowerCase();
    const colorSecundarioActual = (formPerfil.color_secundario || '#0369a1').toLowerCase();
    if (colorSecundarioActual !== colorSecundarioOriginal) {
      cambios.push({
        campo: 'Color Secundario',
        anterior: colorSecundarioOriginal,
        nuevo: colorSecundarioActual,
        tipo: 'color',
      });
    }

    if (archivoNuevoLogo) {
      cambios.push({
        campo: 'Logo Corporativo',
        anterior: opticaData?.logo_url ? 'Logotipo actual' : 'Sin logotipo',
        nuevo: archivoNuevoLogo.name,
        tipo: 'logo',
      });
    }

    if (cambios.length === 0) {
      setMensajeError('No se han detectado modificaciones pendientes en el perfil.');
      setTimeout(() => setMensajeError(null), 3500);
      return;
    }

    setListaCambiosPerfil(cambios);
    setModalConfirmarPerfilAbierto(true);
  };

  // Ejecutar el guardado en base de datos y Storage tras confirmación del usuario
  const manejarConfirmarGuardarPerfil = async () => {
    setGuardandoPerfil(true);
    setMensajeError(null);
    setMensajeExito(null);

    try {
      let nuevoLogoUrl = opticaData?.logo_url || null;

      // 1. Si se cargó un nuevo archivo de logo, procesar subida y eliminación del previo en Storage
      if (archivoNuevoLogo) {
        const base64 = await convertirArchivoABase64(archivoNuevoLogo);
        const resLogo = await subirLogoOpticaApi({
          imagen_base64: base64,
          tipo_mime: archivoNuevoLogo.type || 'image/png',
          nombre_archivo: archivoNuevoLogo.name,
        });

        if (!resLogo.exito) {
          setMensajeError(resLogo.error || 'No se pudo subir la nueva imagen del logotipo');
          setGuardandoPerfil(false);
          return;
        }
        nuevoLogoUrl = resLogo.logo_url || null;
      }

      // 2. Actualizar datos institucionales (nombre, colores)
      const resDatos = await actualizarDatosOpticaApi({
        nombre: formPerfil.nombre.trim(),
        color_primario: formPerfil.color_primario,
        color_secundario: formPerfil.color_secundario,
        ...(nuevoLogoUrl ? { logo_url: nuevoLogoUrl } : {}),
      });

      if (!resDatos.exito || !resDatos.optica) {
        setMensajeError(resDatos.error || 'No se pudieron actualizar los datos de la óptica');
        setGuardandoPerfil(false);
        return;
      }

      const opticaActualizada = {
        ...resDatos.optica,
        id: Number(resDatos.optica.id),
        ...(nuevoLogoUrl ? { logo_url: nuevoLogoUrl } : {}),
        ia_activa: resDatos.optica?.ia_activa !== undefined ? Boolean(resDatos.optica.ia_activa) : (opticaData?.ia_activa ?? true),
      };

      setOpticaData(opticaActualizada);
      setFormPerfil({
        nombre: opticaActualizada.nombre || '',
        color_primario: opticaActualizada.color_primario || '#0284c7',
        color_secundario: opticaActualizada.color_secundario || '#0369a1',
      });
      if (alActualizarOptica) alActualizarOptica(opticaActualizada);
      if (typeof window !== 'undefined') {
        localStorage.setItem('crm_optica', JSON.stringify(opticaActualizada));
        window.dispatchEvent(new Event('crm_cambio_optica'));
      }

      // Limpiar archivo temporal y cerrar modal
      if (previsualizacionNuevoLogo) {
        URL.revokeObjectURL(previsualizacionNuevoLogo);
      }
      setArchivoNuevoLogo(null);
      setPrevisualizacionNuevoLogo(null);
      if (refInputLogo.current) {
        refInputLogo.current.value = '';
      }
      setModalConfirmarPerfilAbierto(false);

      setMensajeExito('¡Información institucional y diseño corporativo actualizados con éxito!');
      setTimeout(() => setMensajeExito(null), 4500);
    } catch (err: any) {
      setMensajeError(err.message || 'Error al procesar la actualización');
    } finally {
      setGuardandoPerfil(false);
    }
  };

  // Detectar modificaciones en reglas clínicas y solicitar confirmación modal
  const manejarSolicitarGuardarClinica = (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError(null);
    setMensajeExito(null);

    const cambios: Array<{
      campo: string;
      anterior: string;
      nuevo: string;
    }> = [];

    // 1. Duración de Consulta
    const duracionOrig = String(opticaData?.duracion_cita_minutos ?? '30');
    if (duracionConsulta !== duracionOrig) {
      cambios.push({
        campo: 'Duración Estándar por Consulta',
        anterior: `${duracionOrig} minutos`,
        nuevo: `${duracionConsulta} minutos`,
      });
    }

    // 2. Próximo Control Visual Recomendado
    const controlOrig = String(opticaData?.control_meses_defecto ?? '12');
    if (controlDefectoMeses !== controlOrig) {
      cambios.push({
        campo: 'Próximo Control Recomendado',
        anterior: `En ${controlOrig} meses`,
        nuevo: `En ${controlDefectoMeses} meses`,
      });
    }

    // 3. Especialista / Optómetra Principal
    const espOrig = (opticaData?.especialista_defecto || '').trim();
    const espActual = formatearNombreEspecialista(especialistaDefecto) || especialistaDefecto.trim();
    if (espActual !== espOrig) {
      cambios.push({
        campo: 'Especialista Principal',
        anterior: espOrig || 'Sin asignar (en blanco)',
        nuevo: espActual || 'Sin asignar (en blanco)',
      });
    }

    // 4. Registro / Tarjeta Profesional
    const regOrig = (opticaData?.registro_profesional_defecto || '').trim();
    const regActual = registroProfesionalDefecto.trim();
    if (regActual !== regOrig) {
      cambios.push({
        campo: 'Registro / Licencia Profesional',
        anterior: regOrig || 'Sin registro',
        nuevo: regActual || 'Sin registro',
      });
    }

    // 5. Motivo de Consulta Predeterminado
    const motivoOrig = (opticaData?.motivo_cita_defecto || '').trim();
    const motivoActual = motivoCitaDefecto.trim();
    if (motivoActual !== motivoOrig) {
      cambios.push({
        campo: 'Motivo de Consulta Predeterminado',
        anterior: motivoOrig || 'Ninguno (sin preselección)',
        nuevo: motivoActual || 'Ninguno (sin preselección)',
      });
    }

    // 6. Días y Horario de Atención
    const diasOrig = opticaData?.dias_atencion || 'Lunes a Domingo';
    const diasActual = diasAtencion || 'Lunes a Domingo';
    if (diasActual !== diasOrig) {
      cambios.push({
        campo: 'Días de Atención',
        anterior: diasOrig,
        nuevo: diasActual,
      });
    }

    const horaIniOrig = normalizarHoraTexto(opticaData?.hora_inicio_atencion) || '08:00 AM';
    const horaFinOrig = normalizarHoraTexto(opticaData?.hora_fin_atencion) || '06:00 PM';
    const horaIniActual = normalizarHoraTexto(horaInicioAtencion) || '08:00 AM';
    const horaFinActual = normalizarHoraTexto(horaFinAtencion) || '06:00 PM';
    if (horaIniActual !== horaIniOrig || horaFinActual !== horaFinOrig) {
      cambios.push({
        campo: 'Horario Hábil de Atención',
        anterior: `${horaIniOrig} a ${horaFinOrig}`,
        nuevo: `${horaIniActual} a ${horaFinActual}`,
      });
    }

    // 7. Notificación Automática WhatsApp
    const notifOrig = opticaData?.notificacion_auto_citas_whatsapp !== false;
    if (notificacionAutoCitas !== notifOrig) {
      cambios.push({
        campo: 'Confirmación Automática WhatsApp',
        anterior: notifOrig ? 'Activada' : 'Desactivada',
        nuevo: notificacionAutoCitas ? 'Activada' : 'Desactivada',
      });
    }

    if (cambios.length === 0) {
      setMensajeError('No se han detectado modificaciones en los parámetros clínicos.');
      setTimeout(() => setMensajeError(null), 3500);
      return;
    }

    setListaCambiosClinicos(cambios);
    setModalConfirmarClinicaAbierto(true);
  };

  // Guardar parámetros clínicos en la base de datos tras confirmación del modal
  const manejarConfirmarGuardarClinica = async () => {
    setGuardandoClinica(true);
    setMensajeError(null);
    setMensajeExito(null);

    try {
      const res = await actualizarDatosOpticaApi({
        optica_id: opticaData?.id || 1,
        duracion_cita_minutos: Number(duracionConsulta) || 30,
        control_meses_defecto: Number(controlDefectoMeses) || 12,
        especialista_defecto: formatearNombreEspecialista(especialistaDefecto) || especialistaDefecto.trim(),
        registro_profesional_defecto: registroProfesionalDefecto.trim(),
        motivo_cita_defecto: motivoCitaDefecto.trim(),
        notificacion_auto_citas_whatsapp: notificacionAutoCitas,
        dias_atencion: diasAtencion.trim() || 'Lunes a Domingo',
        hora_inicio_atencion: normalizarHoraTexto(horaInicioAtencion),
        hora_fin_atencion: normalizarHoraTexto(horaFinAtencion),
      });

      if (!res.exito || !res.optica) {
        setMensajeError(res.error || 'No se pudieron actualizar los parámetros clínicos');
        setGuardandoClinica(false);
        return;
      }

      const opticaActualizada = {
        ...res.optica,
        id: Number(res.optica.id),
        ia_activa: res.optica?.ia_activa !== undefined ? Boolean(res.optica.ia_activa) : (opticaData?.ia_activa ?? true),
      };

      setOpticaData(opticaActualizada);
      setDuracionConsulta(String(opticaActualizada.duracion_cita_minutos || 30));
      setControlDefectoMeses(String(opticaActualizada.control_meses_defecto || 12));
      setEspecialistaDefecto(opticaActualizada.especialista_defecto || '');
      setRegistroProfesionalDefecto(opticaActualizada.registro_profesional_defecto || '');
      setMotivoCitaDefecto(opticaActualizada.motivo_cita_defecto || '');
      setNotificacionAutoCitas(opticaActualizada.notificacion_auto_citas_whatsapp !== false);
      setDiasAtencion(opticaActualizada.dias_atencion || 'Lunes a Domingo');
      setHoraInicioAtencion(normalizarHoraTexto(opticaActualizada.hora_inicio_atencion) || '08:00 AM');
      setHoraFinAtencion(normalizarHoraTexto(opticaActualizada.hora_fin_atencion) || '06:00 PM');

      if (alActualizarOptica) alActualizarOptica(opticaActualizada);
      if (typeof window !== 'undefined') {
        localStorage.setItem('crm_optica', JSON.stringify(opticaActualizada));
        window.dispatchEvent(new Event('crm_cambio_optica'));
      }

      setModalConfirmarClinicaAbierto(false);
      setMensajeExito('¡Reglas clínicas y parámetros actualizados con éxito!');
      setTimeout(() => setMensajeExito(null), 4000);
    } catch (err: any) {
      setMensajeError(err.message || 'Error al procesar la actualización clínica');
    } finally {
      setGuardandoClinica(false);
    }
  };

  const manejarToggleIAGlobal = async () => {
    const nuevoEstado = !iaActiva;
    setIaActiva(nuevoEstado);
    setGuardandoIA(true);
    setMensajeError(null);
    setMensajeExito(null);

    try {
      const res = await guardarConfiguracionIAApi({
        ia_activa: nuevoEstado,
        ia_nombre: iaNombre,
        ia_tono: iaTono,
        ia_modelo: iaModelo,
        ia_instrucciones: iaInstrucciones,
        ia_preguntas_frecuentes: iaPreguntasFrecuentes,
      });

      if (res.exito) {
        if (typeof window !== 'undefined') {
          const opticaGuardada = localStorage.getItem('crm_optica');
          if (opticaGuardada) {
            try {
              const parsed = JSON.parse(opticaGuardada);
              parsed.ia_activa = nuevoEstado;
              localStorage.setItem('crm_optica', JSON.stringify(parsed));
            } catch {}
          }
          window.dispatchEvent(new Event('crm_cambio_ia_global'));
        }
        setMensajeExito(
          nuevoEstado
            ? '¡Agente de IA activado globalmente en todos los chats!'
            : 'Agente de IA desactivado globalmente en todos los chats.'
        );
        setTimeout(() => setMensajeExito(null), 4000);
      } else {
        setMensajeError(res.error || 'Error al cambiar estado global de IA');
      }
    } catch (err: any) {
      setMensajeError(err.message || 'Error de red al actualizar IA');
    } finally {
      setGuardandoIA(false);
    }
  };

  const manejarGuardarIA = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setGuardandoIA(true);
    setMensajeError(null);
    setMensajeExito(null);

    try {
      const res = await guardarConfiguracionIAApi({
        ia_activa: iaActiva,
        ia_nombre: iaNombre,
        ia_tono: iaTono,
        ia_modelo: iaModelo,
        ia_instrucciones: iaInstrucciones,
        ia_preguntas_frecuentes: iaPreguntasFrecuentes,
      });

      if (res.exito) {
        if (typeof window !== 'undefined') {
          const opticaGuardada = localStorage.getItem('crm_optica');
          if (opticaGuardada) {
            try {
              const parsed = JSON.parse(opticaGuardada);
              parsed.ia_activa = iaActiva;
              localStorage.setItem('crm_optica', JSON.stringify(parsed));
            } catch {}
          }
          window.dispatchEvent(new Event('crm_cambio_ia_global'));
        }
        setMensajeExito(
          iaActiva
            ? '¡Configuración del Agente de IA guardada y activada en todos los chats!'
            : '¡Configuración del Agente de IA guardada y desactivada en todos los chats!'
        );
        setTimeout(() => setMensajeExito(null), 4000);
      } else {
        setMensajeError(res.error || 'Error al guardar la configuración de IA');
      }
    } catch (err: any) {
      setMensajeError(err.message || 'Error de red al guardar la configuración de IA');
    } finally {
      setGuardandoIA(false);
    }
  };

  const manejarProbarIA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mensajePrueba.trim()) return;
    setProbandoIA(true);
    setRespuestaPrueba(null);
    setConsumoPrueba(null);
    setErrorPrueba(null);

    try {
      const res = await probarAgenteIAApi({
        mensaje_prueba: mensajePrueba,
        prompt_personalizado: iaInstrucciones,
        faq_personalizado: iaPreguntasFrecuentes,
        tono: iaTono,
        modelo: iaModelo,
      });

      if (res.exito && res.respuesta) {
        setRespuestaPrueba(res.respuesta);
        if (res.consumo) {
          setConsumoPrueba(res.consumo);
        }
        // Refrescar métricas acumuladas de la óptica
        cargarMetricasConsumo();
      } else {
        setErrorPrueba(res.error || 'No se pudo obtener respuesta del modelo.');
      }
    } catch (err: any) {
      setErrorPrueba(err.message || 'Error al conectar con la API de IA.');
    } finally {
      setProbandoIA(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--fondo-principal)',
        overflowY: 'auto',
      }}
    >
      {/* Pestañas de Navegación con componente estandarizado BarraPestanas */}
      <div
        style={{
          padding: '0.85rem 1.75rem 0.25rem',
          maxWidth: '1040px',
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <BarraPestanas<'canales' | 'perfil' | 'citas' | 'ia'>
          pestanas={pestanasConfiguracion}
          pestanaActiva={pestanaActiva}
          alCambiarPestana={setPestanaActiva}
        />
      </div>

      {/* Cuerpo del Módulo */}
      <div style={{ padding: '1rem 1.75rem', maxWidth: '1040px', width: '100%', margin: '0 auto' }}>
        {/* Banners de Notificación */}
        {mensajeExito && (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: 'var(--radio-md)',
              padding: '0.75rem 1rem',
              color: '#10b981',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              marginBottom: '1.5rem',
            }}
          >
            <CheckCircle2 style={{ width: '18px', height: '18px', flexShrink: 0 }} />
            <span>{mensajeExito}</span>
          </div>
        )}

        {mensajeError && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 'var(--radio-md)',
              padding: '0.75rem 1rem',
              color: '#ef4444',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              marginBottom: '1.5rem',
            }}
          >
            <AlertCircle style={{ width: '18px', height: '18px', flexShrink: 0 }} />
            <span>{mensajeError}</span>
          </div>
        )}

        {/* PESTAÑA 1: CANALES DE ATENCIÓN */}
        {pestanaActiva === 'canales' && (
          <div
            style={{
              background: 'var(--fondo-tarjeta)',
              border: '1px solid var(--borde-tarjeta)',
              borderRadius: 'var(--radio-lg)',
              padding: '1.25rem 1.5rem',
              boxShadow: 'var(--sombra-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--borde-tarjeta)',
                paddingBottom: '0.75rem',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'var(--fondo-elevado)',
                    border: '1px solid var(--borde-tarjeta)',
                    color: 'var(--color-primario)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MessageSquare style={{ width: '18px', height: '18px' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--texto-principal)', margin: 0 }}>
                    Canales de Atención
                  </h3>
                  <p style={{ fontSize: '0.74rem', color: 'var(--texto-atenuado)', margin: 0 }}>
                    Conecta tus cuentas oficiales de WhatsApp Business y gestiona la comunicación clínica.
                  </p>
                </div>
              </div>
            </div>

            {/* Fila WhatsApp (Estilo idéntico a Referencias 1 y 2) */}
            <div
              style={{
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: 'var(--radio-md)',
                padding: '1.15rem 1.35rem',
                background: 'var(--fondo-tarjeta)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                {/* Lado Izquierdo: Icono + Datos */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: 'rgba(37, 211, 102, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#25D366',
                      flexShrink: 0,
                      position: 'relative',
                    }}
                  >
                    {/* Icono de WhatsApp SVG */}
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                      <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.067-2.18-.553-1.898-.79-3.109-2.73-3.203-2.855-.095-.125-.769-1.025-.769-1.954 0-.929.489-1.385.663-1.572.174-.187.38-.234.507-.234.127 0 .253.002.364.007.117.005.276-.045.431.328.16.386.546 1.332.593 1.43.047.099.079.215.016.342-.063.128-.095.207-.19.319-.095.111-.2.249-.286.334-.095.095-.195.198-.084.388.111.19.493.813 1.057 1.316.726.647 1.338.847 1.528.942.19.095.301.079.412-.048.111-.127.475-.555.602-.745.127-.19.254-.158.428-.095.174.063 1.11.523 1.3.618.19.095.317.143.364.222.048.079.048.459-.096.864z" />
                    </svg>

                    {cuentaWhatsApp?.conectado && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: '-2px',
                          right: '-2px',
                          width: '13px',
                          height: '13px',
                          borderRadius: '50%',
                          background: '#10b981',
                          border: '2px solid var(--fondo-tarjeta)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check style={{ width: '8px', height: '8px', color: '#fff', strokeWidth: 3 }} />
                      </span>
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--texto-principal)', margin: 0 }}>
                        WhatsApp
                      </h4>
                      {cuentaWhatsApp?.conectado ? (
                        <span className="badge-pildora-exito">
                          <Check style={{ width: '10px', height: '10px', strokeWidth: 3 }} />
                          <span>Conectado</span>
                        </span>
                      ) : (cuentaWhatsApp?.tiene_cuenta_guardada || cuentaWhatsApp?.numero) ? (
                        <span
                          className="badge-pildora-suave"
                          style={{
                            background: 'rgba(234, 179, 8, 0.12)',
                            borderColor: 'rgba(234, 179, 8, 0.35)',
                            color: '#ca8a04',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                          }}
                        >
                          Desconectado
                        </span>
                      ) : null}
                    </div>

                    {cuentaWhatsApp?.conectado ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          marginTop: '0.2rem',
                          fontSize: '0.78rem',
                          color: 'var(--texto-atenuado)',
                        }}
                      >
                        <Check style={{ width: '12px', height: '12px', color: '#10b981' }} />
                        <span style={{ fontWeight: 600, color: 'var(--texto-principal)' }}>
                          {formatearTelefono(cuentaWhatsApp.numero) || cuentaWhatsApp.numero}
                        </span>
                        {cuentaWhatsApp.nombre_mostrado && (
                          <span>• {cuentaWhatsApp.nombre_mostrado}</span>
                        )}
                      </div>
                    ) : (cuentaWhatsApp?.tiene_cuenta_guardada || cuentaWhatsApp?.numero) ? (
                      <div style={{ marginTop: '0.2rem', fontSize: '0.78rem', color: 'var(--texto-atenuado)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--texto-principal)' }}>
                          {formatearTelefono(cuentaWhatsApp.numero) || cuentaWhatsApp.numero}
                        </span>
                        {cuentaWhatsApp.nombre_mostrado && (
                          <span style={{ marginLeft: '0.35rem' }}>• {cuentaWhatsApp.nombre_mostrado}</span>
                        )}
                      </div>
                    ) : (
                      <div style={{ marginTop: '0.2rem', fontSize: '0.78rem', color: 'var(--texto-atenuado)' }}>
                        Sin cuentas conectadas.
                      </div>
                    )}
                  </div>
                </div>

                {/* Lado Derecho: Acciones según estado */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  {cuentaWhatsApp?.conectado ? (
                    /* Estado 1: Conectado -> Solo botón Desconectar */
                    <button
                      type="button"
                      onClick={manejarDesconectarCanal}
                      disabled={desconectandoCanal}
                      className="btn-pildora-peligro"
                      style={{
                        padding: '0.44rem 1.05rem',
                        fontSize: '0.8rem',
                      }}
                    >
                      <Power style={{ width: '13px', height: '13px' }} />
                      <span>{desconectandoCanal ? 'Desconectando...' : 'Desconectar'}</span>
                    </button>
                  ) : (cuentaWhatsApp?.tiene_cuenta_guardada || cuentaWhatsApp?.numero) ? (
                    /* Estado 2: Desconectado con número guardado -> Reconectar y Cambiar Número */
                    <>
                      <button
                        type="button"
                        onClick={manejarReconectarCanal}
                        disabled={reconectandoCanal || desconectandoCanal}
                        className="btn-pildora-primario"
                        style={{
                          padding: '0.44rem 1.05rem',
                          fontSize: '0.8rem',
                        }}
                      >
                        <Plug style={{ width: '14px', height: '14px' }} />
                        <span>{reconectandoCanal ? 'Reconectando...' : 'Reconectar'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setModalCambiarNumeroAbierto(true)}
                        disabled={reconectandoCanal || desconectandoCanal}
                        className="btn-pildora-secundario"
                        style={{
                          padding: '0.44rem 0.95rem',
                          fontSize: '0.78rem',
                        }}
                      >
                        <span>Cambiar Número</span>
                      </button>
                    </>
                  ) : (
                    /* Estado 3: Sin cuenta conectada -> Solo botón Conectar */
                    <button
                      type="button"
                      onClick={manejarConectarNuevoNumero}
                      disabled={abriendoConexion}
                      className="btn-pildora-secundario"
                      style={{
                        padding: '0.44rem 1.05rem',
                        fontSize: '0.8rem',
                      }}
                    >
                      <Plug style={{ width: '14px', height: '14px' }} />
                      <span>{abriendoConexion ? 'Abriendo conexión...' : 'Conectar'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Badges y Descripción cuando está desconectado */}
              {!cuentaWhatsApp?.conectado && (
                <div style={{ marginTop: '0.35rem' }}>
                  {(cuentaWhatsApp?.tiene_cuenta_guardada || cuentaWhatsApp?.numero) ? (
                    <p style={{ fontSize: '0.74rem', color: 'var(--texto-atenuado)', margin: 0, lineHeight: 1.45 }}>
                      La línea se encuentra desconectada. Pulsa <strong>Reconectar</strong> para restablecer el servicio de mensajería al instante o <strong>Cambiar Número</strong> para registrar una línea diferente.
                    </p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: '0.45rem', marginBottom: '0.5rem' }}>
                        <span
                          className="badge-pildora-suave"
                          style={{
                            background: 'var(--fondo-tarjeta)',
                            borderColor: 'var(--color-primario-claro)',
                            color: 'var(--color-primario)',
                            fontWeight: 700,
                          }}
                        >
                          Coexistencia
                        </span>
                        <span className="badge-pildora-suave">
                          Solo Cloud API
                        </span>
                      </div>
                      <p style={{ fontSize: '0.74rem', color: 'var(--texto-atenuado)', margin: 0, lineHeight: 1.45 }}>
                        El número sigue funcionando en la app WhatsApp Business del celular, y lo que se conteste desde ahí también queda registrado en el CRM. Es lo que corresponde si el negocio ya atiende por ese número.
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Modo Coexistencia cuando está conectado (Referencia de Estado) */}
              {cuentaWhatsApp?.conectado && (
                <div
                  style={{
                    background: 'var(--fondo-elevado)',
                    border: '1px solid var(--borde-tarjeta)',
                    borderRadius: 'var(--radio-md)',
                    padding: '0.85rem 1.1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    marginTop: '0.25rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--color-primario)' }}>
                    <ShieldCheck style={{ width: '15px', height: '15px' }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--texto-principal)' }}>
                      Modo Coexistencia WhatsApp Business
                    </span>
                  </div>
                  <p style={{ fontSize: '0.74rem', color: 'var(--texto-atenuado)', margin: 0, lineHeight: 1.45 }}>
                    El número sigue funcionando de manera simultánea en la aplicación WhatsApp Business de tu celular. Los mensajes entrantes y las respuestas dadas desde el móvil se sincronizan automáticamente en el CRM en tiempo real.
                  </p>
                </div>
              )}

            </div>
          </div>
        )}

        {/* PESTAÑA 2: PERFIL DE LA ÓPTICA */}
        {pestanaActiva === 'perfil' && (
          <form onSubmit={manejarSolicitarGuardarPerfil} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div
              style={{
                background: 'var(--fondo-tarjeta)',
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: 'var(--radio-lg)',
                padding: '1.25rem 1.5rem',
                boxShadow: 'var(--sombra-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.15rem',
              }}
            >
              {/* Cabecera de la Sección con Botón Guardar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--borde-tarjeta)',
                  paddingBottom: '0.75rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'var(--fondo-elevado)',
                      border: '1px solid var(--borde-tarjeta)',
                      color: 'var(--color-primario)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Building2 style={{ width: '18px', height: '18px' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--texto-principal)', margin: 0 }}>
                      Información Institucional
                    </h3>
                    <p style={{ fontSize: '0.74rem', color: 'var(--texto-atenuado)', margin: 0 }}>
                      Personaliza el nombre comercial, logotipo corporativo y colores de marca de la óptica.
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={guardandoPerfil}
                  className="btn-pildora-primario"
                  style={{
                    padding: '0.4rem 1rem',
                    fontSize: '0.8rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                  }}
                >
                  <Save style={{ width: '13px', height: '13px' }} />
                  <span>{guardandoPerfil ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              </div>

              {/* Fila 1: Nombre Comercial y Logo Corporativo en 2 Columnas */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '1.25rem',
                  alignItems: 'start',
                }}
              >
                {/* Columna Izquierda: Nombre Comercial y Tipologías de Pacientes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="modal-campo-grupo">
                    <label className="modal-label">Nombre Comercial de la Óptica</label>
                    <input
                      type="text"
                      required
                      value={formPerfil.nombre}
                      onChange={(e) => setFormPerfil({ ...formPerfil, nombre: e.target.value })}
                      placeholder="Ej: Tu Visión Óptica"
                      className="modal-input"
                    />
                    <span style={{ fontSize: '0.70rem', color: 'var(--texto-atenuado)', marginTop: '0.25rem' }}>
                      Nombre oficial visible en cabecera, chats y recetas.
                    </span>
                  </div>

                  {/* Tipologías de Pacientes (Espacio señalado en la imagen) */}
                  <div
                    style={{
                      background: 'var(--fondo-elevado)',
                      border: '1px solid var(--borde-tarjeta)',
                      borderRadius: 'var(--radio-md)',
                      padding: '0.75rem 0.95rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.55rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div>
                        <div style={{ fontSize: '0.80rem', fontWeight: 700, color: 'var(--texto-principal)' }}>
                          Tipologías de Pacientes
                        </div>
                        <div style={{ fontSize: '0.67rem', color: 'var(--texto-atenuado)', marginTop: '1px' }}>
                          Clasificaciones para diferenciar y filtrar pacientes.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNombreNuevaTipologia('');
                          setColorNuevaTipologia('#2563eb');
                          setErrorTipologia(null);
                          setModalNuevaTipologiaAbierto(true);
                        }}
                        className="btn-pildora-secundario"
                        style={{ padding: '0.25rem 0.55rem', fontSize: '0.72rem', gap: '0.25rem' }}
                      >
                        <Plus style={{ width: '12px', height: '12px' }} />
                        <span>Nueva</span>
                      </button>
                    </div>

                    {/* Lista de píldoras de tipologías */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.15rem' }}>
                      {tipologias.length === 0 ? (
                        <span style={{ fontSize: '0.72rem', color: 'var(--texto-atenuado)', fontStyle: 'italic' }}>
                          Sin tipologías configuradas aún.
                        </span>
                      ) : (
                        tipologias.map((tip) => (
                          <div
                            key={tip.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.20rem 0.55rem',
                              borderRadius: '9999px',
                              background: 'var(--fondo-tarjeta)',
                              border: '1px solid var(--borde-tarjeta)',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              color: 'var(--texto-principal)',
                            }}
                          >
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                background: tip.color || '#0284c7',
                                flexShrink: 0,
                              }}
                            />
                            <span>{tip.nombre}</span>
                            <button
                              type="button"
                              onClick={() => abrirModalEliminarTipologia(tip)}
                              title={`Eliminar tipología "${tip.nombre}"`}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                padding: 0,
                                marginLeft: '2px',
                                cursor: 'pointer',
                                color: 'var(--texto-atenuado)',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'color 0.15s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-peligro-rojo)')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--texto-atenuado)')}
                            >
                              <X style={{ width: '11px', height: '11px' }} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Columna Derecha: Logo Corporativo */}
                <div className="modal-campo-grupo">
                  <label className="modal-label">Logo Corporativo</label>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      background: 'var(--fondo-elevado)',
                      border: '1px solid var(--borde-tarjeta)',
                      borderRadius: 'var(--radio-md)',
                      padding: '0.75rem 1rem',
                    }}
                  >
                    {/* Vista Previa del Logotipo */}
                    <div className="logo-previsualizacion-caja" style={{ width: '64px', height: '64px', minWidth: '64px' }}>
                      {previsualizacionNuevoLogo || opticaData?.logo_url ? (
                        <img
                          src={previsualizacionNuevoLogo || opticaData?.logo_url || ''}
                          alt="Logotipo Corporativo"
                          className="logo-previsualizacion-img"
                        />
                      ) : (
                        <ImageIcon style={{ width: '28px', height: '28px', color: 'var(--texto-atenuado)', opacity: 0.6 }} />
                      )}
                    </div>

                    {/* Acciones para Carga de Imagen */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <input
                          ref={refInputLogo}
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                          onChange={manejarSeleccionarArchivoLogo}
                          style={{ display: 'none' }}
                        />
                        <button
                          type="button"
                          onClick={() => refInputLogo.current?.click()}
                          className="btn-pildora-secundario"
                          style={{ padding: '0.38rem 0.85rem', fontSize: '0.78rem' }}
                        >
                          <Upload style={{ width: '13px', height: '13px' }} />
                          <span>{archivoNuevoLogo ? 'Cambiar Imagen' : 'Subir Nuevo Logo'}</span>
                        </button>

                        {archivoNuevoLogo && (
                          <button
                            type="button"
                            onClick={manejarDescartarNuevoLogo}
                            className="btn-pildora-secundario"
                            style={{
                              padding: '0.38rem 0.75rem',
                              fontSize: '0.78rem',
                              color: 'var(--color-peligro-rojo)',
                              borderColor: 'rgba(239, 68, 68, 0.3)',
                            }}
                          >
                            <RotateCcw style={{ width: '12px', height: '12px' }} />
                            <span>Restaurar Actual</span>
                          </button>
                        )}
                      </div>

                      <div style={{ fontSize: '0.71rem', color: 'var(--texto-atenuado)' }}>
                        {archivoNuevoLogo ? (
                          <span style={{ color: 'var(--color-primario)', fontWeight: 600 }}>
                            {archivoNuevoLogo.name} ({(archivoNuevoLogo.size / 1024).toFixed(1)} KB)
                          </span>
                        ) : (
                          <span>Formatos: PNG, JPG, WEBP, SVG. Visible en cabecera y recetas.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Colores Institucionales */}
              <div
                style={{
                  borderTop: '1px solid var(--borde-tarjeta)',
                  paddingTop: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--texto-principal)', margin: '0 0 0.2rem 0' }}>
                    Paleta de Colores de Marca
                  </h4>
                  <p style={{ fontSize: '0.73rem', color: 'var(--texto-atenuado)', margin: 0 }}>
                    Haz clic en cada tarjeta para abrir el selector de color y definir los tonos primario y secundario del CRM.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  {/* Selector Color Primario */}
                  <div className="modal-campo-grupo">
                    <label className="modal-label">Color Primario</label>
                    <SelectorColorPopover
                      valor={formPerfil.color_primario}
                      alCambiar={(nuevoColor) => setFormPerfil({ ...formPerfil, color_primario: nuevoColor })}
                      placeholder="Seleccionar Color Primario"
                    />
                  </div>

                  {/* Selector Color Secundario */}
                  <div className="modal-campo-grupo">
                    <label className="modal-label">Color Secundario</label>
                    <SelectorColorPopover
                      valor={formPerfil.color_secundario}
                      alCambiar={(nuevoColor) => setFormPerfil({ ...formPerfil, color_secundario: nuevoColor })}
                      placeholder="Seleccionar Color Secundario"
                    />
                  </div>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* PESTAÑA 3: PARÁMETROS CLÍNICOS & CITAS */}
        {pestanaActiva === 'citas' && (
          <form onSubmit={manejarSolicitarGuardarClinica}>
            <div
              style={{
                background: 'var(--fondo-tarjeta)',
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: 'var(--radio-lg)',
                padding: '1.15rem 1.35rem',
                boxShadow: 'var(--sombra-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
              }}
            >
              {/* Encabezado de la Tarjeta Compacto con Botón Guardar Integrado */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--borde-tarjeta)',
                  paddingBottom: '0.65rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'var(--fondo-elevado)',
                      border: '1px solid var(--borde-tarjeta)',
                      color: 'var(--color-primario)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Calendar style={{ width: '18px', height: '18px' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--texto-principal)', margin: 0 }}>
                      Reglas de Agenda & Atención Clínica
                    </h3>
                    <p style={{ fontSize: '0.74rem', color: 'var(--texto-atenuado)', margin: 0 }}>
                      Valores predeterminados para citas, tiempos de control y profesional a cargo.
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={guardandoClinica}
                  className="btn-pildora-primario"
                  style={{
                    padding: '0.4rem 1rem',
                    fontSize: '0.8rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                  }}
                >
                  <Save style={{ width: '13px', height: '13px' }} />
                  <span>{guardandoClinica ? 'Guardando...' : 'Guardar Reglas'}</span>
                </button>
              </div>

              {/* Parámetros Clínicos en Rejilla Compacta de 3 Columnas */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: '0.75rem 1rem',
                }}
              >
                {/* 1. Duración de Consulta */}
                <div className="modal-campo-grupo">
                  <label className="modal-label" style={{ fontSize: '0.73rem', fontWeight: 600 }}>
                    Duración Estándar por Consulta
                  </label>
                  <SelectorDesplegable
                    valor={duracionConsulta}
                    alCambiar={setDuracionConsulta}
                    opciones={[
                      { valor: '20', etiqueta: '20 min (Rápida)' },
                      { valor: '30', etiqueta: '30 min (Estándar Optometría)' },
                      { valor: '45', etiqueta: '45 min (Examen + Fondo Ojo)' },
                      { valor: '60', etiqueta: '60 min (Especializada / Lentes)' },
                    ]}
                    tamano="compacto"
                    anchoMinimo="100%"
                  />
                  <span style={{ fontSize: '0.69rem', color: 'var(--texto-atenuado)', marginTop: '0.2rem', lineHeight: '1.2' }}>
                    Franja de tiempo reservada en el calendario para cada cita.
                  </span>
                </div>

                {/* 2. Próximo Control Visual */}
                <div className="modal-campo-grupo">
                  <label className="modal-label" style={{ fontSize: '0.73rem', fontWeight: 600 }}>
                    Próximo Control Recomendado
                  </label>
                  <SelectorDesplegable
                    valor={controlDefectoMeses}
                    alCambiar={setControlDefectoMeses}
                    opciones={[
                      { valor: '6', etiqueta: 'En 6 meses (Estricto)' },
                      { valor: '12', etiqueta: 'En 12 meses (Anual)' },
                      { valor: '18', etiqueta: 'En 18 meses' },
                      { valor: '24', etiqueta: 'En 24 meses' },
                    ]}
                    tamano="compacto"
                    anchoMinimo="100%"
                  />
                  <span style={{ fontSize: '0.69rem', color: 'var(--texto-atenuado)', marginTop: '0.2rem', lineHeight: '1.2' }}>
                    Tiempo sugerido por defecto al redactar prescripciones ópticas.
                  </span>
                </div>

                {/* 3. Días y Horario de Atención */}
                <div className="modal-campo-grupo">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <label className="modal-label" style={{ fontSize: '0.73rem', fontWeight: 600, margin: 0 }}>
                      Días & Horario de Atención
                    </label>
                    <span style={{ fontSize: '0.67rem', fontWeight: 700, color: 'var(--color-primario)', background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)', padding: '0.06rem 0.38rem', borderRadius: '4px' }}>
                      {diasAtencion || 'Lunes a Domingo'}
                    </span>
                  </div>

                  {/* Selector interactivo de días de atención */}
                  <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.35rem', width: '100%' }}>
                    {DIAS_SEMANA_OPCIONES.map((dia) => {
                      const activo = diasActivos[dia.id];
                      return (
                        <button
                          key={dia.id}
                          type="button"
                          onClick={() => alternarDia(dia.id)}
                          title={`${dia.etiqueta}: ${activo ? 'Abierto (clic para desactivar)' : 'Cerrado (clic para activar)'}`}
                          style={{
                            flex: 1,
                            padding: '0.22rem 0',
                            fontSize: '0.69rem',
                            fontWeight: 700,
                            borderRadius: '5px',
                            border: activo
                              ? '1px solid var(--color-primario)'
                              : '1px solid var(--borde-tarjeta, rgba(0,0,0,0.12))',
                            backgroundColor: activo
                              ? 'var(--color-primario)'
                              : 'var(--fondo-tarjeta, transparent)',
                            color: activo ? '#ffffff' : 'var(--texto-atenuado)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {dia.corto}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <div style={{ flex: 1 }}>
                      <SelectorHoraPopover
                        valor={horaInicioAtencion}
                        alCambiar={setHoraInicioAtencion}
                        placeholder="Inicio..."
                      />
                    </div>
                    <span style={{ color: 'var(--texto-atenuado)', fontSize: '0.76rem', fontWeight: 600 }}>a</span>
                    <div style={{ flex: 1 }}>
                      <SelectorHoraPopover
                        valor={horaFinAtencion}
                        alCambiar={setHoraFinAtencion}
                        placeholder="Fin..."
                      />
                    </div>
                  </div>
                  <span style={{ fontSize: '0.69rem', color: 'var(--texto-atenuado)', marginTop: '0.2rem', lineHeight: '1.2' }}>
                    Días y rango horario operativo visibles en el selector de citas.
                  </span>
                </div>

                {/* 4. Especialista Principal */}
                <div className="modal-campo-grupo">
                  <label className="modal-label" style={{ fontSize: '0.73rem', fontWeight: 600 }}>
                    Especialista / Optómetra Principal
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <UserCheck
                      style={{
                        position: 'absolute',
                        left: '0.75rem',
                        width: '14px',
                        height: '14px',
                        color: 'var(--color-primario)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      type="text"
                      value={especialistaDefecto}
                      onChange={(e) => setEspecialistaDefecto(e.target.value)}
                      onBlur={() => setEspecialistaDefecto(formatearNombreEspecialista(especialistaDefecto))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          setEspecialistaDefecto(formatearNombreEspecialista(especialistaDefecto));
                          (e.currentTarget as HTMLInputElement).blur();
                        }
                      }}
                      placeholder="Sin asignar (en blanco por defecto)"
                      className="modal-input"
                      style={{ paddingLeft: '2.1rem', paddingBlock: '0.36rem', fontSize: '0.78rem' }}
                    />
                  </div>
                  <span style={{ fontSize: '0.69rem', color: 'var(--texto-atenuado)', marginTop: '0.2rem', lineHeight: '1.2' }}>
                    Se pre-cargará al agendar citas y recetas si se define.
                  </span>
                </div>

                {/* 5. Registro / Tarjeta Profesional */}
                <div className="modal-campo-grupo">
                  <label className="modal-label" style={{ fontSize: '0.73rem', fontWeight: 600 }}>
                    Registro / Tarjeta Profesional
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Award
                      style={{
                        position: 'absolute',
                        left: '0.75rem',
                        width: '14px',
                        height: '14px',
                        color: 'var(--texto-atenuado)',
                        pointerEvents: 'none',
                      }}
                    />
                    <input
                      type="text"
                      value={registroProfesionalDefecto}
                      onChange={(e) => setRegistroProfesionalDefecto(e.target.value)}
                      placeholder="Ej: T.P. 123456 / R.M. 7890"
                      className="modal-input"
                      style={{ paddingLeft: '2.1rem', paddingBlock: '0.36rem', fontSize: '0.78rem' }}
                    />
                  </div>
                  <span style={{ fontSize: '0.69rem', color: 'var(--texto-atenuado)', marginTop: '0.2rem', lineHeight: '1.2' }}>
                    Número legal que valida la firma en fórmulas y mensajes oficiales.
                  </span>
                </div>

                {/* 6. Motivo de Cita Predeterminado */}
                <div className="modal-campo-grupo">
                  <label className="modal-label" style={{ fontSize: '0.73rem', fontWeight: 600 }}>
                    Motivo de Consulta Predeterminado
                  </label>
                  <SelectorDesplegable
                    valor={motivoCitaDefecto}
                    alCambiar={setMotivoCitaDefecto}
                    opciones={OPCIONES_MOTIVOS_CITA}
                    placeholder="Sin seleccionar..."
                    tamano="compacto"
                    anchoMinimo="100%"
                  />
                  <span style={{ fontSize: '0.69rem', color: 'var(--texto-atenuado)', marginTop: '0.2rem', lineHeight: '1.2' }}>
                    Motivo pre-cargado al abrir el agendador (o déjalo en blanco).
                  </span>
                </div>
              </div>

              {/* Fila Inferior: Checkbox WhatsApp */}
              <div
                style={{
                  borderTop: '1px solid var(--borde-tarjeta)',
                  paddingTop: '0.65rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.6rem',
                }}
              >
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={notificacionAutoCitas}
                    onChange={(e) => setNotificacionAutoCitas(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--color-primario)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--texto-principal)' }}>
                    Activar confirmación automática por WhatsApp al agendar
                  </span>
                  <span style={{ fontSize: '0.71rem', color: 'var(--texto-atenuado)' }}>
                    (envía especialista, fecha y hora al paciente)
                  </span>
                </label>
              </div>
            </div>
          </form>
        )}

        {/* PESTAÑA 4: AGENTE DE INTELIGENCIA ARTIFICIAL (Solo si está habilitado por Superadmin) */}
        {pestanaActiva === 'ia' && iaHabilitada && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Tarjeta Principal Unificada del Agente de IA */}
            <div
              style={{
                background: 'var(--fondo-tarjeta)',
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: 'var(--radio-lg)',
                padding: '1.25rem 1.5rem',
                boxShadow: 'var(--sombra-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
              }}
            >
              {/* Encabezado Integrado (Diseño definitivo con switch compacto y botón Guardar Ajustes a la derecha) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--borde-tarjeta)',
                  paddingBottom: '0.75rem',
                  flexWrap: 'nowrap',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'var(--fondo-elevado)',
                      border: '1px solid var(--borde-tarjeta)',
                      color: 'var(--color-primario)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Bot style={{ width: '18px', height: '18px' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--texto-principal)', margin: 0 }}>
                        Agente de Inteligencia Artificial
                      </h3>
                      {/* Píldora de Estado del Agente de IA con Etiqueta Tooltip Premium */}
                      <EtiquetaTooltip
                        texto={iaActiva ? 'Clic para pausar Agente de IA' : 'Clic para activar Agente de IA'}
                        posicion="arriba"
                      >
                        <button
                          type="button"
                          onClick={manejarToggleIAGlobal}
                          disabled={guardandoIA}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            padding: '0.28rem 0.75rem',
                            borderRadius: '9999px',
                            border: 'none',
                            background: iaActiva ? 'rgba(16, 185, 129, 0.16)' : 'rgba(100, 116, 139, 0.14)',
                            color: iaActiva ? '#059669' : '#475569',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: guardandoIA ? 'not-allowed' : 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s ease',
                            opacity: guardandoIA ? 0.7 : 1,
                          }}
                          onMouseEnter={(e) => {
                            if (!guardandoIA) {
                              e.currentTarget.style.opacity = '0.85';
                              e.currentTarget.style.transform = 'translateY(-0.5px)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!guardandoIA) {
                              e.currentTarget.style.opacity = '1';
                              e.currentTarget.style.transform = 'none';
                            }
                          }}
                        >
                          <span
                            style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              background: iaActiva ? '#059669' : '#64748b',
                              boxShadow: iaActiva ? '0 0 0 2.5px rgba(16, 185, 129, 0.25)' : 'none',
                              display: 'inline-block',
                              flexShrink: 0,
                            }}
                          />
                          <span>{iaActiva ? 'Activo' : 'Inactivo'}</span>
                        </button>
                      </EtiquetaTooltip>
                    </div>
                    <p style={{ fontSize: '0.74rem', color: 'var(--texto-atenuado)', margin: '0.15rem 0 0 0', lineHeight: 1.35 }}>
                      Atiende automáticamente a tus clientes en tus canales de mensajería, resuelve preguntas frecuentes y agenda citas en el CRM.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={manejarGuardarIA}
                  disabled={guardandoIA}
                  className="btn-pildora-primario"
                  style={{
                    padding: '0.4rem 1rem',
                    fontSize: '0.8rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  <Save style={{ width: '13px', height: '13px' }} />
                  <span>{guardandoIA ? 'Guardando...' : 'Guardar Ajustes'}</span>
                </button>
              </div>

              {/* Subsecciones Integradas en Rejilla de 2 Columnas directas dentro de la misma tarjeta */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                  gap: '1.25rem',
                  alignItems: 'start',
                }}
              >
                {/* Columna Izquierda: Identidad y Tono */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--borde-tarjeta)', paddingBottom: '0.5rem' }}>
                    <Wand2 style={{ width: '15px', height: '15px', color: 'var(--color-primario)' }} />
                    <h4 style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--texto-principal)', margin: 0 }}>
                      Identidad y Tono de Comunicación
                    </h4>
                  </div>

                  {/* Nombre del Asistente */}
                  <div className="modal-campo-grupo">
                    <label className="modal-label" style={{ fontSize: '0.74rem', fontWeight: 600 }}>
                      Nombre del Asistente Virtual
                    </label>
                    <input
                      type="text"
                      value={iaNombre}
                      onChange={(e) => setIaNombre(e.target.value)}
                      placeholder="Ej: Sofía - Asistente Óptico"
                      className="modal-input"
                      style={{ fontSize: '0.8rem' }}
                    />
                    <span style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)', marginTop: '0.2rem' }}>
                      Nombre con el que se identificará ante los pacientes al saludar.
                    </span>
                  </div>

                  {/* Tono de Comunicación */}
                  <div className="modal-campo-grupo">
                    <label className="modal-label" style={{ fontSize: '0.74rem', fontWeight: 600 }}>
                      Estilo y Tono de Atención
                    </label>
                    <SelectorDesplegable
                      valor={iaTono}
                      alCambiar={setIaTono}
                      opciones={[
                        { valor: 'cercano', etiqueta: 'Cercano, cálido y empático (Recomendado)' },
                        { valor: 'formal', etiqueta: 'Formal y profesional' },
                        { valor: 'comercial', etiqueta: 'Comercial, persuasivo y dinámico' },
                      ]}
                      tamano="compacto"
                      anchoMinimo="100%"
                    />
                    <span style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)', marginTop: '0.2rem' }}>
                      Define la manera en que el modelo redacta sus oraciones y trata al paciente.
                    </span>
                  </div>

                  {/* Selector de Modelo de IA (Exclusivo Administrador Global) */}
                  {esAdmin && (
                    <div className="modal-campo-grupo">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                        <label className="modal-label" style={{ fontSize: '0.74rem', fontWeight: 600 }}>
                          Modelo de Inteligencia Artificial
                        </label>
                        <span
                          style={{
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            padding: '0.12rem 0.45rem',
                            borderRadius: '4px',
                            background: 'rgba(2, 132, 199, 0.12)',
                            color: 'var(--color-primario)',
                            letterSpacing: '0.02em',
                          }}
                        >
                          Solo Admin
                        </span>
                      </div>
                      <SelectorDesplegable
                        valor={iaModelo}
                        alCambiar={setIaModelo}
                        opciones={OPCIONES_MODELOS_IA}
                        tamano="compacto"
                        anchoMinimo="100%"
                      />
                      <span style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)', marginTop: '0.2rem' }}>
                        Motor que genera las respuestas automáticas en WhatsApp y agendamientos.
                      </span>
                    </div>
                  )}
                </div>

                {/* Columna Derecha: Directrices del Negocio y Preguntas Frecuentes (FAQ) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--borde-tarjeta)', paddingBottom: '0.5rem' }}>
                    <HelpCircle style={{ width: '15px', height: '15px', color: 'var(--color-primario)' }} />
                    <h4 style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--texto-principal)', margin: 0 }}>
                      Directrices del Negocio y Preguntas Frecuentes (FAQ)
                    </h4>
                  </div>

                  {/* Instrucciones del Negocio */}
                  <div className="modal-campo-grupo">
                    <label className="modal-label" style={{ fontSize: '0.74rem', fontWeight: 600 }}>
                      Instrucciones y Personalidad del Negocio
                    </label>
                    <textarea
                      rows={4}
                      value={iaInstrucciones}
                      onChange={(e) => setIaInstrucciones(e.target.value)}
                      placeholder="Ejemplo: Somos una óptica con más de 10 años de experiencia especializada en salud visual. Destaca siempre que nuestros exámenes incluyen optometría computarizada y que contamos con laboratorio propio para entrega rápida de gafas..."
                      className="modal-input"
                      style={{ fontSize: '0.78rem', resize: 'vertical', lineHeight: '1.4' }}
                    />
                    <span style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)', marginTop: '0.2rem' }}>
                      Directrices de comportamiento, valores de la marca y cómo orientar al paciente.
                    </span>
                  </div>

                  {/* Base de Conocimiento y FAQ */}
                  <div className="modal-campo-grupo">
                    <label className="modal-label" style={{ fontSize: '0.74rem', fontWeight: 600 }}>
                      Base de Conocimiento y Preguntas Frecuentes (FAQ)
                    </label>
                    <textarea
                      rows={6}
                      value={iaPreguntasFrecuentes}
                      onChange={(e) => setIaPreguntasFrecuentes(e.target.value)}
                      placeholder={`Escribe aquí información clave que el bot debe saber:
- ¿Cuánto cuesta el examen visual?: Es gratis por la compra de la montura y lentes, o $35.000 para llevar la fórmula.
- ¿Dónde están ubicados?: Calle 45 # 12-34, cerca a la estación principal.
- ¿Hacen envíos?: Sí, envíos a domicilio sin costo adicional en el área metropolitana.
- ¿Qué garantía ofrecen?: 1 año de garantía en monturas y tratamiento antirreflejo.`}
                      className="modal-input"
                      style={{ fontSize: '0.78rem', resize: 'vertical', lineHeight: '1.4' }}
                    />
                    <span style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)', marginTop: '0.2rem' }}>
                      Datos precisos, precios y políticas. La IA solo responderá lo que esté escrito aquí.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Probador en Vivo de la IA */}
            <div
              style={{
                background: 'var(--fondo-tarjeta)',
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: 'var(--radio-lg)',
                padding: '1.25rem 1.5rem',
                boxShadow: 'var(--sombra-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Sparkles style={{ width: '17px', height: '17px', color: 'var(--color-primario)' }} />
                <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--texto-principal)', margin: 0 }}>
                  Simulador de Pruebas en Vivo
                </h4>
                <span style={{ fontSize: '0.7rem', color: 'var(--texto-atenuado)' }}>
                  (Prueba cómo responderá tu agente antes de que atienda pacientes reales)
                </span>
              </div>

              <form onSubmit={manejarProbarIA} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.65rem' }}>
                  <input
                    type="text"
                    value={mensajePrueba}
                    onChange={(e) => setMensajePrueba(e.target.value)}
                    placeholder="Escribe una pregunta de prueba..."
                    className="modal-input"
                    style={{ flex: 1, fontSize: '0.8rem' }}
                  />
                  <button
                    type="submit"
                    disabled={probandoIA || !mensajePrueba.trim()}
                    className="btn-pildora-primario"
                    style={{
                      padding: '0.45rem 1.15rem',
                      fontSize: '0.78rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Send style={{ width: '13px', height: '13px' }} />
                    <span>{probandoIA ? 'Generando...' : 'Probar Respuesta'}</span>
                  </button>
                </div>

                {errorPrueba && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: 'var(--radio-md)',
                      padding: '0.6rem 0.85rem',
                      color: '#ef4444',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                    }}
                  >
                    {errorPrueba}
                  </div>
                )}

                {respuestaPrueba && (
                  <div
                    style={{
                      background: 'rgba(16, 185, 129, 0.05)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: 'var(--radio-md)',
                      padding: '1rem 1.15rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem',
                      maxHeight: '450px',
                      overflowY: 'auto',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.3rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#10b981', fontSize: '0.74rem', fontWeight: 700 }}>
                        <Bot size={15} />
                        <span>Respuesta generada por {iaNombre}:</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRespuestaPrueba(null)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--texto-atenuado)',
                          fontSize: '0.68rem',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          padding: '0 0.2rem',
                        }}
                      >
                        Limpiar prueba
                      </button>
                    </div>
                    <div
                      style={{
                        margin: 0,
                        fontSize: '0.82rem',
                        color: 'var(--texto-principal)',
                        lineHeight: '1.55',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {respuestaPrueba}
                    </div>

                    {consumoPrueba && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.85rem',
                          marginTop: '0.65rem',
                          padding: '0.5rem 0.85rem',
                          borderRadius: 'var(--radio-md)',
                          background: 'var(--fondo-elevado)',
                          border: '1px solid var(--borde-tarjeta)',
                          fontSize: '0.74rem',
                          color: 'var(--texto-principal)',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ fontWeight: 700, color: 'var(--color-primario)', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Zap size={13} /> Consumo de esta respuesta:
                        </span>
                        <span><strong>Entrada:</strong> {consumoPrueba.tokens_entrada.toLocaleString('es-CO')} tokens</span>
                        <span><strong>Salida:</strong> {consumoPrueba.tokens_salida.toLocaleString('es-CO')} tokens</span>
                        <span><strong>Total:</strong> {consumoPrueba.tokens_totales.toLocaleString('es-CO')} tokens</span>
                        <span style={{ color: 'var(--texto-atenuado)' }}>({consumoPrueba.modelo})</span>
                      </div>
                    )}
                  </div>
                )}
              </form>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE CONFIRMACIÓN: CAMBIAR NÚMERO */}
      {modalCambiarNumeroAbierto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--fondo-tarjeta)',
              border: '1px solid var(--borde-tarjeta)',
              borderRadius: 'var(--radio-lg)',
              maxWidth: '440px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: 'var(--sombra-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b' }}>
                <AlertTriangle style={{ width: '20px', height: '20px' }} />
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: 'var(--texto-principal)' }}>
                  ¿Deseas cambiar el número de teléfono?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalCambiarNumeroAbierto(false)}
                style={{ background: 'none', border: 'none', color: 'var(--texto-atenuado)', cursor: 'pointer' }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--texto-atenuado)', margin: 0, lineHeight: 1.5 }}>
              ¿Estás seguro de que deseas cambiar el número de teléfono? Al confirmar, se desvinculará este número para que puedas conectar una nueva línea telefónica.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setModalCambiarNumeroAbierto(false)}
                disabled={procesandoCambioNumero}
                className="btn-pildora-secundario"
                style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={manejarConfirmarCambiarNumero}
                disabled={procesandoCambioNumero}
                className="btn-pildora-peligro"
                style={{
                  background: '#ef4444',
                  color: '#ffffff',
                  borderColor: '#ef4444',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                  padding: '0.45rem 1rem',
                  fontSize: '0.82rem',
                }}
              >
                <Power style={{ width: '13px', height: '13px' }} />
                <span>{procesandoCambioNumero ? 'Desvinculando...' : 'Confirmar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN: CAMBIOS EN EL PERFIL DE LA ÓPTICA */}
      {modalConfirmarPerfilAbierto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--fondo-tarjeta)',
              border: '1px solid var(--borde-tarjeta)',
              borderRadius: 'var(--radio-lg)',
              maxWidth: '480px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: 'var(--sombra-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.15rem',
            }}
          >
            {/* Cabecera del Modal */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'var(--fondo-elevado)',
                    border: '1px solid var(--borde-tarjeta)',
                    color: 'var(--color-primario)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Building2 style={{ width: '18px', height: '18px' }} />
                </div>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: 'var(--texto-principal)' }}>
                  Confirmar Cambios en el Perfil
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalConfirmarPerfilAbierto(false)}
                disabled={guardandoPerfil}
                style={{ background: 'none', border: 'none', color: 'var(--texto-atenuado)', cursor: 'pointer' }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            <p style={{ fontSize: '0.80rem', color: 'var(--texto-atenuado)', margin: 0, lineHeight: 1.45 }}>
              Revisa los ajustes que se aplicarán a la identidad y diseño corporativo de tu óptica:
            </p>

            {/* Lista Detallada de Cambios Detectados */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                maxHeight: '260px',
                overflowY: 'auto',
                paddingRight: '0.25rem',
              }}
            >
              {listaCambiosPerfil.map((cambio, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--fondo-elevado)',
                    border: '1px solid var(--borde-tarjeta)',
                    borderRadius: 'var(--radio-md)',
                    padding: '0.75rem 0.95rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                  }}
                >
                  <span style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--color-primario)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    {cambio.campo}
                  </span>

                  {cambio.tipo === 'texto' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--texto-atenuado)', textDecoration: 'line-through' }}>
                        {cambio.anterior}
                      </span>
                      <span style={{ color: 'var(--texto-atenuado)' }}>→</span>
                      <span style={{ fontWeight: 700, color: 'var(--texto-principal)' }}>
                        {cambio.nuevo}
                      </span>
                    </div>
                  )}

                  {cambio.tipo === 'color' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: cambio.anterior,
                            border: '1px solid rgba(0,0,0,0.1)',
                          }}
                        />
                        <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--texto-atenuado)' }}>
                          {cambio.anterior}
                        </span>
                      </div>
                      <span style={{ color: 'var(--texto-atenuado)' }}>→</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: cambio.nuevo,
                            border: '1px solid rgba(0,0,0,0.1)',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                          }}
                        />
                        <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700, color: 'var(--texto-principal)' }}>
                          {cambio.nuevo}
                        </span>
                      </div>
                    </div>
                  )}

                  {cambio.tipo === 'logo' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.80rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--texto-atenuado)' }}>{cambio.anterior}</span>
                        <span style={{ color: 'var(--texto-atenuado)' }}>→</span>
                        <span style={{ fontWeight: 700, color: 'var(--color-primario)' }}>
                          {cambio.nuevo}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.71rem', color: 'var(--texto-atenuado)', fontStyle: 'italic' }}>
                        La imagen previa será reemplazada en el almacenamiento seguro institucional.
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Botones de Acción */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.35rem' }}>
              <button
                type="button"
                onClick={() => setModalConfirmarPerfilAbierto(false)}
                disabled={guardandoPerfil}
                className="btn-pildora-secundario"
                style={{ padding: '0.45rem 1.1rem', fontSize: '0.82rem' }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={manejarConfirmarGuardarPerfil}
                disabled={guardandoPerfil}
                className="btn-pildora-primario"
                style={{ padding: '0.45rem 1.25rem', fontSize: '0.82rem' }}
              >
                <Check style={{ width: '14px', height: '14px' }} />
                <span>{guardandoPerfil ? 'Guardando Cambios...' : 'Confirmar y Guardar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN: CAMBIOS EN REGLAS CLÍNICAS */}
      {modalConfirmarClinicaAbierto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--fondo-tarjeta)',
              border: '1px solid var(--borde-tarjeta)',
              borderRadius: 'var(--radio-lg)',
              maxWidth: '520px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: 'var(--sombra-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Cabecera del Modal */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'var(--fondo-elevado)',
                    border: '1px solid var(--borde-tarjeta)',
                    color: 'var(--color-primario)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Calendar style={{ width: '18px', height: '18px' }} />
                </div>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: 'var(--texto-principal)' }}>
                  Confirmar Cambios en Reglas Clínicas
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalConfirmarClinicaAbierto(false)}
                disabled={guardandoClinica}
                style={{ background: 'none', border: 'none', color: 'var(--texto-atenuado)', cursor: 'pointer' }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            <p style={{ fontSize: '0.80rem', color: 'var(--texto-atenuado)', margin: 0, lineHeight: 1.45 }}>
              Revisa los ajustes que se aplicarán a la agenda y atención clínica de tu óptica:
            </p>

            {/* Lista Detallada de Cambios Detectados */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                maxHeight: '260px',
                overflowY: 'auto',
                paddingRight: '0.25rem',
              }}
            >
              {listaCambiosClinicos.map((cambio, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--fondo-elevado)',
                    border: '1px solid var(--borde-tarjeta)',
                    borderRadius: 'var(--radio-md)',
                    padding: '0.75rem 0.95rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                  }}
                >
                  <span style={{ fontSize: '0.73rem', fontWeight: 700, color: 'var(--color-primario)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    {cambio.campo}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--texto-atenuado)', textDecoration: 'line-through' }}>
                      {cambio.anterior}
                    </span>
                    <span style={{ color: 'var(--texto-atenuado)' }}>→</span>
                    <span style={{ fontWeight: 700, color: 'var(--texto-principal)' }}>
                      {cambio.nuevo}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Botones de Acción */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.35rem' }}>
              <button
                type="button"
                onClick={() => setModalConfirmarClinicaAbierto(false)}
                disabled={guardandoClinica}
                className="btn-pildora-secundario"
                style={{ padding: '0.45rem 1.1rem', fontSize: '0.82rem' }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={manejarConfirmarGuardarClinica}
                disabled={guardandoClinica}
                className="btn-pildora-primario"
                style={{ padding: '0.45rem 1.25rem', fontSize: '0.82rem' }}
              >
                <Check style={{ width: '14px', height: '14px' }} />
                <span>{guardandoClinica ? 'Guardando...' : 'Confirmar y Guardar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Crear Nueva Tipología de Paciente */}
      {modalNuevaTipologiaAbierto && (
        <div
          className="modal-cierre-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !guardandoTipologia) {
              setModalNuevaTipologiaAbierto(false);
            }
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-cierre-tarjeta"
            style={{ maxWidth: '420px', textAlign: 'left', padding: '1.75rem 1.75rem 1.5rem 1.75rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(2, 132, 199, 0.12)',
                    color: 'var(--color-primario, #0284c7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Tag size={16} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--texto-principal)' }}>
                  Nueva Tipología de Paciente
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalNuevaTipologiaAbierto(false)}
                disabled={guardandoTipologia}
                className="modal-cierre-btn-cerrar"
                style={{ position: 'static' }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={manejarCrearTipologia} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {errorTipologia && (
                <div className="login-alerta-error" role="alert" style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem' }}>
                  <span>⚠️</span>
                  <span>{errorTipologia}</span>
                </div>
              )}

              <div className="modal-campo-grupo">
                <label className="modal-label" style={{ fontSize: '0.78rem' }}>
                  Nombre de la Tipología *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ej: Profesor, Convenio Sura, Estudiante..."
                  value={nombreNuevaTipologia}
                  onChange={(e) => setNombreNuevaTipologia(e.target.value)}
                  className="modal-input"
                  style={{ fontSize: '0.84rem' }}
                />
              </div>

              <div className="modal-campo-grupo">
                <label className="modal-label" style={{ fontSize: '0.78rem' }}>
                  Color del Distintivo
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                  {[
                    '#2563eb', // Azul
                    '#0284c7', // Celeste
                    '#059669', // Esmeralda
                    '#10b981', // Verde
                    '#8b5cf6', // Violeta
                    '#d946ef', // Fucsia
                    '#f59e0b', // Ámbar
                    '#ef4444', // Rojo
                    '#64748b', // Pizarra
                  ].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColorNuevaTipologia(c)}
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: c,
                        border: colorNuevaTipologia === c ? '2.5px solid var(--texto-principal)' : '2px solid transparent',
                        boxShadow: colorNuevaTipologia === c ? '0 0 0 2px rgba(255, 255, 255, 0.8)' : 'none',
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'transform 0.12s ease',
                        transform: colorNuevaTipologia === c ? 'scale(1.15)' : 'scale(1)',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Vista previa miniatura */}
              <div
                style={{
                  background: 'var(--fondo-elevado)',
                  border: '1px solid var(--borde-tarjeta)',
                  borderRadius: '10px',
                  padding: '0.6rem 0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: '0.75rem', color: 'var(--texto-secundario)' }}>Vista previa:</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '9999px',
                    background: 'var(--fondo-tarjeta)',
                    border: '1px solid var(--borde-tarjeta)',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    color: 'var(--texto-principal)',
                  }}
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: colorNuevaTipologia,
                    }}
                  />
                  <span>{nombreNuevaTipologia.trim() || 'Ejemplo'}</span>
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setModalNuevaTipologiaAbierto(false)}
                  disabled={guardandoTipologia}
                  className="btn-pildora-secundario"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoTipologia || !nombreNuevaTipologia.trim()}
                  className="btn-pildora-primario"
                  style={{ padding: '0.45rem 1.25rem', fontSize: '0.82rem' }}
                >
                  {guardandoTipologia ? 'Guardando...' : 'Crear Tipología'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmación Premium para Eliminar Tipología */}
      {tipologiaParaEliminar && (
        <div
          className="modal-cierre-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !eliminandoTipologia) {
              setTipologiaParaEliminar(null);
            }
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-cierre-tarjeta"
            style={{
              maxWidth: '410px',
              textAlign: 'center',
              padding: '1.75rem 1.75rem 1.5rem 1.75rem',
              position: 'relative',
            }}
          >
            {/* Botón Cerrar en Esquina */}
            <button
              type="button"
              onClick={() => setTipologiaParaEliminar(null)}
              disabled={eliminandoTipologia}
              className="modal-cierre-btn-cerrar"
              style={{ position: 'absolute', top: '1rem', right: '1rem' }}
              title="Cerrar ventana"
            >
              <X size={16} />
            </button>

            {/* Icono de Alerta / Papelera */}
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto',
              }}
            >
              <Trash2 size={22} />
            </div>

            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--texto-principal)' }}>
              ¿Eliminar tipología?
            </h3>

            {/* Micro-indicador de Pacientes Asociados */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '0.65rem 0 0.85rem 0' }}>
              {(tipologiaParaEliminar.total_pacientes || 0) > 0 ? (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.35rem 0.8rem',
                    borderRadius: '9999px',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.28)',
                    color: '#b45309',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                  }}
                >
                  <Users size={13} />
                  <span>
                    Asociada a {tipologiaParaEliminar.total_pacientes}{' '}
                    {tipologiaParaEliminar.total_pacientes === 1 ? 'paciente' : 'pacientes'}
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.35rem 0.8rem',
                    borderRadius: '9999px',
                    background: 'var(--fondo-elevado)',
                    border: '1px solid var(--borde-tarjeta)',
                    color: 'var(--texto-atenuado)',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                  }}
                >
                  <Users size={13} />
                  <span>Sin pacientes asociados actualmente</span>
                </div>
              )}
            </div>

            <p
              style={{
                fontSize: '0.82rem',
                color: 'var(--texto-atenuado)',
                margin: '0 0 1.35rem 0',
                lineHeight: '1.45',
              }}
            >
              {(tipologiaParaEliminar.total_pacientes || 0) > 0 ? (
                <>
                  ¿Seguro que deseas eliminar la tipología{' '}
                  <strong style={{ color: 'var(--texto-principal)' }}>
                    "{tipologiaParaEliminar.nombre}"
                  </strong>
                  ? Los{' '}
                  <strong style={{ color: 'var(--texto-principal)' }}>
                    {tipologiaParaEliminar.total_pacientes}{' '}
                    {tipologiaParaEliminar.total_pacientes === 1 ? 'paciente asociado' : 'pacientes asociados'}
                  </strong>{' '}
                  no se borrarán ni perderán sus datos clínicos, pero quedarán sin tipología asignada.
                </>
              ) : (
                <>
                  ¿Seguro que deseas eliminar la tipología{' '}
                  <strong style={{ color: 'var(--texto-principal)' }}>
                    "{tipologiaParaEliminar.nombre}"
                  </strong>
                  ? Esta acción removerá el distintivo permanentemente de la óptica.
                </>
              )}
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setTipologiaParaEliminar(null)}
                disabled={eliminandoTipologia}
                className="btn-pildora-secundario"
                style={{ padding: '0.45rem 1.15rem', fontSize: '0.82rem' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarEliminarTipologia}
                disabled={eliminandoTipologia}
                className="btn-pildora-peligro"
                style={{ padding: '0.45rem 1.25rem', fontSize: '0.82rem' }}
              >
                <Trash2 style={{ width: '13px', height: '13px' }} />
                <span>{eliminandoTipologia ? 'Eliminando...' : 'Eliminar Tipología'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
