'use client';

import React, { useMemo } from 'react';
import { ShieldAlert, LogOut, MessageCircle, Calendar } from 'lucide-react';
import { cerrarSesion } from '@/servicios/api_crm';
import type { Optica, Usuario } from '@/tipos/crm';

interface PropiedadesModalBloqueo {
  optica?: Optica | null;
  usuario?: Usuario | null;
}

export const ModalBloqueoSuscripcion: React.FC<PropiedadesModalBloqueo> = ({
  optica,
  usuario,
}) => {
  // Fecha formateada en horario Colombia (America/Bogota, UTC-5)
  const fechaVencimientoColombia = useMemo(() => {
    if (!optica?.fecha_vencimiento) return 'Sin fecha';
    try {
      const d = new Date(optica.fecha_vencimiento);
      return new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(d);
    } catch {
      return String(optica.fecha_vencimiento);
    }
  }, [optica?.fecha_vencimiento]);

  // Si el usuario es Superadmin (admin global), nunca se le bloquea el CRM
  if (!optica || !usuario || usuario.rol === 'admin') {
    return null;
  }

  // Solo se bloquea si el plan está efectivamente vencido
  const estaVencido = Boolean(
    optica.plan_vencido ||
    (optica.dias_restantes !== undefined && optica.dias_restantes < 0)
  );

  if (!estaVencido) {
    return null;
  }

  const mensajeWhatsApp = encodeURIComponent(
    `Hola, me comunico desde la óptica *${optica.nombre}* (ID #${optica.id}) para reportar el pago de la mensualidad o solicitar las cuentas para hacer el pago y reactivar el servicio del CRM.`
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999999,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          background: 'var(--fondo-tarjeta, #ffffff)',
          border: '1px solid var(--borde-tarjeta, #e2e8f0)',
          borderRadius: '24px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.08)',
          maxWidth: '460px',
          width: '100%',
          overflow: 'hidden',
          textAlign: 'center',
          padding: '2.25rem 2rem 2rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxSizing: 'border-box',
        }}
      >
        {/* Isotipo Hero Corporativo */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1.5px solid rgba(239, 68, 68, 0.22)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem',
            boxShadow: '0 8px 20px -4px rgba(239, 68, 68, 0.18)',
          }}
        >
          <ShieldAlert size={30} />
        </div>

        {/* Título */}
        <h2
          style={{
            fontFamily: 'var(--fuente-titulos, sans-serif)',
            fontSize: '1.25rem',
            fontWeight: 800,
            color: 'var(--texto-principal, #0f172a)',
            margin: '0 0 0.45rem 0',
            lineHeight: 1.28,
            letterSpacing: '-0.015em',
          }}
        >
          Servicio Suspendido por Mensualidad
        </h2>

        {/* Descripción */}
        <p
          style={{
            fontSize: '0.86rem',
            color: 'var(--texto-secundario, #475569)',
            margin: '0 0 1.35rem 0',
            lineHeight: 1.55,
          }}
        >
          El periodo de suscripción de <strong>{optica.nombre}</strong> ha vencido. Renueva el plan para reactivar el acceso completo al CRM.
        </p>

        {/* Detalle sutil de fecha de corte */}
        <div
          style={{
            width: '100%',
            background: 'var(--fondo-elevado, #f8fafc)',
            border: '1px solid var(--borde-tarjeta, #e2e8f0)',
            borderRadius: '14px',
            padding: '0.65rem 0.95rem',
            marginBottom: '1.65rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={15} style={{ color: 'var(--texto-atenuado, #64748b)' }} />
            <span style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--texto-secundario, #475569)' }}>
              Fecha límite de corte
            </span>
          </div>
          <span
            style={{
              fontSize: '0.80rem',
              fontWeight: 700,
              color: '#ef4444',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              padding: '0.2rem 0.65rem',
              borderRadius: '9999px',
            }}
          >
            {fechaVencimientoColombia}
          </span>
        </div>

        {/* Botones de acción en una sola fila */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
          }}
        >
          {/* Botón Cerrar Sesión */}
          <button
            type="button"
            onClick={cerrarSesion}
            style={{
              flex: 1,
              padding: '0.72rem 0.85rem',
              borderRadius: '12px',
              background: 'var(--fondo-elevado, #f8fafc)',
              border: '1.5px solid var(--borde-tarjeta, #e2e8f0)',
              color: 'var(--texto-principal, #0f172a)',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              transition: 'all 0.16s ease',
              outline: 'none',
              boxSizing: 'border-box',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--fondo-hover, #f1f5f9)';
              e.currentTarget.style.borderColor = 'var(--borde-suave, #cbd5e1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--fondo-elevado, #f8fafc)';
              e.currentTarget.style.borderColor = 'var(--borde-tarjeta, #e2e8f0)';
            }}
          >
            <LogOut size={15} />
            <span>Cerrar Sesión</span>
          </button>

          {/* Botón WhatsApp a Soporte / Reportar Pago */}
          <a
            href={`https://wa.me/573117415122?text=${mensajeWhatsApp}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Reportar pago o solicitar cuentas bancarias vía WhatsApp"
            style={{
              flex: 1.35,
              padding: '0.72rem 0.95rem',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              color: '#ffffff',
              fontSize: '0.84rem',
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.28)',
              transition: 'all 0.18s ease',
              boxSizing: 'border-box',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 18px rgba(16, 185, 129, 0.38)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(16, 185, 129, 0.28)';
            }}
          >
            <MessageCircle size={16} />
            <span>Contactar Soporte</span>
          </a>
        </div>
      </div>
    </div>
  );
};
