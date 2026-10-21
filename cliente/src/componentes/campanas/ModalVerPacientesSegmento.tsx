'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Search,
  MessageSquare,
  Eye,
  Calendar,
  Phone,
  FileText,
  Clock,
} from 'lucide-react';
import type { Segmento, PacienteSegmento } from '@/tipos/crm';
import { obtenerPacientesSegmento } from '@/servicios/api_crm';
import { formatearTelefono, obtenerNombrePaciente } from '@/utilidades/formato';
import { FiltroBusqueda } from '../comunes/FiltroBusqueda';

interface PropiedadesModalVerPacientesSegmento {
  abierto: boolean;
  segmento: Segmento | null;
  alCerrar: () => void;
  alSeleccionarContactoChat?: (contactoId: number) => void;
}

export const ModalVerPacientesSegmento: React.FC<PropiedadesModalVerPacientesSegmento> = ({
  abierto,
  segmento,
  alCerrar,
  alSeleccionarContactoChat,
}) => {
  const [pacientes, setPacientes] = useState<PacienteSegmento[]>([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto || !segmento) {
      setPacientes([]);
      setBusqueda('');
      setError(null);
      return;
    }

    let montado = true;
    setCargando(true);
    setError(null);

    obtenerPacientesSegmento(segmento.id)
      .then((res) => {
        if (!montado) return;
        if (res.error) {
          setError(res.error);
        } else {
          setPacientes(res.pacientes);
        }
      })
      .catch((err) => {
        if (!montado) return;
        setError(err.message || 'Error cargando pacientes');
      })
      .finally(() => {
        if (montado) setCargando(false);
      });

    return () => {
      montado = false;
    };
  }, [abierto, segmento]);

  if (!abierto || !segmento) return null;

  const pacientesFiltrados = pacientes.filter((p) => {
    if (!busqueda.trim()) return true;
    const term = busqueda.toLowerCase().trim();
    const nombre = (p.nombre_completo || p.nombre || '').toLowerCase();
    const tel = (p.telefono || '').toLowerCase();
    const doc = (p.cedula || p.documento || '').toLowerCase();
    const lente = (p.tipo_lente || '').toLowerCase();
    const sexo = (p.sexo || '').toLowerCase();
    return nombre.includes(term) || tel.includes(term) || doc.includes(term) || lente.includes(term) || sexo.includes(term);
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--fondo-tarjeta)',
          border: '1px solid var(--borde-tarjeta)',
          borderRadius: 'var(--radio-lg)',
          width: '100%',
          maxWidth: '900px',
          height: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--sombra-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: '1.2rem 1.5rem',
            borderBottom: '1px solid var(--borde-tarjeta)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--fondo-elevado)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: segmento.color || '#0284c7',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: 'var(--texto-principal)',
                    margin: 0,
                  }}
                >
                  {segmento.nombre}
                </h2>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    backgroundColor: segmento.es_sistema ? 'var(--fondo-base)' : 'rgba(2, 132, 199, 0.15)',
                    color: segmento.es_sistema ? 'var(--texto-atenuado)' : 'var(--color-primario-claro)',
                    border: '1px solid var(--borde-tarjeta)',
                  }}
                >
                  {segmento.es_sistema ? 'SISTEMA' : 'PERSONALIZADO'}
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--texto-atenuado)', margin: '0.15rem 0 0 0' }}>
                {segmento.descripcion || 'Pacientes que cumplen este criterio clínico.'}
              </p>
            </div>
          </div>
          <button
            onClick={alCerrar}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--texto-atenuado)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Barra de Filtro y Conteo */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            borderBottom: '1px solid var(--borde-tarjeta)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <FiltroBusqueda
            valor={busqueda}
            alCambiar={setBusqueda}
            placeholder="Buscar por nombre, cédula, teléfono..."
            flex="1"
            anchoMaximo="360px"
          />

          <div style={{ fontSize: '0.8rem', color: 'var(--texto-secundario)', fontWeight: 600 }}>
            {cargando ? (
              'Calculando pacientes...'
            ) : (
              <span>
                Total calificados:{' '}
                <strong style={{ color: segmento.color || 'var(--color-primario-claro)' }}>
                  {pacientesFiltrados.length}
                </strong>{' '}
                pacientes
              </span>
            )}
          </div>
        </div>

        {/* Tabla de Pacientes */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1.5rem 1.5rem 1.5rem' }}>
          {error && (
            <div
              style={{
                padding: '1rem',
                backgroundColor: 'var(--color-peligro-rojo-suave)',
                color: 'var(--color-peligro-rojo)',
                borderRadius: 'var(--radio-md)',
                fontSize: '0.85rem',
                marginTop: '1rem',
              }}
            >
              {error}
            </div>
          )}

          {cargando ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '240px',
                color: 'var(--texto-atenuado)',
                gap: '0.5rem',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  border: '3px solid var(--borde-tarjeta)',
                  borderTopColor: segmento.color || '#0284c7',
                  borderRadius: '50%',
                  animation: 'girar 1s linear infinite',
                }}
              />
              <span style={{ fontSize: '0.82rem' }}>Consultando pacientes en base de datos...</span>
            </div>
          ) : pacientesFiltrados.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '240px',
                color: 'var(--texto-atenuado)',
                textAlign: 'center',
              }}
            >
              <Users size={36} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--texto-principal)', margin: 0 }}>
                No se encontraron pacientes para este segmento
              </p>
              <p style={{ fontSize: '0.78rem', margin: '0.25rem 0 0 0' }}>
                Ningún paciente cumple los criterios actualmente o coincide con la búsqueda.
              </p>
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.8rem',
                textAlign: 'left',
                marginTop: '0.5rem',
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '1px solid var(--borde-tarjeta)',
                    color: 'var(--texto-atenuado)',
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  <th style={{ padding: '0.65rem 0.5rem' }}>Paciente</th>
                  <th style={{ padding: '0.65rem 0.5rem' }}>Contacto</th>
                  <th style={{ padding: '0.65rem 0.5rem' }}>Edad</th>
                  <th style={{ padding: '0.65rem 0.5rem' }}>Última Fórmula / Lente</th>
                  <th style={{ padding: '0.65rem 0.5rem' }}>Graduación (OD / OI)</th>
                  <th style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {pacientesFiltrados.map((p) => {
                  const nombre = obtenerNombrePaciente(p);
                  const doc = p.cedula || p.documento || '-';
                  const od = [p.od_esfera, p.od_cilindro].filter(Boolean).join(' / ') || '-';
                  const oi = [p.oi_esfera, p.oi_cilindro].filter(Boolean).join(' / ') || '-';
                  const tieneAdicion = p.od_adicion || p.oi_adicion;

                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid var(--borde-tarjeta)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--fondo-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--texto-principal)' }}>{nombre}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--texto-atenuado)' }}>Doc: {doc}</div>
                      </td>

                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--texto-principal)' }}>
                          <Phone size={12} style={{ color: 'var(--color-exito)' }} />
                          <span>{p.telefono ? formatearTelefono(p.telefono) : 'Sin teléfono'}</span>
                        </div>
                        {p.correo && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--texto-atenuado)' }}>{p.correo}</div>
                        )}
                      </td>

                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        <div style={{ color: 'var(--texto-principal)', fontWeight: 500 }}>
                          {p.edad ? `${p.edad} años` : 'N/D'}
                        </div>
                        {p.sexo && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--texto-atenuado)', textTransform: 'capitalize' }}>
                            {p.sexo}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        <div style={{ fontWeight: 500, color: 'var(--texto-principal)' }}>
                          {p.tipo_lente || 'Sin lente especificado'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--texto-atenuado)' }}>
                          Examen: {p.fecha_examen || 'Sin registro'}
                        </div>
                      </td>

                      <td style={{ padding: '0.65rem 0.5rem' }}>
                        <div style={{ fontSize: '0.73rem', color: 'var(--texto-secundario)' }}>
                          <span>OD: {od}</span>
                        </div>
                        <div style={{ fontSize: '0.73rem', color: 'var(--texto-secundario)' }}>
                          <span>OI: {oi}</span>
                          {tieneAdicion && (
                            <span style={{ marginLeft: '4px', color: 'var(--color-primario-claro)', fontWeight: 600 }}>
                              (Add {p.od_adicion || p.oi_adicion})
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>
                        {alSeleccionarContactoChat && (
                          <button
                            onClick={() => {
                              alSeleccionarContactoChat(p.id);
                              alCerrar();
                            }}
                            title="Abrir conversación en WhatsApp"
                            style={{
                              padding: '0.35rem 0.65rem',
                              backgroundColor: 'rgba(16, 185, 129, 0.1)',
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                              borderRadius: '6px',
                              color: 'var(--color-exito)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                          >
                            <MessageSquare size={13} />
                            <span>Chat</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
