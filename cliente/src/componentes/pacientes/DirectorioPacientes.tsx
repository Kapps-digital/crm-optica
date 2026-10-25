'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Plus,
  Glasses,
  Phone,
  Mail,
  Calendar,
  UserCheck,
  MessageSquare,
  IdCard,
  UserPlus,
  Users,
  Edit,
  Sparkles,
  Clock,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';
import { ModalRegistrarPaciente } from './ModalRegistrarPaciente';
import { ModalHistorialClinico } from './ModalHistorialClinico';
import { BarraPaginacionTabla } from '../comunes/BarraPaginacionTabla';
import { FiltroBusqueda } from '../comunes/FiltroBusqueda';
import type { Contacto, Conversacion } from '@/tipos/crm';
import { formatearTelefono, formatearSeparadorMiles, esFichaIncompleta } from '@/utilidades/formato';

interface PropiedadesDirectorioPacientes {
  pacientes: Contacto[];
  cargando: boolean;
  alAbrirNuevaFormula: (contacto: Contacto) => void;
  alRecargarPacientes?: () => void;
  alSeleccionarContactoChat?: (contactoId: number) => void;
}

export const DirectorioPacientes: React.FC<PropiedadesDirectorioPacientes> = ({
  pacientes,
  cargando,
  alAbrirNuevaFormula,
  alRecargarPacientes,
  alSeleccionarContactoChat,
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [pestañaActiva, setPestañaActiva] = useState<'pacientes' | 'contactos' | 'incompletos' | 'todos'>('pacientes');

  // Estados de paginación estandarizada (predeterminado: 5 registros)
  const [paginaActual, setPaginaActual] = useState(1);
  const [limitePorPagina, setLimitePorPagina] = useState(5);

  // Estado del modal de creación / conversión
  const [modalRegistroAbierto, setModalRegistroAbierto] = useState(false);
  const [contactoSeleccionadoParaConvertir, setContactoSeleccionadoParaConvertir] = useState<Contacto | null>(null);

  // Estado del modal de historial clínico
  const [modalHistorialAbierto, setModalHistorialAbierto] = useState(false);
  const [pacienteSeleccionadoHistorial, setPacienteSeleccionadoHistorial] = useState<Contacto | null>(null);

  const abrirHistorialPaciente = (contacto: Contacto) => {
    setPacienteSeleccionadoHistorial(contacto);
    setModalHistorialAbierto(true);
  };

  // Reiniciar a la primera página al cambiar filtros o términos de búsqueda
  useEffect(() => {
    setPaginaActual(1);
  }, [pestañaActiva, busqueda]);

  // Clasificación de contactos con conversión numérica segura
  const listaPacientesClinicos = useMemo(() => {
    return pacientes.filter((p) => {
      const formulas = Number(p.total_formulas || 0);
      const citas = Number(p.total_citas || 0);
      return Boolean(p.es_paciente) || formulas > 0 || citas > 0;
    });
  }, [pacientes]);

  const listaContactosChat = useMemo(() => {
    return pacientes.filter((p) => {
      const formulas = Number(p.total_formulas || 0);
      const citas = Number(p.total_citas || 0);
      return !p.es_paciente && formulas === 0 && citas === 0;
    });
  }, [pacientes]);

  // Pacientes clínicos o con citas agendadas que aún no tienen cédula/documento diligenciado
  const listaFichaIncompleta = useMemo(() => {
    return pacientes.filter((p) => {
      const formulas = Number(p.total_formulas || 0);
      const citas = Number(p.total_citas || 0);
      const esPaciente = Boolean(p.es_paciente) || formulas > 0 || citas > 0;
      return esPaciente && esFichaIncompleta(p);
    });
  }, [pacientes]);

  // Selección de lista según pestaña
  const listaSegunPestana = useMemo(() => {
    if (pestañaActiva === 'pacientes') return listaPacientesClinicos;
    if (pestañaActiva === 'contactos') return listaContactosChat;
    if (pestañaActiva === 'incompletos') return listaFichaIncompleta;
    return pacientes;
  }, [pestañaActiva, listaPacientesClinicos, listaContactosChat, listaFichaIncompleta, pacientes]);

  // Filtro de búsqueda
  const listaFiltrada = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return listaSegunPestana;

    return listaSegunPestana.filter((p) => {
      const nom = (p.nombre_completo || p.nombre || '').toLowerCase();
      const ced = ((p.cedula || p.documento || '') + ' ' + (p.tipo_documento || '')).toLowerCase();
      const tel = (p.telefono || '').toLowerCase();
      const email = (p.correo || '').toLowerCase();
      return nom.includes(termino) || ced.includes(termino) || tel.includes(termino) || email.includes(termino);
    });
  }, [listaSegunPestana, busqueda]);

  // Ordenamiento alfabético estricto por nombre (A-Z) respetando acentos y orden natural numérico
  const listaOrdenada = useMemo(() => {
    return [...listaFiltrada].sort((a, b) => {
      const nombreA = (a.nombre_completo || a.nombre || '').trim();
      const nombreB = (b.nombre_completo || b.nombre || '').trim();
      return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base', numeric: true });
    });
  }, [listaFiltrada]);

  // Segmentación por páginas de la lista ordenada alfabéticamente
  const totalRegistros = listaOrdenada.length;
  const listaPaginada = useMemo(() => {
    const inicio = (paginaActual - 1) * limitePorPagina;
    return listaOrdenada.slice(inicio, inicio + limitePorPagina);
  }, [listaOrdenada, paginaActual, limitePorPagina]);

  const abrirModalNuevoPaciente = () => {
    setContactoSeleccionadoParaConvertir(null);
    setModalRegistroAbierto(true);
  };

  const abrirModalConvertirOEditar = (contacto: Contacto) => {
    setContactoSeleccionadoParaConvertir(contacto);
    setModalRegistroAbierto(true);
  };

  const manejarGuardadoExitoso = () => {
    if (alRecargarPacientes) {
      alRecargarPacientes();
    }
  };

  return (
    <section
      id="vista-pacientes"
      style={{
        padding: '1.25rem 1.75rem',
        overflowY: 'auto',
        height: 'calc(100vh - 48px)',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Contenedor Principal */}
      <div
        style={{
          background: 'var(--fondo-tarjeta)',
          border: '1px solid var(--borde-tarjeta)',
          borderRadius: 'var(--radio-lg, 12px)',
          padding: '1.25rem 1.5rem',
          boxShadow: 'var(--sombra-sm, 0 1px 3px rgba(0,0,0,0.05))',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* Barra Superior de la Tabla: Pestañas de Segmentación + Buscador + Botón Nuevo Paciente */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.85rem',
          }}
        >
          {/* Pestañas de Segmentación (Tabs Corporativos) */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'var(--fondo-elevado)',
              padding: '3px',
              borderRadius: 'var(--radio-md, 8px)',
              border: '1px solid var(--borde-tarjeta)',
              gap: '3px',
            }}
          >
            {/* Pestaña: Pacientes */}
            <button
              type="button"
              onClick={() => setPestañaActiva('pacientes')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radio-sm, 6px)',
                border: 'none',
                background: pestañaActiva === 'pacientes' ? 'var(--fondo-tarjeta)' : 'transparent',
                color: pestañaActiva === 'pacientes' ? 'var(--color-primario)' : 'var(--texto-secundario)',
                boxShadow: pestañaActiva === 'pacientes' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <UserCheck size={14} />
              <span>Pacientes</span>
              <span
                style={{
                  background: pestañaActiva === 'pacientes' ? 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.14)' : 'rgba(0, 0, 0, 0.06)',
                  color: pestañaActiva === 'pacientes' ? 'var(--color-primario)' : 'var(--texto-atenuado)',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '0.08rem 0.4rem',
                  borderRadius: '10px',
                }}
              >
                {listaPacientesClinicos.length}
              </span>
            </button>

            {/* Pestaña: Contactos */}
            <button
              type="button"
              onClick={() => setPestañaActiva('contactos')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radio-sm, 6px)',
                border: 'none',
                background: pestañaActiva === 'contactos' ? 'var(--fondo-tarjeta)' : 'transparent',
                color: pestañaActiva === 'contactos' ? 'var(--color-primario)' : 'var(--texto-secundario)',
                boxShadow: pestañaActiva === 'contactos' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <MessageSquare size={14} />
              <span>Contactos</span>
              <span
                style={{
                  background: pestañaActiva === 'contactos' ? 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.14)' : 'rgba(0, 0, 0, 0.06)',
                  color: pestañaActiva === 'contactos' ? 'var(--color-primario)' : 'var(--texto-atenuado)',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '0.08rem 0.4rem',
                  borderRadius: '10px',
                }}
              >
                {listaContactosChat.length}
              </span>
            </button>

            {/* Pestaña: Datos Incompletos */}
            {(() => {
              const tieneIncompletos = listaFichaIncompleta.length > 0;
              const estaActivo = pestañaActiva === 'incompletos';

              const colorTexto = tieneIncompletos
                ? '#d97706'
                : estaActivo
                  ? 'var(--color-primario)'
                  : 'var(--texto-secundario)';

              const colorIcono = tieneIncompletos
                ? '#d97706'
                : estaActivo
                  ? 'var(--color-primario)'
                  : 'var(--texto-atenuado)';

              const fondoBadge = tieneIncompletos
                ? 'rgba(245, 158, 11, 0.16)'
                : estaActivo
                  ? 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.14)'
                  : 'rgba(0, 0, 0, 0.06)';

              const colorBadge = tieneIncompletos
                ? '#d97706'
                : estaActivo
                  ? 'var(--color-primario)'
                  : 'var(--texto-atenuado)';

              return (
                <button
                  type="button"
                  onClick={() => setPestañaActiva('incompletos')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radio-sm, 6px)',
                    border: 'none',
                    background: estaActivo ? 'var(--fondo-tarjeta)' : 'transparent',
                    color: colorTexto,
                    boxShadow: estaActivo ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <AlertTriangle size={14} style={{ color: colorIcono }} />
                  <span>Datos Incompletos</span>
                  <span
                    style={{
                      background: fondoBadge,
                      color: colorBadge,
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '0.08rem 0.4rem',
                      borderRadius: '10px',
                    }}
                  >
                    {listaFichaIncompleta.length}
                  </span>
                </button>
              );
            })()}

            {/* Pestaña: Todos */}
            <button
              type="button"
              onClick={() => setPestañaActiva('todos')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radio-sm, 6px)',
                border: 'none',
                background: pestañaActiva === 'todos' ? 'var(--fondo-tarjeta)' : 'transparent',
                color: pestañaActiva === 'todos' ? 'var(--texto-principal)' : 'var(--texto-secundario)',
                boxShadow: pestañaActiva === 'todos' ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Users size={14} />
              <span>Todos</span>
              <span
                style={{
                  background: 'rgba(0, 0, 0, 0.06)',
                  color: 'var(--texto-atenuado)',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '0.08rem 0.4rem',
                  borderRadius: '10px',
                }}
              >
                {pacientes.length}
              </span>
            </button>
          </div>

          {/* Grupo Derecho: Buscador + Botón Nuevo Paciente (Solo Icono) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {/* Buscador de Contactos y Pacientes */}
            <FiltroBusqueda
              valor={busqueda}
              alCambiar={setBusqueda}
              placeholder={
                pestañaActiva === 'pacientes'
                  ? 'Buscar por nombre, cédula o teléfono...'
                  : 'Buscar prospecto o WhatsApp...'
              }
              ancho="280px"
              alto="34px"
            />

            {/* Botón Principal Nuevo Paciente: Solo Icono con Tooltip */}
            <EtiquetaTooltip texto="Crear nuevo paciente" posicion="abajo">
              <button
                type="button"
                id="btn-crear-nuevo-paciente"
                onClick={abrirModalNuevoPaciente}
                aria-label="Crear nuevo paciente"
                style={{
                  width: '34px',
                  height: '34px',
                  padding: 0,
                  borderRadius: 'var(--radio-md, 8px)',
                  border: 'none',
                  background: 'var(--color-primario)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                <UserPlus size={16} />
              </button>
            </EtiquetaTooltip>
          </div>
        </div>

        {/* Mensaje Contextual de la Pestaña */}
        {pestañaActiva === 'contactos' && (
          <div
            style={{
              padding: '0.65rem 0.95rem',
              borderRadius: 'var(--radio-md, 8px)',
              background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.07)',
              border: '1px solid rgba(var(--color-primario-rgb, 2, 132, 199), 0.22)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.77rem',
              color: 'var(--texto-principal)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={15} style={{ color: 'var(--color-primario)', flexShrink: 0 }} />
              <span>
                <strong>Base de Contactos:</strong> Personas que han escrito o mostrado interés por cualquier canal pero aún no tienen ficha clínica formal. Pulsa <strong>&quot;Registrar Paciente&quot;</strong> para completar su documento y datos.
              </span>
            </div>
          </div>
        )}

        {pestañaActiva === 'incompletos' && (
          <div
            style={{
              padding: '0.65rem 0.95rem',
              borderRadius: 'var(--radio-md, 8px)',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.77rem',
              color: 'var(--texto-principal)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={15} style={{ color: '#d97706', flexShrink: 0 }} />
              <span>
                <strong>Pacientes con Datos Incompletos:</strong> Pacientes con citas agendadas o historial clínico que aún no tienen registrada su cédula o información completa. Pulsa el botón de edición <strong>(icono ámbar)</strong> para diligenciar su información.
              </span>
            </div>
          </div>
        )}

        {/* Tabla de Datos */}
        <div style={{ overflowX: 'auto', border: '1px solid var(--borde-tarjeta)', borderRadius: 'var(--radio-md, 8px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
            <thead>
              <tr
                style={{
                  background: 'var(--fondo-elevado)',
                  borderBottom: '1px solid var(--borde-tarjeta)',
                  color: 'var(--texto-atenuado)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                <th style={{ padding: '0.65rem 0.85rem', width: pestañaActiva === 'contactos' ? '40%' : '28%' }}>
                  {pestañaActiva === 'contactos' ? (
                    'Contacto'
                  ) : (
                    <>
                      Nombre <span className="ampersand-titular">&</span> Documento
                    </>
                  )}
                </th>
                <th style={{ padding: '0.65rem 0.85rem', width: pestañaActiva === 'contactos' ? '30%' : '20%' }}>Teléfono / Celular</th>
                {pestañaActiva !== 'contactos' && <th style={{ padding: '0.65rem 0.85rem', width: '12%', minWidth: '85px' }}>Edad / Sexo</th>}
                <th style={{ padding: '0.65rem 0.85rem', width: pestañaActiva === 'contactos' ? '18%' : '26%' }}>
                  {pestañaActiva === 'contactos' ? 'Estado' : 'Historial Clínico'}
                </th>
                <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center', width: pestañaActiva === 'contactos' ? '12%' : '14%', minWidth: '100px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={5} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--texto-atenuado)' }}>
                    Cargando directorio...
                  </td>
                </tr>
              ) : listaFiltrada.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--texto-atenuado)' }}>
                    {busqueda
                      ? 'No se encontraron resultados para la búsqueda.'
                      : pestañaActiva === 'contactos'
                        ? 'No hay contactos pendientes de registrar como paciente.'
                        : pestañaActiva === 'incompletos'
                          ? '¡Excelente! No hay pacientes con datos incompletos pendientes por registrar.'
                          : 'No hay pacientes registrados aún. Pulsa "+ Nuevo Paciente" para crear el primero.'}
                  </td>
                </tr>
              ) : (
                listaPaginada.map((item) => {
                  const esPacienteClinico = item.es_paciente === true || (item.total_formulas && item.total_formulas > 0) || (item.total_citas && item.total_citas > 0);

                  return (
                    <tr
                      key={item.id}
                      onClick={() => abrirHistorialPaciente(item)}
                      className="fila-paciente-interactiva"
                      style={{
                        borderBottom: '1px solid var(--borde-tarjeta)',
                        transition: 'background 0.12s ease',
                        cursor: 'pointer',
                      }}
                    >
                      {/* 1. Columna Paciente / Nombre / Cédula */}
                      <td style={{ padding: '0.75rem 0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div
                            className="avatar-contacto"
                            style={{
                              width: '34px',
                              height: '34px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              borderRadius: '8px',
                              background: esPacienteClinico
                                ? 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)'
                                : 'rgba(217, 119, 6, 0.12)',
                              color: esPacienteClinico ? 'var(--color-primario)' : '#d97706',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {(item.nombre_completo || item.nombre || 'P').substring(0, 2).toUpperCase()}
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <strong
                                style={{
                                  display: 'block',
                                  color: 'var(--texto-principal)',
                                  fontSize: '0.82rem',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {item.nombre_completo || item.nombre || 'Contacto sin nombre'}
                              </strong>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.15rem' }}>
                              {item.cedula || item.documento ? (
                                <span
                                  style={{
                                    fontSize: '0.70rem',
                                    color: 'var(--texto-secundario)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                  }}
                                >
                                  <IdCard size={11} style={{ color: 'var(--color-primario)' }} />
                                  <span>{(item.tipo_documento || 'CC').toUpperCase()}: {formatearSeparadorMiles(item.cedula || item.documento)}</span>
                                </span>
                              ) : esPacienteClinico ? (
                                <EtiquetaTooltip
                                  texto={
                                    Number(item.total_citas || 0) > 0
                                      ? 'Paciente con cita agendada en recepción, pendiente registrar documento y datos clínicos'
                                      : 'Ficha clínica incompleta: falta registrar documento de identidad'
                                  }
                                  posicion="arriba"
                                >
                                  <span
                                    style={{
                                      fontSize: '0.67rem',
                                      fontWeight: 600,
                                      color: '#d97706',
                                      background: 'rgba(245, 158, 11, 0.12)',
                                      padding: '0.12rem 0.45rem',
                                      borderRadius: '5px',
                                      border: '1px solid rgba(245, 158, 11, 0.28)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                    }}
                                  >
                                    <AlertTriangle size={11} />
                                    <span>
                                      {Number(item.total_citas || 0) > 0
                                        ? '⚠️ Cita · Datos incompletos'
                                        : '⚠️ Datos incompletos'}
                                    </span>
                                  </span>
                                </EtiquetaTooltip>
                              ) : (
                                <span style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)' }}>
                                  Contacto ID #{item.id}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Columna Contacto: Teléfono y Correo */}
                      <td style={{ padding: '0.75rem 0.85rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0, alignItems: 'flex-start' }}>
                          {item.telefono ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                color: 'var(--texto-principal)',
                                fontSize: '0.77rem',
                                fontWeight: 500,
                              }}
                            >
                              <Phone size={12} style={{ color: '#10b981', flexShrink: 0 }} />
                              {formatearTelefono(item.telefono)}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--texto-atenuado)', fontSize: '0.74rem' }}>--</span>
                          )}

                          {item.correo ? (
                            <EtiquetaTooltip
                              texto={item.correo}
                              posicion="arriba"
                              style={{ justifyContent: 'flex-start', width: 'fit-content', maxWidth: '100%' }}
                            >
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  color: 'var(--texto-atenuado)',
                                  fontSize: '0.71rem',
                                  maxWidth: '175px',
                                  cursor: 'default',
                                }}
                              >
                                <Mail size={12} style={{ flexShrink: 0 }} />
                                <span
                                  style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {item.correo}
                                </span>
                              </span>
                            </EtiquetaTooltip>
                          ) : null}
                        </div>
                      </td>

                      {/* 3. Columna Edad / Sexo (Solo si no es pestaña contactos exclusiva) */}
                      {pestañaActiva !== 'contactos' && (
                        <td style={{ padding: '0.75rem 0.85rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            {item.edad ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  color: 'var(--texto-secundario)',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <Calendar size={12} style={{ color: 'var(--texto-atenuado)', flexShrink: 0 }} />
                                <span style={{ whiteSpace: 'nowrap' }}>{item.edad} años</span>
                              </span>
                            ) : (
                              <span style={{ color: 'var(--texto-atenuado)', fontSize: '0.74rem', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                                --
                              </span>
                            )}
                            {item.sexo && (
                              <span
                                style={{
                                  fontSize: '0.67rem',
                                  fontWeight: 600,
                                  color: item.sexo === 'femenino' ? '#db2777' : 'var(--color-primario)',
                                  textTransform: 'capitalize',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {item.sexo === 'femenino' ? 'Femenino' : 'Masculino'}
                              </span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* 4. Columna Historial Clínico o Estado de Prospecto */}
                      <td style={{ padding: '0.75rem 0.85rem' }}>
                        {esPacienteClinico ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  color: (item.total_formulas || 0) > 0 ? 'var(--color-primario)' : 'var(--texto-atenuado)',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                }}
                              >
                                {(item.total_formulas || 0) > 0
                                  ? `${item.total_formulas} ${Number(item.total_formulas) === 1 ? 'fórmula' : 'fórmulas'}`
                                  : 'Sin fórmulas'}
                              </span>

                              {item.ultimo_tipo_lente && (
                                <EtiquetaTooltip
                                  texto={item.ultimo_tipo_lente}
                                  posicion="arriba"
                                  style={{ minWidth: 0, maxWidth: '100%', justifyContent: 'flex-start' }}
                                >
                                  <span
                                    style={{
                                      background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.08)',
                                      color: 'var(--color-primario)',
                                      padding: '0.08rem 0.4rem',
                                      borderRadius: '4px',
                                      fontSize: '0.68rem',
                                      fontWeight: 600,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      display: 'inline-block',
                                      maxWidth: '150px',
                                      cursor: 'default',
                                    }}
                                  >
                                    {item.ultimo_tipo_lente}
                                  </span>
                                </EtiquetaTooltip>
                              )}
                            </div>

                            {item.ultima_formula_fecha && (
                              <span style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)' }}>
                                Última consulta: {new Date(item.ultima_formula_fecha).toLocaleDateString()}
                              </span>
                            )}

                            {Number(item.total_citas || 0) > 0 && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  color: esFichaIncompleta(item) ? '#d97706' : 'var(--texto-secundario)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  fontWeight: 500,
                                }}
                              >
                                <Calendar size={11} />
                                <span>{item.total_citas} {item.total_citas === 1 ? 'cita agendada' : 'citas agendadas'}</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                background: 'rgba(217, 119, 6, 0.1)',
                                color: '#b45309',
                                border: '1px solid rgba(217, 119, 6, 0.25)',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '12px',
                                fontSize: '0.69rem',
                                fontWeight: 600,
                              }}
                            >
                              <Clock size={11} />
                              <span>Solo Mensajería</span>
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 5. Columna Acciones */}
                      <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', justifyContent: 'center' }}>
                          {/* Si NO es paciente formal, botón destacado para convertir a paciente */}
                          {!esPacienteClinico ? (
                            <EtiquetaTooltip texto="Completar datos personales y registrar como paciente" posicion="arriba">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirModalConvertirOEditar(item);
                                }}
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  padding: 0,
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                  color: '#ffffff',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
                                  transition: 'all 0.15s ease',
                                }}
                                aria-label="Completar datos personales y registrar como paciente"
                              >
                                <UserPlus size={14} />
                              </button>
                            </EtiquetaTooltip>
                          ) : (
                            <>
                              {/* Botón Nueva Fórmula con Icono Gafas */}
                              <EtiquetaTooltip texto={`Registrar fórmula óptica para ${item.nombre || 'el paciente'}`} posicion="arriba">
                                <button
                                  type="button"
                                  className="btn-primario-optica"
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    padding: 0,
                                    borderRadius: '6px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    alAbrirNuevaFormula(item);
                                  }}
                                  aria-label={`Registrar fórmula óptica para ${item.nombre || 'el paciente'}`}
                                >
                                  <Glasses size={14} />
                                </button>
                              </EtiquetaTooltip>

                              {/* Botón Editar Datos del Paciente / Alerta de Datos Incompletos */}
                              {(() => {
                                const fichaIncompleta = esFichaIncompleta(item);
                                return (
                                  <EtiquetaTooltip
                                    texto={
                                      fichaIncompleta
                                        ? '⚠️ Ficha incompleta: pulsar para registrar documento y datos clínicos'
                                        : 'Editar datos del paciente'
                                    }
                                    posicion="arriba"
                                  >
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        abrirModalConvertirOEditar(item);
                                      }}
                                      style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '6px',
                                        border: fichaIncompleta
                                          ? '1px solid rgba(245, 158, 11, 0.5)'
                                          : '1px solid var(--borde-tarjeta)',
                                        background: fichaIncompleta
                                          ? 'rgba(245, 158, 11, 0.14)'
                                          : 'var(--fondo-elevado)',
                                        color: fichaIncompleta ? '#d97706' : 'var(--texto-secundario)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                      }}
                                      aria-label={fichaIncompleta ? 'Completar datos de ficha incompleta' : 'Editar datos del paciente'}
                                    >
                                      <Edit size={13} />
                                    </button>
                                  </EtiquetaTooltip>
                                );
                              })()}
                            </>
                          )}

                          {/* Botón Abrir Chat si existe la función */}
                          {alSeleccionarContactoChat && (
                            <EtiquetaTooltip texto="Abrir Chat" posicion="arriba">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  alSeleccionarContactoChat(item.id);
                                }}
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  background: 'rgba(16, 185, 129, 0.08)',
                                  color: '#059669',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                                aria-label="Abrir conversación en chat"
                              >
                                <MessageSquare size={13} />
                              </button>
                            </EtiquetaTooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Barra de Paginación Estandarizada */}
        <BarraPaginacionTabla
          totalRegistros={totalRegistros}
          paginaActual={paginaActual}
          limitePorPagina={limitePorPagina}
          alCambiarPagina={setPaginaActual}
          alCambiarLimite={setLimitePorPagina}
          cantidadVisibles={listaPaginada.length}
        />
      </div>

      {/* Modal para Crear o Convertir Paciente */}
      <ModalRegistrarPaciente
        abierto={modalRegistroAbierto}
        alCerrar={() => setModalRegistroAbierto(false)}
        alGuardarExitoso={manejarGuardadoExitoso}
        contactoParaConvertir={contactoSeleccionadoParaConvertir}
      />

      {/* Modal de Historial Clínico del Paciente */}
      <ModalHistorialClinico
        abierto={modalHistorialAbierto}
        contacto={pacienteSeleccionadoHistorial}
        alCerrar={() => {
          setModalHistorialAbierto(false);
          setPacienteSeleccionadoHistorial(null);
        }}
        alAbrirNuevaFormula={alAbrirNuevaFormula}
      />
    </section>
  );
};
