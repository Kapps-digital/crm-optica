'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Clock4, XCircle, ChevronDown, Check } from 'lucide-react';
import type { EstadoCita } from '@/tipos/crm';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';

interface PropiedadesBadgeEstadoInteractivo {
  citaId: number;
  estado: EstadoCita;
  alCambiarEstado: (citaId: number, nuevoEstado: EstadoCita) => Promise<void> | void;
}

const OPCIONES_ESTADO: { valor: EstadoCita; etiqueta: string; color: string; icono: React.ReactNode }[] = [
  {
    valor: 'pendiente',
    etiqueta: 'Pendiente',
    color: '#f59e0b',
    icono: <Clock4 size={12} style={{ color: '#f59e0b' }} />,
  },
  {
    valor: 'confirmada',
    etiqueta: 'Confirmada',
    color: '#0ea5e9',
    icono: <CheckCircle2 size={12} style={{ color: '#0ea5e9' }} />,
  },
  {
    valor: 'completada',
    etiqueta: 'Completar Cita',
    color: '#10b981',
    icono: <CheckCircle2 size={12} style={{ color: '#10b981' }} />,
  },
];

export const BadgeEstadoInteractivo: React.FC<PropiedadesBadgeEstadoInteractivo> = ({
  citaId,
  estado,
  alCambiarEstado,
}) => {
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false);
  const botonRef = useRef<HTMLButtonElement>(null);
  const [posicionMenu, setPosicionMenu] = useState<{
    top: number;
    left: number;
  }>({
    top: 0,
    left: 0,
  });

  // Calcular posición del menú flotante
  const calcularPosicion = () => {
    if (!botonRef.current) return;
    const rect = botonRef.current.getBoundingClientRect();
    const alturaMenu = 120;
    const espacioAbajo = window.innerHeight - rect.bottom;
    const mostrarArriba = espacioAbajo < alturaMenu && rect.top > espacioAbajo;

    setPosicionMenu({
      top: mostrarArriba ? rect.top - alturaMenu - 4 : rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 165)),
    });
  };

  // 1. Hook de montaje
  useEffect(() => {
    setMontado(true);
  }, []);

  // 2. Hook de cálculo de posición y listeners de resize/scroll
  useEffect(() => {
    if (abierto) {
      calcularPosicion();
      const manejarEvento = () => calcularPosicion();
      window.addEventListener('scroll', manejarEvento, true);
      window.addEventListener('resize', manejarEvento);
      return () => {
        window.removeEventListener('scroll', manejarEvento, true);
        window.removeEventListener('resize', manejarEvento);
      };
    }
  }, [abierto]);

  // 3. Hook de cierre al hacer clic fuera o presionar Escape
  useEffect(() => {
    if (!abierto) return;
    const manejarClickFuera = (e: MouseEvent) => {
      const objetivo = e.target as HTMLElement;
      if (botonRef.current?.contains(objetivo) || objetivo.closest('.menu-estado-flotante')) {
        return;
      }
      setAbierto(false);
    };
    const manejarEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };

    document.addEventListener('mousedown', manejarClickFuera);
    document.addEventListener('keydown', manejarEscape);
    return () => {
      document.removeEventListener('mousedown', manejarClickFuera);
      document.removeEventListener('keydown', manejarEscape);
    };
  }, [abierto]);

  const manejarSeleccionar = (e: React.MouseEvent, nuevoEstado: EstadoCita) => {
    e.preventDefault();
    e.stopPropagation();
    setAbierto(false);
    if (nuevoEstado !== estado) {
      alCambiarEstado(citaId, nuevoEstado);
    }
  };

  // REGLA DE HOOKS DE REACT: Los retornos condicionales deben ir SIEMPRE después de todos los useEffect
  // Cita completada: estado finalizado y bloqueado
  if (estado === 'completada') {
    return (
      <EtiquetaTooltip texto="Cita completada: estado finalizado y bloqueado" posicion="arriba">
        <span className="badge-cita completada estatico" style={{ cursor: 'default' }}>
          <CheckCircle2 size={11} /> Completada
        </span>
      </EtiquetaTooltip>
    );
  }

  // Cita cancelada: bloqueada
  if (estado === 'cancelada') {
    return (
      <EtiquetaTooltip texto="Cita cancelada: no admite modificaciones directas" posicion="arriba">
        <span className="badge-cita cancelada estatico" style={{ cursor: 'default' }}>
          <XCircle size={11} /> Cancelada
        </span>
      </EtiquetaTooltip>
    );
  }

  // Render del badge interactivo para estados activos (Pendiente / Confirmada)
  return (
    <div className="badge-estado-interactivo-contenedor" style={{ display: 'inline-flex', position: 'relative' }}>
      <EtiquetaTooltip texto="Clic para cambiar estado de la cita" posicion="arriba">
        <button
          ref={botonRef}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setAbierto(!abierto);
          }}
          className={`badge-cita ${estado} interactivo ${abierto ? 'abierto' : ''}`}
          aria-haspopup="menu"
          aria-expanded={abierto}
        >
          {estado === 'confirmada' ? (
            <CheckCircle2 size={11} />
          ) : (
            <Clock4 size={11} />
          )}
          <span>{estado === 'confirmada' ? 'Confirmada' : 'Pendiente'}</span>
          <ChevronDown size={10} className={`badge-chevron ${abierto ? 'rotado' : ''}`} />
        </button>
      </EtiquetaTooltip>

      {/* Menú Flotante de Estados */}
      {montado &&
        abierto &&
        createPortal(
          <div
            className="menu-estado-flotante"
            style={{
              top: `${posicionMenu.top}px`,
              left: `${posicionMenu.left}px`,
            }}
            role="menu"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="menu-estado-titulo">Cambiar Estado</div>
            {OPCIONES_ESTADO.map((op) => {
              const esActivo = op.valor === estado;
              return (
                <button
                  key={op.valor}
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => manejarSeleccionar(e, op.valor)}
                  className={`menu-estado-opcion ${esActivo ? 'activa' : ''} ${op.valor === 'completada' ? 'opcion-completar' : ''}`}
                  role="menuitem"
                >
                  <div className="menu-estado-opcion-izq">
                    {op.icono}
                    <span>{op.etiqueta}</span>
                  </div>
                  {esActivo && <Check size={12} className="menu-estado-check" />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
};
