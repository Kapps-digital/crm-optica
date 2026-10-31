'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Moon, Sun, Building2, MessageSquare, Menu } from 'lucide-react';
import { PanelLateral } from '@/componentes/navegacion/PanelLateral';
import { CentroNotificaciones } from '@/componentes/navegacion/CentroNotificaciones';
import { BarraNavegacionInferiorMovil } from '@/componentes/navegacion/BarraNavegacionInferiorMovil';
import { PerfilUsuarioCabecera } from '@/componentes/navegacion/PerfilUsuarioCabecera';
import { ModalBloqueoSuscripcion } from '@/componentes/navegacion/ModalBloqueoSuscripcion';
import { IndicadorCanalWhatsApp } from '@/componentes/navegacion/IndicadorCanalWhatsApp';
import { ListaConversaciones } from '@/componentes/chat/ListaConversaciones';
import { VentanaChat } from '@/componentes/chat/VentanaChat';
import { FichaOptometrica } from '@/componentes/chat/FichaOptometrica';
import { DirectorioPacientes } from '@/componentes/pacientes/DirectorioPacientes';
import { ModalRegistrarPaciente } from '@/componentes/pacientes/ModalRegistrarPaciente';
import { ModalNuevaFormula } from '@/componentes/pacientes/ModalNuevaFormula';
import { ModalAgendarCita, type DatosNuevaCita } from '@/componentes/citas/ModalAgendarCita';
import { CalendarioCitas } from '@/componentes/citas/CalendarioCitas';
import { ModuloAutoSegmentacion } from '@/componentes/campanas/ModuloAutoSegmentacion';
import { ModuloPlantillas } from '@/componentes/plantillas/ModuloPlantillas';
import { ModuloConfiguracion } from '@/componentes/configuracion/ModuloConfiguracion';
import { ModuloConsumo } from '@/componentes/consumo/ModuloConsumo';
import { ModuloUsuarios } from '@/componentes/usuarios/ModuloUsuarios';
import { EtiquetaTooltip } from '@/componentes/comunes/EtiquetaTooltip';
import { SelectorDesplegable } from '@/componentes/comunes/SelectorDesplegable';
import { clienteSupabase } from '@/servicios/supabase_realtime';
import {
  obtenerTokenAutenticacion,
  obtenerUsuarioSesion,
  obtenerOpticaSesion,
  guardarOpticaSesion,
  obtenerPerfilUsuario,
  obtenerOpticas,
  obtenerIdOpticaActiva,
  establecerIdOpticaActiva,
  aplicarTemaOptica,
  obtenerConversaciones,
  sincronizarConversaciones,
  obtenerMensajes,
  obtenerDetalleContacto,
  obtenerPacientes,
  enviarMensajeChat,
  marcarConversacionLeida,
  registrarFormulaOptica,
  registrarCita,
  obtenerEstadoCanalesApi,
  obtenerConfiguracionIAApi,
  verificarSesionExpirada,
} from '@/servicios/api_crm';
import type { Contacto, Conversacion, Mensaje, FormulaOptica, Usuario, Optica, Segmento } from '@/tipos/crm';
import { formatearTelefono, formatearTelefonoSinPrefijo, estaEnVentana24Horas } from '@/utilidades/formato';
import { useInactividadSesion } from '@/utilidades/usoInactividadSesion';
import {
  reproducirSonidoMensajeEntrante,
  reproducirSonidoAlertaAsesor,
} from '@/utilidades/audioNotificacion';

const CATALOGO_OPTICAS_BASE: Optica[] = [
  {
    id: 1,
    nombre: 'Tu Visión Óptica',
    slug: 'tu-vision',
    logo_url: null,
    color_primario: '#0284c7',
    color_secundario: '#0369a1',
    telefono: '+57 313 2531694',
    activo: true,
    ia_activa: true,
    ia_habilitada: true,
  },
  {
    id: 2,
    nombre: 'Óptica Lumina',
    slug: 'optica-lumina',
    logo_url: null,
    color_primario: '#059669',
    color_secundario: '#047857',
    telefono: '+57 300 9876543',
    activo: true,
    ia_activa: true,
    ia_habilitada: false,
  },
];

export default function PaginaPrincipal() {
  const router = useRouter();
  const [autenticado, setAutenticado] = useState<boolean | null>(null);
  const [usuarioActual, setUsuarioActual] = useState<Usuario | null>(null);
  const [opticaActual, setOpticaActual] = useState<Optica | null>(CATALOGO_OPTICAS_BASE[0]);
  const [listaOpticas, setListaOpticas] = useState<Optica[]>(CATALOGO_OPTICAS_BASE);
  const [idOpticaActiva, setIdOpticaActiva] = useState<number>(1);

  const [panelColapsado, setPanelColapsado] = useState(false);
  const [vistaActiva, setVistaActiva] = useState('mensajeria');
  const [temaOscuro, setTemaOscuro] = useState(false);

  // Estados para adaptación responsive en móvil
  const [vistaMovilChat, setVistaMovilChat] = useState<'lista' | 'chat' | 'ficha'>('lista');
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  // Foco de fecha y modo para navegación directa a turnos desde notificaciones
  const [citasFoco, setCitasFoco] = useState<{ fecha: string | null; modo: 'mes' | 'dia' | 'agenda' | null }>({
    fecha: null,
    modo: null,
  });

  const limpiarCitasFoco = useCallback(() => {
    setCitasFoco((prev) => (prev.fecha !== null || prev.modo !== null ? { fecha: null, modo: null } : prev));
  }, []);

  // Ficha colapsada por defecto para máxima ganancia de espacio
  const [fichaAbierta, setFichaAbierta] = useState(false);
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [conversacionActiva, setConversacionActiva] = useState<Conversacion | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [pacienteActivo, setPacienteActivo] = useState<Contacto | null>(null);
  const [formulaVigente, setFormulaVigente] = useState<FormulaOptica | null>(null);
  const [formulasPaciente, setFormulasPaciente] = useState<FormulaOptica[]>([]);

  const [pacientes, setPacientes] = useState<Contacto[]>([]);
  const [cargandoChats, setCargandoChats] = useState(true);
  const [cargandoPacientes, setCargandoPacientes] = useState(false);
  const [modalFormulaAbierto, setModalFormulaAbierto] = useState(false);
  const [contactoParaFormula, setContactoParaFormula] = useState<Contacto | null>(null);

  const [modalCitaAbierto, setModalCitaAbierto] = useState(false);
  const [contactoParaCita, setContactoParaCita] = useState<Contacto | null>(null);
  const [modalRegistrarPacienteChatAbierto, setModalRegistrarPacienteChatAbierto] = useState(false);

  // Caché de mensajes en memoria para cambio de chat instantáneo (0ms)
  const cacheMensajes = useRef<Record<number, Mensaje[]>>({});
  const idsUrgentesPreviosRef = useRef<string | null>(null);
  const idChatEnCarga = useRef<number | null>(null);
  const conversacionActivaRef = useRef<number | null>(null);
  const conversacionesRef = useRef<Conversacion[]>([]);
  const opticaActualRef = useRef<Optica | null>(null);
  const chatUrlProcesadoRef = useRef<string | null>(null);
  const [cargandoMensajesChat, setCargandoMensajesChat] = useState(false);

  useEffect(() => {
    conversacionActivaRef.current = conversacionActiva?.id || null;
  }, [conversacionActiva]);

  useEffect(() => {
    conversacionesRef.current = conversaciones;
  }, [conversaciones]);

  useEffect(() => {
    opticaActualRef.current = opticaActual;
  }, [opticaActual]);

  // Exponer método de prueba en consola del navegador para validación inmediata
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as unknown as {
        crmProbarSonido?: {
          mensaje: () => void;
          alerta: () => void;
        };
      }).crmProbarSonido = {
        mensaje: reproducirSonidoMensajeEntrante,
        alerta: reproducirSonidoAlertaAsesor,
      };
    }
  }, []);

  const [sincronizandoChats, setSincronizandoChats] = useState(false);

  // Estado del canal de atención para la barra superior
  const [estadoCanalWhatsApp, setEstadoCanalWhatsApp] = useState<{
    conectado: boolean;
    numero: string | null;
  }>({ conectado: false, numero: null });

  const sincronizarCanalCabecera = useCallback(async () => {
    try {
      const res = await obtenerEstadoCanalesApi();
      if (res.exito && res.cuenta_whatsapp) {
        setEstadoCanalWhatsApp({
          conectado: Boolean(res.cuenta_whatsapp.conectado),
          numero: res.cuenta_whatsapp.numero || null,
        });
      } else {
        setEstadoCanalWhatsApp({
          conectado: false,
          numero: null,
        });
      }
    } catch {
      setEstadoCanalWhatsApp({ conectado: false, numero: null });
    }
  }, []);

  useEffect(() => {
    sincronizarCanalCabecera();
    const alActualizarCanal = () => sincronizarCanalCabecera();
    window.addEventListener('crm_canal_whatsapp_actualizado', alActualizarCanal);
    window.addEventListener('crm_cambio_optica', alActualizarCanal);
    return () => {
      window.removeEventListener('crm_canal_whatsapp_actualizado', alActualizarCanal);
      window.removeEventListener('crm_cambio_optica', alActualizarCanal);
    };
  }, [sincronizarCanalCabecera]);

  // Conteo total de conversaciones con mensajes no leídos recibidos (chats pendientes)
  const totalConversacionesNoLeidas = useMemo(() => {
    return conversaciones.filter(
      (c) => Boolean(c.no_leido) || Number(c.mensajes_no_leidos || 0) > 0
    ).length;
  }, [conversaciones]);

  // Total de conversaciones que requieren asesor humano urgente
  const totalRequiereAsesor = useMemo(() => {
    return conversaciones.filter((c) => Boolean(c.requiere_asesor_humano)).length;
  }, [conversaciones]);

  // Conteo para el badge y título: muestra total de conversaciones no leídas; si no hay pero sí hay asesor, muestra asesor
  const conteoBadgeConversaciones = useMemo(() => {
    if (totalConversacionesNoLeidas > 0) return totalConversacionesNoLeidas;
    if (totalRequiereAsesor > 0) return totalRequiereAsesor;
    return 0;
  }, [totalConversacionesNoLeidas, totalRequiereAsesor]);

  // Actualización dinámica del título de la pestaña estilo WhatsApp Web: (N) CRM Óptica
  useEffect(() => {
    document.title = conteoBadgeConversaciones > 0 ? `(${conteoBadgeConversaciones}) CRM Óptica` : 'CRM Óptica';
  }, [conteoBadgeConversaciones]);

  // Monitoreo automático de inactividad de sesión (cierre tras tiempo configurado sin uso)
  useInactividadSesion(Boolean(autenticado));

  // Verificación de autenticación y carga de datos de la óptica
  useEffect(() => {
    const token = obtenerTokenAutenticacion();
    if (!token) {
      if (typeof window !== 'undefined') {
        window.location.replace('/login');
      }
      return;
    }

    // Comprobación de seguridad: verificar si la sesión expiró por inactividad (> 3 horas)
    if (verificarSesionExpirada()) {
      return;
    }

    const usr = obtenerUsuarioSesion();
    const optSesion = obtenerOpticaSesion();
    const idGuardado = obtenerIdOpticaActiva();
    const idInicial = idGuardado ? Number(idGuardado) : (optSesion ? Number(optSesion.id) : 1);

    setIdOpticaActiva(idInicial);

    if (usr) setUsuarioActual(usr);
    const opticaInicial =
      (optSesion && Number(optSesion.id) === idInicial ? optSesion : null) ||
      CATALOGO_OPTICAS_BASE.find((o) => Number(o.id) === idInicial) ||
      optSesion ||
      CATALOGO_OPTICAS_BASE[0];
    const opticaNormalizada: Optica = {
      ...opticaInicial,
      ia_activa: opticaInicial.ia_activa !== false,
      ia_habilitada: opticaInicial.ia_habilitada !== undefined ? Boolean(opticaInicial.ia_habilitada) : (Number(opticaInicial.id) === 2 ? false : true),
    };
    setOpticaActual(opticaNormalizada);
    aplicarTemaOptica(opticaNormalizada);
    setAutenticado(true);

    // Consulta de respaldo de configuración de IA directa para sincronización perfecta
    obtenerConfiguracionIAApi().then((resIA) => {
      if (resIA.exito && resIA.configuracion) {
        const activa = Boolean(resIA.configuracion.ia_activa);
        setOpticaActual((prev) => (prev ? { ...prev, ia_activa: activa } : prev));
      }
    }).catch(() => {});

    obtenerPerfilUsuario().then(async (res) => {
      if (res.exito) {
        if (res.usuario) {
          setUsuarioActual(res.usuario);
        }
        // Aplicar la óptica fresca asociada al usuario retornada por la API
        if (res.optica) {
          const opticaBd: Optica = {
            ...res.optica,
            id: Number(res.optica.id),
            ia_activa: res.optica.ia_activa !== false,
            ia_habilitada: res.optica.ia_habilitada !== undefined ? Boolean(res.optica.ia_habilitada) : true,
          };
          setOpticaActual(opticaBd);
          aplicarTemaOptica(opticaBd);
          guardarOpticaSesion(opticaBd);
        }

        // Cargar catálogo completo de ópticas desde el backend
        const opts = await obtenerOpticas();
        if (opts.length > 0) {
          setListaOpticas(opts);
          const idActiva = obtenerIdOpticaActiva() || idInicial;
          const encontrada = opts.find((o) => Number(o.id) === Number(idActiva));
          if (encontrada) {
            const optEncontradaNorm: Optica = {
              ...encontrada,
              ia_activa: encontrada.ia_activa !== false,
              ia_habilitada: encontrada.ia_habilitada !== undefined ? Boolean(encontrada.ia_habilitada) : true,
            };
            setOpticaActual(optEncontradaNorm);
            aplicarTemaOptica(optEncontradaNorm);
            guardarOpticaSesion(optEncontradaNorm);
          }
        }
      }
    });
  }, [router]);

  // Listener para sincronización instantánea de cambios de óptica o logotipo entre módulos
  useEffect(() => {
    const alActualizarOpticaGlobal = () => {
      const optGuardada = obtenerOpticaSesion();
      if (optGuardada) {
        setOpticaActual((prev) => ({
          ...prev,
          ...optGuardada,
          fecha_vencimiento: optGuardada.fecha_vencimiento || prev?.fecha_vencimiento,
          dias_restantes: optGuardada.dias_restantes ?? prev?.dias_restantes,
          plan_vencido: optGuardada.plan_vencido ?? prev?.plan_vencido,
          estado_plan: optGuardada.estado_plan || prev?.estado_plan,
          ia_activa: optGuardada.ia_activa !== undefined ? Boolean(optGuardada.ia_activa) : (prev?.ia_activa !== false),
          ia_habilitada: optGuardada.ia_habilitada !== undefined ? Boolean(optGuardada.ia_habilitada) : (prev?.ia_habilitada !== false),
        }));
        aplicarTemaOptica(optGuardada);
      }
    };

    const alRecargarCatalogoOpticas = async () => {
      try {
        const opts = await obtenerOpticas();
        if (opts.length > 0) {
          setListaOpticas(opts);
          const idGuardado = obtenerIdOpticaActiva();
          const actual = opts.find((o) => Number(o.id) === Number(idGuardado));
          if (actual) {
            setOpticaActual((prev) => {
              const optNorm: Optica = {
                ...prev,
                ...actual,
                fecha_vencimiento: actual.fecha_vencimiento || prev?.fecha_vencimiento,
                dias_restantes: actual.dias_restantes ?? prev?.dias_restantes,
                plan_vencido: actual.plan_vencido ?? prev?.plan_vencido,
                estado_plan: actual.estado_plan || prev?.estado_plan,
                ia_activa: actual.ia_activa !== false,
                ia_habilitada: actual.ia_habilitada !== false,
              };
              guardarOpticaSesion(optNorm);
              return optNorm;
            });
          }
        }
      } catch (err) {
        console.error('Error al recargar catálogo de ópticas:', err);
      }
    };

    const alCambiarIAGlobal = async () => {
      try {
        const res = await obtenerConfiguracionIAApi();
        if (res.exito && res.configuracion) {
          const nuevaActiva = Boolean(res.configuracion.ia_activa);
          setOpticaActual((prev) => {
            if (!prev) return prev;
            const act = { ...prev, ia_activa: nuevaActiva };
            guardarOpticaSesion(act);
            return act;
          });
        }
      } catch (e) {
        console.error('Error al sincronizar IA global:', e);
      }
    };

    window.addEventListener('crm_cambio_optica', alActualizarOpticaGlobal);
    window.addEventListener('crm_recargar_opticas', alRecargarCatalogoOpticas);
    window.addEventListener('crm_cambio_ia_global', alCambiarIAGlobal);
    return () => {
      window.removeEventListener('crm_cambio_optica', alActualizarOpticaGlobal);
      window.removeEventListener('crm_recargar_opticas', alRecargarCatalogoOpticas);
      window.removeEventListener('crm_cambio_ia_global', alCambiarIAGlobal);
    };
  }, []);

  const manejarCambioOptica = async (id: number | string) => {
    const idNumerico = Number(id);
    setIdOpticaActiva(idNumerico);
    establecerIdOpticaActiva(idNumerico);

    let catalogo = listaOpticas && listaOpticas.length > 0 ? listaOpticas : CATALOGO_OPTICAS_BASE;
    let seleccionada = catalogo.find((o) => Number(o.id) === idNumerico);
    if (!seleccionada) {
      const opts = await obtenerOpticas();
      if (opts.length > 0) {
        setListaOpticas(opts);
        seleccionada = opts.find((o) => Number(o.id) === idNumerico);
      }
    }
    if (!seleccionada) {
      seleccionada = CATALOGO_OPTICAS_BASE.find((o) => Number(o.id) === idNumerico);
    }

    if (seleccionada) {
      const opticaNorm: Optica = {
        ...seleccionada,
        id: Number(seleccionada.id),
        ia_activa: seleccionada.ia_activa !== false,
        ia_habilitada: seleccionada.ia_habilitada !== undefined ? Boolean(seleccionada.ia_habilitada) : (Number(seleccionada.id) === 2 ? false : true),
      };
      setOpticaActual(opticaNorm);
      aplicarTemaOptica(opticaNorm);
      if (typeof window !== 'undefined') {
        localStorage.setItem('crm_optica', JSON.stringify(opticaNorm));
        window.dispatchEvent(new Event('crm_cambio_optica'));
      }
    }

    // Limpieza profunda e instantánea de estados para no mezclar datos entre ópticas
    cacheMensajes.current = {};
    setConversacionActiva(null);
    setMensajes([]);
    setPacienteActivo(null);
    setFormulaVigente(null);
    setFormulasPaciente([]);
    setConversaciones([]);
    setCargandoChats(true);

    const [nuevasConversaciones] = await Promise.all([
      obtenerConversaciones(),
      recargarPacientes(),
    ]);
    setConversaciones(nuevasConversaciones);
    setCargandoChats(false);
  };

  const alternarTema = () => {
    const nuevoTema = !temaOscuro;
    setTemaOscuro(nuevoTema);
    document.documentElement.setAttribute('data-tema', nuevoTema ? 'oscuro' : 'claro');
  };

  // Redirigir a mensajería si un usuario sin rol admin intenta ver consumo o usuarios
  useEffect(() => {
    if (usuarioActual && usuarioActual.rol !== 'admin') {
      if (vistaActiva === 'consumo' || vistaActiva === 'usuarios') {
        setVistaActiva('mensajeria');
      }
    }
  }, [usuarioActual, vistaActiva]);

  // Detección de chat desde URL (ej. proveniente de una notificación push en el celular)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const chatParam = params.get('chat');

    // Procesar únicamente una sola vez por cada ID recibido en URL y si la lista de chats ya cargó
    if (chatParam && chatUrlProcesadoRef.current !== chatParam && conversaciones.length > 0) {
      const convEncontrada = conversaciones.find((c) => Number(c.id) === Number(chatParam));
      if (convEncontrada) {
        chatUrlProcesadoRef.current = chatParam;

        // Limpiar inmediatamente el parámetro 'chat' de la URL para no ciclar ni atrapar el botón volver
        try {
          const urlLimpia = new URL(window.location.href);
          urlLimpia.searchParams.delete('chat');
          window.history.replaceState({}, '', urlLimpia.pathname + (urlLimpia.search ? urlLimpia.search : ''));
        } catch {
          // Silencioso si history no está disponible
        }

        setVistaActiva('mensajeria');
        setVistaMovilChat('chat');
        manejarSeleccionarConversacion(convEncontrada);
      }
    }
  }, [conversaciones]);

  const manejarCambioVista = (v: string) => {
    if ((v === 'consumo' || v === 'usuarios') && usuarioActual?.rol !== 'admin') {
      return;
    }
    limpiarCitasFoco();
    setVistaActiva(v);
  };

  const recargarConversaciones = useCallback(async () => {
    const lista = await obtenerConversaciones();
    const idActiva = vistaActiva === 'mensajeria' ? conversacionActivaRef.current : null;
    const listaNormalizada = Array.isArray(lista)
      ? lista.map((c) =>
          c.id === idActiva
            ? { ...c, no_leido: false, mensajes_no_leidos: 0 }
            : c
        )
      : [];

    setConversaciones(listaNormalizada);
    setCargandoChats(false);

    // Detección en tiempo real de cambios en chats que requieren asesor humano para sincronizar campana y emitir alerta sonora
    const idsUrgentesActuales = listaNormalizada
      .filter((c) => Boolean(c.requiere_asesor_humano))
      .map((c) => c.id)
      .sort()
      .join(',');

    if (idsUrgentesPreviosRef.current !== null) {
      if (idsUrgentesActuales !== idsUrgentesPreviosRef.current) {
        const idsPrevios = new Set((idsUrgentesPreviosRef.current || '').split(',').filter(Boolean));
        const tieneNuevoUrgente = idsUrgentesActuales.split(',').filter(Boolean).some((id) => !idsPrevios.has(id));
        if (tieneNuevoUrgente) {
          reproducirSonidoAlertaAsesor();
        }
        idsUrgentesPreviosRef.current = idsUrgentesActuales;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('crm_recargar_notificaciones'));
        }
      }
    } else {
      // Registro inicial silencioso (no suena al recargar la página con alertas preexistentes)
      idsUrgentesPreviosRef.current = idsUrgentesActuales;
    }

    // Si hay conversación activa, sincronizarla con la versión fresca de la BD (resolución de alerta humana, IA pausada, etc.)
    if (idActiva && listaNormalizada.length > 0) {
      const convFresca = listaNormalizada.find((c) => Number(c.id) === Number(idActiva));
      if (convFresca) {
        setConversacionActiva((prev) => {
          if (!prev || Number(prev.id) !== Number(idActiva)) return prev;
          if (
            prev.requiere_asesor_humano !== convFresca.requiere_asesor_humano ||
            prev.ia_pausada_por_humano !== convFresca.ia_pausada_por_humano ||
            prev.ia_activa !== convFresca.ia_activa ||
            prev.sin_contestar !== convFresca.sin_contestar ||
            prev.estado !== convFresca.estado
          ) {
            return { ...prev, ...convFresca, no_leido: false, mensajes_no_leidos: 0 };
          }
          return prev;
        });
      }
    }

    // Precargar en segundo plano los mensajes de las conversaciones recientes para que el cambio de chat sea instantáneo (0ms)
    if (listaNormalizada && Array.isArray(listaNormalizada)) {
      listaNormalizada.slice(0, 8).forEach((c) => {
        if (!cacheMensajes.current[c.id]) {
          obtenerMensajes(c.id).then((msgs) => {
            if (msgs && Array.isArray(msgs)) {
              cacheMensajes.current[c.id] = msgs;
            }
          }).catch(() => {});
        }
      });
    }
  }, [vistaActiva]);

  // Sincronización instantánea de activación/desactivación masiva de IA en todos los chats
  useEffect(() => {
    const alCambiarIAGlobal = async () => {
      await recargarConversaciones();
      if (conversacionActivaRef.current) {
        const lista = await obtenerConversaciones();
        if (Array.isArray(lista)) {
          const act = lista.find((c) => c.id === conversacionActivaRef.current);
          if (act) {
            setConversacionActiva(act);
          }
        }
      }
    };
    window.addEventListener('crm_cambio_ia_global', alCambiarIAGlobal);
    return () => window.removeEventListener('crm_cambio_ia_global', alCambiarIAGlobal);
  }, [recargarConversaciones]);

  const manejarSincronizarChats = useCallback(async () => {
    setSincronizandoChats(true);
    try {
      await sincronizarConversaciones();
      await recargarConversaciones();
      if (conversacionActiva) {
        const nuevosMensajes = await obtenerMensajes(conversacionActiva.id);
        cacheMensajes.current[conversacionActiva.id] = nuevosMensajes;
        setMensajes(nuevosMensajes);
      }
    } catch (error) {
      console.error('Error en sincronización manual:', error);
    } finally {
      setSincronizandoChats(false);
    }
  }, [recargarConversaciones, conversacionActiva]);

  const recargarPacientes = useCallback(async () => {
    setCargandoPacientes(true);
    const lista = await obtenerPacientes();
    setPacientes(lista);
    setCargandoPacientes(false);
  }, []);

  useEffect(() => {
    recargarConversaciones();
    recargarPacientes();

    // 1. Suscripción en Tiempo Real con Supabase (WebSockets)
    const canalConversaciones = clienteSupabase
      .channel('realtime_conversaciones_crm')
      .on(
        'postgres_changes',
        { event: '*', schema: 'CRM_Opticas', table: 'conversaciones' },
        () => {
          recargarConversaciones();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'CRM_Opticas', table: 'mensajes' },
        (payload) => {
          const nuevoMensaje = payload.new as Partial<Mensaje>;
          if (nuevoMensaje && nuevoMensaje.direccion === 'entrante') {
            const idConv = nuevoMensaje.conversacion_id;
            const conv = conversacionesRef.current.find((c) => Number(c.id) === Number(idConv));
            const iaActivaGlobal = opticaActualRef.current?.ia_activa !== false;
            const iaActivaEnChat = conv ? (conv.ia_activa !== false && !conv.ia_pausada_por_humano) : iaActivaGlobal;
            const requiereHumano = Boolean(conv?.requiere_asesor_humano);

            // Regla 1: Si IA no está activa -> sonar para notificar al humano que llegó mensaje (tipo WhatsApp Web)
            if (!iaActivaGlobal || !iaActivaEnChat) {
              if (requiereHumano) {
                reproducirSonidoAlertaAsesor();
              } else {
                reproducirSonidoMensajeEntrante();
              }
            } else if (requiereHumano) {
              // Regla 2: Si IA está activa -> SOLO sonar si se necesita atención humana
              reproducirSonidoAlertaAsesor();
            }
          }
          recargarConversaciones();
        }
      )
      .subscribe();

    // 2. Respaldo pasivo ultra-lento (cada 25s) SOLO si la pestaña está visible
    const intervaloRespaldo = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        recargarConversaciones();
      }
    }, 25000);

    // 3. Reactivar al regresar a la pestaña y limpiar badge del icono de la app
    const alCambiarVisibilidad = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        recargarConversaciones();
        if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator) {
          (navigator as any).clearAppBadge().catch(() => {});
        }
      }
    };
    if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator) {
      (navigator as any).clearAppBadge().catch(() => {});
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', alCambiarVisibilidad);
    }

    return () => {
      clienteSupabase.removeChannel(canalConversaciones);
      clearInterval(intervaloRespaldo);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      }
    };
  }, [recargarConversaciones, recargarPacientes]);

  useEffect(() => {
    if (vistaActiva === 'pacientes') {
      recargarPacientes();
    }
  }, [vistaActiva, recargarPacientes]);

  const manejarSeleccionarConversacion = async (conv: Conversacion) => {
    if (!conv) return;
    const idNuevo = Number(conv.id);
    conversacionActivaRef.current = idNuevo;
    idChatEnCarga.current = idNuevo;

    // Limpiar siempre no leídos en estado local y notificar al backend
    setConversaciones((prev) =>
      prev.map((c) =>
        c.id === conv.id ? { ...c, no_leido: false, mensajes_no_leidos: 0 } : c
      )
    );
    if (conv.id) {
      marcarConversacionLeida(conv.id);
    }

    const convLimpia = { ...conv, no_leido: false, mensajes_no_leidos: 0 };
    setConversacionActiva(convLimpia);
    setVistaMovilChat('chat');

    // Si ya están en caché verificada para este chat específico, renderizarlos de inmediato
    const cachePrevia = idNuevo && cacheMensajes.current[idNuevo] ? cacheMensajes.current[idNuevo] : null;
    if (cachePrevia && Array.isArray(cachePrevia) && cachePrevia.length > 0) {
      const perteneceAChat = cachePrevia.every((m) => !m.conversacion_id || Number(m.conversacion_id) === idNuevo);
      if (perteneceAChat) {
        setMensajes(cachePrevia);
        setCargandoMensajesChat(false);
      } else {
        delete cacheMensajes.current[idNuevo];
        setMensajes([]);
        setCargandoMensajesChat(true);
      }
    } else {
      // Limpiar de inmediato los mensajes del chat anterior para que NUNCA se vean mientras carga el nuevo
      setMensajes([]);
      setCargandoMensajesChat(Boolean(conv.id));
    }

    if (!conv.id) {
      // Conversación nueva/temporal sin historial remoto
      setCargandoMensajesChat(false);
      return;
    }

    try {
      // Cargar en paralelo mensajes y detalle de paciente
      const [listaMensajes, detalle] = await Promise.all([
        obtenerMensajes(conv.id),
        conv.contacto_id ? obtenerDetalleContacto(conv.contacto_id) : Promise.resolve(null),
      ]);

      // Evitar condición de carrera: confirmar que el usuario sigue en este mismo chat
      if (Number(conversacionActivaRef.current) === idNuevo && Number(idChatEnCarga.current) === idNuevo) {
        const listaFiltrada = Array.isArray(listaMensajes)
          ? listaMensajes.filter((m) => !m.conversacion_id || Number(m.conversacion_id) === idNuevo)
          : [];

        cacheMensajes.current[idNuevo] = listaFiltrada;
        setMensajes(listaFiltrada);

        if (detalle) {
          setPacienteActivo(detalle.contacto);
          setFormulasPaciente(detalle.formulas || []);
          setFormulaVigente(detalle.formulas.length > 0 ? detalle.formulas[0] : null);
        } else {
          setPacienteActivo({
            id: conv.contacto_id || 0,
            nombre_completo: conv.contacto_nombre || null,
            nombre: conv.contacto_nombre || null,
            telefono: conv.contacto_telefono || null,
            correo: null,
            business_scoped_user_id: conv.contacto_bsuid || null,
            creado_en: conv.creado_en,
            actualizado_en: conv.actualizado_en,
          });
          setFormulasPaciente([]);
          setFormulaVigente(null);
        }
      }
    } catch (error) {
      console.error('Error al cargar mensajes del chat:', error);
    } finally {
      if (Number(idChatEnCarga.current) === idNuevo) {
        setCargandoMensajesChat(false);
      }
    }
  };

  // Navegación universal e instantánea (0ms) hacia un chat desde cualquier vista del CRM
  const navegarAlChatContacto = useCallback(
    (contactoId: number) => {
      // 1. Cambiar inmediatamente de vista (0ms de latencia percibida)
      setVistaActiva('mensajeria');

      // 2. Buscar en memoria por contacto_id
      let conv = conversaciones.find((c) => Number(c.contacto_id) === Number(contactoId));

      // 3. Si no coincide, buscar por número de teléfono
      const paciente = pacientes.find((p) => Number(p.id) === Number(contactoId));
      if (!conv && paciente?.telefono) {
        const telDigitos = String(paciente.telefono).replace(/\D/g, '');
        if (telDigitos) {
          conv = conversaciones.find(
            (c) => String(c.contacto_telefono || '').replace(/\D/g, '') === telDigitos
          );
        }
      }

      if (conv) {
        // Cargar conversación encontrada sin congelar la interfaz
        manejarSeleccionarConversacion(conv);
      } else if (paciente) {
        // Inicializar contexto visual para contacto sin conversación histórica aún
        const convTemporal: Conversacion = {
          id: 0,
          contacto_id: paciente.id,
          canal: 'whatsapp',
          id_cuenta_zernio: null,
          id_conversacion_zernio: '',
          ultimo_mensaje_entrante_en: null,
          estado: 'activa',
          creado_en: new Date().toISOString(),
          actualizado_en: new Date().toISOString(),
          contacto_nombre: paciente.nombre_completo || paciente.nombre || 'Paciente',
          contacto_telefono: paciente.telefono || '',
        };
        conversacionActivaRef.current = 0;
        setConversacionActiva(convTemporal);
        setPacienteActivo(paciente);
        setMensajes([]);
        setCargandoMensajesChat(false);

        // En segundo plano consultar si el servidor tiene una conversación recién creada
        obtenerConversaciones().then((listaFresca) => {
          if (Array.isArray(listaFresca) && listaFresca.length > 0) {
            setConversaciones(listaFresca);
            const coincidencia =
              listaFresca.find((c) => Number(c.contacto_id) === Number(contactoId)) ||
              (paciente.telefono
                ? listaFresca.find(
                    (c) =>
                      String(c.contacto_telefono || '').replace(/\D/g, '') ===
                      String(paciente.telefono).replace(/\D/g, '')
                  )
                : null);
            if (coincidencia) {
              manejarSeleccionarConversacion(coincidencia);
            }
          }
        }).catch(() => {});
      }
    },
    [conversaciones, pacientes]
  );

  // Navegación universal y precisa hacia un chat desde notificaciones de atención urgente o enlaces
  const navegarAConversacionDesdeNotificacion = useCallback(
    async (datos: any) => {
      // 1. Cambiar a la vista de mensajería
      setVistaActiva('mensajeria');

      if (!datos) return;

      const idConv = datos.conversacion_id ? Number(datos.conversacion_id) : null;
      const idContacto = datos.contacto_id ? Number(datos.contacto_id) : null;
      const telLimpio = (datos.telefono || datos.contacto_telefono)
        ? String(datos.telefono || datos.contacto_telefono).replace(/\D/g, '')
        : null;

      const coincide = (c: Conversacion) => {
        if (idConv && Number(c.id) === idConv) return true;
        if (idContacto && Number(c.contacto_id) === idContacto) return true;
        if (telLimpio && c.contacto_telefono) {
          const t = String(c.contacto_telefono).replace(/\D/g, '');
          if (t && (t === telLimpio || t.endsWith(telLimpio) || telLimpio.endsWith(t))) return true;
        }
        return false;
      };

      // 2. Buscar primero en la memoria local de conversaciones
      let encontrada = conversaciones.find(coincide);
      if (encontrada) {
        await manejarSeleccionarConversacion(encontrada);
        return;
      }

      // 3. Si no está en memoria local inmediata, consultar al servidor
      try {
        const listaFresca = await obtenerConversaciones();
        if (Array.isArray(listaFresca) && listaFresca.length > 0) {
          setConversaciones(listaFresca);
          encontrada = listaFresca.find(coincide);
          if (encontrada) {
            await manejarSeleccionarConversacion(encontrada);
            return;
          }
        }
      } catch (err) {
        console.error('Error al actualizar conversaciones desde notificación:', err);
      }

      // 4. Si aún no está en la lista estándar pero tenemos id de conversación o contacto,
      // inicializar el contexto de conversación directa y cargar sus mensajes
      if (idConv) {
        const convDirecta: Conversacion = {
          id: idConv,
          contacto_id: idContacto || 0,
          canal: 'whatsapp',
          id_cuenta_zernio: null,
          id_conversacion_zernio: '',
          ultimo_mensaje_entrante_en: new Date().toISOString(),
          estado: 'activa',
          creado_en: new Date().toISOString(),
          actualizado_en: new Date().toISOString(),
          contacto_nombre: datos.nombre || datos.contacto_nombre || 'Paciente por WhatsApp',
          contacto_telefono: datos.telefono || datos.contacto_telefono || '',
          requiere_asesor_humano: true,
          atendido_por_ia: false,
        };
        await manejarSeleccionarConversacion(convDirecta);
      } else if (idContacto) {
        navegarAlChatContacto(idContacto);
      }
    },
    [conversaciones, manejarSeleccionarConversacion, navegarAlChatContacto]
  );

  // Sondeo en tiempo real de mensajes del chat abierto cada 1.5 segundos con preservación de mensajes en vuelo
  useEffect(() => {
    if (!conversacionActiva?.id) return;
    const idConvActual = Number(conversacionActiva.id);
    let activo = true;

    const refrescarMensajesActivos = async () => {
      try {
        const lista = await obtenerMensajes(idConvActual);
        // Descartar si el componente cambió de conversación mientras la red respondía
        if (!activo || Number(conversacionActivaRef.current) !== idConvActual) {
          return;
        }

        setMensajes((prev) => {
          if (Number(conversacionActivaRef.current) !== idConvActual) {
            return prev;
          }

          // Filtrar estrictamente solo mensajes de esta conversación
          const listaFiltrada = Array.isArray(lista)
            ? lista.filter((m) => !m.conversacion_id || Number(m.conversacion_id) === idConvActual)
            : [];

          // Preservar mensajes temporales/optimistas que todavía estén en vuelo hacia Zernio
          const temporalesEnVuelo = prev.filter(
            (m) =>
              Number(m.conversacion_id) === idConvActual &&
              m.id_mensaje_plataforma?.startsWith('temp_') &&
              !listaFiltrada.some(
                (real) =>
                  real.direccion === 'saliente' &&
                  real.texto === m.texto &&
                  Math.abs(new Date(real.creado_en).getTime() - new Date(m.creado_en).getTime()) < 30000
              )
          );

          const listaCombinada = [...listaFiltrada, ...temporalesEnVuelo];
          cacheMensajes.current[idConvActual] = listaCombinada;

          if (
            listaCombinada.length === prev.length &&
            listaCombinada.every((m, idx) => m.id === prev[idx]?.id && m.estado_entrega === prev[idx]?.estado_entrega)
          ) {
            return prev;
          }

          return listaCombinada;
        });
      } catch {
        // Silencioso ante errores intermitentes de red en sondeo
      }
    };

    // 1. Carga inicial
    refrescarMensajesActivos();

    // 2. Suscripción en Tiempo Real con Supabase para los mensajes de esta conversación
    const canalChat = clienteSupabase
      .channel(`chat_realtime_${idConvActual}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'CRM_Opticas',
          table: 'mensajes',
          filter: `conversacion_id=eq.${idConvActual}`,
        },
        () => {
          if (activo) {
            refrescarMensajesActivos();
          }
        }
      )
      .subscribe();

    // 3. Respaldo pasivo ultra-lento (cada 30s) SOLO si la pestaña está activa
    const intervaloChat = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden && activo) {
        refrescarMensajesActivos();
      }
    }, 30000);

    // 4. Refrescar de inmediato al regresar a la pestaña
    const alCambiarVisibilidadChat = () => {
      if (typeof document !== 'undefined' && !document.hidden && activo) {
        refrescarMensajesActivos();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', alCambiarVisibilidadChat);
    }

    return () => {
      activo = false;
      clienteSupabase.removeChannel(canalChat);
      clearInterval(intervaloChat);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', alCambiarVisibilidadChat);
      }
    };
  }, [conversacionActiva?.id]);

  const manejarEnviarMensaje = async (texto: string, convExplicita?: Conversacion) => {
    const conv = convExplicita || conversacionActiva;
    if (!conv || !conv.id) {
      alert('Por favor selecciona una conversación para enviar el mensaje.');
      return;
    }

    const idConv = Number(conv.id);
    const idTemp = Date.now();
    const mensajeOptimista: Mensaje = {
      id: idTemp,
      conversacion_id: idConv,
      id_mensaje_plataforma: `temp_${idTemp}`,
      id_mensaje_zernio: null,
      direccion: 'saliente',
      tipo_mensaje: 'texto',
      texto,
      payload_json: null,
      estado_entrega: 'enviado',
      creado_en: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    // 1. Respuesta visual instantánea sin parpadeo (0ms de retraso percibido)
    setMensajes((prev) => [...prev, mensajeOptimista]);

    // Retirar de inmediato la alerta de atención humana y pausar IA al contestar el asesor humano
    setConversacionActiva((prev) =>
      prev && Number(prev.id) === idConv
        ? {
            ...prev,
            requiere_asesor_humano: false,
            ia_pausada_por_humano: true,
            sin_contestar: false,
            ultimo_mensaje_direccion: 'saliente',
            ultimo_mensaje_texto: texto,
            ultimo_mensaje_fecha: new Date().toISOString(),
          }
        : prev
    );

    setConversaciones((prev) =>
      prev.map((c) =>
        Number(c.id) === idConv
          ? {
              ...c,
              requiere_asesor_humano: false,
              ia_pausada_por_humano: true,
              sin_contestar: false,
              ultimo_mensaje_direccion: 'saliente',
              ultimo_mensaje_texto: texto,
              ultimo_mensaje_fecha: new Date().toISOString(),
            }
          : c
      )
    );

    // Disparar sincronización inmediata de la campana de notificaciones para retirar alerta
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crm_recargar_notificaciones'));
    }

    // 2. Envío a través de la API
    const res = await enviarMensajeChat(idConv, texto, false);
    if (res.exito) {
      // 3. Si el backend nos devolvió el registro persistido, reconciliar inmediatamente en memoria
      if (res.mensaje) {
        setMensajes((prev) =>
          prev.map((m) => (m.id === idTemp ? res.mensaje! : m))
        );
      } else {
        // Traer lista completa de la BD y reconciliar sin perder nada
        const lista = await obtenerMensajes(idConv);
        setMensajes((prev) => {
          const otrosTemporales = prev.filter(
            (m) => m.id !== idTemp && m.id_mensaje_plataforma?.startsWith('temp_')
          );
          return [...lista, ...otrosTemporales];
        });
      }
      setConversacionActiva((prev) =>
        prev && Number(prev.id) === idConv
          ? {
              ...prev,
              requiere_asesor_humano: false,
              ia_pausada_por_humano: true,
              sin_contestar: false,
              ultimo_mensaje_direccion: 'saliente',
              ultimo_mensaje_texto: texto,
              ultimo_mensaje_fecha: new Date().toISOString(),
            }
          : prev
      );
      setConversaciones((prev) =>
        prev.map((c) =>
          Number(c.id) === idConv
            ? {
                ...c,
                requiere_asesor_humano: false,
                ia_pausada_por_humano: true,
                sin_contestar: false,
                ultimo_mensaje_direccion: 'saliente',
                ultimo_mensaje_texto: texto,
                ultimo_mensaje_fecha: new Date().toISOString(),
              }
            : c
        )
      );
      recargarConversaciones();
    } else {
      // Si falló el envío, remover el temporal y alertar
      setMensajes((prev) => prev.filter((m) => m.id !== idTemp));
      alert(`No se pudo entregar el mensaje: ${res.error || 'Fallo de entrega en WhatsApp'}`);
    }
  };

  const manejarReactivarPlantilla = async (nombrePlantilla?: string, idiomaPlantilla?: string) => {
    if (!conversacionActiva) return;
    const res = await enviarMensajeChat(
      conversacionActiva.id,
      '',
      true,
      nombrePlantilla,
      idiomaPlantilla
    );
    if (res.exito) {
      if (res.mensaje) {
        setMensajes((prev) => [...prev, res.mensaje!]);
      } else {
        const lista = await obtenerMensajes(conversacionActiva.id);
        setMensajes(lista);
      }
      const nombreMostrar = nombrePlantilla || 'optica_digital';
      setConversacionActiva((prev) =>
        prev && Number(prev.id) === Number(conversacionActiva.id)
          ? {
              ...prev,
              requiere_asesor_humano: false,
              ia_pausada_por_humano: true,
              sin_contestar: false,
              ultimo_mensaje_direccion: 'saliente',
              ultimo_mensaje_texto: `[Template: ${nombreMostrar}]`,
              ultimo_mensaje_fecha: new Date().toISOString(),
            }
          : prev
      );
      setConversaciones((prev) =>
        prev.map((c) =>
          c.id === conversacionActiva.id
            ? {
                ...c,
                requiere_asesor_humano: false,
                ia_pausada_por_humano: true,
                sin_contestar: false,
                ultimo_mensaje_direccion: 'saliente',
                ultimo_mensaje_texto: `[Template: ${nombreMostrar}]`,
                ultimo_mensaje_fecha: new Date().toISOString(),
              }
            : c
        )
      );
      recargarConversaciones();
    } else {
      alert(`No se pudo enviar la plantilla: ${res.error || 'WhatsApp rechazó la plantilla o la cuenta no tiene saldo'}`);
    }
  };

  const manejarGuardarFormula = async (datos: Partial<FormulaOptica>) => {
    const res = await registrarFormulaOptica(datos);
    if (res.exito) {
      const idContacto = datos.contacto_id || pacienteActivo?.id;
      if (idContacto) {
        const detalle = await obtenerDetalleContacto(idContacto);
        if (detalle) {
          setPacienteActivo(detalle.contacto);
          setFormulasPaciente(detalle.formulas || []);
          setFormulaVigente(detalle.formulas.length > 0 ? detalle.formulas[0] : null);
        }
      }
      recargarPacientes();
      recargarConversaciones();
    } else {
      alert('Error al guardar la fórmula clínica');
    }
  };

  const manejarGuardarCita = async (datos: DatosNuevaCita): Promise<{ exito: boolean; error?: string }> => {
    const res = await registrarCita({
      contacto_id: datos.contacto_id,
      fecha_cita: datos.fecha_cita,
      hora_cita: datos.hora_cita,
      motivo: datos.motivo,
      especialista: datos.especialista,
      observaciones: datos.observaciones,
    });

    if (res.exito) {
      // Si se activó la notificación por WhatsApp y hay conversación activa en ventana
      if (datos.enviar_confirmacion_whatsapp && conversacionActiva) {
        const enVentana = estaEnVentana24Horas(conversacionActiva.ultimo_mensaje_entrante_en);
        if (enVentana) {
          let fechaFormateada = datos.fecha_cita;
          if (datos.fecha_cita && datos.fecha_cita.includes('-')) {
            const partes = datos.fecha_cita.split('-');
            if (partes.length === 3) {
              fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;
            }
          }

          const encabezadoOptica = (opticaActual?.nombre || 'Óptica').toUpperCase();
          const lineasNotificacion = [
            `🗓️ *${encabezadoOptica} - Confirmación de Cita*`,
            `Hola *${contactoParaCita?.nombre || 'Paciente'}*, tu cita de optometría ha sido programada con éxito:`,
            ``,
            `📅 *Fecha:* ${fechaFormateada}`,
            `⏰ *Hora:* ${datos.hora_cita}`,
            `🎯 *Motivo:* ${datos.motivo}`,
          ];
          if (datos.especialista?.trim()) {
            lineasNotificacion.push(`👨‍⚕️ *Especialista:* ${datos.especialista.trim()}`);
          }
          lineasNotificacion.push(``);
          lineasNotificacion.push(`📍 Te sugerimos presentarte 10 minutos antes. Si necesitas reprogramar, responde directamente a este chat.`);

          const textoNotificacion = lineasNotificacion.join('\n');

          await manejarEnviarMensaje(textoNotificacion);
        }
      }
      setModalCitaAbierto(false);
      return { exito: true };
    } else {
      return {
        exito: false,
        error: res.error || 'Este paciente para ese día a esa hora ya tiene una cita asignada.',
      };
    }
  };

  if (autenticado !== true) {
    return (
      <div className="login-pantalla-fondo">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem', color: '#94a3b8' }}>
          <div className="login-spinner" style={{ width: '28px', height: '28px', borderWidth: '3px' }} />
          <span style={{ fontSize: '0.85rem' }}>Verificando acceso al sistema...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="layout-con-panel-lateral">
      {/* 1. Panel Lateral Corporativo */}
      <PanelLateral
        colapsado={panelColapsado}
        alAlternarColapso={() => setPanelColapsado(!panelColapsado)}
        vistaActiva={vistaActiva}
        alCambiarVista={(v) => {
          manejarCambioVista(v);
          setMenuMovilAbierto(false);
        }}
        temaOscuro={temaOscuro}
        alAlternarTema={alternarTema}
        conteoChats={conteoBadgeConversaciones}
        requiereAsesorChats={totalRequiereAsesor > 0}
        conteoPacientes={null}
        optica={opticaActual}
        usuario={usuarioActual}
        abiertoMovil={menuMovilAbierto}
        alCerrarMovil={() => setMenuMovilAbierto(false)}
      />

      {/* Backdrop para cerrar menú en móvil */}
      {menuMovilAbierto && (
        <div
          className="backdrop-panel-movil"
          onClick={() => setMenuMovilAbierto(false)}
        />
      )}

      {/* 2. Contenido Principal */}
      <main className="contenido-principal">
        {/* Barra Superior Compacta */}
        <header className={`barra-superior ${vistaActiva === 'mensajeria' && vistaMovilChat !== 'lista' ? 'ocultar-en-movil-chat' : ''}`}>
          <div className="barra-titulo-grupo">
            <button
              type="button"
              className="btn-hamburguesa-movil"
              onClick={() => setMenuMovilAbierto(!menuMovilAbierto)}
              aria-label="Abrir menú"
              title="Menú"
            >
              <Menu style={{ width: '18px', height: '18px' }} />
            </button>
            <h1>
              {vistaActiva === 'mensajeria' && (
                <>
                  Bandeja<span className="texto-largo-cabecera-escritorio"> de Entrada</span>
                </>
              )}
              {vistaActiva === 'pacientes' && (
                <>
                  Pacientes <span className="ampersand-titular">&</span> Contactos
                </>
              )}
              {vistaActiva === 'citas' && 'Calendario de Citas'}
              {vistaActiva === 'campanas' && (
                <>
                  Auto-Segmentación <span className="ampersand-titular">&</span> Audiencias
                </>
              )}
              {vistaActiva === 'plantillas' && 'Plantillas'}
              {vistaActiva === 'configuracion' && 'Configuración'}
              {vistaActiva === 'consumo' && (
                <>
                  Auditoría <span className="ampersand-titular">&</span> Consumo de IA
                </>
              )}
              {vistaActiva === 'usuarios' && 'Directorio de Usuarios y Ópticas'}
            </h1>
            <p>
              {vistaActiva === 'mensajeria' && 'Gestión centralizada de mensajes y atención al cliente en tiempo real'}
              {vistaActiva === 'pacientes' && 'Directorio de pacientes con historial clínico y contactos de mensajería'}
              {vistaActiva === 'citas' && 'Agenda clínica, programación de turnos y control de consultas'}
              {vistaActiva === 'campanas' && 'Filtros automáticos por historial clínico, fecha de control y tipo de lente'}
              {vistaActiva === 'plantillas' && 'Gestión de plantillas preaprobadas para mensajería empresarial'}
              {vistaActiva === 'configuracion' && 'Canales de atención, perfil de la óptica y reglas de atención clínica'}
              {vistaActiva === 'consumo' && 'Monitoreo analítico de tokens por óptica, control de gasto y proyecciones de costos mensuales'}
              {vistaActiva === 'usuarios' && 'Gestión centralizada de cuentas de acceso, credenciales de colaboradores y administración de ópticas.'}
            </p>
          </div>

          {/* Acciones de la derecha: Selector de Óptica (Superadmin), Píldora de Conexión y Alternador de Tema */}
          <div className="barra-acciones">
            {usuarioActual?.rol === 'admin' && (
              <div style={{ minWidth: '210px' }}>
                <SelectorDesplegable
                  valor={String(idOpticaActiva)}
                  alCambiar={(nuevoId) => manejarCambioOptica(Number(nuevoId))}
                  opciones={listaOpticas.map((opt) => ({
                    valor: String(opt.id),
                    etiqueta: opt.nombre,
                    colorIndicador: opt.color_primario,
                    badge: Number(opt.id) === 1 ? 'Matriz' : 'Sede',
                    icono: Building2,
                  }))}
                  icono={Building2}
                  placeholder="Seleccionar óptica..."
                  tamano="compacto"
                  posicionAlineacion="derecha"
                  anchoMinimo="210px"
                />
              </div>
            )}

            {/* Indicador de Canal WhatsApp (Interactivo con 3 diseños) */}
            <IndicadorCanalWhatsApp
              conectado={Boolean(estadoCanalWhatsApp.conectado)}
              numero={estadoCanalWhatsApp.numero}
            />

            {/* Centro de Notificaciones Corporativo con Gestor de Alertas Push Integrado */}
            <CentroNotificaciones
              opticaId={opticaActual?.id || 1}
              usuario={usuarioActual}
              alNavegarVista={(vista, datos) => {
                manejarCambioVista(vista);
                if (vista === 'citas') {
                  const fechaDestino = datos?.fecha || datos?.fecha_cita || null;
                  if (fechaDestino) {
                    setCitasFoco({ fecha: fechaDestino, modo: 'dia' });
                  }
                }
                if (vista === 'mensajeria') {
                  navegarAConversacionDesdeNotificacion(datos);
                }
              }}
            />

            <EtiquetaTooltip
              texto={temaOscuro ? 'Modo Claro' : 'Modo Oscuro'}
              posicion="abajo"
            >
              <button
                type="button"
                onClick={alternarTema}
                className="barra-boton-tema"
                aria-label={temaOscuro ? 'Modo Claro' : 'Modo Oscuro'}
              >
                {temaOscuro ? (
                  <Sun style={{ width: '17px', height: '17px' }} />
                ) : (
                  <Moon style={{ width: '17px', height: '17px' }} />
                )}
              </button>
            </EtiquetaTooltip>

            {/* Perfil del Usuario en Cabecera */}
            <PerfilUsuarioCabecera
              usuario={usuarioActual}
              optica={opticaActual}
              vistaActiva={vistaActiva}
              alCambiarVista={manejarCambioVista}
            />
          </div>
        </header>

        {/* Secciones del CRM */}
        {vistaActiva === 'mensajeria' && (
          <section id="vista-mensajeria" className={`vista-mensajeria-tripartita ${!fichaAbierta ? 'ficha-colapsada' : ''} movil-vista-${vistaMovilChat}`}>
            {/* 1. Lista de Conversaciones */}
            <ListaConversaciones
              conversaciones={conversaciones}
              conversacionActivaId={conversacionActiva?.id || null}
              alSeleccionarConversacion={manejarSeleccionarConversacion}
              cargando={cargandoChats}
              alSincronizar={manejarSincronizarChats}
              sincronizando={sincronizandoChats}
            />

            {/* 2. Chat Principal */}
            <VentanaChat
              conversacion={conversacionActiva}
              mensajes={mensajes}
              cargandoMensajes={cargandoMensajesChat}
              alEnviarMensaje={manejarEnviarMensaje}
              alReactivarConPlantilla={manejarReactivarPlantilla}
              fichaAbierta={fichaAbierta}
              alAbrirFicha={() => {
                setFichaAbierta(true);
                setVistaMovilChat('ficha');
              }}
              paciente={pacienteActivo}
              alRegistrarPaciente={() => setModalRegistrarPacienteChatAbierto(true)}
              iaGlobalActiva={opticaActual?.ia_activa !== false}
              alResolverUrgencia={async (id) => {
                await recargarConversaciones();
                if (conversacionActiva && Number(conversacionActiva.id) === Number(id)) {
                  setConversacionActiva((prev) => (prev ? { ...prev, requiere_asesor_humano: false } : null));
                }
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('crm_recargar_notificaciones'));
                }
              }}
              alCambiarEstadoIA={(id, activo) => {
                setConversaciones((prev) =>
                  prev.map((c) =>
                    c.id === id ? { ...c, ia_activa: activo, ia_pausada_por_humano: !activo } : c
                  )
                );
                setConversacionActiva((prev) =>
                  prev && Number(prev.id) === Number(id)
                    ? { ...prev, ia_activa: activo, ia_pausada_por_humano: !activo }
                    : prev
                );
              }}
              alVolver={() => {
                chatUrlProcesadoRef.current = null;
                setVistaMovilChat('lista');
                setConversacionActiva(null);
                conversacionActivaRef.current = null;
                if (typeof window !== 'undefined') {
                  try {
                    const urlLimpia = new URL(window.location.href);
                    if (urlLimpia.searchParams.has('chat')) {
                      urlLimpia.searchParams.delete('chat');
                      window.history.replaceState({}, '', urlLimpia.pathname + (urlLimpia.search ? urlLimpia.search : ''));
                    }
                  } catch {
                    // Silencioso
                  }
                }
              }}
            />

            {/* 3. Ficha Optométrica Lateral */}
            <FichaOptometrica
              contacto={pacienteActivo}
              formula={formulaVigente}
              formulas={formulasPaciente}
              nombreOptica={opticaActual?.nombre}
              enVentana24h={
                conversacionActiva
                  ? estaEnVentana24Horas(conversacionActiva.ultimo_mensaje_entrante_en)
                  : (pacienteActivo
                      ? estaEnVentana24Horas(conversaciones.find((c) => Number(c.contacto_id) === Number(pacienteActivo.id))?.ultimo_mensaje_entrante_en)
                      : false)
              }
              alAlternarFicha={() => {
                setFichaAbierta(!fichaAbierta);
                if (vistaMovilChat === 'ficha') {
                  setVistaMovilChat('chat');
                }
              }}
              alAbrirNuevaFormula={() => {
                setContactoParaFormula(pacienteActivo);
                setModalFormulaAbierto(true);
              }}
              alAbrirAgendarCita={() => {
                setContactoParaCita(pacienteActivo);
                setModalCitaAbierto(true);
              }}
              alCompartirPrescripcion={(texto) => {
                let convDestino = conversacionActiva;
                if ((!convDestino || !convDestino.id) && pacienteActivo) {
                  convDestino = conversaciones.find((c) => Number(c.contacto_id) === Number(pacienteActivo.id)) || null;
                  if (convDestino) {
                    setConversacionActiva(convDestino);
                  }
                }

                if (convDestino && convDestino.id) {
                  manejarEnviarMensaje(texto, convDestino);
                } else {
                  alert('Por favor selecciona una conversación para enviar la prescripción al chat.');
                }
              }}
              alReactivarConPlantilla={manejarReactivarPlantilla}
            />
          </section>
        )}

        {vistaActiva === 'pacientes' && (
          <DirectorioPacientes
            pacientes={pacientes}
            cargando={cargandoPacientes}
            alAbrirNuevaFormula={(p) => {
              setContactoParaFormula(p);
              setModalFormulaAbierto(true);
            }}
            alRecargarPacientes={recargarPacientes}
            alSeleccionarContactoChat={navegarAlChatContacto}
          />
        )}

        {vistaActiva === 'citas' && (
          <CalendarioCitas
            contactos={pacientes}
            conversaciones={conversaciones}
            nombreOptica={opticaActual?.nombre}
            esAdmin={usuarioActual?.rol === 'admin'}
            alSeleccionarContactoChat={navegarAlChatContacto}
            alEnviarMensajeWhatsApp={async (texto, convDestino) => {
              await manejarEnviarMensaje(texto, convDestino || undefined);
            }}
            fechaFoco={citasFoco.fecha}
            modoVistaFoco={citasFoco.modo}
            alLimpiarFoco={limpiarCitasFoco}
          />
        )}

        {vistaActiva === 'campanas' && (
          <ModuloAutoSegmentacion
            alSeleccionarContactoChat={navegarAlChatContacto}
            nombreOptica={opticaActual?.nombre}
            opticaId={opticaActual?.id}
          />
        )}

        {vistaActiva === 'plantillas' && (
          <ModuloPlantillas
            nombreOptica={opticaActual?.nombre}
            opticaId={opticaActual?.id}
            alSeleccionarContactoChat={navegarAlChatContacto}
          />
        )}

        {vistaActiva === 'configuracion' && (
          <ModuloConfiguracion
            opticaActual={opticaActual}
            usuarioActual={usuarioActual}
            alActualizarOptica={(opticaActualizada) => {
              setOpticaActual(opticaActualizada);
              setListaOpticas((prev) =>
                prev.map((o) => (Number(o.id) === Number(opticaActualizada.id) ? { ...o, ...opticaActualizada } : o))
              );
              aplicarTemaOptica(opticaActualizada);
              guardarOpticaSesion(opticaActualizada);
            }}
          />
        )}

        {vistaActiva === 'consumo' && usuarioActual?.rol === 'admin' && (
          <ModuloConsumo
            opticas={listaOpticas}
            opticaActual={opticaActual}
          />
        )}

        {vistaActiva === 'usuarios' && (
          <ModuloUsuarios
            opticasDisponibles={listaOpticas}
          />
        )}

        {vistaActiva !== 'mensajeria' && vistaActiva !== 'pacientes' && vistaActiva !== 'citas' && vistaActiva !== 'campanas' && vistaActiva !== 'plantillas' && vistaActiva !== 'configuracion' && vistaActiva !== 'consumo' && vistaActiva !== 'usuarios' && (
          <div style={{ flex: 1, padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--texto-atenuado)' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--texto-principal)', textTransform: 'capitalize' }}>
              Módulo de {vistaActiva}
            </h2>
            <p style={{ fontSize: '0.8rem', maxWidth: '400px', marginTop: '0.5rem' }}>
              Este módulo se conectará con los endpoints REST y la base de datos en las siguientes fases del plan.
            </p>
          </div>
        )}
      </main>

      {/* Modal de Prescripción Óptica */}
      <ModalNuevaFormula
        abierto={modalFormulaAbierto}
        contacto={contactoParaFormula}
        alCerrar={() => setModalFormulaAbierto(false)}
        alGuardar={manejarGuardarFormula}
      />

      {/* Modal de Agendamiento de Citas */}
      <ModalAgendarCita
        abierto={modalCitaAbierto}
        contacto={contactoParaCita}
        contactosDisponibles={pacientes}
        conversaciones={conversaciones}
        alCerrar={() => setModalCitaAbierto(false)}
        alGuardarCita={manejarGuardarCita}
      />

      {/* Modal de Registro / Conversión a Paciente desde el Chat */}
      <ModalRegistrarPaciente
        abierto={modalRegistrarPacienteChatAbierto}
        alCerrar={() => setModalRegistrarPacienteChatAbierto(false)}
        alGuardarExitoso={async (pacienteActualizado) => {
          await recargarPacientes();
          const idActualizado = Number(pacienteActualizado.id);
          if (conversacionActiva && Number(conversacionActiva.contacto_id) === idActualizado) {
            const detalle = await obtenerDetalleContacto(idActualizado);
            if (detalle) {
              setPacienteActivo(detalle.contacto);
              setFormulasPaciente(detalle.formulas || []);
              setFormulaVigente(detalle.formulas.length > 0 ? detalle.formulas[0] : null);
            } else {
              setPacienteActivo(pacienteActualizado);
            }
          }
          setConversaciones((prev) =>
            prev.map((c) =>
              Number(c.contacto_id) === idActualizado
                ? {
                    ...c,
                    contacto_nombre: pacienteActualizado.nombre_completo || pacienteActualizado.nombre || c.contacto_nombre,
                    contacto_telefono: pacienteActualizado.telefono || c.contacto_telefono,
                    contacto_correo: pacienteActualizado.correo || c.contacto_correo,
                  }
                : c
            )
          );
        }}
        contactoParaConvertir={pacienteActivo}
      />

      {/* Modal de Bloqueo por Expiración de Suscripción (Horario Colombia) */}
      <ModalBloqueoSuscripcion optica={opticaActual} usuario={usuarioActual} />

      {/* Barra de Navegación Inferior Fija para Móviles (Visible fuera del chat individual activo) */}
      {!(vistaActiva === 'mensajeria' && vistaMovilChat !== 'lista') && (
        <BarraNavegacionInferiorMovil
          vistaActiva={vistaActiva}
          alCambiarVista={(v) => {
            manejarCambioVista(v);
            setVistaMovilChat('lista');
          }}
          conteoChats={conteoBadgeConversaciones}
          requiereAsesorChats={totalRequiereAsesor > 0}
        />
      )}
    </div>
  );
}
