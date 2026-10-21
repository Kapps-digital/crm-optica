'use client';

import React from 'react';

export interface ElementoPestana<T extends string = string> {
  id: T;
  etiqueta: string;
  icono?: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  conteo?: number;
  colorPersonalizado?: string;
  deshabilitado?: boolean;
}

export interface PropiedadesBarraPestanas<T extends string = string> {
  pestanas: ElementoPestana<T>[];
  pestanaActiva: T;
  alCambiarPestana: (idPestana: T) => void;
  tamano?: 'compacto' | 'mediano';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Componente Reutilizable: BarraPestanas
 * Estandariza la barra de navegación por pestañas en toda la plataforma CRM Óptica.
 * Incluye estados activo e inactivo con borde definido, badges de conteo dinámicos
 * y adaptación al esquema de color institucional y tema del usuario.
 */
export function BarraPestanas<T extends string = string>({
  pestanas,
  pestanaActiva,
  alCambiarPestana,
  tamano = 'mediano',
  className = '',
  style,
}: PropiedadesBarraPestanas<T>) {
  const esCompacto = tamano === 'compacto';

  return (
    <div
      className={`barra-pestanas-contenedor ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--fondo-elevado)',
        padding: '3px',
        borderRadius: 'var(--radio-md, 8px)',
        border: '1px solid var(--borde-tarjeta)',
        gap: '3px',
        flexWrap: 'wrap',
        ...style,
      }}
    >
      {pestanas.map((p) => {
        const estaActivo = pestanaActiva === p.id;
        const IconoComponente = p.icono;

        // Color prioritario para estado activo: personalizado o el color primario de la app
        const colorActivo = p.colorPersonalizado || 'var(--color-primario)';

        return (
          <button
            key={p.id}
            type="button"
            disabled={p.deshabilitado}
            onClick={() => !p.deshabilitado && alCambiarPestana(p.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: esCompacto ? '0.35rem' : '0.45rem',
              padding: esCompacto ? '0.3rem 0.65rem' : '0.35rem 0.75rem',
              borderRadius: 'var(--radio-sm, 6px)',
              border: 'none',
              background: estaActivo ? 'var(--fondo-tarjeta)' : 'transparent',
              color: estaActivo ? colorActivo : 'var(--texto-secundario)',
              fontWeight: estaActivo ? 700 : 500,
              fontSize: esCompacto ? '0.74rem' : '0.78rem',
              cursor: p.deshabilitado ? 'not-allowed' : 'pointer',
              opacity: p.deshabilitado ? 0.5 : 1,
              boxShadow: estaActivo ? '0 1px 3px rgba(0, 0, 0, 0.08)' : 'none',
              transition: 'all 0.15s ease',
              outline: 'none',
              userSelect: 'none',
            }}
            onMouseEnter={(e) => {
              if (!estaActivo && !p.deshabilitado) {
                e.currentTarget.style.background = 'var(--fondo-hover)';
                e.currentTarget.style.color = 'var(--texto-principal)';
              }
            }}
            onMouseLeave={(e) => {
              if (!estaActivo && !p.deshabilitado) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--texto-secundario)';
              }
            }}
          >
            {IconoComponente && (
              <IconoComponente
                size={esCompacto ? 13 : 15}
                style={{
                  color: estaActivo ? colorActivo : 'var(--texto-atenuado)',
                  flexShrink: 0,
                  transition: 'color 0.15s ease',
                }}
              />
            )}

            <span>{p.etiqueta}</span>

            {p.conteo !== undefined && (
              <span
                style={{
                  fontSize: esCompacto ? '0.65rem' : '0.68rem',
                  fontWeight: 700,
                  padding: '0.08rem 0.45rem',
                  borderRadius: '9999px',
                  background: estaActivo
                    ? p.colorPersonalizado
                      ? `color-mix(in srgb, ${p.colorPersonalizado} 18%, transparent)`
                      : 'color-mix(in srgb, var(--color-primario) 18%, transparent)'
                    : 'rgba(0, 0, 0, 0.06)',
                  color: estaActivo ? colorActivo : 'var(--texto-atenuado)',
                  lineHeight: 1.2,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                {p.conteo}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
