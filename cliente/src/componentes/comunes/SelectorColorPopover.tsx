'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Pipette, Check, ChevronDown, RefreshCw } from 'lucide-react';

interface PropiedadesSelectorColorPopover {
  valor: string; // Formato HEX: "#0284c7"
  alCambiar: (nuevoColor: string) => void;
  etiqueta?: string;
  placeholder?: string;
  anchoMinimo?: string;
}

// Colores institucionales y profesionales recomendados
const COLORES_PREDEFINIDOS = [
  '#0284c7', // Azul primario brillante
  '#0369a1', // Azul secundario profundo
  '#0d2167', // Marino institucional
  '#00a8cc', // Cyan turquesa
  '#2563eb', // Azul real
  '#10b981', // Verde esmeralda
  '#f59e0b', // Ámbar dorado
  '#8b5cf6', // Violeta
  '#475569', // Pizarra corporativo
  '#0f172a', // Grafito oscuro
];

// --- Conversiones Matemáticas HSV <-> RGB <-> HEX ---
function normalizarHex(hex: string): string {
  let limpio = hex.replace(/[^0-9A-Fa-f]/g, '');
  if (limpio.length === 3) {
    limpio = limpio.split('').map((c) => c + c).join('');
  }
  if (limpio.length > 6) limpio = limpio.slice(0, 6);
  return '#' + limpio;
}

function hexAHsv(hex: string): { h: number; s: number; v: number } {
  let limpio = hex.replace('#', '');
  if (limpio.length === 3) {
    limpio = limpio.split('').map((c) => c + c).join('');
  }
  if (limpio.length !== 6) return { h: 200, s: 98, v: 78 };

  const r = parseInt(limpio.slice(0, 2), 16) / 255;
  const g = parseInt(limpio.slice(2, 4), 16) / 255;
  const b = parseInt(limpio.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      case b:
        h = ((r - g) / d + 4) * 60;
        break;
    }
  }

  return { h: Math.round(h), s: Math.round(s * 100), v: Math.round(v * 100) };
}

function hsvAHex(h: number, s: number, v: number): string {
  const hNorm = (h % 360 + 360) % 360;
  const sNorm = Math.max(0, Math.min(100, s)) / 100;
  const vNorm = Math.max(0, Math.min(100, v)) / 100;

  const c = vNorm * sNorm;
  const x = c * (1 - Math.abs(((hNorm / 60) % 2) - 1));
  const m = vNorm - c;

  let r = 0, g = 0, b = 0;
  if (hNorm >= 0 && hNorm < 60) {
    r = c; g = x; b = 0;
  } else if (hNorm >= 60 && hNorm < 120) {
    r = x; g = c; b = 0;
  } else if (hNorm >= 120 && hNorm < 180) {
    r = 0; g = c; b = x;
  } else if (hNorm >= 180 && hNorm < 240) {
    r = 0; g = x; b = c;
  } else if (hNorm >= 240 && hNorm < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  const toHex = (num: number) => {
    const val = Math.round((num + m) * 255);
    return Math.max(0, Math.min(255, val)).toString(16).padStart(2, '0');
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexARgb(hex: string): { r: number; g: number; b: number } {
  let limpio = hex.replace('#', '');
  if (limpio.length === 3) limpio = limpio.split('').map((c) => c + c).join('');
  if (limpio.length !== 6) return { r: 2, g: 132, b: 199 };
  return {
    r: parseInt(limpio.slice(0, 2), 16),
    g: parseInt(limpio.slice(2, 4), 16),
    b: parseInt(limpio.slice(4, 6), 16),
  };
}

function rgbAHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export const SelectorColorPopover: React.FC<PropiedadesSelectorColorPopover> = ({
  valor,
  alCambiar,
  etiqueta,
  placeholder = 'Seleccionar color...',
  anchoMinimo = '100%',
}) => {
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false);
  const disparadorRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const espectroRef = useRef<HTMLDivElement>(null);
  const sliderTonoRef = useRef<HTMLDivElement>(null);

  // Estados HSV internos
  const [hsv, setHsv] = useState(() => hexAHsv(valor || '#0284c7'));
  const [formatoEntrada, setFormatoEntrada] = useState<'HEX' | 'RGB'>('HEX');
  const [textoHex, setTextoHex] = useState(valor ? valor.toUpperCase() : '#0284C7');

  // Coordenadas calculadas para portal flotante
  const [posicion, setPosicion] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 260,
  });

  useEffect(() => {
    setMontado(true);
  }, []);

  // Sincronizar valor entrante
  useEffect(() => {
    if (valor) {
      setHsv(hexAHsv(valor));
      setTextoHex(valor.toUpperCase());
    }
  }, [valor]);

  // Posicionamiento inteligente del popover
  const actualizarPosicion = useCallback(() => {
    if (!disparadorRef.current) return;
    const rect = disparadorRef.current.getBoundingClientRect();
    const anchoPopover = 265;
    const alturaEstimada = 320;

    let left = rect.left;
    if (left + anchoPopover > window.innerWidth - 12) {
      left = window.innerWidth - anchoPopover - 12;
    }
    if (left < 12) left = 12;

    const espacioAbajo = window.innerHeight - rect.bottom;
    const espacioArriba = rect.top;
    const mostrarArriba = espacioAbajo < alturaEstimada && espacioArriba > espacioAbajo;

    setPosicion({
      top: mostrarArriba ? rect.top - alturaEstimada - 6 : rect.bottom + 6,
      left,
      width: anchoPopover,
    });
  }, []);

  useEffect(() => {
    if (abierto) {
      actualizarPosicion();
      const manejarScrollResize = () => actualizarPosicion();
      window.addEventListener('scroll', manejarScrollResize, true);
      window.addEventListener('resize', manejarScrollResize);
      return () => {
        window.removeEventListener('scroll', manejarScrollResize, true);
        window.removeEventListener('resize', manejarScrollResize);
      };
    }
  }, [abierto, actualizarPosicion]);

  // Cierre al hacer clic fuera o presionar escape
  useEffect(() => {
    const manejarClickFuera = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        disparadorRef.current &&
        !disparadorRef.current.contains(e.target as Node)
      ) {
        setAbierto(false);
      }
    };

    const manejarEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };

    if (abierto) {
      document.addEventListener('mousedown', manejarClickFuera);
      document.addEventListener('keydown', manejarEscape);
      return () => {
        document.removeEventListener('mousedown', manejarClickFuera);
        document.removeEventListener('keydown', manejarEscape);
      };
    }
  }, [abierto]);

  // Actualizar color a partir de HSV
  const actualizarDesdeHsv = useCallback(
    (nuevoHsv: { h: number; s: number; v: number }) => {
      setHsv(nuevoHsv);
      const nuevoHex = hsvAHex(nuevoHsv.h, nuevoHsv.s, nuevoHsv.v);
      setTextoHex(nuevoHex.toUpperCase());
      alCambiar(nuevoHex);
    },
    [alCambiar]
  );

  // Manejo de clic/arrastre sobre el espectro 2D (Saturación y Brillo)
  const manejarInteraccionEspectro = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!espectroRef.current) return;
      const rect = espectroRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

      const s = Math.round((x / rect.width) * 100);
      const v = Math.round((1 - y / rect.height) * 100);

      actualizarDesdeHsv({ ...hsv, s, v });
    },
    [hsv, actualizarDesdeHsv]
  );

  const iniciarArrastreEspectro = (e: React.MouseEvent) => {
    manejarInteraccionEspectro(e);
    const alMover = (ev: MouseEvent) => manejarInteraccionEspectro(ev);
    const alSoltar = () => {
      window.removeEventListener('mousemove', alMover);
      window.removeEventListener('mouseup', alSoltar);
    };
    window.addEventListener('mousemove', alMover);
    window.addEventListener('mouseup', alSoltar);
  };

  // Manejo de clic/arrastre sobre la barra de tono (Hue Slider)
  const manejarInteraccionTono = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!sliderTonoRef.current) return;
      const rect = sliderTonoRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const h = Math.round((x / rect.width) * 360) % 360;

      actualizarDesdeHsv({ ...hsv, h });
    },
    [hsv, actualizarDesdeHsv]
  );

  const iniciarArrastreTono = (e: React.MouseEvent) => {
    manejarInteraccionTono(e);
    const alMover = (ev: MouseEvent) => manejarInteraccionTono(ev);
    const alSoltar = () => {
      window.removeEventListener('mousemove', alMover);
      window.removeEventListener('mouseup', alSoltar);
    };
    window.addEventListener('mousemove', alMover);
    window.addEventListener('mouseup', alSoltar);
  };

  // Gotero en pantalla (EyeDropper API si está disponible en Chromium)
  const activarGotero = async () => {
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      try {
        // @ts-ignore
        const eyeDropper = new window.EyeDropper();
        const resultado = await eyeDropper.open();
        if (resultado?.sRGBHex) {
          const hex = resultado.sRGBHex;
          const nuevoHsv = hexAHsv(hex);
          actualizarDesdeHsv(nuevoHsv);
        }
      } catch (e) {
        // Cancelado por el usuario
      }
    }
  };

  // Manejo de texto HEX manual
  const manejarCambioTextoHex = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setTextoHex(val);
    if (/^#[0-9A-F]{6}$/i.test(val)) {
      setHsv(hexAHsv(val));
      alCambiar(val.toLowerCase());
    }
  };

  const rgbActual = hexARgb(valor || '#0284c7');

  return (
    <div style={{ position: 'relative', width: anchoMinimo, userSelect: 'none' }}>
      {/* Disparador de diseño corporativo premium */}
      <div
        ref={disparadorRef}
        onClick={() => setAbierto(!abierto)}
        className="selector-color-tarjeta-premium"
        style={{
          borderColor: abierto ? 'var(--color-primario)' : 'var(--borde-tarjeta)',
          boxShadow: abierto ? '0 0 0 3px rgba(2, 132, 199, 0.18)' : undefined,
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setAbierto(!abierto);
          }
        }}
      >
        <div className="selector-color-izq">
          <div
            className="selector-color-muestra"
            style={{ backgroundColor: valor || '#0284c7' }}
          />
          <span className="selector-color-hex">{valor || '#0284C7'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Pipette style={{ width: '15px', height: '15px', color: 'var(--texto-atenuado)' }} />
          <ChevronDown
            style={{
              width: '14px',
              height: '14px',
              color: 'var(--texto-atenuado)',
              transition: 'transform 0.2s ease',
              transform: abierto ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </div>
      </div>

      {/* Popover Flotante de Alta Gama renderizado en Portal */}
      {montado &&
        abierto &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${posicion.top}px`,
              left: `${posicion.left}px`,
              width: `${posicion.width}px`,
              background: 'var(--fondo-tarjeta)',
              border: '1px solid var(--borde-tarjeta)',
              borderRadius: '14px',
              boxShadow: '0 16px 38px -4px rgba(0, 0, 0, 0.26), 0 6px 14px -2px rgba(0, 0, 0, 0.12)',
              padding: '0.85rem',
              zIndex: 999999,
              backdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              animation: 'deslizarEntradaDropdown 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* 1. Área 2D de Matiz, Saturación y Brillo */}
            <div
              ref={espectroRef}
              onMouseDown={iniciarArrastreEspectro}
              style={{
                width: '100%',
                height: '140px',
                borderRadius: '8px',
                position: 'relative',
                cursor: 'crosshair',
                backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
                backgroundImage:
                  'linear-gradient(to bottom, transparent, #000), linear-gradient(to right, #fff, transparent)',
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
                overflow: 'hidden',
              }}
            >
              {/* Puntero Selector Circular */}
              <div
                style={{
                  position: 'absolute',
                  left: `${hsv.s}%`,
                  top: `${100 - hsv.v}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: '2px solid #ffffff',
                  boxShadow: '0 0 4px rgba(0,0,0,0.6), inset 0 0 2px rgba(0,0,0,0.4)',
                  pointerEvents: 'none',
                }}
              />
            </div>

            {/* 2. Barra de Tono (Rainbow Hue Slider) + Gotero + Muestra */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              {/* Botón Gotero */}
              <button
                type="button"
                onClick={activarGotero}
                title="Cuentagotas (Seleccionar de pantalla)"
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  background: 'var(--fondo-elevado)',
                  border: '1px solid var(--borde-tarjeta)',
                  color: 'var(--texto-principal)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                <Pipette style={{ width: '15px', height: '15px' }} />
              </button>

              {/* Muestra Circular */}
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: valor || '#0284c7',
                  border: '2px solid #ffffff',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  flexShrink: 0,
                }}
              />

              {/* Barra de Tono Arcoíris */}
              <div
                ref={sliderTonoRef}
                onMouseDown={iniciarArrastreTono}
                style={{
                  flex: 1,
                  height: '14px',
                  borderRadius: '9999px',
                  position: 'relative',
                  cursor: 'pointer',
                  background:
                    'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.15)',
                }}
              >
                {/* Puntero de Tono */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${(hsv.h / 360) * 100}%`,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    border: '2px solid #ffffff',
                    backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            </div>

            {/* 3. Inputs de Código y Formato (HEX / RGB) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              {formatoEntrada === 'HEX' ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={textoHex}
                    onChange={manejarCambioTextoHex}
                    maxLength={7}
                    style={{
                      width: '100%',
                      background: 'var(--fondo-elevado)',
                      border: '1px solid var(--borde-tarjeta)',
                      borderRadius: '8px',
                      padding: '0.4rem 0.6rem',
                      fontFamily: 'monospace',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      color: 'var(--texto-principal)',
                      textAlign: 'center',
                      outline: 'none',
                    }}
                  />
                </div>
              ) : (
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
                  {(['r', 'g', 'b'] as const).map((canal) => (
                    <div key={canal} style={{ textAlign: 'center' }}>
                      <input
                        type="number"
                        min={0}
                        max={255}
                        value={rgbActual[canal]}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(255, Number(e.target.value) || 0));
                          const nuevoRgb = { ...rgbActual, [canal]: val };
                          const nuevoHex = rgbAHex(nuevoRgb.r, nuevoRgb.g, nuevoRgb.b);
                          actualizarDesdeHsv(hexAHsv(nuevoHex));
                        }}
                        style={{
                          width: '100%',
                          background: 'var(--fondo-elevado)',
                          border: '1px solid var(--borde-tarjeta)',
                          borderRadius: '8px',
                          padding: '0.35rem 0.2rem',
                          fontFamily: 'monospace',
                          fontSize: '0.80rem',
                          fontWeight: 700,
                          color: 'var(--texto-principal)',
                          textAlign: 'center',
                          outline: 'none',
                        }}
                      />
                      <span style={{ fontSize: '0.62rem', color: 'var(--texto-atenuado)', fontWeight: 600 }}>
                        {canal.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Botón para alternar HEX / RGB */}
              <button
                type="button"
                onClick={() => setFormatoEntrada(formatoEntrada === 'HEX' ? 'RGB' : 'HEX')}
                style={{
                  background: 'var(--fondo-elevado)',
                  border: '1px solid var(--borde-tarjeta)',
                  borderRadius: '8px',
                  padding: '0.4rem 0.55rem',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--texto-secundario)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                }}
              >
                <span>{formatoEntrada}</span>
                <RefreshCw style={{ width: '10px', height: '10px' }} />
              </button>
            </div>

            {/* 4. Colores Corporativos Sugeridos */}
            <div style={{ borderTop: '1px solid var(--borde-tarjeta)', paddingTop: '0.55rem' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--texto-atenuado)', display: 'block', marginBottom: '0.4rem' }}>
                Colores sugeridos
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.45rem' }}>
                {COLORES_PREDEFINIDOS.map((colorItem) => (
                  <button
                    key={colorItem}
                    type="button"
                    onClick={() => {
                      actualizarDesdeHsv(hexAHsv(colorItem));
                    }}
                    style={{
                      width: '100%',
                      height: '24px',
                      borderRadius: '6px',
                      backgroundColor: colorItem,
                      border:
                        (valor || '').toLowerCase() === colorItem.toLowerCase()
                          ? '2px solid var(--texto-principal)'
                          : '1px solid rgba(0,0,0,0.1)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform 0.15s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    {(valor || '').toLowerCase() === colorItem.toLowerCase() && (
                      <Check style={{ width: '13px', height: '13px', color: '#ffffff' }} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Botón de Aceptar / Cerrar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="btn-pildora-primario"
                style={{ padding: '0.35rem 0.9rem', fontSize: '0.78rem' }}
              >
                Aceptar
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
