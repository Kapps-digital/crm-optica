'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Key,
  Eye,
  EyeOff,
  Send,
  HelpCircle,
  ShieldAlert,
  Wand2,
} from 'lucide-react';
import { SelectorDesplegable } from '../comunes/SelectorDesplegable';
import { SelectorColorPopover } from '../comunes/SelectorColorPopover';
import { SelectorHoraPopover } from '../comunes/SelectorHoraPopover';
import {
  obtenerEstadoCanalesApi,
  obtenerUrlConexionWhatsAppApi,
  vincularCanalWhatsAppApi,
  desconectarCanalWhatsAppApi,
  reconectarCanalWhatsAppApi,
  actualizarDatosOpticaApi,
  subirLogoOpticaApi,
  obtenerConfiguracionIAApi,
  guardarConfiguracionIAApi,
  probarAgenteIAApi,
} from '@/servicios/api_crm';
import type { Optica, CuentaCanalWhatsApp, ConfiguracionIA } from '@/tipos/crm';
import { formatearTelefono } from '@/utilidades/formato';

interface PropiedadesModuloConfiguracion {
  opticaActual?: Optica | null;
  alActualizarOptica?: (optica: Optica) => void;
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

export const ModuloConfiguracion: React.FC<PropiedadesModuloConfiguracion> = ({
  opticaActual,
  alActualizarOptica,
}) => {
  // Pestañas del módulo: 'canales' | 'perfil' | 'citas' | 'ia'
  const [pestanaActiva, setPestanaActiva] = useState<'canales' | 'perfil' | 'citas' | 'ia'>('canales');

  // Estados de Agente IA
  const [cargandoIA, setCargandoIA] = useState(false);
  const [guardandoIA, setGuardandoIA] = useState(false);
  const [iaActiva, setIaActiva] = useState(false);
  const [iaNombre, setIaNombre] = useState('Sofía - Asistente Óptico');
  const [iaTono, setIaTono] = useState('cercano');
  const [iaApiKey, setIaApiKey] = useState('');
  const [iaModelo, setIaModelo] = useState('openrouter/free');
  const [iaInstrucciones, setIaInstrucciones] = useState('');
  const [iaPreguntasFrecuentes, setIaPreguntasFrecuentes] = useState('');
  const [mostrarApiKey, setMostrarApiKey] = useState(false);

  // Probador de IA en vivo
  const [mensajePrueba, setMensajePrueba] = useState('Hola, ¿qué horario de atención tienen y cómo puedo agendar una cita?');
  const [respuestaPrueba, setRespuestaPrueba] = useState<string | null>(null);
  const [probandoIA, setProbandoIA] = useState(false);
  const [errorPrueba, setErrorPrueba] = useState<string | null>(null);

  // Estados de Canales
  const [cargandoCanales, setCargandoCanales] = useState(true);
  const [cuentaWhatsApp, setCuentaWhatsApp] = useState<CuentaCanalWhatsApp | null>(null);
  const [opticaData, setOpticaData] = useState<Optica | null>(opticaActual || null);
  const [desconectandoCanal, setDesconectandoCanal] = useState(false);
  const [reconectandoCanal, setReconectandoCanal] = useState(false);
  const [abriendoConexion, setAbriendoConexion] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

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
  const [horaInicioAtencion, setHoraInicioAtencion] = useState('08:00 AM');
  const [horaFinAtencion, setHoraFinAtencion] = useState('06:00 PM');
  const [guardandoClinica, setGuardandoClinica] = useState(false);

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
            ...res.optica,
            id: Number(res.optica.id),
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

  // Cargar configuración de IA
  const cargarConfiguracionIA = useCallback(async () => {
    setCargandoIA(true);
    try {
      const res = await obtenerConfiguracionIAApi();
      if (res.exito && res.configuracion) {
        setIaActiva(Boolean(res.configuracion.ia_activa));
        setIaNombre(res.configuracion.ia_nombre || 'Sofía - Asistente Óptico');
        setIaTono(res.configuracion.ia_tono || 'cercano');
        setIaApiKey(res.configuracion.ia_api_key || '');
        setIaModelo(res.configuracion.ia_modelo || 'openrouter/free');
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
  }, [cargarConfiguracionIA]);

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
    const espActual = especialistaDefecto.trim();
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

    // 6. Horario Hábil de Atención
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
        especialista_defecto: especialistaDefecto.trim(),
        registro_profesional_defecto: registroProfesionalDefecto.trim(),
        motivo_cita_defecto: motivoCitaDefecto.trim(),
        notificacion_auto_citas_whatsapp: notificacionAutoCitas,
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
      };

      setOpticaData(opticaActualizada);
      setDuracionConsulta(String(opticaActualizada.duracion_cita_minutos || 30));
      setControlDefectoMeses(String(opticaActualizada.control_meses_defecto || 12));
      setEspecialistaDefecto(opticaActualizada.especialista_defecto || '');
      setRegistroProfesionalDefecto(opticaActualizada.registro_profesional_defecto || '');
      setMotivoCitaDefecto(opticaActualizada.motivo_cita_defecto || '');
      setNotificacionAutoCitas(opticaActualizada.notificacion_auto_citas_whatsapp !== false);
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
        ia_api_key: iaApiKey,
        ia_modelo: iaModelo,
        ia_instrucciones: iaInstrucciones,
        ia_preguntas_frecuentes: iaPreguntasFrecuentes,
      });

      if (res.exito) {
        if (typeof window !== 'undefined') {
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
        ia_api_key: iaApiKey,
        ia_modelo: iaModelo,
        ia_instrucciones: iaInstrucciones,
        ia_preguntas_frecuentes: iaPreguntasFrecuentes,
      });

      if (res.exito) {
        if (typeof window !== 'undefined') {
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
    setErrorPrueba(null);

    try {
      const res = await probarAgenteIAApi({
        mensaje_prueba: mensajePrueba,
        prompt_personalizado: iaInstrucciones,
        faq_personalizado: iaPreguntasFrecuentes,
        tono: iaTono,
        api_key_prueba: iaApiKey,
        modelo: iaModelo,
      });

      if (res.exito && res.respuesta) {
        setRespuestaPrueba(res.respuesta);
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
      {/* Pestañas de Navegación */}
      <div
        style={{
          padding: '0.75rem 2rem 0',
          borderBottom: '1px solid var(--borde-tarjeta)',
          background: 'var(--fondo-tarjeta)',
          display: 'flex',
          gap: '1.5rem',
        }}
      >
          <button
            type="button"
            onClick={() => setPestanaActiva('canales')}
            style={{
              padding: '0.45rem 0.25rem 0.7rem',
              border: 'none',
              background: 'transparent',
              fontSize: '0.85rem',
              fontWeight: pestanaActiva === 'canales' ? 700 : 500,
              color: pestanaActiva === 'canales' ? 'var(--color-primario)' : 'var(--texto-atenuado)',
              borderBottom: pestanaActiva === 'canales' ? '2.5px solid var(--color-primario)' : '2.5px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.15s ease',
            }}
          >
            <MessageSquare style={{ width: '16px', height: '16px' }} />
            <span>Canales de Atención</span>
            {cuentaWhatsApp?.conectado && (
              <span
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '0.1rem 0.4rem',
                  borderRadius: '10px',
                }}
              >
                1 Activo
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setPestanaActiva('perfil')}
            style={{
              padding: '0.45rem 0.25rem 0.7rem',
              border: 'none',
              background: 'transparent',
              fontSize: '0.85rem',
              fontWeight: pestanaActiva === 'perfil' ? 700 : 500,
              color: pestanaActiva === 'perfil' ? 'var(--color-primario)' : 'var(--texto-atenuado)',
              borderBottom: pestanaActiva === 'perfil' ? '2.5px solid var(--color-primario)' : '2.5px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.15s ease',
            }}
          >
            <Building2 style={{ width: '16px', height: '16px' }} />
            <span>Perfil de la Óptica</span>
          </button>

          <button
            type="button"
            onClick={() => setPestanaActiva('citas')}
            style={{
              padding: '0.45rem 0.25rem 0.7rem',
              border: 'none',
              background: 'transparent',
              fontSize: '0.85rem',
              fontWeight: pestanaActiva === 'citas' ? 700 : 500,
              color: pestanaActiva === 'citas' ? 'var(--color-primario)' : 'var(--texto-atenuado)',
              borderBottom: pestanaActiva === 'citas' ? '2.5px solid var(--color-primario)' : '2.5px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.15s ease',
            }}
          >
            <Calendar style={{ width: '16px', height: '16px' }} />
            <span>Parámetros Clínicos & Citas</span>
          </button>

          <button
            type="button"
            onClick={() => setPestanaActiva('ia')}
            style={{
              padding: '0.45rem 0.25rem 0.7rem',
              border: 'none',
              background: 'transparent',
              fontSize: '0.85rem',
              fontWeight: pestanaActiva === 'ia' ? 700 : 500,
              color: pestanaActiva === 'ia' ? 'var(--color-primario)' : 'var(--texto-atenuado)',
              borderBottom: pestanaActiva === 'ia' ? '2.5px solid var(--color-primario)' : '2.5px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.15s ease',
            }}
          >
            <Bot style={{ width: '16px', height: '16px' }} />
            <span>Agente de IA</span>
            {iaActiva && (
              <span
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '0.1rem 0.4rem',
                  borderRadius: '10px',
                }}
              >
                Activo
              </span>
            )}
          </button>
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
              padding: '1.5rem 1.75rem',
              boxShadow: 'var(--sombra-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <MessageSquare style={{ width: '18px', height: '18px', color: 'var(--color-primario)' }} />
              <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--texto-principal)', margin: 0 }}>
                Canales de Atención
              </h3>
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
                    background: 'rgba(2, 132, 199, 0.05)',
                    border: '1px solid rgba(2, 132, 199, 0.2)',
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
                      background: 'rgba(2, 132, 199, 0.1)',
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
                {/* Columna Izquierda: Nombre Comercial */}
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
                      width: '28px',
                      height: '28px',
                      borderRadius: '6px',
                      background: 'rgba(2, 132, 199, 0.1)',
                      color: 'var(--color-primario)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Calendar style={{ width: '15px', height: '15px' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--texto-principal)', margin: 0 }}>
                      Reglas de Agenda & Atención Clínica
                    </h3>
                    <p style={{ fontSize: '0.72rem', color: 'var(--texto-atenuado)', margin: 0 }}>
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

                {/* 3. Horario Hábil de Atención */}
                <div className="modal-campo-grupo">
                  <label className="modal-label" style={{ fontSize: '0.73rem', fontWeight: 600 }}>
                    Horario Hábil de Atención
                  </label>
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
                    Rango horario operativo visible en el selector de citas.
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

        {/* PESTAÑA 4: AGENTE DE INTELIGENCIA ARTIFICIAL */}
        {pestanaActiva === 'ia' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* 1. Tarjeta Cabecera con Interruptor Maestro */}
            <div
              style={{
                background: 'var(--fondo-tarjeta)',
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: 'var(--radio-lg)',
                padding: '1.1rem 1.4rem',
                boxShadow: 'var(--sombra-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: iaActiva ? 'rgba(16, 185, 129, 0.15)' : 'rgba(2, 132, 199, 0.1)',
                    color: iaActiva ? '#10b981' : 'var(--color-primario)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Bot style={{ width: '22px', height: '22px' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--texto-principal)', margin: 0 }}>
                      Agente de Inteligencia Artificial (WhatsApp)
                    </h3>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.55rem',
                        borderRadius: '12px',
                        background: iaActiva ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                        color: iaActiva ? '#10b981' : 'var(--texto-atenuado)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {iaActiva ? 'En línea y respondiendo' : 'Pausado globalmente'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.74rem', color: 'var(--texto-atenuado)', margin: '0.15rem 0 0 0' }}>
                    Atiende automáticamente a tus clientes en WhatsApp, resuelve preguntas frecuentes y agenda citas en el CRM.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                {/* Switch de Activación */}
                <button
                  type="button"
                  onClick={manejarToggleIAGlobal}
                  disabled={guardandoIA}
                  title={iaActiva ? 'Desactivar Agente de IA en todos los chats' : 'Activar Agente de IA en todos los chats'}
                  style={{
                    padding: '0.45rem 0.95rem',
                    borderRadius: '20px',
                    border: iaActiva ? '1px solid #10b981' : '1px solid var(--borde-tarjeta)',
                    background: iaActiva ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 0, 0, 0.05)',
                    color: iaActiva ? '#10b981' : 'var(--texto-atenuado)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Power style={{ width: '14px', height: '14px' }} />
                  <span>{iaActiva ? 'Agente Activo' : 'Agente Inactivo'}</span>
                </button>

                <button
                  type="button"
                  onClick={manejarGuardarIA}
                  disabled={guardandoIA}
                  className="btn-pildora-primario"
                  style={{
                    padding: '0.45rem 1.15rem',
                    fontSize: '0.8rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Save style={{ width: '14px', height: '14px' }} />
                  <span>{guardandoIA ? 'Guardando...' : 'Guardar Ajustes'}</span>
                </button>
              </div>
            </div>

            {/* 2. Rejilla de Parámetros y Personalidad */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {/* Bloque Izquierdo: Identidad, Tono y Credenciales */}
              <div
                style={{
                  background: 'var(--fondo-tarjeta)',
                  border: '1px solid var(--borde-tarjeta)',
                  borderRadius: 'var(--radio-lg)',
                  padding: '1.25rem 1.5rem',
                  boxShadow: 'var(--sombra-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--borde-tarjeta)', paddingBottom: '0.65rem' }}>
                  <Wand2 style={{ width: '16px', height: '16px', color: 'var(--color-primario)' }} />
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--texto-principal)', margin: 0 }}>
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
                      { valor: 'formal', etiqueta: 'Formal, clínico y profesional' },
                      { valor: 'comercial', etiqueta: 'Comercial, persuasivo y dinámico' },
                    ]}
                    tamano="compacto"
                    anchoMinimo="100%"
                  />
                  <span style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)', marginTop: '0.2rem' }}>
                    Define la manera en que el modelo redacta sus oraciones y trata al paciente.
                  </span>
                </div>

                {/* Modelo de IA */}
                <div className="modal-campo-grupo">
                  <label className="modal-label" style={{ fontSize: '0.74rem', fontWeight: 600 }}>
                    Motor de Inteligencia Artificial (OpenRouter)
                  </label>
                  <SelectorDesplegable
                    valor={[
                      'openrouter/free',
                      'deepseek/deepseek-chat',
                      'deepseek/deepseek-r1',
                      'meta-llama/llama-3.3-70b-instruct',
                      'google/gemini-2.5-flash',
                      'openai/gpt-4o-mini',
                    ].includes(iaModelo) ? iaModelo : 'personalizado'}
                    alCambiar={(val) => {
                      if (val === 'personalizado') {
                        if ([
                          'openrouter/free',
                          'deepseek/deepseek-chat',
                          'deepseek/deepseek-r1',
                          'meta-llama/llama-3.3-70b-instruct',
                          'google/gemini-2.5-flash',
                          'openai/gpt-4o-mini',
                        ].includes(iaModelo)) {
                          setIaModelo('mistralai/mistral-large-2411');
                        }
                      } else {
                        setIaModelo(val);
                      }
                    }}
                    opciones={[
                      { valor: 'openrouter/free', etiqueta: 'OpenRouter Free (100% Gratuito - Sin recargar créditos)' },
                      { valor: 'deepseek/deepseek-chat', etiqueta: 'DeepSeek V3 (Recomendado, ultra económico e inteligente)' },
                      { valor: 'deepseek/deepseek-r1', etiqueta: 'DeepSeek R1 (Razonamiento profundo)' },
                      { valor: 'meta-llama/llama-3.3-70b-instruct', etiqueta: 'Meta Llama 3.3 70B (Potente y equilibrado)' },
                      { valor: 'google/gemini-2.5-flash', etiqueta: 'Gemini 2.5 Flash (Google vía OpenRouter)' },
                      { valor: 'openai/gpt-4o-mini', etiqueta: 'OpenAI GPT-4o Mini (Rápido y económico)' },
                      { valor: 'personalizado', etiqueta: '✏️ Especificar otro modelo manualmente...' },
                    ]}
                    tamano="compacto"
                    anchoMinimo="100%"
                  />
                  {![
                    'openrouter/free',
                    'deepseek/deepseek-chat',
                    'deepseek/deepseek-r1',
                    'meta-llama/llama-3.3-70b-instruct',
                    'google/gemini-2.5-flash',
                    'openai/gpt-4o-mini',
                  ].includes(iaModelo) && (
                    <input
                      type="text"
                      value={iaModelo}
                      onChange={(e) => setIaModelo(e.target.value)}
                      placeholder="Identificador en OpenRouter (ejemplo: anthropic/claude-3.5-haiku)"
                      className="modal-input"
                      style={{ fontSize: '0.74rem', marginTop: '0.35rem' }}
                    />
                  )}
                  <span style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)', marginTop: '0.2rem' }}>
                    Pasarela OpenRouter multi-modelo con temperatura 0.0 determinista.
                  </span>
                </div>

                {/* Clave de API OpenRouter */}
                <div className="modal-campo-grupo">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label className="modal-label" style={{ fontSize: '0.74rem', fontWeight: 600 }}>
                      Clave de API OpenRouter (Requerida)
                    </label>
                    <a
                      href="https://openrouter.ai/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '0.68rem', color: 'var(--color-primario)', textDecoration: 'none', fontWeight: 600 }}
                    >
                      Obtener clave en OpenRouter ↗
                    </a>
                  </div>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Key
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
                      type={mostrarApiKey ? 'text' : 'password'}
                      value={iaApiKey}
                      onChange={(e) => setIaApiKey(e.target.value)}
                      placeholder="sk-or-v1-..."
                      className="modal-input"
                      style={{ paddingLeft: '2.1rem', paddingRight: '2.2rem', fontSize: '0.78rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarApiKey(!mostrarApiKey)}
                      style={{
                        position: 'absolute',
                        right: '0.6rem',
                        background: 'none',
                        border: 'none',
                        color: 'var(--texto-atenuado)',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                      }}
                      title={mostrarApiKey ? 'Ocultar clave' : 'Mostrar clave'}
                    >
                      {mostrarApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)', marginTop: '0.2rem' }}>
                    Introduce tu clave de OpenRouter (formato sk-or-v1-...).
                  </span>
                </div>
              </div>

              {/* Bloque Derecho: Instrucciones y Preguntas Frecuentes (FAQ) */}
              <div
                style={{
                  background: 'var(--fondo-tarjeta)',
                  border: '1px solid var(--borde-tarjeta)',
                  borderRadius: 'var(--radio-lg)',
                  padding: '1.25rem 1.5rem',
                  boxShadow: 'var(--sombra-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--borde-tarjeta)', paddingBottom: '0.65rem' }}>
                  <HelpCircle style={{ width: '16px', height: '16px', color: 'var(--color-primario)' }} />
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--texto-principal)', margin: 0 }}>
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

            {/* 3. Tarjeta de Blindaje de Seguridad Infranqueable */}
            <div
              style={{
                background: 'rgba(2, 132, 199, 0.04)',
                border: '1px solid rgba(2, 132, 199, 0.25)',
                borderRadius: 'var(--radio-lg)',
                padding: '1.1rem 1.4rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.65rem' }}>
                <ShieldAlert style={{ width: '18px', height: '18px', color: 'var(--color-primario)' }} />
                <h4 style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--texto-principal)', margin: 0 }}>
                  Reglas de Seguridad y Blindaje Infranqueables (Activas por defecto)
                </h4>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                  gap: '0.85rem',
                  fontSize: '0.73rem',
                  color: 'var(--texto-atenuado)',
                  lineHeight: '1.35',
                }}
              >
                <div>
                  <strong style={{ color: 'var(--texto-principal)', display: 'block', marginBottom: '0.15rem' }}>
                    🔒 Temperatura 0.0 Determinista
                  </strong>
                  Cero creatividad o alucinación. El agente se limita estrictamente a los hechos registrados en la ficha y en las preguntas frecuentes.
                </div>
                <div>
                  <strong style={{ color: 'var(--texto-principal)', display: 'block', marginBottom: '0.15rem' }}>
                    🔒 Aislamiento de Base de Datos
                  </strong>
                  El agente no tiene acceso SQL ni ve credenciales. El backend sanitiza e inyecta únicamente el texto necesario para responder.
                </div>
                <div>
                  <strong style={{ color: 'var(--texto-principal)', display: 'block', marginBottom: '0.15rem' }}>
                    🔒 Agendamiento con Validación
                  </strong>
                  Solo reserva cupos reales libres dentro del horario laboral ({horaInicioAtencion} a {horaFinAtencion}) evitando duplicados.
                </div>
                <div>
                  <strong style={{ color: 'var(--texto-principal)', display: 'block', marginBottom: '0.15rem' }}>
                    🔒 Transferencia Humana Inmediata
                  </strong>
                  Si el paciente pide un humano o pregunta algo fuera de su conocimiento, pausa la IA en ese chat y transfiere al equipo asesor.
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
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      borderRadius: 'var(--radio-md)',
                      padding: '0.85rem 1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10b981', fontSize: '0.72rem', fontWeight: 700 }}>
                      <Bot size={14} />
                      <span>Respuesta generada por {iaNombre}:</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--texto-principal)', lineHeight: '1.45', whiteSpace: 'pre-wrap' }}>
                      {respuestaPrueba}
                    </p>
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
                    background: 'rgba(2, 132, 199, 0.12)',
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
                    background: 'rgba(2, 132, 199, 0.12)',
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

    </div>
  );
};
