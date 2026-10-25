'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, CalendarCheck2 } from 'lucide-react';
import { obtenerFechaHoyColombia, obtenerFechaMananaColombia } from '@/utilidades/formato';

interface PropiedadesSelectorFecha {
  valor: string; // Formato YYYY-MM-DD
  alCambiar: (nuevaFecha: string) => void;
  placeholder?: string;
  min?: string;
  anchoMinimo?: string;
}

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DIAS_SEMANA_CORTO = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

export const SelectorFecha: React.FC<PropiedadesSelectorFecha> = ({
  valor,
  alCambiar,
  placeholder = 'Seleccionar fecha...',
  min,
  anchoMinimo = '100%',
}) => {
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false);

  // Fecha visible en el visor de navegación del calendario (año y mes)
  const fechaInicial = valor ? new Date(`${valor}T00:00:00`) : new Date();
  const [mesActual, setMesActual] = useState(fechaInicial.getMonth());
  const [anoActual, setAnoActual] = useState(fechaInicial.getFullYear());

  const botonRef = useRef<HTMLButtonElement>(null);
  const [posicionMenu, setPosicionMenu] = useState<{
    top: number;
    left: number;
    width: number;
    arriba: boolean;
  }>({
    top: 0,
    left: 0,
    width: 290,
    arriba: false,
  });

  useEffect(() => {
    setMontado(true);
  }, []);

  // Actualizar mes/año del visor si el valor cambia externamente
  useEffect(() => {
    if (valor) {
      const d = new Date(`${valor}T00:00:00`);
      if (!isNaN(d.getTime())) {
        setMesActual(d.getMonth());
        setAnoActual(d.getFullYear());
      }
    }
  }, [valor]);

  const calcularPosicion = () => {
    if (!botonRef.current) return;
    const rect = botonRef.current.getBoundingClientRect();
    const alturaCalendario = 310;
    const espacioAbajo = window.innerHeight - rect.bottom;
    const espacioArriba = rect.top;

    const mostrarArriba = espacioAbajo < alturaCalendario && espacioArriba > espacioAbajo;

    setPosicionMenu({
      top: mostrarArriba ? rect.top - alturaCalendario - 6 : rect.bottom + 6,
      left: Math.max(12, Math.min(rect.left, window.innerWidth - 305)),
      width: Math.max(285, rect.width),
      arriba: mostrarArriba,
    });
  };

  useEffect(() => {
    if (abierto) {
      calcularPosicion();
      const manejarScrollResize = () => calcularPosicion();
      window.addEventListener('scroll', manejarScrollResize, true);
      window.addEventListener('resize', manejarScrollResize);
      return () => {
        window.removeEventListener('scroll', manejarScrollResize, true);
        window.removeEventListener('resize', manejarScrollResize);
      };
    }
  }, [abierto]);

  // Cerrar al presionar fuera o tecla Escape
  useEffect(() => {
    if (!abierto) return;

    const manejarClickFuera = (e: MouseEvent) => {
      const objetivo = e.target as HTMLElement;
      if (
        botonRef.current?.contains(objetivo) ||
        objetivo.closest('.selector-calendario-menu')
      ) {
        return;
      }
      setAbierto(false);
    };

    const manejarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };

    document.addEventListener('mousedown', manejarClickFuera);
    document.addEventListener('keydown', manejarTecla);
    return () => {
      document.removeEventListener('mousedown', manejarClickFuera);
      document.removeEventListener('keydown', manejarTecla);
    };
  }, [abierto]);

  const mesAnterior = () => {
    if (mesActual === 0) {
      setMesActual(11);
      setAnoActual(anoActual - 1);
    } else {
      setMesActual(mesActual - 1);
    }
  };

  const mesSiguiente = () => {
    if (mesActual === 11) {
      setMesActual(0);
      setAnoActual(anoActual + 1);
    } else {
      setMesActual(mesActual + 1);
    }
  };

  // Generación de días del mes
  const primerDiaMes = new Date(anoActual, mesActual, 1).getDay(); // 0 = Domingo
  const diasEnMes = new Date(anoActual, mesActual + 1, 0).getDate();
  const fechaHoy = obtenerFechaHoyColombia();

  const seleccionarDia = (dia: number) => {
    const diaFormateado = String(dia).padStart(2, '0');
    const mesFormateado = String(mesActual + 1).padStart(2, '0');
    const fechaResultado = `${anoActual}-${mesFormateado}-${diaFormateado}`;
    alCambiar(fechaResultado);
    setAbierto(false);
  };

  const seleccionarHoy = () => {
    alCambiar(obtenerFechaHoyColombia());
    setAbierto(false);
  };

  const seleccionarManana = () => {
    alCambiar(obtenerFechaMananaColombia());
    setAbierto(false);
  };

  // Formato para el botón visible
  const formatearTextoBoton = () => {
    if (!valor) return placeholder;
    const d = new Date(`${valor}T00:00:00`);
    if (isNaN(d.getTime())) return valor;
    const dia = d.getDate();
    const mes = NOMBRES_MESES[d.getMonth()].substring(0, 3);
    const ano = d.getFullYear();
    const nombreDia = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()];
    return `${nombreDia}, ${dia} ${mes} ${ano}`;
  };

  return (
    <div
      className="selector-fecha-contenedor"
      style={{ minWidth: anchoMinimo, width: anchoMinimo }}
    >
      <button
        ref={botonRef}
        type="button"
        onClick={() => setAbierto(!abierto)}
        className={`selector-fecha-boton ${abierto ? 'activo' : ''} ${!valor ? 'sin-valor' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={abierto}
      >
        <div className="selector-fecha-boton-izq">
          <Calendar className="selector-fecha-icono" style={{ width: '15px', height: '15px' }} />
          <span className={`selector-fecha-texto ${!valor ? 'es-placeholder' : ''}`}>
            {formatearTextoBoton()}
          </span>
        </div>
      </button>

      {montado &&
        abierto &&
        createPortal(
          <div
            className="selector-calendario-menu"
            style={{
              top: `${posicionMenu.top}px`,
              left: `${posicionMenu.left}px`,
              width: `${posicionMenu.width}px`,
            }}
            role="dialog"
            aria-label="Calendario de citas"
          >
            {/* Cabecera del visor de mes/año */}
            <div className="selector-cal-cabecera">
              <button
                type="button"
                onClick={mesAnterior}
                className="selector-cal-btn-flecha"
                aria-label="Mes anterior"
              >
                <ChevronLeft style={{ width: '15px', height: '15px' }} />
              </button>

              <div className="selector-cal-titulo-mes">
                <strong>{NOMBRES_MESES[mesActual]}</strong>
                <span>{anoActual}</span>
              </div>

              <button
                type="button"
                onClick={mesSiguiente}
                className="selector-cal-btn-flecha"
                aria-label="Mes siguiente"
              >
                <ChevronRight style={{ width: '15px', height: '15px' }} />
              </button>
            </div>

            {/* Días de la semana */}
            <div className="selector-cal-grid-dias-semana">
              {DIAS_SEMANA_CORTO.map((dia, idx) => (
                <span key={idx} className="selector-cal-col-semana">
                  {dia}
                </span>
              ))}
            </div>

            {/* Matriz de días */}
            <div className="selector-cal-grid-dias">
              {Array.from({ length: primerDiaMes }).map((_, idx) => (
                <div key={`vacio-${idx}`} className="selector-cal-celda-vacia" />
              ))}

              {Array.from({ length: diasEnMes }).map((_, idx) => {
                const dia = idx + 1;
                const diaPad = String(dia).padStart(2, '0');
                const mesPad = String(mesActual + 1).padStart(2, '0');
                const fechaCadena = `${anoActual}-${mesPad}-${diaPad}`;
                const esSeleccionado = valor === fechaCadena;
                const esHoy = fechaHoy === fechaCadena;
                const esPasado = min ? fechaCadena < min : false;

                return (
                  <button
                    key={dia}
                    type="button"
                    disabled={esPasado}
                    onClick={() => seleccionarDia(dia)}
                    className={`selector-cal-btn-dia ${esSeleccionado ? 'seleccionado' : ''} ${esHoy ? 'hoy' : ''} ${esPasado ? 'deshabilitado' : ''}`}
                  >
                    <span>{dia}</span>
                    {esHoy && !esSeleccionado && <span className="selector-cal-punto-hoy" />}
                  </button>
                );
              })}
            </div>

            {/* Accesos rápidos corporativos */}
            <div className="selector-cal-pie">
              <button
                type="button"
                onClick={seleccionarHoy}
                className="selector-cal-btn-acceso"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={seleccionarManana}
                className="selector-cal-btn-acceso"
              >
                Mañana
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
