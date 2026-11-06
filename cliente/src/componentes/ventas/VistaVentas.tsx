'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Receipt,
  Plus,
  TrendingUp,
  Clock,
  Trash2,
  Coins,
  FileSpreadsheet,
  Users,
  Tag,
  Eye,
  User,
} from 'lucide-react';
import {
  formatearMonedaCop,
  formatearFechaHoraColombia,
} from '@/utilidades/formato';
import {
  obtenerVentasApi,
  eliminarVentaApi,
  obtenerVendedoresApi,
  obtenerUsuarioSesion,
  type Venta,
  type Vendedor,
  type MetricasVentas,
} from '@/servicios/api_crm';
import type { Contacto, Usuario } from '@/tipos/crm';
import { ModalRegistrarVenta } from './ModalRegistrarVenta';
import { ModalEditarAbonos } from './ModalEditarAbonos';
import { FiltroBusqueda } from '../comunes/FiltroBusqueda';
import { SelectorDesplegable, type OpcionDesplegable } from '../comunes/SelectorDesplegable';
import { BarraPaginacionTabla } from '../comunes/BarraPaginacionTabla';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';
import {
  SelectorPeriodoAgenda,
  type FiltroPeriodoAgenda,
  evaluarCoincidenciaPeriodo,
  obtenerRangoFechasFiltro,
} from '../citas/SelectorPeriodoAgenda';

interface PropiedadesVistaVentas {
  opticaId?: number;
  pacientes?: Contacto[];
  alPacienteCreado?: (paciente: Contacto) => void;
  alNavegarConfiguracionFacturacion?: () => void;
  usuarioActual?: Usuario | null;
}

const OPCIONES_FILTRO_ESTADOS: OpcionDesplegable[] = [
  { valor: '', etiqueta: 'Todos los Estados' },
  { valor: 'pagado', etiqueta: 'Pagado' },
  { valor: 'parcial', etiqueta: 'Con Abonos' },
  { valor: 'pendiente', etiqueta: 'Pendiente' },
];

export const VistaVentas: React.FC<PropiedadesVistaVentas> = ({
  opticaId,
  pacientes = [],
  alPacienteCreado,
  alNavegarConfiguracionFacturacion,
  usuarioActual,
}) => {
  const usuarioSesion = useMemo(() => {
    return usuarioActual || obtenerUsuarioSesion();
  }, [usuarioActual]);

  const rolNormalizado = (usuarioSesion?.rol || '').toLowerCase().trim();
  const puedeEliminarFactura = rolNormalizado === 'admin' || rolNormalizado === 'admin_optica';

  const [ventas, setVentas] = useState<Venta[]>([]);
  const [metricas, setMetricas] = useState<MetricasVentas>({
    total_facturas: 0,
    total_ventas: 0,
    total_recaudado: 0,
    total_saldo_pendiente: 0,
  });
  const [cargando, setCargando] = useState(true);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroVendedor, setFiltroVendedor] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodoAgenda>({ tipo: 'todos' });
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);

  // Paginación local
  const [paginaActual, setPaginaActual] = useState(1);
  const [limitePorPagina, setLimitePorPagina] = useState(10);

  // Modales
  const [modalNuevaVentaAbierto, setModalNuevaVentaAbierto] = useState(false);
  const [ventaParaEditarAbonos, setVentaParaEditarAbonos] = useState<Venta | null>(null);

  // Cargar vendedores para el filtro
  useEffect(() => {
    obtenerVendedoresApi(true).then((res) => {
      if (res.exito && res.vendedores) {
        setVendedores(res.vendedores);
      }
    });
  }, [opticaId]);

  // Cargar ventas y métricas
  const cargarVentas = useCallback(async () => {
    setCargando(true);
    try {
      const rango = obtenerRangoFechasFiltro(filtroPeriodo);
      const res = await obtenerVentasApi({
        busqueda: busqueda.trim() || undefined,
        vendedor_id: filtroVendedor ? Number(filtroVendedor) : undefined,
        estado_pago: filtroEstado || undefined,
        fecha_inicio: rango.fechaInicio,
        fecha_fin: rango.fechaFin,
        pagina: 1,
        limite: 300,
      });

      if (res.exito) {
        setVentas(res.ventas || []);
        if (res.metricas) {
          setMetricas(res.metricas);
        }
      }
    } catch (err) {
      console.error('Error al cargar ventas:', err);
    } finally {
      setCargando(false);
    }
  }, [busqueda, filtroVendedor, filtroEstado, filtroPeriodo, opticaId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarVentas();
    }, 200);
    return () => clearTimeout(timer);
  }, [cargarVentas]);

  // Resetear paginación al filtrar
  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda, filtroVendedor, filtroEstado, filtroPeriodo]);

  // Opciones de vendedores formateadas
  const opcionesVendedores = useMemo<OpcionDesplegable[]>(() => {
    return [
      { valor: '', etiqueta: 'Todos los Vendedores' },
      ...vendedores.map((v) => ({
        valor: String(v.id),
        etiqueta: `${v.nombre}${!v.activo ? ' (Inactivo)' : ''}`,
      })),
    ];
  }, [vendedores]);

  // Fechas de ventas para indicadores de puntos en el calendario
  const fechasVentas = useMemo(() => {
    return ventas.map((v) => v.fecha);
  }, [ventas]);

  // Filtrado local reactivo de ventas para período exacto
  const ventasFiltradas = useMemo(() => {
    return ventas.filter((v) => evaluarCoincidenciaPeriodo(v.fecha, filtroPeriodo));
  }, [ventas, filtroPeriodo]);

  // Paginación
  const totalRegistros = ventasFiltradas.length;
  const ventasPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * limitePorPagina;
    return ventasFiltradas.slice(inicio, inicio + limitePorPagina);
  }, [ventasFiltradas, paginaActual, limitePorPagina]);

  // Manejar eliminación de venta
  const manejarEliminarVenta = async (venta: Venta) => {
    const confirmar = window.confirm(
      `¿Deseas eliminar la factura ${venta.numero_factura} de ${venta.nombre_cliente}? Esta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    try {
      const res = await eliminarVentaApi(venta.id);
      if (res.exito) {
        cargarVentas();
      } else {
        alert(res.error || 'No fue posible eliminar la venta');
      }
    } catch {
      alert('Error de conexión al eliminar la venta');
    }
  };

  const hayFiltrosActivos = Boolean(
    busqueda || filtroVendedor || filtroEstado || filtroPeriodo.tipo !== 'todos'
  );

  const limpiarFiltros = () => {
    setBusqueda('');
    setFiltroVendedor('');
    setFiltroEstado('');
    setFiltroPeriodo({ tipo: 'todos' });
  };

  return (
    <div
      className="ventas-pagina-contenedor"
      style={{
        flex: 1,
        padding: '1.25rem 1.75rem',
        overflowY: 'auto',
        height: 'calc(100vh - 48px)',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Contenedor Principal */}
      <div
        className="ventas-tarjeta-principal"
        style={{
          background: 'var(--fondo-tarjeta)',
          border: '1px solid var(--borde-tarjeta)',
          borderRadius: 'var(--radio-lg, 12px)',
          padding: '1.25rem 1.5rem',
          boxShadow: 'var(--sombra-sm, 0 1px 3px rgba(0,0,0,0.05))',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* 1. Tarjetas de Métricas KPI Corporativas */}
        <div
          className="ventas-kpis-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '0.85rem',
          }}
        >
          {/* KPI 1: Ventas Totales */}
          <div
            className="ventas-kpi-tarjeta"
            style={{
              background: 'var(--fondo-elevado)',
              borderRadius: 'var(--radio-md, 10px)',
              padding: '0.95rem 1.15rem',
              border: '1px solid var(--borde-tarjeta)',
              boxShadow: 'var(--sombra-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--texto-atenuado)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Ventas Totales
              </span>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)',
                  color: 'var(--color-primario)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Receipt size={16} />
              </div>
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--texto-principal)', lineHeight: 1.1 }}>
                {formatearMonedaCop(metricas.total_ventas)}
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)' }}>
                Monto facturado acumulado
              </span>
            </div>
          </div>

          {/* KPI 2: Total Recaudado */}
          <div
            className="ventas-kpi-tarjeta"
            style={{
              background: 'var(--fondo-elevado)',
              borderRadius: 'var(--radio-md, 10px)',
              padding: '0.95rem 1.15rem',
              border: '1px solid var(--borde-tarjeta)',
              boxShadow: 'var(--sombra-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--texto-atenuado)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Total Recaudado
              </span>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TrendingUp size={16} />
              </div>
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#10b981', lineHeight: 1.1 }}>
                {formatearMonedaCop(metricas.total_recaudado)}
              </div>
              <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600 }}>
                {metricas.total_ventas > 0
                  ? `${((metricas.total_recaudado / metricas.total_ventas) * 100).toFixed(0)}% del valor total`
                  : '0% recaudado'}
              </span>
            </div>
          </div>

          {/* KPI 3: Saldo Pendiente */}
          <div
            className="ventas-kpi-tarjeta"
            style={{
              background: 'var(--fondo-elevado)',
              borderRadius: 'var(--radio-md, 10px)',
              padding: '0.95rem 1.15rem',
              border: '1px solid var(--borde-tarjeta)',
              boxShadow: 'var(--sombra-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--texto-atenuado)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Saldo Pendiente
              </span>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  background: metricas.total_saldo_pendiente > 0 ? 'rgba(245, 158, 11, 0.12)' : 'rgba(0,0,0,0.06)',
                  color: metricas.total_saldo_pendiente > 0 ? '#d97706' : 'var(--texto-atenuado)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Clock size={16} />
              </div>
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: metricas.total_saldo_pendiente > 0 ? '#d97706' : 'var(--texto-principal)', lineHeight: 1.1 }}>
                {formatearMonedaCop(metricas.total_saldo_pendiente)}
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)' }}>
                Por cobrar en entregas
              </span>
            </div>
          </div>

          {/* KPI 4: Facturas Emitidas */}
          <div
            className="ventas-kpi-tarjeta"
            style={{
              background: 'var(--fondo-elevado)',
              borderRadius: 'var(--radio-md, 10px)',
              padding: '0.95rem 1.15rem',
              border: '1px solid var(--borde-tarjeta)',
              boxShadow: 'var(--sombra-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--texto-atenuado)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Facturas Emitidas
              </span>
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  background: 'rgba(147, 51, 234, 0.12)',
                  color: '#9333ea',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileSpreadsheet size={16} />
              </div>
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--texto-principal)', lineHeight: 1.1 }}>
                {metricas.total_facturas}
              </div>
              <span style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)' }}>
                Transacciones registradas
              </span>
            </div>
          </div>
        </div>

        {/* 2. Barra Superior de la Tabla: Filtros Compactos + Botón Nueva Venta en la Misma Fila */}
        <div
          className="ventas-filtros-barra"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          {/* Grupo de Filtros Izquierdo */}
          <div className="ventas-filtros-grupo" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', flex: 1 }}>
            {/* Fila 1: Histórico + Buscador al lado */}
            <div className="ventas-filtros-fila-1">
              {/* Selector Período Tipo Calendario (Meses, Semanas, Días, Rango) - Primero */}
              <div className="ventas-filtro-periodo-wrap">
                <SelectorPeriodoAgenda
                  filtro={filtroPeriodo}
                  alCambiarFiltro={(nuevo) => setFiltroPeriodo(nuevo)}
                  fechasConRegistros={fechasVentas}
                  estiloBoton={{
                    height: '34px',
                    borderRadius: 'var(--radio-md, 8px)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    padding: '0 0.65rem',
                  }}
                />
              </div>

              {/* Buscador al Lado del Calendario */}
              <div className="ventas-filtro-buscador-wrap" style={{ width: '220px', minWidth: '180px' }}>
                <FiltroBusqueda
                  valor={busqueda}
                  alCambiar={setBusqueda}
                  placeholder="Buscar factura, cliente..."
                  ancho="100%"
                  alto="34px"
                />
              </div>
            </div>

            {/* Fila 2: Vendedor + Estado al lado */}
            <div className="ventas-filtros-fila-2">
              {/* Selector Vendedor */}
              <div className="ventas-filtro-vendedor-wrap" style={{ width: '175px' }}>
                <SelectorDesplegable
                  valor={filtroVendedor}
                  alCambiar={setFiltroVendedor}
                  opciones={opcionesVendedores}
                  icono={Users}
                  placeholder="Vendedor..."
                  tamano="compacto"
                  anchoMinimo="175px"
                  estiloBoton={{
                    height: '34px',
                    borderRadius: 'var(--radio-md, 8px)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    padding: '0 0.55rem',
                  }}
                />
              </div>

              {/* Selector Estado de Pago */}
              <div className="ventas-filtro-estado-wrap" style={{ width: '160px' }}>
                <SelectorDesplegable
                  valor={filtroEstado}
                  alCambiar={setFiltroEstado}
                  opciones={OPCIONES_FILTRO_ESTADOS}
                  icono={Tag}
                  placeholder="Estado..."
                  tamano="compacto"
                  anchoMinimo="160px"
                  estiloBoton={{
                    height: '34px',
                    borderRadius: 'var(--radio-md, 8px)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    padding: '0 0.55rem',
                  }}
                />
              </div>
            </div>

            {hayFiltrosActivos && (
              <button
                type="button"
                className="ventas-btn-limpiar"
                onClick={limpiarFiltros}
                style={{
                  height: '34px',
                  padding: '0 0.65rem',
                  borderRadius: 'var(--radio-md, 8px)',
                  border: '1px solid var(--borde-tarjeta)',
                  background: 'var(--fondo-elevado)',
                  color: 'var(--texto-secundario)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Botón Nueva Venta al Lado de Total Estados en la Misma Fila */}
          <button
            type="button"
            id="btn-nueva-venta"
            className="ventas-btn-nueva-escritorio"
            onClick={() => setModalNuevaVentaAbierto(true)}
            style={{
              height: '34px',
              padding: '0 0.95rem',
              borderRadius: 'var(--radio-md, 8px)',
              border: 'none',
              background: 'var(--color-primario)',
              color: '#ffffff',
              fontSize: '0.80rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <Plus size={16} />
            <span>Nueva Venta</span>
          </button>
        </div>

        {/* 3. Tabla de Ventas Premium (Escritorio) */}
        <div className="ventas-tabla-contenedor" style={{ overflowX: 'auto', border: '1px solid var(--borde-tarjeta)', borderRadius: 'var(--radio-md, 8px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
            <thead>
              <tr
                style={{
                  background: 'var(--fondo-elevado)',
                  borderBottom: '1px solid var(--borde-tarjeta)',
                  color: 'var(--texto-atenuado)',
                  fontSize: '0.70rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                <th style={{ padding: '0.65rem 0.85rem' }}>Factura & Fecha</th>
                <th style={{ padding: '0.65rem 0.85rem' }}>Cliente & Vendedor</th>
                <th style={{ padding: '0.65rem 0.85rem' }}>Producto Vendido</th>
                <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Valor Producto</th>
                <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Total Abonos</th>
                <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Saldo Pendiente</th>
                <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Estado</th>
                <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center', width: '90px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--texto-atenuado)' }}>
                    Cargando ventas...
                  </td>
                </tr>
              ) : ventasPaginadas.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--texto-atenuado)' }}>
                    {hayFiltrosActivos
                      ? 'No se encontraron ventas que coincidan con los filtros aplicados.'
                      : 'No hay ventas registradas aún. Haz clic en "+ Nueva Venta" para comenzar.'}
                  </td>
                </tr>
              ) : (
                ventasPaginadas.map((v) => {
                  const saldo = Number(v.saldo_pendiente || 0);
                  const abonoIni = Number(v.abono_inicial || 0);
                  const abono2 = Number(v.abono_2 || 0);
                  const abono3 = Number(v.abono_3 || 0);

                  return (
                    <tr
                      key={v.id}
                      style={{
                        borderBottom: '1px solid var(--borde-tarjeta)',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--fondo-elevado)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Factura & Fecha */}
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontFamily: 'monospace',
                            fontSize: '0.78rem',
                            color: 'var(--color-primario)',
                            background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.1)',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            display: 'inline-block',
                          }}
                        >
                          {v.numero_factura}
                        </span>
                        <div style={{ fontSize: '0.70rem', color: 'var(--texto-atenuado)', marginTop: '3px', whiteSpace: 'nowrap' }}>
                          {formatearFechaHoraColombia(v.fecha)}
                        </div>
                      </td>

                      {/* Cliente & Vendedor (sin teléfono, vendedor debajo) */}
                      <td style={{ padding: '0.65rem 0.85rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--texto-principal)' }}>{v.nombre_cliente}</div>
                        <div style={{ marginTop: '3px' }}>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              color: 'var(--texto-secundario)',
                              background: 'var(--fondo-elevado)',
                              padding: '0.05rem 0.35rem',
                              borderRadius: '4px',
                              border: '1px solid var(--borde-tarjeta)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <User size={10} style={{ opacity: 0.7 }} />
                            <span>{v.nombre_vendedor || 'Sin vendedor'}</span>
                          </span>
                        </div>
                      </td>

                      {/* Producto Vendido */}
                      <td style={{ padding: '0.65rem 0.85rem', color: 'var(--texto-principal)', maxWidth: '240px' }}>
                        <span style={{ fontWeight: 500 }}>{v.producto}</span>
                        {v.notas && (
                          <span style={{ display: 'block', fontSize: '0.70rem', color: 'var(--texto-atenuado)', marginTop: '2px' }}>
                            {v.notas}
                          </span>
                        )}
                      </td>

                      {/* Valor Producto */}
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: 'var(--texto-principal)', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
                        {formatearMonedaCop(v.valor_producto)}
                      </td>

                      {/* Total Abonos con Desglose */}
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: '#10b981' }}>
                          {formatearMonedaCop(v.total_abonos)}
                        </div>
                        {(abono2 > 0 || abono3 > 0) && (
                          <div style={{ fontSize: '0.66rem', color: 'var(--texto-atenuado)', marginTop: '1px' }}>
                            {abonoIni > 0 && `Ini: $${Math.round(abonoIni / 1000)}k `}
                            {abono2 > 0 && `| Ab2: $${Math.round(abono2 / 1000)}k `}
                            {abono3 > 0 && `| Ab3: $${Math.round(abono3 / 1000)}k`}
                          </div>
                        )}
                      </td>

                      {/* Saldo Pendiente */}
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 700, color: saldo > 0 ? '#ef4444' : 'var(--texto-atenuado)', fontSize: '0.84rem', whiteSpace: 'nowrap' }}>
                        {saldo > 0 ? formatearMonedaCop(saldo) : '$ 0'}
                      </td>

                      {/* Estado */}
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                        {v.estado_pago === 'pagado' ? (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.55rem',
                              borderRadius: '12px',
                              background: 'rgba(16, 185, 129, 0.12)',
                              color: '#10b981',
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Pagado
                          </span>
                        ) : v.estado_pago === 'parcial' ? (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.55rem',
                              borderRadius: '12px',
                              background: 'rgba(245, 158, 11, 0.12)',
                              color: '#d97706',
                              border: '1px solid rgba(245, 158, 11, 0.25)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Abonado
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.55rem',
                              borderRadius: '12px',
                              background: 'rgba(239, 68, 68, 0.12)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Pendiente
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <EtiquetaTooltip texto={saldo > 0 ? 'Registrar / modificar abonos' : 'Ver detalle de abonos'} posicion="arriba">
                            <button
                              type="button"
                              onClick={() => setVentaParaEditarAbonos(v)}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                border: '1px solid var(--borde-tarjeta)',
                                background: saldo > 0 ? 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.1)' : 'var(--fondo-elevado)',
                                color: saldo > 0 ? 'var(--color-primario)' : 'var(--texto-secundario)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {saldo > 0 ? <Coins size={14} /> : <Eye size={14} />}
                            </button>
                          </EtiquetaTooltip>

                          {puedeEliminarFactura && (
                            <EtiquetaTooltip texto="Eliminar venta" posicion="arriba">
                              <button
                                type="button"
                                onClick={() => manejarEliminarVenta(v)}
                                style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '6px',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  background: 'rgba(239, 68, 68, 0.08)',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </EtiquetaTooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Vista Móvil: Tarjetas de Ventas Corporativas */}
        <div className="ventas-tarjetas-movil">
          {cargando ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--texto-atenuado)' }}>
              Cargando ventas...
            </div>
          ) : ventasPaginadas.length === 0 ? (
            <div
              style={{
                padding: '2.5rem 1rem',
                textAlign: 'center',
                color: 'var(--texto-atenuado)',
                background: 'var(--fondo-elevado)',
                borderRadius: 'var(--radio-md, 8px)',
                border: '1px dashed var(--borde-tarjeta)',
              }}
            >
              {hayFiltrosActivos
                ? 'No se encontraron ventas que coincidan con los filtros aplicados.'
                : 'No hay ventas registradas aún. Presiona "+ Nueva Venta" para comenzar.'}
            </div>
          ) : (
            ventasPaginadas.map((v) => {
              const saldo = Number(v.saldo_pendiente || 0);

              const estadoConfig =
                v.estado_pago === 'pagado'
                  ? { etiqueta: 'Pagado', bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: 'rgba(16, 185, 129, 0.25)' }
                  : v.estado_pago === 'parcial'
                  ? { etiqueta: 'Abonado', bg: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: 'rgba(245, 158, 11, 0.25)' }
                  : { etiqueta: 'Pendiente', bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.25)' };

              return (
                <div
                  key={v.id}
                  style={{
                    background: 'var(--fondo-tarjeta)',
                    border: '1px solid var(--borde-tarjeta)',
                    borderRadius: 'var(--radio-md, 10px)',
                    padding: '0.85rem 0.95rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                  }}
                >
                  {/* Fila 1: Factura, Fecha y Estado */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          fontSize: '0.80rem',
                          color: 'var(--color-primario)',
                          background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.1)',
                          padding: '0.12rem 0.45rem',
                          borderRadius: '4px',
                        }}
                      >
                        {v.numero_factura}
                      </span>
                      <span style={{ fontSize: '0.70rem', color: 'var(--texto-atenuado)' }}>
                        {formatearFechaHoraColombia(v.fecha)}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: '0.70rem',
                        fontWeight: 700,
                        padding: '0.12rem 0.55rem',
                        borderRadius: '12px',
                        background: estadoConfig.bg,
                        color: estadoConfig.color,
                        border: `1px solid ${estadoConfig.border}`,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {estadoConfig.etiqueta}
                    </span>
                  </div>

                  {/* Fila 2: Cliente y Vendedor */}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--texto-principal)' }}>
                      {v.nombre_cliente}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          color: 'var(--texto-secundario)',
                          background: 'var(--fondo-elevado)',
                          padding: '0.08rem 0.4rem',
                          borderRadius: '4px',
                          border: '1px solid var(--borde-tarjeta)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <User size={11} style={{ opacity: 0.7 }} />
                        <span>{v.nombre_vendedor || 'Sin vendedor'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Fila 3: Producto Vendido */}
                  <div
                    style={{
                      background: 'var(--fondo-elevado)',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.76rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--texto-principal)' }}>
                      {v.producto}
                    </div>
                    {v.notas && (
                      <div style={{ fontSize: '0.70rem', color: 'var(--texto-atenuado)', marginTop: '0.15rem' }}>
                        {v.notas}
                      </div>
                    )}
                  </div>

                  {/* Fila 4: Bloque Financiero en 3 columnas */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '0.35rem',
                      background: 'var(--fondo-tarjeta)',
                      border: '1px solid var(--borde-tarjeta)',
                      borderRadius: '8px',
                      padding: '0.55rem 0.5rem',
                      textAlign: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.64rem', color: 'var(--texto-atenuado)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Total
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--texto-principal)', marginTop: '2px' }}>
                        {formatearMonedaCop(v.valor_producto)}
                      </div>
                    </div>

                    <div style={{ borderLeft: '1px solid var(--borde-tarjeta)', borderRight: '1px solid var(--borde-tarjeta)' }}>
                      <div style={{ fontSize: '0.64rem', color: 'var(--texto-atenuado)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Abonos
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#10b981', marginTop: '2px' }}>
                        {formatearMonedaCop(v.total_abonos)}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.64rem', color: 'var(--texto-atenuado)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Saldo
                      </div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: saldo > 0 ? '#ef4444' : 'var(--texto-atenuado)', marginTop: '2px' }}>
                        {saldo > 0 ? formatearMonedaCop(saldo) : '$ 0'}
                      </div>
                    </div>
                  </div>

                  {/* Fila 5: Botones de Acción */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
                    <button
                      type="button"
                      onClick={() => setVentaParaEditarAbonos(v)}
                      style={{
                        flex: 1,
                        height: '32px',
                        borderRadius: '6px',
                        border: '1px solid var(--borde-tarjeta)',
                        background: saldo > 0 ? 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.1)' : 'var(--fondo-elevado)',
                        color: saldo > 0 ? 'var(--color-primario)' : 'var(--texto-secundario)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                      }}
                    >
                      {saldo > 0 ? <Coins size={14} /> : <Eye size={14} />}
                      <span>{saldo > 0 ? 'Gestionar Abonos' : 'Ver Abonos'}</span>
                    </button>

                    {puedeEliminarFactura && (
                      <button
                        type="button"
                        onClick={() => manejarEliminarVenta(v)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          background: 'rgba(239, 68, 68, 0.08)',
                          color: '#ef4444',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                        aria-label="Eliminar venta"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 4. Barra de Paginación */}
        {totalRegistros > 0 && (
          <BarraPaginacionTabla
            totalRegistros={totalRegistros}
            paginaActual={paginaActual}
            limitePorPagina={limitePorPagina}
            alCambiarPagina={setPaginaActual}
            alCambiarLimite={(nuevoLimite) => {
              setLimitePorPagina(nuevoLimite);
              setPaginaActual(1);
            }}
          />
        )}
      </div>

      {/* Botón Flotante (FAB) para Celulares: Nueva Venta */}
      <button
        type="button"
        className="ventas-fab-nueva-venta"
        onClick={() => setModalNuevaVentaAbierto(true)}
        aria-label="Registrar nueva venta"
      >
        <Plus size={18} />
        <span>Nueva Venta</span>
      </button>

      {/* Modal Registrar Nueva Venta */}
      <ModalRegistrarVenta
        abierto={modalNuevaVentaAbierto}
        alCerrar={() => setModalNuevaVentaAbierto(false)}
        alVentaCreada={cargarVentas}
        opticaId={opticaId}
        pacientes={pacientes}
        alPacienteCreado={alPacienteCreado}
      />

      {/* Modal Editar Abonos */}
      <ModalEditarAbonos
        abierto={Boolean(ventaParaEditarAbonos)}
        venta={ventaParaEditarAbonos}
        alCerrar={() => setVentaParaEditarAbonos(null)}
        alGuardado={cargarVentas}
      />
    </div>
  );
};
