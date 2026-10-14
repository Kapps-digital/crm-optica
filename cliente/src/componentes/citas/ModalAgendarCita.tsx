'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, CalendarPlus, CalendarCheck, MessageSquare, Clock, UserCheck, AlertTriangle } from 'lucide-react';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';
import { SelectorDesplegable } from '../comunes/SelectorDesplegable';
import { SelectorFecha } from '../comunes/SelectorFecha';
import { SelectorHoraPopover } from '../comunes/SelectorHoraPopover';
import type { Contacto, Conversacion } from '@/tipos/crm';
import { obtenerOpticaSesion } from '@/servicios/api_crm';
import { formatearTelefono, obtenerNombrePaciente, estaEnVentana24Horas } from '@/utilidades/formato';

export const OPCIONES_MOTIVO_CITA = [
  'Examen Visual y Control Anual',
  'Primera Vez - Examen Computarizado',
  'Adaptación de Lentes de Contacto',
  'Control de Miopía y Astigmatismo',
  'Revisión de Montura y Graduación',
  'Molestia Ocular / Urgencia Visual',
];

export interface DatosNuevaCita {
  contacto_id: number;
  fecha_cita: string;
  hora_cita: string;
  motivo: string;
  especialista?: string;
  observaciones?: string;
  enviar_confirmacion_whatsapp?: boolean;
}

interface PropiedadesModalAgendarCita {
  abierto: boolean;
  contacto: Contacto | null;
  contactosDisponibles?: Contacto[];
  conversaciones?: Conversacion[];
  fechaPreseleccionada?: string;
  alCerrar: () => void;
  alGuardarCita: (datos: DatosNuevaCita) => Promise<{ exito: boolean; error?: string } | void>;
}

export const ModalAgendarCita: React.FC<PropiedadesModalAgendarCita> = ({
  abierto,
  contacto,
  contactosDisponibles = [],
  conversaciones = [],
  fechaPreseleccionada,
  alCerrar,
  alGuardarCita,
}) => {
  const [montado, setMontado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [pacienteIdManual, setPacienteIdManual] = useState<number | null>(null);

  // Filtrar exclusivamente pacientes clínicos ya agregados en la óptica (excluir contactos simples de chat)
  const pacientesDeLaOptica = useMemo(() => {
    return (contactosDisponibles || [])
      .filter((c) => {
        const formulas = Number(c.total_formulas || 0);
        const citas = Number(c.total_citas || 0);
        const tieneDoc = Boolean((c.cedula && c.cedula.trim() !== '') || (c.documento && c.documento.trim() !== ''));
        return Boolean(c.es_paciente) || tieneDoc || formulas > 0 || citas > 0;
      })
      .sort((a, b) => {
        const nombreA = (a.nombre || a.nombre_completo || '').trim();
        const nombreB = (b.nombre || b.nombre_completo || '').trim();
        return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' });
      });
  }, [contactosDisponibles]);

  // Paciente asignado directamente o seleccionado de la lista de pacientes clínicos
  const pacienteEfectivo =
    contacto ||
    pacientesDeLaOptica.find((c) => String(c.id) === String(pacienteIdManual)) ||
    null;

  // Conversación asociada al paciente seleccionado
  const conversacionPaciente = useMemo(() => {
    if (!pacienteEfectivo?.id) return null;
    return (conversaciones || []).find((c) => Number(c.contacto_id) === Number(pacienteEfectivo.id)) || null;
  }, [conversaciones, pacienteEfectivo?.id]);

  // Si no hay conversación o no ha enviado mensajes en 24h, la ventana oficial de Meta está cerrada
  const ventana24hActiva = useMemo(() => {
    if (!conversacionPaciente) return false;
    return estaEnVentana24Horas(conversacionPaciente.ultimo_mensaje_entrante_en);
  }, [conversacionPaciente]);

  // Fecha predeterminada de mañana
  const obtenerFechaManana = () => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    return manana.toISOString().split('T')[0];
  };

  // Estados del formulario (inician en blanco por defecto)
  const [fechaCita, setFechaCita] = useState('');
  const [horaCita, setHoraCita] = useState('');
  const [motivo, setMotivo] = useState('');
  const [especialista, setEspecialista] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [enviarWhatsapp, setEnviarWhatsapp] = useState(false);
  const [advertenciaVentana24h, setAdvertenciaVentana24h] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  // Reiniciar estado limpio cada vez que se abre el modal o cambia el paciente
  useEffect(() => {
    if (abierto) {
      const optSesion = obtenerOpticaSesion();
      setFechaCita(fechaPreseleccionada || '');
      setHoraCita('');
      const motivoDefecto = (optSesion?.motivo_cita_defecto || '').trim();
      setMotivo(OPCIONES_MOTIVO_CITA.includes(motivoDefecto) ? motivoDefecto : '');
      setEspecialista(optSesion?.especialista_defecto || '');
      setObservaciones('');

      // Regla de Meta: Si la ventana de 24h está activa, mantener chulo según preferencia;
      // Si la ventana expiró (o no hay chat activo), desactivar chulo por defecto.
      if (ventana24hActiva) {
        setEnviarWhatsapp(optSesion?.notificacion_auto_citas_whatsapp !== false);
      } else {
        setEnviarWhatsapp(false);
      }
      setAdvertenciaVentana24h(false);

      setErrorValidacion(null);
      setPacienteIdManual(contacto?.id ? Number(contacto.id) : null);
    }
  }, [abierto, contacto?.id, fechaPreseleccionada, ventana24hActiva]);

  // Si cambia el paciente seleccionado y no tiene ventana activa, desmarcar el envío automático
  useEffect(() => {
    if (!ventana24hActiva) {
      setEnviarWhatsapp(false);
    }
  }, [ventana24hActiva]);

  const manejarCambioWhatsapp = (deseaActivar: boolean) => {
    if (deseaActivar && !ventana24hActiva) {
      // Bloquear activación y mostrar advertencia corporativa clara
      setEnviarWhatsapp(false);
      setAdvertenciaVentana24h(true);
      return;
    }
    setEnviarWhatsapp(deseaActivar);
    if (deseaActivar) {
      setAdvertenciaVentana24h(false);
    }
  };

  const manejarCierre = () => {
    setFechaCita('');
    setHoraCita('');
    setMotivo('');
    setEspecialista('');
    setObservaciones('');
    setErrorValidacion(null);
    setPacienteIdManual(null);
    alCerrar();
  };

  // Cerrar con tecla Escape
  useEffect(() => {
    const alPresionarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && abierto) {
        manejarCierre();
      }
    };
    window.addEventListener('keydown', alPresionarTecla);
    return () => window.removeEventListener('keydown', alPresionarTecla);
  }, [abierto]);

  if (!abierto || !montado) return null;

  // Horarios de sugerencia rápida (chips clicables para máxima comodidad)
  const sugerenciasHoras = [
    '08:00 AM',
    '09:30 AM',
    '11:00 AM',
    '02:30 PM',
    '04:00 PM',
    '05:30 PM',
  ];

  // Validación: Paciente, fecha, hora y motivo son estrictamente obligatorios. Especialista y observaciones son opcionales.
  const formularioCompleto =
    !!pacienteEfectivo &&
    fechaCita.trim() !== '' &&
    horaCita.trim() !== '' &&
    motivo.trim() !== '' &&
    OPCIONES_MOTIVO_CITA.includes(motivo.trim());

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formularioCompleto || !pacienteEfectivo) return;

    setCargando(true);
    setErrorValidacion(null);
    try {
      const resultado = await alGuardarCita({
        contacto_id: Number(pacienteEfectivo.id),
        fecha_cita: fechaCita,
        hora_cita: horaCita.trim(),
        motivo: motivo.trim(),
        especialista: especialista.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
        enviar_confirmacion_whatsapp: enviarWhatsapp,
      });

      if (resultado && resultado.exito === false) {
        setErrorValidacion(resultado.error || 'Este paciente para ese día a esa hora ya tiene una cita asignada.');
        return;
      }

      manejarCierre();
    } catch (error: any) {
      console.error('Error al agendar cita:', error);
      setErrorValidacion(error?.message || 'Error al agendar la cita');
    } finally {
      setCargando(false);
    }
  };

  const fechaHoyString = new Date().toISOString().split('T')[0];

  const contenidoModal = (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) manejarCierre();
      }}
    >
      <div className="modal-tarjeta-clinica" style={{ maxWidth: '490px' }} role="dialog" aria-modal="true">
        {/* Cabecera Corporativa */}
        <div className="modal-cabecera-clinica" style={{ padding: '0.85rem 1.15rem' }}>
          <div className="modal-cabecera-izq">
            <div
              className="modal-icono-caja"
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                borderColor: 'rgba(16, 185, 129, 0.25)',
                width: '34px',
                height: '34px',
              }}
            >
              <CalendarPlus style={{ width: '18px', height: '18px' }} />
            </div>
            <div>
              <h3 className="modal-titulo-principal" style={{ fontSize: '0.95rem' }}>Agendar Cita de Optometría</h3>
              {pacienteEfectivo ? (
                <div className="modal-subtitulo-paciente" style={{ fontSize: '0.72rem' }}>
                  <span>Paciente:</span>
                  <strong>{obtenerNombrePaciente(pacienteEfectivo)}</strong>
                  <span className="modal-badge-paciente">#{pacienteEfectivo.id}</span>
                  {pacienteEfectivo.telefono && (
                    <span style={{ color: 'var(--texto-atenuado)' }}>• {formatearTelefono(pacienteEfectivo.telefono)}</span>
                  )}
                </div>
              ) : (
                <div className="modal-subtitulo-paciente" style={{ fontSize: '0.72rem', color: 'var(--texto-atenuado)' }}>
                  Selecciona un paciente para agendar
                </div>
              )}
            </div>
          </div>

          <EtiquetaTooltip texto="Cerrar ventana (Esc)" posicion="abajo">
            <button
              type="button"
              onClick={manejarCierre}
              className="modal-btn-cerrar"
              aria-label="Cerrar modal"
            >
              <X style={{ width: '16px', height: '16px' }} />
            </button>
          </EtiquetaTooltip>
        </div>

        {/* Formulario de Cita */}
        <form onSubmit={manejarEnvio} style={{ display: 'contents' }}>
          <div className="modal-cuerpo-clinico" style={{ padding: '0.85rem 1.15rem', gap: '0.65rem' }}>
            {errorValidacion && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: 'var(--radio-md)',
                  padding: '0.65rem 0.9rem',
                  color: '#ef4444',
                  fontSize: '0.81rem',
                  fontWeight: 600,
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.1)',
                }}
              >
                <AlertTriangle style={{ width: '17px', height: '17px', flexShrink: 0, color: '#ef4444' }} />
                <span>{errorValidacion}</span>
              </div>
            )}

            <div className="modal-grid-parametros" style={{ gap: '0.55rem' }}>
              {/* Selector de Paciente con Buscador Sutil por Nombre, Cédula y Teléfono */}
              {!contacto && (
                <div className="modal-campo-grupo col-span-2">
                  <label className="modal-label">
                    Paciente de la Óptica <span style={{ color: 'var(--texto-atenuado, #94a3b8)' }}>*</span>:
                  </label>
                  <SelectorDesplegable
                    valor={pacienteIdManual ? String(pacienteIdManual) : ''}
                    alCambiar={(val) => {
                      setPacienteIdManual(Number(val));
                      if (errorValidacion) setErrorValidacion(null);
                    }}
                    opciones={pacientesDeLaOptica.map((c) => {
                      const nombre = obtenerNombrePaciente(c);
                      const detalleSecundario = [
                        c.cedula ? `CC: ${c.cedula}` : null,
                        c.telefono ? formatearTelefono(c.telefono) : `#${c.id}`,
                      ].filter(Boolean).join(' • ');

                      return {
                        valor: String(c.id),
                        etiqueta: `${nombre} (${detalleSecundario})`,
                        textoBusquedaExtra: `${nombre} ${c.cedula || ''} ${c.documento || ''} ${c.telefono || ''} ${c.id}`,
                      };
                    })}
                    conBuscador={true}
                    placeholderBuscador="Buscar paciente por nombre, cédula o teléfono..."
                    placeholder={
                      pacientesDeLaOptica.length > 0
                        ? 'Seleccionar paciente del directorio...'
                        : 'No hay pacientes registrados en la óptica'
                    }
                    anchoMinimo="100%"
                  />
                  {pacientesDeLaOptica.length === 0 && (
                    <span style={{ fontSize: '0.73rem', color: 'var(--color-destructivo, #ef4444)', marginTop: '0.2rem', display: 'block' }}>
                      Debes registrar primero al paciente en el módulo de Directorio de Pacientes.
                    </span>
                  )}
                </div>
              )}
              {/* 1. Selector de Fecha Premium Corporativo */}
              <div className="modal-campo-grupo">
                <label className="modal-label">
                  Fecha de la Cita <span style={{ color: 'var(--texto-atenuado, #94a3b8)' }}>*</span>:
                </label>
                <SelectorFecha
                  valor={fechaCita}
                  alCambiar={(nueva) => {
                    setFechaCita(nueva);
                    if (errorValidacion) setErrorValidacion(null);
                  }}
                  min={fechaHoyString}
                  placeholder="Seleccionar fecha de cita..."
                  anchoMinimo="100%"
                />
              </div>

              {/* 2. Selector de Hora Clínico Popover */}
              <div className="modal-campo-grupo">
                <label className="modal-label">
                  Hora de Consulta <span style={{ color: 'var(--texto-atenuado, #94a3b8)' }}>*</span>:
                </label>
                <SelectorHoraPopover
                  valor={horaCita}
                  alCambiar={(nueva) => {
                    setHoraCita(nueva);
                    if (errorValidacion) setErrorValidacion(null);
                  }}
                  placeholder="Seleccionar hora..."
                />
              </div>

              {/* 3. Motivo de la Cita */}
              <div className="modal-campo-grupo col-span-2">
                <label className="modal-label">
                  Motivo de la Cita <span style={{ color: 'var(--texto-atenuado, #94a3b8)' }}>*</span>:
                </label>
                <SelectorDesplegable
                  valor={motivo}
                  alCambiar={(val) => {
                    setMotivo(val);
                    if (errorValidacion) setErrorValidacion(null);
                  }}
                  opciones={OPCIONES_MOTIVO_CITA.map((m) => ({ valor: m, etiqueta: m }))}
                  placeholder="Seleccionar motivo de la cita..."
                  anchoMinimo="100%"
                />
              </div>

              {/* 4. Especialista Asignado */}
              <div className="modal-campo-grupo col-span-2">
                <label className="modal-label">Especialista / Optómetra Asignado:</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={especialista}
                    onChange={(e) => setEspecialista(e.target.value)}
                    placeholder="Nombre del especialista..."
                    className="modal-input"
                    style={{ paddingLeft: '2rem', height: '36px' }}
                  />
                  <UserCheck
                    style={{
                      position: 'absolute',
                      left: '0.65rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '14px',
                      height: '14px',
                      color: 'var(--color-primario-claro)',
                    }}
                  />
                </div>
              </div>

              {/* 5. Observaciones Clínicas */}
              <div className="modal-campo-grupo col-span-2">
                <label className="modal-label">Observaciones para el Especialista:</label>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="modal-textarea"
                  rows={2}
                  style={{ minHeight: '44px', height: '44px', resize: 'vertical' }}
                  placeholder="Ej: Paciente refiere dificultad para enfocar de cerca, usuario de lentes progresivos..."
                />
              </div>
            </div>

            {/* Tarjeta Informativa de Integración WhatsApp con Zernio */}
            <div
              style={{
                background: ventana24hActiva ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                border: ventana24hActiva ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                padding: '0.65rem 0.8rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                transition: 'all 0.2s ease',
              }}
            >
              {ventana24hActiva ? (
                <MessageSquare
                  style={{
                    width: '18px',
                    height: '18px',
                    color: '#10b981',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                />
              ) : (
                <Clock
                  style={{
                    width: '18px',
                    height: '18px',
                    color: '#d97706',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                />
              )}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--texto-principal)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Notificación Automática por WhatsApp</span>
                    {!ventana24hActiva ? (
                      <span
                        style={{
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          color: '#b45309',
                          background: 'rgba(245, 158, 11, 0.16)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        ⚠️ 24h Inactiva
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          color: '#059669',
                          background: 'rgba(16, 185, 129, 0.16)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        ● 24h Activa
                      </span>
                    )}
                  </div>

                  <EtiquetaTooltip
                    texto={
                      !ventana24hActiva
                        ? 'Ventana de 24h inactiva. Clic para ver detalles de la política de Meta'
                        : enviarWhatsapp
                        ? 'Desactivar confirmación automática por WhatsApp'
                        : 'Activar confirmación automática por WhatsApp'
                    }
                    posicion="izquierda"
                  >
                    <label
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        cursor: !ventana24hActiva ? 'not-allowed' : 'pointer',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        userSelect: 'none',
                        opacity: !ventana24hActiva ? 0.75 : 1,
                      }}
                      onClick={(e) => {
                        if (!ventana24hActiva) {
                          e.preventDefault();
                          manejarCambioWhatsapp(true);
                        }
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={enviarWhatsapp}
                        onChange={(e) => manejarCambioWhatsapp(e.target.checked)}
                        disabled={!ventana24hActiva}
                        style={{ accentColor: '#10b981', cursor: !ventana24hActiva ? 'not-allowed' : 'pointer' }}
                      />
                      <span>{enviarWhatsapp ? 'Activo' : 'Inactivo'}</span>
                    </label>
                  </EtiquetaTooltip>
                </div>

                <p
                  style={{
                    fontSize: '0.71rem',
                    color: 'var(--texto-secundario)',
                    margin: '0.25rem 0 0 0',
                    lineHeight: 1.35,
                  }}
                >
                  {ventana24hActiva ? (
                    <>
                      Al agendar, se enviará confirmación inmediata a <strong>{pacienteEfectivo?.telefono ? formatearTelefono(pacienteEfectivo.telefono) : 'su número'}</strong> con el horario y especialista asignado.
                    </>
                  ) : (
                    <>
                      Ventana de 24h inactiva: El paciente no ha interactuado en más de 24 horas. El envío automático ha sido deshabilitado para evitar rechazos en Meta.
                    </>
                  )}
                </p>

                {advertenciaVentana24h && (
                  <div
                    style={{
                      marginTop: '0.55rem',
                      padding: '0.55rem 0.75rem',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.28)',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      lineHeight: 1.45,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      animation: 'fadeIn 0.2s ease-in-out',
                    }}
                  >
                    <AlertTriangle style={{ width: '15px', height: '15px', color: '#dc2626', flexShrink: 0, marginTop: '1px' }} />
                    <div>
                      <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: '2px' }}>
                        Restricción de envío oficial de Meta (WhatsApp)
                      </div>
                      <div style={{ color: 'var(--texto-principal)' }}>
                        No es posible enviar la confirmación automática por WhatsApp porque han pasado más de 24 horas desde el último mensaje del paciente. Meta rechaza los mensajes libres fuera de la ventana de atención.
                      </div>
                      <div style={{ marginTop: '3px', fontSize: '0.69rem', color: 'var(--texto-secundario)' }}>
                        💡 Para notificarle la cita por WhatsApp, reanuda la conversación enviando una plantilla preaprobada desde el chat.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pie con Acciones */}
          <div className="modal-pie-clinico">
            <button
              type="button"
              onClick={manejarCierre}
              className="modal-btn-cancelar"
              disabled={cargando}
            >
              Cancelar
            </button>
            <EtiquetaTooltip
              texto={
                formularioCompleto
                  ? 'Guardar cita clínica y enviar confirmación al paciente'
                  : 'Diligencia la fecha, hora, motivo y especialista para habilitar el guardado'
              }
              posicion="arriba"
            >
              <div style={{ display: 'inline-block' }}>
                <button
                  type="submit"
                  className="modal-btn-guardar"
                  disabled={!formularioCompleto || cargando}
                  style={{
                    background: formularioCompleto
                      ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                      : 'var(--fondo-hover)',
                    color: formularioCompleto ? '#ffffff' : 'var(--texto-atenuado)',
                    boxShadow: formularioCompleto
                      ? '0 4px 12px rgba(16, 185, 129, 0.35)'
                      : 'none',
                    cursor: !formularioCompleto || cargando ? 'not-allowed' : 'pointer',
                    opacity: !formularioCompleto ? 0.6 : 1,
                  }}
                >
                  <CalendarCheck style={{ width: '15px', height: '15px' }} />
                  <span>{cargando ? 'Agendando...' : 'Confirmar & Agendar Cita'}</span>
                </button>
              </div>
            </EtiquetaTooltip>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(contenidoModal, document.body) : null;
};
