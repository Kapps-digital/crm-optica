'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  Check,
  CheckCheck,
  AlertCircle,
  Phone,
  Clock,
  ClipboardList,
  AlertTriangle,
  Send,
  MessageSquare,
  UserPlus,
  UserCheck,
  CornerDownLeft,
  ExternalLink,
  Copy,
  Image as IconoImagen,
  Play,
  FileText,
  X,
  Download,
  Bot,
} from 'lucide-react';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';
import type { Conversacion, Mensaje, Contacto, PlantillaWhatsApp, BotonPlantilla } from '@/tipos/crm';
import { formatearTelefono } from '@/utilidades/formato';
import { formatearTextoWhatsApp } from '@/utilidades/formato_whatsapp';
import { obtenerPlantillasYCuota, alternarIAChatApi, resolverUrgenciaAsesorHumano } from '@/servicios/api_crm';
import { ModalAlertaVentana24h } from '../comunes/ModalAlertaVentana24h';

interface PropiedadesVentanaChat {
  conversacion: Conversacion | null;
  mensajes: Mensaje[];
  cargandoMensajes?: boolean;
  alEnviarMensaje: (texto: string) => Promise<void>;
  alReactivarConPlantilla: (nombrePlantilla?: string, idiomaPlantilla?: string) => Promise<void> | void;
  fichaAbierta: boolean;
  alAbrirFicha: () => void;
  paciente?: Contacto | null;
  alRegistrarPaciente?: () => void;
  iaGlobalActiva?: boolean;
  alResolverUrgencia?: (conversacionId: number) => Promise<void> | void;
}

function formatearSeparadorFecha(fechaStr?: string | null): string {
  if (!fechaStr) return '';
  const d = new Date(fechaStr);
  if (isNaN(d.getTime())) return '';
  const hoy = new Date();
  const esHoy = d.toDateString() === hoy.toDateString();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  const esAyer = d.toDateString() === ayer.toDateString();

  if (esHoy) return 'Hoy';
  if (esAyer) return 'Ayer';
  return d.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() !== hoy.getFullYear() ? 'numeric' : undefined,
  });
}

function IndicadorEstadoEntrega({ estado, esTemporal }: { estado?: string | null; esTemporal?: boolean }) {
  if (esTemporal || estado === 'pendiente') {
    return (
      <span title="Enviando a WhatsApp..." style={{ display: 'inline-flex', alignItems: 'center' }}>
        <Clock size={12} style={{ marginLeft: '3px', opacity: 0.75, color: 'rgba(255, 255, 255, 0.9)' }} />
      </span>
    );
  }

  const estadoNorm = (estado || '').toLowerCase().trim();

  if (estadoNorm === 'fallido' || estadoNorm === 'failed') {
    return (
      <span title="No entregado. La ventana de 24 horas está cerrada en WhatsApp o Meta rechazó el mensaje." style={{ display: 'inline-flex', alignItems: 'center' }}>
        <AlertCircle size={13} style={{ marginLeft: '3px', color: '#f87171' }} />
      </span>
    );
  }

  if (estadoNorm === 'leido' || estadoNorm === 'read') {
    return (
      <span title="Leído por el destinatario en WhatsApp" style={{ display: 'inline-flex', alignItems: 'center' }}>
        <CheckCheck size={13} style={{ marginLeft: '3px', color: '#38bdf8' }} />
      </span>
    );
  }

  if (estadoNorm === 'entregado' || estadoNorm === 'delivered') {
    return (
      <span title="Entregado al celular del paciente" style={{ display: 'inline-flex', alignItems: 'center' }}>
        <CheckCheck size={13} style={{ marginLeft: '3px', opacity: 0.95, color: 'rgba(255, 255, 255, 0.95)' }} />
      </span>
    );
  }

  // 'enviado', 'sent' o estado por defecto
  return (
    <span title="Enviado a servidores de WhatsApp" style={{ display: 'inline-flex', alignItems: 'center' }}>
      <Check size={13} style={{ marginLeft: '3px', opacity: 0.85, color: 'rgba(255, 255, 255, 0.9)' }} />
    </span>
  );
}

/**
 * Resuelve y normaliza URLs multimedia hacia el proxy local autenticado de WhatsApp / Zernio
 */
function resolverUrlMediaProxy(url?: string | null): string {
  if (!url) return '';
  const match = url.match(/\/whatsapp\/media\/([a-zA-Z0-9_-]+)/);
  if (match) {
    const mediaId = match[1];
    let accountId = '6ab6a5ade55ed05c5f3a902b';
    const matchAcc = url.match(/accountId=([a-zA-Z0-9_-]+)/);
    if (matchAcc) accountId = matchAcc[1];
    return `/api/media/whatsapp/${mediaId}?accountId=${accountId}`;
  }
  return url;
}

/**
 * Detecta si un mensaje recibido o enviado corresponde a una reacción
 */
function esMensajeReaccion(m: Mensaje): boolean {
  if (m.tipo_contenido === 'reaction') return true;
  const texto = (m.texto || '').trim().toLowerCase();
  if (texto === '[reaction]') return true;
  if (/^\[reaction(?::\s*[^\]]+)?\]$/i.test(texto)) return true;
  return false;
}

/**
 * Extrae el emoji utilizado en la reacción exclusivamente si está presente.
 * NUNCA asume ni inventa un emoji por defecto (como 👍).
 */
function extraerEmojiReaccion(m: Mensaje): string | null {
  if (m.reacciones && m.reacciones.length > 0 && m.reacciones[0].emoji) {
    return m.reacciones[0].emoji;
  }
  const texto = (m.texto || '').trim();
  const match = texto.match(/\[reaction(?::\s*([^\]]+))?\]/i);
  if (match && match[1]?.trim()) {
    return match[1].trim();
  }
  return null;
}

/**
 * Agrupa las reacciones con los mensajes reaccionados y filtra los mensajes de reacción
 * para que no se dibujen como burbujas separadas en el chat.
 */
function procesarMensajesConReacciones(listaMensajes: Mensaje[]): Mensaje[] {
  const resultado: Mensaje[] = [];

  for (let i = 0; i < listaMensajes.length; i++) {
    const m = listaMensajes[i];

    if (esMensajeReaccion(m)) {
      const emoji = extraerEmojiReaccion(m);
      let mensajeObjetivo: Mensaje | undefined;

      // Buscar hacia atrás en el historial el mensaje correspondiente:
      // Si la reacción es saliente (yo reacciono), buscar el último mensaje entrante previo.
      // Si la reacción es entrante (contacto reacciona), buscar el último mensaje saliente previo.
      for (let j = resultado.length - 1; j >= 0; j--) {
        const previo = resultado[j];
        if (m.direccion === 'saliente' && previo.direccion === 'entrante') {
          mensajeObjetivo = previo;
          break;
        } else if (m.direccion === 'entrante' && previo.direccion === 'saliente') {
          mensajeObjetivo = previo;
          break;
        }
      }

      // Si no hay mensaje de la contraparte, asociar al último mensaje previo
      if (!mensajeObjetivo && resultado.length > 0) {
        mensajeObjetivo = resultado[resultado.length - 1];
      }

      // Solo si se extrajo un emoji explícito, adjuntarlo a las reacciones del mensaje objetivo
      if (mensajeObjetivo && emoji) {
        if (!mensajeObjetivo.reacciones) {
          mensajeObjetivo.reacciones = [];
        }
        const yaExiste = mensajeObjetivo.reacciones.some((r) => r.emoji === emoji);
        if (!yaExiste) {
          mensajeObjetivo.reacciones.push({
            emoji,
            direccion: m.direccion,
            id: m.id,
          });
        }
      }
      // Omitir de la lista para que no dibuje su propia burbuja
      continue;
    }

    // Preservar reacciones existentes que ya vienen desde la base de datos / Zernio
    const clon = { ...m };
    if (m.reacciones && Array.isArray(m.reacciones)) {
      clon.reacciones = [...m.reacciones];
    }
    resultado.push(clon);
  }

  return resultado;
}

// Caché global en memoria de URLs de imágenes validadas en la sesión actual
const cacheImagenesValidadas = new Set<string>();

/**
 * Componente defensivo para renderizar imágenes de WhatsApp con fallback, reintento y visor
 */
function ElementoImagenChat({
  url,
  esSaliente,
  alHacerClic,
  alCambiarDimension,
}: {
  url: string;
  esSaliente: boolean;
  alHacerClic: () => void;
  alCambiarDimension?: () => void;
}) {
  const urlResuelta = resolverUrlMediaProxy(url);
  const imgRef = useRef<HTMLImageElement>(null);

  // Si la imagen ya fue cargada exitosamente en esta sesión, inicia inmediatamente como no cargando
  const yaCargadaPreviamente = cacheImagenesValidadas.has(urlResuelta);
  const [cargando, setCargando] = useState(() => !yaCargadaPreviamente);
  const [error, setError] = useState(false);
  const [expirado, setExpirado] = useState(false);
  const [reintentos, setReintentos] = useState(0);
  const [urlActual, setUrlActual] = useState(() => urlResuelta);

  // Sincronizar cuando cambia la URL del mensaje
  useEffect(() => {
    const nuevaUrl = resolverUrlMediaProxy(url);
    setUrlActual(nuevaUrl);
    setError(false);
    setExpirado(false);
    const yaEnCache = cacheImagenesValidadas.has(nuevaUrl);
    setCargando(!yaEnCache);
    setReintentos(0);
  }, [url]);

  // Verificar de inmediato si la imagen ya fue completada por el navegador (ej: caché HTTP o lectura de memoria)
  useEffect(() => {
    const comprobarSiYaCargo = () => {
      const el = imgRef.current;
      if (el && (el.complete || el.naturalWidth > 0)) {
        if (el.naturalWidth > 0) {
          cacheImagenesValidadas.add(urlResuelta);
          setCargando(false);
          setError(false);
          alCambiarDimension?.();
        }
      }
    };

    comprobarSiYaCargo();
    const timer = setTimeout(comprobarSiYaCargo, 100);
    return () => clearTimeout(timer);
  }, [urlActual, urlResuelta, alCambiarDimension]);

  const alCargarExitoso = () => {
    cacheImagenesValidadas.add(urlResuelta);
    setCargando(false);
    setError(false);
    alCambiarDimension?.();
  };

  const manejarError = async () => {
    // Si la imagen en realidad ya se dibujó en el DOM, evitar falsos errores
    if (imgRef.current && imgRef.current.naturalWidth > 0) {
      alCargarExitoso();
      return;
    }

    // Diagnosticar si el archivo caducó en WhatsApp Meta (HTTP 410)
    try {
      const resp = await fetch(resolverUrlMediaProxy(url));
      if (resp.status === 410) {
        setExpirado(true);
        setCargando(false);
        setError(false);
        alCambiarDimension?.();
        return;
      }
    } catch {}

    if (reintentos < 2) {
      const nuevoReintento = reintentos + 1;
      setReintentos(nuevoReintento);
      setTimeout(() => {
        const sep = url.includes('?') ? '&' : '?';
        setUrlActual(`${resolverUrlMediaProxy(url)}${sep}_t=${Date.now()}`);
      }, 1000);
    } else {
      setCargando(false);
      setError(true);
      alCambiarDimension?.();
    }
  };

  const reintentarManual = (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(false);
    setExpirado(false);
    setCargando(true);
    setReintentos(0);
    const sep = url.includes('?') ? '&' : '?';
    setUrlActual(`${resolverUrlMediaProxy(url)}${sep}_t=${Date.now()}`);
  };

  if (expirado) {
    return (
      <div
        style={{
          borderRadius: '8px',
          padding: '0.85rem 0.9rem',
          background: esSaliente ? 'rgba(0, 0, 0, 0.22)' : 'rgba(0, 0, 0, 0.04)',
          border: esSaliente ? '1px dashed rgba(255, 255, 255, 0.22)' : '1px dashed var(--borde-tarjeta)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.35rem',
          minHeight: '100px',
          textAlign: 'center',
          userSelect: 'none',
        }}
      >
        <Clock size={20} style={{ opacity: 0.65, color: esSaliente ? '#ffffff' : 'var(--texto-atenuado)' }} />
        <span style={{ fontSize: '0.76rem', fontWeight: 600, opacity: 0.9 }}>
          Foto no disponible
        </span>
        <span style={{ fontSize: '0.66rem', opacity: 0.72, maxWidth: '230px', lineHeight: 1.3 }}>
          Este archivo multimedia ha caducado en los servidores de WhatsApp.
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          borderRadius: '8px',
          padding: '0.85rem 0.75rem',
          background: esSaliente ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.05)',
          border: '1px dashed rgba(255, 255, 255, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          minHeight: '110px',
          textAlign: 'center',
        }}
      >
        <IconoImagen size={24} style={{ opacity: 0.6 }} />
        <span style={{ fontSize: '0.74rem', opacity: 0.85, fontWeight: 500 }}>
          No fue posible cargar la imagen
        </span>
        <button
          type="button"
          onClick={reintentarManual}
          style={{
            marginTop: '0.15rem',
            padding: '3px 10px',
            fontSize: '0.72rem',
            borderRadius: '12px',
            border: 'none',
            background: esSaliente ? 'rgba(255, 255, 255, 0.25)' : 'var(--color-primario)',
            color: '#ffffff',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: '8px',
        overflow: 'hidden',
        position: 'relative',
        background: esSaliente ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.05)',
        minHeight: cargando ? '160px' : 'auto',
        maxHeight: '340px',
        cursor: 'pointer',
      }}
      onClick={alHacerClic}
      title="Clic para ampliar imagen"
    >
      {cargando && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: esSaliente ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', opacity: 0.75 }}>
            <Clock size={13} />
            <span>Cargando imagen...</span>
          </div>
        </div>
      )}
      <img
        ref={imgRef}
        src={urlActual}
        alt=""
        style={{
          width: '100%',
          maxHeight: '340px',
          objectFit: 'cover',
          display: 'block',
          borderRadius: '8px',
          opacity: cargando ? 0.3 : 1,
          transition: 'opacity 0.15s ease',
        }}
        onLoad={alCargarExitoso}
        onError={manejarError}
      />
    </div>
  );
}

export const VentanaChat: React.FC<PropiedadesVentanaChat> = ({
  conversacion,
  mensajes,
  cargandoMensajes = false,
  alEnviarMensaje,
  alReactivarConPlantilla,
  fichaAbierta,
  alAbrirFicha,
  paciente = null,
  alRegistrarPaciente,
  iaGlobalActiva = true,
  alResolverUrgencia,
}) => {
  const [textoMensaje, setTextoMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [catalogoPlantillas, setCatalogoPlantillas] = useState<PlantillaWhatsApp[]>([]);
  const [modalAlerta24hAbierto, setModalAlerta24hAbierto] = useState(false);
  const [imagenAmpliadaUrl, setImagenAmpliadaUrl] = useState<string | null>(null);
  const [animandoTransicion, setAnimandoTransicion] = useState(false);
  const [preparandoChat, setPreparandoChat] = useState(false);
  const [iaChatActiva, setIaChatActiva] = useState(true);
  const [cambiandoEstadoIA, setCambiandoEstadoIA] = useState(false);
  const [resolviendoUrgencia, setResolviendoUrgencia] = useState(false);
  const [urgenciaAtendidaId, setUrgenciaAtendidaId] = useState<number | null>(null);

  useEffect(() => {
    if (!conversacion?.requiere_asesor_humano) {
      setUrgenciaAtendidaId(null);
    }
  }, [conversacion?.id, conversacion?.requiere_asesor_humano]);
  const contenedorMensajesRef = useRef<HTMLDivElement>(null);
  const idConversacionPrevia = useRef<number | null>(null);
  const longitudMensajesPrevia = useRef<number>(0);
  const debeSeguirFondoRef = useRef<boolean>(true);
  const temporizadoresRafagaRef = useRef<NodeJS.Timeout[]>([]);

  // Anclaje instantáneo sin animación para situarse en el último mensaje
  const bajarAlFondoInstantaneo = useCallback((forzar = false) => {
    const contenedor = contenedorMensajesRef.current;
    if (!contenedor) return;
    if (forzar || debeSeguirFondoRef.current) {
      contenedor.scrollTop = contenedor.scrollHeight;
    }
  }, []);

  // Rastrear si el usuario se desplaza manualmente hacia arriba para leer el historial
  const manejarScrollContenedor = useCallback(() => {
    const contenedor = contenedorMensajesRef.current;
    if (!contenedor) return;
    const distanciaAlFondo = contenedor.scrollHeight - contenedor.scrollTop - contenedor.clientHeight;
    // Si está a 80px o menos del final, seguimos anclando al fondo automáticamente
    if (distanciaAlFondo <= 80) {
      debeSeguirFondoRef.current = true;
    } else {
      // El usuario subió intencionalmente a leer mensajes antiguos
      debeSeguirFondoRef.current = false;
    }
  }, []);

  // Procesar mensajes para asociar reacciones y eliminar burbujas [reaction] sueltas
  const mensajesProcesados = useMemo(() => {
    return procesarMensajesConReacciones(mensajes);
  }, [mensajes]);

  // Observador de cambios de tamaño: cuando las imágenes terminan de cargar, decodificarse o expandirse,
  // reajusta inmediatamente la posición al fondo si el usuario debe estar en el último mensaje
  useEffect(() => {
    const contenedor = contenedorMensajesRef.current;
    if (!contenedor || typeof ResizeObserver === 'undefined') return;

    let rafId: number | null = null;
    const observador = new ResizeObserver(() => {
      if (debeSeguirFondoRef.current) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          if (contenedor && debeSeguirFondoRef.current) {
            contenedor.scrollTop = contenedor.scrollHeight;
          }
        });
      }
    });

    observador.observe(contenedor);
    Array.from(contenedor.children).forEach((hijo) => {
      observador.observe(hijo);
    });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      observador.disconnect();
    };
  }, [mensajesProcesados.length]);

  // Cargar catálogo de plantillas como respaldo para resolución instantánea de plantillas
  useEffect(() => {
    let activo = true;
    obtenerPlantillasYCuota()
      .then((res) => {
        if (activo && res?.plantillas && Array.isArray(res.plantillas)) {
          setCatalogoPlantillas(res.plantillas);
        }
      })
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, []);

  // Sincronizar estado de IA del chat actual
  useEffect(() => {
    if (conversacion) {
      const activa = conversacion.ia_activa !== false && !conversacion.ia_pausada_por_humano;
      setIaChatActiva(activa);
    }
  }, [conversacion?.id, conversacion?.ia_activa, conversacion?.ia_pausada_por_humano]);

  const manejarResolverUrgencia = async () => {
    if (!conversacion?.id || resolviendoUrgencia) return;
    setResolviendoUrgencia(true);
    setUrgenciaAtendidaId(conversacion.id);
    try {
      await resolverUrgenciaAsesorHumano(conversacion.id);
      if (alResolverUrgencia) {
        await alResolverUrgencia(conversacion.id);
      }
    } catch (e) {
      console.error('Error al resolver urgencia:', e);
      setUrgenciaAtendidaId(null);
    } finally {
      setResolviendoUrgencia(false);
    }
  };

  const manejarToggleIA = async () => {
    if (!conversacion?.id || cambiandoEstadoIA) return;
    if (iaGlobalActiva === false) {
      alert('El Agente IA está apagado globalmente en la sección de Configuración. Debes activarlo allí primero.');
      return;
    }
    const nuevoEstado = !iaChatActiva;
    setCambiandoEstadoIA(true);
    try {
      const res = await alternarIAChatApi(conversacion.id, nuevoEstado);
      if (res.exito) {
        setIaChatActiva(nuevoEstado);
      }
    } catch (e) {
      console.error('Error al alternar IA en chat:', e);
    } finally {
      setCambiandoEstadoIA(false);
    }
  };

  const obtenerPlantillaPorTexto = (texto?: string | null): PlantillaWhatsApp | null => {
    if (!texto) return null;
    const match = texto.match(/\[Template:\s*([a-zA-Z0-9_-]+)\]/i);
    if (!match) return null;
    const nombreBuscado = match[1].toLowerCase().trim();
    return catalogoPlantillas.find((p) => (p.nombre || '').toLowerCase().trim() === nombreBuscado) || null;
  };

  const esPaciente = Boolean(
    paciente?.es_paciente ||
    (paciente?.cedula || paciente?.documento) ||
    (paciente?.total_formulas && paciente.total_formulas > 0) ||
    (paciente?.total_citas && paciente.total_citas > 0)
  );

  // Temporizador determinista para silenciar el desplazamiento visual durante la transición inicial
  useEffect(() => {
    if (!conversacion?.id) {
      setPreparandoChat(false);
      return;
    }
    setPreparandoChat(true);
    const temporizador = setTimeout(() => {
      setPreparandoChat(false);
    }, 180);
    return () => clearTimeout(temporizador);
  }, [conversacion?.id]);

  // Posicionar de inmediato al fondo (0ms) sin mostrar el desplazamiento hacia abajo
  useLayoutEffect(() => {
    const contenedor = contenedorMensajesRef.current;
    if (!contenedor) return;

    // Limpiar temporizadores de ráfagas anteriores si el usuario cambia rápidamente de chat
    temporizadoresRafagaRef.current.forEach((t) => clearTimeout(t));
    temporizadoresRafagaRef.current = [];

    const idActual = conversacion?.id ?? null;
    const esCambioDeConversacion = idActual !== idConversacionPrevia.current;
    const esPrimerCargueMensajes = longitudMensajesPrevia.current === 0 && mensajesProcesados.length > 0;

    if (esCambioDeConversacion) {
      idConversacionPrevia.current = idActual;
      longitudMensajesPrevia.current = mensajesProcesados.length;
      debeSeguirFondoRef.current = true;

      // Posicionamiento inmediato previo al primer frame
      contenedor.scrollTop = contenedor.scrollHeight;

      // Ráfaga defensiva de fijación para compensar la carga asíncrona de imágenes y medios
      const t1 = setTimeout(() => { if (contenedor && debeSeguirFondoRef.current) contenedor.scrollTop = contenedor.scrollHeight; }, 30);
      const t2 = setTimeout(() => { if (contenedor && debeSeguirFondoRef.current) contenedor.scrollTop = contenedor.scrollHeight; }, 90);
      const t3 = setTimeout(() => { if (contenedor && debeSeguirFondoRef.current) contenedor.scrollTop = contenedor.scrollHeight; }, 180);

      temporizadoresRafagaRef.current = [t1, t2, t3];

      return () => {
        temporizadoresRafagaRef.current.forEach((t) => clearTimeout(t));
      };
    } else if (esPrimerCargueMensajes) {
      longitudMensajesPrevia.current = mensajesProcesados.length;
      debeSeguirFondoRef.current = true;
      contenedor.scrollTop = contenedor.scrollHeight;
      setPreparandoChat(false);
      setAnimandoTransicion(true);

      const t1 = setTimeout(() => { if (contenedor && debeSeguirFondoRef.current) contenedor.scrollTop = contenedor.scrollHeight; }, 40);
      const t2 = setTimeout(() => {
        if (contenedor && debeSeguirFondoRef.current) contenedor.scrollTop = contenedor.scrollHeight;
        setAnimandoTransicion(false);
      }, 200);

      temporizadoresRafagaRef.current = [t1, t2];

      return () => {
        temporizadoresRafagaRef.current.forEach((t) => clearTimeout(t));
      };
    } else if (mensajesProcesados.length !== longitudMensajesPrevia.current) {
      longitudMensajesPrevia.current = mensajesProcesados.length;
      if (debeSeguirFondoRef.current) {
        // Posicionar al instante sin animación molesta de desplazamiento
        contenedor.scrollTop = contenedor.scrollHeight;
      }
    }
  }, [mensajesProcesados.length, conversacion?.id]);

  const enVentana24h = conversacion?.ultimo_mensaje_entrante_en
    ? (Date.now() - new Date(conversacion.ultimo_mensaje_entrante_en).getTime()) < 24 * 60 * 60 * 1000
    : false;

  const iniciales = (conversacion?.contacto_nombre || 'PA').substring(0, 2).toUpperCase();

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    const texto = textoMensaje.trim();
    if (!texto) return;
    if (conversacion?.id && conversacion.requiere_asesor_humano) {
      setUrgenciaAtendidaId(conversacion.id);
    }
    setTextoMensaje('');
    await alEnviarMensaje(texto);
  };

  // Si no hay conversación seleccionada, renderizar un estado vacío limpio y corporativo
  if (!conversacion) {
    return (
      <div className="columna-chat-conversacion vacia">
        <div className="chat-estado-vacio-centro">
          <div className="chat-icono-vacio-globo">
            <MessageSquare style={{ width: '38px', height: '38px', color: 'var(--color-primario-claro)' }} />
          </div>
          <h3 className="chat-vacio-titulo">Bandeja de Conversaciones</h3>
          <p className="chat-vacio-descripcion">
            Selecciona una conversación del listado izquierdo para responder mensajes o consultar la ficha clínica del paciente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="columna-chat-conversacion">
      {/* Cabecera del chat activa */}
      <div className="cabecera-chat-activa">
        <div className="chat-paciente-detalle">
          <div className="avatar-contacto" id="chat-activo-avatar">{iniciales}</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <strong id="chat-activo-nombre" style={{ fontSize: '0.95rem', color: 'var(--texto-principal)' }}>
                {conversacion?.contacto_nombre || 'Seleccione un chat'}
              </strong>
              {conversacion && <CheckCircle2 style={{ width: '14px', height: '14px', color: 'var(--color-primario)' }} />}
            </div>
            <div className="chat-telefono-visible">
              <Phone style={{ width: '13px', height: '13px' }} />
              <span id="chat-activo-telefono">{conversacion?.contacto_telefono ? formatearTelefono(conversacion.contacto_telefono) : '--'}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {!enVentana24h && (
            <div id="chat-activo-badge-24h" className="badge-24h expirada">
              <AlertTriangle style={{ width: '12px', height: '12px' }} />
              <span>Ventana 24h Expirada</span>
            </div>
          )}

          {/* Botón de Control Toggle del Agente IA en este chat */}
          {conversacion && (
            iaGlobalActiva === false ? (
              <EtiquetaTooltip
                texto="El Agente IA está apagado globalmente en Configuración. Actívalo en Configuración para poder usarlo en chats individuales."
                posicion="abajo"
              >
                <button
                  id="btn-chat-toggle-ia"
                  type="button"
                  disabled={true}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.35rem 0.68rem',
                    borderRadius: '16px',
                    border: '1px dashed var(--borde-tarjeta, #cbd5e1)',
                    background: 'var(--fondo-tarjeta, rgba(0, 0, 0, 0.02))',
                    color: 'var(--texto-atenuado, #94a3b8)',
                    fontSize: '0.73rem',
                    fontWeight: 600,
                    cursor: 'not-allowed',
                    opacity: 0.6,
                    transition: 'all 0.15s ease',
                    boxShadow: 'none',
                  }}
                >
                  <Bot style={{ width: '13px', height: '13px', color: 'var(--texto-atenuado)' }} />
                  <span>IA Apagada</span>
                </button>
              </EtiquetaTooltip>
            ) : (
              <EtiquetaTooltip
                texto={
                  iaChatActiva
                    ? 'Agente IA respondiendo este chat automáticamente. Haz clic para pausar y tomar control humano.'
                    : 'Control humano activo (IA pausada en este chat). Haz clic para reactivar las respuestas del Agente IA.'
                }
                posicion="abajo"
              >
                <button
                  id="btn-chat-toggle-ia"
                  type="button"
                  onClick={manejarToggleIA}
                  disabled={cambiandoEstadoIA}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.35rem 0.68rem',
                    borderRadius: '16px',
                    border: iaChatActiva ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid var(--borde-tarjeta)',
                    background: iaChatActiva ? 'rgba(16, 185, 129, 0.12)' : 'var(--fondo-tarjeta)',
                    color: iaChatActiva ? '#10b981' : 'var(--texto-atenuado)',
                    fontSize: '0.73rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: 'var(--sombra-sm)',
                  }}
                >
                  <Bot style={{ width: '13px', height: '13px', color: iaChatActiva ? '#10b981' : 'var(--texto-atenuado)' }} />
                  <span>{iaChatActiva ? 'IA Activa' : 'Control Humano'}</span>
                </button>
              </EtiquetaTooltip>
            )
          )}

          {/* Botón para Registrar como Paciente al lado izquierdo de Ver Ficha Clínica */}
          {conversacion && alRegistrarPaciente && (
            <EtiquetaTooltip
              texto={esPaciente ? 'Editar datos del paciente registrado' : 'Registrar a esta persona como paciente clínico'}
              posicion="abajo"
            >
              <button
                id="btn-chat-registrar-paciente"
                type="button"
                className={`btn-chat-registrar-paciente ${esPaciente ? 'es-paciente' : ''}`}
                onClick={alRegistrarPaciente}
              >
                {esPaciente ? (
                  <>
                    <UserCheck style={{ width: '13px', height: '13px' }} />
                    <span id="texto-btn-paciente">Paciente</span>
                  </>
                ) : (
                  <>
                    <UserPlus style={{ width: '13px', height: '13px' }} />
                    <span id="texto-btn-paciente">Registrar Paciente</span>
                  </>
                )}
              </button>
            </EtiquetaTooltip>
          )}

          {/* Botón Ver Ficha Clínica (solo visible cuando la ficha está cerrada) */}
          {!fichaAbierta && (
            <EtiquetaTooltip texto="Mostrar ficha optométrica del paciente" posicion="abajo">
              <button
                id="btn-toggle-ficha"
                type="button"
                className="btn-toggle-ficha"
                onClick={alAbrirFicha}
              >
                <ClipboardList style={{ width: '13px', height: '13px' }} />
                <span id="texto-btn-ficha">Ver Ficha Clínica</span>
              </button>
            </EtiquetaTooltip>
          )}
        </div>
      </div>

      {/* Banner Alerta 24h si está expirada */}
      {!enVentana24h && conversacion && (
        <div id="banner-alerta-24h" className="banner-ventana-24h-alerta" style={{ display: 'flex' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle style={{ width: '15px', height: '15px' }} />
            <span><strong>Ventana de 24h inactiva:</strong> Para reanudar el chat debe enviar una plantilla preaprobada.</span>
          </div>
          <button
            type="button"
            className="btn-primario-optica"
            style={{ padding: '0.25rem 0.65rem', fontSize: '0.72rem' }}
            onClick={() => setModalAlerta24hAbierto(true)}
          >
            Reactivar con Plantilla
          </button>
        </div>
      )}

      {/* Banner de Urgencia / Requiere Asesor Humano */}
      {conversacion?.requiere_asesor_humano && urgenciaAtendidaId !== conversacion?.id && (
        <div
          id="banner-requiere-asesor"
          style={{
            background: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)',
            color: '#ffffff',
            padding: '0.65rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)',
            flexShrink: 0,
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertTriangle style={{ width: '16px', height: '16px', color: '#ffffff' }} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.2 }}>
                Requiere Atención de Asesor Humano
              </div>
              <div style={{ fontSize: '0.73rem', opacity: 0.92, marginTop: '2px' }}>
                El paciente solicitó hablar con un asesor o la IA transfirió la conversación.
              </div>
            </div>
          </div>
          <button
            id="btn-resolver-urgencia-chat"
            type="button"
            onClick={manejarResolverUrgencia}
            disabled={resolviendoUrgencia}
            style={{
              background: '#ffffff',
              color: '#dc2626',
              border: 'none',
              padding: '0.35rem 0.8rem',
              borderRadius: '16px',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: resolviendoUrgencia ? 'wait' : 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              transition: 'all 0.15s ease',
            }}
          >
            {resolviendoUrgencia ? 'Marcando...' : 'Marcar como Atendido'}
          </button>
        </div>
      )}

      {/* Área de Burbujas de Mensajes con transición fluida */}
      <div
        id="contenedor-mensajes-chat"
        className={`area-mensajes-burbujas ${animandoTransicion ? 'animando-transicion' : ''}`}
        ref={contenedorMensajesRef}
        onScroll={manejarScrollContenedor}
        style={{
          opacity: preparandoChat ? 0 : 1,
          transition: 'opacity 0.15s ease',
        }}
      >
        {cargandoMensajes && mensajesProcesados.length === 0 ? (
          <div className="esqueleto-chat-mensajes" id="esqueleto-cargando-chat">
            <div className="esqueleto-burbuja entrante" />
            <div className="esqueleto-burbuja saliente" />
            <div className="esqueleto-burbuja entrante" />
          </div>
        ) : mensajesProcesados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--texto-atenuado)', fontSize: '0.8rem' }}>
            No hay mensajes registrados en esta conversación.
          </div>
        ) : (
          mensajesProcesados.map((m, index) => {
            const esSaliente = m.direccion === 'saliente';
            const hora = m.creado_en ? new Date(m.creado_en).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const tick = esSaliente ? ' ✓✓' : '';

            const fechaActual = m.creado_en ? new Date(m.creado_en).toDateString() : '';
            const fechaAnterior = index > 0 && mensajesProcesados[index - 1].creado_en ? new Date(mensajesProcesados[index - 1].creado_en!).toDateString() : '';
            const mostrarSeparador = fechaActual !== '' && fechaActual !== fechaAnterior;
            const tieneReacciones = Boolean(m.reacciones && m.reacciones.length > 0);

            return (
              <React.Fragment key={m.id}>
                {mostrarSeparador && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    margin: '14px 0 8px 0',
                    width: '100%',
                  }}>
                    <span style={{
                      background: 'var(--fondo-tarjeta)',
                      color: 'var(--texto-atenuado)',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      padding: '3px 12px',
                      borderRadius: '12px',
                      border: '1px solid var(--borde-tarjeta)',
                      boxShadow: 'var(--sombra-sm)',
                    }}>
                      {formatearSeparadorFecha(m.creado_en)}
                    </span>
                  </div>
                )}
                {(() => {
                  const plantilla = m.plantilla || obtenerPlantillaPorTexto(m.texto);
                  const coincideTemplate = (m.texto || '').match(/\[Template:\s*([a-zA-Z0-9_-]+)\]/i);
                  const esMensajePlantilla = Boolean(plantilla || coincideTemplate);

                  if (esMensajePlantilla) {
                    const nombreFallback = coincideTemplate ? coincideTemplate[1].replace(/_/g, ' ') : 'Plantilla WhatsApp';
                    const botones = plantilla?.botones && Array.isArray(plantilla.botones) ? plantilla.botones : [];

                    return (
                      <div
                        className={`burbuja-mensaje ${esSaliente ? 'saliente' : 'entrante'}`}
                        style={{
                          minWidth: '220px',
                          maxWidth: '340px',
                          ...(tieneReacciones ? { marginBottom: '0.95rem' } : {}),
                        }}
                      >
                        {/* 1. Encabezado Multimedia o de Texto */}
                        {(() => {
                          const urlImgEncabezado = (plantilla?.encabezado_tipo === 'IMAGEN' ? (plantilla.encabezado_contenido || m.url_adjunto) : null) || (m.url_adjunto && !plantilla ? m.url_adjunto : null);
                          if (!urlImgEncabezado) return null;
                          const urlResuelta = resolverUrlMediaProxy(urlImgEncabezado);
                          return (
                            <div style={{
                              margin: '-0.5rem -0.8rem 0.5rem -0.8rem',
                              borderRadius: '8px 8px 0 0',
                              overflow: 'hidden',
                              maxHeight: '220px',
                              background: esSaliente ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.05)',
                            }}>
                              <img
                                src={urlResuelta}
                                alt="Encabezado de plantilla"
                                style={{
                                  width: '100%',
                                  height: 'auto',
                                  maxHeight: '220px',
                                  objectFit: 'cover',
                                  display: 'block',
                                  cursor: 'pointer',
                                }}
                                onLoad={() => {
                                  if (debeSeguirFondoRef.current) {
                                    bajarAlFondoInstantaneo();
                                  }
                                }}
                                onClick={() => setImagenAmpliadaUrl(urlResuelta)}
                              />
                            </div>
                          );
                        })()}

                        {plantilla?.encabezado_tipo === 'VIDEO' && plantilla.encabezado_contenido && (
                          <div style={{
                            margin: '-0.5rem -0.8rem 0.5rem -0.8rem',
                            borderRadius: '8px 8px 0 0',
                            overflow: 'hidden',
                          }}>
                            <video
                              src={plantilla.encabezado_contenido}
                              controls
                              style={{ width: '100%', maxHeight: '220px', display: 'block' }}
                            />
                          </div>
                        )}

                        {plantilla?.encabezado_tipo === 'TEXTO' && plantilla.encabezado_contenido && (
                          <div style={{
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            marginBottom: '0.35rem',
                            lineHeight: 1.35,
                          }}>
                            {plantilla.encabezado_contenido}
                          </div>
                        )}

                        {/* 2. Cuerpo del Mensaje */}
                        <div className="burbuja-cuerpo-texto">
                          {formatearTextoWhatsApp(plantilla?.cuerpo || (coincideTemplate ? `Plantilla: ${nombreFallback}` : m.texto || ''))}
                        </div>

                        {/* 3. Pie de página (Footer de WhatsApp) */}
                        {plantilla?.pie && (
                          <div style={{
                            fontSize: '0.7rem',
                            opacity: esSaliente ? 0.78 : 0.65,
                            marginTop: '0.35rem',
                            fontStyle: 'italic',
                          }}>
                            {plantilla.pie}
                          </div>
                        )}

                        {/* 4. Hora y Checkmarks */}
                        <div className="burbuja-hora">
                          {esSaliente && Boolean(m.enviado_por_ia) && (
                            <span title="Mensaje generado y enviado automáticamente por el Agente IA" style={{ display: 'inline-flex', alignItems: 'center', marginRight: '3px' }}>
                              <Bot size={11} style={{ opacity: 0.95, color: '#67e8f9' }} />
                            </span>
                          )}
                          <span>{hora}</span>
                          {esSaliente && (
                            <IndicadorEstadoEntrega
                              estado={m.estado_entrega}
                              esTemporal={m.id_mensaje_plataforma?.startsWith('temp_')}
                            />
                          )}
                        </div>
                        {esSaliente && ((m.estado_entrega as string) === 'fallido' || (m.estado_entrega as string) === 'failed') && (
                          <div style={{
                            fontSize: '0.66rem',
                            color: '#ffcaca',
                            marginTop: '0.25rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 500,
                          }}>
                            <AlertCircle size={11} style={{ flexShrink: 0 }} />
                            <span>No entregado (Ventana 24h cerrada)</span>
                          </div>
                        )}

                        {/* 5. Botones de Acción de Plantilla WhatsApp */}
                        {botones.length > 0 && (
                          <div style={{
                            margin: '0.45rem -0.8rem -0.5rem -0.8rem',
                            borderTop: esSaliente ? '1px solid rgba(255, 255, 255, 0.22)' : '1px solid var(--borde-tarjeta)',
                            display: 'flex',
                            flexDirection: 'column',
                          }}>
                            {botones.map((btn, bIdx) => {
                              const tipoBoton = (btn.tipo || '').toUpperCase();
                              const esUrl = tipoBoton === 'URL' && btn.url;
                              const esTel = (tipoBoton === 'PHONE_NUMBER' || tipoBoton === 'TELEFONO') && btn.telefono;
                              const esQuickReply = tipoBoton === 'QUICK_REPLY';

                              return (
                                <div
                                  key={bIdx}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.4rem',
                                    padding: '0.45rem 0.75rem',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                    borderTop: bIdx > 0 ? (esSaliente ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--borde-tarjeta)') : 'none',
                                    color: esSaliente ? '#ffffff' : 'var(--color-primario)',
                                    background: esSaliente ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                    cursor: esUrl || esTel ? 'pointer' : 'default',
                                    userSelect: 'none',
                                    textAlign: 'center',
                                  }}
                                  onClick={() => {
                                    if (esUrl) window.open(btn.url, '_blank');
                                    if (esTel) window.open(`tel:${btn.telefono}`, '_self');
                                  }}
                                >
                                  {esQuickReply && <CornerDownLeft size={13} style={{ opacity: 0.9 }} />}
                                  {esUrl && <ExternalLink size={13} style={{ opacity: 0.9 }} />}
                                  {esTel && <Phone size={13} style={{ opacity: 0.9 }} />}
                                  {(tipoBoton === 'COPY_CODE' || tipoBoton === 'CODIGO') && <Copy size={13} style={{ opacity: 0.9 }} />}
                                  <span>{btn.texto}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* 6. Píldora de Reacciones flotante (WhatsApp Web) */}
                        {tieneReacciones && (
                          <div
                            className={`burbuja-reaccion-pildora ${esSaliente ? 'saliente' : 'entrante'}`}
                            title={`Reacción de WhatsApp: ${m.reacciones!.map((r) => r.emoji).join(' ')}`}
                          >
                            {m.reacciones!.map((r, rIdx) => (
                              <span key={rIdx}>{r.emoji}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  const esFallido = esSaliente && ((m.estado_entrega as string) === 'fallido' || (m.estado_entrega as string) === 'failed');

                  // Omitir eventos vacíos no soportados de Meta Cloud API
                  if (m.texto === '[Unsupported message]' && !m.url_adjunto) {
                    return null;
                  }

                  const tieneAdjunto = Boolean(m.url_adjunto);
                  const tipoAdj = (m.tipo_contenido || '').toLowerCase();
                  const urlAdj = resolverUrlMediaProxy(m.url_adjunto);

                  const esVideo = tieneAdjunto && (tipoAdj.includes('video') || urlAdj.match(/\.(mp4|webm|mov|m4v)/i));
                  const esAudio = tieneAdjunto && (tipoAdj.includes('audio') || urlAdj.match(/\.(ogg|mp3|wav|m4a)/i));
                  const esDoc = tieneAdjunto && (tipoAdj.includes('document') || tipoAdj.includes('documento') || tipoAdj.includes('pdf') || urlAdj.match(/\.(pdf|docx?|xlsx?)/i));
                  const esImagen = tieneAdjunto && !esVideo && !esAudio && !esDoc;

                  const tieneTexto = Boolean(m.texto && m.texto.trim() !== '' && m.texto !== '[Unsupported message]');

                  return (
                    <div
                      className={`burbuja-mensaje ${esSaliente ? 'saliente' : 'entrante'} ${esFallido ? 'mensaje-fallido' : ''}`}
                      style={{
                        ...(tieneAdjunto ? { padding: '0.35rem 0.4rem 0.45rem 0.4rem', minWidth: '180px', maxWidth: '340px' } : {}),
                        ...(tieneReacciones ? { marginBottom: '0.95rem' } : {}),
                      }}
                    >
                      {/* 1. Elemento Multimedia */}
                      {tieneAdjunto && (
                        <div style={{ marginBottom: tieneTexto ? '0.35rem' : '0' }}>
                          {esImagen && (
                            <ElementoImagenChat
                              url={urlAdj}
                              esSaliente={esSaliente}
                              alHacerClic={() => setImagenAmpliadaUrl(urlAdj)}
                              alCambiarDimension={() => {
                                if (debeSeguirFondoRef.current) {
                                  bajarAlFondoInstantaneo();
                                }
                              }}
                            />
                          )}

                          {esVideo && (
                            <div style={{ borderRadius: '8px', overflow: 'hidden', maxHeight: '340px' }}>
                              <video
                                src={urlAdj}
                                controls
                                playsInline
                                preload="metadata"
                                style={{ width: '100%', maxHeight: '340px', display: 'block', borderRadius: '8px' }}
                              />
                            </div>
                          )}

                          {esAudio && (
                            <div style={{ padding: '0.2rem' }}>
                              <audio src={urlAdj} controls style={{ width: '100%', height: '36px' }} />
                            </div>
                          )}

                          {esDoc && (
                            <a
                              href={urlAdj}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.55rem',
                                padding: '0.5rem 0.65rem',
                                borderRadius: '6px',
                                background: esSaliente ? 'rgba(255, 255, 255, 0.15)' : 'var(--fondo-elevado)',
                                color: 'inherit',
                                textDecoration: 'none',
                              }}
                            >
                              <FileText size={20} style={{ color: esSaliente ? '#ffffff' : 'var(--color-primario)' }} />
                              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <span style={{ fontSize: '0.76rem', fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                  Documento adjunto
                                </span>
                                <span style={{ fontSize: '0.66rem', opacity: 0.75 }}>Clic para abrir</span>
                              </div>
                            </a>
                          )}
                        </div>
                      )}

                      {/* 2. Cuerpo del Mensaje (Pie de foto o texto estándar) */}
                      {tieneTexto && (
                        <div
                          className="burbuja-cuerpo-texto"
                          style={tieneAdjunto ? { padding: '0 0.35rem 0.1rem 0.35rem' } : undefined}
                        >
                          {formatearTextoWhatsApp(m.texto!)}
                        </div>
                      )}

                      {/* 3. Hora y Estado de Entrega */}
                      <div
                        className="burbuja-hora"
                        style={
                          !tieneTexto && tieneAdjunto
                            ? {
                                position: 'absolute',
                                right: '8px',
                                bottom: '8px',
                                background: 'rgba(0, 0, 0, 0.48)',
                                color: '#ffffff',
                                padding: '1px 6px',
                                borderRadius: '10px',
                                fontSize: '0.64rem',
                                lineHeight: 1.2,
                              }
                            : undefined
                        }
                      >
                        {esSaliente && Boolean(m.enviado_por_ia) && (
                          <span title="Mensaje generado y enviado automáticamente por el Agente IA" style={{ display: 'inline-flex', alignItems: 'center', marginRight: '3px' }}>
                            <Bot size={11} style={{ opacity: 0.95, color: (!tieneTexto && tieneAdjunto) ? '#a5f3fc' : '#67e8f9' }} />
                          </span>
                        )}
                        <span>{hora}</span>
                        {esSaliente && (
                          <IndicadorEstadoEntrega
                            estado={m.estado_entrega}
                            esTemporal={m.id_mensaje_plataforma?.startsWith('temp_')}
                          />
                        )}
                      </div>

                      {/* 4. Notificación de Entrega Fallida */}
                      {esFallido && (
                        <div style={{
                          fontSize: '0.66rem',
                          color: '#ffcaca',
                          marginTop: '0.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 500,
                        }}>
                          <AlertCircle size={11} style={{ flexShrink: 0 }} />
                          <span>No entregado (Ventana 24h cerrada)</span>
                        </div>
                      )}

                      {/* 5. Píldora de Reacciones flotante (WhatsApp Web) */}
                      {tieneReacciones && (
                        <div
                          className={`burbuja-reaccion-pildora ${esSaliente ? 'saliente' : 'entrante'}`}
                          title={`Reacción de WhatsApp: ${m.reacciones!.map((r) => r.emoji).join(' ')}`}
                        >
                          {m.reacciones!.map((r, rIdx) => (
                            <span key={rIdx}>{r.emoji}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Input para enviar mensaje */}
      <form className="area-envio-mensaje" onSubmit={manejarEnvio}>
        <input
          type="text"
          id="input-mensaje-texto"
          placeholder={enVentana24h ? "Escribe un mensaje al paciente..." : "Ventana de 24h cerrada. Utiliza 'Reactivar con Plantilla'..."}
          autoComplete="off"
          value={textoMensaje}
          disabled={!enVentana24h}
          onChange={(e) => setTextoMensaje(e.target.value)}
        />
        <EtiquetaTooltip
          texto={
            !enVentana24h
              ? 'Ventana de 24h inactiva'
              : !textoMensaje.trim()
              ? 'Escribe un mensaje para enviar'
              : 'Enviar mensaje (Enter)'
          }
          posicion="arriba"
        >
          <button
            type="submit"
            className="btn-enviar-accion"
            disabled={!enVentana24h || !textoMensaje.trim()}
          >
            <Send style={{ width: '15px', height: '15px' }} />
          </button>
        </EtiquetaTooltip>
      </form>

      {/* Modal de Reactivación con Plantilla Aprobada */}
      <ModalAlertaVentana24h
        abierto={modalAlerta24hAbierto}
        alCerrar={() => setModalAlerta24hAbierto(false)}
        titulo="Reactivar Conversación de WhatsApp"
        subtitulo="Ventana de 24h Expirada"
        nombrePaciente={conversacion?.contacto_nombre || undefined}
        plantillasDisponibles={catalogoPlantillas}
        alReactivarPlantilla={alReactivarConPlantilla}
        accionTexto="Reactivar Chat con Plantilla"
      />

      {/* Visor Lightbox de Imagen Ampliada en Pantalla Completa */}
      {imagenAmpliadaUrl && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            animation: 'fadeIn 0.18s ease-out',
          }}
          onClick={() => setImagenAmpliadaUrl(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.6rem',
                marginBottom: '0.6rem',
              }}
            >
              <a
                href={resolverUrlMediaProxy(imagenAmpliadaUrl)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: 'rgba(255, 255, 255, 0.18)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#ffffff',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <ExternalLink size={13} />
                <span>Abrir Original</span>
              </a>
              <button
                type="button"
                onClick={() => setImagenAmpliadaUrl(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  color: '#ffffff',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  backdropFilter: 'blur(4px)',
                }}
                aria-label="Cerrar visor"
              >
                <X size={16} />
              </button>
            </div>
            <img
              src={resolverUrlMediaProxy(imagenAmpliadaUrl)}
              alt="Imagen de WhatsApp ampliada"
              style={{
                maxWidth: '92vw',
                maxHeight: '84vh',
                objectFit: 'contain',
                borderRadius: '10px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
