'use client';

import React, { useState, useEffect } from 'react';
import { Bell, BellRing, BellOff, Smartphone, Check, Loader2, Sparkles, Send } from 'lucide-react';
import {
  verificarSoportePush,
  verificarSuscripcionActiva,
  suscribirDispositivoPush,
  desuscribirDispositivoPush,
  enviarPruebaPush,
} from '@/utilidades/gestorNotificacionesPushCliente';

interface PropiedadesBotonNotificacionesMovil {
  opticaId: number;
  usuarioId?: number;
}

export const BotonNotificacionesMovil: React.FC<PropiedadesBotonNotificacionesMovil> = ({
  opticaId,
  usuarioId,
}) => {
  const [soportado, setSoportado] = useState(false);
  const [activo, setActivo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [mensajeEstado, setMensajeEstado] = useState<string | null>(null);

  useEffect(() => {
    const esSoportado = verificarSoportePush();
    setSoportado(esSoportado);
    if (esSoportado) {
      verificarSuscripcionActiva().then(setActivo);
    }
  }, []);

  const manejarAlternar = async () => {
    setCargando(true);
    setMensajeEstado(null);
    try {
      if (activo) {
        await desuscribirDispositivoPush();
        setActivo(false);
        setMensajeEstado('Notificaciones desactivadas en este dispositivo.');
      } else {
        const res = await suscribirDispositivoPush(opticaId, usuarioId);
        if (res.exito) {
          setActivo(true);
          setMensajeEstado('¡Listo! Notificaciones activadas en este dispositivo.');
        } else {
          setMensajeEstado(`Error: ${res.error}`);
        }
      }
    } finally {
      setCargando(false);
    }
  };

  const manejarProbar = async () => {
    setCargando(true);
    setMensajeEstado(null);
    try {
      const res = await enviarPruebaPush(opticaId);
      if (res.exito) {
        setMensajeEstado('Notificación de prueba enviada.');
      } else {
        setMensajeEstado(`Fallo de prueba: ${res.error || 'Sin respuesta'}`);
      }
    } finally {
      setCargando(false);
    }
  };

  if (!soportado) {
    return null; // Ocultar si el dispositivo no soporta Push
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setMenuAbierto(!menuAbierto)}
        className={`boton-notificacion-push-icono ${activo ? 'activo' : ''}`}
        title={activo ? 'Notificaciones push activas en este celular' : 'Activar alertas en este celular'}
        aria-label="Gestor de notificaciones móviles"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: '1px solid var(--borde-tarjeta)',
          background: activo ? 'rgba(16, 185, 129, 0.12)' : 'var(--fondo-tarjeta)',
          color: activo ? '#059669' : 'var(--texto-secundario)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
      >
        {cargando ? (
          <Loader2 style={{ width: '15px', height: '15px', animation: 'girar 1s linear infinite' }} />
        ) : activo ? (
          <BellRing style={{ width: '15px', height: '15px' }} />
        ) : (
          <Bell style={{ width: '15px', height: '15px' }} />
        )}
      </button>

      {/* Popover de Configuración Push */}
      {menuAbierto && (
        <>
          <div
            onClick={() => setMenuAbierto(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 998,
            }}
          />
          <div
            className="popover-push-contenedor"
            style={{
              position: 'absolute',
              top: '40px',
              right: 0,
              width: '280px',
              background: 'var(--fondo-tarjeta)',
              border: '1px solid var(--borde-tarjeta)',
              borderRadius: '12px',
              padding: '0.9rem',
              boxShadow: 'var(--sombra-lg)',
              zIndex: 999,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Smartphone style={{ width: '16px', height: '16px', color: 'var(--color-primario)' }} />
              <strong style={{ fontSize: '0.85rem', color: 'var(--texto-principal)' }}>
                Alertas en el Celular
              </strong>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--texto-secundario)', margin: 0, lineHeight: 1.4 }}>
              {activo
                ? 'Este dispositivo recibirá alertas sonoras cuando la IA transfiera un chat a un asesor humano.'
                : 'Activa las alertas aquí para que te suenen en el celular cuando un chat requiera atención humana.'}
            </p>

            {mensajeEstado && (
              <div
                style={{
                  fontSize: '0.72rem',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '6px',
                  background: mensajeEstado.includes('Error') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  color: mensajeEstado.includes('Error') ? '#dc2626' : '#059669',
                  fontWeight: 500,
                }}
              >
                {mensajeEstado}
              </div>
            )}

            <button
              type="button"
              onClick={manejarAlternar}
              disabled={cargando}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                border: 'none',
                background: activo ? '#ef4444' : 'var(--color-primario)',
                color: '#ffffff',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {cargando ? (
                <Loader2 style={{ width: '14px', height: '14px', animation: 'girar 1s linear infinite' }} />
              ) : activo ? (
                <>
                  <BellOff style={{ width: '14px', height: '14px' }} />
                  <span>Desactivar en este teléfono</span>
                </>
              ) : (
                <>
                  <BellRing style={{ width: '14px', height: '14px' }} />
                  <span>Activar Alertas Móviles</span>
                </>
              )}
            </button>

            {activo && (
              <button
                type="button"
                onClick={manejarProbar}
                disabled={cargando}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '8px',
                  border: '1px solid var(--borde-tarjeta)',
                  background: 'transparent',
                  color: 'var(--texto-principal)',
                  fontSize: '0.74rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <Send style={{ width: '13px', height: '13px' }} />
                <span>Enviar Notificación de Prueba</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

