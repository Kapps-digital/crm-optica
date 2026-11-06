'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FileText,
  Calendar,
  IdCard,
  Phone,
  Mail,
  User,
  Plus,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  CalendarDays,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Glasses,
  Edit,
} from 'lucide-react';
import type { Contacto, FormulaOptica, Cita, HistoriaClinicaOptometrica } from '@/tipos/crm';
import { obtenerDetalleContacto } from '@/servicios/api_crm';
import { formatearTelefono, formatearSeparadorMiles, obtenerNombrePaciente, formatearEjeVisual, formatearDistanciaPupilar } from '@/utilidades/formato';
import { BarraPaginacionTabla } from '../comunes/BarraPaginacionTabla';
import { BarraPestanas, ElementoPestana } from '../comunes/BarraPestanas';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';

interface PropiedadesModalHistorialClinico {
  abierto: boolean;
  contacto: Contacto | null;
  alCerrar: () => void;
  alAbrirNuevaFormula?: (contacto: Contacto) => void;
  alAbrirNuevaHistoria?: (contacto: Contacto, historia?: HistoriaClinicaOptometrica) => void;
}

export const ModalHistorialClinico: React.FC<PropiedadesModalHistorialClinico> = ({
  abierto,
  contacto,
  alCerrar,
  alAbrirNuevaFormula,
  alAbrirNuevaHistoria,
}) => {
  const [montado, setMontado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [formulas, setFormulas] = useState<FormulaOptica[]>([]);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [historiasClinicas, setHistoriasClinicas] = useState<HistoriaClinicaOptometrica[]>([]);
  const [pestañaActiva, setPestañaActiva] = useState<'historias' | 'formulas' | 'citas'>('historias');

  // Estado de filas expandidas para el acordeón de fórmulas clínicas
  const [filasExpandidas, setFilasExpandidas] = useState<number[]>([]);
  // Estado de filas expandidas para el acordeón de historias clínicas
  const [historiasExpandidas, setHistoriasExpandidas] = useState<number[]>([]);

  const alternarFilaExpandida = (id: number) => {
    setFilasExpandidas((anteriores) =>
      anteriores.includes(id)
        ? anteriores.filter((itemId) => itemId !== id)
        : [...anteriores, id]
    );
  };

  const alternarHistoriaExpandida = (id: number) => {
    setHistoriasExpandidas((anteriores) =>
      anteriores.includes(id)
        ? anteriores.filter((itemId) => itemId !== id)
        : [...anteriores, id]
    );
  };

  // Estados de paginación para historias
  const [paginaHistorias, setPaginaHistorias] = useState(1);
  const [limiteHistorias, setLimiteHistorias] = useState(5);

  // Estados de paginación para fórmulas (por defecto 5 registros)
  const [paginaFormulas, setPaginaFormulas] = useState(1);
  const [limiteFormulas, setLimiteFormulas] = useState(5);

  // Estados de paginación para citas (por defecto 5 registros)
  const [paginaCitas, setPaginaCitas] = useState(1);
  const [limiteCitas, setLimiteCitas] = useState(5);

  useEffect(() => {
    setMontado(true);
  }, []);

  // Cargar fórmulas, citas e historias al abrir el modal para el contacto
  useEffect(() => {
    if (abierto && contacto?.id) {
      setCargando(true);
      setPaginaHistorias(1);
      setPaginaFormulas(1);
      setPaginaCitas(1);
      obtenerDetalleContacto(contacto.id)
        .then((datos) => {
          if (datos) {
            setFormulas(datos.formulas || []);
            setCitas(datos.citas || []);
            const listaHistorias = (datos as any).historias_clinicas || [];
            setHistoriasClinicas(listaHistorias);
            setHistoriasExpandidas([]);
            if (datos.formulas && datos.formulas.length > 0) {
              setFilasExpandidas([datos.formulas[0].id]);
            } else {
              setFilasExpandidas([]);
            }
          }
        })
        .finally(() => {
          setCargando(false);
        });
    } else {
      setFormulas([]);
      setCitas([]);
      setHistoriasClinicas([]);
      setFilasExpandidas([]);
      setHistoriasExpandidas([]);
    }
  }, [abierto, contacto?.id]);

  // Cerrar al pulsar Escape
  useEffect(() => {
    if (!abierto) return;
    const manejarEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
    };
    document.addEventListener('keydown', manejarEscape);
    return () => document.removeEventListener('keydown', manejarEscape);
  }, [abierto, alCerrar]);

  // Paginación de historias clínicas
  const totalHistorias = historiasClinicas.length;
  const historiasPaginadas = useMemo(() => {
    const inicio = (paginaHistorias - 1) * limiteHistorias;
    return historiasClinicas.slice(inicio, inicio + limiteHistorias);
  }, [historiasClinicas, paginaHistorias, limiteHistorias]);

  // Paginación de fórmulas
  const totalFormulas = formulas.length;
  const formulasPaginadas = useMemo(() => {
    const inicio = (paginaFormulas - 1) * limiteFormulas;
    return formulas.slice(inicio, inicio + limiteFormulas);
  }, [formulas, paginaFormulas, limiteFormulas]);

  // Paginación de citas
  const totalCitas = citas.length;
  const citasPaginadas = useMemo(() => {
    const inicio = (paginaCitas - 1) * limiteCitas;
    return citas.slice(inicio, inicio + limiteCitas);
  }, [citas, paginaCitas, limiteCitas]);

  // Configuración de pestañas con componente estandarizado BarraPestanas
  const pestanasHistorial = useMemo<ElementoPestana<'historias' | 'formulas' | 'citas'>[]>(
    () => [
      {
        id: 'historias',
        etiqueta: 'Historias',
        icono: FileText,
        conteo: totalHistorias,
      },
      {
        id: 'formulas',
        etiqueta: 'Fórmulas',
        icono: Eye,
        conteo: totalFormulas,
      },
      {
        id: 'citas',
        etiqueta: 'Citas',
        icono: CalendarDays,
        conteo: totalCitas,
      },
    ],
    [totalHistorias, totalFormulas, totalCitas]
  );

  if (!montado || !abierto || !contacto) return null;

  const esPaciente = Boolean(contacto.es_paciente || totalFormulas > 0 || totalCitas > 0);
  const nombreMostrar = obtenerNombrePaciente(contacto);
  const documentoMostrar = contacto.cedula || contacto.documento;
  const tipoDocMostrar = (contacto.tipo_documento || 'CC').toUpperCase();

  const obtenerBadgeEstadoCita = (estado: string) => {
    switch (estado) {
      case 'confirmada':
        return {
          color: '#10b981',
          fondo: 'rgba(16, 185, 129, 0.12)',
          borde: 'rgba(16, 185, 129, 0.3)',
          texto: 'Confirmada',
          icono: CheckCircle,
        };
      case 'pendiente':
        return {
          color: '#f59e0b',
          fondo: 'rgba(245, 158, 11, 0.12)',
          borde: 'rgba(245, 158, 11, 0.3)',
          texto: 'Pendiente',
          icono: Clock,
        };
      case 'completada':
        return {
          color: '#0284c7',
          fondo: 'rgba(2, 132, 199, 0.12)',
          borde: 'rgba(2, 132, 199, 0.3)',
          texto: 'Completada',
          icono: CheckCircle,
        };
      case 'cancelada':
        return {
          color: '#ef4444',
          fondo: 'rgba(239, 68, 68, 0.12)',
          borde: 'rgba(239, 68, 68, 0.3)',
          texto: 'Cancelada',
          icono: XCircle,
        };
      default:
        return {
          color: 'var(--texto-secundario)',
          fondo: 'var(--fondo-elevado)',
          borde: 'var(--borde-tarjeta)',
          texto: estado,
          icono: Clock,
        };
    }
  };

  return createPortal(
    <div
      className="modal-backdrop-premium"
      onClick={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="modal-tarjeta-premium"
        style={{
          background: 'var(--fondo-tarjeta)',
          border: '1px solid var(--borde-tarjeta)',
          borderRadius: 'var(--radio-xl, 14px)',
          width: '100%',
          maxWidth: '920px',
          height: '86vh',
          maxHeight: '86vh',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.28)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeInUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* 1. Cabecera Corporativa del Paciente (Fija en una sola fila) */}
        <div
          className="modal-historial-cabecera"
          style={{
            flexShrink: 0,
            padding: '1rem 1.6rem',
            borderBottom: '1px solid var(--borde-tarjeta)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--fondo-elevado)',
            flexWrap: 'nowrap',
            gap: '1rem',
          }}
        >
          {/* Bloque Izquierdo: Avatar e Información del Paciente */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: esPaciente
                  ? 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.14)'
                  : 'rgba(217, 119, 6, 0.14)',
                color: esPaciente ? 'var(--color-primario)' : '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1rem',
                flexShrink: 0,
              }}
            >
              {nombreMostrar.substring(0, 2).toUpperCase()}
            </div>

            <div style={{ flex: '1 1 auto', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.18rem',
                    fontWeight: 700,
                    color: 'var(--texto-principal)',
                    fontFamily: 'var(--fuente-titulos)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {nombreMostrar}
                </h3>
                <span
                  style={{
                    fontSize: '0.70rem',
                    fontWeight: 700,
                    padding: '0.12rem 0.5rem',
                    borderRadius: '12px',
                    background: esPaciente
                      ? 'rgba(16, 185, 129, 0.12)'
                      : 'rgba(217, 119, 6, 0.12)',
                    color: esPaciente ? '#059669' : '#d97706',
                    border: esPaciente
                      ? '1px solid rgba(16, 185, 129, 0.25)'
                      : '1px solid rgba(217, 119, 6, 0.25)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {esPaciente ? 'Paciente Clínico' : 'Contacto de Chat'}
                </span>

                {contacto.tipologia_nombre && (
                  <span
                    style={{
                      fontSize: '0.70rem',
                      fontWeight: 700,
                      padding: '0.12rem 0.55rem',
                      borderRadius: '12px',
                      background: 'var(--fondo-tarjeta)',
                      color: contacto.tipologia_color || 'var(--texto-principal)',
                      border: `1px solid ${contacto.tipologia_color ? `${contacto.tipologia_color}40` : 'var(--borde-tarjeta)'}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: contacto.tipologia_color || '#0284c7',
                      }}
                    />
                    <span>{contacto.tipologia_nombre}</span>
                  </span>
                )}
              </div>

              {/* Fila de Datos de Identidad (Con truncado inteligente de correo largo) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                  marginTop: '0.35rem',
                  fontSize: '0.76rem',
                  color: 'var(--texto-secundario)',
                  flexWrap: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                {documentoMostrar && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <IdCard size={13} style={{ color: 'var(--color-primario)' }} />
                    <strong>{tipoDocMostrar}:</strong> {formatearSeparadorMiles(documentoMostrar)}
                  </span>
                )}

                {contacto.telefono && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <Phone size={13} style={{ color: '#10b981' }} />
                    {formatearTelefono(contacto.telefono)}
                  </span>
                )}

                {contacto.correo && (
                  <span className="modal-historial-cabecera-correo" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                    <EtiquetaTooltip texto={contacto.correo} posicion="arriba">
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          maxWidth: '220px',
                          cursor: 'help',
                          flexShrink: 0,
                        }}
                      >
                        <Mail size={13} style={{ color: 'var(--texto-atenuado)', flexShrink: 0 }} />
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {contacto.correo}
                        </span>
                      </span>
                    </EtiquetaTooltip>
                  </span>
                )}

                {contacto.edad && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <Calendar size={13} style={{ color: 'var(--texto-atenuado)' }} />
                    {contacto.edad} años
                  </span>
                )}

                {contacto.sexo && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      fontWeight: 600,
                      color: contacto.sexo === 'femenino' ? '#db2777' : 'var(--color-primario)',
                      textTransform: 'capitalize',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    <span>{contacto.sexo === 'femenino' ? 'Femenino' : 'Masculino'}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Acciones de Cabecera: Botón Único Unificado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
            {(alAbrirNuevaHistoria || alAbrirNuevaFormula) && (
              <button
                type="button"
                onClick={() => {
                  alCerrar();
                  if (alAbrirNuevaHistoria) {
                    alAbrirNuevaHistoria(contacto);
                  } else if (alAbrirNuevaFormula) {
                    alAbrirNuevaFormula(contacto);
                  }
                }}
                className="btn-primario-optica"
                style={{
                  height: '32px',
                  padding: '0 0.95rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  borderRadius: 'var(--radio-md, 8px)',
                  cursor: 'pointer',
                  background: 'var(--color-primario)',
                  color: '#ffffff',
                  border: 'none',
                  boxShadow: '0 2px 6px rgba(var(--color-primario-rgb, 2, 132, 199), 0.25)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
                aria-label="Consulta y fórmula óptica"
              >
                <FileText size={15} style={{ flexShrink: 0 }} />
                <span className="texto-largo-btn-consulta">Consulta y fórmula óptica</span>
                <span className="texto-corto-btn-consulta">Consulta</span>
              </button>
            )}

            <button
              type="button"
              onClick={alCerrar}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--texto-atenuado)',
                cursor: 'pointer',
                padding: '0.4rem',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              aria-label="Cerrar modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 2. Pestañas de Navegación del Historial con componente estandarizado BarraPestanas */}
        <div
          className="modal-historial-tabs-contenedor"
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            padding: '0.65rem 1.6rem',
            borderBottom: '1px solid var(--borde-tarjeta)',
            background: 'var(--fondo-tarjeta)',
          }}
        >
          <BarraPestanas<'historias' | 'formulas' | 'citas'>
            pestanas={pestanasHistorial}
            pestanaActiva={pestañaActiva}
            alCambiarPestana={setPestañaActiva}
            tamano="compacto"
            style={{ flexWrap: 'nowrap', width: '100%' }}
          />
        </div>

        {/* 3. Contenedor de Contenido Scrolleable (Scroll Suave Garantizado) */}
        <div
          className="scroll-suave-optica"
          style={{
            flex: '1 1 0%',
            minHeight: 0,
            overflowY: 'auto',
            padding: '1.2rem 1.6rem 2.5rem 1.6rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {cargando ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--texto-atenuado)', fontSize: '0.85rem' }}>
              Cargando historial clínico...
            </div>
          ) : pestañaActiva === 'historias' ? (
            /* Sección Historias Clínicas Optométricas */
            totalHistorias === 0 ? (
              <div
                style={{
                  padding: '3rem 1.5rem',
                  textAlign: 'center',
                  background: 'var(--fondo-elevado)',
                  borderRadius: 'var(--radio-md, 8px)',
                  border: '1px dashed var(--borde-tarjeta)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)',
                    color: 'var(--color-primario)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileText size={22} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.92rem', color: 'var(--texto-principal)', fontWeight: 600 }}>
                    Sin historias clínicas optométricas
                  </h4>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.76rem', color: 'var(--texto-atenuado)' }}>
                    Este paciente aún no tiene anamnesis ni historias clínicas registradas.
                  </p>
                </div>
                {alAbrirNuevaHistoria && (
                  <button
                    type="button"
                    onClick={() => {
                      alCerrar();
                      alAbrirNuevaHistoria(contacto);
                    }}
                    className="btn-primario-optica"
                    style={{
                      height: '32px',
                      padding: '0 0.95rem',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      borderRadius: 'var(--radio-md, 8px)',
                      background: 'var(--color-primario)',
                      color: '#ffffff',
                      border: 'none',
                      marginTop: '0.35rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={14} />
                    <span>Crear Historia Clínica</span>
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {historiasPaginadas.map((historia) => {
                  const expandida = historiasExpandidas.includes(historia.id);
                  const fechaFormateada = new Date(historia.fecha_atencion).toLocaleDateString('es-CO', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  });

                  // Validar si la historia está dentro de las 24 horas para permitir edición
                  const puedeEditarHistoria = (): boolean => {
                    const fechaRef = historia.actualizado_en || historia.creado_en;
                    if (fechaRef) {
                      const tiempo = new Date(fechaRef).getTime();
                      if (!isNaN(tiempo)) {
                        return Date.now() - tiempo <= 24 * 60 * 60 * 1000;
                      }
                    }
                    if (historia.fecha_atencion) {
                      try {
                        const tiempo = new Date(historia.fecha_atencion).getTime();
                        if (!isNaN(tiempo)) {
                          return Date.now() - tiempo <= 24 * 60 * 60 * 1000;
                        }
                      } catch {
                        return false;
                      }
                    }
                    return true;
                  };

                  const esEditable = puedeEditarHistoria();

                  // Limpiar duplicados de mmHg
                  const formatearPresion = (val?: string | null) => {
                    if (!val) return 'N/R';
                    const limpio = val.replace(/mmHg/gi, '').trim();
                    return limpio ? `${limpio} mmHg` : 'N/R';
                  };

                  // Parsear si vienen como strings o arrays
                  const sints: string[] = Array.isArray(historia.sintomas)
                    ? historia.sintomas
                    : typeof historia.sintomas === 'string'
                    ? JSON.parse(historia.sintomas || '[]')
                    : [];

                  const antPers: string[] = Array.isArray(historia.antecedentes_personales)
                    ? historia.antecedentes_personales
                    : typeof historia.antecedentes_personales === 'string'
                    ? JSON.parse(historia.antecedentes_personales || '[]')
                    : [];

                  const antOcul: string[] = Array.isArray(historia.antecedentes_oculares)
                    ? historia.antecedentes_oculares
                    : typeof historia.antecedentes_oculares === 'string'
                    ? JSON.parse(historia.antecedentes_oculares || '[]')
                    : [];

                  const antFam: string[] = Array.isArray(historia.antecedentes_familiares)
                    ? historia.antecedentes_familiares
                    : typeof historia.antecedentes_familiares === 'string'
                    ? JSON.parse(historia.antecedentes_familiares || '[]')
                    : [];

                  const planes: string[] = Array.isArray(historia.plan_manejo)
                    ? historia.plan_manejo
                    : typeof historia.plan_manejo === 'string'
                    ? JSON.parse(historia.plan_manejo || '[]')
                    : [];

                  return (
                    <div
                      key={historia.id}
                      style={{
                        background: 'var(--fondo-tarjeta)',
                        border: '1px solid var(--borde-tarjeta)',
                        borderRadius: 'var(--radio-md, 8px)',
                        overflow: 'hidden',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* Cabecera del Acordeón de Historia Clínica */}
                      <div
                        onClick={() => alternarHistoriaExpandida(historia.id)}
                        style={{
                          padding: '0.85rem 1.1rem',
                          background: expandida ? 'var(--fondo-elevado)' : 'var(--fondo-tarjeta)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          userSelect: 'none',
                          borderBottom: expandida ? '1px solid var(--borde-tarjeta)' : 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)',
                              color: 'var(--color-primario)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <FileText size={16} />
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--texto-principal)' }}>
                                Atención: {fechaFormateada}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '0.1rem 0.45rem',
                                  borderRadius: '12px',
                                  background: 'var(--fondo-hover)',
                                  color: 'var(--texto-atenuado)',
                                  fontWeight: 600,
                                }}
                              >
                                {historia.hora_atencion}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--texto-secundario)', marginTop: '0.15rem' }}>
                              <strong style={{ color: 'var(--texto-principal)' }}>Diagnóstico:</strong>{' '}
                              {historia.diagnostico || 'Sin diagnóstico registrado'}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <span style={{ fontSize: '0.73rem', color: 'var(--texto-atenuado)' }}>
                            {historia.optometra}
                          </span>
                          {alAbrirNuevaHistoria && (
                            esEditable ? (
                              <EtiquetaTooltip texto="Editar historia clínica" posicion="arriba">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    alCerrar();
                                    alAbrirNuevaHistoria(contacto, historia);
                                  }}
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--borde-tarjeta)',
                                    background: 'var(--fondo-elevado)',
                                    color: 'var(--texto-secundario)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                  aria-label="Editar historia clínica"
                                >
                                  <Edit size={13} />
                                </button>
                              </EtiquetaTooltip>
                            ) : (
                              <EtiquetaTooltip texto="No editable: plazo de 24 horas expirado" posicion="arriba">
                                <button
                                  type="button"
                                  disabled
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--borde-tarjeta)',
                                    background: 'var(--fondo-hover)',
                                    color: 'var(--texto-atenuado)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'not-allowed',
                                    opacity: 0.45,
                                  }}
                                  aria-label="No editable: plazo de 24 horas expirado"
                                >
                                  <Edit size={13} />
                                </button>
                              </EtiquetaTooltip>
                            )
                          )}
                          <div style={{ color: 'var(--texto-atenuado)' }}>
                            {expandida ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </div>
                      </div>

                      {/* Cuerpo Expandido de la Historia */}
                      {expandida && (
                        <div
                          style={{
                            padding: '1rem 1.1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.85rem',
                            fontSize: '0.78rem',
                          }}
                        >
                          {/* Motivo & Síntomas */}
                          <div
                            style={{
                              background: 'var(--fondo-elevado)',
                              padding: '0.75rem',
                              borderRadius: '6px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.4rem',
                            }}
                          >
                            <div>
                              <strong style={{ color: 'var(--texto-principal)' }}>Motivo de Consulta: </strong>
                              <span style={{ color: 'var(--texto-secundario)' }}>{historia.motivo_consulta}</span>
                            </div>
                            {(sints.length > 0 || historia.sintomas_otros) && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem' }}>
                                <strong style={{ color: 'var(--texto-principal)', fontSize: '0.73rem' }}>Síntomas: </strong>
                                {sints.map((s) => (
                                  <span
                                    key={s}
                                    style={{
                                      fontSize: '0.69rem',
                                      padding: '0.1rem 0.45rem',
                                      borderRadius: '12px',
                                      background: 'rgba(2, 132, 199, 0.1)',
                                      color: 'var(--color-primario)',
                                      fontWeight: 600,
                                    }}
                                  >
                                    ✓ {s}
                                  </span>
                                ))}
                                {historia.sintomas_otros && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--texto-secundario)' }}>
                                    ({historia.sintomas_otros})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Antecedentes */}
                          {(antPers.length > 0 || antOcul.length > 0 || antFam.length > 0 || historia.antecedentes_personales_otros || historia.antecedentes_oculares_otros || historia.antecedentes_familiares_otros) && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
                              {(antPers.length > 0 || historia.antecedentes_personales_otros) && (
                                <div style={{ background: 'var(--fondo-tarjeta)', border: '1px solid var(--borde-tarjeta)', borderRadius: '8px', padding: '0.65rem' }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.73rem', color: 'var(--texto-principal)', display: 'block', marginBottom: '0.3rem' }}>
                                    Personales:
                                  </span>
                                  <div style={{ color: 'var(--texto-secundario)', fontSize: '0.72rem', lineHeight: '1.4' }}>
                                    {antPers.join(', ')} {historia.antecedentes_personales_otros ? `(${historia.antecedentes_personales_otros})` : ''}
                                  </div>
                                </div>
                              )}
                              {(antOcul.length > 0 || historia.antecedentes_oculares_otros) && (
                                <div style={{ background: 'var(--fondo-tarjeta)', border: '1px solid var(--borde-tarjeta)', borderRadius: '8px', padding: '0.65rem' }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.73rem', color: 'var(--texto-principal)', display: 'block', marginBottom: '0.3rem' }}>
                                    Oculares:
                                  </span>
                                  <div style={{ color: 'var(--texto-secundario)', fontSize: '0.72rem', lineHeight: '1.4' }}>
                                    {antOcul.join(', ')} {historia.antecedentes_oculares_otros ? `(${historia.antecedentes_oculares_otros})` : ''}
                                  </div>
                                </div>
                              )}
                              {(antFam.length > 0 || historia.antecedentes_familiares_otros) && (
                                <div style={{ background: 'var(--fondo-tarjeta)', border: '1px solid var(--borde-tarjeta)', borderRadius: '8px', padding: '0.65rem' }}>
                                  <span style={{ fontWeight: 700, fontSize: '0.73rem', color: 'var(--texto-principal)', display: 'block', marginBottom: '0.3rem' }}>
                                    Familiares:
                                  </span>
                                  <div style={{ color: 'var(--texto-secundario)', fontSize: '0.72rem', lineHeight: '1.4' }}>
                                    {antFam.join(', ')} {historia.antecedentes_familiares_otros ? `(${historia.antecedentes_familiares_otros})` : ''}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Medición y Hallazgos */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem' }}>
                            {(historia.av_sc_od || historia.av_sc_oi) && (
                              <div style={{ background: 'var(--fondo-elevado)', padding: '0.55rem', borderRadius: '6px' }}>
                                <strong style={{ color: 'var(--texto-principal)', display: 'block', fontSize: '0.72rem' }}>
                                  Agudeza Visual S/C:
                                </strong>
                                <span style={{ color: 'var(--texto-secundario)' }}>
                                  OD: {historia.av_sc_od || 'N/R'} • OI: {historia.av_sc_oi || 'N/R'}
                                </span>
                              </div>
                            )}

                            {(historia.refraccion_od || historia.refraccion_oi) && (
                              <div style={{ background: 'var(--fondo-elevado)', padding: '0.55rem', borderRadius: '6px' }}>
                                <strong style={{ color: 'var(--texto-principal)', display: 'block', fontSize: '0.72rem' }}>
                                  Refracción:
                                </strong>
                                <span style={{ color: 'var(--texto-secundario)' }}>
                                  OD: {historia.refraccion_od || 'N/R'} • OI: {historia.refraccion_oi || 'N/R'}
                                </span>
                              </div>
                            )}

                            {(historia.queratometria_od || historia.queratometria_oi) && (
                              <div style={{ background: 'var(--fondo-elevado)', padding: '0.55rem', borderRadius: '6px' }}>
                                <strong style={{ color: 'var(--texto-principal)', display: 'block', fontSize: '0.72rem' }}>
                                  Queratometría:
                                </strong>
                                <span style={{ color: 'var(--texto-secundario)' }}>
                                  OD: {historia.queratometria_od || 'N/R'} • OI: {historia.queratometria_oi || 'N/R'}
                                </span>
                              </div>
                            )}

                            {(historia.presion_intraocular_od || historia.presion_intraocular_oi) && (
                              <div style={{ background: 'var(--fondo-elevado)', padding: '0.55rem', borderRadius: '6px' }}>
                                <strong style={{ color: 'var(--texto-principal)', display: 'block', fontSize: '0.72rem' }}>
                                  Presión Intraocular:
                                </strong>
                                <span style={{ color: 'var(--texto-secundario)' }}>
                                  OD: {formatearPresion(historia.presion_intraocular_od)} • OI: {formatearPresion(historia.presion_intraocular_oi)}
                                </span>
                              </div>
                            )}
                          </div>

                          {(historia.biomicroscopia || historia.fondo_ojo) && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
                              {historia.biomicroscopia && (
                                <div style={{ border: '1px solid var(--borde-tarjeta)', padding: '0.55rem', borderRadius: '6px' }}>
                                  <strong style={{ color: 'var(--texto-principal)', display: 'block', fontSize: '0.72rem' }}>
                                    Biomicroscopía:
                                  </strong>
                                  <span style={{ color: 'var(--texto-secundario)' }}>{historia.biomicroscopia}</span>
                                </div>
                              )}
                              {historia.fondo_ojo && (
                                <div style={{ border: '1px solid var(--borde-tarjeta)', padding: '0.55rem', borderRadius: '6px' }}>
                                  <strong style={{ color: 'var(--texto-principal)', display: 'block', fontSize: '0.72rem' }}>
                                    Fondo de Ojo:
                                  </strong>
                                  <span style={{ color: 'var(--texto-secundario)' }}>{historia.fondo_ojo}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Plan y Observaciones */}
                          {(planes.length > 0 || historia.plan_manejo_otros || historia.plan_manejo_control_meses) && (
                            <div style={{
                              background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.05)',
                              border: '1px solid rgba(var(--color-primario-rgb, 2, 132, 199), 0.18)',
                              padding: '0.65rem 0.85rem',
                              borderRadius: '8px',
                            }}>
                              <strong style={{ color: 'var(--color-primario)', display: 'block', fontSize: '0.73rem' }}>
                                Plan de Manejo Terapéutico:
                              </strong>
                              <div style={{ marginTop: '0.2rem', color: 'var(--texto-secundario)' }}>
                                {planes.join(', ')} {historia.plan_manejo_otros ? `• ${historia.plan_manejo_otros}` : ''}
                                {historia.plan_manejo_control_meses && (
                                  <span style={{ fontWeight: 600, color: 'var(--texto-principal)', marginLeft: '0.4rem' }}>
                                    (Control en {historia.plan_manejo_control_meses} meses)
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {historia.observaciones && (
                            <div style={{ fontStyle: 'italic', color: 'var(--texto-atenuado)' }}>
                              <strong>Observaciones:</strong> {historia.observaciones}
                            </div>
                          )}

                          {/* Pie de Firma */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.65rem', borderTop: '1px solid var(--borde-tarjeta)', paddingTop: '0.5rem', color: 'var(--texto-secundario)', fontSize: '0.72rem' }}>
                            <span><strong>Optómetra:</strong> {historia.optometra}</span>
                            {historia.tarjeta_profesional && <span>• <strong>T.P.:</strong> {historia.tarjeta_profesional}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Paginación de Historias */}
                <BarraPaginacionTabla
                  totalRegistros={totalHistorias}
                  paginaActual={paginaHistorias}
                  limitePorPagina={limiteHistorias}
                  alCambiarPagina={setPaginaHistorias}
                  alCambiarLimite={setLimiteHistorias}
                  cantidadVisibles={historiasPaginadas.length}
                />
              </div>
            )
          ) : pestañaActiva === 'formulas' ? (
            /* Sección Fórmulas Ópticas */
            totalFormulas === 0 ? (
              <div
                style={{
                  padding: '3rem 1.5rem',
                  textAlign: 'center',
                  background: 'var(--fondo-elevado)',
                  borderRadius: 'var(--radio-md, 8px)',
                  border: '1px dashed var(--borde-tarjeta)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.1)',
                    color: 'var(--color-primario)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileText size={22} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.92rem', color: 'var(--texto-principal)', fontWeight: 600 }}>
                    Sin fórmulas registradas
                  </h4>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.76rem', color: 'var(--texto-atenuado)' }}>
                    Este paciente aún no cuenta con exámenes de refracción o prescripciones ópticas registradas.
                  </p>
                </div>
                {alAbrirNuevaFormula && (
                  <button
                    type="button"
                    onClick={() => {
                      alCerrar();
                      alAbrirNuevaFormula(contacto);
                    }}
                    className="btn-primario-optica"
                    style={{
                      height: '32px',
                      padding: '0 0.95rem',
                      fontSize: '0.75rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      marginTop: '0.4rem',
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={14} />
                    <span>Registrar Primera Fórmula</span>
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {/* Barra de Controles Rápidos del Acordeón */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    padding: '0 0.2rem',
                  }}
                >
                  <span style={{ fontSize: '0.72rem', color: 'var(--texto-atenuado)' }}>
                    ✦ Clic en cualquier fila para desplegar o contraer su prescripción clínica.
                  </span>
                </div>

                {/* Tabla de Fórmulas tipo Acordeón */}
                <div
                  style={{
                    border: '1px solid var(--borde-tarjeta)',
                    borderRadius: 'var(--radio-md, 8px)',
                    overflow: 'hidden',
                    background: 'var(--fondo-tarjeta)',
                  }}
                >
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr
                          style={{
                            background: 'var(--fondo-elevado)',
                            borderBottom: '1px solid var(--borde-tarjeta)',
                            color: 'var(--texto-secundario)',
                            textAlign: 'left',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                          }}
                        >
                          <th style={{ width: '38px', padding: '0.65rem 0.5rem', textAlign: 'center' }}></th>
                          <th style={{ padding: '0.65rem 0.85rem' }}>Fecha</th>
                          <th style={{ padding: '0.65rem 0.85rem' }}>Tipo de Lente</th>
                          <th style={{ padding: '0.65rem 0.85rem' }}>Optómetra</th>
                          <th style={{ padding: '0.65rem 0.85rem' }}>Próx. Control</th>
                          <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formulasPaginadas.map((f, index) => {
                          const estaExpandida = filasExpandidas.includes(f.id);
                          const esVigente = index === 0 && paginaFormulas === 1;

                          return (
                            <React.Fragment key={f.id}>
                              <tr
                                onClick={() => alternarFilaExpandida(f.id)}
                                style={{
                                  borderBottom: '1px solid var(--borde-tarjeta)',
                                  background: estaExpandida
                                    ? 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.06)'
                                    : 'transparent',
                                  cursor: 'pointer',
                                  transition: 'background 0.12s ease',
                                }}
                              >
                                <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', color: estaExpandida ? 'var(--color-primario)' : 'var(--texto-atenuado)' }}>
                                  {estaExpandida ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                </td>
                                <td style={{ padding: '0.6rem 0.85rem', fontWeight: estaExpandida ? 700 : 600, color: 'var(--texto-principal)' }}>
                                  {f.fecha_examen ? new Date(f.fecha_examen).toLocaleDateString('es-CO') : '--/--/----'}
                                </td>
                                <td style={{ padding: '0.6rem 0.85rem', color: 'var(--texto-principal)', fontWeight: 600 }}>
                                  {f.tipo_lente || 'Monofocal'}
                                </td>
                                <td style={{ padding: '0.6rem 0.85rem', color: 'var(--texto-secundario)' }}>
                                  {f.optometra || 'Especialista'}
                                </td>
                                <td style={{ padding: '0.6rem 0.85rem', color: 'var(--texto-atenuado)' }}>
                                  {f.proximo_control_en_meses ? `${f.proximo_control_en_meses} meses` : '12 meses'}
                                </td>
                                <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>
                                  <span
                                    style={{
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                      padding: '0.12rem 0.45rem',
                                      borderRadius: '10px',
                                      background: esVigente
                                        ? 'rgba(16, 185, 129, 0.12)'
                                        : 'var(--fondo-elevado)',
                                      color: esVigente ? '#059669' : 'var(--texto-atenuado)',
                                      border: esVigente
                                        ? '1px solid rgba(16, 185, 129, 0.25)'
                                        : '1px solid var(--borde-tarjeta)',
                                    }}
                                  >
                                    {esVigente ? 'Vigente' : 'Anterior'}
                                  </span>
                                </td>
                              </tr>

                              {/* Fila Hija Expandible con la Cuadrícula Clínica */}
                              {estaExpandida && (
                                <tr style={{ background: 'var(--fondo-elevado)', borderBottom: '1px solid var(--borde-tarjeta)' }}>
                                  <td colSpan={6} style={{ padding: '0.55rem 0.85rem' }}>
                                    <div
                                      style={{
                                        background: 'var(--fondo-tarjeta)',
                                        border: '1px solid var(--borde-tarjeta)',
                                        borderRadius: '6px',
                                        padding: '0.7rem 0.85rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.5rem',
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem', fontWeight: 700, color: 'var(--texto-principal)' }}>
                                          <Sparkles size={13} style={{ color: 'var(--color-primario)' }} />
                                          <span>Detalle de Refracción</span>
                                        </div>
                                        {f.distancia_pupilar && (
                                          <span style={{ fontSize: '0.70rem', color: 'var(--texto-secundario)', background: 'var(--fondo-elevado)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid var(--borde-tarjeta)' }}>
                                            <strong>DP:</strong> {formatearDistanciaPupilar(f.distancia_pupilar)}
                                          </span>
                                        )}
                                      </div>

                                      {/* Graduación OD/OI */}
                                      <div style={{ overflowX: 'auto', borderRadius: '4px', border: '1px solid var(--borde-tarjeta)' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '0.74rem' }}>
                                          <thead>
                                            <tr style={{ background: 'var(--fondo-elevado)', borderBottom: '1px solid var(--borde-tarjeta)', color: 'var(--texto-atenuado)' }}>
                                              <th style={{ padding: '0.35rem', width: '22%' }}>Ojo</th>
                                              <th style={{ padding: '0.35rem', width: '15%' }}>Esfera</th>
                                              <th style={{ padding: '0.35rem', width: '15%' }}>Cilindro</th>
                                              <th style={{ padding: '0.35rem', width: '15%' }}>Eje</th>
                                              <th style={{ padding: '0.35rem', width: '15%' }}>Adición</th>
                                              <th style={{ padding: '0.35rem', width: '18%' }}>AV</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            <tr style={{ borderBottom: '1px solid var(--borde-tarjeta)' }}>
                                              <td style={{ padding: '0.4rem', fontWeight: 700, color: 'var(--color-primario)' }}>OD (Derecho)</td>
                                              <td style={{ padding: '0.4rem', fontWeight: 600 }}>{f.esfera_od || '0.00'}</td>
                                              <td style={{ padding: '0.4rem', fontWeight: 600 }}>{f.cilindro_od || '0.00'}</td>
                                              <td style={{ padding: '0.4rem' }}>{formatearEjeVisual(f.eje_od, '--')}</td>
                                              <td style={{ padding: '0.4rem' }}>{f.adicion_od || '--'}</td>
                                              <td style={{ padding: '0.4rem', color: '#10b981', fontWeight: 600 }}>{f.av_od || '20/20'}</td>
                                            </tr>
                                            <tr>
                                              <td style={{ padding: '0.4rem', fontWeight: 700, color: '#0284c7' }}>OI (Izquierdo)</td>
                                              <td style={{ padding: '0.4rem', fontWeight: 600 }}>{f.esfera_oi || '0.00'}</td>
                                              <td style={{ padding: '0.4rem', fontWeight: 600 }}>{f.cilindro_oi || '0.00'}</td>
                                              <td style={{ padding: '0.4rem' }}>{formatearEjeVisual(f.eje_oi, '--')}</td>
                                              <td style={{ padding: '0.4rem' }}>{f.adicion_oi || '--'}</td>
                                              <td style={{ padding: '0.4rem', color: '#10b981', fontWeight: 600 }}>{f.av_oi || '20/20'}</td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>

                                      {f.observaciones && (
                                        <p style={{ margin: 0, fontSize: '0.71rem', color: 'var(--texto-secundario)', fontStyle: 'italic' }}>
                                          <strong>Observaciones:</strong> {f.observaciones}
                                        </p>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Barra de Paginación para Acordeón */}
                  <BarraPaginacionTabla
                    totalRegistros={totalFormulas}
                    paginaActual={paginaFormulas}
                    limitePorPagina={limiteFormulas}
                    alCambiarPagina={setPaginaFormulas}
                    alCambiarLimite={setLimiteFormulas}
                    cantidadVisibles={formulasPaginadas.length}
                  />
                </div>
              </div>
            )
          ) : (
            /* Sección Citas y Consultas */
            totalCitas === 0 ? (
              <div
                style={{
                  padding: '3rem 1.5rem',
                  textAlign: 'center',
                  background: 'var(--fondo-elevado)',
                  borderRadius: 'var(--radio-md, 8px)',
                  border: '1px dashed var(--borde-tarjeta)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.1)',
                    color: 'var(--color-primario)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CalendarDays size={22} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.92rem', color: 'var(--texto-principal)', fontWeight: 600 }}>
                    Sin citas registradas
                  </h4>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.76rem', color: 'var(--texto-atenuado)' }}>
                    El paciente no registra citas en el calendario clínico hasta la fecha.
                  </p>
                </div>
              </div>
            ) : (
              <div
                style={{
                  border: '1px solid var(--borde-tarjeta)',
                  borderRadius: 'var(--radio-md, 8px)',
                  overflow: 'hidden',
                  background: 'var(--fondo-tarjeta)',
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr
                        style={{
                          background: 'var(--fondo-elevado)',
                          borderBottom: '1px solid var(--borde-tarjeta)',
                          color: 'var(--texto-secundario)',
                          textAlign: 'left',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                        }}
                      >
                        <th style={{ padding: '0.65rem 0.85rem' }}>Fecha & Hora</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Motivo</th>
                        <th style={{ padding: '0.65rem 0.85rem' }}>Especialista</th>
                        <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {citasPaginadas.map((cita) => {
                        const badge = obtenerBadgeEstadoCita(cita.estado);
                        const Icono = badge.icono;

                        return (
                          <tr
                            key={cita.id}
                            style={{
                              borderBottom: '1px solid var(--borde-tarjeta)',
                              transition: 'background 0.12s ease',
                            }}
                          >
                            <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: 'var(--texto-principal)' }}>
                              <div>{new Date(cita.fecha_cita).toLocaleDateString('es-CO')}</div>
                              <div style={{ fontSize: '0.70rem', color: 'var(--texto-atenuado)', fontWeight: 400 }}>
                                {cita.hora_cita}
                              </div>
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', color: 'var(--texto-principal)' }}>
                              {cita.motivo || 'Consulta General'}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', color: 'var(--texto-secundario)' }}>
                              {cita.especialista || 'Sin especialista'}
                            </td>
                            <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '0.12rem 0.45rem',
                                  borderRadius: '10px',
                                  background: badge.fondo,
                                  color: badge.color,
                                  border: `1px solid ${badge.borde}`,
                                }}
                              >
                                <Icono size={11} />
                                <span>{badge.texto}</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Barra de Paginación Estandarizada para Citas */}
                <BarraPaginacionTabla
                  totalRegistros={totalCitas}
                  paginaActual={paginaCitas}
                  limitePorPagina={limiteCitas}
                  alCambiarPagina={setPaginaCitas}
                  alCambiarLimite={setLimiteCitas}
                  cantidadVisibles={citasPaginadas.length}
                />
              </div>
            )
          )}
        </div>


      </div>
    </div>,
    document.body
  );
};
