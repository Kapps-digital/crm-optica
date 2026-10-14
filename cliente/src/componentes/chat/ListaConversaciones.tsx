'use client';

import React, { useState } from 'react';
import { Search, Phone } from 'lucide-react';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';
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
  alSincronizar,
  sincronizando = false,
}) => {
  const [busqueda, setBusqueda] = useState('');

  const normalizar = (t: string) =>
    t
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const conversacionesFiltradas = conversaciones.filter((c) => {
    const termino = normalizar(busqueda);
    if (!termino) return true;
    const nombre = normalizar(c.contacto_nombre || '');
    const telefono = normalizar(c.contacto_telefono || '');
    const ultimoMsg = normalizar(c.ultimo_mensaje_texto || '');
    return nombre.includes(termino) || telefono.includes(termino) || ultimoMsg.includes(termino);
  });

  return (
    <div className="columna-conversaciones">
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

            return (
              <div
                key={conv.id}
                className={`tarjeta-conversacion-item ${esActiva ? 'activa' : ''}`}
                onClick={() => alSeleccionarConversacion(conv)}
              >
                <div className="avatar-contacto">{iniciales}</div>
                <div className="info-conversacion">
                  <div className="fila-nombre-hora">
                    <span
                      className="nombre-paciente-chat"
                      style={{
                        fontWeight: conv.no_leido || (conv.mensajes_no_leidos && conv.mensajes_no_leidos > 0) ? 700 : 500,
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
                            background: 'var(--color-primario, #0284c7)',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--color-primario)', fontWeight: 500, margin: '1px 0' }}>
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
                          background: 'rgba(2, 132, 199, 0.12)',
                          color: 'var(--color-primario, #0284c7)',
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
