'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SelectorDesplegable, type OpcionDesplegable } from './SelectorDesplegable';

export interface PropiedadesBarraPaginacionTabla {
  totalRegistros: number;
  paginaActual: number;
  limitePorPagina: number;
  alCambiarPagina: (nuevaPagina: number) => void;
  alCambiarLimite: (nuevoLimite: number) => void;
  cantidadVisibles?: number;
  opcionesLimite?: OpcionDesplegable[];
  className?: string;
  style?: React.CSSProperties;
}

// Opciones de paginación por defecto según el estándar corporativo premium
export const OPCIONES_LIMITE_PREDETERMINADAS: OpcionDesplegable[] = [
  { valor: '5', etiqueta: '5 registros (Predeterminado)' },
  { valor: '10', etiqueta: '10 registros' },
  { valor: '20', etiqueta: '20 registros' },
  { valor: '50', etiqueta: '50 registros' },
];

/**
 * Componente Reutilizable: BarraPaginacionTabla
 * Estandarizado bajo la skill de diseño corporativo premium.
 * Proporciona segmentación por páginas, selector desplegable de cantidad y navegación.
 */
export const BarraPaginacionTabla: React.FC<PropiedadesBarraPaginacionTabla> = ({
  totalRegistros,
  paginaActual,
  limitePorPagina,
  alCambiarPagina,
  alCambiarLimite,
  cantidadVisibles,
  opcionesLimite = OPCIONES_LIMITE_PREDETERMINADAS,
  className = '',
  style,
}) => {
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / limitePorPagina));
  const visibles = cantidadVisibles !== undefined 
    ? cantidadVisibles 
    : Math.max(0, Math.min(limitePorPagina, totalRegistros - (paginaActual - 1) * limitePorPagina));

  return (
    <div className={`tabla-agenda-paginacion-barra ${className}`} style={style}>
      <div className="agenda-paginacion-info-grupo">
        <span className="agenda-paginacion-resumen">
          Mostrando <strong>{visibles}</strong> de <strong>{totalRegistros}</strong> registros
        </span>

        <div className="agenda-paginacion-selector-grupo">
          <span className="agenda-paginacion-etiqueta-ver">Ver por página:</span>
          <SelectorDesplegable
            valor={String(limitePorPagina)}
            alCambiar={(val) => {
              alCambiarLimite(Number(val));
              alCambiarPagina(1);
            }}
            opciones={opcionesLimite}
            tamano="compacto"
            direccion="arriba"
            anchoMinimo="200px"
          />
        </div>
      </div>

      <div className="agenda-paginacion-botones-grupo">
        <button
          type="button"
          className="agenda-btn-paginacion-nav"
          disabled={paginaActual <= 1}
          onClick={() => alCambiarPagina(Math.max(1, paginaActual - 1))}
          aria-label="Página anterior"
        >
          <ChevronLeft size={15} />
          <span>Anterior</span>
        </button>

        <span className="agenda-paginacion-pagina-texto">
          Página <strong>{paginaActual}</strong> de <strong>{totalPaginas}</strong>
        </span>

        <button
          type="button"
          className="agenda-btn-paginacion-nav"
          disabled={paginaActual >= totalPaginas}
          onClick={() => alCambiarPagina(Math.min(totalPaginas, paginaActual + 1))}
          aria-label="Página siguiente"
        >
          <span>Siguiente</span>
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
};
