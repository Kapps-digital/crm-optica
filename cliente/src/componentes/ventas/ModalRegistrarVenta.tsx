'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Receipt,
  Lock,
  User,
  Phone,
  Package,
  Plus,
  Trash2,
  AlertCircle,
  Search,
  Check,
  RotateCcw,
} from 'lucide-react';
import {
  formatearSeparadorMiles,
  limpiarNumeroMoneda,
  obtenerFechaHoyColombia,
} from '@/utilidades/formato';
import {
  obtenerVendedoresApi,
  crearVendedorApi,
  desactivarVendedorApi,
  obtenerConfiguracionFacturacionApi,
  crearVentaApi,
  obtenerPacientes,
  type Vendedor,
} from '@/servicios/api_crm';
import type { Contacto } from '@/tipos/crm';
import { SelectorFecha } from '../comunes/SelectorFecha';
import { SelectorHoraPopover } from '../comunes/SelectorHoraPopover';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';
import { SelectorDesplegable, type OpcionDesplegable } from '../comunes/SelectorDesplegable';
import { ModalConfirmacionAccion } from '../comunes/ModalConfirmacionAccion';
import { ModalRegistrarPaciente } from '../pacientes/ModalRegistrarPaciente';

interface PropiedadesModalRegistrarVenta {
  abierto: boolean;
  alCerrar: () => void;
  alVentaCreada: () => void;
  opticaId?: number;
  pacientes?: Contacto[];
  alPacienteCreado?: (paciente: Contacto) => void;
}

function obtenerHoraActualAmPm(): string {
  const ahora = new Date();
  let h = ahora.getHours();
  const m = String(ahora.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
}

function combinarFechaYHoraIso(fechaStr: string, horaStr: string): string {
  try {
    const ahora = new Date();
    const fecha = fechaStr.trim() || ahora.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    let horas = ahora.getHours();
    let minutos = ahora.getMinutes();

    if (horaStr) {
      const match = horaStr.match(/(\d{1,2}):(\d{2})(?:\s*([APap][Mm]))?/);
      if (match) {
        let h = parseInt(match[1], 10);
        minutos = parseInt(match[2], 10);
        const ampm = match[3]?.toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        horas = h;
      }
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${fecha}T${pad(horas)}:${pad(minutos)}:00-05:00`;
  } catch {
    return new Date().toISOString();
  }
}

export const ModalRegistrarVenta: React.FC<PropiedadesModalRegistrarVenta> = ({
  abierto,
  alCerrar,
  alVentaCreada,
  opticaId,
  pacientes: pacientesProp,
  alPacienteCreado,
}) => {
  // Facturación y vendedores
  const [proximaFactura, setProximaFactura] = useState('FAC-0001');
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [cargandoVendedores, setCargandoVendedores] = useState(false);

  // Pacientes locales si no se pasan por prop
  const [listaPacientes, setListaPacientes] = useState<Contacto[]>(pacientesProp || []);

  // Formulario: Fecha y Hora
  const [fechaVenta, setFechaVenta] = useState(() => obtenerFechaHoyColombia());
  const [horaVenta, setHoraVenta] = useState(() => obtenerHoraActualAmPm());

  // Vendedor
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState<number | null>(null);
  const [vendedorParaDesactivar, setVendedorParaDesactivar] = useState<{ id: number; nombre: string } | null>(null);
  const [creandoVendedor, setCreandoVendedor] = useState(false);

  // Cliente / Paciente (Estricto: debe ser paciente registrado en el CRM)
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<Contacto | null>(null);
  const [nombreCliente, setNombreCliente] = useState('');
  const [celularCliente, setCelularCliente] = useState('');
  const [mostrarSugerenciasClientes, setMostrarSugerenciasClientes] = useState(false);
  const [modalNuevoPacienteAbierto, setModalNuevoPacienteAbierto] = useState(false);
  const refClienteContenedor = useRef<HTMLDivElement>(null);

  // Producto
  const [producto, setProducto] = useState('');

  // Valores monetarios
  const [valorProductoTexto, setValorProductoTexto] = useState('');
  const [abonoInicialTexto, setAbonoInicialTexto] = useState('');
  const [abono2Texto, setAbono2Texto] = useState('');
  const [abono3Texto, setAbono3Texto] = useState('');
  const [mostrarAbono2, setMostrarAbono2] = useState(false);
  const [mostrarAbono3, setMostrarAbono3] = useState(false);

  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);

  // Cargar datos al abrir modal
  useEffect(() => {
    if (!abierto) return;

    setErrorValidacion(null);
    setFechaVenta(obtenerFechaHoyColombia());
    setHoraVenta(obtenerHoraActualAmPm());
    setPacienteSeleccionado(null);
    setNombreCliente('');
    setCelularCliente('');
    setProducto('');
    setValorProductoTexto('');
    setAbonoInicialTexto('');
    setAbono2Texto('');
    setAbono3Texto('');
    setMostrarAbono2(false);
    setMostrarAbono3(false);
    setNotas('');

    obtenerConfiguracionFacturacionApi().then((res) => {
      if (res && res.proxima_factura) {
        setProximaFactura(res.proxima_factura);
      }
    });

    setCargandoVendedores(true);
    obtenerVendedoresApi(false).then((res) => {
      if (res.exito && res.vendedores) {
        setVendedores(res.vendedores);
        if (res.vendedores.length === 1) {
          setVendedorSeleccionado(res.vendedores[0].id);
        }
      }
      setCargandoVendedores(false);
    });

    if (!pacientesProp || pacientesProp.length === 0) {
      obtenerPacientes().then((res: any) => {
        if (Array.isArray(res)) {
          setListaPacientes(res);
        } else if (res && Array.isArray(res.pacientes)) {
          setListaPacientes(res.pacientes);
        }
      });
    } else {
      setListaPacientes(pacientesProp);
    }
  }, [abierto, opticaId, pacientesProp]);

  // Clic fuera para cerrar sugerencias de clientes
  useEffect(() => {
    const alClicFuera = (e: MouseEvent) => {
      if (refClienteContenedor.current && !refClienteContenedor.current.contains(e.target as Node)) {
        setMostrarSugerenciasClientes(false);
      }
    };
    document.addEventListener('mousedown', alClicFuera);
    return () => document.removeEventListener('mousedown', alClicFuera);
  }, []);

  // Cálculos numéricos reactivos
  const valorProductoNum = useMemo(() => limpiarNumeroMoneda(valorProductoTexto), [valorProductoTexto]);
  const abonoInicialNum = useMemo(() => limpiarNumeroMoneda(abonoInicialTexto), [abonoInicialTexto]);
  const abono2Num = useMemo(() => (mostrarAbono2 ? limpiarNumeroMoneda(abono2Texto) : 0), [mostrarAbono2, abono2Texto]);
  const abono3Num = useMemo(() => (mostrarAbono3 ? limpiarNumeroMoneda(abono3Texto) : 0), [mostrarAbono3, abono3Texto]);

  const totalAbonosNum = useMemo(() => {
    return abonoInicialNum + abono2Num + abono3Num;
  }, [abonoInicialNum, abono2Num, abono3Num]);

  const saldoPendienteNum = useMemo(() => {
    return Math.max(0, valorProductoNum - totalAbonosNum);
  }, [valorProductoNum, totalAbonosNum]);

  // Validación de campos obligatorios para activar el botón Registrar Venta
  const formularioCompleto = useMemo(() => {
    const tieneFecha = Boolean(fechaVenta && fechaVenta.trim() !== '');
    const tieneHora = Boolean(horaVenta && horaVenta.trim() !== '');
    const tieneVendedor = Boolean(vendedorSeleccionado);
    const tienePacienteValido = Boolean(pacienteSeleccionado);
    const tieneProducto = Boolean(producto && producto.trim() !== '');
    const tieneValorValido = valorProductoNum > 0;
    const abonosValidos = totalAbonosNum <= valorProductoNum;

    return (
      tieneFecha &&
      tieneHora &&
      tieneVendedor &&
      tienePacienteValido &&
      tieneProducto &&
      tieneValorValido &&
      abonosValidos
    );
  }, [
    fechaVenta,
    horaVenta,
    vendedorSeleccionado,
    pacienteSeleccionado,
    producto,
    valorProductoNum,
    totalAbonosNum,
  ]);

  // Opciones de vendedores ordenados alfabéticamente de la A a la Z
  const opcionesVendedores: OpcionDesplegable[] = useMemo(() => {
    return [...vendedores]
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))
      .map((v) => ({
        valor: v.id,
        etiqueta: v.nombre,
      }));
  }, [vendedores]);

  // Filtrar estrictamente solo pacientes clínicos registrados (excluye contactos no registrados)
  const soloPacientes = useMemo(() => {
    return (listaPacientes || []).filter((p) => {
      const formulas = Number(p.total_formulas) || 0;
      const citas = Number(p.total_citas) || 0;
      return Boolean(p.es_paciente) || formulas > 0 || citas > 0;
    });
  }, [listaPacientes]);

  // Sugerencias de pacientes (Búsqueda en memoria local del navegador, CERO llamadas a la BD / Vercel al teclear)
  const pacientesSugeridos = useMemo(() => {
    const t = nombreCliente.trim().toLowerCase();
    if (!t) return soloPacientes.slice(0, 5);
    return soloPacientes
      .filter((p) => {
        const nom = (p.nombre_completo || p.nombre || '').toLowerCase();
        const tel = (p.telefono || '').toLowerCase();
        const ced = (p.cedula || p.documento || '').toLowerCase();
        return nom.includes(t) || tel.includes(t) || ced.includes(t);
      })
      .slice(0, 6);
  }, [soloPacientes, nombreCliente]);

  const seleccionarPacienteSugerido = (p: Contacto) => {
    setPacienteSeleccionado(p);
    setNombreCliente(p.nombre_completo || p.nombre || '');
    if (p.telefono) {
      setCelularCliente(p.telefono);
    }
    setMostrarSugerenciasClientes(false);
    setErrorValidacion(null);
  };

  // Crear nuevo vendedor
  const manejarCrearVendedor = async (nombreNuevo: string) => {
    const nombre = nombreNuevo.trim();
    if (!nombre) return;

    setCreandoVendedor(true);
    try {
      const res = await crearVendedorApi(nombre);
      if (res.exito && res.vendedor) {
        setVendedores((prev) => [...prev, res.vendedor!]);
        setVendedorSeleccionado(res.vendedor.id);
      } else {
        alert(res.error || 'No fue posible registrar el vendedor');
      }
    } catch {
      alert('Error de conexión al crear vendedor');
    } finally {
      setCreandoVendedor(false);
    }
  };

  // Desactivar vendedor confirmado mediante modal corporativo
  const ejecutarDesactivarVendedor = async (id: number) => {
    try {
      const res = await desactivarVendedorApi(id);
      if (res.exito) {
        setVendedores((prev) => prev.filter((vend) => vend.id !== id));
        if (vendedorSeleccionado === id) {
          setVendedorSeleccionado(null);
        }
      } else {
        alert(res.error || 'No fue posible desactivar el vendedor');
      }
    } catch {
      alert('Error de conexión al desactivar vendedor');
    }
  };

  const manejarGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorValidacion(null);

    if (!vendedorSeleccionado) {
      setErrorValidacion('Por favor selecciona el vendedor responsable de la venta.');
      return;
    }

    if (!pacienteSeleccionado) {
      setErrorValidacion('Debes seleccionar o registrar un paciente existente en el CRM para emitir la factura.');
      return;
    }

    if (!producto.trim()) {
      setErrorValidacion('Debes especificar el producto o servicio vendido.');
      return;
    }

    if (valorProductoNum <= 0) {
      setErrorValidacion('El valor del producto debe ser mayor a cero.');
      return;
    }

    if (totalAbonosNum > valorProductoNum) {
      setErrorValidacion('El total de abonos no puede ser superior al valor del producto.');
      return;
    }

    setGuardando(true);
    try {
      const fechaIso = combinarFechaYHoraIso(fechaVenta, horaVenta);
      const res = await crearVentaApi({
        vendedor_id: vendedorSeleccionado,
        nombre_cliente: (pacienteSeleccionado.nombre_completo || pacienteSeleccionado.nombre || nombreCliente).trim(),
        celular_cliente: celularCliente.trim() || undefined,
        producto: producto.trim(),
        valor_producto: valorProductoNum,
        abono_inicial: abonoInicialNum,
        abono_2: mostrarAbono2 ? abono2Num : 0,
        abono_3: mostrarAbono3 ? abono3Num : 0,
        fecha: fechaIso,
        notas: notas.trim() || undefined,
      });

      if (res.exito) {
        alVentaCreada();
        alCerrar();
      } else {
        setErrorValidacion(res.error || 'No se pudo guardar la venta');
      }
    } catch (err: any) {
      setErrorValidacion(err.message || 'Error de conexión al registrar la venta');
    } finally {
      setGuardando(false);
    }
  };

  if (!abierto) return null;

  return (
    <div
      className="modal-backdrop-premium"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="modal-tarjeta-premium"
        style={{
          background: 'var(--fondo-tarjeta)',
          border: '1px solid var(--borde-tarjeta)',
          borderRadius: 'var(--radio-xl, 14px)',
          width: '100%',
          maxWidth: '580px',
          maxHeight: '92vh',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeInUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Cabecera del Modal */}
        <div
          style={{
            padding: '1.1rem 1.4rem',
            borderBottom: '1px solid var(--borde-tarjeta)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--fondo-elevado)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)',
                color: 'var(--color-primario)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Receipt size={18} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--texto-principal)',
                  fontFamily: 'var(--fuente-titulos)',
                }}
              >
                Registrar Venta
              </h3>
              <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--texto-atenuado)' }}>
                Facturación, control de abonos y saldos pendientes
              </p>
            </div>
          </div>

          <EtiquetaTooltip texto="Cerrar ventana" posicion="abajo">
            <button
              type="button"
              onClick={alCerrar}
              disabled={guardando}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--texto-atenuado)',
                cursor: 'pointer',
                padding: '0.4rem',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Cerrar modal"
            >
              <X size={18} />
            </button>
          </EtiquetaTooltip>
        </div>

        {/* Formulario */}
        <form
          noValidate
          onSubmit={manejarGuardar}
          style={{
            padding: '1.25rem 1.4rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.95rem',
            overflowY: 'auto',
          }}
        >
          {errorValidacion && (
            <div
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radio-md, 8px)',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{errorValidacion}</span>
            </div>
          )}

          {/* Fila 1: No. Factura (Bloqueado) y Fecha/Hora Premium Uniformes */}
          <div className="modal-venta-fila-factura-fecha" style={{ display: 'grid', gridTemplateColumns: '120px 1.15fr 1fr', gap: '0.65rem', alignItems: 'flex-start' }}>
            {/* Factura */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--texto-principal)', height: '17px', display: 'flex', alignItems: 'center' }}>
                No. Factura
              </label>
              <EtiquetaTooltip texto="Consecutivo automático correlativo bloqueado" posicion="arriba" style={{ width: '100%' }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <Lock
                    size={13}
                    style={{
                      position: 'absolute',
                      left: '0.65rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--texto-atenuado)',
                    }}
                  />
                  <input
                    type="text"
                    value={proximaFactura}
                    readOnly
                    disabled
                    style={{
                      width: '100%',
                      height: '32px',
                      padding: '0 0.45rem 0 1.8rem',
                      borderRadius: 'var(--radio-sm, 6px)',
                      border: '1px solid var(--borde-tarjeta)',
                      background: 'var(--fondo-base)',
                      color: 'var(--texto-principal)',
                      fontSize: '0.80rem',
                      fontWeight: 700,
                      cursor: 'not-allowed',
                      boxSizing: 'border-box',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                    }}
                  />
                </div>
              </EtiquetaTooltip>
            </div>

            {/* Fecha */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--texto-principal)', height: '17px', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                Fecha <span className="asterisco-obligatorio">*</span>
              </label>
              <SelectorFecha
                valor={fechaVenta}
                alCambiar={setFechaVenta}
                placeholder="Fecha de venta..."
                anchoMinimo="100%"
                estiloBoton={{
                  height: '32px',
                  borderRadius: 'var(--radio-sm, 6px)',
                  background: 'var(--fondo-base)',
                  border: '1px solid var(--borde-tarjeta)',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                  fontSize: '0.80rem',
                  padding: '0 0.65rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Hora */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--texto-principal)', height: '17px', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                Hora <span className="asterisco-obligatorio">*</span>
              </label>
              <SelectorHoraPopover
                valor={horaVenta}
                alCambiar={setHoraVenta}
                placeholder="Hora..."
                estiloBoton={{
                  height: '32px',
                  borderRadius: 'var(--radio-sm, 6px)',
                  background: 'var(--fondo-base)',
                  border: '1px solid var(--borde-tarjeta)',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                  fontSize: '0.80rem',
                  padding: '0 0.65rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Fila 2: Vendedor (SelectorDesplegable Corporativo Premium) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--texto-principal)' }}>
              Vendedor <span className="asterisco-obligatorio">*</span>
            </label>
            <SelectorDesplegable
              valor={vendedorSeleccionado ?? ''}
              alCambiar={(nuevo) => setVendedorSeleccionado(Number(nuevo))}
              opciones={opcionesVendedores}
              placeholder="Seleccionar vendedor..."
              icono={User}
              anchoMinimo="100%"
              conBuscador={true}
              placeholderBuscador="Buscar vendedor..."
              permitirCrearNuevo={true}
              textoCrearNuevo="+ Registrar Vendedor"
              placeholderCrearNuevo="Nombre del nuevo vendedor..."
              alCrearNuevo={manejarCrearVendedor}
              alEliminarOpcion={(opc) => {
                setVendedorParaDesactivar({ id: Number(opc.valor), nombre: opc.etiqueta });
              }}
              textoEliminarOpcion="Desactivar vendedor"
              tamano="compacto"
              estiloBoton={{
                height: '34px',
                borderRadius: 'var(--radio-sm, 6px)',
                fontSize: '0.80rem',
                background: 'var(--fondo-elevado)',
              }}
            />
          </div>

          {/* Fila 3: Paciente Registrado (Estricto) y Celular */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.75rem', alignItems: 'flex-start' }}>
            {/* Paciente con Validación Estricta */}
            <div ref={refClienteContenedor} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '17px' }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--texto-principal)', height: '17px', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                  <span className="texto-largo-modal-escritorio">Nombre del </span>Paciente <span className="asterisco-obligatorio">*</span>
                </label>
                {!pacienteSeleccionado && (
                  <button
                    type="button"
                    onClick={() => setModalNuevoPacienteAbierto(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primario)',
                      fontSize: '0.70rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Plus size={11} />
                    <span>Nuevo<span className="texto-largo-modal-escritorio"> Paciente</span></span>
                  </button>
                )}
              </div>

              {pacienteSeleccionado ? (
                /* Estado A: Paciente Seleccionado y Verificado */
                <div
                  style={{
                    height: '34px',
                    padding: '0 0.55rem 0 0.65rem',
                    borderRadius: 'var(--radio-sm, 6px)',
                    border: '1px solid rgba(var(--color-primario-rgb, 2, 132, 199), 0.35)',
                    background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: 'var(--color-primario)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Check size={11} strokeWidth={3} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', overflow: 'hidden' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '0.80rem',
                          color: 'var(--texto-principal)',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                        }}
                      >
                        {pacienteSeleccionado.nombre_completo || pacienteSeleccionado.nombre}
                      </span>
                      {(pacienteSeleccionado.cedula || pacienteSeleccionado.documento) && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)', flexShrink: 0 }}>
                          (Doc: {pacienteSeleccionado.cedula || pacienteSeleccionado.documento})
                        </span>
                      )}
                    </div>
                  </div>

                  <EtiquetaTooltip texto="Cambiar o buscar otro paciente" posicion="arriba">
                    <button
                      type="button"
                      onClick={() => {
                        setPacienteSeleccionado(null);
                        setNombreCliente('');
                        setCelularCliente('');
                        setMostrarSugerenciasClientes(true);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--texto-atenuado)',
                        cursor: 'pointer',
                        padding: '0.2rem 0.4rem',
                        borderRadius: '4px',
                        fontSize: '0.70rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#ef4444';
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--texto-atenuado)';
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <RotateCcw size={12} />
                      <span>Cambiar</span>
                    </button>
                  </EtiquetaTooltip>
                </div>
              ) : (
                /* Estado B: Buscador con autocompletado en memoria y validación estricta */
                <div>
                  <div style={{ position: 'relative' }}>
                    <Search
                      size={14}
                      style={{
                        position: 'absolute',
                        left: '0.65rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: Boolean(nombreCliente.trim() && !pacienteSeleccionado) ? '#ef4444' : 'var(--texto-atenuado)',
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Buscar paciente registrado..."
                      value={nombreCliente}
                      onChange={(e) => {
                        setNombreCliente(e.target.value);
                        setMostrarSugerenciasClientes(true);
                      }}
                      onFocus={() => setMostrarSugerenciasClientes(true)}
                      style={{
                        width: '100%',
                        height: '34px',
                        padding: '0 0.65rem 0 2rem',
                        borderRadius: 'var(--radio-sm, 6px)',
                        border: Boolean(nombreCliente.trim() && !pacienteSeleccionado)
                          ? '1.5px solid #ef4444'
                          : '1px solid var(--borde-tarjeta)',
                        background: Boolean(nombreCliente.trim() && !pacienteSeleccionado)
                          ? 'rgba(239, 68, 68, 0.04)'
                          : 'var(--fondo-elevado)',
                        boxShadow: Boolean(nombreCliente.trim() && !pacienteSeleccionado)
                          ? '0 0 0 2px rgba(239, 68, 68, 0.15)'
                          : 'none',
                        color: 'var(--texto-principal)',
                        fontSize: '0.80rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'all 0.15s ease',
                      }}
                    />
                  </div>

                  {/* Aviso visual en rojo si el paciente escrito no está registrado en el CRM */}
                  {Boolean(nombreCliente.trim() && !pacienteSeleccionado) && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        color: '#ef4444',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        marginTop: '0.25rem',
                      }}
                    >
                      <AlertCircle size={11} style={{ flexShrink: 0 }} />
                      Paciente no registrado. Selecciona un paciente de la lista o usa &quot;+ Nuevo Paciente&quot;.
                    </span>
                  )}

                  {/* Menú de Autocompletado de Pacientes */}
                  {mostrarSugerenciasClientes && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        background: 'var(--fondo-tarjeta)',
                        border: '1px solid var(--borde-tarjeta)',
                        borderRadius: 'var(--radio-md, 8px)',
                        boxShadow: 'var(--sombra-lg)',
                        zIndex: 55,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Lista de pacientes encontrados */}
                      <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                        {pacientesSugeridos.length > 0 ? (
                          pacientesSugeridos.map((pac) => (
                            <div
                              key={pac.id}
                              onClick={() => seleccionarPacienteSugerido(pac)}
                              style={{
                                padding: '0.5rem 0.65rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                fontSize: '0.78rem',
                                borderBottom: '1px solid var(--borde-tarjeta)',
                                transition: 'background 0.12s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--fondo-elevado)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--texto-principal)' }}>
                                  {pac.nombre_completo || pac.nombre}
                                </div>
                                {(pac.cedula || pac.documento) && (
                                  <div style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)' }}>
                                    Doc: {pac.cedula || pac.documento}
                                  </div>
                                )}
                              </div>
                              {pac.telefono && (
                                <span style={{ fontSize: '0.70rem', color: 'var(--color-primario)', fontWeight: 600 }}>
                                  {pac.telefono}
                                </span>
                              )}
                            </div>
                          ))
                        ) : (
                          /* Aviso si no está registrado */
                          <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.05)', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', color: '#ef4444', fontSize: '0.74rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                              <AlertCircle size={14} />
                              <span>No está registrado como paciente</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.70rem', color: 'var(--texto-atenuado)' }}>
                              Para emitir la factura es obligatorio registrarlo con el botón &quot;+ Nuevo Paciente&quot;.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Celular */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--texto-principal)', height: '17px', display: 'flex', alignItems: 'center' }}>
                Celular
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-atenuado)' }} />
                <input
                  type="tel"
                  placeholder="Ej. 311 741 5122"
                  value={celularCliente}
                  onChange={(e) => setCelularCliente(e.target.value)}
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 0.65rem 0 2rem',
                    borderRadius: 'var(--radio-sm, 6px)',
                    border: '1px solid var(--borde-tarjeta)',
                    background: 'var(--fondo-elevado)',
                    color: 'var(--texto-principal)',
                    fontSize: '0.80rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Fila 4: Producto Vendido y Valor Total en la misma fila (1.4fr 1fr) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '0.75rem', alignItems: 'flex-start' }}>
            {/* Producto Vendido */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--texto-principal)' }}>
                Producto Vendido <span className="asterisco-obligatorio">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Package size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-atenuado)' }} />
                <input
                  type="text"
                  placeholder="Ej. Lentes Antirreflejo Blue + Montura Acetato"
                  value={producto}
                  onChange={(e) => setProducto(e.target.value)}
                  style={{
                    width: '100%',
                    height: '34px',
                    padding: '0 0.65rem 0 2rem',
                    borderRadius: 'var(--radio-sm, 6px)',
                    border: '1px solid var(--borde-tarjeta)',
                    background: 'var(--fondo-elevado)',
                    color: 'var(--texto-principal)',
                    fontSize: '0.80rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Valor Total */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--texto-principal)' }}>
                Valor Total <span className="asterisco-obligatorio">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="$ 0"
                value={valorProductoTexto ? `$ ${formatearSeparadorMiles(valorProductoTexto)}` : ''}
                onChange={(e) => {
                  const digitos = e.target.value.replace(/\D/g, '');
                  setValorProductoTexto(digitos);
                }}
                style={{
                  width: '100%',
                  height: '34px',
                  padding: '0 0.75rem',
                  borderRadius: 'var(--radio-sm, 6px)',
                  border: '1px solid var(--borde-tarjeta)',
                  background: 'var(--fondo-elevado)',
                  color: 'var(--texto-principal)',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Fila 6: Sección de Abonos (Sin el signo verde, limpio) */}
          <div
            style={{
              borderRadius: 'var(--radio-md, 8px)',
              border: '1px solid var(--borde-tarjeta)',
              background: 'var(--fondo-elevado)',
              padding: '0.75rem 0.85rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--texto-principal)' }}>
                Abonos
              </span>
              <span style={{ fontSize: '0.70rem', color: 'var(--texto-atenuado)' }}>
                (Máximo 3 abonos)
              </span>
            </div>

            {/* Abono 1 (Inicial) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--texto-secundario)' }}>
                Abono Inicial
              </label>
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
                  height: '32px',
                  padding: '0 0.65rem',
                  borderRadius: 'var(--radio-sm, 6px)',
                  border: '1px solid var(--borde-tarjeta)',
                  background: 'var(--fondo-tarjeta)',
                  color: 'var(--texto-principal)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Abono 2 */}
            {mostrarAbono2 && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.45rem' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--texto-secundario)' }}>
                    Segundo Abono (Abono 2)
                  </label>
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
                      height: '32px',
                      padding: '0 0.65rem',
                      borderRadius: 'var(--radio-sm, 6px)',
                      border: '1px solid var(--borde-tarjeta)',
                      background: 'var(--fondo-tarjeta)',
                      color: 'var(--texto-principal)',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <EtiquetaTooltip texto="Eliminar segundo abono" posicion="arriba">
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarAbono2(false);
                      setAbono2Texto('');
                    }}
                    style={{
                      height: '32px',
                      width: '32px',
                      borderRadius: '6px',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      background: 'rgba(239, 68, 68, 0.08)',
                      color: '#ef4444',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </EtiquetaTooltip>
              </div>
            )}

            {/* Abono 3 */}
            {mostrarAbono3 && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.45rem' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--texto-secundario)' }}>
                    Tercer Abono (Abono 3)
                  </label>
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
                      height: '32px',
                      padding: '0 0.65rem',
                      borderRadius: 'var(--radio-sm, 6px)',
                      border: '1px solid var(--borde-tarjeta)',
                      background: 'var(--fondo-tarjeta)',
                      color: 'var(--texto-principal)',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <EtiquetaTooltip texto="Eliminar tercer abono" posicion="arriba">
                  <button
                    type="button"
                    onClick={() => {
                      setMostrarAbono3(false);
                      setAbono3Texto('');
                    }}
                    style={{
                      height: '32px',
                      width: '32px',
                      borderRadius: '6px',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      background: 'rgba(239, 68, 68, 0.08)',
                      color: '#ef4444',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </EtiquetaTooltip>
              </div>
            )}

            {/* Botón agregar más abonos si no ha llegado al límite de 3 */}
            {(!mostrarAbono2 || !mostrarAbono3) && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (!mostrarAbono2) setMostrarAbono2(true);
                    else if (!mostrarAbono3) setMostrarAbono3(true);
                  }}
                  style={{
                    height: '28px',
                    padding: '0 0.65rem',
                    borderRadius: '6px',
                    border: '1px dashed var(--borde-tarjeta)',
                    background: 'var(--fondo-tarjeta)',
                    color: 'var(--color-primario)',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Plus size={13} />
                  <span>Agregar Abono Adicional</span>
                </button>
              </div>
            )}

            {/* Micro-resumen Total Abonos y Saldo */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.5rem',
                marginTop: '0.25rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid var(--borde-tarjeta)',
              }}
            >
              <div style={{ background: 'var(--fondo-tarjeta)', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid var(--borde-tarjeta)' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)', display: 'block', fontWeight: 600 }}>TOTAL ABONOS</span>
                <strong style={{ fontSize: '0.86rem', color: '#10b981' }}>
                  ${formatearSeparadorMiles(String(totalAbonosNum))}
                </strong>
              </div>
              <div style={{ background: 'var(--fondo-tarjeta)', padding: '0.45rem 0.65rem', borderRadius: '6px', border: '1px solid var(--borde-tarjeta)' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)', display: 'block', fontWeight: 600 }}>SALDO PENDIENTE</span>
                <strong style={{ fontSize: '0.86rem', color: saldoPendienteNum > 0 ? '#ef4444' : 'var(--texto-principal)' }}>
                  ${formatearSeparadorMiles(String(saldoPendienteNum))}
                </strong>
              </div>
            </div>
          </div>

          {/* Botones de Acción */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={alCerrar}
              disabled={guardando}
              style={{
                height: '34px',
                padding: '0 0.95rem',
                borderRadius: 'var(--radio-md, 8px)',
                border: '1px solid var(--borde-tarjeta)',
                background: 'var(--fondo-elevado)',
                color: 'var(--texto-secundario)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            {!formularioCompleto ? (
              <EtiquetaTooltip
                texto={
                  !vendedorSeleccionado
                    ? 'Selecciona un vendedor responsable'
                    : !pacienteSeleccionado
                    ? 'Debes seleccionar o registrar un paciente en el CRM'
                    : !producto.trim()
                    ? 'Ingresa el producto vendido'
                    : valorProductoNum <= 0
                    ? 'Ingresa el valor total'
                    : totalAbonosNum > valorProductoNum
                    ? 'Los abonos no pueden superar el valor del producto'
                    : 'Completa todos los campos obligatorios (*)'
                }
                posicion="arriba"
              >
                <div style={{ display: 'inline-block' }}>
                  <button
                    type="submit"
                    disabled={true}
                    style={{
                      height: '34px',
                      padding: '0 1.15rem',
                      borderRadius: 'var(--radio-md, 8px)',
                      border: 'none',
                      background: 'var(--borde-tarjeta)',
                      color: 'var(--texto-atenuado)',
                      fontSize: '0.80rem',
                      fontWeight: 600,
                      cursor: 'not-allowed',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      opacity: 0.6,
                    }}
                  >
                    <Check size={15} />
                    <span>Registrar Venta</span>
                  </button>
                </div>
              </EtiquetaTooltip>
            ) : (
              <button
                type="submit"
                disabled={guardando}
                style={{
                  height: '34px',
                  padding: '0 1.15rem',
                  borderRadius: 'var(--radio-md, 8px)',
                  border: 'none',
                  background: 'var(--color-primario)',
                  color: '#ffffff',
                  fontSize: '0.80rem',
                  fontWeight: 600,
                  cursor: guardando ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Check size={15} />
                <span>{guardando ? 'Guardando...' : 'Registrar Venta'}</span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Modal Registrar Paciente Anidado (capa superior z-index 9999 sin desmontar la venta) */}
      <ModalRegistrarPaciente
        abierto={modalNuevoPacienteAbierto}
        alCerrar={() => setModalNuevoPacienteAbierto(false)}
        alGuardarExitoso={(nuevoPaciente) => {
          setListaPacientes((prev) => [nuevoPaciente, ...prev]);
          if (alPacienteCreado) {
            alPacienteCreado(nuevoPaciente);
          }
          setPacienteSeleccionado(nuevoPaciente);
          setNombreCliente(nuevoPaciente.nombre_completo || nuevoPaciente.nombre || '');
          if (nuevoPaciente.telefono) {
            setCelularCliente(nuevoPaciente.telefono);
          }
          setMostrarSugerenciasClientes(false);
          setModalNuevoPacienteAbierto(false);
          setErrorValidacion(null);
        }}
        contactoParaConvertir={
          nombreCliente.trim()
            ? ({
                nombre: nombreCliente.trim(),
                nombre_completo: nombreCliente.trim(),
                telefono: celularCliente.trim() || undefined,
              } as Contacto)
            : null
        }
      />

      {/* Modal Corporativo Premium para Confirmar Desactivación de Vendedor */}
      <ModalConfirmacionAccion
        abierto={Boolean(vendedorParaDesactivar)}
        alCerrar={() => setVendedorParaDesactivar(null)}
        alConfirmar={async () => {
          if (vendedorParaDesactivar) {
            await ejecutarDesactivarVendedor(vendedorParaDesactivar.id);
          }
        }}
        titulo="¿Deseas desactivar este vendedor?"
        descripcion={
          <>
            El vendedor <strong>{vendedorParaDesactivar?.nombre}</strong> ya no aparecerá disponible para registrar nuevas ventas. Las ventas y facturas históricas se conservarán intactas.
          </>
        }
        textoConfirmar="Sí, desactivar vendedor"
        textoCancelar="No, conservar vendedor"
        colorHero="peligro"
        datosChip={
          vendedorParaDesactivar
            ? {
                titulo: vendedorParaDesactivar.nombre,
                subtitulo: 'Vendedor de Óptica',
                etiquetaTag: 'Desactivar',
              }
            : undefined
        }
      />
    </div>
  );
};
