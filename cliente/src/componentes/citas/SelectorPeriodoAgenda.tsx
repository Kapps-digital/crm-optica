'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
} from 'lucide-react';
import type { Cita } from '@/tipos/crm';
import {
  obtenerFechaHoyColombia,
  obtenerPartesFechaColombia,
  obtenerFechaObjetoColombia,
} from '@/utilidades/formato';

export type TipoPeriodoAgenda =
  | 'todos'
  | 'hoy'
  | 'ayer'
  | 'esta_semana'
  | 'este_mes'
  | 'mes_anterior'
  | 'este_trimestre'
  | 'rango_fechas'
  | 'dia_especifico'
  | 'mes_especifico';

export interface FiltroPeriodoAgenda {
  tipo: TipoPeriodoAgenda;
  fechaIso?: string; // YYYY-MM-DD cuando tipo === 'dia_especifico'
  fechaInicio?: string; // YYYY-MM-DD cuando tipo === 'rango_fechas'
  fechaFin?: string; // YYYY-MM-DD cuando tipo === 'rango_fechas'
  ano?: number; // cuando tipo === 'mes_especifico'
  mes?: number; // 0-11 cuando tipo === 'mes_especifico'
  etiqueta?: string;
}

interface PropiedadesSelectorPeriodoAgenda {
  filtro: FiltroPeriodoAgenda;
  alCambiarFiltro: (nuevoFiltro: FiltroPeriodoAgenda) => void;
  citas?: Cita[];
}

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DIAS_SEMANA_CORTO = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

/**
 * Función helper pura para validar si una cita coincide con el filtro de período seleccionado
 */
export const evaluarCoincidenciaPeriodo = (
  fechaIso: string | undefined,
  filtro: FiltroPeriodoAgenda
): boolean => {
  if (filtro.tipo === 'todos') return true;
  if (!fechaIso) return false;

  const hoyIso = obtenerFechaHoyColombia();
  const [anoHoy, mesHoy, diaHoy] = hoyIso.split('-').map(Number);
  const hoy = new Date(anoHoy, mesHoy - 1, diaHoy);
  const pad = (n: number) => String(n).padStart(2, '0');

  if (filtro.tipo === 'hoy') {
    return fechaIso === hoyIso;
  }

  if (filtro.tipo === 'ayer') {
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);
    const ayerIso = `${ayer.getFullYear()}-${pad(ayer.getMonth() + 1)}-${pad(ayer.getDate())}`;
    return fechaIso === ayerIso;
  }

  if (filtro.tipo === 'esta_semana') {
    const diaSem = hoy.getDay();
    const diffLunes = diaSem === 0 ? -6 : 1 - diaSem;
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() + diffLunes);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);

    const lunesIso = `${lunes.getFullYear()}-${pad(lunes.getMonth() + 1)}-${pad(lunes.getDate())}`;
    const domingoIso = `${domingo.getFullYear()}-${pad(domingo.getMonth() + 1)}-${pad(domingo.getDate())}`;
    return fechaIso >= lunesIso && fechaIso <= domingoIso;
  }

  if (filtro.tipo === 'este_mes') {
    const prefijo = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}`;
    return fechaIso.startsWith(prefijo);
  }

  if (filtro.tipo === 'mes_anterior') {
    const mesAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const prefijo = `${mesAnt.getFullYear()}-${pad(mesAnt.getMonth() + 1)}`;
    return fechaIso.startsWith(prefijo);
  }

  if (filtro.tipo === 'este_trimestre') {
    const mesActual = hoy.getMonth();
    const inicioTrim = Math.floor(mesActual / 3) * 3;
    const ano = hoy.getFullYear();
    const meses = [inicioTrim + 1, inicioTrim + 2, inicioTrim + 3].map((m) => `${ano}-${pad(m)}`);
    return meses.some((p) => fechaIso.startsWith(p));
  }

  if (filtro.tipo === 'rango_fechas') {
    if (filtro.fechaInicio && filtro.fechaFin) {
      const fMin = filtro.fechaInicio <= filtro.fechaFin ? filtro.fechaInicio : filtro.fechaFin;
      const fMax = filtro.fechaInicio <= filtro.fechaFin ? filtro.fechaFin : filtro.fechaInicio;
      return fechaIso >= fMin && fechaIso <= fMax;
    }
    if (filtro.fechaInicio) {
      return fechaIso === filtro.fechaInicio;
    }
  }

  if (filtro.tipo === 'dia_especifico' && filtro.fechaIso) {
    return fechaIso === filtro.fechaIso;
  }

  if (filtro.tipo === 'mes_especifico' && filtro.ano !== undefined && filtro.mes !== undefined) {
    const prefijo = `${filtro.ano}-${pad(filtro.mes + 1)}`;
    return fechaIso.startsWith(prefijo);
  }

  return true;
};

export const SelectorPeriodoAgenda: React.FC<PropiedadesSelectorPeriodoAgenda> = ({
  filtro,
  alCambiarFiltro,
  citas = [],
}) => {
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false);

  // Visor de mes y año del mini calendario interactivo
  const hoy = useMemo(() => obtenerFechaObjetoColombia(), []);
  const partesHoy = useMemo(() => obtenerPartesFechaColombia(), []);
  const [mesVisor, setMesVisor] = useState(partesHoy.mes);
  const [anoVisor, setAnoVisor] = useState(partesHoy.ano);

  // Estado temporal de selección de rango interactivo
  const [rangoInicioTemp, setRangoInicioTemp] = useState<string | null>(null);
  const [rangoHoverTemp, setRangoHoverTemp] = useState<string | null>(null);

  const botonRef = useRef<HTMLButtonElement>(null);
  const [posicionPopover, setPosicionPopover] = useState<{
    top: number;
    left: number;
    arriba: boolean;
  }>({
    top: 0,
    left: 0,
    arriba: false,
  });

  useEffect(() => {
    setMontado(true);
  }, []);

  // Fechas con citas registradas para puntos indicadores
  const mapaFechasConCitas = useMemo(() => {
    const setF = new Set<string>();
    citas.forEach((c) => {
      if (c.fecha_cita && c.estado !== 'cancelada') {
        setF.add(c.fecha_cita.trim());
      }
    });
    return setF;
  }, [citas]);

  // Si el filtro es un día específico, rango o mes, sincronizar el visor al abrir
  useEffect(() => {
    if (filtro.tipo === 'dia_especifico' && filtro.fechaIso) {
      const [y, m] = filtro.fechaIso.split('-').map(Number);
      if (!isNaN(y) && !isNaN(m)) {
        setAnoVisor(y);
        setMesVisor(m - 1);
      }
    } else if (filtro.tipo === 'rango_fechas' && filtro.fechaInicio) {
      const [y, m] = filtro.fechaInicio.split('-').map(Number);
      if (!isNaN(y) && !isNaN(m)) {
        setAnoVisor(y);
        setMesVisor(m - 1);
      }
    } else if (filtro.tipo === 'mes_especifico' && filtro.ano !== undefined && filtro.mes !== undefined) {
      setAnoVisor(filtro.ano);
      setMesVisor(filtro.mes);
    } else if (filtro.tipo === 'mes_anterior') {
      const mesAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      setAnoVisor(mesAnt.getFullYear());
      setMesVisor(mesAnt.getMonth());
    }
  }, [filtro, hoy]);

  // Limpiar rango temporal al abrir/cerrar
  useEffect(() => {
    if (!abierto) {
      setRangoInicioTemp(null);
      setRangoHoverTemp(null);
    }
  }, [abierto]);

  // Calcular coordenadas del popover flotante
  const actualizarPosicion = () => {
    if (!botonRef.current) return;
    const rect = botonRef.current.getBoundingClientRect();
    const alturaAprox = 360;
    const espacioAbajo = window.innerHeight - rect.bottom;
    const mostrarArriba = espacioAbajo < alturaAprox && rect.top > espacioAbajo;

    setPosicionPopover({
      top: mostrarArriba ? rect.top - alturaAprox - 6 : rect.bottom + 6,
      left: Math.max(12, Math.min(rect.left, window.innerWidth - 505)),
      arriba: mostrarArriba,
    });
  };

  useEffect(() => {
    if (abierto) {
      actualizarPosicion();
      const manejarEvento = () => actualizarPosicion();
      window.addEventListener('scroll', manejarEvento, true);
      window.addEventListener('resize', manejarEvento);
      return () => {
        window.removeEventListener('scroll', manejarEvento, true);
        window.removeEventListener('resize', manejarEvento);
      };
    }
  }, [abierto]);

  // Cerrar al hacer clic fuera o Escape
  useEffect(() => {
    if (!abierto) return;
    const manejarClickFuera = (e: MouseEvent) => {
      const objetivo = e.target as HTMLElement;
      if (botonRef.current?.contains(objetivo) || objetivo.closest('.filtro-cal-agenda-popover')) {
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

  // Navegación de mes del mini-calendario
  const mesAnterior = () => {
    if (mesVisor === 0) {
      setMesVisor(11);
      setAnoVisor((prev) => prev - 1);
    } else {
      setMesVisor((prev) => prev - 1);
    }
  };

  const mesSiguiente = () => {
    if (mesVisor === 11) {
      setMesVisor(0);
      setAnoVisor((prev) => prev + 1);
    } else {
      setMesVisor((prev) => prev + 1);
    }
  };

  // Formato legible de fecha corta
  const formatearFechaCorta = (fechaIso: string) => {
    const [y, m, d] = fechaIso.split('-').map(Number);
    const mesCorto = NOMBRES_MESES[m - 1]?.substring(0, 3) || '';
    return `${String(d).padStart(2, '0')} ${mesCorto} ${y}`;
  };

  // Texto visible en el botón de la barra de herramientas
  const textoBoton = useMemo(() => {
    switch (filtro.tipo) {
      case 'todos':
        return 'Todo el Histórico';
      case 'hoy': {
        const dia = hoy.getDate();
        const mesCorto = NOMBRES_MESES[hoy.getMonth()].substring(0, 3);
        return `Hoy (${dia} ${mesCorto})`;
      }
      case 'ayer': {
        const ayer = new Date(hoy);
        ayer.setDate(ayer.getDate() - 1);
        const dia = ayer.getDate();
        const mesCorto = NOMBRES_MESES[ayer.getMonth()].substring(0, 3);
        return `Ayer (${dia} ${mesCorto})`;
      }
      case 'esta_semana':
        return 'Esta Semana';
      case 'este_mes':
        return `Este Mes (${NOMBRES_MESES[hoy.getMonth()]})`;
      case 'mes_anterior': {
        const mesAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        return `Mes Pasado (${NOMBRES_MESES[mesAnt.getMonth()]})`;
      }
      case 'este_trimestre': {
        const q = Math.floor(hoy.getMonth() / 3) + 1;
        return `Trimestre T${q} (${hoy.getFullYear()})`;
      }
      case 'rango_fechas': {
        if (!filtro.fechaInicio || !filtro.fechaFin) return 'Rango seleccionado';
        const [y1, m1, d1] = filtro.fechaInicio.split('-').map(Number);
        const [y2, m2, d2] = filtro.fechaFin.split('-').map(Number);
        const mes1 = NOMBRES_MESES[m1 - 1]?.substring(0, 3) || '';
        const mes2 = NOMBRES_MESES[m2 - 1]?.substring(0, 3) || '';
        if (y1 === y2) {
          if (m1 === m2) {
            return `${String(d1).padStart(2, '0')} - ${String(d2).padStart(2, '0')} ${mes1} ${y1}`;
          }
          return `${String(d1).padStart(2, '0')} ${mes1} - ${String(d2).padStart(2, '0')} ${mes2} ${y1}`;
        }
        return `${String(d1).padStart(2, '0')} ${mes1} ${y1} - ${String(d2).padStart(2, '0')} ${mes2} ${y2}`;
      }
      case 'dia_especifico': {
        if (!filtro.fechaIso) return 'Día seleccionado';
        return formatearFechaCorta(filtro.fechaIso);
      }
      case 'mes_especifico': {
        const mesNombre = NOMBRES_MESES[filtro.mes ?? 0];
        return `${mesNombre} ${filtro.ano}`;
      }
      default:
        return 'Filtrar por Fecha';
    }
  }, [filtro, hoy]);

  // Manejar clic en día del calendario interactivo (soporte de rango de fecha)
  const manejarClickDia = (fechaCadena: string) => {
    if (!rangoInicioTemp) {
      // Primer clic: marcar inicio de rango
      setRangoInicioTemp(fechaCadena);
      setRangoHoverTemp(fechaCadena);
    } else {
      // Segundo clic: consolidar rango
      const fMin = rangoInicioTemp <= fechaCadena ? rangoInicioTemp : fechaCadena;
      const fMax = rangoInicioTemp <= fechaCadena ? fechaCadena : rangoInicioTemp;

      if (fMin === fMax) {
        // Mismo día: filtrar día puntual
        alCambiarFiltro({
          tipo: 'dia_especifico',
          fechaIso: fMin,
          etiqueta: formatearFechaCorta(fMin),
        });
      } else {
        // Rango de fechas
        alCambiarFiltro({
          tipo: 'rango_fechas',
          fechaInicio: fMin,
          fechaFin: fMax,
          etiqueta: `${formatearFechaCorta(fMin)} - ${formatearFechaCorta(fMax)}`,
        });
      }
      setRangoInicioTemp(null);
      setRangoHoverTemp(null);
      setAbierto(false);
    }
  };

  // Manejar hover mientras se define el rango
  const manejarHoverDia = (fechaCadena: string) => {
    if (rangoInicioTemp) {
      setRangoHoverTemp(fechaCadena);
    }
  };

  // Aplicar solo el día de inicio si el usuario no desea rango
  const manejarAplicarSoloDiaInicio = () => {
    if (rangoInicioTemp) {
      alCambiarFiltro({
        tipo: 'dia_especifico',
        fechaIso: rangoInicioTemp,
        etiqueta: formatearFechaCorta(rangoInicioTemp),
      });
      setRangoInicioTemp(null);
      setRangoHoverTemp(null);
      setAbierto(false);
    }
  };

  // Selección de todo el mes del visor
  const manejarSeleccionarMesVisor = () => {
    alCambiarFiltro({
      tipo: 'mes_especifico',
      ano: anoVisor,
      mes: mesVisor,
      etiqueta: `${NOMBRES_MESES[mesVisor]} ${anoVisor}`,
    });
    setRangoInicioTemp(null);
    setRangoHoverTemp(null);
    setAbierto(false);
  };

  // Cálculos de la cuadrícula de días para el visor
  const primerDiaMes = new Date(anoVisor, mesVisor, 1).getDay(); // 0 = Domingo
  const diasEnMes = new Date(anoVisor, mesVisor + 1, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  const hoyIso = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;

  // Determinación de rango activo (en proceso de hover o consolidado)
  const rangoMin = useMemo(() => {
    if (rangoInicioTemp) {
      const otro = rangoHoverTemp || rangoInicioTemp;
      return rangoInicioTemp <= otro ? rangoInicioTemp : otro;
    }
    if (filtro.tipo === 'rango_fechas' && filtro.fechaInicio && filtro.fechaFin) {
      return filtro.fechaInicio <= filtro.fechaFin ? filtro.fechaInicio : filtro.fechaFin;
    }
    return null;
  }, [rangoInicioTemp, rangoHoverTemp, filtro]);

  const rangoMax = useMemo(() => {
    if (rangoInicioTemp) {
      const otro = rangoHoverTemp || rangoInicioTemp;
      return rangoInicioTemp <= otro ? otro : rangoInicioTemp;
    }
    if (filtro.tipo === 'rango_fechas' && filtro.fechaInicio && filtro.fechaFin) {
      return filtro.fechaInicio <= filtro.fechaFin ? filtro.fechaFin : filtro.fechaInicio;
    }
    return null;
  }, [rangoInicioTemp, rangoHoverTemp, filtro]);

  return (
    <div className="filtro-cal-agenda-contenedor">
      {/* Botón Principal Disparador Tipo Calendario */}
      <button
        ref={botonRef}
        type="button"
        onClick={() => setAbierto(!abierto)}
        className={`filtro-cal-agenda-boton ${abierto ? 'activo' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={abierto}
      >
        <div className="filtro-cal-agenda-icono-wrapper">
          <CalendarDays size={14} className="icono-cal" />
        </div>
        <span className="filtro-cal-agenda-texto">{textoBoton}</span>
        <ChevronDown size={13} className={`filtro-cal-agenda-chevron ${abierto ? 'rotado' : ''}`} />
      </button>

      {/* Popover Menú Flotante: Accesos Rápidos (Sin Iconos) + Calendario Interactivo con Rango */}
      {montado &&
        abierto &&
        createPortal(
          <div
            className="filtro-cal-agenda-popover"
            style={{
              top: `${posicionPopover.top}px`,
              left: `${posicionPopover.left}px`,
            }}
            role="dialog"
            aria-label="Filtro de fecha para la agenda"
          >
            {/* Panel Lateral Izquierdo: Accesos Rápidos de Período (Limpios, Sin Emojis) */}
            <div className="filtro-cal-agenda-lateral">
              <span className="filtro-cal-lateral-titulo">Períodos Frecuentes</span>

              <button
                type="button"
                className={`filtro-cal-btn-periodo ${filtro.tipo === 'todos' ? 'activo' : ''}`}
                onClick={() => {
                  alCambiarFiltro({ tipo: 'todos' });
                  setAbierto(false);
                }}
              >
                <span>Todo el Histórico</span>
                {filtro.tipo === 'todos' && <Check size={13} />}
              </button>

              <button
                type="button"
                className={`filtro-cal-btn-periodo ${filtro.tipo === 'hoy' ? 'activo' : ''}`}
                onClick={() => {
                  alCambiarFiltro({ tipo: 'hoy' });
                  setAbierto(false);
                }}
              >
                <span>Hoy</span>
                {filtro.tipo === 'hoy' && <Check size={13} />}
              </button>

              <button
                type="button"
                className={`filtro-cal-btn-periodo ${filtro.tipo === 'ayer' ? 'activo' : ''}`}
                onClick={() => {
                  alCambiarFiltro({ tipo: 'ayer' });
                  setAbierto(false);
                }}
              >
                <span>Ayer</span>
                {filtro.tipo === 'ayer' && <Check size={13} />}
              </button>

              <button
                type="button"
                className={`filtro-cal-btn-periodo ${filtro.tipo === 'esta_semana' ? 'activo' : ''}`}
                onClick={() => {
                  alCambiarFiltro({ tipo: 'esta_semana' });
                  setAbierto(false);
                }}
              >
                <span>Esta Semana</span>
                {filtro.tipo === 'esta_semana' && <Check size={13} />}
              </button>

              <button
                type="button"
                className={`filtro-cal-btn-periodo ${filtro.tipo === 'este_mes' ? 'activo' : ''}`}
                onClick={() => {
                  alCambiarFiltro({ tipo: 'este_mes' });
                  setAbierto(false);
                }}
              >
                <span>Este Mes</span>
                {filtro.tipo === 'este_mes' && <Check size={13} />}
              </button>

              <button
                type="button"
                className={`filtro-cal-btn-periodo ${filtro.tipo === 'mes_anterior' ? 'activo' : ''}`}
                onClick={() => {
                  alCambiarFiltro({ tipo: 'mes_anterior' });
                  setAbierto(false);
                }}
              >
                <span>Mes Pasado</span>
                {filtro.tipo === 'mes_anterior' && <Check size={13} />}
              </button>

              <button
                type="button"
                className={`filtro-cal-btn-periodo ${filtro.tipo === 'este_trimestre' ? 'activo' : ''}`}
                onClick={() => {
                  alCambiarFiltro({ tipo: 'este_trimestre' });
                  setAbierto(false);
                }}
              >
                <span>Este Trimestre</span>
                {filtro.tipo === 'este_trimestre' && <Check size={13} />}
              </button>
            </div>

            {/* Panel Derecho: Mini Calendario Interactivo con Selección de Rango */}
            <div className="filtro-cal-agenda-calendario">
              {/* Cabecera del Mes con Flechas de Navegación */}
              <div className="filtro-cal-cal-cabecera">
                <button
                  type="button"
                  onClick={mesAnterior}
                  className="filtro-cal-nav-btn"
                  aria-label="Mes anterior"
                >
                  <ChevronLeft size={15} />
                </button>

                <div className="filtro-cal-mes-ano">
                  <strong>{NOMBRES_MESES[mesVisor]}</strong>
                  <span>{anoVisor}</span>
                </div>

                <button
                  type="button"
                  onClick={mesSiguiente}
                  className="filtro-cal-nav-btn"
                  aria-label="Mes siguiente"
                >
                  <ChevronRight size={15} />
                </button>
              </div>

              {/* Barra de Indicación de Rango */}
              <div className="filtro-cal-barra-ayuda-rango">
                {rangoInicioTemp ? (
                  <div className="rango-ayuda-texto activo">
                    <span>
                      Inicio: <strong>{formatearFechaCorta(rangoInicioTemp)}</strong> → Elige fecha fin
                    </span>
                    <button
                      type="button"
                      className="rango-btn-solo-dia"
                      onClick={manejarAplicarSoloDiaInicio}
                    >
                      Solo este día
                    </button>
                  </div>
                ) : (
                  <span className="rango-ayuda-texto">
                    Haz clic para elegir una fecha o rango (desde - hasta)
                  </span>
                )}
              </div>

              {/* Días de la semana */}
              <div className="filtro-cal-dias-semana">
                {DIAS_SEMANA_CORTO.map((d, i) => (
                  <span key={i} className="filtro-cal-col-dia-nom">
                    {d}
                  </span>
                ))}
              </div>

              {/* Cuadrícula de Días con Soporte de Rango */}
              <div className="filtro-cal-grid-dias">
                {Array.from({ length: primerDiaMes }).map((_, idx) => (
                  <div key={`espacio-${idx}`} className="filtro-cal-celda-espacio" />
                ))}

                {Array.from({ length: diasEnMes }).map((_, idx) => {
                  const dia = idx + 1;
                  const diaFormateado = String(dia).padStart(2, '0');
                  const mesFormateado = String(mesVisor + 1).padStart(2, '0');
                  const fechaDiaCadena = `${anoVisor}-${mesFormateado}-${diaFormateado}`;

                  const esHoy = fechaDiaCadena === hoyIso;
                  const tieneCitas = mapaFechasConCitas.has(fechaDiaCadena);

                  // Cálculos de clase de rango
                  let claseRango = '';
                  const esInicio = rangoMin === fechaDiaCadena;
                  const esFin = rangoMax === fechaDiaCadena;

                  if (esInicio && esFin) {
                    claseRango = 'rango-unico';
                  } else if (esInicio) {
                    claseRango = 'rango-inicio';
                  } else if (esFin) {
                    claseRango = 'rango-fin';
                  } else if (rangoMin && rangoMax && fechaDiaCadena > rangoMin && fechaDiaCadena < rangoMax) {
                    claseRango = 'en-rango';
                  } else if (filtro.tipo === 'dia_especifico' && filtro.fechaIso === fechaDiaCadena) {
                    claseRango = 'rango-unico';
                  }

                  return (
                    <button
                      key={dia}
                      type="button"
                      onClick={() => manejarClickDia(fechaDiaCadena)}
                      onMouseEnter={() => manejarHoverDia(fechaDiaCadena)}
                      className={`filtro-cal-btn-dia ${claseRango} ${esHoy ? 'es-hoy' : ''}`}
                      title={tieneCitas ? `Citas registradas el ${diaFormateado}/${mesFormateado}` : undefined}
                    >
                      <span className="numero-dia">{dia}</span>
                      {tieneCitas && <span className="punto-tiene-citas" />}
                    </button>
                  );
                })}
              </div>

              {/* Botón para seleccionar todo el mes del visor */}
              <div className="filtro-cal-pie-acciones">
                <button
                  type="button"
                  className={`filtro-cal-btn-mes-completo ${
                    filtro.tipo === 'mes_especifico' &&
                    filtro.ano === anoVisor &&
                    filtro.mes === mesVisor
                      ? 'activo'
                      : ''
                  }`}
                  onClick={manejarSeleccionarMesVisor}
                >
                  Filtrar todo {NOMBRES_MESES[mesVisor]} {anoVisor}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
