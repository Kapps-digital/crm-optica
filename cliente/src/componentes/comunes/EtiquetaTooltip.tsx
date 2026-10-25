'use client';

import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type PosicionTooltip = 'arriba' | 'abajo' | 'izquierda' | 'derecha';

export interface PropiedadesEtiquetaTooltip {
  texto: ReactNode | string;
  posicion?: PosicionTooltip;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  soloSiTruncado?: boolean;
  soloEnPuntos?: boolean;
}

export function EtiquetaTooltip({
  texto,
  posicion = 'arriba',
  children,
  className = '',
  style,
  soloSiTruncado = false,
  soloEnPuntos = false,
}: PropiedadesEtiquetaTooltip) {
  const [visible, setVisible] = useState(false);
  const [montado, setMontado] = useState(false);
  const [coordenadas, setCoordenadas] = useState({ top: 0, left: 0, flechaOffset: '50%' });
  const [posicionEfectiva, setPosicionEfectiva] = useState<PosicionTooltip>(posicion);
  const disparadorRef = useRef<HTMLDivElement>(null);
  const globoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMontado(true);
  }, []);

  const estaElementoTruncado = (): boolean => {
    if (!disparadorRef.current) return false;
    const esTruncado = (el: Element | null): boolean =>
      Boolean(el && el.scrollWidth > el.clientWidth + 1);

    if (esTruncado(disparadorRef.current)) return true;
    const hijos = disparadorRef.current.querySelectorAll('*');
    for (const hijo of Array.from(hijos)) {
      if (esTruncado(hijo)) return true;
    }
    return false;
  };

  const actualizarPosicion = (puntoReferencia: { x: number } | null = null) => {
    if (!disparadorRef.current) return;
    const rect = disparadorRef.current.getBoundingClientRect();
    const centroObjetivoX = puntoReferencia ? puntoReferencia.x : rect.left + rect.width / 2;

    let pos: PosicionTooltip = posicion;
    const espacioArribaRequerido = 45;
    const espacioAbajoRequerido = 45;

    // Auto-flip vertical: si no cabe arriba, baja; si no cabe abajo, sube
    if (pos === 'arriba' && rect.top < espacioArribaRequerido) {
      pos = 'abajo';
    } else if (pos === 'abajo' && rect.bottom + espacioAbajoRequerido > window.innerHeight) {
      pos = 'arriba';
    }

    // Auto-flip horizontal: si no cabe a los lados
    if (pos === 'izquierda' && rect.left < 90) {
      pos = 'derecha';
    } else if (pos === 'derecha' && rect.right + 90 > window.innerWidth) {
      pos = 'izquierda';
    }

    setPosicionEfectiva(pos);

    let top = 0;
    let left = centroObjetivoX;

    if (pos === 'arriba') {
      top = rect.top - 8;
    } else if (pos === 'abajo') {
      top = rect.bottom + 8;
    } else if (pos === 'izquierda') {
      top = rect.top + rect.height / 2;
      left = rect.left - 8;
    } else if (pos === 'derecha') {
      top = rect.top + rect.height / 2;
      left = rect.right + 8;
    }

    let flechaOffset = '50%';

    // Para posiciones verticales (arriba/abajo), mantener el globo dentro de la pantalla
    // y anclar la flecha exactamente al centro del elemento disparador
    if (pos === 'arriba' || pos === 'abajo') {
      const longitudTexto = typeof texto === 'string' ? texto.length : 16;
      const anchoEstimado = Math.min(320, Math.max(60, longitudTexto * 7.5 + 24));
      const mitadAncho = anchoEstimado / 2;
      const margenPantalla = 12;

      const minLeft = mitadAncho + margenPantalla;
      const maxLeft = window.innerWidth - mitadAncho - margenPantalla;
      const leftAjustado = Math.max(minLeft, Math.min(centroObjetivoX, maxLeft));
      left = leftAjustado;

      const deltaX = centroObjetivoX - leftAjustado;
      const flechaPx = Math.max(12, Math.min(anchoEstimado - 12, mitadAncho + deltaX));
      flechaOffset = `${flechaPx}px`;
    }

    setCoordenadas({ top, left, flechaOffset });
  };

  // Refinar posición con las dimensiones reales del globo una vez montado
  useEffect(() => {
    if (visible && globoRef.current && disparadorRef.current) {
      const rectGlobo = globoRef.current.getBoundingClientRect();
      const rectDisparador = disparadorRef.current.getBoundingClientRect();
      const anchoReal = rectGlobo.width;
      const mitadAncho = anchoReal / 2;
      const centroObjetivoX = rectDisparador.left + rectDisparador.width / 2;
      const margenPantalla = 12;

      if (posicionEfectiva === 'arriba' || posicionEfectiva === 'abajo') {
        const minLeft = mitadAncho + margenPantalla;
        const maxLeft = window.innerWidth - mitadAncho - margenPantalla;
        const leftAjustado = Math.max(minLeft, Math.min(centroObjetivoX, maxLeft));
        const deltaX = centroObjetivoX - leftAjustado;
        const flechaPx = Math.max(12, Math.min(anchoReal - 12, mitadAncho + deltaX));

        setCoordenadas((prev) => ({
          ...prev,
          left: leftAjustado,
          flechaOffset: `${flechaPx}px`,
        }));
      }
    }
  }, [visible, posicionEfectiva]);

  // Ocultar tooltip inmediatamente si el usuario hace clic, hace scroll o cambia de ventana
  useEffect(() => {
    const alInteractuar = () => {
      setVisible(false);
    };
    const alPerderFocoVentana = () => {
      setVisible(false);
    };

    window.addEventListener('mousedown', alInteractuar);
    window.addEventListener('scroll', alInteractuar, true);
    window.addEventListener('blur', alPerderFocoVentana);

    return () => {
      window.removeEventListener('mousedown', alInteractuar);
      window.removeEventListener('scroll', alInteractuar, true);
      window.removeEventListener('blur', alPerderFocoVentana);
    };
  }, []);

  // Si el texto se vacía, ocultar
  useEffect(() => {
    if (!texto) {
      setVisible(false);
    }
  }, [texto]);

  const manejarMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!texto) return;

    if (soloEnPuntos) {
      manejarMouseMove(e);
      return;
    }

    if (soloSiTruncado && !estaElementoTruncado()) {
      return;
    }

    actualizarPosicion();
    setVisible(true);
  };

  const manejarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!texto) return;

    if (soloEnPuntos) {
      if (!disparadorRef.current) return;

      const truncado = estaElementoTruncado();
      if (!truncado) {
        if (visible) setVisible(false);
        if (disparadorRef.current) disparadorRef.current.style.cursor = 'default';
        return;
      }

      const rect = disparadorRef.current.getBoundingClientRect();
      const anchoZonaPuntos = 34;
      const dentroDePuntos =
        e.clientX >= rect.right - anchoZonaPuntos && e.clientX <= rect.right + 4;

      if (dentroDePuntos) {
        disparadorRef.current.style.cursor = 'help';
        actualizarPosicion({ x: rect.right - 15 });
        if (!visible) setVisible(true);
      } else {
        disparadorRef.current.style.cursor = 'default';
        if (visible) setVisible(false);
      }
    }
  };

  const manejarMouseLeave = () => {
    if (disparadorRef.current) {
      disparadorRef.current.style.cursor = 'default';
    }
    setVisible(false);
  };

  const manejarMouseDown = () => {
    setVisible(false);
  };

  if (!texto) return <>{children}</>;

  const obtenerTransform = (): string => {
    switch (posicionEfectiva) {
      case 'abajo':
        return 'translate(-50%, 0)';
      case 'izquierda':
        return 'translate(-100%, -50%)';
      case 'derecha':
        return 'translate(0, -50%)';
      case 'arriba':
      default:
        return 'translate(-50%, -100%)';
    }
  };

  return (
    <div
      ref={disparadorRef}
      className={`etiqueta-tooltip-contenedor ${className}`}
      style={style}
      onMouseEnter={manejarMouseEnter}
      onMouseMove={manejarMouseMove}
      onMouseLeave={manejarMouseLeave}
      onMouseDown={manejarMouseDown}
      onClick={manejarMouseDown}
    >
      {children}
      {visible &&
        montado &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={globoRef}
            className={`etiqueta-tooltip-globo fija posicion-${posicionEfectiva}`}
            style={{
              position: 'fixed',
              top: `${coordenadas.top}px`,
              left: `${coordenadas.left}px`,
              transform: obtenerTransform(),
              pointerEvents: 'none',
              zIndex: 999999,
            }}
            role="tooltip"
          >
            <span>{typeof texto === 'string' ? texto.replace(/\$\s*/g, '$') : texto}</span>
            <div
              className="etiqueta-tooltip-flecha"
              style={
                posicionEfectiva === 'arriba' || posicionEfectiva === 'abajo'
                  ? { left: coordenadas.flechaOffset }
                  : {}
              }
            />
          </div>,
          document.body
        )}
    </div>
  );
}
