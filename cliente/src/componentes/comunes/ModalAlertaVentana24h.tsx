'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Clock,
  X,
  AlertTriangle,
  Send,
  CheckCircle2,
  Image as IconoImagen,
  FileText,
  Sparkles,
  ExternalLink,
  Phone,
  MessageCircle,
  Loader2,
} from 'lucide-react';
import { SelectorDesplegable, type OpcionDesplegable } from './SelectorDesplegable';
import { obtenerPlantillasYCuota } from '@/servicios/api_crm';
import type { PlantillaWhatsApp, BotonPlantilla } from '@/tipos/crm';

interface PropiedadesModalAlertaVentana24h {
  abierto: boolean;
  alCerrar: () => void;
  titulo?: string;
  subtitulo?: string;
  mensaje?: string;
  nombrePaciente?: string;
  alReactivarPlantilla?: (nombrePlantilla?: string, idiomaPlantilla?: string) => void;
  accionTexto?: string;
  plantillasDisponibles?: PlantillaWhatsApp[];
}

export const ModalAlertaVentana24h: React.FC<PropiedadesModalAlertaVentana24h> = ({
  abierto,
  alCerrar,
  titulo = 'Ventana de 24 Horas Cerrada en WhatsApp',
  subtitulo = 'Políticas Oficiales de Meta Cloud API',
  mensaje,
  nombrePaciente,
  alReactivarPlantilla,
  accionTexto = 'Reactivar Chat con Plantilla',
  plantillasDisponibles,
}) => {
  const [montado, setMontado] = useState(false);
  const [cargandoPlantillas, setCargandoPlantillas] = useState(false);
  const [plantillas, setPlantillas] = useState<PlantillaWhatsApp[]>([]);
  const [plantillaSeleccionadaId, setPlantillaSeleccionadaId] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  // Cargar plantillas aprobadas al abrir el modal
  useEffect(() => {
    if (!abierto) return;

    if (plantillasDisponibles && plantillasDisponibles.length > 0) {
      const aprobadas = plantillasDisponibles.filter(
        (p) => p.estado === 'APPROVED' || p.estado === 'APROBADA'
      );
      setPlantillas(aprobadas);
      if (aprobadas.length > 0) {
        const preferida = aprobadas.find((p) => p.nombre === 'optica_digital') || aprobadas[0];
        setPlantillaSeleccionadaId(preferida.id);
      }
      return;
    }

    let cancelado = false;
    setCargandoPlantillas(true);

    obtenerPlantillasYCuota()
      .then((res) => {
        if (cancelado) return;
        setCargandoPlantillas(false);
        if (res.exito && res.plantillas) {
          const aprobadas = res.plantillas.filter(
            (p) => p.estado === 'APPROVED' || p.estado === 'APROBADA'
          );
          setPlantillas(aprobadas);
          if (aprobadas.length > 0) {
            const preferida = aprobadas.find((p) => p.nombre === 'optica_digital') || aprobadas[0];
            setPlantillaSeleccionadaId(preferida.id);
          }
        }
      })
      .catch((err) => {
        if (cancelado) return;
        setCargandoPlantillas(false);
        console.error('Error al cargar plantillas para modal 24h:', err);
      });

    return () => {
      cancelado = true;
    };
  }, [abierto, plantillasDisponibles]);

  // Manejar tecla escape
  useEffect(() => {
    const manejarEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && abierto && !enviando) {
        alCerrar();
      }
    };
    window.addEventListener('keydown', manejarEscape);
    return () => window.removeEventListener('keydown', manejarEscape);
  }, [abierto, alCerrar, enviando]);

  // Plantilla activa seleccionada
  const plantillaActiva = useMemo(() => {
    if (!plantillaSeleccionadaId) return plantillas[0] || null;
    return plantillas.find((p) => p.id === plantillaSeleccionadaId) || plantillas[0] || null;
  }, [plantillas, plantillaSeleccionadaId]);

  // Extraer botones parseados de la plantilla
  const botonesPlantilla: BotonPlantilla[] = useMemo(() => {
    if (!plantillaActiva) return [];
    if (Array.isArray(plantillaActiva.botones) && plantillaActiva.botones.length > 0) {
      return plantillaActiva.botones;
    }
    if (typeof plantillaActiva.botones_json === 'string') {
      try {
        const arr = JSON.parse(plantillaActiva.botones_json);
        if (Array.isArray(arr)) return arr;
      } catch {}
    } else if (Array.isArray(plantillaActiva.botones_json)) {
      return plantillaActiva.botones_json;
    }
    return [];
  }, [plantillaActiva]);

  // Opciones para el selector desplegable (limpio, sin códigos técnicos de idioma)
  const opcionesSelector: OpcionDesplegable[] = useMemo(() => {
    return plantillas.map((p) => ({
      valor: String(p.id),
      etiqueta: p.etiqueta || p.nombre,
      textoBusquedaExtra: `${p.nombre} ${p.categoria || ''}`,
    }));
  }, [plantillas]);

  // Formatear texto con reemplazo de variable {{1}} si existe
  const textoCuerpoPrevia = useMemo(() => {
    if (!plantillaActiva?.cuerpo) return '';
    let txt = plantillaActiva.cuerpo;
    if (nombrePaciente) {
      txt = txt.replace(/\{\{1\}\}/g, nombrePaciente);
    }
    return txt;
  }, [plantillaActiva, nombrePaciente]);

  const ejecutarReactivacion = async () => {
    if (!alReactivarPlantilla || enviando) return;
    setEnviando(true);
    try {
      if (plantillaActiva) {
        alReactivarPlantilla(plantillaActiva.nombre, plantillaActiva.idioma);
      } else {
        alReactivarPlantilla();
      }
      alCerrar();
    } catch (e) {
      console.error(e);
    } finally {
      setEnviando(false);
    }
  };

  if (!abierto || !montado) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={() => {
        if (!enviando) alCerrar();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: '92vh',
          background: 'var(--fondo-tarjeta, #ffffff)',
          color: 'var(--texto-principal, #0f172a)',
          borderRadius: '16px',
          border: '1px solid var(--borde-tarjeta, rgba(226, 232, 240, 0.8))',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.38)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'scaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Cabecera del Modal */}
        <div
          style={{
            padding: '1.15rem 1.4rem 0.95rem 1.4rem',
            borderBottom: '1px solid var(--borde-tarjeta, #e2e8f0)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
            background: 'var(--fondo-tarjeta, #ffffff)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(217, 119, 6, 0.28) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Clock style={{ width: '22px', height: '22px', color: '#d97706' }} />
            </div>
            <div>
              <span
                style={{
                  fontSize: '0.67rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#b45309',
                  background: 'rgba(245, 158, 11, 0.12)',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  display: 'inline-block',
                  marginBottom: '3px',
                }}
              >
                {subtitulo}
              </span>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.02rem',
                  fontWeight: 700,
                  color: 'var(--texto-principal, #0f172a)',
                  lineHeight: 1.3,
                }}
              >
                {titulo}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            disabled={enviando}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: enviando ? 'not-allowed' : 'pointer',
              color: 'var(--texto-atenuado, #64748b)',
              padding: '4px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Cerrar modal"
          >
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        {/* Cuerpo del Modal con Scroll Suave */}
        <div
          style={{
            padding: '1.15rem 1.4rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.9rem',
          }}
        >
          {/* Mensaje Informativo Contextual */}
          <div
            style={{
              fontSize: '0.82rem',
              color: 'var(--texto-secundario, #334155)',
              lineHeight: 1.5,
            }}
          >
            {mensaje || (
              <>
                No es posible enviar este mensaje directamente por WhatsApp a{' '}
                <strong>{nombrePaciente || 'este paciente'}</strong> debido a que han transcurrido más de{' '}
                <strong>24 horas</strong> desde su última respuesta o mensaje entrante.
              </>
            )}
          </div>

          {/* Tarjeta de Advertencia Oficial de Meta */}
          <div
            style={{
              background: 'var(--fondo-elevado, #f8fafc)',
              border: '1px solid var(--borde-tarjeta, #e2e8f0)',
              borderRadius: '10px',
              padding: '0.75rem 0.95rem',
              fontSize: '0.76rem',
              color: 'var(--texto-secundario, #475569)',
              lineHeight: 1.45,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#b45309' }}>
              <AlertTriangle style={{ width: '14px', height: '14px' }} />
              <span>Regla de Atención al Cliente de Meta</span>
            </div>
            <div>
              WhatsApp prohíbe el envío de texto libre fuera de la ventana de 24 horas. Para reanudar el contacto clínico, debes enviar una plantilla preaprobada; al recibir respuesta del paciente, la ventana se reabrirá automáticamente.
            </div>
          </div>

          {/* Sección de Selección de Plantilla Oficial */}
          <div
            style={{
              background: 'rgba(2, 132, 199, 0.04)',
              border: '1px solid rgba(2, 132, 199, 0.22)',
              borderRadius: '12px',
              padding: '0.95rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles style={{ width: '15px', height: '15px', color: 'var(--color-primario, #0284c7)' }} />
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: 'var(--texto-principal, #0f172a)',
                  }}
                >
                  Selecciona la plantilla para reactivar
                </span>
              </div>
              {cargandoPlantillas && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#0284c7' }}>
                  <Loader2 style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} />
                  <span>Cargando plantillas...</span>
                </div>
              )}
            </div>

            {/* Selector Desplegable de Plantillas Aprobadas */}
            {plantillas.length > 0 ? (
              <div style={{ width: '100%' }}>
                <SelectorDesplegable
                  valor={plantillaActiva ? String(plantillaActiva.id) : ''}
                  alCambiar={(nuevoId) => setPlantillaSeleccionadaId(Number(nuevoId))}
                  opciones={opcionesSelector}
                  placeholder="Escoge la plantilla preaprobada..."
                  icono={MessageCircle}
                  conBuscador={plantillas.length > 4}
                  placeholderBuscador="Buscar por nombre o etiqueta..."
                  tamano="normal"
                  anchoMinimo="100%"
                />
              </div>
            ) : cargandoPlantillas ? (
              <div
                style={{
                  padding: '0.75rem',
                  textAlign: 'center',
                  fontSize: '0.78rem',
                  color: 'var(--texto-atenuado, #64748b)',
                }}
              >
                Consultando plantillas aprobadas en Meta Cloud...
              </div>
            ) : (
              <div
                style={{
                  padding: '0.75rem',
                  textAlign: 'center',
                  fontSize: '0.78rem',
                  color: '#b45309',
                  background: 'rgba(245, 158, 11, 0.1)',
                  borderRadius: '8px',
                }}
              >
                No se encontraron plantillas aprobadas en la óptica. Sincroniza plantillas desde el módulo de Campañas.
              </div>
            )}

            {/* Vista Previa de la Plantilla Seleccionada (Burbuja Estilo WhatsApp) */}
            {plantillaActiva && (
              <div
                style={{
                  marginTop: '0.2rem',
                  background: 'var(--fondo-tarjeta, #ffffff)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: '10px',
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.55rem',
                  boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.05)',
                }}
              >
                {/* Meta Header / Badges */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    borderBottom: '1px solid var(--borde-tarjeta, #e2e8f0)',
                    paddingBottom: '0.45rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: '#059669',
                        background: 'rgba(16, 185, 129, 0.12)',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                      }}
                    >
                      <CheckCircle2 style={{ width: '10px', height: '10px' }} />
                      Aprobada
                    </span>
                    {plantillaActiva.categoria && (
                      <span
                        style={{
                          fontSize: '0.66rem',
                          fontWeight: 600,
                          color: 'var(--texto-atenuado, #64748b)',
                          background: 'var(--fondo-elevado, #f1f5f9)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {plantillaActiva.categoria === 'UTILITY'
                          ? 'Utilidad'
                          : plantillaActiva.categoria === 'MARKETING'
                          ? 'Promocional'
                          : plantillaActiva.categoria}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontFamily: 'monospace',
                      color: 'var(--texto-atenuado, #64748b)',
                    }}
                  >
                    {plantillaActiva.nombre}
                  </span>
                </div>

                {/* Encabezado Multimedia / Texto si aplica */}
                {plantillaActiva.encabezado_tipo === 'IMAGEN' && (
                  <div
                    style={{
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: 'rgba(0, 0, 0, 0.04)',
                      border: '1px solid rgba(0, 0, 0, 0.08)',
                      maxHeight: '120px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {plantillaActiva.encabezado_contenido ? (
                      <img
                        src={plantillaActiva.encabezado_contenido}
                        alt="Encabezado de plantilla"
                        style={{ width: '100%', maxHeight: '120px', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          padding: '1rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: 'var(--texto-atenuado, #64748b)',
                          fontSize: '0.74rem',
                        }}
                      >
                        <IconoImagen style={{ width: '16px', height: '16px' }} />
                        <span>Encabezado con Imagen Multimedia</span>
                      </div>
                    )}
                  </div>
                )}

                {plantillaActiva.encabezado_tipo === 'TEXTO' && plantillaActiva.encabezado_contenido && (
                  <div
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: 'var(--texto-principal, #0f172a)',
                    }}
                  >
                    {plantillaActiva.encabezado_contenido}
                  </div>
                )}

                {/* Cuerpo del Mensaje */}
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--texto-secundario, #1e293b)',
                    lineHeight: 1.45,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {textoCuerpoPrevia}
                </div>

                {/* Pie de Página */}
                {plantillaActiva.pie && (
                  <div
                    style={{
                      fontSize: '0.68rem',
                      color: 'var(--texto-atenuado, #64748b)',
                      fontStyle: 'italic',
                    }}
                  >
                    {plantillaActiva.pie}
                  </div>
                )}

                {/* Botones de la Plantilla */}
                {botonesPlantilla.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      borderTop: '1px solid var(--borde-tarjeta, #e2e8f0)',
                      paddingTop: '0.45rem',
                      marginTop: '0.2rem',
                    }}
                  >
                    {botonesPlantilla.map((btn, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(2, 132, 199, 0.08)',
                          color: 'var(--color-primario, #0284c7)',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          padding: '5px 8px',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        {btn.tipo === 'URL' ? (
                          <ExternalLink style={{ width: '12px', height: '12px' }} />
                        ) : btn.tipo === 'PHONE_NUMBER' ? (
                          <Phone style={{ width: '12px', height: '12px' }} />
                        ) : (
                          <MessageCircle style={{ width: '12px', height: '12px' }} />
                        )}
                        <span>{btn.texto}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Pie de Acciones */}
        <div
          style={{
            padding: '0.9rem 1.4rem',
            background: 'var(--fondo-elevado, #f8fafc)',
            borderTop: '1px solid var(--borde-tarjeta, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.65rem',
          }}
        >
          <button
            type="button"
            onClick={alCerrar}
            disabled={enviando}
            className="modal-btn-cancelar"
            style={{ padding: '0.48rem 1rem', fontSize: '0.8rem' }}
          >
            Cancelar
          </button>

          {alReactivarPlantilla && (
            <button
              type="button"
              onClick={ejecutarReactivacion}
              disabled={enviando || (!plantillaActiva && plantillas.length > 0)}
              className="btn-primario-optica"
              style={{
                padding: '0.48rem 1.15rem',
                fontSize: '0.8rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                opacity: enviando || (!plantillaActiva && plantillas.length > 0) ? 0.65 : 1,
                cursor: enviando || (!plantillaActiva && plantillas.length > 0) ? 'not-allowed' : 'pointer',
              }}
            >
              {enviando ? (
                <>
                  <Loader2 style={{ width: '13px', height: '13px', animation: 'spin 1s linear infinite' }} />
                  <span>Enviando plantilla...</span>
                </>
              ) : (
                <>
                  <Send style={{ width: '13px', height: '13px' }} />
                  <span>{accionTexto}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
