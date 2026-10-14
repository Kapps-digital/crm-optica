'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Check, ChevronDown } from 'lucide-react';
import { EtiquetaTooltip } from '@/componentes/comunes/EtiquetaTooltip';

interface PropiedadesSelectorHoraPopover {
  valor: string; // Formato esperado: "11:00 AM" o vacio ""
  alCambiar: (nuevaHora: string) => void;
  placeholder?: string;
}

const ATAJOS_RAPIDOS = [
  '08:00 AM', '09:30 AM', '11:00 AM',
  '02:30 PM', '04:00 PM', '05:30 PM',
];

const HORAS_DISPONIBLES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MINUTOS_DISPONIBLES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

export const SelectorHoraPopover: React.FC<PropiedadesSelectorHoraPopover> = ({
  valor,
  alCambiar,
  placeholder = 'Seleccionar hora...',
}) => {
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false);
  const disparadorRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Estados de desplegables internos premium (sin select nativo)
  const [menuHoraAbierto, setMenuHoraAbierto] = useState(false);
  const [menuMinutoAbierto, setMenuMinutoAbierto] = useState(false);

  // Estados de hora interna (por defecto 09:00 AM para sugerir si está en blanco)
  const [hora, setHora] = useState<string>('09');
  const [minutos, setMinutos] = useState<string>('00');
  const [jornada, setJornada] = useState<'AM' | 'PM'>('AM');

  // Coordenadas calculadas en portal para no desbordar
  const [posicion, setPosicion] = useState<{
    top: number;
    left: number;
    width: number;
  }>({
    top: 0,
    left: 0,
    width: 275,
  });

  useEffect(() => {
    setMontado(true);
  }, []);

  // Parsear valor inicial o externo (soporta 12h "08:00 AM" y 24h "08:00")
  useEffect(() => {
    if (valor) {
      const coincidencia12 = valor.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (coincidencia12) {
        const h = String(parseInt(coincidencia12[1], 10)).padStart(2, '0');
        const m = coincidencia12[2];
        const j = coincidencia12[3].toUpperCase() as 'AM' | 'PM';
        setHora(h);
        setMinutos(m);
        setJornada(j);
      } else {
        const coincidencia24 = valor.trim().match(/^(\d{1,2}):(\d{2})$/);
        if (coincidencia24) {
          let numH = parseInt(coincidencia24[1], 10);
          const m = coincidencia24[2];
          const j: 'AM' | 'PM' = numH >= 12 ? 'PM' : 'AM';
          if (numH > 12) numH -= 12;
          if (numH === 0) numH = 12;
          setHora(String(numH).padStart(2, '0'));
          setMinutos(m);
          setJornada(j);
        }
      }
    }
  }, [valor]);

  // Posicionamiento inteligente en viewport
  const actualizarPosicion = () => {
    if (!disparadorRef.current) return;
    const rect = disparadorRef.current.getBoundingClientRect();
    const anchoPopover = 275;

    let left = rect.left;
    if (left + anchoPopover > window.innerWidth - 12) {
      left = window.innerWidth - anchoPopover - 12;
    }
    if (left < 12) left = 12;

    const alturaEstimada = 240;
    const espacioAbajo = window.innerHeight - rect.bottom;
    const espacioArriba = rect.top;
    const mostrarArriba = espacioAbajo < alturaEstimada && espacioArriba > espacioAbajo;

    setPosicion({
      top: mostrarArriba ? rect.top - alturaEstimada - 4 : rect.bottom + 4,
      left,
      width: anchoPopover,
    });
  };

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
  }, [abierto]);

  // Cierre al interactuar fuera o Escape
  useEffect(() => {
    if (!abierto) return;
    const manejarClickFuera = (e: MouseEvent) => {
      const objetivo = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(objetivo) &&
        disparadorRef.current &&
        !disparadorRef.current.contains(objetivo)
      ) {
        setAbierto(false);
        setMenuHoraAbierto(false);
        setMenuMinutoAbierto(false);
      }
    };

    const manejarTeclaEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbierto(false);
        setMenuHoraAbierto(false);
        setMenuMinutoAbierto(false);
      }
    };

    document.addEventListener('mousedown', manejarClickFuera);
    window.addEventListener('keydown', manejarTeclaEscape);
    return () => {
      document.removeEventListener('mousedown', manejarClickFuera);
      window.removeEventListener('keydown', manejarTeclaEscape);
    };
  }, [abierto]);

  const emitirCambio = (nuevaHora: string, nuevosMinutos: string, nuevaJornada: 'AM' | 'PM') => {
    setHora(nuevaHora);
    setMinutos(nuevosMinutos);
    setJornada(nuevaJornada);
    alCambiar(`${nuevaHora}:${nuevosMinutos} ${nuevaJornada}`);
  };

  // Cálculos de horas previas y siguientes (+1 / -1)
  const indiceHora = HORAS_DISPONIBLES.indexOf(hora);
  const horaIndexSeguro = indiceHora >= 0 ? indiceHora : 8; // 09:00
  const horaPrevia = HORAS_DISPONIBLES[(horaIndexSeguro - 1 + 12) % 12];
  const horaSiguiente = HORAS_DISPONIBLES[(horaIndexSeguro + 1) % 12];

  // Cálculos de minutos (+5 / -5)
  const indiceMinuto = MINUTOS_DISPONIBLES.indexOf(minutos);
  const minutoIndexSeguro = indiceMinuto >= 0 ? indiceMinuto : 0; // 00
  const minutoPrevio = MINUTOS_DISPONIBLES[(minutoIndexSeguro - 1 + MINUTOS_DISPONIBLES.length) % MINUTOS_DISPONIBLES.length];
  const minutoSiguiente = MINUTOS_DISPONIBLES[(minutoIndexSeguro + 1) % MINUTOS_DISPONIBLES.length];

  // Interacción suave con rueda del mouse (bloqueada si el desplegable correspondiente está abierto)
  const manejarRuedaHora = (e: React.WheelEvent) => {
    if (menuHoraAbierto) return;
    e.preventDefault();
    if (e.deltaY < 0) {
      emitirCambio(horaPrevia, minutos, jornada);
    } else if (e.deltaY > 0) {
      emitirCambio(horaSiguiente, minutos, jornada);
    }
  };

  const manejarRuedaMinutos = (e: React.WheelEvent) => {
    if (menuMinutoAbierto) return;
    e.preventDefault();
    if (e.deltaY < 0) {
      emitirCambio(hora, minutoPrevio, jornada);
    } else if (e.deltaY > 0) {
      emitirCambio(hora, minutoSiguiente, jornada);
    }
  };

  const manejarClickAtajo = (atajo: string) => {
    const coincidencia = atajo.match(/^(\d{2}):(\d{2})\s*(AM|PM)$/i);
    if (coincidencia) {
      emitirCambio(coincidencia[1], coincidencia[2], coincidencia[3].toUpperCase() as 'AM' | 'PM');
    } else {
      alCambiar(atajo);
    }
    setMenuHoraAbierto(false);
    setMenuMinutoAbierto(false);
  };

  // Formatear texto visible si el valor viene en 24h o 12h
  const textoMostrado = (() => {
    if (!valor) return placeholder;
    const match24 = valor.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      let numH = parseInt(match24[1], 10);
      const m = match24[2];
      const j = numH >= 12 ? 'PM' : 'AM';
      if (numH > 12) numH -= 12;
      if (numH === 0) numH = 12;
      return `${String(numH).padStart(2, '0')}:${m} ${j}`;
    }
    return valor;
  })();

  return (
    <div className="selector-hora-popover-contenedor">
      {/* Botón Disparador Estandarizado */}
      <button
        ref={disparadorRef}
        type="button"
        className={`selector-hora-disparador ${abierto ? 'abierto' : ''}`}
        onClick={() => {
          setAbierto(!abierto);
          setMenuHoraAbierto(false);
          setMenuMinutoAbierto(false);
        }}
        aria-haspopup="dialog"
        aria-expanded={abierto}
      >
        <span className={`selector-texto-etiqueta ${!valor ? 'es-placeholder' : ''}`}>
          {textoMostrado}
        </span>
        <div className="selector-hora-disparador-icono-wrapper">
          <Clock className="selector-hora-disparador-icono" />
        </div>
      </button>

      {/* Popover Flotante Compacto */}
      {montado && abierto && createPortal(
        <div
          ref={popoverRef}
          className="selector-hora-popover-panel"
          style={{
            position: 'fixed',
            top: `${posicion.top}px`,
            left: `${posicion.left}px`,
            width: `${posicion.width}px`,
            zIndex: 99999,
          }}
          role="dialog"
          aria-label="Seleccionar hora de cita"
        >
          {/* 1. Sección Atajos Rápidos */}
          <div className="selector-hora-seccion">
            <label className="modal-label">Atajos Rápidos</label>
            <div className="selector-hora-atajos-grid">
              {ATAJOS_RAPIDOS.map((atajo) => {
                const esActivo = Boolean(valor) && valor.trim().toUpperCase() === atajo.toUpperCase();
                return (
                  <button
                    key={atajo}
                    type="button"
                    className={`selector-hora-atajo-btn ${esActivo ? 'activo' : ''}`}
                    onClick={() => manejarClickAtajo(atajo)}
                  >
                    {atajo}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divisor Visual Sutil */}
          <div className="selector-hora-divisor" />

          {/* 2. Sección Otra Hora con Selectores Desplegables Premium */}
          <div className="selector-hora-seccion">
            <label className="modal-label">Otra Hora</label>

            <div className="selector-hora-ruedas-fila">
              {/* Columna Stepper + Desplegable de Horas */}
              <div
                className="selector-hora-columna-rueda"
                onWheel={manejarRuedaHora}
                style={{ position: 'relative' }}
              >
                <button
                  type="button"
                  className="selector-hora-rueda-item secundaria"
                  onClick={() => emitirCambio(horaPrevia, minutos, jornada)}
                  aria-label="Hora anterior"
                >
                  {parseInt(horaPrevia, 10)}
                </button>

                {/* Cajetín Selector Desplegable Premium de Hora con EtiquetaTooltip Estándar */}
                <EtiquetaTooltip
                  texto={menuHoraAbierto ? '' : 'Seleccionar hora'}
                  posicion="arriba"
                  className="etiqueta-tooltip-ancho-completo"
                >
                  <button
                    type="button"
                    className={`selector-hora-cajetin-central ${menuHoraAbierto ? 'activo' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuHoraAbierto(!menuHoraAbierto);
                      setMenuMinutoAbierto(false);
                    }}
                  >
                    <span className="selector-hora-cajetin-numero">{hora}</span>
                    <ChevronDown
                      size={11}
                      className={`selector-cajetin-chevron ${menuHoraAbierto ? 'rotado' : ''}`}
                    />
                  </button>
                </EtiquetaTooltip>

                <button
                  type="button"
                  className="selector-hora-rueda-item secundaria"
                  onClick={() => emitirCambio(horaSiguiente, minutos, jornada)}
                  aria-label="Hora siguiente"
                >
                  {parseInt(horaSiguiente, 10)}
                </button>

                {/* Menú Desplegable Personalizado Premium de Horas */}
                {menuHoraAbierto && (
                  <div
                    className="selector-hora-menu-desplegable"
                    role="listbox"
                    onClick={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                  >
                    {HORAS_DISPONIBLES.map((h) => (
                      <button
                        key={h}
                        type="button"
                        className={`selector-desplegable-opcion compacta ${hora === h ? 'seleccionada' : ''}`}
                        onClick={() => {
                          emitirCambio(h, minutos, jornada);
                          setMenuHoraAbierto(false);
                        }}
                      >
                        <span>{h}</span>
                        {hora === h && <Check size={11} className="selector-icono-check" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Columna Stepper + Desplegable de Minutos */}
              <div
                className="selector-hora-columna-rueda"
                onWheel={manejarRuedaMinutos}
                style={{ position: 'relative' }}
              >
                <button
                  type="button"
                  className="selector-hora-rueda-item secundaria"
                  onClick={() => emitirCambio(hora, minutoPrevio, jornada)}
                  aria-label="Minutos anteriores"
                >
                  {minutoPrevio}
                </button>

                {/* Cajetín Selector Desplegable Premium de Minutos con EtiquetaTooltip Estándar */}
                <EtiquetaTooltip
                  texto={menuMinutoAbierto ? '' : 'Seleccionar minutos'}
                  posicion="arriba"
                  className="etiqueta-tooltip-ancho-completo"
                >
                  <button
                    type="button"
                    className={`selector-hora-cajetin-central ${menuMinutoAbierto ? 'activo' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuMinutoAbierto(!menuMinutoAbierto);
                      setMenuHoraAbierto(false);
                    }}
                  >
                    <span className="selector-hora-cajetin-numero">{minutos}</span>
                    <ChevronDown
                      size={11}
                      className={`selector-cajetin-chevron ${menuMinutoAbierto ? 'rotado' : ''}`}
                    />
                  </button>
                </EtiquetaTooltip>

                <button
                  type="button"
                  className="selector-hora-rueda-item secundaria"
                  onClick={() => emitirCambio(hora, minutoSiguiente, jornada)}
                  aria-label="Minutos siguientes"
                >
                  {minutoSiguiente}
                </button>

                {/* Menú Desplegable Personalizado Premium de Minutos */}
                {menuMinutoAbierto && (
                  <div
                    className="selector-hora-menu-desplegable"
                    role="listbox"
                    onClick={(e) => e.stopPropagation()}
                    onWheel={(e) => e.stopPropagation()}
                  >
                    {MINUTOS_DISPONIBLES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`selector-desplegable-opcion compacta ${minutos === m ? 'seleccionada' : ''}`}
                        onClick={() => {
                          emitirCambio(hora, m, jornada);
                          setMenuMinutoAbierto(false);
                        }}
                      >
                        <span>{m}</span>
                        {minutos === m && <Check size={11} className="selector-icono-check" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Interruptor AM / PM estilo píldora */}
              <div className="selector-hora-jornada-contenedor">
                <button
                  type="button"
                  className={`selector-hora-jornada-pastilla ${jornada === 'AM' ? 'activa' : ''}`}
                  onClick={() => emitirCambio(hora, minutos, 'AM')}
                >
                  AM
                </button>
                <button
                  type="button"
                  className={`selector-hora-jornada-pastilla ${jornada === 'PM' ? 'activa' : ''}`}
                  onClick={() => emitirCambio(hora, minutos, 'PM')}
                >
                  PM
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
