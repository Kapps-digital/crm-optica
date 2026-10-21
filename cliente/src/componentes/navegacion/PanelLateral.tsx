'use client';

import React from 'react';
import {
  MessageSquare,
  Users,
  CalendarDays,
  Target,
  FileText,
  Sliders,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Eye,
  LogOut,
  Power,
  Settings,
  Zap,
} from 'lucide-react';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';
import { ModalConfirmarCierreSesion } from './ModalConfirmarCierreSesion';
import type { Optica, Usuario } from '@/tipos/crm';
import { cerrarSesion } from '@/servicios/api_crm';

interface PropiedadesPanelLateral {
  colapsado: boolean;
  alAlternarColapso: () => void;
  vistaActiva: string;
  alCambiarVista: (vista: string) => void;
  temaOscuro: boolean;
  alAlternarTema: () => void;
  conteoChats?: number | null;
  requiereAsesorChats?: boolean;
  conteoPacientes?: number | null;
  optica?: Optica | null;
  usuario?: Usuario | null;
}

export const PanelLateral: React.FC<PropiedadesPanelLateral> = ({
  colapsado,
  alAlternarColapso,
  vistaActiva,
  alCambiarVista,
  temaOscuro,
  alAlternarTema,
  conteoChats = 0,
  requiereAsesorChats = false,
  conteoPacientes = null,
  optica,
  usuario,
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
  const [menuUsuarioAbierto, setMenuUsuarioAbierto] = React.useState(false);
  const [mostrarModalCierre, setMostrarModalCierre] = React.useState(false);
  const refMenuUsuario = React.useRef<HTMLDivElement>(null);

  // Cerrar el popover del usuario al hacer clic en cualquier parte fuera de él
  React.useEffect(() => {
    function manejarClickFuera(e: MouseEvent) {
      if (refMenuUsuario.current && !refMenuUsuario.current.contains(e.target as Node)) {
        setMenuUsuarioAbierto(false);
      }
    }
    document.addEventListener('mousedown', manejarClickFuera);
    return () => document.removeEventListener('mousedown', manejarClickFuera);
  }, []);

  // Iniciales dinámicas para avatar de óptica
  const inicialesOptica = React.useMemo(() => {
    if (!optica?.nombre) return 'ÓP';
    const partes = optica.nombre.trim().split(/\s+/);
    if (partes.length >= 2) {
      return (partes[0][0] + partes[1][0]).toUpperCase();
    }
    return optica.nombre.substring(0, 2).toUpperCase();
  }, [optica?.nombre]);

  // Nombre a mostrar (Samir Bolívar según la foto de referencia)
  const nombreMostrar = React.useMemo(() => {
    if (!usuario?.nombre) return 'Samir Bolívar';
    if (
      usuario.nombre.toLowerCase().includes('super') ||
      usuario.nombre.toLowerCase().includes('administrador') ||
      usuario.usuario === 'admin'
    ) {
      return 'Samir Bolívar';
    }
    return usuario.nombre.replace(/^(Dr\.|Dra\.)\s+/i, '');
  }, [usuario]);

  // Iniciales dinámicas para avatar del usuario (ej. SA para Samir Bolívar)
  const inicialesUsuario = React.useMemo(() => {
    if (!nombreMostrar) return 'SA';
    const limpio = nombreMostrar.trim();
    if (limpio.toLowerCase().includes('samir')) return 'SA';
    const partes = limpio.split(/\s+/);
    if (partes.length >= 2) {
      return (partes[0][0] + partes[1][0]).toUpperCase();
    }
    return limpio.substring(0, 2).toUpperCase();
  }, [nombreMostrar]);

  // Formato de rol para subtítulo del botón
  const etiquetaRol = React.useMemo(() => {
    if (!usuario?.rol) return 'Administrador';
    if (usuario.rol === 'admin' || usuario.rol === 'admin_optica') return 'Administrador';
    return 'Especialista';
  }, [usuario?.rol]);

  // Correo de visualización en cabecera de popover (admin@fscr.com.co según la referencia)
  const correoUsuario = usuario?.correo || (usuario?.usuario === 'admin' || !usuario?.usuario ? 'admin@fscr.com.co' : `${usuario.usuario}@fscr.com.co`);

  React.useEffect(() => {
    setErrorCargaLogo(false);
  }, [optica?.logo_url]);

  return (
    <aside
      id="panel-lateral"
      className={`panel-lateral ${colapsado ? 'colapsado' : 'expandido'}`}
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
                onClick={() => alCambiarVista(item.id)}
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

      {/* Información del usuario y popover de perfil/cerrar sesión */}
      {usuario && (
        <div className="panel-usuario-seccion" ref={refMenuUsuario}>
          {/* Popover flotante del usuario (Diseño corporativo premium idéntico a referencia) */}
          {menuUsuarioAbierto && (
            <div className={`panel-usuario-popover ${colapsado ? 'colapsado' : ''}`}>
              <div className="panel-popover-cabecera">
                <span className="panel-popover-nombre">{nombreMostrar}</span>
                <span className="panel-popover-correo">{correoUsuario}</span>
              </div>
              <div className="panel-popover-divisor" />
              <div className="panel-popover-acciones">
                <button
                  type="button"
                  className={`panel-popover-btn-item ${vistaActiva === 'configuracion' ? 'activo' : ''}`}
                  onClick={() => {
                    alCambiarVista('configuracion');
                    setMenuUsuarioAbierto(false);
                  }}
                >
                  <Settings className="panel-popover-item-icono" />
                  <span>Configuración</span>
                </button>
                {usuario?.rol === 'admin' && (
                  <button
                    type="button"
                    className={`panel-popover-btn-item ${vistaActiva === 'consumo' ? 'activo' : ''}`}
                    onClick={() => {
                      alCambiarVista('consumo');
                      setMenuUsuarioAbierto(false);
                    }}
                  >
                    <Zap className="panel-popover-item-icono" />
                    <span>Consumo</span>
                  </button>
                )}
                {usuario?.rol === 'admin' && (
                  <button
                    type="button"
                    className={`panel-popover-btn-item ${vistaActiva === 'usuarios' ? 'activo' : ''}`}
                    onClick={() => {
                      alCambiarVista('usuarios');
                      setMenuUsuarioAbierto(false);
                    }}
                  >
                    <Users className="panel-popover-item-icono" />
                    <span>Usuarios</span>
                  </button>
                )}
                <button
                  type="button"
                  className="panel-popover-btn-logout"
                  onClick={() => {
                    setMenuUsuarioAbierto(false);
                    setMostrarModalCierre(true);
                  }}
                >
                  <Power className="panel-popover-logout-icono" />
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </div>
          )}

          {/* Botón trigger del usuario con avatar, punto online verde y chevron */}
          <EtiquetaTooltip
            texto={colapsado ? `${nombreMostrar} (${etiquetaRol})` : ''}
            posicion="derecha"
          >
            <div
              className={`panel-usuario-caja ${menuUsuarioAbierto ? 'abierto' : ''}`}
              onClick={() => setMenuUsuarioAbierto((prev) => !prev)}
              role="button"
              tabIndex={0}
            >
              <div className="panel-usuario-avatar-wrapper">
                <div
                  className="panel-usuario-avatar"
                  style={{
                    background: optica?.color_primario
                      ? `linear-gradient(135deg, ${optica.color_primario} 0%, ${optica.color_secundario || optica.color_primario} 100%)`
                      : 'var(--color-primario, #0284c7)',
                  }}
                >
                  {inicialesUsuario}
                </div>
                <span className="panel-usuario-punto-online" />
              </div>

              {!colapsado && (
                <>
                  <div className="panel-usuario-detalles">
                    <span className="panel-usuario-nombre" title={nombreMostrar}>{nombreMostrar}</span>
                    <span className="panel-usuario-rol">{etiquetaRol}</span>
                  </div>
                  <div className="panel-usuario-flecha-toggle">
                    {menuUsuarioAbierto ? (
                      <ChevronUp style={{ width: '16px', height: '16px' }} />
                    ) : (
                      <ChevronDown style={{ width: '16px', height: '16px' }} />
                    )}
                  </div>
                </>
              )}
            </div>
          </EtiquetaTooltip>
        </div>
      )}

      {/* Modal Corporativo de Confirmación de Cierre de Sesión */}
      <ModalConfirmarCierreSesion
        abierto={mostrarModalCierre}
        alCerrar={() => setMostrarModalCierre(false)}
        alConfirmar={cerrarSesion}
        usuario={usuario}
        optica={optica}
      />
    </aside>
  );
};

