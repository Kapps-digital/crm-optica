'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X, Plus, Edit3 } from 'lucide-react';
import { EtiquetaTooltip } from './EtiquetaTooltip';

export interface OpcionDesplegable {
  valor: string | number;
  etiqueta: string;
  etiquetaCorta?: string;
  badge?: string;
  claseBadge?: string;
  colorIndicador?: string;
  icono?: React.ComponentType<{ size?: number; className?: string }>;
  textoBusquedaExtra?: string;
}

export interface PropiedadesSelectorDesplegable {
  valor: string | number;
  alCambiar: (nuevoValor: string) => void;
  opciones: (string | number | OpcionDesplegable)[];
  icono?: React.ComponentType<{ size?: number; className?: string }>;
  placeholder?: string;
  anchoMinimo?: string;
  posicionAlineacion?: 'izquierda' | 'derecha';
  direccion?: 'abajo' | 'arriba';
  tamano?: 'normal' | 'compacto';
  deshabilitado?: boolean;
  conBuscador?: boolean;
  placeholderBuscador?: string;
  className?: string;
  style?: React.CSSProperties;
  estiloBoton?: React.CSSProperties;
  alCrearNuevo?: (nuevoValor: string) => Promise<boolean | void> | void;
  textoCrearNuevo?: string;
  permitirCrearNuevo?: boolean;
  alEditarOpcion?: (opcion: OpcionDesplegable, evento: React.MouseEvent) => void;
}

/**
 * Componente Reutilizable: SelectorDesplegable
 * Estandarizado bajo la skill de diseño corporativo premium.
 * Renderiza el menú flotante en un portal DOM (`createPortal`) para evitar recortes en modales o tarjetas.
 * Soporta buscador sutil integrado para grandes listados (ej: pacientes).
 */
export const SelectorDesplegable: React.FC<PropiedadesSelectorDesplegable> = ({
  valor,
  alCambiar,
  opciones = [],
  icono: IconoGeneral,
  placeholder = 'Seleccionar...',
  anchoMinimo = '100%',
  posicionAlineacion = 'izquierda',
  direccion = 'abajo',
  tamano = 'normal',
  deshabilitado = false,
  conBuscador = false,
  placeholderBuscador = 'Buscar...',
  className = '',
  style = {},
  estiloBoton = {},
  alCrearNuevo,
  textoCrearNuevo,
  permitirCrearNuevo = false,
  alEditarOpcion,
}) => {
  const [estaAbierto, setEstaAbierto] = useState(false);
  const [montado, setMontado] = useState(false);
  const [estiloPosicion, setEstiloPosicion] = useState<React.CSSProperties>({});
  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);
  const [mostrarInputCrear, setMostrarInputCrear] = useState(false);
  const [valorInputCrear, setValorInputCrear] = useState('');

  const referenciaContenedor = useRef<HTMLDivElement>(null);
  const referenciaMenu = useRef<HTMLDivElement>(null);
  const referenciaInputBusqueda = useRef<HTMLInputElement>(null);
  const referenciaInputNuevo = useRef<HTMLInputElement>(null);
  const referenciaLista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMontado(true);
  }, []);

  // Normalizar opciones (acepta cadenas, números u objetos)
  const opcionesNormalizadas: OpcionDesplegable[] = useMemo(() => {
    return opciones.map((opc) => {
      if (typeof opc === 'object' && opc !== null) {
        return opc;
      }
      return { valor: opc, etiqueta: String(opc) };
    });
  }, [opciones]);

  // Filtrado de opciones en tiempo real por término de búsqueda (nombre, teléfono o valor)
  const opcionesFiltradas = useMemo(() => {
    if (!conBuscador || !terminoBusqueda.trim()) {
      return opcionesNormalizadas;
    }
    const termino = terminoBusqueda.trim().toLowerCase();
    const terminoDigitos = termino.replace(/\D/g, '');

    return opcionesNormalizadas.filter((opc) => {
      const matchEtiqueta = opc.etiqueta.toLowerCase().includes(termino);
      const matchValor = String(opc.valor).toLowerCase().includes(termino);
      const matchExtra = opc.textoBusquedaExtra
        ? opc.textoBusquedaExtra.toLowerCase().includes(termino)
        : false;

      if (matchEtiqueta || matchValor || matchExtra) return true;

      // Búsqueda inteligente por dígitos (para números de teléfono limpios)
      if (terminoDigitos.length >= 3) {
        const digitosEtiqueta = opc.etiqueta.replace(/\D/g, '');
        const digitosExtra = (opc.textoBusquedaExtra || '').replace(/\D/g, '');
        if (digitosEtiqueta.includes(terminoDigitos) || digitosExtra.includes(terminoDigitos)) {
          return true;
        }
      }

      return false;
    });
  }, [conBuscador, terminoBusqueda, opcionesNormalizadas]);

  // Reiniciar búsqueda y dar foco al input al abrir el desplegable
  useEffect(() => {
    if (estaAbierto) {
      setTerminoBusqueda('');
      if (conBuscador) {
        const temporizador = setTimeout(() => {
          referenciaInputBusqueda.current?.focus();
        }, 50);
        return () => clearTimeout(temporizador);
      }
    }
  }, [estaAbierto, conBuscador]);

  // Reiniciar scroll de la lista al cambiar el término de búsqueda
  useEffect(() => {
    if (referenciaLista.current) {
      referenciaLista.current.scrollTop = 0;
    }
  }, [terminoBusqueda]);

  // Comprobar si el término buscado ya coincide exactamente con alguna opción
  const existeExacto = useMemo(() => {
    if (!terminoBusqueda.trim()) return false;
    const busq = terminoBusqueda.trim().toLowerCase();
    return opcionesNormalizadas.some(
      (opc) => opc.etiqueta.trim().toLowerCase() === busq || String(opc.valor).trim().toLowerCase() === busq
    );
  }, [terminoBusqueda, opcionesNormalizadas]);

  const manejarCrearNuevo = async (nombreParaCrear: string) => {
    const nombreLimpio = nombreParaCrear.trim();
    if (!nombreLimpio || !alCrearNuevo || guardandoNuevo) return;
    try {
      setGuardandoNuevo(true);
      await alCrearNuevo(nombreLimpio);
      setTerminoBusqueda('');
      setMostrarInputCrear(false);
      setValorInputCrear('');
      setEstaAbierto(false);
    } catch (err) {
      console.error('Error al crear nueva opción:', err);
    } finally {
      setGuardandoNuevo(false);
    }
  };

  useEffect(() => {
    if (mostrarInputCrear) {
      const temporizador = setTimeout(() => {
        referenciaInputNuevo.current?.focus();
      }, 50);
      return () => clearTimeout(temporizador);
    }
  }, [mostrarInputCrear]);

  // Obtener la opción actualmente seleccionada
  const opcionSeleccionada =
    opcionesNormalizadas.find((opc) => String(opc.valor) === String(valor) && String(valor) !== '') || null;

  // Calcular la posición flotante fija para sobresalir sobre modales y contenedores
  const actualizarPosicion = () => {
    if (!referenciaContenedor.current) return;
    const rect = referenciaContenedor.current.getBoundingClientRect();

    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setEstaAbierto(false);
      return;
    }

    const anchoBoton = rect.width;
    const anchoMenuCalculado =
      tamano === 'compacto'
        ? Math.max(anchoBoton, conBuscador ? 240 : 165)
        : Math.max(anchoBoton, conBuscador ? 260 : 220);

    const nuevosEstilos: React.CSSProperties = {
      position: 'fixed',
      width: 'max-content',
      minWidth: `${anchoMenuCalculado}px`,
      maxWidth: 'min(92vw, 440px)',
      zIndex: 1000000,
    };

    // Auto-flip inteligente: detectar si no cabe hacia abajo y hay más espacio hacia arriba
    const alturaBuscador = conBuscador ? 48 : 0;
    const alturaEstimadaMenu = Math.min(320, opcionesNormalizadas.length * 38 + 16 + alturaBuscador);
    const espacioAbajo = window.innerHeight - rect.bottom - 10;
    const espacioArriba = rect.top - 10;

    let direccionEfectiva = direccion;
    if (direccion === 'abajo' && espacioAbajo < alturaEstimadaMenu && espacioArriba > espacioAbajo) {
      direccionEfectiva = 'arriba';
    } else if (direccion === 'arriba' && espacioArriba < alturaEstimadaMenu && espacioAbajo > espacioArriba) {
      direccionEfectiva = 'abajo';
    }

    const espacioDisponible = direccionEfectiva === 'arriba' ? espacioArriba : espacioAbajo;
    nuevosEstilos.maxHeight = `${Math.min(320, Math.max(140, espacioDisponible))}px`;

    if (direccionEfectiva === 'arriba') {
      nuevosEstilos.bottom = `${Math.max(8, window.innerHeight - rect.top + 6)}px`;
      nuevosEstilos.top = 'auto';
    } else {
      nuevosEstilos.top = `${rect.bottom + 6}px`;
      nuevosEstilos.bottom = 'auto';
    }

    if (posicionAlineacion === 'derecha') {
      nuevosEstilos.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
      nuevosEstilos.left = 'auto';
    } else {
      if (rect.left + anchoMenuCalculado > window.innerWidth - 12) {
        nuevosEstilos.right = '12px';
        nuevosEstilos.left = 'auto';
      } else {
        nuevosEstilos.left = `${Math.max(8, rect.left)}px`;
        nuevosEstilos.right = 'auto';
      }
    }

    setEstiloPosicion(nuevosEstilos);
  };

  useEffect(() => {
    if (!estaAbierto) return;

    actualizarPosicion();

    const manejarScrollOResize = () => {
      actualizarPosicion();
    };

    window.addEventListener('resize', manejarScrollOResize);
    window.addEventListener('scroll', manejarScrollOResize, true);

    return () => {
      window.removeEventListener('resize', manejarScrollOResize);
      window.removeEventListener('scroll', manejarScrollOResize, true);
    };
  }, [estaAbierto, direccion, posicionAlineacion, conBuscador]);

  // Refinar posición una vez montado el menú en el portal para garantizar que nunca se corte
  useEffect(() => {
    if (!estaAbierto || !referenciaMenu.current || !referenciaContenedor.current) return;
    const rectMenu = referenciaMenu.current.getBoundingClientRect();
    const rectBoton = referenciaContenedor.current.getBoundingClientRect();
    const espacioAbajo = window.innerHeight - rectBoton.bottom - 10;
    const espacioArriba = rectBoton.top - 10;

    if (rectMenu.bottom > window.innerHeight - 8 && espacioArriba > espacioAbajo) {
      setEstiloPosicion((prev) => ({
        ...prev,
        top: 'auto',
        bottom: `${Math.max(8, window.innerHeight - rectBoton.top + 6)}px`,
        maxHeight: `${Math.min(320, Math.max(140, espacioArriba))}px`,
      }));
    }
  }, [estaAbierto]);

  // Cerrar al hacer clic fuera o presionar Escape
  useEffect(() => {
    function manejarClicFuera(evento: MouseEvent) {
      const objetivo = evento.target as Node;
      const clicEnContenedor = referenciaContenedor.current && referenciaContenedor.current.contains(objetivo);
      const clicEnMenu = referenciaMenu.current && referenciaMenu.current.contains(objetivo);

      if (!clicEnContenedor && !clicEnMenu) {
        setEstaAbierto(false);
      }
    }

    function manejarTeclaEscape(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        setEstaAbierto(false);
      }
    }

    if (estaAbierto) {
      document.addEventListener('mousedown', manejarClicFuera);
      document.addEventListener('keydown', manejarTeclaEscape);
    }

    return () => {
      document.removeEventListener('mousedown', manejarClicFuera);
      document.removeEventListener('keydown', manejarTeclaEscape);
    };
  }, [estaAbierto]);

  const alternarDesplegable = () => {
    if (!deshabilitado) {
      setEstaAbierto((prev) => !prev);
    }
  };

  const seleccionarOpcion = (nuevaOpcion: OpcionDesplegable) => {
    alCambiar(String(nuevaOpcion.valor));
    setEstaAbierto(false);
  };

  return (
    <div
      className={`selector-desplegable-contenedor ${estaAbierto ? 'abierto' : ''} ${tamano === 'compacto' ? 'compacto' : ''} ${className} ${deshabilitado ? 'deshabilitado' : ''}`}
      ref={referenciaContenedor}
      style={{
        minWidth: anchoMinimo,
        width: anchoMinimo === '100%' ? '100%' : undefined,
        display: anchoMinimo === '100%' ? 'block' : 'inline-block',
        ...style,
      }}
    >
      <button
        type="button"
        className={`selector-desplegable-boton ${estaAbierto ? 'activo' : ''}`}
        onClick={alternarDesplegable}
        disabled={deshabilitado}
        aria-haspopup="listbox"
        aria-expanded={estaAbierto}
        style={estiloBoton}
      >
        <div className="selector-desplegable-valor-actual">
          {opcionSeleccionada?.icono ? (
            <opcionSeleccionada.icono size={15} className="selector-icono-opcion" />
          ) : IconoGeneral ? (
            <IconoGeneral size={15} className="selector-icono-general" />
          ) : null}

          {opcionSeleccionada?.colorIndicador && (
            <span
              className="selector-punto-indicador"
              style={{ backgroundColor: opcionSeleccionada.colorIndicador }}
            />
          )}

          <span className={`selector-texto-etiqueta ${!opcionSeleccionada ? 'es-placeholder' : ''}`}>
            {opcionSeleccionada ? (opcionSeleccionada.etiquetaCorta || opcionSeleccionada.etiqueta) : placeholder}
          </span>
        </div>

        <ChevronDown
          size={16}
          className={`selector-flecha-chevron ${estaAbierto ? 'rotada' : ''}`}
        />
      </button>

      {estaAbierto &&
        montado &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={referenciaMenu}
            className={`selector-desplegable-menu ${posicionAlineacion === 'derecha' ? 'alineacion-derecha' : ''}`}
            style={estiloPosicion}
            role="listbox"
          >
            {/* Buscador Sutil Integrado */}
            {conBuscador && (
              <div className="selector-desplegable-buscador-caja">
                <Search size={14} className="selector-desplegable-buscador-icono" />
                <input
                  ref={referenciaInputBusqueda}
                  type="text"
                  className="selector-desplegable-buscador-input"
                  value={terminoBusqueda}
                  onChange={(e) => setTerminoBusqueda(e.target.value)}
                  placeholder={placeholderBuscador}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Escape') {
                      setEstaAbierto(false);
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (alCrearNuevo && terminoBusqueda.trim() && !existeExacto) {
                        manejarCrearNuevo(terminoBusqueda);
                      } else if (opcionesFiltradas.length === 1) {
                        seleccionarOpcion(opcionesFiltradas[0]);
                      }
                    }
                  }}
                />
                {terminoBusqueda && (
                  <button
                    type="button"
                    className="selector-desplegable-buscador-limpiar"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTerminoBusqueda('');
                      referenciaInputBusqueda.current?.focus();
                    }}
                    aria-label="Borrar búsqueda"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            {/* Listado Scrolleable de Opciones Filtradas */}
            <div ref={referenciaLista} className="selector-desplegable-lista">
              {/* Botón directo si el usuario busca algo que no existe y puede crearlo */}
              {conBuscador && Boolean(alCrearNuevo || permitirCrearNuevo) && terminoBusqueda.trim() && !existeExacto && (
                <button
                  type="button"
                  className="selector-desplegable-opcion-crear"
                  onClick={(e) => {
                    e.stopPropagation();
                    manejarCrearNuevo(terminoBusqueda);
                  }}
                  disabled={guardandoNuevo}
                >
                  <div className="selector-opcion-contenido-izq">
                    <Plus size={14} className="selector-icono-crear" />
                    <span className="selector-opcion-texto">
                      {guardandoNuevo ? 'Guardando nuevo tipo...' : (
                        <>
                          Crear &ldquo;<strong>{terminoBusqueda.trim()}</strong>&rdquo;
                        </>
                      )}
                    </span>
                  </div>
                  <span className="selector-opcion-badge selector-badge-crear">Nuevo</span>
                </button>
              )}

              {opcionesFiltradas.length === 0 ? (
                Boolean(alCrearNuevo || permitirCrearNuevo) && terminoBusqueda.trim() ? (
                  <div className="selector-desplegable-sin-resultados-crear">
                    <span className="selector-sin-resultados-texto">
                      No se encontró &ldquo;{terminoBusqueda.trim()}&rdquo;
                    </span>
                    <button
                      type="button"
                      className="selector-desplegable-btn-crear-accion"
                      onClick={(e) => {
                        e.stopPropagation();
                        manejarCrearNuevo(terminoBusqueda);
                      }}
                      disabled={guardandoNuevo}
                    >
                      <Plus size={13} />
                      <span>{guardandoNuevo ? 'Guardando...' : `Agregar "${terminoBusqueda.trim()}"`}</span>
                    </button>
                  </div>
                ) : (
                  <div className="selector-desplegable-sin-resultados">
                    No se encontraron resultados
                  </div>
                )
              ) : (
                opcionesFiltradas.map((opcion) => {
                  const esSeleccionada = String(opcion.valor) === String(valor) && String(valor) !== '';

                  return (
                    <button
                      key={String(opcion.valor)}
                      type="button"
                      className={`selector-desplegable-opcion ${esSeleccionada ? 'seleccionada' : ''}`}
                      onClick={() => seleccionarOpcion(opcion)}
                      role="option"
                      aria-selected={esSeleccionada}
                    >
                      <div className="selector-opcion-contenido-izq">
                        {opcion.colorIndicador && (
                          <span
                            className="selector-punto-indicador"
                            style={{ backgroundColor: opcion.colorIndicador }}
                          />
                        )}

                        {opcion.icono && (
                          <opcion.icono size={15} className="selector-icono-opcion" />
                        )}

                        <span className="selector-opcion-texto">
                          {opcion.etiqueta}
                        </span>
                      </div>

                      <div className="selector-opcion-contenido-der">
                        {opcion.badge && (
                          <span className={`selector-opcion-badge ${opcion.claseBadge || ''}`}>
                            {opcion.badge}
                          </span>
                        )}

                        {alEditarOpcion && (
                          <EtiquetaTooltip texto="Editar nombre" posicion="arriba">
                            <span
                              role="button"
                              tabIndex={0}
                              className="selector-btn-editar-opcion"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                alEditarOpcion(opcion, e);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  alEditarOpcion(opcion, e as any);
                                }
                              }}
                            >
                              <Edit3 size={12} />
                            </span>
                          </EtiquetaTooltip>
                        )}

                        {esSeleccionada && (
                          <Check size={15} className="selector-icono-check" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Pie de acción fija para agregar nuevo elemento sin saturar la pantalla */}
            {Boolean(alCrearNuevo || permitirCrearNuevo) && (
              <div className="selector-desplegable-pie-crear" onClick={(e) => e.stopPropagation()}>
                {mostrarInputCrear ? (
                  <div className="selector-desplegable-caja-crear-rapido">
                    <input
                      ref={referenciaInputNuevo}
                      type="text"
                      className="selector-desplegable-input-crear"
                      placeholder="Nombre del nuevo tipo..."
                      value={valorInputCrear}
                      onChange={(e) => setValorInputCrear(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          manejarCrearNuevo(valorInputCrear);
                        } else if (e.key === 'Escape') {
                          setMostrarInputCrear(false);
                        }
                      }}
                    />
                    <EtiquetaTooltip texto="Guardar nuevo" posicion="arriba">
                      <button
                        type="button"
                        className="selector-btn-confirmar-crear"
                        disabled={guardandoNuevo || !valorInputCrear.trim()}
                        onClick={() => manejarCrearNuevo(valorInputCrear)}
                        aria-label="Guardar nuevo"
                      >
                        {guardandoNuevo ? '...' : <Check size={14} />}
                      </button>
                    </EtiquetaTooltip>
                    <EtiquetaTooltip texto="Cancelar" posicion="arriba">
                      <button
                        type="button"
                        className="selector-btn-cancelar-crear"
                        disabled={guardandoNuevo}
                        onClick={() => {
                          setMostrarInputCrear(false);
                          setValorInputCrear('');
                        }}
                        aria-label="Cancelar"
                      >
                        <X size={14} />
                      </button>
                    </EtiquetaTooltip>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="selector-desplegable-btn-abrir-crear"
                    onClick={() => {
                      if (terminoBusqueda.trim() && !existeExacto) {
                        manejarCrearNuevo(terminoBusqueda);
                      } else {
                        setMostrarInputCrear(true);
                      }
                    }}
                  >
                    <Plus size={13} />
                    <span>{textoCrearNuevo || '+ Agregar nuevo tipo...'}</span>
                  </button>
                )}
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
