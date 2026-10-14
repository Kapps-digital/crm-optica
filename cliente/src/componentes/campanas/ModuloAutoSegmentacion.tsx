'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Target,
  Plus,
  Search,
  Filter,
  Users,
  Calendar,
  CalendarClock,
  Glasses,
  Laptop,
  Eye,
  Sparkles,
  UserX,
  Trash2,
  Send,
  Sliders,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Pencil,
} from 'lucide-react';
import type { Segmento, PlantillaWhatsApp, CuotaDiariaWhatsApp } from '@/tipos/crm';
import { obtenerSegmentos, eliminarSegmentoPersonalizado, obtenerPlantillasYCuota } from '@/servicios/api_crm';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';
import { ModalCrearSegmento } from './ModalCrearSegmento';
import { ModalVerPacientesSegmento } from './ModalVerPacientesSegmento';
import { ModalLanzarLote } from '../plantillas/ModalLanzarLote';

interface PropiedadesModuloAutoSegmentacion {
  alSeleccionarContactoChat?: (contactoId: number) => void;
  alLanzarCampanaConSegmento?: (segmento: Segmento) => void;
  nombreOptica?: string;
  opticaId?: number;
}

// Mapeo seguro de nombres de íconos a componentes de Lucide
function obtenerIconoComponente(nombreIcono?: string) {
  switch (nombreIcono) {
    case 'CalendarClock':
    case 'Calendar':
      return CalendarClock;
    case 'Glasses':
      return Glasses;
    case 'Laptop':
      return Laptop;
    case 'Eye':
      return Eye;
    case 'Sparkles':
      return Sparkles;
    case 'UserX':
      return UserX;
    case 'Users':
      return Users;
    case 'Target':
    default:
      return Target;
  }
}

export const ModuloAutoSegmentacion: React.FC<PropiedadesModuloAutoSegmentacion> = ({
  alSeleccionarContactoChat,
  alLanzarCampanaConSegmento,
  nombreOptica,
  opticaId,
}) => {
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'sistema' | 'personalizados'>('todos');

  const [totalPacientesOptica, setTotalPacientesOptica] = useState(0);
  const [totalPacientesCalificadosUnicos, setTotalPacientesCalificadosUnicos] = useState(0);

  // Modales
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [segmentoParaEditar, setSegmentoParaEditar] = useState<Segmento | null>(null);
  const [segmentoParaVer, setSegmentoParaVer] = useState<Segmento | null>(null);
  const [segmentoParaEliminar, setSegmentoParaEliminar] = useState<Segmento | null>(null);
  const [eliminando, setEliminando] = useState(false);

  // Estados para ModalLanzarLote autónomo
  const [modalLanzarLoteAbierto, setModalLanzarLoteAbierto] = useState(false);
  const [segmentoParaLoteId, setSegmentoParaLoteId] = useState<number | null>(null);
  const [plantillas, setPlantillas] = useState<PlantillaWhatsApp[]>([]);
  const [plantillaSeleccionadaLote, setPlantillaSeleccionadaLote] = useState<PlantillaWhatsApp | null>(null);
  const [cuota, setCuota] = useState<CuotaDiariaWhatsApp | null>(null);
  const [mensajeNotificacion, setMensajeNotificacion] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null);

  const mostrarNotificacion = (tipo: 'exito' | 'error', texto: string) => {
    setMensajeNotificacion({ tipo, texto });
    setTimeout(() => {
      setMensajeNotificacion(null);
    }, 6000);
  };

  const cargarSegmentos = async () => {
    setCargando(true);
    try {
      const respuesta = await obtenerSegmentos();
      setSegmentos(respuesta.segmentos);
      setTotalPacientesOptica(respuesta.total_pacientes_optica);
      setTotalPacientesCalificadosUnicos(respuesta.total_pacientes_calificados_unicos);
    } catch (err) {
      console.error('Error cargando segmentos:', err);
    } finally {
      setCargando(false);
    }
  };

  const cargarPlantillasYCuota = async () => {
    try {
      const res = await obtenerPlantillasYCuota();
      if (res.exito) {
        setPlantillas(res.plantillas || []);
        setCuota(res.cuota || null);
      }
    } catch (err) {
      console.error('Error cargando plantillas en Auto-Segmentación:', err);
    }
  };

  useEffect(() => {
    cargarSegmentos();
    cargarPlantillasYCuota();
  }, []);

  // Segmentos filtrados por pestaña y búsqueda
  const segmentosFiltrados = useMemo(() => {
    return segmentos.filter((s) => {
      if (filtroTipo === 'sistema' && !s.es_sistema) return false;
      if (filtroTipo === 'personalizados' && s.es_sistema) return false;

      if (!busqueda.trim()) return true;
      const term = busqueda.toLowerCase().trim();
      const nombre = (s.nombre || '').toLowerCase();
      const desc = (s.descripcion || '').toLowerCase();
      return nombre.includes(term) || desc.includes(term);
    });
  }, [segmentos, filtroTipo, busqueda]);

  // Totales
  const totalSistema = useMemo(() => segmentos.filter((s) => s.es_sistema).length, [segmentos]);
  const totalPersonalizados = useMemo(() => segmentos.filter((s) => !s.es_sistema).length, [segmentos]);
  const totalPacientesSegmentados = useMemo(() => {
    return segmentos.reduce((acc, curr) => acc + (curr.total_pacientes || 0), 0);
  }, [segmentos]);

  // Manejador de eliminación
  const manejarConfirmarEliminar = async () => {
    if (!segmentoParaEliminar) return;
    setEliminando(true);
    try {
      const res = await eliminarSegmentoPersonalizado(segmentoParaEliminar.id);
      if (res.exito) {
        setSegmentoParaEliminar(null);
        await cargarSegmentos();
      } else {
        alert(res.error || 'No se pudo eliminar el segmento');
      }
    } catch (err) {
      console.error('Error eliminando segmento:', err);
      alert('Error de conexión al eliminar el segmento');
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        height: 'calc(100vh - 48px)',
        overflowY: 'auto',
        backgroundColor: 'var(--fondo-base)',
        padding: '1rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* 1. Tarjetas Métricas KPI */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--fondo-tarjeta)',
            border: '1px solid var(--borde-tarjeta)',
            borderRadius: 'var(--radio-md)',
            padding: '1rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--texto-atenuado)', textTransform: 'uppercase' }}>
            Total Segmentos
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--texto-principal)' }}>
            {segmentos.length}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--texto-secundario)' }}>
            Reglas activas predeterminadas
          </span>
        </div>

        <div
          style={{
            backgroundColor: 'var(--fondo-tarjeta)',
            border: '1px solid var(--borde-tarjeta)',
            borderRadius: 'var(--radio-md)',
            padding: '1rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
            Predeterminados Sistema
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0284c7' }}>
            {totalSistema}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--texto-secundario)' }}>
            Salud y prevención visual
          </span>
        </div>

        <div
          style={{
            backgroundColor: 'var(--fondo-tarjeta)',
            border: '1px solid var(--borde-tarjeta)',
            borderRadius: 'var(--radio-md)',
            padding: '1rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>
            Mis Segmentos Propios
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981' }}>
            {totalPersonalizados}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--texto-secundario)' }}>
            Segmentos personalizados configurados
          </span>
        </div>

        <div
          style={{
            backgroundColor: 'var(--fondo-tarjeta)',
            border: '1px solid var(--borde-tarjeta)',
            borderRadius: 'var(--radio-md)',
            padding: '1rem 1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ea580c', textTransform: 'uppercase' }}>
            Pacientes Registrados
          </span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ea580c' }}>
            {totalPacientesOptica}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--texto-secundario)' }}>
            {totalPacientesCalificadosUnicos} con criterios calificados ({totalPacientesOptica > 0 ? Math.round((totalPacientesCalificadosUnicos / totalPacientesOptica) * 100) : 0}%)
          </span>
        </div>
      </div>

      {/* 3. Filtros y Búsqueda */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: 'var(--fondo-tarjeta)',
          border: '1px solid var(--borde-tarjeta)',
          borderRadius: 'var(--radio-md)',
          padding: '0.65rem 1rem',
        }}
      >
        {/* Pestañas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            onClick={() => setFiltroTipo('todos')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radio-sm)',
              border: 'none',
              backgroundColor: filtroTipo === 'todos' ? 'var(--fondo-hover)' : 'transparent',
              color: filtroTipo === 'todos' ? 'var(--texto-principal)' : 'var(--texto-atenuado)',
              fontWeight: filtroTipo === 'todos' ? 700 : 500,
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            Todos ({segmentos.length})
          </button>
          <button
            onClick={() => setFiltroTipo('sistema')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radio-sm)',
              border: 'none',
              backgroundColor: filtroTipo === 'sistema' ? 'var(--fondo-hover)' : 'transparent',
              color: filtroTipo === 'sistema' ? 'var(--texto-principal)' : 'var(--texto-atenuado)',
              fontWeight: filtroTipo === 'sistema' ? 700 : 500,
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            Predeterminados ({totalSistema})
          </button>
          <button
            onClick={() => setFiltroTipo('personalizados')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radio-sm)',
              border: 'none',
              backgroundColor: filtroTipo === 'personalizados' ? 'var(--fondo-hover)' : 'transparent',
              color: filtroTipo === 'personalizados' ? 'var(--texto-principal)' : 'var(--texto-atenuado)',
              fontWeight: filtroTipo === 'personalizados' ? 700 : 500,
              fontSize: '0.78rem',
              cursor: 'pointer',
            }}
          >
            Personalizados ({totalPersonalizados})
          </button>
        </div>

        {/* Búsqueda, Actualizar y Crear Segmento */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ position: 'relative', width: '250px' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--texto-atenuado)',
              }}
            />
            <input
              type="text"
              placeholder="Buscar segmento..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                width: '100%',
                padding: '0.42rem 0.65rem 0.42rem 1.9rem',
                backgroundColor: 'var(--fondo-base)',
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: 'var(--radio-md)',
                color: 'var(--texto-principal)',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Botón Actualizar (Solo ícono con EtiquetaTooltip) */}
          <EtiquetaTooltip texto="Actualizar segmentos" posicion="abajo">
            <button
              type="button"
              onClick={cargarSegmentos}
              disabled={cargando}
              aria-label="Actualizar segmentos"
              style={{
                width: '32px',
                height: '32px',
                backgroundColor: 'var(--fondo-base)',
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: 'var(--radio-md)',
                color: 'var(--texto-principal)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: cargando ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!cargando) e.currentTarget.style.backgroundColor = 'var(--fondo-hover)';
              }}
              onMouseLeave={(e) => {
                if (!cargando) e.currentTarget.style.backgroundColor = 'var(--fondo-base)';
              }}
            >
              <RefreshCw
                size={14}
                style={{
                  animation: cargando ? 'girar 0.8s linear infinite' : 'none',
                  transformOrigin: 'center center',
                }}
              />
            </button>
          </EtiquetaTooltip>

          {/* Botón Crear Segmento */}
          <button
            type="button"
            onClick={() => {
              setSegmentoParaEditar(null);
              setModalCrearAbierto(true);
            }}
            style={{
              padding: '0.45rem 0.95rem',
              backgroundColor: 'var(--color-primario)',
              border: 'none',
              borderRadius: 'var(--radio-md)',
              color: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: 'var(--sombra-sm)',
            }}
          >
            <Plus size={15} />
            <span>Crear Segmento</span>
          </button>
        </div>
      </div>

      {/* 4. Cuadrícula de Segmentos */}
      {cargando && segmentos.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '300px',
            color: 'var(--texto-atenuado)',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid var(--borde-tarjeta)',
              borderTopColor: 'var(--color-primario-claro)',
              borderRadius: '50%',
              animation: 'girar 1s linear infinite',
            }}
          />
          <span style={{ fontSize: '0.85rem' }}>Evaluando autosegmentación de pacientes...</span>
        </div>
      ) : segmentosFiltrados.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '300px',
            backgroundColor: 'var(--fondo-tarjeta)',
            border: '1px dashed var(--borde-tarjeta)',
            borderRadius: 'var(--radio-md)',
            color: 'var(--texto-atenuado)',
            textAlign: 'center',
            padding: '2rem',
          }}
        >
          <Target size={40} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--texto-principal)', margin: 0 }}>
            No se encontraron segmentos
          </h3>
          <p style={{ fontSize: '0.8rem', maxWidth: '360px', margin: '0.35rem 0 1rem 0' }}>
            {busqueda
              ? 'No hay segmentos que coincidan con la búsqueda.'
              : 'Aún no has creado segmentos personalizados.'}
          </p>
          <button
            onClick={() => {
              setSegmentoParaEditar(null);
              setModalCrearAbierto(true);
            }}
            style={{
              padding: '0.55rem 1.1rem',
              backgroundColor: 'var(--color-primario)',
              border: 'none',
              borderRadius: 'var(--radio-md)',
              color: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Crear Primer Segmento Personalizado
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {segmentosFiltrados.map((seg) => {
            const IconoSegmento = obtenerIconoComponente(seg.icono);
            const colorSeg = seg.color || '#0284c7';
            const criterios = typeof seg.criterios_json === 'string' ? JSON.parse(seg.criterios_json) : (seg.criterios_json || {});

            return (
              <div
                key={seg.id}
                style={{
                  backgroundColor: 'var(--fondo-tarjeta)',
                  border: '1px solid var(--borde-tarjeta)',
                  borderLeft: `4px solid ${colorSeg}`,
                  borderRadius: 'var(--radio-lg)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  boxShadow: 'var(--sombra-sm)',
                  position: 'relative',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                {/* Cabecera de la Tarjeta */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          backgroundColor: `${colorSeg}18`,
                          color: colorSeg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <IconoSegmento size={18} />
                      </div>
                      <div>
                        <h3
                          style={{
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            color: 'var(--texto-principal)',
                            margin: 0,
                            lineHeight: 1.3,
                          }}
                        >
                          {seg.nombre}
                        </h3>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            color: seg.es_sistema ? 'var(--texto-atenuado)' : colorSeg,
                          }}
                        >
                          {seg.es_sistema ? 'Predeterminado' : 'Personalizado'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <EtiquetaTooltip
                        texto={seg.es_sistema ? 'Personalizar segmento' : 'Editar segmento'}
                        posicion="arriba"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSegmentoParaEditar(seg);
                            setModalCrearAbierto(true);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--texto-atenuado)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = colorSeg)}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--texto-atenuado)')}
                        >
                          <Pencil size={15} />
                        </button>
                      </EtiquetaTooltip>

                      {!seg.es_sistema && (
                        <EtiquetaTooltip texto="Eliminar segmento" posicion="arriba">
                          <button
                            type="button"
                            onClick={() => setSegmentoParaEliminar(seg)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--texto-atenuado)',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-peligro-rojo)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--texto-atenuado)')}
                          >
                            <Trash2 size={15} />
                          </button>
                        </EtiquetaTooltip>
                      )}
                    </div>
                  </div>

                  {/* Descripción */}
                  <p
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--texto-secundario)',
                      marginTop: '0.75rem',
                      lineHeight: 1.4,
                      minHeight: '2.4em',
                    }}
                  >
                    {seg.descripcion || 'Sin descripción adicional.'}
                  </p>

                  {/* Pills de Criterios */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
                    {criterios.control_vencido_meses && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--fondo-base)',
                          border: '1px solid var(--borde-tarjeta)',
                          color: 'var(--texto-principal)',
                        }}
                      >
                        Control &gt; {criterios.control_vencido_meses}m
                      </span>
                    )}
                    {/* Rango de Edad unificado y legible */}
                    {criterios.edad_minima !== undefined &&
                    criterios.edad_minima !== null &&
                    criterios.edad_minima !== '' &&
                    criterios.edad_maxima !== undefined &&
                    criterios.edad_maxima !== null &&
                    criterios.edad_maxima !== '' ? (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--fondo-base)',
                          border: '1px solid var(--borde-tarjeta)',
                          color: 'var(--texto-principal)',
                        }}
                      >
                        {criterios.edad_minima} a {criterios.edad_maxima} años
                      </span>
                    ) : (
                      <>
                        {criterios.edad_minima !== undefined &&
                          criterios.edad_minima !== null &&
                          criterios.edad_minima !== '' && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--fondo-base)',
                                border: '1px solid var(--borde-tarjeta)',
                                color: 'var(--texto-principal)',
                              }}
                            >
                              Desde {criterios.edad_minima} años
                            </span>
                          )}
                        {criterios.edad_maxima !== undefined &&
                          criterios.edad_maxima !== null &&
                          criterios.edad_maxima !== '' && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--fondo-base)',
                                border: '1px solid var(--borde-tarjeta)',
                                color: 'var(--texto-principal)',
                              }}
                            >
                              Hasta {criterios.edad_maxima} años
                            </span>
                          )}
                      </>
                    )}
                    {criterios.tiene_adicion && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--fondo-base)',
                          border: '1px solid var(--borde-tarjeta)',
                          color: 'var(--texto-principal)',
                        }}
                      >
                        Presbicia / Adición
                      </span>
                    )}
                    {criterios.tipo_lente && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--fondo-base)',
                          border: '1px solid var(--borde-tarjeta)',
                          color: 'var(--texto-principal)',
                        }}
                      >
                        Lente: {criterios.tipo_lente}
                      </span>
                    )}
                    {criterios.cilindro_minimo && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--fondo-base)',
                          border: '1px solid var(--borde-tarjeta)',
                          color: 'var(--texto-principal)',
                        }}
                      >
                        Cilindro ≥ {criterios.cilindro_minimo}D
                      </span>
                    )}
                    {criterios.dias_sin_cita && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--fondo-base)',
                          border: '1px solid var(--borde-tarjeta)',
                          color: 'var(--texto-principal)',
                        }}
                      >
                        Sin cita &gt; {criterios.dias_sin_cita}d
                      </span>
                    )}
                    {criterios.sexo && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--fondo-base)',
                          border: '1px solid var(--borde-tarjeta)',
                          color: criterios.sexo === 'femenino' ? '#db2777' : 'var(--color-primario)',
                          fontWeight: 600,
                        }}
                      >
                        Género: {criterios.sexo === 'femenino' ? 'Femenino' : 'Masculino'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Conteo de Pacientes y Botones de Acción */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0',
                      borderTop: '1px solid var(--borde-tarjeta)',
                      marginBottom: '0.65rem',
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', color: 'var(--texto-atenuado)' }}>
                      Pacientes calificados:
                    </span>
                    <span
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        color: seg.total_pacientes > 0 ? colorSeg : 'var(--texto-atenuado)',
                      }}
                    >
                      {seg.total_pacientes}{' '}
                      <small style={{ fontSize: '0.75rem', fontWeight: 600 }}>pacientes</small>
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '0.5rem' }}>
                    <button
                      onClick={() => setSegmentoParaVer(seg)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        backgroundColor: 'var(--fondo-elevado)',
                        border: '1px solid var(--borde-tarjeta)',
                        borderRadius: 'var(--radio-md)',
                        color: 'var(--texto-principal)',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <Users size={13} />
                      <span>Ver Pacientes</span>
                    </button>

                    <button
                      onClick={() => {
                        setSegmentoParaLoteId(seg.id);
                        const plantillasAprobadas = plantillas.filter(
                          (p) => p.estado === 'APPROVED' || p.estado === 'APROBADA'
                        );
                        const inicial = plantillasAprobadas.length > 0 ? plantillasAprobadas[0] : (plantillas[0] || null);
                        setPlantillaSeleccionadaLote(inicial);
                        setModalLanzarLoteAbierto(true);
                      }}
                      style={{
                        padding: '0.5rem 0.75rem',
                        backgroundColor: colorSeg,
                        border: 'none',
                        borderRadius: 'var(--radio-md)',
                        color: '#ffffff',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <Send size={13} />
                      <span>Lanzar Campaña</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear / Editar Segmento */}
      <ModalCrearSegmento
        abierto={modalCrearAbierto}
        segmentoParaEditar={segmentoParaEditar}
        alCerrar={() => {
          setModalCrearAbierto(false);
          setSegmentoParaEditar(null);
        }}
        alGuardarExitoso={(_guardado) => {
          cargarSegmentos();
        }}
      />

      {/* Modal Ver Pacientes */}
      <ModalVerPacientesSegmento
        abierto={!!segmentoParaVer}
        segmento={segmentoParaVer}
        alCerrar={() => setSegmentoParaVer(null)}
        alSeleccionarContactoChat={alSeleccionarContactoChat}
      />

      {/* Modal Confirmación de Eliminación */}
      {segmentoParaEliminar && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--fondo-tarjeta)',
              border: '1px solid var(--borde-tarjeta)',
              borderRadius: 'var(--radio-lg)',
              padding: '1.5rem',
              maxWidth: '420px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: 'var(--sombra-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-peligro-rojo-suave)',
                  color: 'var(--color-peligro-rojo)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Trash2 size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--texto-principal)' }}>
                  ¿Eliminar este segmento?
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--texto-atenuado)' }}>
                  Esta acción no se puede deshacer.
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--texto-secundario)', margin: 0 }}>
              Se eliminará el segmento personalizado{' '}
              <strong>&ldquo;{segmentoParaEliminar.nombre}&rdquo;</strong>. Los pacientes no serán afectados.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => setSegmentoParaEliminar(null)}
                disabled={eliminando}
                style={{
                  padding: '0.5rem 0.9rem',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--borde-tarjeta)',
                  borderRadius: 'var(--radio-md)',
                  color: 'var(--texto-principal)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={manejarConfirmarEliminar}
                disabled={eliminando}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'var(--color-peligro-rojo)',
                  border: 'none',
                  borderRadius: 'var(--radio-md)',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {eliminando ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Lanzar Lote de Campaña directamente desde Auto-Segmentación */}
      <ModalLanzarLote
        abierto={modalLanzarLoteAbierto}
        plantilla={plantillaSeleccionadaLote}
        plantillasDisponibles={plantillas.filter((p) => p.estado === 'APPROVED' || p.estado === 'APROBADA')}
        alSeleccionarPlantilla={(plantillaNueva) => setPlantillaSeleccionadaLote(plantillaNueva)}
        segmentos={segmentos}
        segmentoPreseleccionadoId={segmentoParaLoteId}
        cuota={cuota}
        nombreOptica={nombreOptica}
        opticaId={opticaId}
        alCerrar={() => {
          setModalLanzarLoteAbierto(false);
          setSegmentoParaLoteId(null);
        }}
        alLanzarExitoso={(resultado) => {
          setModalLanzarLoteAbierto(false);
          setSegmentoParaLoteId(null);
          cargarSegmentos();
          cargarPlantillasYCuota();
          const identificador = resultado.lote_numero
            ? `Lote #${resultado.lote_numero}`
            : (resultado.nombre_campana || 'Lote');
          mostrarNotificacion(
            'exito',
            `${identificador} lanzado con éxito (${resultado.total_enviados ?? 0} mensajes enviados).`
          );
        }}
      />

      {/* Notificación flotante de confirmación */}
      {mensajeNotificacion && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            zIndex: 10001,
            padding: '0.85rem 1.25rem',
            backgroundColor: mensajeNotificacion.tipo === 'exito' ? '#10b981' : '#ef4444',
            color: '#ffffff',
            borderRadius: 'var(--radio-md)',
            boxShadow: 'var(--sombra-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            fontSize: '0.82rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={18} />
          <span>{mensajeNotificacion.texto}</span>
        </div>
      )}
    </div>
  );
};
