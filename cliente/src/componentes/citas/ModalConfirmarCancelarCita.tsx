'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarX, X, XCircle, Clock, User, Stethoscope } from 'lucide-react';
import type { Cita } from '@/tipos/crm';
import { formatearTelefono } from '@/utilidades/formato';

interface PropiedadesModalConfirmarCancelarCita {
  abierto: boolean;
  cita: Cita | null;
  alCerrar: () => void;
  alConfirmar: (citaId: number) => Promise<void>;
}

/**
 * Modal Corporativo Premium para Confirmación de Cancelación de Cita.
 * Alineado estrictamente con el sistema de diseño visual corporativo del CRM.
 */
export const ModalConfirmarCancelarCita: React.FC<PropiedadesModalConfirmarCancelarCita> = ({
  abierto,
  cita,
  alCerrar,
  alConfirmar,
}) => {
  const [montado, setMontado] = useState(false);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  // Cerrar al pulsar Escape
  useEffect(() => {
    if (!abierto) return;
    const manejarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !procesando) {
        alCerrar();
      }
    };
    window.addEventListener('keydown', manejarTecla);
    return () => window.removeEventListener('keydown', manejarTecla);
  }, [abierto, alCerrar, procesando]);

  if (!montado || !abierto || !cita) return null;

  const manejarConfirmacion = async () => {
    try {
      setProcesando(true);
      await alConfirmar(cita.id);
      alCerrar();
    } catch (error) {
      console.error('Error al confirmar cancelación de cita:', error);
    } finally {
      setProcesando(false);
    }
  };

  let fechaFormateada = cita.fecha_cita;
  if (cita.fecha_cita && cita.fecha_cita.includes('-')) {
    const partes = cita.fecha_cita.split('-');
    if (partes.length === 3) {
      fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
  }

  const inicialesPaciente = (() => {
    const nombre = (cita.contacto_nombre || 'Paciente').trim();
    const partes = nombre.split(/\s+/);
    if (partes.length >= 2) {
      return (partes[0][0] + partes[1][0]).toUpperCase();
    }
    return nombre.substring(0, 2).toUpperCase();
  })();

  const contenidoModal = (
    <div
      className="modal-cierre-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !procesando) {
          alCerrar();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-cancelar-titulo"
    >
      <div className="modal-cierre-tarjeta" style={{ maxWidth: '460px' }}>
        {/* Botón Cerrar (X) */}
        <button
          type="button"
          className="modal-cierre-btn-cerrar"
          onClick={alCerrar}
          disabled={procesando}
          aria-label="Cerrar modal"
        >
          <X style={{ width: '18px', height: '18px' }} />
        </button>

        {/* Icono Hero Luminous de Cancelación */}
        <div className="modal-cierre-icono-hero">
          <div className="modal-cierre-icono-circulo">
            <CalendarX style={{ width: '28px', height: '28px' }} />
          </div>
        </div>

        {/* Título y Descripción Corporativa */}
        <h2 id="modal-cancelar-titulo" className="modal-cierre-titulo">
          ¿Deseas cancelar esta cita médica?
        </h2>
        <p className="modal-cierre-descripcion">
          Estás a punto de cancelar la cita de consulta para{' '}
          <strong>{cita.contacto_nombre || 'el paciente'}</strong>. La cita quedará registrada como cancelada
          en el historial clínico y se liberará el turno de agenda.
        </p>

        {/* Tarjeta Informativa de la Cita */}
        <div
          className="modal-cierre-perfil-chip"
          style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.65rem' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              className="modal-cierre-avatar"
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
              }}
            >
              {inicialesPaciente}
            </div>
            <div className="modal-cierre-perfil-info">
              <span className="modal-cierre-perfil-nombre">
                {cita.contacto_nombre || 'Paciente'}
              </span>
              <span className="modal-cierre-perfil-rol">
                {cita.contacto_telefono ? formatearTelefono(cita.contacto_telefono) : 'Sin teléfono'} • #{cita.contacto_id}
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.45rem',
              paddingTop: '0.5rem',
              borderTop: '1px solid var(--borde-tarjeta)',
              fontSize: '0.78rem',
              color: 'var(--texto-secundario)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Clock size={13} style={{ color: 'var(--color-primario, #0284c7)' }} />
              <span>{fechaFormateada} - {cita.hora_cita}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Stethoscope size={13} style={{ color: '#10b981' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cita.especialista || 'Sin optómetra'}
              </span>
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="modal-cierre-acciones">
          <button
            type="button"
            className="modal-cierre-btn-cancelar"
            onClick={alCerrar}
            disabled={procesando}
            autoFocus
          >
            No, conservar cita
          </button>
          <button
            type="button"
            className="modal-cierre-btn-confirmar"
            onClick={manejarConfirmacion}
            disabled={procesando}
          >
            <XCircle style={{ width: '16px', height: '16px' }} />
            <span>{procesando ? 'Cancelando...' : 'Sí, cancelar cita'}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(contenidoModal, document.body) : null;
};
