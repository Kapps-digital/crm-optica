'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, DollarSign, CheckCircle2, AlertCircle, Plus, Trash2, Receipt } from 'lucide-react';
import {
  formatearMonedaCop,
  formatearSeparadorMiles,
  limpiarNumeroMoneda,
} from '@/utilidades/formato';
import { actualizarAbonosVentaApi, type Venta } from '@/servicios/api_crm';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';

interface PropiedadesModalEditarAbonos {
  abierto: boolean;
  venta: Venta | null;
  alCerrar: () => void;
  alGuardado: () => void;
}

export const ModalEditarAbonos: React.FC<PropiedadesModalEditarAbonos> = ({
  abierto,
  venta,
  alCerrar,
  alGuardado,
}) => {
  const [abonoInicialTexto, setAbonoInicialTexto] = useState('');
  const [abono2Texto, setAbono2Texto] = useState('');
  const [abono3Texto, setAbono3Texto] = useState('');
  const [mostrarAbono2, setMostrarAbono2] = useState(false);
  const [mostrarAbono3, setMostrarAbono3] = useState(false);
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);

  useEffect(() => {
    if (!venta) return;
    setErrorValidacion(null);
    setAbonoInicialTexto(venta.abono_inicial > 0 ? String(venta.abono_inicial) : '');

    const tieneAbono2 = (venta.abono_2 || 0) > 0;
    setMostrarAbono2(tieneAbono2);
    setAbono2Texto(tieneAbono2 ? String(venta.abono_2) : '');

    const tieneAbono3 = (venta.abono_3 || 0) > 0;
    setMostrarAbono3(tieneAbono3);
    setAbono3Texto(tieneAbono3 ? String(venta.abono_3) : '');

    setNotas(venta.notas || '');
  }, [venta]);

  const valorProductoNum = venta ? Number(venta.valor_producto) : 0;
  const abonoInicialNum = useMemo(() => limpiarNumeroMoneda(abonoInicialTexto), [abonoInicialTexto]);
  const abono2Num = useMemo(() => (mostrarAbono2 ? limpiarNumeroMoneda(abono2Texto) : 0), [mostrarAbono2, abono2Texto]);
  const abono3Num = useMemo(() => (mostrarAbono3 ? limpiarNumeroMoneda(abono3Texto) : 0), [mostrarAbono3, abono3Texto]);

  const totalAbonosNum = useMemo(() => {
    return abonoInicialNum + abono2Num + abono3Num;
  }, [abonoInicialNum, abono2Num, abono3Num]);

  const saldoPendienteNum = useMemo(() => {
    return Math.max(0, valorProductoNum - totalAbonosNum);
  }, [valorProductoNum, totalAbonosNum]);

  const manejarGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venta) return;
    setErrorValidacion(null);

    if (totalAbonosNum > valorProductoNum) {
      setErrorValidacion('El total de abonos no puede ser superior al valor del producto.');
      return;
    }

    setGuardando(true);
    try {
      const res = await actualizarAbonosVentaApi(venta.id, {
        abono_inicial: abonoInicialNum,
        abono_2: mostrarAbono2 ? abono2Num : 0,
        abono_3: mostrarAbono3 ? abono3Num : 0,
        notas: notas.trim() || undefined,
      });

      if (res.exito) {
        alGuardado();
        alCerrar();
      } else {
        setErrorValidacion(res.error || 'No se pudo actualizar los abonos');
      }
    } catch (err: any) {
      setErrorValidacion(err.message || 'Error de conexión');
    } finally {
      setGuardando(false);
    }
  };

  if (!abierto || !venta) return null;

  return (
    <div
      className="modal-backdrop-premium"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1060,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="modal-tarjeta-premium"
        style={{
          background: 'var(--fondo-tarjeta, #ffffff)',
          color: 'var(--texto-principal, #0f172a)',
          width: '100%',
          maxWidth: '540px',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--borde-tarjeta, #e2e8f0)',
          overflow: 'hidden',
          animation: 'fadeInModal 0.2s ease-out',
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: '1.15rem 1.5rem',
            borderBottom: '1px solid var(--borde-tarjeta, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--fondo-elevado, #f8fafc)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: 'rgba(2, 132, 199, 0.12)',
                color: 'var(--color-primario, #0284c7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Receipt size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
                Gestión de Abonos • Factura {venta.numero_factura}
              </h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--texto-secundario, #64748b)', margin: 0, marginTop: '2px' }}>
                Cliente: <strong>{venta.nombre_cliente}</strong> • {venta.producto}
              </p>
            </div>
          </div>

          <EtiquetaTooltip texto="Cerrar ventana" posicion="abajo">
            <button
              type="button"
              onClick={alCerrar}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--texto-secundario, #64748b)',
                cursor: 'pointer',
                padding: '0.35rem',
                borderRadius: '6px',
              }}
              aria-label="Cerrar modal"
            >
              <X size={18} />
            </button>
          </EtiquetaTooltip>
        </div>

        {/* Formulario */}
        <form noValidate onSubmit={manejarGuardar} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {errorValidacion && (
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#dc2626',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <AlertCircle size={15} />
                <span>{errorValidacion}</span>
              </div>
            )}

            {/* Ficha Resumen de la Venta */}
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                background: 'var(--fondo-elevado, #f1f5f9)',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.84rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--texto-secundario, #64748b)', fontSize: '0.72rem', display: 'block' }}>VALOR TOTAL PRODUCTO</span>
                <strong style={{ fontSize: '1rem' }}>{formatearMonedaCop(valorProductoNum)}</strong>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: 'var(--texto-secundario, #64748b)', fontSize: '0.72rem', display: 'block' }}>VENDEDOR</span>
                <strong>{venta.nombre_vendedor}</strong>
              </div>
            </div>

            {/* Abono 1 (Inicial) */}
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Abono Inicial (Abono 1)
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="$ 0"
                  value={abonoInicialTexto ? `$ ${formatearSeparadorMiles(abonoInicialTexto)}` : ''}
                  onChange={(e) => {
                    const digitos = e.target.value.replace(/\D/g, '');
                    setAbonoInicialTexto(digitos);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--borde-tarjeta, #cbd5e1)',
                    background: 'var(--fondo-tarjeta, #ffffff)',
                    color: 'var(--texto-principal, #1e293b)',
                    fontWeight: 600,
                  }}
                />
              </div>
            </div>

            {/* Abono 2 */}
            {mostrarAbono2 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Segundo Abono (Abono 2)
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="$ 0"
                      value={abono2Texto ? `$ ${formatearSeparadorMiles(abono2Texto)}` : ''}
                      onChange={(e) => {
                        const digitos = e.target.value.replace(/\D/g, '');
                        setAbono2Texto(digitos);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--borde-tarjeta, #cbd5e1)',
                        background: 'var(--fondo-tarjeta, #ffffff)',
                        color: 'var(--texto-principal, #1e293b)',
                        fontWeight: 600,
                      }}
                    />
                  </div>
                </div>
                <EtiquetaTooltip texto="Eliminar segundo abono" posicion="arriba">
                  <button
                    type="button"
                    onClick={() => {
                      setAbono2Texto('');
                      setMostrarAbono2(false);
                      if (mostrarAbono3) {
                        setAbono3Texto('');
                        setMostrarAbono3(false);
                      }
                    }}
                    style={{
                      marginTop: '1.25rem',
                      padding: '0.55rem',
                      borderRadius: '8px',
                      border: '1px solid #fecaca',
                      background: '#fef2f2',
                      color: '#ef4444',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </EtiquetaTooltip>
              </div>
            )}

            {/* Abono 3 */}
            {mostrarAbono3 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Tercer Abono (Abono 3)
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="$ 0"
                      value={abono3Texto ? `$ ${formatearSeparadorMiles(abono3Texto)}` : ''}
                      onChange={(e) => {
                        const digitos = e.target.value.replace(/\D/g, '');
                        setAbono3Texto(digitos);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.55rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--borde-tarjeta, #cbd5e1)',
                        background: 'var(--fondo-tarjeta, #ffffff)',
                        color: 'var(--texto-principal, #1e293b)',
                        fontWeight: 600,
                      }}
                    />
                  </div>
                </div>
                <EtiquetaTooltip texto="Eliminar tercer abono" posicion="arriba">
                  <button
                    type="button"
                    onClick={() => {
                      setAbono3Texto('');
                      setMostrarAbono3(false);
                    }}
                    style={{
                      marginTop: '1.25rem',
                      padding: '0.55rem',
                      borderRadius: '8px',
                      border: '1px solid #fecaca',
                      background: '#fef2f2',
                      color: '#ef4444',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </EtiquetaTooltip>
              </div>
            )}

            {/* Botón Añadir más abonos */}
            {(!mostrarAbono2 || !mostrarAbono3) && (
              <button
                type="button"
                onClick={() => {
                  if (!mostrarAbono2) setMostrarAbono2(true);
                  else if (!mostrarAbono3) setMostrarAbono3(true);
                }}
                style={{
                  alignSelf: 'flex-start',
                  background: 'transparent',
                  border: '1px dashed var(--color-primario, #0284c7)',
                  color: 'var(--color-primario, #0284c7)',
                  borderRadius: '8px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <Plus size={14} />
                <span>{!mostrarAbono2 ? 'Registrar Abono 2' : 'Registrar Abono 3'}</span>
              </button>
            )}

            {/* Recalculo en tiempo real */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                padding: '0.85rem 1rem',
                borderRadius: '8px',
                background: 'var(--fondo-elevado, #f1f5f9)',
                border: '1px solid var(--borde-tarjeta, #cbd5e1)',
              }}
            >
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--texto-secundario, #64748b)', fontWeight: 600 }}>NUEVO TOTAL ABONOS</span>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
                  {formatearMonedaCop(totalAbonosNum)}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--texto-secundario, #64748b)', fontWeight: 600 }}>NUEVO SALDO PENDIENTE</span>
                <div
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    color: saldoPendienteNum === 0 ? '#16a34a' : '#ea580c',
                    marginTop: '2px',
                  }}
                >
                  {formatearMonedaCop(saldoPendienteNum)}
                </div>
              </div>
            </div>

            {/* Notas */}
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Observaciones
              </label>
              <textarea
                rows={2}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Detalle del pago o entrega..."
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--borde-tarjeta, #cbd5e1)',
                  background: 'var(--fondo-tarjeta, #ffffff)',
                  color: 'var(--texto-principal, #1e293b)',
                  fontSize: '0.84rem',
                  resize: 'none',
                }}
              />
            </div>
          </div>

          {/* Pie */}
          <div
            style={{
              padding: '0.85rem 1.5rem',
              borderTop: '1px solid var(--borde-tarjeta, #e2e8f0)',
              background: 'var(--fondo-elevado, #f8fafc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.75rem',
            }}
          >
            <button
              type="button"
              onClick={alCerrar}
              disabled={guardando}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--borde-tarjeta, #cbd5e1)',
                background: 'var(--fondo-tarjeta, #ffffff)',
                color: 'var(--texto-principal, #334155)',
                fontWeight: 600,
                fontSize: '0.84rem',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={guardando}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--color-primario, #0284c7)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.84rem',
                cursor: guardando ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{guardando ? 'Actualizando...' : 'Guardar Abonos'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

