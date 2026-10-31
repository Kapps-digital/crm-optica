'use client';

import React from 'react';
import {
  MessageSquare,
  Users,
  CalendarDays,
  Target,
  FileText,
  ChevronLeft,
  Eye,
  Settings,
  Clock,
  ShieldCheck,
  AlertCircle,
  X,
} from 'lucide-react';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';
import type { Optica, Usuario } from '@/tipos/crm';

interface PropiedadesPanelLateral {
  colapsado: boolean;
  alAlternarColapso: () => void;
  vistaActiva: string;
  alCambiarVista: (vista: string) => void;
  temaOscuro?: boolean;
  alAlternarTema?: () => void;
  conteoChats?: number | null;
  requiereAsesorChats?: boolean;
  conteoPacientes?: number | null;
  optica?: Optica | null;
  usuario?: Usuario | null;
  abiertoMovil?: boolean;
  alCerrarMovil?: () => void;
}

export const PanelLateral: React.FC<PropiedadesPanelLateral> = ({
  colapsado,
  alAlternarColapso,
  vistaActiva,
  alCambiarVista,
  conteoChats = 0,
  requiereAsesorChats = false,
  optica,
  usuario,
  abiertoMovil = false,
  alCerrarMovil,
}) => {
  const elementos = [
    {
      id: 'mensajeria',
      etiqueta: 'Conversaciones',
      icono: MessageSquare,
      conteo: conteoChats,
      esUrgente: Boolean(requiereAsesorChats),
    },
    { id: 'pacientes', etiqueta: 'Pacientes & Contactos', icono: Users, conteo: null, esUrgente: false },
    { id: 'citas', etiqueta: 'Calendario de Citas', icono: CalendarDays, conteo: null, esUrgente: false },
    { id: 'campanas', etiqueta: 'Auto-Segmentación', icono: Target, conteo: null, esUrgente: false },
    { id: 'plantillas', etiqueta: 'Plantillas', icono: FileText, conteo: null, esUrgente: false },
    { id: 'configuracion', etiqueta: 'Configuración', icono: Settings, conteo: null, esUrgente: false },
  ];

  const [errorCargaLogo, setErrorCargaLogo] = React.useState(false);

  // Iniciales dinámicas para avatar de óptica
  const inicialesOptica = React.useMemo(() => {
    if (!optica?.nombre) return 'ÓP';
    const partes = optica.nombre.trim().split(/\s+/);
    if (partes.length >= 2) {
      return (partes[0][0] + partes[1][0]).toUpperCase();
    }
    return optica.nombre.substring(0, 2).toUpperCase();
  }, [optica?.nombre]);

  React.useEffect(() => {
    setErrorCargaLogo(false);
  }, [optica?.logo_url]);

  // Fecha de vencimiento formateada en horario Colombia (America/Bogota, UTC-5)
  const fechaColombiaFormateada = React.useMemo(() => {
    if (!optica?.fecha_vencimiento) return 'Sin fecha';
    try {
      const d = new Date(optica.fecha_vencimiento);
      return new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(d);
    } catch {
      return String(optica.fecha_vencimiento);
    }
  }, [optica?.fecha_vencimiento]);

  const dias = optica?.dias_restantes ?? 0;
  const esVencido = Boolean(
    optica?.plan_vencido || (optica?.dias_restantes !== undefined && optica.dias_restantes < 0)
  );
  const esPorVencer = !esVencido && dias <= 5;

  return (
    <aside
      id="panel-lateral"
      className={`panel-lateral ${colapsado ? 'colapsado' : 'expandido'} ${abiertoMovil ? 'abierto-movil' : ''}`}
    >
      {/* Logotipo Corporativo Dinámico */}
      <div className="panel-lateral-cabecera">
        <EtiquetaTooltip
          texto={colapsado ? 'Expandir menú lateral' : 'Contraer menú lateral'}
          posicion={colapsado ? 'derecha' : 'abajo'}
        >
          <div
            className={`panel-logo-caja ${optica?.logo_url && !errorCargaLogo ? 'con-foto' : 'sin-foto'}`}
            onClick={alAlternarColapso}
            role="button"
          >
            {optica?.logo_url && !errorCargaLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={optica.logo_url}
                src={optica.logo_url}
                alt={optica.nombre || 'Logo Óptica'}
                className="panel-logo-imagen"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.endsWith('/logo.jpeg')) {
                    target.src = '/logo.jpeg';
                  } else {
                    setErrorCargaLogo(true);
                  }
                }}
              />
            ) : (
              <div
                className="panel-logo-avatar-iniciales"
                style={{
                  background: optica?.color_primario
                    ? `linear-gradient(135deg, ${optica.color_primario} 0%, ${optica.color_secundario || optica.color_primario} 100%)`
                    : 'linear-gradient(135deg, var(--color-primario, #0284c7) 0%, var(--color-primario-oscuro, #0369a1) 100%)',
                }}
              >
                {inicialesOptica}
              </div>
            )}
          </div>
        </EtiquetaTooltip>

        {!colapsado && (
          <div id="panel-logo-texto-grupo" className="panel-logo-texto-grupo">
            <div className="panel-logo-texto" onClick={alAlternarColapso} style={{ cursor: 'pointer' }}>
              <span className="panel-logo-titulo" title={optica?.nombre || 'Óptica'}>
                {optica?.nombre || 'Óptica'}
              </span>
              <span className="panel-logo-subtitulo">
                <Eye style={{ width: '13px', height: '13px', color: 'var(--color-primario-claro)' }} />
                <span>{usuario?.rol === 'admin' ? 'Superadmin Global' : 'Gestión Clínica'}</span>
              </span>
            </div>
            <EtiquetaTooltip texto="Contraer menú" posicion="abajo">
              <button
                type="button"
                className="panel-toggle-superior-btn"
                onClick={alAlternarColapso}
              >
                <ChevronLeft style={{ width: '18px', height: '18px' }} />
              </button>
            </EtiquetaTooltip>
          </div>
        )}

        {/* Botón cerrar panel en móvil */}
        {alCerrarMovil && (
          <button
            type="button"
            className="btn-cerrar-panel-movil"
            onClick={alCerrarMovil}
            title="Cerrar menú"
            aria-label="Cerrar menú lateral"
          >
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        )}
      </div>

      {/* Navegación con Botones en Píldora */}
      <nav className="panel-lateral-nav">
        {elementos.map((item) => {
          const Icono = item.icono;
          const esActivo = vistaActiva === item.id;

          const textoTooltip = colapsado
            ? typeof item.conteo === 'number' && item.conteo > 0
              ? `${item.etiqueta} (${item.conteo})`
              : item.etiqueta
            : '';

          return (
            <EtiquetaTooltip
              key={item.id}
              texto={textoTooltip}
              posicion="derecha"
            >
              <button
                type="button"
                className={`panel-item-btn ${esActivo ? 'activo' : ''}`}
                data-vista={item.id}
                onClick={() => {
                  alCambiarVista(item.id);
                  if (alCerrarMovil) alCerrarMovil();
                }}
              >
                <div className="panel-item-izq">
                  <Icono className="panel-item-icono" />
                  {!colapsado && <span className="panel-item-etiqueta">{item.etiqueta}</span>}
                </div>

                {typeof item.conteo === 'number' && item.conteo > 0 && (
                  colapsado ? (
                    <span className={`panel-item-punto-notificacion ${item.esUrgente ? 'punto-urgente-rojo' : ''}`} />
                  ) : (
                    <span
                      className={`panel-item-badge-conteo ${item.esUrgente ? 'badge-urgente-rojo' : ''}`}
                      title={item.esUrgente ? '¡Atención! Conversaciones que requieren asesor humano' : undefined}
                    >
                      {item.conteo}
                    </span>
                  )
                )}
              </button>
            </EtiquetaTooltip>
          );
        })}
      </nav>

      {/* 3. Indicador Premium de Suscripción en Pie del Menú Lateral (Horario Colombia) */}
      {optica?.fecha_vencimiento && (
        <div
          style={{
            borderTop: '1px solid var(--borde-tarjeta)',
            padding: colapsado ? '0.6rem 0.2rem' : '0.65rem 0.65rem 0.75rem 0.65rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: colapsado ? 'center' : 'stretch',
          }}
        >
          {colapsado ? (
            <EtiquetaTooltip
              texto={`Suscripción: ${esVencido ? 'Vencida' : `${dias} días`} • Corte: ${fechaColombiaFormateada}`}
              posicion="derecha"
            >
              <div
                onClick={() => usuario?.rol === 'admin' && alCambiarVista('usuarios')}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: esVencido
                    ? 'rgba(239, 68, 68, 0.14)'
                    : esPorVencer
                      ? 'rgba(245, 158, 11, 0.16)'
                      : 'var(--fondo-elevado)',
                  border: `1px solid ${esVencido
                      ? 'rgba(239, 68, 68, 0.35)'
                      : esPorVencer
                        ? 'rgba(245, 158, 11, 0.4)'
                        : 'var(--borde-tarjeta)'
                    }`,
                  color: esVencido
                    ? '#ef4444'
                    : esPorVencer
                      ? '#d97706'
                      : 'var(--color-primario, #0284c7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: usuario?.rol === 'admin' ? 'pointer' : 'default',
                  position: 'relative',
                  transition: 'all 0.18s ease',
                }}
              >
                {esVencido ? <AlertCircle size={16} /> : <Clock size={16} />}
                <span
                  style={{
                    position: 'absolute',
                    top: '5px',
                    right: '5px',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: esVencido ? '#ef4444' : esPorVencer ? '#f59e0b' : '#10b981',
                    boxShadow: esPorVencer ? '0 0 5px #f59e0b' : undefined,
                  }}
                />
              </div>
            </EtiquetaTooltip>
          ) : (
            <div
              onClick={() => usuario?.rol === 'admin' && alCambiarVista('usuarios')}
              style={{
                background: 'var(--fondo-elevado)',
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: 'var(--radio-md, 12px)',
                padding: '0.55rem 0.7rem',
                boxShadow: 'var(--sombra-sm)',
                cursor: usuario?.rol === 'admin' ? 'pointer' : 'default',
                transition: 'all 0.18s ease',
              }}
              onMouseEnter={(e) => {
                if (usuario?.rol === 'admin') e.currentTarget.style.borderColor = 'var(--color-primario-claro)';
              }}
              onMouseLeave={(e) => {
                if (usuario?.rol === 'admin') e.currentTarget.style.borderColor = 'var(--borde-tarjeta)';
              }}
            >
              {/* Fila Superior: Encabezado y Badge Semafórico */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Clock
                    size={12}
                    style={{
                      color: esVencido ? '#ef4444' : esPorVencer ? '#d97706' : 'var(--color-primario, #0284c7)',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '0.67rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                      color: 'var(--texto-atenuado)',
                    }}
                  >
                    PLAN MENSUAL
                  </span>
                </div>

                <span
                  style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: '9999px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    background: esVencido
                      ? 'rgba(239, 68, 68, 0.14)'
                      : esPorVencer
                        ? 'rgba(245, 158, 11, 0.16)'
                        : 'rgba(16, 185, 129, 0.14)',
                    color: esVencido
                      ? '#ef4444'
                      : esPorVencer
                        ? '#d97706'
                        : '#059669',
                  }}
                >
                  {esVencido ? 'Vencido' : dias === 0 ? 'Vence hoy' : `${dias} días`}
                </span>
              </div>

              {/* Fila Inferior: Fecha de Corte */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)' }}>
                  Corte:
                </span>
                <span style={{ fontWeight: 700, color: 'var(--texto-principal)' }}>
                  {fechaColombiaFormateada}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

