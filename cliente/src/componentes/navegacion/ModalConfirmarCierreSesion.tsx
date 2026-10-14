'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Power, X, ShieldAlert } from 'lucide-react';
import type { Usuario, Optica } from '@/tipos/crm';

interface PropiedadesModalConfirmarCierreSesion {
  abierto: boolean;
  alCerrar: () => void;
  alConfirmar: () => void;
  usuario?: Usuario | null;
  optica?: Optica | null;
}

export const ModalConfirmarCierreSesion: React.FC<PropiedadesModalConfirmarCierreSesion> = ({
  abierto,
  alCerrar,
  alConfirmar,
  usuario,
  optica,
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

  const nombreMostrar = (() => {
    if (!usuario?.nombre) return 'Samir Bolívar';
    if (
      usuario.nombre.toLowerCase().includes('super') ||
      usuario.nombre.toLowerCase().includes('administrador') ||
      usuario.usuario === 'admin'
    ) {
      return 'Samir Bolívar';
    }
    return usuario.nombre.replace(/^(Dr\.|Dra\.)\s+/i, '');
  })();

  const iniciales = (() => {
    const limpio = nombreMostrar.trim();
    if (limpio.toLowerCase().includes('samir')) return 'SA';
    const partes = limpio.split(/\s+/);
    if (partes.length >= 2) {
      return (partes[0][0] + partes[1][0]).toUpperCase();
    }
    return limpio.substring(0, 2).toUpperCase();
  })();

  const rolMostrar = usuario?.rol === 'admin' ? 'Superadmin Global' : 'Administrador de Sede';

  const manejarConfirmacion = () => {
    setProcesando(true);
    alConfirmar();
  };

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
      aria-labelledby="modal-cierre-titulo"
    >
      <div className="modal-cierre-tarjeta">
        {/* Botón Cerrar (X) */}
        <button
          type="button"
          className="modal-cierre-btn-cerrar"
          onClick={alCerrar}
          disabled={procesando}
          aria-label="Cancelar y volver"
        >
          <X style={{ width: '18px', height: '18px' }} />
        </button>

        {/* Icono Hero con Brillo y Pulso */}
        <div className="modal-cierre-icono-hero">
          <div className="modal-cierre-icono-circulo">
            <Power style={{ width: '28px', height: '28px' }} />
          </div>
        </div>

        {/* Título y Descripción Corporativa */}
        <h2 id="modal-cierre-titulo" className="modal-cierre-titulo">
          ¿Deseas cerrar tu sesión?
        </h2>
        <p className="modal-cierre-descripcion">
          Estás a punto de salir del panel de gestión de{' '}
          <strong>{optica?.nombre || 'la óptica'}</strong>. Se cerrará tu acceso activo y
          deberás iniciar sesión nuevamente para acceder a los chats y pacientes.
        </p>

        {/* Tarjeta Informativa del Usuario Activo */}
        <div className="modal-cierre-perfil-chip">
          <div
            className="modal-cierre-avatar"
            style={{
              background: optica?.color_primario
                ? `linear-gradient(135deg, ${optica.color_primario} 0%, ${optica.color_secundario || optica.color_primario} 100%)`
                : 'var(--color-primario, #0284c7)',
            }}
          >
            {iniciales}
            <span className="modal-cierre-punto-online" />
          </div>
          <div className="modal-cierre-perfil-info">
            <span className="modal-cierre-perfil-nombre">{nombreMostrar}</span>
            <span className="modal-cierre-perfil-rol">
              {rolMostrar} • {optica?.nombre || 'Tu Visión Óptica'}
            </span>
          </div>
          <div className="modal-cierre-seguridad-tag">
            <ShieldAlert style={{ width: '13px', height: '13px' }} />
            <span>Sesión Segura</span>
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
            Cancelar
          </button>
          <button
            type="button"
            className="modal-cierre-btn-confirmar"
            onClick={manejarConfirmacion}
            disabled={procesando}
          >
            <Power style={{ width: '16px', height: '16px' }} />
            <span>{procesando ? 'Cerrando sesión...' : 'Sí, cerrar sesión'}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(contenidoModal, document.body) : null;
};
