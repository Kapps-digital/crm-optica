'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, CheckCircle, Trash2, Power } from 'lucide-react';

export interface PropiedadesModalConfirmacionAccion {
  abierto: boolean;
  alCerrar: () => void;
  alConfirmar: () => Promise<void> | void;
  titulo: string;
  descripcion: string | React.ReactNode;
  textoConfirmar?: string;
  textoCancelar?: string;
  icono?: React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>;
  colorHero?: 'peligro' | 'advertencia' | 'primario';
  datosChip?: {
    iniciales?: string;
    titulo: string;
    subtitulo?: string;
    etiquetaTag?: string;
  };
}

/**
 * ModalConfirmacionAccion
 * Componente modal corporativo premium estandarizado para confirmaciones de borrado,
 * desactivación o acciones críticas en el CRM.
 */
export const ModalConfirmacionAccion: React.FC<PropiedadesModalConfirmacionAccion> = ({
  abierto,
  alCerrar,
  alConfirmar,
  titulo,
  descripcion,
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  icono: IconoHero,
  colorHero = 'peligro',
  datosChip,
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

  if (!montado || !abierto) return null;

  const manejarConfirmacion = async () => {
    try {
      setProcesando(true);
      await alConfirmar();
      alCerrar();
    } catch (error) {
      console.error('Error al confirmar acción:', error);
    } finally {
      setProcesando(false);
    }
  };

  const iniciales = (() => {
    if (datosChip?.iniciales) return datosChip.iniciales;
    if (datosChip?.titulo) {
      const partes = datosChip.titulo.trim().split(/\s+/);
      if (partes.length >= 2) {
        return (partes[0][0] + partes[1][0]).toUpperCase();
      }
      return datosChip.titulo.substring(0, 2).toUpperCase();
    }
    return 'CR';
  })();

  const colorIcono =
    colorHero === 'peligro'
      ? '#ef4444'
      : colorHero === 'advertencia'
      ? '#f59e0b'
      : 'var(--color-primario, #0284c7)';

  const contenidoModal = (
    <div
      className="modal-cierre-backdrop"
      style={{ zIndex: 10000000 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !procesando) {
          alCerrar();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-cierre-tarjeta" style={{ maxWidth: '450px' }}>
        {/* Botón Cerrar (X) */}
        <button
          type="button"
          className="modal-cierre-btn-cerrar"
          onClick={alCerrar}
          disabled={procesando}
          aria-label="Cerrar ventana"
        >
          <X style={{ width: '18px', height: '18px' }} />
        </button>

        {/* Icono Hero Luminous */}
        <div className="modal-cierre-icono-hero">
          <div
            className="modal-cierre-icono-circulo"
            style={{
              borderColor: colorHero === 'peligro' ? 'rgba(239, 68, 68, 0.25)' : undefined,
              boxShadow:
                colorHero === 'peligro'
                  ? '0 0 25px rgba(239, 68, 68, 0.2)'
                  : undefined,
            }}
          >
            {IconoHero ? (
              <IconoHero size={26} style={{ color: colorIcono }} />
            ) : colorHero === 'peligro' ? (
              <Trash2 size={26} style={{ color: '#ef4444' }} />
            ) : colorHero === 'advertencia' ? (
              <AlertTriangle size={26} style={{ color: '#f59e0b' }} />
            ) : (
              <CheckCircle size={26} style={{ color: 'var(--color-primario)' }} />
            )}
          </div>
        </div>

        {/* Título y Descripción Corporativa */}
        <h2 className="modal-cierre-titulo" style={{ fontSize: '1.15rem' }}>
          {titulo}
        </h2>
        <div className="modal-cierre-descripcion">
          {descripcion}
        </div>

        {/* Tarjeta Informativa (Chip) si se provee */}
        {datosChip && (
          <div className="modal-cierre-perfil-chip" style={{ marginTop: '1rem', marginBottom: '1.25rem' }}>
            <div
              className="modal-cierre-avatar"
              style={{
                background:
                  colorHero === 'peligro'
                    ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
                    : 'var(--color-primario, #0284c7)',
              }}
            >
              {iniciales}
            </div>
            <div className="modal-cierre-perfil-info">
              <span className="modal-cierre-perfil-nombre">{datosChip.titulo}</span>
              {datosChip.subtitulo && (
                <span className="modal-cierre-perfil-rol">{datosChip.subtitulo}</span>
              )}
            </div>
            {datosChip.etiquetaTag && (
              <div
                className="modal-cierre-seguridad-tag"
                style={{
                  background:
                    colorHero === 'peligro' ? 'rgba(239, 68, 68, 0.1)' : undefined,
                  color: colorHero === 'peligro' ? '#ef4444' : undefined,
                  borderColor:
                    colorHero === 'peligro' ? 'rgba(239, 68, 68, 0.25)' : undefined,
                }}
              >
                <span>{datosChip.etiquetaTag}</span>
              </div>
            )}
          </div>
        )}

        {/* Botones de Acción */}
        <div className="modal-cierre-acciones">
          <button
            type="button"
            className="modal-cierre-btn-cancelar"
            onClick={alCerrar}
            disabled={procesando}
          >
            {textoCancelar}
          </button>
          <button
            type="button"
            className="modal-cierre-btn-confirmar"
            onClick={manejarConfirmacion}
            disabled={procesando}
            style={{
              background:
                colorHero === 'peligro'
                  ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                  : colorHero === 'primario'
                  ? 'var(--color-primario)'
                  : undefined,
            }}
          >
            {colorHero === 'peligro' ? (
              <Trash2 style={{ width: '15px', height: '15px' }} />
            ) : (
              <CheckCircle style={{ width: '15px', height: '15px' }} />
            )}
            <span>{procesando ? 'Procesando...' : textoConfirmar}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(contenidoModal, document.body) : null;
};

