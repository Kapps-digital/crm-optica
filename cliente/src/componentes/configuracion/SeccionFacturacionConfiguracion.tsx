'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Lock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Users,
  Check,
} from 'lucide-react';
import {
  obtenerConfiguracionFacturacionApi,
  guardarConfiguracionFacturacionApi,
  obtenerVendedoresApi,
  crearVendedorApi,
  cambiarEstadoVendedorApi,
  type ConfiguracionFacturacion,
  type Vendedor,
} from '@/servicios/api_crm';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';

interface PropiedadesSeccionFacturacion {
  opticaId?: number;
}

export const SeccionFacturacionConfiguracion: React.FC<PropiedadesSeccionFacturacion> = ({
  opticaId,
}) => {
  const [config, setConfig] = useState<ConfiguracionFacturacion>({
    exito: true,
    prefijo: 'FAC-',
    siguiente_numero: 1,
    proxima_factura: 'FAC-0001',
    bloqueado: false,
    total_ventas: 0,
  });

  const [prefijoInput, setPrefijoInput] = useState('FAC-');
  const [numeroInicialInput, setNumeroInicialInput] = useState('1');
  const [cargandoConfig, setCargandoConfig] = useState(true);
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  // Vendedores
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [cargandoVendedores, setCargandoVendedores] = useState(true);
  const [nuevoVendedorNombre, setNuevoVendedorNombre] = useState('');
  const [creandoVendedor, setCreandoVendedor] = useState(false);
  const [vendedorCambiandoId, setVendedorCambiandoId] = useState<number | null>(null);

  // Vendedores ordenados alfabéticamente de la A a la Z
  const vendedoresOrdenados = useMemo(() => {
    return [...vendedores].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
    );
  }, [vendedores]);

  const cargarConfiguracion = async () => {
    setCargandoConfig(true);
    try {
      const res = await obtenerConfiguracionFacturacionApi();
      if (res && res.exito) {
        setConfig(res);
        setPrefijoInput(res.prefijo || 'FAC-');
        setNumeroInicialInput(String(res.siguiente_numero || 1));
      }
    } catch {
      // Silencioso
    } finally {
      setCargandoConfig(false);
    }
  };

  const cargarVendedores = async () => {
    setCargandoVendedores(true);
    try {
      const res = await obtenerVendedoresApi(true);
      if (res.exito && res.vendedores) {
        setVendedores(res.vendedores);
      }
    } catch {
      // Silencioso
    } finally {
      setCargandoVendedores(false);
    }
  };

  useEffect(() => {
    cargarConfiguracion();
    cargarVendedores();
  }, [opticaId]);

  const vistaPreviaFactura = useMemo(() => {
    const num = Math.max(1, parseInt(numeroInicialInput, 10) || 1);
    const pref = prefijoInput.trim();
    return `${pref}${String(num).padStart(4, '0')}`;
  }, [prefijoInput, numeroInicialInput]);

  const manejarGuardarConfiguracion = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeExito(null);
    setMensajeError(null);

    const num = Math.max(1, parseInt(numeroInicialInput, 10) || 1);
    setGuardandoConfig(true);

    try {
      const res = await guardarConfiguracionFacturacionApi({
        prefijo: prefijoInput.trim(),
        siguiente_numero: num,
      });

      if (res.exito) {
        setMensajeExito('Consecutivo guardado correctamente.');
        setTimeout(() => setMensajeExito(null), 3500);
        await cargarConfiguracion();
      } else {
        setMensajeError(res.error || 'No se pudo guardar la configuración');
      }
    } catch (err: any) {
      setMensajeError(err.message || 'Error de conexión');
    } finally {
      setGuardandoConfig(false);
    }
  };

  const manejarCrearVendedor = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombre = nuevoVendedorNombre.trim();
    if (!nombre) return;

    setCreandoVendedor(true);
    try {
      const res = await crearVendedorApi(nombre);
      if (res.exito && res.vendedor) {
        setNuevoVendedorNombre('');
        await cargarVendedores();
      } else {
        alert(res.error || 'No fue posible registrar el vendedor');
      }
    } catch {
      alert('Error de conexión al crear vendedor');
    } finally {
      setCreandoVendedor(false);
    }
  };

  const ejecutarCambioEstadoVendedor = async (vendedor: Vendedor) => {
    if (vendedorCambiandoId === vendedor.id) return;
    setVendedorCambiandoId(vendedor.id);
    setMensajeExito(null);
    setMensajeError(null);
    try {
      const nuevoEstado = !vendedor.activo;
      const res = await cambiarEstadoVendedorApi(vendedor.id, nuevoEstado);
      if (res.exito) {
        await cargarVendedores();
        setMensajeExito(
          nuevoEstado
            ? `Vendedor "${vendedor.nombre}" activado correctamente.`
            : `Vendedor "${vendedor.nombre}" desactivado correctamente.`
        );
        setTimeout(() => setMensajeExito(null), 3000);
      } else {
        setMensajeError(res.error || 'No fue posible actualizar el vendedor');
      }
    } catch {
      setMensajeError('Error de conexión al actualizar vendedor');
    } finally {
      setVendedorCambiandoId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Alertas */}
      {mensajeExito && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: 'var(--radio-md, 8px)',
            padding: '0.65rem 0.95rem',
            color: '#10b981',
            fontSize: '0.80rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{mensajeExito}</span>
        </div>
      )}

      {mensajeError && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: 'var(--radio-md, 8px)',
            padding: '0.65rem 0.95rem',
            color: '#ef4444',
            fontSize: '0.80rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={16} />
          <span>{mensajeError}</span>
        </div>
      )}

      {/* Tarjeta 1: Consecutivo de Facturación */}
      <div
        style={{
          background: 'var(--fondo-tarjeta)',
          border: '1px solid var(--borde-tarjeta)',
          borderRadius: 'var(--radio-lg, 12px)',
          padding: '1.15rem 1.35rem',
          boxShadow: 'var(--sombra-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--borde-tarjeta)',
            paddingBottom: '0.65rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)',
                color: 'var(--color-primario)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Receipt size={17} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 700, color: 'var(--texto-principal)' }}>
                Numeración Consecutiva de Facturas
              </h3>
              <p style={{ margin: 0, fontSize: '0.73rem', color: 'var(--texto-atenuado)' }}>
                Configuración del prefijo y número inicial con formato de 4 dígitos mínimos (ej: <code>FAC-0001</code>).
              </p>
            </div>
          </div>

          {config.bloqueado && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.70rem',
                fontWeight: 700,
                color: 'var(--color-primario)',
                background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.1)',
                border: '1px solid rgba(var(--color-primario-rgb, 2, 132, 199), 0.25)',
                padding: '0.2rem 0.55rem',
                borderRadius: '6px',
              }}
            >
              <Lock size={12} /> Consecutivo Fijo ({config.total_ventas} ventas)
            </span>
          )}
        </div>

        <form noValidate onSubmit={manejarGuardarConfiguracion} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            {/* Prefijo */}
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--texto-principal)', marginBottom: '0.3rem' }}>
                Prefijo
              </label>
              <input
                type="text"
                value={prefijoInput}
                onChange={(e) => setPrefijoInput(e.target.value.toUpperCase())}
                disabled={config.bloqueado || cargandoConfig}
                placeholder="FAC-"
                style={{
                  width: '100%',
                  height: '34px',
                  padding: '0 0.65rem',
                  borderRadius: 'var(--radio-sm, 6px)',
                  border: '1px solid var(--borde-tarjeta)',
                  background: config.bloqueado ? 'var(--fondo-elevado)' : 'var(--fondo-tarjeta)',
                  color: 'var(--texto-principal)',
                  fontWeight: 600,
                  fontSize: '0.80rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Siguiente Número */}
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--texto-principal)', marginBottom: '0.3rem' }}>
                {config.bloqueado ? 'Próximo Número' : 'Número Inicial'}
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={numeroInicialInput}
                onChange={(e) => setNumeroInicialInput(e.target.value)}
                disabled={config.bloqueado || cargandoConfig}
                placeholder="1"
                style={{
                  width: '100%',
                  height: '34px',
                  padding: '0 0.65rem',
                  borderRadius: 'var(--radio-sm, 6px)',
                  border: '1px solid var(--borde-tarjeta)',
                  background: config.bloqueado ? 'var(--fondo-elevado)' : 'var(--fondo-tarjeta)',
                  color: 'var(--texto-principal)',
                  fontWeight: 600,
                  fontSize: '0.80rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Vista Previa */}
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: 'var(--texto-principal)', marginBottom: '0.3rem' }}>
                Vista Previa
              </label>
              <div
                style={{
                  height: '34px',
                  padding: '0 0.85rem',
                  borderRadius: 'var(--radio-sm, 6px)',
                  background: 'var(--fondo-elevado)',
                  border: '1px dashed var(--borde-tarjeta)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ fontSize: '0.70rem', color: 'var(--texto-atenuado)', fontWeight: 600 }}>FORMATO:</span>
                <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--color-primario)' }}>
                  {vistaPreviaFactura}
                </span>
              </div>
            </div>
          </div>

          {!config.bloqueado && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              <button
                type="submit"
                disabled={guardandoConfig || cargandoConfig}
                style={{
                  height: '32px',
                  padding: '0 0.85rem',
                  borderRadius: 'var(--radio-md, 8px)',
                  border: 'none',
                  background: 'var(--color-primario)',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: guardandoConfig ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  boxShadow: '0 1px 4px rgba(2, 132, 199, 0.2)',
                }}
              >
                <Check size={14} />
                <span>{guardandoConfig ? 'Guardando...' : 'Guardar Consecutivo'}</span>
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Tarjeta 2: Equipo de Vendedores de la Óptica */}
      <div
        style={{
          background: 'var(--fondo-tarjeta)',
          border: '1px solid var(--borde-tarjeta)',
          borderRadius: 'var(--radio-lg, 12px)',
          padding: '1.15rem 1.35rem',
          boxShadow: 'var(--sombra-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--borde-tarjeta)',
            paddingBottom: '0.65rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)',
                color: 'var(--color-primario)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={17} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.94rem', fontWeight: 700, color: 'var(--texto-principal)' }}>
                Equipo de Vendedores
              </h3>
              <p style={{ margin: 0, fontSize: '0.73rem', color: 'var(--texto-atenuado)' }}>
                Vendedores exclusivos de esta óptica para asignación en el módulo de ventas.
              </p>
            </div>
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--texto-atenuado)', fontWeight: 600 }}>
            {vendedores.filter((v) => v.activo).length} activos
          </span>
        </div>

        {/* Formulario rápido para agregar vendedor */}
        <form noValidate onSubmit={manejarCrearVendedor} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Nombre del nuevo vendedor (ej: Carlos Gómez)..."
            value={nuevoVendedorNombre}
            onChange={(e) => setNuevoVendedorNombre(e.target.value)}
            disabled={creandoVendedor}
            style={{
              flex: 1,
              height: '34px',
              padding: '0 0.75rem',
              borderRadius: 'var(--radio-sm, 6px)',
              border: '1px solid var(--borde-tarjeta)',
              background: 'var(--fondo-elevado)',
              color: 'var(--texto-principal)',
              fontSize: '0.80rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            disabled={creandoVendedor || !nuevoVendedorNombre.trim()}
            style={{
              height: '34px',
              padding: '0 0.85rem',
              borderRadius: 'var(--radio-md, 8px)',
              border: 'none',
              background: 'var(--color-primario)',
              color: '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: creandoVendedor || !nuevoVendedorNombre.trim() ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              opacity: !nuevoVendedorNombre.trim() ? 0.6 : 1,
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 4px rgba(2, 132, 199, 0.2)',
            }}
          >
            <Plus size={14} />
            <span>{creandoVendedor ? 'Creando...' : 'Agregar Vendedor'}</span>
          </button>
        </form>

        {/* Lista compacta de vendedores */}
        <div style={{ border: '1px solid var(--borde-tarjeta)', borderRadius: 'var(--radio-md, 8px)', overflow: 'hidden' }}>
          {cargandoVendedores ? (
            <div style={{ padding: '1.25rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--texto-atenuado)' }}>
              Cargando vendedores...
            </div>
          ) : vendedores.length === 0 ? (
            <div style={{ padding: '1.25rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--texto-atenuado)' }}>
              No hay vendedores registrados aún en esta óptica.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.80rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--fondo-elevado)', borderBottom: '1px solid var(--borde-tarjeta)', color: 'var(--texto-atenuado)', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase' }}>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Nombre</th>
                  <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', width: '130px' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {vendedoresOrdenados.map((v) => {
                  const estaCambiando = vendedorCambiandoId === v.id;
                  return (
                    <tr key={v.id} style={{ borderBottom: '1px solid var(--borde-tarjeta)', opacity: v.activo ? 1 : 0.65 }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: 'var(--texto-principal)' }}>
                        {v.nombre}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>
                        <EtiquetaTooltip texto={v.activo ? 'Clic para desactivar' : 'Clic para activar'} posicion="arriba">
                          <button
                            type="button"
                            onClick={() => ejecutarCambioEstadoVendedor(v)}
                            disabled={estaCambiando}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              fontSize: '0.70rem',
                              fontWeight: 700,
                              padding: '0.22rem 0.65rem',
                              borderRadius: '9999px',
                              border: v.activo ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--borde-tarjeta)',
                              background: v.activo ? 'rgba(16, 185, 129, 0.12)' : 'var(--fondo-elevado)',
                              color: v.activo ? '#10b981' : 'var(--texto-atenuado)',
                              cursor: estaCambiando ? 'wait' : 'pointer',
                              transition: 'all 0.15s ease',
                              outline: 'none',
                              opacity: estaCambiando ? 0.6 : 1,
                            }}
                            onMouseEnter={(e) => {
                              if (estaCambiando) return;
                              if (v.activo) {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                                e.currentTarget.style.color = '#ef4444';
                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
                              } else {
                                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
                                e.currentTarget.style.color = '#10b981';
                                e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.35)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (estaCambiando) return;
                              e.currentTarget.style.background = v.activo ? 'rgba(16, 185, 129, 0.12)' : 'var(--fondo-elevado)';
                              e.currentTarget.style.color = v.activo ? '#10b981' : 'var(--texto-atenuado)';
                              e.currentTarget.style.borderColor = v.activo ? 'rgba(16, 185, 129, 0.35)' : 'var(--borde-tarjeta)';
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: v.activo ? '#10b981' : 'var(--texto-atenuado)',
                                display: 'inline-block',
                              }}
                            />
                            <span>{estaCambiando ? 'Actualizando...' : v.activo ? 'Activo' : 'Inactivo'}</span>
                          </button>
                        </EtiquetaTooltip>
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
