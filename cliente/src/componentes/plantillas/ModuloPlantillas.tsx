'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MessageSquare,
  Plus,
  Send,
  CheckCircle2,
  Clock,
  Sparkles,
  Search,
  Filter,
  Users,
  Calendar,
  AlertTriangle,
  History,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Layers,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  Check,
  Trash2,
} from 'lucide-react';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';
import { SelectorDesplegable } from '../comunes/SelectorDesplegable';
import { FiltroBusqueda } from '../comunes/FiltroBusqueda';
import { BarraPestanas, ElementoPestana } from '../comunes/BarraPestanas';
import { BarraPaginacionTabla } from '../comunes/BarraPaginacionTabla';
import { BurbujaWhatsApp } from './BurbujaWhatsApp';
import { ModalCrearPlantilla } from './ModalCrearPlantilla';
import { ModalLanzarLote } from './ModalLanzarLote';
import {
  obtenerPlantillasYCuota,
  obtenerHistorialLotesApi,
  eliminarLoteApi,
  obtenerSegmentos,
  sincronizarPlantillasConMetaApi,
} from '@/servicios/api_crm';
import type {
  PlantillaWhatsApp,
  CuotaDiariaWhatsApp,
  CampanaEnvioHistorial,
  Segmento,
} from '@/tipos/crm';

interface PropiedadesModuloPlantillas {
  segmentoInicial?: Segmento | null;
  alSeleccionarContactoChat?: (contactoId: number) => void;
  nombreOptica?: string;
  opticaId?: number;
}

export const ModuloPlantillas: React.FC<PropiedadesModuloPlantillas> = ({
  segmentoInicial = null,
  nombreOptica,
  opticaId,
}) => {
  // Pestañas activas: 'biblioteca' | 'historial'
  const [pestanaActiva, setPestanaActiva] = useState<'biblioteca' | 'historial'>('biblioteca');

  // Plantilla seleccionada para previsualización fija en panel derecho
  const [idPlantillaSeleccionada, setIdPlantillaSeleccionada] = useState<number | null>(null);

  // Estados de datos
  const [plantillas, setPlantillas] = useState<PlantillaWhatsApp[]>([]);
  const [cuota, setCuota] = useState<CuotaDiariaWhatsApp | null>(null);
  const [historialLotes, setHistorialLotes] = useState<CampanaEnvioHistorial[]>([]);
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);

  // Estados de carga
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [sincronizandoMeta, setSincronizandoMeta] = useState(false);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [mensajeNotificacion, setMensajeNotificacion] = useState<{
    tipo: 'exito' | 'error' | 'info';
    texto: string;
  } | null>(null);

  // Filtros de búsqueda
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS');
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');

  // Modales
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [modalLanzarAbierto, setModalLanzarAbierto] = useState(false);
  const [plantillaSeleccionadaLanzar, setPlantillaSeleccionadaLanzar] = useState<PlantillaWhatsApp | null>(null);
  const [segmentoPreseleccionadoId, setSegmentoPreseleccionadoId] = useState<number | null>(
    segmentoInicial ? segmentoInicial.id : null
  );

  // Configuración de pestañas con componente estandarizado BarraPestanas
  const pestanasModulo = useMemo<ElementoPestana<'biblioteca' | 'historial'>[]>(
    () => [
      {
        id: 'biblioteca',
        etiqueta: 'Plantillas',
        icono: MessageSquare,
        conteo: plantillas.length,
      },
      {
        id: 'historial',
        etiqueta: 'Historial de Envíos',
        icono: History,
        conteo: historialLotes.length,
      },
    ],
    [plantillas.length, historialLotes.length]
  );

  // Estados de paginación para la tabla de Historial de Envíos (por defecto 5 registros)
  const [paginaActualHistorial, setPaginaActualHistorial] = useState<number>(1);
  const [limitePorPaginaHistorial, setLimitePorPaginaHistorial] = useState<number>(5);

  // Segmentación por páginas de lotes de envío
  const totalHistorialRegistros = historialLotes.length;
  const historialLotesPaginados = useMemo(() => {
    const inicio = (paginaActualHistorial - 1) * limitePorPaginaHistorial;
    return historialLotes.slice(inicio, inicio + limitePorPaginaHistorial);
  }, [historialLotes, paginaActualHistorial, limitePorPaginaHistorial]);

  // Validar límites de página si cambia la cantidad total o el selector de límite
  useEffect(() => {
    const maxPaginas = Math.max(1, Math.ceil(historialLotes.length / limitePorPaginaHistorial));
    if (paginaActualHistorial > maxPaginas) {
      setPaginaActualHistorial(1);
    }
  }, [historialLotes.length, limitePorPaginaHistorial, paginaActualHistorial]);

  // Cargar datos principales
  const cargarDatosPrincipales = useCallback(async () => {
    setCargandoDatos(true);
    try {
      const [resPlantillas, resSegmentos] = await Promise.all([
        obtenerPlantillasYCuota(),
        obtenerSegmentos(),
      ]);

      setPlantillas(resPlantillas.plantillas || []);
      setCuota(resPlantillas.cuota || null);
      setSegmentos(resSegmentos.segmentos || []);
    } catch (error) {
      console.error('Error al cargar datos del módulo de plantillas:', error);
      mostrarNotificacion('error', 'No se pudieron sincronizar las plantillas y la cuota diaria.');
    } finally {
      setCargandoDatos(false);
    }
  }, []);

  // Sincronizar explícitamente con el canal oficial vía backend
  const manejarSincronizarConMeta = async () => {
    setSincronizandoMeta(true);
    const tiempoInicio = Date.now();
    try {
      const res = await sincronizarPlantillasConMetaApi();
      // Garantizar que la animación de giro sea claramente visible al menos 750ms
      const transcurrido = Date.now() - tiempoInicio;
      if (transcurrido < 750) {
        await new Promise((resolve) => setTimeout(resolve, 750 - transcurrido));
      }
      if (res.exito) {
        if (res.plantillas) setPlantillas(res.plantillas);
        if (res.cuota) setCuota(res.cuota);
        mostrarNotificacion(
          'exito',
          `Sincronización exitosa: ${res.total_sincronizadas || 0} plantillas oficiales actualizadas.`
        );
      } else {
        mostrarNotificacion('error', res.error || 'No se pudo conectar con el canal oficial.');
      }
    } catch (error) {
      console.error('Error en sincronización manual:', error);
      mostrarNotificacion('error', 'Fallo de conexión al sincronizar plantillas.');
    } finally {
      setSincronizandoMeta(false);
    }
  };

  // Cargar historial de lotes
  const cargarHistorial = useCallback(async () => {
    setCargandoHistorial(true);
    try {
      const res = await obtenerHistorialLotesApi();
      if (res.exito) {
        setHistorialLotes(res.historial || []);
      }
    } catch (error) {
      console.error('Error al cargar historial de lotes:', error);
    } finally {
      setCargandoHistorial(false);
    }
  }, []);

  const manejarEliminarLote = async (id: number) => {
    if (!window.confirm('¿Deseas eliminar este registro de lote del historial?')) return;
    try {
      const res = await eliminarLoteApi(id);
      if (res.exito) {
        cargarHistorial();
        cargarDatosPrincipales();
      }
    } catch (error) {
      console.error('Error al eliminar lote:', error);
    }
  };

  useEffect(() => {
    cargarDatosPrincipales();
    cargarHistorial();
  }, [cargarDatosPrincipales, cargarHistorial, opticaId]);



  const mostrarNotificacion = (tipo: 'exito' | 'error' | 'info', texto: string) => {
    setMensajeNotificacion({ tipo, texto });
    setTimeout(() => {
      setMensajeNotificacion(null);
    }, 6000);
  };

  // Filtrado de plantillas
  const plantillasFiltradas = useMemo(() => {
    return plantillas.filter((p) => {
      const coincideBusqueda =
        busqueda.trim() === '' ||
        p.etiqueta.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.cuerpo.toLowerCase().includes(busqueda.toLowerCase());

      const coincideCategoria =
        filtroCategoria === 'TODAS' || p.categoria === filtroCategoria;

      const coincideEstado =
        filtroEstado === 'TODOS' ||
        (filtroEstado === 'APPROVED' && (p.estado === 'APPROVED' || p.estado === 'APROBADA')) ||
        (filtroEstado === 'PENDING' && (p.estado === 'PENDING' || p.estado === 'PENDIENTE')) ||
        (filtroEstado === 'REJECTED' && (p.estado === 'REJECTED' || p.estado === 'RECHAZADA'));

      return coincideBusqueda && coincideCategoria && coincideEstado;
    });
  }, [plantillas, busqueda, filtroCategoria, filtroEstado]);

  // Plantilla seleccionada para previsualización fija a la derecha (por defecto la primera)
  const plantillaSeleccionada = useMemo(() => {
    if (plantillasFiltradas.length === 0) return null;
    const encontrada = plantillasFiltradas.find((p) => p.id === idPlantillaSeleccionada);
    return encontrada || plantillasFiltradas[0];
  }, [plantillasFiltradas, idPlantillaSeleccionada]);

  const abrirModalLanzarConPlantilla = (plantilla: PlantillaWhatsApp) => {
    const estaAprobada = plantilla.estado === 'APPROVED' || plantilla.estado === 'APROBADA';
    if (!estaAprobada) {
      mostrarNotificacion(
        'error',
        'Esta plantilla está en revisión o rechazada. Solo puedes lanzar envíos con plantillas aprobadas.'
      );
      return;
    }
    setPlantillaSeleccionadaLanzar(plantilla);
    setModalLanzarAbierto(true);
  };

  const formatearFecha = (fechaIso?: string) => {
    if (!fechaIso) return 'Reciente';
    try {
      const f = new Date(fechaIso);
      return f.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return fechaIso;
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        height: '100%',
        overflowY: 'auto',
        background: 'var(--fondo-principal)',
        color: 'var(--texto-principal)',
        padding: '0.45rem 1rem 1rem 1rem',
        gap: '0.45rem',
      }}
    >
      {/* 1. Barra Superior Unificada: Pestañas a la izquierda + Botones a la derecha */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.65rem',
          paddingBottom: '0.15rem',
        }}
      >
        {/* Pestañas de Navegación con componente estandarizado BarraPestanas */}
        <BarraPestanas<'biblioteca' | 'historial'>
          pestanas={pestanasModulo}
          pestanaActiva={pestanaActiva}
          alCambiarPestana={(id) => {
            setPestanaActiva(id);
            if (id === 'historial') {
              cargarHistorial();
            }
          }}
        />

        {/* Acciones al lado derecho: Indicador de cuota + Sincronizar (icono con tooltip) + Nueva Plantilla */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {/* Chip de cuota con EtiquetaTooltip Premium */}
          {cuota && (
            <EtiquetaTooltip
              texto={`Capacidad oficial: ${cuota.disponibles_hoy} de ${cuota.limite_diario} mensajes disponibles hoy · Calidad ${cuota.calidad_meta === 'GREEN' ? 'Excelente' : 'Media'}`}
              posicion="abajo"
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: 'var(--texto-secundario)',
                  background: 'var(--fondo-tarjeta)',
                  border: '1px solid var(--borde-suave)',
                  padding: '0.4rem 0.65rem',
                  borderRadius: '8px',
                  cursor: 'help',
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: cuota.calidad_meta === 'GREEN' ? '#10b981' : '#f59e0b',
                    display: 'inline-block',
                  }}
                />
                <span>
                  {cuota.disponibles_hoy} / {cuota.limite_diario} disp. hoy
                </span>
              </div>
            </EtiquetaTooltip>
          )}

          {/* Botón Sincronizar: SOLO ICONO con EtiquetaTooltip Premium */}
          <EtiquetaTooltip texto={sincronizandoMeta ? 'Sincronizando...' : 'Sincronizar plantillas'}>
            <button
              onClick={manejarSincronizarConMeta}
              disabled={sincronizandoMeta || cargandoDatos}
              aria-label="Sincronizar plantillas"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                background: sincronizandoMeta ? 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)' : 'var(--fondo-tarjeta)',
                border: sincronizandoMeta ? '1px solid var(--color-primario)' : '1px solid var(--borde-suave)',
                borderRadius: '8px',
                color: 'var(--color-primario)',
                cursor: sincronizandoMeta ? 'wait' : 'pointer',
                opacity: cargandoDatos ? 0.6 : 1,
                transition: 'all 0.25s ease',
              }}
            >
              <RefreshCw
                size={16}
                className={sincronizandoMeta ? 'animate-spin' : ''}
                style={{
                  animation: sincronizandoMeta ? 'spin 0.85s linear infinite' : 'none',
                  transformOrigin: 'center center',
                  color: 'var(--color-primario)',
                }}
              />
            </button>
          </EtiquetaTooltip>

          {/* Botón Nueva Plantilla */}
          <button
            onClick={() => setModalCrearAbierto(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: 'var(--color-primario)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '0.5rem 0.95rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(var(--color-primario-rgb, 2, 132, 199), 0.25)',
              transition: 'all 0.2s ease',
            }}
          >
            <Plus size={16} />
            <span>Nueva Plantilla</span>
          </button>
        </div>
      </div>

      {/* Notificación de Estado */}
      {mensajeNotificacion && (
        <div
          style={{
            padding: '0.65rem 0.9rem',
            borderRadius: '9px',
            fontSize: '0.82rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background:
              mensajeNotificacion.tipo === 'exito'
                ? 'rgba(16, 185, 129, 0.12)'
                : mensajeNotificacion.tipo === 'error'
                  ? 'rgba(239, 68, 68, 0.12)'
                  : 'rgba(59, 130, 246, 0.12)',
            color:
              mensajeNotificacion.tipo === 'exito'
                ? '#10b981'
                : mensajeNotificacion.tipo === 'error'
                  ? '#ef4444'
                  : '#3b82f6',
            border: `1px solid ${mensajeNotificacion.tipo === 'exito'
              ? 'rgba(16, 185, 129, 0.25)'
              : mensajeNotificacion.tipo === 'error'
                ? 'rgba(239, 68, 68, 0.25)'
                : 'rgba(59, 130, 246, 0.25)'
              }`,
          }}
        >
          {mensajeNotificacion.tipo === 'exito' && <CheckCircle2 size={15} />}
          {mensajeNotificacion.tipo === 'error' && <AlertTriangle size={15} />}
          {mensajeNotificacion.tipo === 'info' && <ShieldCheck size={15} />}
          <span>{mensajeNotificacion.texto}</span>
        </div>
      )}

      {/* 2. CONTENIDO: Pestaña Plantillas */}
      {pestanaActiva === 'biblioteca' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {/* Barra de Filtros y Búsqueda */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.65rem',
              background: 'var(--fondo-tarjeta)',
              border: '1px solid var(--borde-suave)',
              borderRadius: '9px',
              padding: '0.35rem 0.75rem',
            }}
          >
            {/* Buscador de plantillas */}
            <FiltroBusqueda
              valor={busqueda}
              alCambiar={setBusqueda}
              placeholder="Buscar plantilla..."
              flex="0 1 280px"
              anchoMinimo="150px"
              anchoMaximo="280px"
              alto="28px"
            />

            {/* Filtros */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--texto-secundario)', fontWeight: 600 }}>
                  Categoría:
                </span>
                <SelectorDesplegable
                  opciones={[
                    { valor: 'TODAS', etiqueta: 'Todas' },
                    { valor: 'MARKETING', etiqueta: 'Marketing' },
                    { valor: 'UTILITY', etiqueta: 'Utilidad' },
                  ]}
                  valor={filtroCategoria}
                  alCambiar={(val) => setFiltroCategoria(val)}
                  anchoMinimo="115px"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--texto-secundario)', fontWeight: 600 }}>
                  Estado:
                </span>
                <SelectorDesplegable
                  opciones={[
                    { valor: 'TODOS', etiqueta: 'Todos' },
                    { valor: 'APPROVED', etiqueta: 'Aprobadas' },
                    { valor: 'PENDING', etiqueta: 'En Revisión' },
                    { valor: 'REJECTED', etiqueta: 'Rechazadas' },
                  ]}
                  valor={filtroEstado}
                  alCambiar={(val) => setFiltroEstado(val)}
                  anchoMinimo="135px"
                />
              </div>
            </div>
          </div>

          {/* Grilla de Plantillas */}
          {cargandoDatos ? (
            <div
              style={{
                padding: '4rem 2rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                color: 'var(--texto-secundario)',
              }}
            >
              <RefreshCw size={26} className="animate-spin" color="var(--color-primario)" />
              <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Cargando plantillas oficiales...</span>
            </div>
          ) : plantillasFiltradas.length === 0 ? (
            <div
              style={{
                padding: '4rem 2rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                background: 'var(--fondo-tarjeta)',
                border: '1px dashed var(--borde-suave)',
                borderRadius: '12px',
                textAlign: 'center',
              }}
            >
              <MessageSquare size={36} color="var(--texto-secundario)" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>No se encontraron plantillas</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--texto-secundario)', maxWidth: '380px', margin: 0 }}>
                {busqueda || filtroCategoria !== 'TODAS' || filtroEstado !== 'TODOS'
                  ? 'No hay plantillas que coincidan con los filtros aplicados.'
                  : 'Crea tu primera plantilla oficial de WhatsApp para enviarla a revisión oficial.'}
              </p>
              <button
                onClick={() => setModalCrearAbierto(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  background: 'var(--color-primario)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.55rem 1rem',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  marginTop: '0.5rem',
                  boxShadow: '0 2px 8px rgba(var(--color-primario-rgb, 2, 132, 199), 0.25)',
                }}
              >
                <Plus size={15} />
                Crear Plantilla
              </button>
            </div>
          ) : plantillaSeleccionada ? (
            /* ======================================================== */
            /* PANEL DIVIDIDO: CATÁLOGO IZQUIERDA + PREVIEW FIJO DERECHA */
            /* ======================================================== */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 220px',
                gap: '0.85rem',
                alignItems: 'start',
              }}
            >
              {/* Columna Izquierda: Catálogo con al menos 3 plantillas por fila */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--texto-secundario)' }}>
                    Selecciona para previsualizar a la derecha
                  </span>
                </div>

                {/* Cuadrícula optimizada: exactamente 3 plantillas por fila */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: '0.75rem',
                  }}
                >
                  {plantillasFiltradas.map((plantilla) => {
                    const esActiva = plantilla.id === plantillaSeleccionada.id;
                    const esMarketing = plantilla.categoria === 'MARKETING';
                    const estaAprobada = plantilla.estado === 'APPROVED' || plantilla.estado === 'APROBADA';
                    const estaPendiente = plantilla.estado === 'PENDING' || plantilla.estado === 'PENDIENTE';

                    return (
                      <div
                        key={plantilla.id}
                        onClick={() => setIdPlantillaSeleccionada(plantilla.id)}
                        style={{
                          background: 'var(--fondo-tarjeta)',
                          border: esActiva ? '2px solid var(--color-primario)' : '1px solid var(--borde-suave)',
                          borderRadius: '11px',
                          padding: '0.75rem 0.85rem',
                          cursor: 'pointer',
                          boxShadow: esActiva
                            ? '0 4px 14px rgba(var(--color-primario-rgb, 2, 132, 199), 0.18)'
                            : '0 1px 3px rgba(0,0,0,0.02)',
                          transition: 'all 0.18s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          minHeight: '135px',
                        }}
                      >
                        <div>
                          {/* Fila superior: Categoría y Estado Meta */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '0.35rem',
                              marginBottom: '0.35rem',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '0.62rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                padding: '0.1rem 0.35rem',
                                borderRadius: '4px',
                                background: esMarketing ? 'rgba(59, 130, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                color: esMarketing ? '#3b82f6' : '#10b981',
                              }}
                            >
                              {plantilla.categoria}
                            </span>

                            {estaAprobada ? (
                              <span
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                  color: '#10b981',
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                }}
                              >
                                <CheckCircle2 size={11} /> Aprobada
                              </span>
                            ) : estaPendiente ? (
                              <span
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                  color: '#f59e0b',
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                }}
                              >
                                <Clock size={11} /> En Revisión
                              </span>
                            ) : (
                              <span style={{ color: '#ef4444', fontSize: '0.66rem', fontWeight: 700 }}>
                                {plantilla.estado}
                              </span>
                            )}
                          </div>

                          {/* Título y Nombre técnico */}
                          <h4
                            style={{
                              margin: '0 0 0.15rem 0',
                              fontSize: '0.86rem',
                              fontWeight: 700,
                              color: 'var(--texto-principal)',
                              lineHeight: 1.25,
                            }}
                          >
                            {plantilla.etiqueta}
                          </h4>

                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontFamily: 'monospace',
                              color: 'var(--texto-secundario)',
                              display: 'block',
                              marginBottom: '0.4rem',
                            }}
                          >
                            {plantilla.nombre}
                          </span>

                          {/* Extracto compacto de cuerpo con etiqueta tooltip para leer texto completo al pasar el cursor */}
                          <EtiquetaTooltip texto={plantilla.cuerpo} posicion="arriba">
                            <p
                              title={plantilla.cuerpo}
                              style={{
                                margin: 0,
                                fontSize: '0.74rem',
                                color: 'var(--texto-secundario)',
                                lineHeight: 1.35,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                cursor: 'help',
                              }}
                            >
                              {plantilla.cuerpo}
                            </p>
                          </EtiquetaTooltip>
                        </div>

                        {/* Pie de tarjeta compacta */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '0.55rem',
                            paddingTop: '0.45rem',
                            borderTop: '1px solid var(--borde-suave)',
                          }}
                        >
                          <span style={{ fontSize: '0.66rem', color: 'var(--texto-secundario)' }}>
                            {plantilla.botones && plantilla.botones.length > 0
                              ? `${plantilla.botones.length} ${plantilla.botones.length === 1 ? 'botón' : 'botones'}`
                              : plantilla.encabezado_tipo === 'IMAGEN'
                                ? 'Con imagen'
                                : 'Texto simple'}
                          </span>
                          {esActiva && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                color: 'var(--color-primario)',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.15rem',
                              }}
                            >
                              Activa <Check size={11} />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Columna Derecha: Previsualización Fija (Sticky) */}
              <div
                style={{
                  position: 'sticky',
                  top: '0.4rem',
                  background: 'var(--fondo-tarjeta)',
                  border: '1px solid var(--borde-suave)',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  boxShadow: '0 4px 18px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: 'calc(100vh - 1.2rem)',
                }}
              >
                {/* Cabecera del Simulador (Fila compacta única) */}
                <div
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderBottom: '1px solid var(--borde-suave)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'rgba(0, 0, 0, 0.02)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: '0.58rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        color: 'var(--color-primario)',
                        letterSpacing: '0.04em',
                        display: 'block',
                        lineHeight: 1,
                        marginBottom: '0.1rem',
                      }}
                    >
                      Vista Previa Móvil
                    </span>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: 'var(--texto-principal)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {plantillaSeleccionada.etiqueta}
                    </h3>
                  </div>

                  <button
                    onClick={() => abrirModalLanzarConPlantilla(plantillaSeleccionada)}
                    disabled={plantillaSeleccionada.estado !== 'APPROVED' && plantillaSeleccionada.estado !== 'APROBADA'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      background:
                        plantillaSeleccionada.estado === 'APPROVED' || plantillaSeleccionada.estado === 'APROBADA'
                          ? 'var(--color-primario)'
                          : 'var(--borde-suave)',
                      color:
                        plantillaSeleccionada.estado === 'APPROVED' || plantillaSeleccionada.estado === 'APROBADA'
                          ? '#ffffff'
                          : 'var(--texto-secundario)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '0.3rem 0.6rem',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor:
                        plantillaSeleccionada.estado === 'APPROVED' || plantillaSeleccionada.estado === 'APROBADA'
                          ? 'pointer'
                          : 'not-allowed',
                      boxShadow:
                        plantillaSeleccionada.estado === 'APPROVED' || plantillaSeleccionada.estado === 'APROBADA'
                          ? '0 2px 8px rgba(var(--color-primario-rgb, 2, 132, 199), 0.25)'
                          : 'none',
                      flexShrink: 0,
                    }}
                  >
                    <Send size={12} />
                    <span>Lanzar Lote</span>
                  </button>
                </div>

                {/* Previsualización Smartphone WhatsApp Compacta Centrada */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.40rem 0' }}>
                  <BurbujaWhatsApp
                    encabezadoTipo={plantillaSeleccionada.encabezado_tipo}
                    encabezadoContenido={plantillaSeleccionada.encabezado_contenido}
                    cuerpo={plantillaSeleccionada.cuerpo}
                    pie={plantillaSeleccionada.pie}
                    botones={plantillaSeleccionada.botones}
                    hora="11:07 a.m."
                    vistaPreviaVariables={false}
                    nombreOptica={nombreOptica}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* 3. CONTENIDO: Pestaña Historial de Envíos */}
      {pestanaActiva === 'historial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              background: 'var(--fondo-tarjeta)',
              border: '1px solid var(--borde-suave)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            {cargandoHistorial ? (
              <div
                style={{
                  padding: '4rem 2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  color: 'var(--texto-secundario)',
                }}
              >
                <RefreshCw size={26} className="animate-spin" color="var(--color-primario)" />
                <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Cargando registros de auditoría...</span>
              </div>
            ) : historialLotes.length === 0 ? (
              <div
                style={{
                  padding: '4rem 2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem',
                  textAlign: 'center',
                }}
              >
                <History size={36} color="var(--texto-secundario)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Aún no hay lotes ejecutados</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--texto-secundario)', maxWidth: '380px', margin: 0 }}>
                  Cuando lances tu primera campaña por lote aparecerá aquí con trazabilidad completa de envíos.
                </p>
                <button
                  onClick={() => setPestanaActiva('biblioteca')}
                  style={{
                    background: 'var(--fondo-principal)',
                    border: '1px solid var(--borde-suave)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.9rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: 'var(--texto-principal)',
                    marginTop: '0.5rem',
                  }}
                >
                  Ir a Plantillas
                </button>
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                  <thead>
                    <tr
                      style={{
                        background: 'rgba(0, 0, 0, 0.03)',
                        borderBottom: '1px solid var(--borde-suave)',
                        color: 'var(--texto-secundario)',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        fontSize: '0.72rem',
                        letterSpacing: '0.04em',
                      }}
                    >
                      <th style={{ padding: '0.85rem 1rem' }}>Fecha</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Campaña</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Plantilla</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Audiencia / Origen</th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Destinatarios</th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Enviados</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Estado</th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialLotesPaginados.map((item) => (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid var(--borde-suave)',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--texto-secundario)', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Calendar size={13} />
                            {formatearFecha(item.creado_en)}
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--texto-principal)' }}>
                          {item.nombre_campana}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '6px',
                              background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.1)',
                              color: 'var(--color-primario)',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              border: '1px solid rgba(var(--color-primario-rgb, 2, 132, 199), 0.2)',
                            }}
                          >
                            {item.plantilla_etiqueta || 'Plantilla WhatsApp'}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--texto-secundario)' }}>
                            {item.origen_tipo === 'segmento' ? (
                              <>
                                <Users size={14} color="#3b82f6" />
                                <span>{item.segmento_nombre || 'Segmento Inteligente'}</span>
                              </>
                            ) : (
                              <>
                                <FileSpreadsheet size={14} color="#f59e0b" />
                                <span>Lista CSV / Teléfonos</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 700 }}>
                          {item.total_destinatarios}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                          <span style={{ color: '#10b981', fontWeight: 700 }}>
                            {item.total_enviados}
                          </span>
                          {item.total_fallidos > 0 && (
                            <span style={{ color: '#ef4444', fontSize: '0.72rem', marginLeft: '0.3rem' }}>
                              ({item.total_fallidos} fallidos)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.55rem',
                              borderRadius: '20px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              background:
                                (item.estado || '').toLowerCase() === 'completado'
                                  ? 'rgba(16, 185, 129, 0.12)'
                                  : (item.estado || '').toLowerCase() === 'fallido'
                                    ? 'rgba(239, 68, 68, 0.12)'
                                    : 'rgba(245, 158, 11, 0.12)',
                              color:
                                (item.estado || '').toLowerCase() === 'completado'
                                  ? '#10b981'
                                  : (item.estado || '').toLowerCase() === 'fallido'
                                    ? '#ef4444'
                                    : '#f59e0b',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                          >
                            {(item.estado || '').toLowerCase() === 'completado' ? (
                              <CheckCircle2 size={12} />
                            ) : (
                              <AlertCircle size={12} />
                            )}
                            {item.estado}
                          </span>
                          {item.error_mensaje && (
                            <div
                              title={item.error_mensaje}
                              style={{
                                fontSize: '0.7rem',
                                color: '#ef4444',
                                marginTop: '0.3rem',
                                maxWidth: '300px',
                                lineHeight: '1.25',
                              }}
                            >
                              {item.error_mensaje}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                          <EtiquetaTooltip texto="Eliminar lote del historial" posicion="arriba">
                            <button
                              onClick={() => manejarEliminarLote(item.id)}
                              aria-label="Eliminar lote del historial"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--texto-secundario)',
                                cursor: 'pointer',
                                padding: '0.3rem',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.15s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--texto-secundario)')}
                            >
                              <Trash2 size={15} />
                            </button>
                          </EtiquetaTooltip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Barra de Paginación Estandarizada para Historial de Envíos */}
              <BarraPaginacionTabla
                totalRegistros={totalHistorialRegistros}
                paginaActual={paginaActualHistorial}
                limitePorPagina={limitePorPaginaHistorial}
                alCambiarPagina={setPaginaActualHistorial}
                alCambiarLimite={setLimitePorPaginaHistorial}
                cantidadVisibles={historialLotesPaginados.length}
              />
            </>
          )}
          </div>
        </div>
      )}

      {/* Modal para Crear Plantilla Nueva Oficial */}
      <ModalCrearPlantilla
        abierto={modalCrearAbierto}
        alCerrar={() => setModalCrearAbierto(false)}
        nombreOptica={nombreOptica}
        opticaId={opticaId}
        alGuardarExitoso={(nueva) => {
          setPlantillas((prev) => [nueva, ...prev]);
          setModalCrearAbierto(false);
          mostrarNotificacion(
            'exito',
            `Plantilla "${nueva.etiqueta}" enviada a revisión oficial con estado PENDIENTE.`
          );
        }}
      />

      {/* Modal para Lanzar Lote de Campaña */}
      <ModalLanzarLote
        abierto={modalLanzarAbierto}
        plantilla={plantillaSeleccionadaLanzar}
        segmentos={segmentos}
        segmentoPreseleccionadoId={segmentoPreseleccionadoId}
        cuota={cuota}
        nombreOptica={nombreOptica}
        opticaId={opticaId}
        alCerrar={() => {
          setModalLanzarAbierto(false);
          setPlantillaSeleccionadaLanzar(null);
        }}
        alLanzarExitoso={(resultado) => {
          setModalLanzarAbierto(false);
          setPlantillaSeleccionadaLanzar(null);
          cargarDatosPrincipales();
          cargarHistorial();
          setPestanaActiva('historial');
          const identificador =
            resultado.lote_numero
              ? `Lote #${resultado.lote_numero}`
              : (resultado.nombre_campana || (resultado.campana_id ? `Lote #${resultado.campana_id}` : 'Lote'));
          mostrarNotificacion(
            'exito',
            `${identificador} lanzado con éxito (${resultado.total_enviados ?? 0} mensajes enviados).`
          );
        }}
      />
    </div>
  );
};
