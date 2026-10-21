'use client';

import React, { useRef } from 'react';
import { Search } from 'lucide-react';

export interface PropiedadesFiltroBusqueda {
  /** Valor actual de la búsqueda */
  valor: string;
  /** Función que se invoca cuando el texto cambia */
  alCambiar: (nuevoValor: string) => void;
  /** Texto guía placeholder */
  placeholder?: string;
  /** Función opcional invocada al presionar el botón de limpiar '×' */
  alLimpiar?: () => void;
  /** Ancho mínimo del contenedor (ej. '180px') */
  anchoMinimo?: string | number;
  /** Ancho máximo del contenedor (ej. '300px' o '380px') */
  anchoMaximo?: string | number;
  /** Ancho explícito del contenedor (ej. '100%' o '280px') */
  ancho?: string | number;
  /** Altura del campo (predeterminado: '32px') */
  alto?: string | number;
  /** Propiedad flex CSS (ej. '2 1 200px' o '1 1 auto') */
  flex?: string;
  /** Deshabilitar el campo */
  deshabilitado?: boolean;
  /** Clase CSS adicional para el contenedor */
  className?: string;
  /** Estilos CSS en línea para el contenedor */
  style?: React.CSSProperties;
  /** Estilos CSS en línea específicos para el input */
  estiloInput?: React.CSSProperties;
  /** Foco automático al montar */
  autoFocus?: boolean;
  /** Identificador de elemento para accesibilidad */
  id?: string;
  /** Nombre del campo */
  nombre?: string;
  /** Etiqueta aria para lectores de pantalla */
  ariaLabel?: string;
}

/**
 * Componente Reutilizable Estandarizado: FiltroBusqueda
 * Basado en la identidad visual y métricas de la plataforma CRM Óptica.
 */
export const FiltroBusqueda: React.FC<PropiedadesFiltroBusqueda> = ({
  valor,
  alCambiar,
  placeholder = 'Buscar...',
  alLimpiar,
  anchoMinimo,
  anchoMaximo,
  ancho,
  alto = '32px',
  flex,
  deshabilitado = false,
  className = '',
  style,
  estiloInput,
  autoFocus = false,
  id,
  nombre,
  ariaLabel = 'Buscar',
}) => {
  const refInput = useRef<HTMLInputElement>(null);

  const manejarLimpiar = () => {
    alCambiar('');
    if (alLimpiar) {
      alLimpiar();
    }
    if (refInput.current) {
      refInput.current.focus();
    }
  };

  const manejarKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && valor) {
      e.stopPropagation();
      manejarLimpiar();
    }
  };

  return (
    <div
      className={`filtro-busqueda-contenedor ${className}`}
      style={{
        position: 'relative',
        boxSizing: 'border-box',
        height: alto,
        flex: flex,
        minWidth: anchoMinimo,
        maxWidth: anchoMaximo,
        width: ancho || (flex ? undefined : '100%'),
        opacity: deshabilitado ? 0.6 : 1,
        pointerEvents: deshabilitado ? 'none' : 'auto',
        ...style,
      }}
    >
      {/* Icono de búsqueda a la izquierda */}
      <Search
        size={14}
        style={{
          position: 'absolute',
          left: '0.65rem',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--texto-atenuado)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
        aria-hidden="true"
      />

      {/* Campo de entrada */}
      <input
        ref={refInput}
        id={id}
        name={nombre}
        type="text"
        placeholder={placeholder}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        onKeyDown={manejarKeyDown}
        disabled={deshabilitado}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        style={{
          width: '100%',
          height: '100%',
          background: 'var(--fondo-elevado)',
          border: '1px solid var(--borde-tarjeta)',
          borderRadius: 'var(--radio-md)',
          padding: '0 1.6rem 0 2rem',
          fontSize: '0.77rem',
          color: 'var(--texto-principal)',
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'all 0.15s ease',
          boxShadow: 'none',
          ...estiloInput,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-primario)';
          e.currentTarget.style.background = 'var(--fondo-tarjeta)';
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(2, 132, 199, 0.12)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--borde-tarjeta)';
          e.currentTarget.style.background = 'var(--fondo-elevado)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />

      {/* Botón rápido de limpiar cuando hay texto escrito */}
      {Boolean(valor) && !deshabilitado && (
        <button
          type="button"
          onClick={manejarLimpiar}
          style={{
            position: 'absolute',
            right: '0.5rem',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: 'var(--texto-atenuado)',
            fontSize: '1rem',
            cursor: 'pointer',
            lineHeight: 1,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            transition: 'color 0.15s ease, background 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--texto-principal)';
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--texto-atenuado)';
            e.currentTarget.style.background = 'none';
          }}
          aria-label="Limpiar búsqueda"
          title="Limpiar búsqueda"
        >
          ×
        </button>
      )}
    </div>
  );
};
