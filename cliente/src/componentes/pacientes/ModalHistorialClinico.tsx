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
} from 'lucide-react';
import type { Contacto, FormulaOptica, Cita } from '@/tipos/crm';
import { obtenerDetalleContacto } from '@/servicios/api_crm';
import { formatearTelefono, formatearSeparadorMiles, obtenerNombrePaciente } from '@/utilidades/formato';
import { BarraPaginacionTabla } from '../comunes/BarraPaginacionTabla';

interface PropiedadesModalHistorialClinico {
  abierto: boolean;
  contacto: Contacto | null;
  alCerrar: () => void;
  alAbrirNuevaFormula?: (contacto: Contacto) => void;
}

export const ModalHistorialClinico: React.FC<PropiedadesModalHistorialClinico> = ({
  abierto,
  contacto,
  alCerrar,
  alAbrirNuevaFormula,
}) => {
  const [montado, setMontado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [formulas, setFormulas] = useState<FormulaOptica[]>([]);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [pestañaActiva, setPestañaActiva] = useState<'formulas' | 'citas'>('formulas');

  // Estado de filas expandidas para el acordeón de fórmulas clínicas
  const [filasExpandidas, setFilasExpandidas] = useState<number[]>([]);

  const alternarFilaExpandida = (id: number) => {
    setFilasExpandidas((anteriores) =>
      anteriores.includes(id)
        ? anteriores.filter((itemId) => itemId !== id)
        : [...anteriores, id]
    );
  };

  // Estados de paginación para fórmulas (por defecto 5 registros)
  const [paginaFormulas, setPaginaFormulas] = useState(1);
  const [limiteFormulas, setLimiteFormulas] = useState(5);

  // Estados de paginación para citas (por defecto 5 registros)
  const [paginaCitas, setPaginaCitas] = useState(1);
  const [limiteCitas, setLimiteCitas] = useState(5);

  useEffect(() => {
    setMontado(true);
  }, []);

  // Cargar fórmulas y citas al abrir el modal para el contacto
  useEffect(() => {
    if (abierto && contacto?.id) {
      setCargando(true);
      setPaginaFormulas(1);
      setPaginaCitas(1);
      obtenerDetalleContacto(contacto.id)
        .then((datos) => {
          if (datos) {
            setFormulas(datos.formulas || []);
            setCitas(datos.citas || []);
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
      setFilasExpandidas([]);
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
        {/* 1. Cabecera Corporativa del Paciente */}
        <div
          style={{
            flexShrink: 0,
            padding: '1.2rem 1.6rem',
            borderBottom: '1px solid var(--borde-tarjeta)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--fondo-elevado)',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
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

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.18rem',
                    fontWeight: 700,
                    color: 'var(--texto-principal)',
                    fontFamily: 'var(--fuente-titulos)',
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
                  }}
                >
                  {esPaciente ? 'Paciente Clínico' : 'Contacto de Chat'}
                </span>
              </div>

              {/* Fila de Datos de Identidad */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  marginTop: '0.35rem',
                  fontSize: '0.76rem',
                  color: 'var(--texto-secundario)',
                  flexWrap: 'wrap',
                }}
              >
                {documentoMostrar && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <IdCard size={13} style={{ color: 'var(--color-primario)' }} />
                    <strong>{tipoDocMostrar}:</strong> {formatearSeparadorMiles(documentoMostrar)}
                  </span>
                )}

                {contacto.telefono && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Phone size={13} style={{ color: '#10b981' }} />
                    {formatearTelefono(contacto.telefono)}
                  </span>
                )}

                {contacto.correo && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Mail size={13} style={{ color: 'var(--texto-atenuado)' }} />
                    {contacto.correo}
                  </span>
                )}

                {contacto.edad && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
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
                    }}
                  >
                    <span>{contacto.sexo === 'femenino' ? 'Femenino' : 'Masculino'}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Acciones de Cabecera */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
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
                  padding: '0 0.85rem',
                  fontSize: '0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  borderRadius: 'var(--radio-sm, 6px)',
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} />
                <span>+ Nueva Fórmula</span>
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
              }}
              aria-label="Cerrar modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 2. Pestañas de Navegación del Historial */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            padding: '0 1.6rem',
            borderBottom: '1px solid var(--borde-tarjeta)',
            background: 'var(--fondo-tarjeta)',
            gap: '1.25rem',
          }}
        >
          <button
            type="button"
            onClick={() => setPestañaActiva('formulas')}
            style={{
              padding: '0.75rem 0',
              background: 'none',
              border: 'none',
              borderBottom: pestañaActiva === 'formulas' ? '2.5px solid var(--color-primario)' : '2.5px solid transparent',
              color: pestañaActiva === 'formulas' ? 'var(--color-primario)' : 'var(--texto-secundario)',
              fontWeight: pestañaActiva === 'formulas' ? 700 : 500,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.15s ease',
            }}
          >
            <Eye size={15} />
            <span>Fórmulas Ópticas ({totalFormulas})</span>
          </button>

          <button
            type="button"
            onClick={() => setPestañaActiva('citas')}
            style={{
              padding: '0.75rem 0',
              background: 'none',
              border: 'none',
              borderBottom: pestañaActiva === 'citas' ? '2.5px solid var(--color-primario)' : '2.5px solid transparent',
              color: pestañaActiva === 'citas' ? 'var(--color-primario)' : 'var(--texto-secundario)',
              fontWeight: pestañaActiva === 'citas' ? 700 : 500,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              transition: 'all 0.15s ease',
            }}
          >
            <CalendarDays size={15} />
            <span>Citas y Consultas ({totalCitas})</span>
          </button>
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
                                            <strong>DP:</strong> {f.distancia_pupilar} mm
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
                                              <td style={{ padding: '0.4rem' }}>{f.eje_od ? `${f.eje_od}°` : '--'}</td>
                                              <td style={{ padding: '0.4rem' }}>{f.adicion_od || '--'}</td>
                                              <td style={{ padding: '0.4rem', color: '#10b981', fontWeight: 600 }}>{f.av_od || '20/20'}</td>
                                            </tr>
                                            <tr>
                                              <td style={{ padding: '0.4rem', fontWeight: 700, color: '#0284c7' }}>OI (Izquierdo)</td>
                                              <td style={{ padding: '0.4rem', fontWeight: 600 }}>{f.esfera_oi || '0.00'}</td>
                                              <td style={{ padding: '0.4rem', fontWeight: 600 }}>{f.cilindro_oi || '0.00'}</td>
                                              <td style={{ padding: '0.4rem' }}>{f.eje_oi ? `${f.eje_oi}°` : '--'}</td>
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
                              {cita.especialista || 'Por asignar'}
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
