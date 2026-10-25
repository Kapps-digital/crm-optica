'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  CalendarClock,
  Clock,
  UserCheck,
  AlertTriangle,
  CalendarCheck,
  MessageSquare,
  FileText,
} from 'lucide-react';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';
import { SelectorDesplegable } from '../comunes/SelectorDesplegable';
import { SelectorFecha } from '../comunes/SelectorFecha';
import { SelectorHoraPopover } from '../comunes/SelectorHoraPopover';
import type { Cita, EstadoCita } from '@/tipos/crm';
import { formatearTelefono, obtenerNombrePaciente, obtenerFechaHoyColombia } from '@/utilidades/formato';
import { obtenerOpticaSesion } from '@/servicios/api_crm';
import { obtenerMotivosDisponiblesOptica } from '@/constantes/motivos_citas';
import { OPCIONES_MOTIVO_CITA } from './ModalAgendarCita';

export interface DatosReprogramarCita {
  id: number;
  fecha_cita: string;
  hora_cita: string;
  motivo?: string;
  especialista?: string;
  observaciones?: string;
  estado?: EstadoCita;
  enviar_notificacion_whatsapp?: boolean;
}

interface PropiedadesModalReprogramarCita {
  abierto: boolean;
  cita: Cita | null;
  alCerrar: () => void;
  alGuardar: (datos: DatosReprogramarCita) => Promise<{ exito: boolean; error?: string } | void>;
}

export const ModalReprogramarCita: React.FC<PropiedadesModalReprogramarCita> = ({
  abierto,
  cita,
  alCerrar,
  alGuardar,
}) => {
  const [montado, setMontado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);

  const [fechaCita, setFechaCita] = useState('');
  const [horaCita, setHoraCita] = useState('');
  const [motivo, setMotivo] = useState('');
  const [especialista, setEspecialista] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [estado, setEstado] = useState<EstadoCita>('pendiente');
  const [enviarWhatsapp, setEnviarWhatsapp] = useState(true);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (abierto && cita) {
      setFechaCita(cita.fecha_cita || '');
      setHoraCita(cita.hora_cita || '');
      setMotivo(cita.motivo || 'Examen Visual y Control Anual');
      setEspecialista(cita.especialista || '');
      setObservaciones(cita.observaciones || '');
      setEstado(cita.estado || 'pendiente');
      setEnviarWhatsapp(true);
      setErrorValidacion(null);
    }
  }, [abierto, cita]);

  const manejarCierre = () => {
    setErrorValidacion(null);
    alCerrar();
  };

  useEffect(() => {
    const alPresionarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && abierto) {
        manejarCierre();
      }
    };
    window.addEventListener('keydown', alPresionarTecla);
    return () => window.removeEventListener('keydown', alPresionarTecla);
  }, [abierto]);

  if (!abierto || !cita || !montado || cita.estado === 'completada') return null;

  const optSesion = obtenerOpticaSesion();
  const motivosDisponibles = useMemo(() => {
    return obtenerMotivosDisponiblesOptica(optSesion?.motivos_citas_json);
  }, [optSesion?.motivos_citas_json]);

  const formularioCompleto =
    fechaCita.trim() !== '' &&
    horaCita.trim() !== '' &&
    motivo.trim() !== '' &&
    motivosDisponibles.includes(motivo.trim());

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formularioCompleto) return;

    setCargando(true);
    setErrorValidacion(null);
    try {
      const resultado = await alGuardar({
        id: cita.id,
        fecha_cita: fechaCita,
        hora_cita: horaCita.trim(),
        motivo: motivo.trim(),
        especialista: especialista.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
        estado,
        enviar_notificacion_whatsapp: enviarWhatsapp,
      });

      if (resultado && resultado.exito === false) {
        setErrorValidacion(resultado.error || 'Este paciente para ese día a esa hora ya tiene una cita asignada.');
        return;
      }

      manejarCierre();
    } catch (error: any) {
      console.error('Error al reprogramar cita:', error);
      setErrorValidacion(error?.message || 'Error al reprogramar la cita');
    } finally {
      setCargando(false);
    }
  };

  const fechaHoyString = obtenerFechaHoyColombia();

  const contenidoModal = (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) manejarCierre();
      }}
    >
      <div className="modal-tarjeta-clinica" style={{ maxWidth: '490px' }} role="dialog" aria-modal="true">
        {/* Cabecera Corporativa */}
        <div className="modal-cabecera-clinica" style={{ padding: '0.85rem 1.15rem' }}>
          <div className="modal-cabecera-izq">
            <div
              className="modal-icono-caja"
              style={{
                background: 'rgba(2, 132, 199, 0.12)',
                color: 'var(--color-primario)',
                borderColor: 'rgba(2, 132, 199, 0.25)',
                width: '34px',
                height: '34px',
              }}
            >
              <CalendarClock style={{ width: '18px', height: '18px' }} />
            </div>
            <div>
              <h3 className="modal-titulo-principal" style={{ fontSize: '0.95rem' }}>Reprogramar / Editar Cita</h3>
              <div className="modal-subtitulo-paciente" style={{ fontSize: '0.72rem' }}>
                <span>Paciente:</span>
                <strong>{obtenerNombrePaciente(cita)}</strong>
                <span className="modal-badge-paciente">Cita #{cita.id}</span>
                {cita.contacto_telefono && (
                  <span style={{ color: 'var(--texto-atenuado)' }}>• {formatearTelefono(cita.contacto_telefono)}</span>
                )}
              </div>
            </div>
          </div>

          <EtiquetaTooltip texto="Cerrar ventana (Esc)" posicion="abajo">
            <button
              type="button"
              onClick={manejarCierre}
              className="modal-btn-cerrar"
              aria-label="Cerrar modal"
            >
              <X style={{ width: '16px', height: '16px' }} />
            </button>
          </EtiquetaTooltip>
        </div>

        {/* Formulario */}
        <form onSubmit={manejarEnvio} style={{ display: 'contents' }}>
          <div className="modal-cuerpo-clinico" style={{ padding: '0.85rem 1.15rem', gap: '0.65rem' }}>
            {errorValidacion && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: 'var(--radio-md)',
                  padding: '0.65rem 0.9rem',
                  color: '#ef4444',
                  fontSize: '0.81rem',
                  fontWeight: 600,
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.1)',
                }}
              >
                <AlertTriangle style={{ width: '17px', height: '17px', flexShrink: 0, color: '#ef4444' }} />
                <span>{errorValidacion}</span>
              </div>
            )}

            <div className="modal-grid-parametros" style={{ gap: '0.55rem' }}>
              {/* 1. Selector de Nueva Fecha */}
              <div className="modal-campo-grupo">
                <label className="modal-label">
                  Fecha de la Cita <span style={{ color: 'var(--texto-atenuado, #94a3b8)' }}>*</span>:
                </label>
                <SelectorFecha
                  valor={fechaCita}
                  alCambiar={(nueva) => {
                    setFechaCita(nueva);
                    if (errorValidacion) setErrorValidacion(null);
                  }}
                  min={fechaHoyString}
                  placeholder="Seleccionar fecha..."
                  anchoMinimo="100%"
                />
              </div>

              {/* 2. Selector de Hora Clínico Popover */}
              <div className="modal-campo-grupo">
                <label className="modal-label">
                  Hora de Consulta <span style={{ color: 'var(--texto-atenuado, #94a3b8)' }}>*</span>:
                </label>
                <SelectorHoraPopover
                  valor={horaCita}
                  alCambiar={(nueva) => {
                    setHoraCita(nueva);
                    if (errorValidacion) setErrorValidacion(null);
                  }}
                  placeholder="Seleccionar hora..."
                />
              </div>

              {/* 3. Motivo de la Cita */}
              <div className="modal-campo-grupo col-span-2">
                <label className="modal-label">
                  Motivo de la Cita <span style={{ color: 'var(--texto-atenuado, #94a3b8)' }}>*</span>:
                </label>
                <SelectorDesplegable
                  valor={motivo}
                  alCambiar={(val) => setMotivo(val)}
                  opciones={motivosDisponibles.map((m: string) => ({ valor: m, etiqueta: m }))}
                  placeholder="Seleccionar motivo..."
                  anchoMinimo="100%"
                />
              </div>

              {/* 4. Especialista Asignado */}
              <div className="modal-campo-grupo">
                <label className="modal-label">Especialista / Optómetra:</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={especialista}
                    onChange={(e) => setEspecialista(e.target.value)}
                    placeholder="Nombre del especialista..."
                    className="modal-input"
                    style={{ paddingLeft: '2rem', height: '36px' }}
                  />
                  <UserCheck
                    style={{
                      position: 'absolute',
                      left: '0.65rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '14px',
                      height: '14px',
                      color: 'var(--texto-atenuado)',
                    }}
                  />
                </div>
              </div>

              {/* 5. Estado de la Cita */}
              <div className="modal-campo-grupo">
                <label className="modal-label">
                  Estado de la Cita <span style={{ color: 'var(--texto-atenuado, #94a3b8)' }}>*</span>:
                </label>
                <SelectorDesplegable
                  valor={estado}
                  alCambiar={(val) => setEstado(val as EstadoCita)}
                  opciones={[
                    { valor: 'pendiente', etiqueta: '🟡 Pendiente' },
                    { valor: 'confirmada', etiqueta: '🔵 Confirmada' },
                    { valor: 'completada', etiqueta: '🟢 Completada' },
                    { valor: 'cancelada', etiqueta: '🔴 Cancelada' },
                  ]}
                  placeholder="Estado..."
                  anchoMinimo="100%"
                />
              </div>

              {/* 6. Observaciones */}
              <div className="modal-campo-grupo col-span-2">
                <label className="modal-label">Observaciones Adicionales:</label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Detalles sobre dilatación pupilar, cambio de montura o requerimientos..."
                  rows={2}
                  className="modal-textarea"
                  style={{ minHeight: '52px', maxHeight: '90px' }}
                />
              </div>
            </div>

            {/* Notificación de WhatsApp de Reprogramación */}
            {cita.contacto_telefono && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.6rem 0.85rem',
                  background: 'var(--fondo-elevado)',
                  borderRadius: 'var(--radio-md)',
                  border: '1px solid var(--borde-tarjeta)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                onClick={() => setEnviarWhatsapp(!enviarWhatsapp)}
              >
                <input
                  type="checkbox"
                  id="chk-notificar-reprogramacion"
                  checked={enviarWhatsapp}
                  onChange={(e) => setEnviarWhatsapp(e.target.checked)}
                  style={{ accentColor: '#10b981', cursor: 'pointer', width: '15px', height: '15px' }}
                  onClick={(e) => e.stopPropagation()}
                />
                <label
                  htmlFor="chk-notificar-reprogramacion"
                  style={{
                    fontSize: '0.76rem',
                    color: 'var(--texto-principal)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    flex: 1,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MessageSquare style={{ width: '14px', height: '14px', color: '#10b981' }} />
                  <span>Notificar reprogramación al paciente por WhatsApp</span>
                </label>
              </div>
            )}
          </div>

          {/* Pie de acciones con diseño corporativo estandarizado */}
          <div className="modal-pie-clinico">
            <button
              type="button"
              onClick={manejarCierre}
              className="modal-btn-cancelar"
              disabled={cargando}
            >
              Cancelar
            </button>
            <EtiquetaTooltip
              texto={
                formularioCompleto
                  ? 'Guardar cambios y actualizar la cita médica'
                  : 'Diligencia la fecha, hora y motivo para habilitar el guardado'
              }
              posicion="arriba"
            >
              <div style={{ display: 'inline-block' }}>
                <button
                  type="submit"
                  disabled={!formularioCompleto || cargando}
                  className="modal-btn-guardar"
                  style={{
                    background: formularioCompleto
                      ? 'linear-gradient(135deg, var(--color-primario) 0%, var(--color-primario-oscuro) 100%)'
                      : 'var(--fondo-hover)',
                    color: formularioCompleto ? '#ffffff' : 'var(--texto-atenuado)',
                    boxShadow: formularioCompleto
                      ? '0 4px 14px rgba(2, 132, 199, 0.35)'
                      : 'none',
                    cursor: !formularioCompleto || cargando ? 'not-allowed' : 'pointer',
                    opacity: !formularioCompleto ? 0.6 : 1,
                  }}
                >
                  <CalendarCheck style={{ width: '15px', height: '15px' }} />
                  <span>{cargando ? 'Guardando Cambios...' : 'Guardar Reprogramación'}</span>
                </button>
              </div>
            </EtiquetaTooltip>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(contenidoModal, document.body) : null;
};
