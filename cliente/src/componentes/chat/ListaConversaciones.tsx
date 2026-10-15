'use client';

import React, { useState, useMemo } from 'react';
import { Search, Phone, AlertCircle, Bot } from 'lucide-react';
import type { Conversacion } from '@/tipos/crm';
import { formatearTelefono } from '@/utilidades/formato';

interface PropiedadesListaConversaciones {
  conversaciones: Conversacion[];
  conversacionActivaId: number | null;
  alSeleccionarConversacion: (conversacion: Conversacion) => void;
  cargando: boolean;
  alSincronizar?: () => Promise<void>;
  sincronizando?: boolean;
}

type TipoFiltroPildora = 'todos' | 'no_leidos' | 'urgente' | 'ia';

function formatearFechaRelativa(fechaStr?: string | null): string {
  if (!fechaStr) return '';
  const d = new Date(fechaStr);
  if (isNaN(d.getTime())) return '';

  const ahora = new Date();
  const esHoy = d.toDateString() === ahora.toDateString();

  const ayer = new Date();
  ayer.setDate(ahora.getDate() - 1);
  const esAyer = d.toDateString() === ayer.toDateString();

  if (esHoy) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (esAyer) {
    return 'Ayer';
  }
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

function formatearUltimoMensaje(texto?: string | null): string {
  if (!texto) return 'Chat iniciado';
  const match = texto.match(/\[Template:\s*([a-zA-Z0-9_-]+)\]/i);
  if (match) {
    const nombre = match[1].replace(/_/g, ' ');
    return `Plantilla: ${nombre}`;
  }
  return texto;
}

export const ListaConversaciones: React.FC<PropiedadesListaConversaciones> = ({
  conversaciones,
  conversacionActivaId,
  alSeleccionarConversacion,
  cargando,
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [filtroSeleccionado, setFiltroSeleccionado] = useState<TipoFiltroPildora>('todos');

  const normalizar = (t: string) =>
    t
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  // Contadores para las píldoras de filtro
  const conteos = useMemo(() => {
    let noLeidos = 0;
    let urgentes = 0;
    let ia = 0;
    for (const c of conversaciones) {
      if (c.no_leido || (c.mensajes_no_leidos && c.mensajes_no_leidos > 0)) {
        noLeidos++;
      }
      if (c.requiere_asesor_humano) {
        urgentes++;
      }
      if (c.atendido_por_ia) {
        ia++;
      }
    }
    return { noLeidos, urgentes, ia };
  }, [conversaciones]);

  // Filtrado reactivo en memoria
  const conversacionesFiltradas = useMemo(() => {
    return conversaciones.filter((c) => {
      // 1. Filtrado por píldora seleccionada
      if (filtroSeleccionado === 'no_leidos') {
        const tieneNoLeidos = Boolean(c.no_leido || (c.mensajes_no_leidos && c.mensajes_no_leidos > 0));
        if (!tieneNoLeidos) return false;
      } else if (filtroSeleccionado === 'urgente') {
        if (!c.requiere_asesor_humano) return false;
      } else if (filtroSeleccionado === 'ia') {
        if (!c.atendido_por_ia) return false;
      }

      // 2. Filtrado por término de búsqueda
      const termino = normalizar(busqueda);
      if (!termino) return true;
      const nombre = normalizar(c.contacto_nombre || '');
      const telefono = normalizar(c.contacto_telefono || '');
      const ultimoMsg = normalizar(c.ultimo_mensaje_texto || '');
      return nombre.includes(termino) || telefono.includes(termino) || ultimoMsg.includes(termino);
    });
  }, [conversaciones, busqueda, filtroSeleccionado]);

  return (
    <div className="columna-conversaciones">
      {/* 1. Buscador Superior */}
      <div className="buscador-conversaciones">
        <div className="campo-busqueda-wrapper" style={{ width: '100%' }}>
          <Search className="icono-busqueda" style={{ width: '16px', height: '16px' }} />
          <input
            type="text"
            id="filtro-busqueda-chat"
            placeholder="Buscar por número o nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {/* 2. Barra de Filtros estilo WhatsApp (Píldoras) */}
      <div
        className="barra-filtros-whatsapp"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.45rem 0.85rem 0.65rem 0.85rem',
          borderBottom: '1px solid var(--borde-tarjeta, rgba(0, 0, 0, 0.06))',
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {/* Píldora: Todos */}
        <button
          type="button"
          onClick={() => setFiltroSeleccionado('todos')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.3rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: filtroSeleccionado === 'todos' ? 'var(--color-primario, #0284c7)' : 'var(--fondo-elevado, #f1f5f9)',
            color: filtroSeleccionado === 'todos' ? '#ffffff' : 'var(--texto-secundario, #475569)',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          Todos
        </button>

        {/* Píldora: No leídos */}
        <button
          type="button"
          onClick={() => setFiltroSeleccionado('no_leidos')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.3rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: filtroSeleccionado === 'no_leidos' ? 'var(--color-primario, #0284c7)' : 'var(--fondo-elevado, #f1f5f9)',
            color: filtroSeleccionado === 'no_leidos' ? '#ffffff' : 'var(--texto-secundario, #475569)',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <span>No leídos</span>
          {conteos.noLeidos > 0 && (
            <span
              style={{
                background: filtroSeleccionado === 'no_leidos' ? 'rgba(255, 255, 255, 0.28)' : 'var(--color-primario, #0284c7)',
                color: '#ffffff',
                fontSize: '0.66rem',
                fontWeight: 700,
                padding: '0 5px',
                borderRadius: '9999px',
                minWidth: '16px',
                height: '16px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {conteos.noLeidos}
            </span>
          )}
        </button>

        {/* Píldora: Requiere Asesor (Urgente con acento rojo) */}
        <button
          type="button"
          onClick={() => setFiltroSeleccionado('urgente')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.3rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            border: filtroSeleccionado === 'urgente' ? '1px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.35)',
            background: filtroSeleccionado === 'urgente' ? '#ef4444' : (conteos.urgentes > 0 ? 'rgba(239, 68, 68, 0.12)' : 'var(--fondo-elevado, #f1f5f9)'),
            color: filtroSeleccionado === 'urgente' ? '#ffffff' : '#ef4444',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <AlertCircle style={{ width: '13px', height: '13px' }} />
          <span>Requiere Asesor</span>
          {conteos.urgentes > 0 && (
            <span
              style={{
                background: filtroSeleccionado === 'urgente' ? 'rgba(255, 255, 255, 0.32)' : '#ef4444',
                color: '#ffffff',
                fontSize: '0.66rem',
                fontWeight: 700,
                padding: '0 5px',
                borderRadius: '9999px',
                minWidth: '16px',
                height: '16px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {conteos.urgentes}
            </span>
          )}
        </button>

        {/* Píldora: Atendido por IA */}
        <button
          type="button"
          onClick={() => setFiltroSeleccionado('ia')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.3rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: filtroSeleccionado === 'ia' ? '#10b981' : 'var(--fondo-elevado, #f1f5f9)',
            color: filtroSeleccionado === 'ia' ? '#ffffff' : 'var(--texto-secundario, #475569)',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <Bot style={{ width: '13px', height: '13px' }} />
          <span>Atendido IA</span>
          {conteos.ia > 0 && (
            <span
              style={{
                background: filtroSeleccionado === 'ia' ? 'rgba(255, 255, 255, 0.28)' : 'rgba(16, 185, 129, 0.2)',
                color: filtroSeleccionado === 'ia' ? '#ffffff' : '#10b981',
                fontSize: '0.66rem',
                fontWeight: 700,
                padding: '0 5px',
                borderRadius: '9999px',
                minWidth: '16px',
                height: '16px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {conteos.ia}
            </span>
          )}
        </button>
      </div>

      {/* 3. Listado de Conversaciones */}
      <div id="contenedor-lista-conversaciones" className="lista-conversaciones">
        {cargando ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--texto-atenuado)', fontSize: '0.85rem' }}>
            Cargando conversaciones...
          </div>
        ) : conversacionesFiltradas.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--texto-atenuado)', fontSize: '0.85rem' }}>
            No se encontraron conversaciones
          </div>
        ) : (
          conversacionesFiltradas.map((conv) => {
            const esActiva = conv.id === conversacionActivaId;
            const iniciales = (conv.contacto_nombre || 'P').substring(0, 2).toUpperCase();

            const enVentana24h = conv.ultimo_mensaje_entrante_en
              ? (Date.now() - new Date(conv.ultimo_mensaje_entrante_en).getTime()) < 24 * 60 * 60 * 1000
              : false;

            const esUrgente = Boolean(conv.requiere_asesor_humano);

            return (
              <div
                key={conv.id}
                className={`tarjeta-conversacion-item ${esActiva ? 'activa' : ''} ${esUrgente ? 'requiere-humano-urgente' : ''}`}
                onClick={() => alSeleccionarConversacion(conv)}
                style={{
                  borderLeft: esUrgente ? '3.5px solid #ef4444' : undefined,
                  background: esUrgente && !esActiva ? 'rgba(239, 68, 68, 0.03)' : undefined,
                }}
              >
                <div
                  className="avatar-contacto"
                  style={{
                    background: esUrgente ? '#ef4444' : undefined,
                    color: esUrgente ? '#ffffff' : undefined,
                  }}
                >
                  {iniciales}
                </div>
                <div className="info-conversacion">
                  <div className="fila-nombre-hora">
                    <span
                      className="nombre-paciente-chat"
                      style={{
                        fontWeight: conv.no_leido || (conv.mensajes_no_leidos && conv.mensajes_no_leidos > 0) ? 700 : 500,
                        color: esUrgente ? '#ef4444' : undefined,
                      }}
                    >
                      {conv.contacto_nombre
                        ? (/^\+?\d{8,15}$/.test(conv.contacto_nombre.trim())
                          ? formatearTelefono(conv.contacto_nombre)
                          : conv.contacto_nombre)
                        : 'Contacto'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="hora-chat">
                        {formatearFechaRelativa(conv.ultimo_mensaje_fecha || conv.actualizado_en)}
                      </span>
                      {Boolean(conv.no_leido || (conv.mensajes_no_leidos && conv.mensajes_no_leidos > 0)) && (
                        <span
                          style={{
                            minWidth: '18px',
                            height: '18px',
                            borderRadius: '9999px',
                            background: esUrgente ? '#ef4444' : 'var(--color-primario, #0284c7)',
                            color: '#ffffff',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 4px',
                          }}
                        >
                          {conv.mensajes_no_leidos && conv.mensajes_no_leidos > 1 ? conv.mensajes_no_leidos : '1'}
                        </span>
                      )}
                    </div>
                  </div>

                  {conv.contacto_telefono && conv.contacto_telefono !== conv.contacto_nombre && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: esUrgente ? '#ef4444' : 'var(--color-primario)', fontWeight: 500, margin: '1px 0' }}>
                      <Phone style={{ width: '10px', height: '10px' }} />
                      <span>{formatearTelefono(conv.contacto_telefono)}</span>
                    </div>
                  )}

                  <div
                    className="ultimo-mensaje-chat"
                    style={{
                      fontWeight: conv.no_leido || (conv.mensajes_no_leidos && conv.mensajes_no_leidos > 0) ? 600 : 400,
                      color: conv.no_leido || (conv.mensajes_no_leidos && conv.mensajes_no_leidos > 0) ? 'var(--texto-principal)' : 'var(--texto-atenuado)',
                    }}
                  >
                    {formatearUltimoMensaje(conv.ultimo_mensaje_texto)}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                    {/* Badge Requiere Asesor */}
                    {esUrgente && (
                      <span
                        className="badge-urgente-asesor"
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          background: 'rgba(239, 68, 68, 0.14)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <AlertCircle style={{ width: '11px', height: '11px' }} />
                        Requiere Asesor
                      </span>
                    )}

                    {/* Badge Atendido por IA */}
                    {Boolean(conv.atendido_por_ia) && !esUrgente && (
                      <span
                        className="badge-atendido-ia"
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: '9999px',
                          background: 'rgba(16, 185, 129, 0.12)',
                          color: '#10b981',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <Bot style={{ width: '10px', height: '10px' }} />
                        IA
                      </span>
                    )}

                    {enVentana24h ? (
                      <span className="badge-24h activa">● 24h Activa</span>
                    ) : (
                      <span className="badge-24h expirada">⚠️ 24h Expirada</span>
                    )}

                    {Boolean(conv.no_leido || (conv.mensajes_no_leidos && conv.mensajes_no_leidos > 0)) && (
                      <span
                        className="badge-sin-leer"
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '9999px',
                          background: esUrgente ? 'rgba(239, 68, 68, 0.12)' : 'rgba(2, 132, 199, 0.12)',
                          color: esUrgente ? '#ef4444' : 'var(--color-primario, #0284c7)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        ● No leído
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
