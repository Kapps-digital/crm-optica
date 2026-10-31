'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Bell,
  CheckCheck,
  Calendar,
  Clock,
  Sparkles,
  Bot,
  AlertTriangle,
  ChevronRight,
  MessageSquare,
  RotateCcw,
  CheckCircle2,
  FlaskConical,
  X,
  Smartphone,
  BellRing,
  BellOff,
  Send,
  Loader2,
} from 'lucide-react';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';
import { obtenerNotificacionesApi } from '@/servicios/api_crm';
import { obtenerFechaHoyColombia, obtenerFechaMananaColombia } from '@/utilidades/formato';
import type { NotificacionCRM, Usuario } from '@/tipos/crm';
import {
  verificarSoportePush,
  verificarSuscripcionActiva,
  suscribirDispositivoPush,
  desuscribirDispositivoPush,
  enviarPruebaPush,
} from '@/utilidades/gestorNotificacionesPushCliente';

interface RegistroLeida {
  clave: string;
  leida_en: string; // ISO string de cuándo se marcó leída
}

interface PropiedadesCentroNotificaciones {
  opticaId?: number;
  usuario?: Usuario | null;
  alNavegarVista?: (vista: string, datos?: any) => void;
  alCambiarConteoNoLeidas?: (conteo: number) => void;
}

/**
 * Notificaciones de prueba dinámicas con fechas de hoy y mañana en Colombia
 */
function obtenerNotificacionesDemo(): NotificacionCRM[] {
  const hoyCol = obtenerFechaHoyColombia();
  const mananaCol = obtenerFechaMananaColombia();

  return [
    {
      id: 'demo_cita_agendada',
      clave: 'demo_cita_agendada',
      tipo: 'cita_agendada_ia',
      titulo: 'Laura Valentina Gómez',
      subtitulo: 'Control de Miopía y Astigmatismo',
      mensaje: `Agendada para hoy ${hoyCol} a las 10:00 AM con Dr. Juan Vega.`,
      etiqueta: 'Agendada IA',
      nivel_alerta: 'VERDE',
      es_urgente: false,
      fecha_creado: new Date().toISOString(),
      fecha_texto: 'Hoy • 10:00 AM',
      enlace_vista: 'citas',
      datos: { fecha_cita: hoyCol, fecha: hoyCol },
    },
    {
      id: 'demo_cita_reprogramada',
      clave: 'demo_cita_reprogramada',
      tipo: 'cita_reprogramada_ia',
      titulo: 'Carlos Eduardo Mendoza',
      subtitulo: 'Primera Vez - Examen Computarizado',
      mensaje: `Cita reprogramada para mañana ${mananaCol} a las 02:30 PM con Dra. María Ruiz.`,
      etiqueta: 'Reprogramada IA',
      nivel_alerta: 'AMARILLO',
      es_urgente: false,
      fecha_creado: new Date().toISOString(),
      fecha_texto: 'Mañana • 02:30 PM',
      enlace_vista: 'citas',
      datos: { fecha_cita: mananaCol, fecha: mananaCol },
    },
    {
      id: 'demo_asesor_humano',
      clave: 'demo_asesor_humano',
      tipo: 'ia_requiere_asesor',
      titulo: 'Sofía Ramírez Durán',
      subtitulo: 'Requiere asesor humano',
      mensaje: 'El paciente solicitó atención urgente en WhatsApp para cotización de montura y lentes.',
      etiqueta: 'Urgente',
      nivel_alerta: 'ROJO',
      es_urgente: true,
      fecha_creado: new Date().toISOString(),
      fecha_texto: 'Atención requerida',
      enlace_vista: 'mensajeria',
      datos: {
        conversacion_id: 1,
        contacto_id: 1,
        nombre: 'Sofía Ramírez Durán',
        contacto_nombre: 'Sofía Ramírez Durán',
        telefono: '3101234567',
        contacto_telefono: '3101234567',
      },
    },
    {
      id: 'demo_resumen_hoy',
      clave: 'demo_resumen_hoy',
      tipo: 'resumen_hoy',
      titulo: 'Citas programadas para hoy',
      subtitulo: '4 citas en agenda',
      mensaje: 'Tienes 4 citas programadas para el día de hoy en la sede principal.',
      etiqueta: 'Hoy',
      nivel_alerta: 'VERDE',
      es_urgente: false,
      es_resumen_diario: true,
      fecha_referencia: hoyCol,
      fecha_creado: new Date().toISOString(),
      fecha_texto: 'Hoy',
      enlace_vista: 'citas',
      datos: { fecha: hoyCol },
    },
    {
      id: 'demo_resumen_manana',
      clave: 'demo_resumen_manana',
      tipo: 'resumen_manana',
      titulo: 'Citas agendadas para mañana',
      subtitulo: '2 citas programadas',
      mensaje: 'Tienes 2 citas agendadas para el día de mañana con optometría general.',
      etiqueta: 'Mañana',
      nivel_alerta: 'AZUL',
      es_urgente: false,
      es_resumen_diario: true,
      fecha_referencia: mananaCol,
      fecha_creado: new Date().toISOString(),
      fecha_texto: 'Mañana',
      enlace_vista: 'citas',
      datos: { fecha: mananaCol },
    },
  ];
}

export const CentroNotificaciones: React.FC<PropiedadesCentroNotificaciones> = ({
  opticaId = 1,
  usuario,
  alNavegarVista,
  alCambiarConteoNoLeidas,
}) => {
  const [mostrarMenu, setMostrarMenu] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState<'todas' | 'urgentes'>('todas');
  const [notificacionesRemotas, setNotificacionesRemotas] = useState<NotificacionCRM[]>([]);
  const [cargando, setCargando] = useState(false);
  const [enModoDemo, setEnModoDemo] = useState(false);
  const refMenu = useRef<HTMLDivElement>(null);

  // Estados para Notificaciones Push Web (Móvil)
  const [pushSoportado, setPushSoportado] = useState(false);
  const [pushActivo, setPushActivo] = useState(false);
  const [pushCargando, setPushCargando] = useState(false);
  const [pushMensaje, setPushMensaje] = useState<string | null>(null);

  // Verificar soporte y suscripción activa al montar y cada vez que se abre el menú
  useEffect(() => {
    const soportado = verificarSoportePush();
    setPushSoportado(soportado);
    if (soportado) {
      verificarSuscripcionActiva().then(setPushActivo);
    }
  }, [mostrarMenu]);

  const alternarPush = async () => {
    setPushCargando(true);
    setPushMensaje(null);
    try {
      if (pushActivo) {
        const ok = await desuscribirDispositivoPush();
        if (ok) {
          setPushActivo(false);
          setPushMensaje('Notificaciones desactivadas en este celular.');
        } else {
          setPushMensaje('No se pudieron desactivar las notificaciones.');
        }
      } else {
        const res = await suscribirDispositivoPush(opticaId, usuario?.id);
        if (res.exito) {
          setPushActivo(true);
          setPushMensaje('¡Notificaciones activadas en este celular!');
        } else {
          setPushMensaje(`Error: ${res.error}`);
        }
      }
    } finally {
      setPushCargando(false);
    }
  };

  const probarPush = async () => {
    setPushCargando(true);
    setPushMensaje(null);
    try {
      const res = await enviarPruebaPush(opticaId);
      if (res.exito) {
        setPushMensaje('¡Notificación enviada a tu celular!');
      } else {
        setPushMensaje(`Fallo: ${res.error || 'Sin respuesta'}`);
      }
    } finally {
      setPushCargando(false);
    }
  };

  // Rol exclusivo de Administrador Global ('admin')
  const esAdmin = usuario?.rol === 'admin';

  // Clave de localStorage aislada por usuario
  const idUsuarioActual = useMemo(() => {
    if (usuario?.id) return `usr_${usuario.id}`;
    if (usuario?.usuario) return `usr_${usuario.usuario.toLowerCase().trim()}`;
    return 'usr_predeterminado';
  }, [usuario?.id, usuario?.usuario]);

  const claveStorageLeidas = `crm_notificaciones_leidas_${idUsuarioActual}`;

  // Estado de lecturas locales
  const [leidas, setLeidas] = useState<RegistroLeida[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const guardado = localStorage.getItem(claveStorageLeidas);
      if (guardado) {
        const parseado = JSON.parse(guardado);
        // Soporte retrocompatible si era array simple de strings
        if (Array.isArray(parseado)) {
          return parseado.map((item) =>
            typeof item === 'string'
              ? { clave: item, leida_en: new Date().toISOString() }
              : item
          );
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  // Guardar en localStorage cada vez que leidas cambie
  const actualizarLeidas = useCallback(
    (nuevasLeidas: RegistroLeida[]) => {
      setLeidas(nuevasLeidas);
      try {
        localStorage.setItem(claveStorageLeidas, JSON.stringify(nuevasLeidas));
      } catch (err) {
        console.error('Error al guardar lecturas en localStorage:', err);
      }
    },
    [claveStorageLeidas]
  );

  // Reiniciar todas las lecturas locales (dejar todas como no leídas)
  const reiniciarNoLeidas = useCallback(() => {
    setLeidas([]);
    try {
      localStorage.removeItem(claveStorageLeidas);
    } catch (err) {
      console.error('Error al reiniciar lecturas:', err);
    }
  }, [claveStorageLeidas]);

  // Sincronizar leidas al cambiar de usuario
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const guardado = localStorage.getItem(claveStorageLeidas);
      if (guardado) {
        const parseado = JSON.parse(guardado);
        if (Array.isArray(parseado)) {
          setLeidas(
            parseado.map((item) =>
              typeof item === 'string'
                ? { clave: item, leida_en: new Date().toISOString() }
                : item
            )
          );
          return;
        }
      }
      setLeidas([]);
    } catch {
      setLeidas([]);
    }
  }, [claveStorageLeidas]);

  // Referencia mutable para bloquear llamadas de sondeo durante modo demo
  const enModoDemoRef = useRef(enModoDemo);
  useEffect(() => {
    enModoDemoRef.current = enModoDemo;
  }, [enModoDemo]);

  // Cargar notificaciones desde backend (ignorado si está en modo demo)
  const cargarNotificaciones = useCallback(async () => {
    if (enModoDemoRef.current) return;
    try {
      setCargando(true);
      const res = await obtenerNotificacionesApi();
      if (res.exito && Array.isArray(res.notificaciones)) {
        if (!enModoDemoRef.current) {
          setNotificacionesRemotas(res.notificaciones);
        }
      }
    } catch (err) {
      console.warn('Aviso al cargar notificaciones:', err);
    } finally {
      setCargando(false);
    }
  }, []);

  // Cargar o restaurar Demo interactiva con los 6 tipos de notificación
  const alternarCargarDemo = useCallback(() => {
    setEnModoDemo((prev) => {
      const nuevoModo = !prev;
      enModoDemoRef.current = nuevoModo;
      if (nuevoModo) {
        // Reiniciar lecturas para que se muestren frescas y no leídas
        reiniciarNoLeidas();
      } else {
        // Restaurar inmediatamente notificaciones de la base de datos
        cargarNotificaciones();
      }
      return nuevoModo;
    });
  }, [reiniciarNoLeidas, cargarNotificaciones]);

  // Sincronización instantánea (0ms) con el sondeo de chats en tiempo real (1.8s)
  useEffect(() => {
    const alRecibirSenalNotificaciones = () => {
      if (!enModoDemoRef.current) {
        cargarNotificaciones();
      }
    };
    window.addEventListener('crm_recargar_notificaciones', alRecibirSenalNotificaciones);
    return () => window.removeEventListener('crm_recargar_notificaciones', alRecibirSenalNotificaciones);
  }, [cargarNotificaciones]);

  // Carga inicial y sondeo periódico de respaldo cada 15 segundos (ignorado en modo demo)
  useEffect(() => {
    cargarNotificaciones();
    const intervalo = setInterval(() => {
      if (!enModoDemoRef.current) {
        cargarNotificaciones();
      }
    }, 15000);
    return () => clearInterval(intervalo);
  }, [cargarNotificaciones]);

  // Cierre de menú al hacer clic fuera o presionar Escape
  useEffect(() => {
    const manejarClickAfuera = (e: MouseEvent | TouchEvent) => {
      if (refMenu.current && !refMenu.current.contains(e.target as Node)) {
        setMostrarMenu(false);
      }
    };
    const manejarEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMostrarMenu(false);
    };

    if (mostrarMenu) {
      document.addEventListener('mousedown', manejarClickAfuera);
      document.addEventListener('touchstart', manejarClickAfuera);
      document.addEventListener('keydown', manejarEscape);
    }
    return () => {
      document.removeEventListener('mousedown', manejarClickAfuera);
      document.removeEventListener('touchstart', manejarClickAfuera);
      document.removeEventListener('keydown', manejarEscape);
    };
  }, [mostrarMenu]);

  // Mapa de lecturas por clave
  const mapaLeidas = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const r of leidas) {
      if (r && r.clave) mapa.set(r.clave, r.leida_en);
    }
    return mapa;
  }, [leidas]);

  // Fecha hoy en Colombia para filtrar resúmenes diarios
  const fechaHoyCol = useMemo(() => obtenerFechaHoyColombia(), []);

  // Fuente de datos activa: si está en demo, utiliza notificaciones demo dinámicas; si no, remotas de BD
  const notificacionesBase = useMemo(() => {
    return enModoDemo ? obtenerNotificacionesDemo() : notificacionesRemotas;
  }, [enModoDemo, notificacionesRemotas]);

  // Procesar y filtrar notificaciones según las reglas de negocio
  const notificacionesProcesadas = useMemo(() => {
    const ahoraMs = Date.now();
    const TRES_DIAS_MS = 3 * 24 * 60 * 60 * 1000;

    const filtradas = notificacionesBase.filter((item) => {
      const fechaLeidaIso = mapaLeidas.get(item.clave);
      let estaLeida = Boolean(fechaLeidaIso);

      // Si es alerta de atención humana urgente y fue actualizada/solicitada después de la lectura, considerarla NO leída
      if (estaLeida && item.tipo === 'ia_requiere_asesor' && item.fecha_creado && fechaLeidaIso) {
        if (new Date(item.fecha_creado).getTime() > new Date(fechaLeidaIso).getTime()) {
          estaLeida = false;
        }
      }

      // Regla de negocio crítica: NO mostrar notificaciones de días anteriores al día de hoy en Colombia
      // 1. Si tiene fecha de cita asociada, descartar si la fecha de la cita ya pasó (es anterior a hoy)
      const fechaCita = item.datos?.fecha_cita || item.datos?.fecha;
      if (fechaCita && String(fechaCita).slice(0, 10) < fechaHoyCol) {
        return false;
      }

      // 2. Si es resumen diario y su fecha no corresponde a hoy ni mañana en Colombia, descartar
      if (item.es_resumen_diario && item.fecha_referencia) {
        if (item.tipo === 'resumen_hoy' && item.fecha_referencia !== fechaHoyCol) {
          return false;
        }
        if (item.fecha_referencia !== 'manana' && item.fecha_referencia < fechaHoyCol) {
          return false;
        }
      }

      // 3. Si fue creada en días anteriores y no es una cita futura vigente, descartar
      if (item.fecha_creado) {
        const fechaCreadoCol = new Date(item.fecha_creado).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
        const esCitaFutura = fechaCita && String(fechaCita).slice(0, 10) >= fechaHoyCol;
        if (fechaCreadoCol < fechaHoyCol && !esCitaFutura) {
          return false;
        }
      }

      // Regla: Si está leída, validar que no hayan pasado 3 días desde que se leyó
      if (estaLeida && fechaLeidaIso) {
        const msDesdeLectura = ahoraMs - new Date(fechaLeidaIso).getTime();
        if (msDesdeLectura > TRES_DIAS_MS) {
          return false; // Depuración automática de 3 días post-lectura
        }
      }

      return true;
    });

    // Añadir campo esLeida y ordenar
    const procesadas = filtradas.map((item) => {
      let esLeida = mapaLeidas.has(item.clave);
      if (esLeida && item.tipo === 'ia_requiere_asesor' && item.fecha_creado) {
        const fechaLeidaIso = mapaLeidas.get(item.clave);
        if (fechaLeidaIso) {
          const fechaLeidaMs = new Date(fechaLeidaIso).getTime();
          const fechaCreadoMs = new Date(item.fecha_creado).getTime();
          // Si el paciente volvió a solicitar atención después de que se leyó la clave previa, se considera NO LEÍDA
          if (fechaCreadoMs > fechaLeidaMs) {
            esLeida = false;
          }
        }
      }
      return {
        ...item,
        esLeida,
      };
    });

    // Ordenamiento:
    // 1. No leídas primero (urgentes arriba, luego por fecha)
    // 2. Leídas abajo
    return procesadas.sort((a, b) => {
      if (!a.esLeida && b.esLeida) return -1;
      if (a.esLeida && !b.esLeida) return 1;

      // Si ambas están sin leer o ambas leídas, priorizar urgentes
      if (a.es_urgente && !b.es_urgente) return -1;
      if (!a.es_urgente && b.es_urgente) return 1;

      return 0;
    });
  }, [notificacionesBase, mapaLeidas, fechaHoyCol]);

  // Conteos
  const totalNoLeidas = useMemo(
    () => notificacionesProcesadas.filter((n) => !n.esLeida).length,
    [notificacionesProcesadas]
  );

  const urgentesNoLeidas = useMemo(
    () => notificacionesProcesadas.filter((n) => !n.esLeida && n.es_urgente).length,
    [notificacionesProcesadas]
  );

  const totalUrgentes = useMemo(
    () => notificacionesProcesadas.filter((n) => n.es_urgente).length,
    [notificacionesProcesadas]
  );

  // Notificar al padre el conteo de no leídas
  useEffect(() => {
    if (alCambiarConteoNoLeidas) {
      alCambiarConteoNoLeidas(totalNoLeidas);
    }
  }, [totalNoLeidas, alCambiarConteoNoLeidas]);

  // Marcar una notificación individual como leída
  const marcarUnaLeida = useCallback(
    (clave: string) => {
      if (!clave) return;
      if (mapaLeidas.has(clave)) return;
      const nuevoRegistro: RegistroLeida = {
        clave,
        leida_en: new Date().toISOString(),
      };
      actualizarLeidas([...leidas, nuevoRegistro]);
    },
    [mapaLeidas, leidas, actualizarLeidas]
  );

  // Marcar todas como leídas
  const marcarTodasComoLeidas = useCallback(() => {
    const ahoraIso = new Date().toISOString();
    const nuevas: RegistroLeida[] = [...leidas];
    for (const notif of notificacionesProcesadas) {
      if (!mapaLeidas.has(notif.clave)) {
        nuevas.push({ clave: notif.clave, leida_en: ahoraIso });
      }
    }
    actualizarLeidas(nuevas);
  }, [leidas, notificacionesProcesadas, mapaLeidas, actualizarLeidas]);

  // Clic en el cuerpo de la notificación: ÚNICAMENTE marca como leída (sin navegar a ninguna vista)
  const manejarClicCuerpoNotificacion = (notif: NotificacionCRM) => {
    marcarUnaLeida(notif.clave);
  };

  // Clic en el botón Revisar: marca leída, cierra menú y navega a la vista asociada
  const manejarClicRevisar = (e: React.MouseEvent, notif: NotificacionCRM) => {
    e.stopPropagation();
    marcarUnaLeida(notif.clave);
    setMostrarMenu(false);
    if (alNavegarVista && notif.enlace_vista) {
      alNavegarVista(notif.enlace_vista, notif.datos);
    }
  };

  // Lista visible según la pestaña activa
  const notificacionesVisibles = useMemo(() => {
    if (pestanaActiva === 'urgentes') {
      return notificacionesProcesadas.filter((n) => n.es_urgente);
    }
    return notificacionesProcesadas;
  }, [pestanaActiva, notificacionesProcesadas]);

  return (
    <div className="centro-notificaciones-contenedor" ref={refMenu}>
      {/* Botón Campana en Barra Superior */}
      <EtiquetaTooltip
        texto={
          mostrarMenu
            ? ''
            : urgentesNoLeidas > 0
            ? `${totalNoLeidas} no leídas (${urgentesNoLeidas} urgentes)`
            : totalNoLeidas > 0
            ? `${totalNoLeidas} notificaciones pendientes`
            : 'Notificaciones al día'
        }
        posicion="abajo"
      >
        <button
          className={`boton-icono-notificacion ${urgentesNoLeidas > 0 ? 'tiene-urgente' : ''}`}
          onClick={() => setMostrarMenu(!mostrarMenu)}
          aria-label="Abrir panel de notificaciones"
        >
          <Bell size={18} />
          {totalNoLeidas > 0 && (
            <span
              className={`badge-burbuja-notificacion ${
                urgentesNoLeidas > 0 ? 'badge-urgente-rojo' : ''
              }`}
            >
              {totalNoLeidas > 99 ? '99+' : totalNoLeidas}
            </span>
          )}
        </button>
      </EtiquetaTooltip>

      {/* Backdrop oscuro para cerrar en móvil al tocar fuera */}
      {mostrarMenu && (
        <div
          className="backdrop-notificaciones-movil"
          onClick={() => setMostrarMenu(false)}
        />
      )}

      {/* Menú Desplegable Flotante (445px Glassmorphism inspirado en la Tesis) */}
      {mostrarMenu && (
        <div className="menu-desplegable-notificaciones panel-compacto">
          {/* Cabecera Compacta */}
          <div className="cabecera-panel-notif-compacta">
            <div className="cabecera-fila-superior-movil">
              <div className="cabecera-info-izq">
                <Bell size={15} className="icono-cabecera-a" />
                <h4>Notificaciones</h4>
                {totalNoLeidas > 0 ? (
                  <span className="badge-conteo-no-leidas">
                    {totalNoLeidas === 1 ? '1 nueva' : `${totalNoLeidas} nuevas`}
                  </span>
                ) : (
                  <span className="badge-al-dia">Al día</span>
                )}
              </div>

              {/* Botón Cerrar exclusivo para móvil */}
              <button
                type="button"
                className="btn-cerrar-notif-movil"
                onClick={() => setMostrarMenu(false)}
                aria-label="Cerrar notificaciones"
                title="Cerrar panel"
              >
                <X size={15} />
              </button>
            </div>

            <div className="cabecera-fila-acciones-notif">
              {totalNoLeidas > 0 && (
                <EtiquetaTooltip texto="Marcar todas como leídas" posicion="abajo">
                  <button className="btn-marcar-todo-leido" onClick={marcarTodasComoLeidas}>
                    <CheckCheck size={12} style={{ marginRight: '3px' }} />
                    Leídas
                  </button>
                </EtiquetaTooltip>
              )}

              {/* Pestañas de Filtro Inline */}
              <div className="pestanas-filtro-inline">
                <button
                  className={`btn-pestana-inline ${pestanaActiva === 'todas' ? 'activa' : ''}`}
                  onClick={() => setPestanaActiva('todas')}
                >
                  Todas ({notificacionesProcesadas.length})
                </button>
                <button
                  className={`btn-pestana-inline ${pestanaActiva === 'urgentes' ? 'activa' : ''}`}
                  onClick={() => setPestanaActiva('urgentes')}
                >
                  Urgentes ({totalUrgentes})
                </button>
              </div>
            </div>
          </div>

          {/* Cuerpo con Scroll y Tarjetas Compactas */}
          <div className="cuerpo-scroll-notificaciones-compacto">
            {notificacionesVisibles.length === 0 ? (
              <div className="estado-vacio-notificaciones">
                <CheckCircle2 size={32} style={{ color: 'var(--color-exito)', marginBottom: '0.5rem', opacity: 0.8 }} />
                <strong style={{ fontSize: '0.82rem', color: 'var(--texto-principal)' }}>
                  {pestanaActiva === 'urgentes'
                    ? 'No hay alertas urgentes pendientes'
                    : 'Bandeja de notificaciones al día'}
                </strong>
                <p style={{ fontSize: '0.74rem', color: 'var(--texto-atenuado)', margin: '0.25rem 0 0', maxWidth: '280px' }}>
                  {pestanaActiva === 'urgentes'
                    ? 'Todos los requerimientos de atención han sido atendidos.'
                    : 'Las novedades clínicas y turnos agendados por la IA aparecerán aquí.'}
                </p>
              </div>
            ) : (
              <div className="lista-notificaciones-compacta">
                {notificacionesVisibles.map((item) => {
                  // Clases de estilo según tipo
                  let claseBorde = 'borde-azul';
                  let TagIcono = Sparkles;
                  let claseTag = 'nuevo';

                  if (item.tipo === 'ia_requiere_asesor') {
                    claseBorde = 'borde-urgente';
                    TagIcono = AlertTriangle;
                    claseTag = 'urgente';
                  } else if (item.tipo === 'cita_reprogramada_ia') {
                    claseBorde = 'borde-precaucion';
                    TagIcono = Clock;
                    claseTag = 'precaucion';
                  } else if (item.tipo === 'cita_agendada_ia') {
                    claseBorde = 'borde-vigente';
                    TagIcono = Bot;
                    claseTag = 'vigente';
                  } else if (item.tipo === 'resumen_hoy') {
                    claseBorde = 'borde-vigente';
                    TagIcono = Calendar;
                    claseTag = 'vigente';
                  } else if (item.tipo === 'resumen_manana') {
                    claseBorde = 'borde-nuevo';
                    TagIcono = Calendar;
                    claseTag = 'nuevo';
                  }

                  return (
                    <div
                      key={item.clave}
                      className={`tarjeta-notif-compacta ${
                        item.esLeida ? 'leida' : 'no-leida'
                      } ${claseBorde}`}
                      onClick={() => manejarClicCuerpoNotificacion(item)}
                      title={item.esLeida ? undefined : 'Clic para marcar como leída'}
                    >
                      {/* Fila 1: Estado + Título + Timestamp / Badge */}
                      <div className="notif-c-fila-1">
                        <div className="notif-c-izq">
                          {!item.esLeida && (
                            <EtiquetaTooltip texto="Notificación sin leer • Clic para marcar leída" posicion="arriba">
                              <span className="punto-no-leida" />
                            </EtiquetaTooltip>
                          )}
                          <EtiquetaTooltip
                            texto={
                              item.tipo === 'cita_agendada_ia'
                                ? 'Cita agendada automáticamente por la IA'
                                : item.tipo === 'cita_reprogramada_ia'
                                ? 'Cita reprogramada automáticamente por la IA'
                                : item.tipo === 'ia_requiere_asesor'
                                ? 'Atención prioritaria solicitada por el paciente'
                                : item.tipo === 'resumen_hoy'
                                ? 'Resumen diario de agenda de hoy'
                                : 'Resumen de citas para mañana'
                            }
                            posicion="arriba"
                          >
                            <span className={`tag-estado-compacto ${claseTag}`}>
                              <TagIcono size={10} /> {item.etiqueta}
                            </span>
                          </EtiquetaTooltip>
                          <EtiquetaTooltip
                            texto={item.titulo}
                            posicion="arriba"
                            soloSiTruncado
                            className="tooltip-nombre-notif"
                          >
                            <span className="entidad-nombre-c">
                              {item.titulo}
                            </span>
                          </EtiquetaTooltip>
                        </div>
                        {item.subtitulo && (
                          <EtiquetaTooltip
                            texto={item.subtitulo}
                            posicion="arriba"
                            soloSiTruncado
                            className="tooltip-chip-notif"
                          >
                            <span className="chip-desc-c">{item.subtitulo}</span>
                          </EtiquetaTooltip>
                        )}
                      </div>

                      {/* Fila 2: Mensaje Descriptivo + Acción */}
                      <div className="notif-c-fila-2">
                        <EtiquetaTooltip
                          texto={item.mensaje}
                          posicion="arriba"
                          className="tooltip-mensaje-notif"
                        >
                          <span className="notif-c-detalle">
                            {item.mensaje}
                          </span>
                        </EtiquetaTooltip>
                        <div className="enlace-revisar-c">
                          {item.fecha_texto && (
                            <span className="fecha-tiempo-c">{item.fecha_texto}</span>
                          )}
                          <button
                            type="button"
                            className="btn-revisar-accion"
                            onClick={(e) => manejarClicRevisar(e, item)}
                            title="Ir a revisar esta notificación"
                          >
                            Revisar <ChevronRight size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Barra de Acciones de Administración (Demo y Reinicio de Lecturas) */}
          {esAdmin && (
            <div className="barra-acciones-admin-notif">
              <EtiquetaTooltip
                texto="Reinicia el historial local para marcar todas las notificaciones como no leídas"
                posicion="arriba"
              >
                <button
                  type="button"
                  className="btn-admin-notif"
                  onClick={reiniciarNoLeidas}
                >
                  <RotateCcw size={12} />
                  <span>Reiniciar No Leídas</span>
                </button>
              </EtiquetaTooltip>

              <EtiquetaTooltip
                texto={
                  enModoDemo
                    ? 'Restaurar notificaciones reales desde la base de datos'
                    : 'Cargar demo interactiva con los 5 tipos clínicos del CRM'
                }
                posicion="arriba"
              >
                <button
                  type="button"
                  className={`btn-admin-notif ${enModoDemo ? 'btn-demo-activo' : ''}`}
                  onClick={alternarCargarDemo}
                >
                  <FlaskConical size={12} />
                  <span>{enModoDemo ? 'Restaurar Reales' : 'Cargar Demo (5 Tipos)'}</span>
                </button>
              </EtiquetaTooltip>
            </div>
          )}

          {/* Sección de Notificaciones Push exclusiva para teléfonos móviles */}
          <div
            className="seccion-push-solo-movil"
            style={{
              padding: '0.65rem 0.85rem',
              borderTop: '1px solid var(--borde-tarjeta)',
              background: 'var(--fondo-elevado)',
              flexDirection: 'column',
              gap: '0.45rem',
            }}
          >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Smartphone size={14} style={{ color: pushActivo ? '#10b981' : 'var(--texto-atenuado)' }} />
                  <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--texto-principal)' }}>
                    Alertas en el Celular
                  </span>
                  {pushActivo && (
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        color: '#059669',
                        background: 'rgba(16, 185, 129, 0.12)',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '6px',
                      }}
                    >
                      Activas
                    </span>
                  )}
                </div>

                {pushSoportado ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {pushActivo && (
                      <button
                        type="button"
                        onClick={probarPush}
                        disabled={pushCargando}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--borde-tarjeta)',
                          borderRadius: '6px',
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.68rem',
                          color: 'var(--texto-secundario)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                        title="Enviar notificación de prueba ahora"
                      >
                        <Send size={11} />
                        Probar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={alternarPush}
                      disabled={pushCargando}
                      style={{
                        background: pushActivo ? 'rgba(239, 68, 68, 0.12)' : 'var(--color-primario)',
                        color: pushActivo ? '#dc2626' : '#ffffff',
                        border: pushActivo ? '1px solid rgba(239, 68, 68, 0.3)' : 'none',
                        borderRadius: '6px',
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.70rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        transition: 'all 0.15s ease',
                      }}
                      title={pushActivo ? 'Desactivar notificaciones en este celular' : 'Activar notificaciones en este celular'}
                    >
                      {pushCargando ? (
                        <Loader2 size={12} style={{ animation: 'girar 1s linear infinite' }} />
                      ) : pushActivo ? (
                        <>
                          <BellOff size={12} />
                          Desactivar
                        </>
                      ) : (
                        <>
                          <BellRing size={12} />
                          Activar en celular
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <span
                    style={{
                      fontSize: '0.66rem',
                      color: 'var(--texto-atenuado)',
                      background: 'rgba(0,0,0,0.04)',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                    }}
                  >
                    Requiere HTTPS
                  </span>
                )}
              </div>

              {/* Mensaje de estado o advertencia de HTTPS en red local */}
              {!pushSoportado && (
                <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--texto-atenuado)', lineHeight: 1.35 }}>
                  Los navegadores móviles requieren HTTPS para alertas push. Funcionarán en la versión oficial en producción o en localhost.
                </p>
              )}

              {pushMensaje && (
                <div
                  style={{
                    fontSize: '0.70rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '5px',
                    background: pushMensaje.includes('Error') || pushMensaje.includes('Fallo')
                      ? 'rgba(239, 68, 68, 0.1)'
                      : 'rgba(16, 185, 129, 0.1)',
                    color: pushMensaje.includes('Error') || pushMensaje.includes('Fallo') ? '#dc2626' : '#059669',
                    fontWeight: 500,
                  }}
                >
                  {pushMensaje}
                </div>
              )}
            </div>

          {/* Pie de Panel Informativo */}
          <div className="pie-panel-notif-compacto">
            <span>Centro de Alertas Clínicas</span>
          </div>
        </div>
      )}
    </div>
  );
};
