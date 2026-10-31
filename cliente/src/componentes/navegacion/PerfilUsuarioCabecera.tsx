'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Settings,
  Zap,
  Users,
  Power,
} from 'lucide-react';
import { ModalConfirmarCierreSesion } from './ModalConfirmarCierreSesion';
import { cerrarSesion } from '@/servicios/api_crm';
import type { Usuario, Optica } from '@/tipos/crm';

interface PropiedadesPerfilUsuarioCabecera {
  usuario?: Usuario | null;
  optica?: Optica | null;
  vistaActiva?: string;
  alCambiarVista?: (vista: string) => void;
}

export const PerfilUsuarioCabecera: React.FC<PropiedadesPerfilUsuarioCabecera> = ({
  usuario,
  optica,
  vistaActiva,
  alCambiarVista,
}) => {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [mostrarModalCierre, setMostrarModalCierre] = useState(false);
  const refContenedor = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic afuera
  useEffect(() => {
    function manejarClickFuera(e: MouseEvent) {
      if (refContenedor.current && !refContenedor.current.contains(e.target as Node)) {
        setMenuAbierto(false);
      }
    }
    document.addEventListener('mousedown', manejarClickFuera);
    return () => document.removeEventListener('mousedown', manejarClickFuera);
  }, []);

  // Nombre exacto proveniente de la tabla de usuarios
  const nombreMostrar = useMemo(() => {
    return usuario?.nombre?.trim() || usuario?.usuario || 'Usuario';
  }, [usuario?.nombre, usuario?.usuario]);

  // Iniciales para el avatar basadas en el nombre real
  const inicialesUsuario = useMemo(() => {
    if (!nombreMostrar) return 'U';
    const partes = nombreMostrar.trim().split(/\s+/);
    if (partes.length >= 2) {
      return (partes[0][0] + partes[1][0]).toUpperCase();
    }
    return nombreMostrar.substring(0, 2).toUpperCase();
  }, [nombreMostrar]);

  // Etiqueta del rol
  const etiquetaRol = useMemo(() => {
    if (!usuario?.rol) return 'Administrador';
    if (usuario.rol === 'admin' || usuario.rol === 'admin_optica') return 'Administrador';
    return 'Especialista';
  }, [usuario?.rol]);

  // Formateador de fecha en horario Colombia
  const fechaVencimientoFormateada = useMemo(() => {
    if (!optica?.fecha_vencimiento) return null;
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

  if (!usuario) return null;

  return (
    <div className="cabecera-usuario-contenedor" ref={refContenedor}>
      {/* Tarjeta disparadora en la cabecera */}
      <div
        className={`cabecera-usuario-tarjeta ${menuAbierto ? 'abierto' : ''}`}
        onClick={() => setMenuAbierto((prev) => !prev)}
        role="button"
        tabIndex={0}
      >
        {/* Avatar cuadrado redondeado con punto online verde */}
        <div className="cabecera-avatar-envoltorio">
          <div
            className="cabecera-avatar-cuadrado"
            style={{
              background: optica?.color_primario
                ? `linear-gradient(135deg, ${optica.color_primario} 0%, ${optica.color_secundario || optica.color_primario} 100%)`
                : 'var(--color-primario, #0284c7)',
            }}
          >
            {inicialesUsuario}
          </div>
          <span className="cabecera-avatar-punto-online" />
        </div>

        {/* Textos: Nombre y Rol */}
        <div className="cabecera-usuario-info">
          <span className="cabecera-usuario-nombre" title={nombreMostrar}>
            {nombreMostrar}
          </span>
          <span className="cabecera-usuario-rol">{etiquetaRol}</span>
        </div>

        {/* Flecha chevron */}
        <div className="cabecera-usuario-chevron">
          {menuAbierto ? (
            <ChevronUp style={{ width: '15px', height: '15px' }} />
          ) : (
            <ChevronDown style={{ width: '15px', height: '15px' }} />
          )}
        </div>
      </div>

      {/* Menú Popover Flotante desplegado hacia abajo */}
      {menuAbierto && (
        <div className="cabecera-usuario-popover">
          {/* Cabecera Corporativa con Mini-Avatar */}
          <div className="cabecera-popover-cabecera">
            <div
              className="cabecera-popover-mini-avatar"
              style={{
                background: optica?.color_primario
                  ? `linear-gradient(135deg, ${optica.color_primario} 0%, ${optica.color_secundario || optica.color_primario} 100%)`
                  : 'var(--color-primario, #0284c7)',
              }}
            >
              {inicialesUsuario}
            </div>
            <div className="cabecera-popover-avatar-info">
              <span className="cabecera-popover-nombre">{nombreMostrar}</span>
              <span className="cabecera-popover-sub-rol">
                {etiquetaRol} • {optica?.nombre || 'Óptica'}
              </span>
            </div>
          </div>

          {/* Resumen de Suscripción en Horario Colombia */}
          {fechaVencimientoFormateada && (
            <div
              style={{
                margin: '0.5rem 0.85rem',
                padding: '0.55rem 0.75rem',
                borderRadius: '8px',
                background: 'var(--fondo-elevado)',
                border: '1px solid var(--borde-tarjeta)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.74rem',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: 'var(--texto-atenuado)', fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  Plan Mensual
                </span>
                <span style={{ fontWeight: 700, color: 'var(--texto-principal)' }}>
                  {fechaVencimientoFormateada}
                </span>
              </div>
              <span
                style={{
                  padding: '0.18rem 0.55rem',
                  borderRadius: '9999px',
                  fontWeight: 700,
                  fontSize: '0.68rem',
                  background:
                    optica?.plan_vencido || (optica?.dias_restantes !== undefined && optica.dias_restantes < 0)
                      ? 'rgba(239, 68, 68, 0.14)'
                      : (optica?.dias_restantes ?? 99) <= 5
                      ? 'rgba(245, 158, 11, 0.16)'
                      : 'rgba(16, 185, 129, 0.14)',
                  color:
                    optica?.plan_vencido || (optica?.dias_restantes !== undefined && optica.dias_restantes < 0)
                      ? '#ef4444'
                      : (optica?.dias_restantes ?? 99) <= 5
                      ? '#d97706'
                      : '#059669',
                }}
              >
                {optica?.plan_vencido || (optica?.dias_restantes !== undefined && optica.dias_restantes < 0)
                  ? 'Vencido'
                  : `${optica?.dias_restantes ?? 0} días`}
              </span>
            </div>
          )}

          <div className="cabecera-popover-divisor" />

          <div className="cabecera-popover-acciones">
            <button
              type="button"
              className={`cabecera-popover-btn-item ${vistaActiva === 'configuracion' ? 'activo' : ''}`}
              onClick={() => {
                alCambiarVista?.('configuracion');
                setMenuAbierto(false);
              }}
            >
              <Settings className="cabecera-popover-item-icono" />
              <span>Configuración</span>
            </button>

            {usuario?.rol === 'admin' && (
              <button
                type="button"
                className={`cabecera-popover-btn-item ${vistaActiva === 'consumo' ? 'activo' : ''}`}
                onClick={() => {
                  alCambiarVista?.('consumo');
                  setMenuAbierto(false);
                }}
              >
                <Zap className="cabecera-popover-item-icono" />
                <span>Consumo</span>
              </button>
            )}

            {usuario?.rol === 'admin' && (
              <button
                type="button"
                className={`cabecera-popover-btn-item ${vistaActiva === 'usuarios' ? 'activo' : ''}`}
                onClick={() => {
                  alCambiarVista?.('usuarios');
                  setMenuAbierto(false);
                }}
              >
                <Users className="cabecera-popover-item-icono" />
                <span>Usuarios</span>
              </button>
            )}

            <div className="cabecera-popover-divisor-suave" />

            <button
              type="button"
              className="cabecera-popover-btn-logout"
              onClick={() => {
                setMenuAbierto(false);
                setMostrarModalCierre(true);
              }}
            >
              <Power className="cabecera-popover-logout-icono" />
              <span>Cerrar sesión</span>
            </button>
          </div>
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
    </div>
  );
};
