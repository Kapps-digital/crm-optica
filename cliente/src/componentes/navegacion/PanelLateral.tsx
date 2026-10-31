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
  X,
} from 'lucide-react';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';
import { TarjetaPlanSuscripcion } from './TarjetaPlanSuscripcion';
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
      <TarjetaPlanSuscripcion
        optica={optica}
        usuario={usuario}
        colapsado={colapsado}
        alCambiarVista={alCambiarVista}
      />
    </aside>
  );
};

