'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  Check,
} from 'lucide-react';
import { obtenerFechaHoyColombia, obtenerFechaMananaColombia } from '@/utilidades/formato';

interface PropiedadesSelectorFecha {
  valor: string; // Formato YYYY-MM-DD
  alCambiar: (nuevaFecha: string) => void;
  placeholder?: string;
  min?: string;
  anchoMinimo?: string;
  estiloBoton?: React.CSSProperties;
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
  estiloBoton,
}) => {
  const [abierto, setAbierto] = useState(false);
  const [montado, setMontado] = useState(false);

  // Fecha visible en el visor de navegación del calendario (año y mes)
  const fechaInicial = valor ? new Date(`${valor}T00:00:00`) : new Date();
  const [mesActual, setMesActual] = useState(fechaInicial.getMonth());
  const [anoActual, setAnoActual] = useState(fechaInicial.getFullYear());

  const [modoVista, setModoVista] = useState<'dias' | 'meses_anos'>('dias');
  const [busquedaPeriodo, setBusquedaPeriodo] = useState('');

  const anoBase = new Date().getFullYear();

  // Años frecuentes para píldoras rápidas
  const aniosRapidos = useMemo(() => {
    const lista: number[] = [];
    const inicio = Math.min(anoBase, anoActual);
    const fin = Math.max(anoBase + 6, anoActual + 3);
    for (let a = inicio; a <= fin; a++) {
      lista.push(a);
    }
    return lista;
  }, [anoBase, anoActual]);

  // Lista unificada de todos los períodos (Mes + Año)
  const periodosDisponibles = useMemo(() => {
    const lista: { mes: number; ano: number; etiqueta: string; busqueda: string }[] = [];
    const minAno = Math.min(anoBase - 3, anoActual - 3);
    const maxAno = Math.max(anoBase + 12, anoActual + 6);
    for (let a = minAno; a <= maxAno; a++) {
      for (let m = 0; m < 12; m++) {
        const nombreMes = NOMBRES_MESES[m];
        lista.push({
          mes: m,
          ano: a,
          etiqueta: `${nombreMes} ${a}`,
          busqueda: `${nombreMes} ${a} ${nombreMes.substring(0, 3)}`.toLowerCase(),
        });
      }
    }
    return lista;
  }, [anoBase, anoActual]);

  // Filtrado reactivo en tiempo real
  const periodosFiltrados = useMemo(() => {
    if (!busquedaPeriodo.trim()) {
      return periodosDisponibles;
    }
    const q = busquedaPeriodo.toLowerCase().trim();
    return periodosDisponibles.filter((p) => p.busqueda.includes(q));
  }, [periodosDisponibles, busquedaPeriodo]);

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
    const anchoCalendario = 270;
    const alturaCalendario = 285;
    const espacioAbajo = window.innerHeight - rect.bottom;
    const espacioArriba = rect.top;

    // Solo mostrar arriba si abajo NO cabe y arriba SÍ cabe con más holgura
    const mostrarArriba = espacioAbajo < alturaCalendario && espacioArriba > espacioAbajo;

    let left = rect.left;
    if (left + anchoCalendario > window.innerWidth - 12) {
      left = Math.max(12, rect.right - anchoCalendario);
    }
    if (left < 12) left = 12;

    const top = mostrarArriba
      ? Math.max(10, rect.top - alturaCalendario - 6)
      : Math.min(window.innerHeight - alturaCalendario - 10, rect.bottom + 6);

    setPosicionMenu({
      top,
      left,
      width: anchoCalendario,
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
      setModoVista('dias');
      setBusquedaPeriodo('');
    };

    const manejarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (modoVista === 'meses_anos') {
          setModoVista('dias');
        } else {
          setAbierto(false);
        }
      }
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
        style={estiloBoton}
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
            {modoVista === 'meses_anos' ? (
              /* Vista Unificada de Búsqueda y Selección de Mes y Año */
              <div className="selector-cal-panel-periodo">
                <div className="selector-cal-buscador-fila">
                  <div className="selector-cal-buscador-input-caja">
                    <Search size={13} className="selector-cal-buscador-icono" />
                    <input
                      type="text"
                      autoFocus
                      value={busquedaPeriodo}
                      onChange={(e) => setBusquedaPeriodo(e.target.value)}
                      placeholder="Buscar mes o año (ej: 2027, dic)..."
                      className="selector-cal-buscador-input"
                    />
                    {busquedaPeriodo && (
                      <button
                        type="button"
                        onClick={() => setBusquedaPeriodo('')}
                        className="selector-cal-btn-limpiar-busqueda"
                        aria-label="Limpiar búsqueda"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setModoVista('dias')}
                    className="selector-cal-btn-volver"
                    title="Volver a los días"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Píldoras de Años Rápidos */}
                <div className="selector-cal-pildoras-fila">
                  {aniosRapidos.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => {
                        setBusquedaPeriodo(String(a));
                      }}
                      className={`selector-cal-pildora-ano ${busquedaPeriodo === String(a) || (!busquedaPeriodo && anoActual === a) ? 'activa' : ''}`}
                    >
                      {a}
                    </button>
                  ))}
                </div>

                {/* Lista de Períodos Unificada */}
                <div className="selector-cal-lista-periodos">
                  {periodosFiltrados.map((item) => {
                    const esActivo = item.mes === mesActual && item.ano === anoActual;
                    return (
                      <button
                        key={`${item.ano}-${item.mes}`}
                        type="button"
                        onClick={() => {
                          setMesActual(item.mes);
                          setAnoActual(item.ano);
                          setModoVista('dias');
                          setBusquedaPeriodo('');
                        }}
                        className={`selector-cal-item-periodo ${esActivo ? 'activo' : ''}`}
                      >
                        <span>{item.etiqueta}</span>
                        {esActivo && <Check size={14} style={{ color: 'var(--color-primario, #0284c7)' }} />}
                      </button>
                    );
                  })}
                  {periodosFiltrados.length === 0 && (
                    <div className="selector-cal-sin-resultados">
                      No se encontró "{busquedaPeriodo}"
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Vista Estándar de Calendario con Días */
              <>
                {/* Cabecera con Botón Unificado de Mes y Año */}
                <div className="selector-cal-cabecera">
                  <button
                    type="button"
                    onClick={mesAnterior}
                    className="selector-cal-btn-flecha"
                    aria-label="Mes anterior"
                  >
                    <ChevronLeft style={{ width: '15px', height: '15px' }} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModoVista('meses_anos');
                      setBusquedaPeriodo('');
                    }}
                    className="selector-cal-btn-titulo-periodo"
                    title="Clic para buscar y seleccionar mes y año"
                  >
                    <strong>{NOMBRES_MESES[mesActual]}</strong>
                    <span>{anoActual}</span>
                    <ChevronDown style={{ width: '13px', height: '13px', color: 'var(--color-primario-claro)' }} />
                  </button>

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
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
