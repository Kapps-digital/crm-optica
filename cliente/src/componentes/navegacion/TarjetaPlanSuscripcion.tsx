'use client';

import React, { useMemo } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';
import type { Optica, Usuario } from '@/tipos/crm';

interface PropiedadesTarjetaPlan {
  optica?: Optica | null;
  usuario?: Usuario | null;
  colapsado?: boolean;
  alCambiarVista?: (vista: string) => void;
  modo?: 'barra_lateral' | 'desplegable_perfil';
}

export const TarjetaPlanSuscripcion: React.FC<PropiedadesTarjetaPlan> = ({
  optica,
  usuario,
  colapsado = false,
  alCambiarVista,
  modo = 'barra_lateral',
}) => {
  // Formato de fecha para Colombia (America/Bogota, UTC-5)
  const fechaColombiaFormateada = useMemo(() => {
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

  const dias = optica?.dias_restantes ?? 0;
  const esVencido = Boolean(
    optica?.plan_vencido || (optica?.dias_restantes !== undefined && optica.dias_restantes < 0)
  );
  const esPorVencer = !esVencido && dias <= 5;

  // Porcentaje del ciclo mensual (base 30 días)
  const porcentajeCiclo = useMemo(() => {
    if (esVencido) return 0;
    return Math.round((Math.max(0, Math.min(30, dias)) / 30) * 100);
  }, [dias, esVencido]);

  if (!optica?.fecha_vencimiento) {
    return null;
  }

  // ========================================================
  // 1. MODO DESPLEGABLE DE PERFIL (OPCIÓN 4: PÍLDORA COMPACTA)
  // ========================================================
  if (modo === 'desplegable_perfil') {
    return (
      <div style={{ margin: '0.5rem 0.85rem' }}>
        <div
          onClick={() => usuario?.rol === 'admin' && alCambiarVista?.('usuarios')}
          style={{
            background: 'var(--fondo-elevado)',
            border: '1px solid var(--borde-tarjeta)',
            borderRadius: '12px',
            padding: '0.48rem 0.65rem',
            boxShadow: 'var(--sombra-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            cursor: usuario?.rol === 'admin' ? 'pointer' : 'default',
            transition: 'all 0.18s ease',
          }}
          onMouseEnter={(e) => {
            if (usuario?.rol === 'admin') {
              e.currentTarget.style.borderColor = 'var(--color-primario-claro)';
            }
          }}
          onMouseLeave={(e) => {
            if (usuario?.rol === 'admin') {
              e.currentTarget.style.borderColor = 'var(--borde-tarjeta)';
            }
          }}
        >
          {/* Lado Izquierdo: Icono + Textos */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '7px',
                background: 'rgba(2, 132, 199, 0.12)',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Clock size={13} />
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  color: 'var(--texto-principal)',
                  lineHeight: 1.15,
                }}
              >
                Plan Mensual
              </div>
              <div
                style={{
                  fontSize: '0.65rem',
                  color: 'var(--texto-atenuado)',
                  lineHeight: 1.15,
                  marginTop: '1px',
                }}
              >
                Corte: <strong style={{ color: 'var(--texto-principal)' }}>{fechaColombiaFormateada}</strong>
              </div>
            </div>
          </div>

          {/* Lado Derecho: Badge Cápsula con punto semafórico */}
          <div
            style={{
              padding: '0.2rem 0.48rem',
              borderRadius: '7px',
              background: esVencido
                ? 'rgba(239, 68, 68, 0.14)'
                : esPorVencer
                  ? 'rgba(245, 158, 11, 0.16)'
                  : 'rgba(16, 185, 129, 0.14)',
              color: esVencido ? '#ef4444' : esPorVencer ? '#d97706' : '#059669',
              fontSize: '0.68rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: esVencido ? '#ef4444' : esPorVencer ? '#f59e0b' : '#10b981',
              }}
            />
            {esVencido ? 'Vencido' : `${dias} días`}
          </div>
        </div>
      </div>
    );
  }

  // ========================================================
  // 2. MODO BARRA LATERAL: COLAPSADA (Icono Compacto en 72px)
  // ========================================================
  if (colapsado) {
    return (
      <div
        style={{
          borderTop: '1px solid var(--borde-tarjeta)',
          padding: '0.6rem 0.2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <EtiquetaTooltip
          texto={`Suscripción: ${esVencido ? 'Vencida' : `${dias} días`} • Corte: ${fechaColombiaFormateada}`}
          posicion="derecha"
        >
          <div
            onClick={() => usuario?.rol === 'admin' && alCambiarVista?.('usuarios')}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: esVencido
                ? 'rgba(239, 68, 68, 0.14)'
                : esPorVencer
                  ? 'rgba(245, 158, 11, 0.16)'
                  : 'var(--fondo-elevado)',
              border: `1px solid ${
                esVencido
                  ? 'rgba(239, 68, 68, 0.35)'
                  : esPorVencer
                    ? 'rgba(245, 158, 11, 0.4)'
                    : 'var(--borde-tarjeta)'
              }`,
              color: esVencido
                ? '#ef4444'
                : esPorVencer
                  ? '#d97706'
                  : 'var(--color-primario, #0284c7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: usuario?.rol === 'admin' ? 'pointer' : 'default',
              position: 'relative',
              transition: 'all 0.18s ease',
            }}
          >
            {esVencido ? <AlertCircle size={16} /> : <Clock size={16} />}
            <span
              style={{
                position: 'absolute',
                top: '5px',
                right: '5px',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: esVencido ? '#ef4444' : esPorVencer ? '#f59e0b' : '#10b981',
                boxShadow: esPorVencer ? '0 0 5px #f59e0b' : undefined,
              }}
            />
          </div>
        </EtiquetaTooltip>
      </div>
    );
  }

  // ========================================================
  // 3. MODO BARRA LATERAL: EXPANDIDA (OPCIÓN 2: FINTECH RING)
  // ========================================================
  return (
    <div
      style={{
        borderTop: '1px solid var(--borde-tarjeta)',
        padding: '0.65rem 0.65rem 0.75rem 0.65rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
      }}
    >
      <style>{`
        @keyframes pulsoVerdeSuscripcion {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
        }
      `}</style>

      <div
        onClick={() => usuario?.rol === 'admin' && alCambiarVista?.('usuarios')}
        style={{
          background: 'var(--fondo-tarjeta)',
          border: '1px solid var(--borde-tarjeta)',
          borderRadius: '13px',
          padding: '0.55rem 0.7rem',
          boxShadow: 'var(--sombra-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          cursor: usuario?.rol === 'admin' ? 'pointer' : 'default',
          transition: 'all 0.18s ease',
        }}
        onMouseEnter={(e) => {
          if (usuario?.rol === 'admin') {
            e.currentTarget.style.borderColor = 'var(--color-primario-claro)';
          }
        }}
        onMouseLeave={(e) => {
          if (usuario?.rol === 'admin') {
            e.currentTarget.style.borderColor = 'var(--borde-tarjeta)';
          }
        }}
      >
        {/* Anillo de Progreso Circular SVG */}
        <div style={{ position: 'relative', width: '38px', height: '38px', flexShrink: 0 }}>
          <svg width="38" height="38" viewBox="0 0 38 38" style={{ transform: 'rotate(-90deg)' }}>
            {/* Círculo de fondo */}
            <circle
              cx="19"
              cy="19"
              r="15"
              fill="none"
              stroke="rgba(148, 163, 184, 0.2)"
              strokeWidth="3"
            />
            {/* Círculo de valor con color semafórico */}
            <circle
              cx="19"
              cy="19"
              r="15"
              fill="none"
              stroke={esVencido ? '#ef4444' : esPorVencer ? '#f59e0b' : '#10b981'}
              strokeWidth="3"
              strokeDasharray={94.2}
              strokeDashoffset={94.2 - (94.2 * Math.min(100, Math.max(5, porcentajeCiclo))) / 100}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>

          {/* Días en el centro del anillo */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 800,
                color: 'var(--texto-principal)',
                lineHeight: 1,
              }}
            >
              {esVencido ? '0' : dias}
            </span>
            <span
              style={{
                fontSize: '0.45rem',
                fontWeight: 700,
                color: 'var(--texto-atenuado)',
                textTransform: 'uppercase',
                lineHeight: 1,
                marginTop: '1px',
              }}
            >
              días
            </span>
          </div>
        </div>

        {/* Información de la Suscripción y Corte */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: esVencido ? '#ef4444' : esPorVencer ? '#f59e0b' : '#10b981',
                animation: esPorVencer || !esVencido ? 'pulsoVerdeSuscripcion 2s infinite' : 'none',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                color: 'var(--texto-principal)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {esVencido ? 'Plan Vencido' : 'Suscripción Activa'}
            </span>
          </div>

          <div
            style={{
              fontSize: '0.68rem',
              color: 'var(--texto-atenuado)',
              marginTop: '0.15rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>
              Corte: <strong style={{ color: 'var(--texto-principal)' }}>{fechaColombiaFormateada}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
