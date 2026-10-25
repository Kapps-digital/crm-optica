'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Zap,
  BarChart3,
  RefreshCw,
  Calculator,
  ArrowDownRight,
  ArrowUpRight,
  MessageSquare,
  Users,
  Coins,
  TrendingUp,
  Sliders,
  DollarSign,
  HelpCircle,
  Clock,
  ChevronDown,
  Save,
  CheckCircle2,
  RotateCcw,
  Lock,
  BookmarkCheck,
} from 'lucide-react';
import { SelectorDesplegable } from '../comunes/SelectorDesplegable';
import { SelectorFecha } from '../comunes/SelectorFecha';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';
import {
  obtenerMetricasConsumoIAApi,
  type ResumenConsumoIA,
  type TendenciaDiariaConsumoIA,
  type RegistroConsumoIA,
  type FiltrosMetricasConsumoIA,
} from '@/servicios/api_crm';
import type { Optica } from '@/tipos/crm';

interface PropiedadesModuloConsumo {
  opticas: Optica[];
  opticaActual?: Optica | null;
}

type PeriodoFiltro = 'hoy' | '7d' | '30d' | 'este_mes' | 'mes_pasado' | 'este_ano' | 'todo' | 'personalizado';

// Clave y configuración para persistir las tarifas del simulador y mantenerlas fijas
const CLAVE_STORAGE_SIMULADOR_TARIFAS = 'crm_optica_simulador_ia_tarifas';

interface ConfiguracionTarifasSimulador {
  precioEntrada1M: number;
  precioSalida1M: number;
  tasaCambioCop: number;
  conversacionesMensualesSimuladas: number;
  mensajesPorConversacionSimulados: number;
  presetSeleccionado: string;
}

const PRESETS_TARIFAS_MODELOS: Record<string, { nombre: string; entrada: number; salida: number }> = {
  gemini_flash: {
    nombre: 'Gemini Flash',
    entrada: 0.075,
    salida: 0.30,
  },
  gpt4o_mini: {
    nombre: 'GPT-4o Mini',
    entrada: 0.150,
    salida: 0.600,
  },
  gpt6_luna: {
    nombre: 'GPT-6 Luna (OpenAI)',
    entrada: 0.300,
    salida: 1.200,
  },
};

const obtenerTarifasPersistidas = (): ConfiguracionTarifasSimulador => {
  const porDefecto: ConfiguracionTarifasSimulador = {
    precioEntrada1M: 0.075,
    precioSalida1M: 0.30,
    tasaCambioCop: 4200,
    conversacionesMensualesSimuladas: 500,
    mensajesPorConversacionSimulados: 4,
    presetSeleccionado: 'gemini_flash',
  };

  if (typeof window === 'undefined') return porDefecto;

  try {
    const raw = localStorage.getItem(CLAVE_STORAGE_SIMULADOR_TARIFAS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        precioEntrada1M: typeof parsed.precioEntrada1M === 'number' ? parsed.precioEntrada1M : porDefecto.precioEntrada1M,
        precioSalida1M: typeof parsed.precioSalida1M === 'number' ? parsed.precioSalida1M : porDefecto.precioSalida1M,
        tasaCambioCop: typeof parsed.tasaCambioCop === 'number' ? parsed.tasaCambioCop : porDefecto.tasaCambioCop,
        conversacionesMensualesSimuladas: typeof parsed.conversacionesMensualesSimuladas === 'number' ? parsed.conversacionesMensualesSimuladas : porDefecto.conversacionesMensualesSimuladas,
        mensajesPorConversacionSimulados: typeof parsed.mensajesPorConversacionSimulados === 'number' ? parsed.mensajesPorConversacionSimulados : porDefecto.mensajesPorConversacionSimulados,
        presetSeleccionado: parsed.presetSeleccionado || 'personalizado',
      };
    }
  } catch (e) {
    console.warn('Error leyendo tarifas del simulador:', e);
  }

  return porDefecto;
};

export const ModuloConsumo: React.FC<PropiedadesModuloConsumo> = ({
  opticas,
  opticaActual,
}) => {
  // Filtros principales
  const [opticaSeleccionada, setOpticaSeleccionada] = useState<string>('todas');
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<PeriodoFiltro>('30d');
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [tipoEventoFiltro, setTipoEventoFiltro] = useState<string>('todos');
  const [modeloFiltro, setModeloFiltro] = useState<string>('todos');
  const [modelosDisponibles, setModelosDisponibles] = useState<string[]>([]);
  const [tiposEventoDisponibles, setTiposEventoDisponibles] = useState<string[]>([]);

  // Estados de datos
  const [cargando, setCargando] = useState(true);
  const [resumen, setResumen] = useState<ResumenConsumoIA | null>(null);
  const [tendencia, setTendencia] = useState<TendenciaDiariaConsumoIA[]>([]);
  const [historial, setHistorial] = useState<RegistroConsumoIA[]>([]);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Estados de la Calculadora de Costos con persistencia fija
  const [tarifasIniciales] = useState<ConfiguracionTarifasSimulador>(obtenerTarifasPersistidas);
  const [precioEntrada1M, setPrecioEntrada1M] = useState<number>(tarifasIniciales.precioEntrada1M);
  const [precioSalida1M, setPrecioSalida1M] = useState<number>(tarifasIniciales.precioSalida1M);
  const [tasaCambioCop, setTasaCambioCop] = useState<number>(tarifasIniciales.tasaCambioCop);
  const [conversacionesMensualesSimuladas, setConversacionesMensualesSimuladas] = useState<number>(tarifasIniciales.conversacionesMensualesSimuladas);
  const [mensajesPorConversacionSimulados, setMensajesPorConversacionSimulados] = useState<number>(tarifasIniciales.mensajesPorConversacionSimulados);
  const [presetTarifa, setPresetTarifa] = useState<string>(tarifasIniciales.presetSeleccionado);
  const [alertaGuardadoFijo, setAlertaGuardadoFijo] = useState<boolean>(false);

  // Guardar automáticamente cada vez que cambien para mantenerlos fijos y permanentes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          CLAVE_STORAGE_SIMULADOR_TARIFAS,
          JSON.stringify({
            precioEntrada1M,
            precioSalida1M,
            tasaCambioCop,
            conversacionesMensualesSimuladas,
            mensajesPorConversacionSimulados,
            presetSeleccionado: presetTarifa,
          })
        );
      } catch (e) {
        console.error('Error guardando tarifas en localStorage:', e);
      }
    }
  }, [precioEntrada1M, precioSalida1M, tasaCambioCop, conversacionesMensualesSimuladas, mensajesPorConversacionSimulados, presetTarifa]);

  const aplicarPresetTarifa = (clavePreset: 'gemini_flash' | 'gpt4o_mini' | 'gpt6_luna') => {
    const config = PRESETS_TARIFAS_MODELOS[clavePreset];
    if (config) {
      setPrecioEntrada1M(config.entrada);
      setPrecioSalida1M(config.salida);
      setPresetTarifa(clavePreset);
      setAlertaGuardadoFijo(true);
      setTimeout(() => setAlertaGuardadoFijo(false), 2500);
    }
  };

  const fijarParametrosManualmente = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        CLAVE_STORAGE_SIMULADOR_TARIFAS,
        JSON.stringify({
          precioEntrada1M,
          precioSalida1M,
          tasaCambioCop,
          conversacionesMensualesSimuladas,
          mensajesPorConversacionSimulados,
          presetSeleccionado: presetTarifa,
        })
      );
      setAlertaGuardadoFijo(true);
      setTimeout(() => setAlertaGuardadoFijo(false), 3000);
    }
  };

  const restablecerValoresDefecto = () => {
    const def = PRESETS_TARIFAS_MODELOS.gemini_flash;
    setPrecioEntrada1M(def.entrada);
    setPrecioSalida1M(def.salida);
    setTasaCambioCop(4200);
    setConversacionesMensualesSimuladas(500);
    setMensajesPorConversacionSimulados(4);
    setPresetTarifa('gemini_flash');
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CLAVE_STORAGE_SIMULADOR_TARIFAS);
    }
    setAlertaGuardadoFijo(true);
    setTimeout(() => setAlertaGuardadoFijo(false), 2500);
  };

  // Calcular fechas según el período seleccionado
  const fechasCalculadas = useMemo(() => {
    const ahora = new Date();
    const formatoYMD = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    if (periodoSeleccionado === 'personalizado') {
      return { desde: fechaDesde || undefined, hasta: fechaHasta || undefined };
    }

    if (periodoSeleccionado === 'hoy') {
      const hoyStr = formatoYMD(ahora);
      return { desde: hoyStr, hasta: hoyStr };
    }

    if (periodoSeleccionado === '7d') {
      const hace7Dias = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { desde: formatoYMD(hace7Dias), hasta: formatoYMD(ahora) };
    }

    if (periodoSeleccionado === '30d') {
      const hace30Dias = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { desde: formatoYMD(hace30Dias), hasta: formatoYMD(ahora) };
    }

    if (periodoSeleccionado === 'este_mes') {
      const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
      return { desde: formatoYMD(inicioMes), hasta: formatoYMD(ahora) };
    }

    if (periodoSeleccionado === 'mes_pasado') {
      const inicioMesPasado = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
      const finMesPasado = new Date(ahora.getFullYear(), ahora.getMonth(), 0);
      return { desde: formatoYMD(inicioMesPasado), hasta: formatoYMD(finMesPasado) };
    }

    if (periodoSeleccionado === 'este_ano') {
      const inicioAno = new Date(ahora.getFullYear(), 0, 1);
      return { desde: formatoYMD(inicioAno), hasta: formatoYMD(ahora) };
    }

    return { desde: undefined, hasta: undefined };
  }, [periodoSeleccionado, fechaDesde, fechaHasta]);

  // Cargar métricas desde la API
  const cargarMetricas = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const filtros: FiltrosMetricasConsumoIA = {
        optica_id: opticaSeleccionada === 'todas' ? 'todas' : Number(opticaSeleccionada),
        desde: fechasCalculadas.desde,
        hasta: fechasCalculadas.hasta,
        tipo_evento: tipoEventoFiltro === 'todos' ? undefined : tipoEventoFiltro,
        modelo: modeloFiltro === 'todos' ? undefined : modeloFiltro,
      };

      const res = await obtenerMetricasConsumoIAApi(filtros);
      if (res.exito) {
        setResumen(res.resumen || null);
        setTendencia(res.tendencia_diaria || []);
        setHistorial(res.historial || []);

        if (res.modelos_disponibles && Array.isArray(res.modelos_disponibles)) {
          setModelosDisponibles(res.modelos_disponibles);
        }
        if (res.tipos_evento_disponibles && Array.isArray(res.tipos_evento_disponibles)) {
          setTiposEventoDisponibles(res.tipos_evento_disponibles);
        }

        // Si hay datos reales y el usuario no tiene una configuración guardada fija, sugerir mensajes promedio
        if (res.resumen && res.resumen.total_conversaciones > 0) {
          const configGuardada = typeof window !== 'undefined' ? localStorage.getItem(CLAVE_STORAGE_SIMULADOR_TARIFAS) : null;
          if (!configGuardada) {
            const promedioMsgs = Math.max(1, Math.round(res.resumen.total_mensajes_respondidos / res.resumen.total_conversaciones));
            setMensajesPorConversacionSimulados(promedioMsgs);
          }
        }
      } else {
        setErrorCarga(res.error || 'No se pudieron obtener las métricas de consumo.');
      }
    } catch (err: any) {
      setErrorCarga(err.message || 'Error al conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  }, [opticaSeleccionada, fechasCalculadas, tipoEventoFiltro, modeloFiltro]);

  useEffect(() => {
    cargarMetricas();
  }, [cargarMetricas]);

  // Cálculos de la calculadora en tiempo real
  const calculosCostos = useMemo(() => {
    // Promedios reales obtenidos o fallback estimado
    const promEntrada = Number(resumen?.promedio_tokens_entrada || 180);
    const promSalida = Number(resumen?.promedio_tokens_salida || 90);
    const promTotal = promEntrada + promSalida;

    // Costo por 1 token individual
    const costoPorTokenEntradaUsd = precioEntrada1M / 1_000_000;
    const costoPorTokenSalidaUsd = precioSalida1M / 1_000_000;

    // Costo de 1 mensaje individual
    const costoMensajeUsd = promEntrada * costoPorTokenEntradaUsd + promSalida * costoPorTokenSalidaUsd;
    const costoMensajeCop = costoMensajeUsd * tasaCambioCop;

    // Costo de 1 conversación completa
    const costoConversacionUsd = costoMensajeUsd * mensajesPorConversacionSimulados;
    const costoConversacionCop = costoConversacionUsd * tasaCambioCop;

    // Costo mensual proyectado
    const costoMensualTotalUsd = costoConversacionUsd * conversacionesMensualesSimuladas;
    const costoMensualTotalCop = costoMensualTotalUsd * tasaCambioCop;

    // Tokens totales estimados al mes
    const tokensMensualesEstimados = promTotal * mensajesPorConversacionSimulados * conversacionesMensualesSimuladas;

    return {
      promEntrada,
      promSalida,
      promTotal,
      costoMensajeUsd,
      costoMensajeCop,
      costoConversacionUsd,
      costoConversacionCop,
      costoMensualTotalUsd,
      costoMensualTotalCop,
      tokensMensualesEstimados,
    };
  }, [
    resumen,
    precioEntrada1M,
    precioSalida1M,
    tasaCambioCop,
    conversacionesMensualesSimuladas,
    mensajesPorConversacionSimulados,
  ]);

  // Opciones para el selector de ópticas
  const opcionesOpticas = useMemo(() => {
    return [
      { valor: 'todas', etiqueta: 'Todas las Ópticas (Consolidado Global)' },
      ...opticas.map((o) => ({ valor: String(o.id), etiqueta: o.nombre })),
    ];
  }, [opticas]);

  // Opciones para el selector de modelos de IA (exclusivamente los que existan en la BD)
  const opcionesModelos = useMemo(() => {
    const lista = [{ valor: 'todos', etiqueta: 'Todos los Modelos de IA' }];
    for (const mod of modelosDisponibles) {
      if (mod && mod.trim()) {
        lista.push({ valor: mod, etiqueta: mod });
      }
    }
    return lista;
  }, [modelosDisponibles]);

  // Opciones para el selector de canal/origen (exclusivamente los que existan en la BD)
  const opcionesTiposEvento = useMemo(() => {
    const lista = [{ valor: 'todos', etiqueta: 'Todos los orígenes' }];
    const nombresAmigables: Record<string, string> = {
      chat_whatsapp: 'WhatsApp Clientes (Producción)',
      simulador_prueba: 'Simulador de Pruebas',
    };
    for (const te of tiposEventoDisponibles) {
      if (te && te.trim()) {
        lista.push({
          valor: te,
          etiqueta: nombresAmigables[te] || te,
        });
      }
    }
    return lista;
  }, [tiposEventoDisponibles]);

  // Máximo para escala visual en gráfica diaria
  const maxTokensDia = useMemo(() => {
    if (!tendencia || tendencia.length === 0) return 1000;
    return Math.max(...tendencia.map((t) => Number(t.tokens_totales || 0)), 500);
  }, [tendencia]);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--fondo-principal)',
        overflowY: 'auto',
      }}
    >
      {/* Barra de Filtros y Control de Consumo (Optimizada sin header redundante) */}
      <section
        style={{
          padding: '0.85rem 2rem',
          background: 'var(--fondo-tarjeta)',
          borderBottom: '1px solid var(--borde-tarjeta)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        {/* Fila 1: Filtros de Óptica, Origen, Modelo y Botón Actualizar a su derecha */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.85rem' }}>
          {/* Filtro por Óptica (sin icono) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--texto-principal)' }}>Óptica:</span>
            <SelectorDesplegable
              valor={opticaSeleccionada}
              alCambiar={setOpticaSeleccionada}
              opciones={opcionesOpticas}
              tamano="compacto"
              anchoMinimo="220px"
            />
          </div>

          {/* Filtro por Tipo de Evento / Origen (sin icono) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--texto-principal)' }}>Canal / Origen:</span>
            <SelectorDesplegable
              valor={tipoEventoFiltro}
              alCambiar={setTipoEventoFiltro}
              opciones={opcionesTiposEvento}
              tamano="compacto"
              anchoMinimo="190px"
            />
          </div>

          {/* Filtro por Modelo de IA (sin icono) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--texto-principal)' }}>Modelo IA:</span>
            <SelectorDesplegable
              valor={modeloFiltro}
              alCambiar={setModeloFiltro}
              opciones={opcionesModelos}
              tamano="compacto"
              anchoMinimo="200px"
            />
          </div>

          {/* Botón Actualizar Métricas: SOLO ICONO al lado derecho del filtro de Modelo IA */}
          <EtiquetaTooltip texto={cargando ? 'Actualizando datos...' : 'Actualizar métricas'} posicion="abajo">
            <button
              type="button"
              onClick={cargarMetricas}
              disabled={cargando}
              aria-label="Actualizar métricas"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '34px',
                height: '34px',
                background: cargando ? 'rgba(2, 132, 199, 0.12)' : 'var(--fondo-tarjeta)',
                border: cargando ? '1px solid var(--color-primario)' : '1px solid var(--borde-tarjeta)',
                borderRadius: '8px',
                color: 'var(--color-primario)',
                cursor: cargando ? 'wait' : 'pointer',
                boxShadow: 'var(--sombra-sm)',
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}
            >
              <RefreshCw
                size={15}
                style={{
                  animation: cargando ? 'spin 0.85s linear infinite' : 'none',
                  transformOrigin: 'center center',
                }}
              />
            </button>
          </EtiquetaTooltip>
        </div>

        {/* Fila 2: Filtro de Calendario y Rango de Fechas (sin icono) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--texto-principal)' }}>Período:</span>

          <div
            style={{
              display: 'inline-flex',
              background: 'var(--fondo-principal)',
              padding: '0.2rem',
              borderRadius: '20px',
              border: '1px solid var(--borde-tarjeta)',
              gap: '0.15rem',
            }}
          >
            {[
              { id: 'hoy', etiqueta: 'Hoy' },
              { id: '7d', etiqueta: '7 días' },
              { id: '30d', etiqueta: '30 días' },
              { id: 'este_mes', etiqueta: 'Este Mes' },
              { id: 'mes_pasado', etiqueta: 'Mes Pasado' },
              { id: 'este_ano', etiqueta: 'Este Año' },
              { id: 'todo', etiqueta: 'Histórico' },
              { id: 'personalizado', etiqueta: 'Personalizado' },
            ].map((p) => {
              const activo = periodoSeleccionado === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriodoSeleccionado(p.id as PeriodoFiltro)}
                  style={{
                    background: activo ? 'var(--color-primario)' : 'transparent',
                    color: activo ? '#ffffff' : 'var(--texto-atenuado)',
                    border: 'none',
                    borderRadius: '16px',
                    padding: '0.25rem 0.65rem',
                    fontSize: '0.72rem',
                    fontWeight: activo ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {p.etiqueta}
                </button>
              );
            })}
          </div>

          {/* Rango Personalizado con SelectorFecha Corporativo Premium */}
          {periodoSeleccionado === 'personalizado' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.25rem' }}>
              <SelectorFecha
                valor={fechaDesde}
                alCambiar={setFechaDesde}
                placeholder="Fecha inicial"
                anchoMinimo="150px"
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--texto-atenuado)', fontWeight: 600 }}>a</span>
              <SelectorFecha
                valor={fechaHasta}
                alCambiar={setFechaHasta}
                placeholder="Fecha final"
                anchoMinimo="150px"
              />
            </div>
          )}
        </div>
      </section>

      {/* Contenido Principal */}
      <div style={{ padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {errorCarga && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radio-md)',
              padding: '0.75rem 1rem',
              color: '#ef4444',
              fontSize: '0.8rem',
            }}
          >
            {errorCarga}
          </div>
        )}

        {/* 3. REJILLA DE 4 TARJETAS KPI PRINCIPALES */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* TARJETA 1: CONSUMO PROMEDIO TOKEN POR MENSAJE ENVIADO (REQUERIMIENTO CLAVE) */}
          <div
            style={{
              background: 'var(--fondo-tarjeta)',
              border: '1px solid var(--borde-tarjeta)',
              borderRadius: 'var(--radio-lg)',
              padding: '1.25rem',
              boxShadow: 'var(--sombra-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--texto-atenuado)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Promedio Tokens / Mensaje
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(2, 132, 199, 0.12)',
                  color: 'var(--color-primario)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Zap size={16} />
              </div>
            </div>

            {/* Valor en Grande del Consumo del Mensaje */}
            <div style={{ marginTop: '0.65rem' }}>
              <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--texto-principal)', lineHeight: '1.1' }}>
                {resumen?.promedio_tokens_totales
                  ? Math.round(Number(resumen.promedio_tokens_totales)).toLocaleString('es-CO')
                  : '0'}{' '}
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--texto-atenuado)' }}>tokens</span>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--texto-atenuado)' }}>
                Gasto promedio por cada respuesta del agente
              </span>
            </div>

            {/* Abajo: Promedio Entrada y Promedio Salida */}
            <div
              style={{
                marginTop: '1rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--borde-tarjeta)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.65rem',
              }}
            >
              <div
                style={{
                  background: 'rgba(2, 132, 199, 0.06)',
                  padding: '0.4rem 0.6rem',
                  borderRadius: 'var(--radio-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#0284c7', fontSize: '0.66rem', fontWeight: 700 }}>
                  <ArrowDownRight size={12} />
                  <span>Entrada</span>
                </div>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--texto-principal)' }}>
                  {resumen?.promedio_tokens_entrada ? Number(resumen.promedio_tokens_entrada).toLocaleString('es-CO') : '0'}
                </span>
              </div>

              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.06)',
                  padding: '0.4rem 0.6rem',
                  borderRadius: 'var(--radio-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#10b981', fontSize: '0.66rem', fontWeight: 700 }}>
                  <ArrowUpRight size={12} />
                  <span>Salida</span>
                </div>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--texto-principal)' }}>
                  {resumen?.promedio_tokens_salida ? Number(resumen.promedio_tokens_salida).toLocaleString('es-CO') : '0'}
                </span>
              </div>
            </div>
          </div>

          {/* TARJETA 2: TOTAL DE MENSAJES ENVIADOS / RESPONDIDOS */}
          <div
            style={{
              background: 'var(--fondo-tarjeta)',
              border: '1px solid var(--borde-tarjeta)',
              borderRadius: 'var(--radio-lg)',
              padding: '1.25rem',
              boxShadow: 'var(--sombra-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--texto-atenuado)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Mensajes Respondidos
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(139, 92, 246, 0.12)',
                  color: '#8b5cf6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MessageSquare size={16} />
              </div>
            </div>

            <div style={{ marginTop: '0.65rem' }}>
              <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--texto-principal)', lineHeight: '1.1' }}>
                {resumen?.total_mensajes_respondidos
                  ? Number(resumen.total_mensajes_respondidos).toLocaleString('es-CO')
                  : '0'}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--texto-atenuado)' }}>
                Respuestas automáticas generadas por el agente
              </span>
            </div>

            <div
              style={{
                marginTop: '1rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--borde-tarjeta)',
                fontSize: '0.72rem',
                color: 'var(--texto-atenuado)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Promedio diario:</span>
              <strong style={{ color: 'var(--texto-principal)' }}>
                {tendencia.length > 0
                  ? Math.round((resumen?.total_mensajes_respondidos || 0) / tendencia.length)
                  : (resumen?.total_mensajes_respondidos || 0)}{' '}
                msgs/día
              </strong>
            </div>
          </div>

          {/* TARJETA 3: TOTAL DE CONVERSACIONES ATENDIDAS */}
          <div
            style={{
              background: 'var(--fondo-tarjeta)',
              border: '1px solid var(--borde-tarjeta)',
              borderRadius: 'var(--radio-lg)',
              padding: '1.25rem',
              boxShadow: 'var(--sombra-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--texto-atenuado)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Conversaciones
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Users size={16} />
              </div>
            </div>

            <div style={{ marginTop: '0.65rem' }}>
              <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--texto-principal)', lineHeight: '1.1' }}>
                {resumen?.total_conversaciones
                  ? Number(resumen.total_conversaciones).toLocaleString('es-CO')
                  : '0'}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--texto-atenuado)' }}>
                Pacientes únicos atendidos en el período
              </span>
            </div>

            <div
              style={{
                marginTop: '1rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--borde-tarjeta)',
                fontSize: '0.72rem',
                color: 'var(--texto-atenuado)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Mensajes por chat:</span>
              <strong style={{ color: 'var(--texto-principal)' }}>
                {resumen && resumen.total_conversaciones > 0
                  ? (resumen.total_mensajes_respondidos / resumen.total_conversaciones).toFixed(1)
                  : '0'}{' '}
                msgs
              </strong>
            </div>
          </div>

          {/* TARJETA 4: TOTAL DE TOKENS ACUMULADOS */}
          <div
            style={{
              background: 'var(--fondo-tarjeta)',
              border: '1px solid var(--borde-tarjeta)',
              borderRadius: 'var(--radio-lg)',
              padding: '1.25rem',
              boxShadow: 'var(--sombra-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--texto-atenuado)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Tokens Acumulados
              </span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.12)',
                  color: '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Coins size={16} />
              </div>
            </div>

            <div style={{ marginTop: '0.65rem' }}>
              <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--texto-principal)', lineHeight: '1.1' }}>
                {resumen?.total_tokens_acumulados
                  ? Number(resumen.total_tokens_acumulados).toLocaleString('es-CO')
                  : '0'}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--texto-atenuado)' }}>
                Volumen total procesado por el proveedor de IA
              </span>
            </div>

            <div
              style={{
                marginTop: '1rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--borde-tarjeta)',
                fontSize: '0.72rem',
                color: 'var(--texto-atenuado)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Entrada: {Number(resumen?.total_tokens_entrada || 0).toLocaleString('es-CO')}</span>
              <span>Salida: {Number(resumen?.total_tokens_salida || 0).toLocaleString('es-CO')}</span>
            </div>
          </div>
        </section>

        {/* 4. CALCULADORA INTERACTIVA DE COSTOS MENSUALES (REQUERIMIENTO PRINCIPAL) */}
        <section
          style={{
            background: 'var(--fondo-tarjeta)',
            border: '1px solid var(--borde-tarjeta)',
            borderRadius: 'var(--radio-lg)',
            padding: '1.5rem',
            boxShadow: 'var(--sombra-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                }}
              >
                <Calculator size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--texto-principal)', margin: 0 }}>
                  Calculadora y Simulador de Costos Mensuales de IA
                </h3>
                <p style={{ fontSize: '0.74rem', color: 'var(--texto-atenuado)', margin: '0.15rem 0 0 0' }}>
                  Ajusta los precios por millón de tokens y el volumen proyectado de conversaciones para simular tu presupuesto real.
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                padding: '0.35rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.72rem',
                color: '#10b981',
                fontWeight: 700,
              }}
            >
              <TrendingUp size={14} />
              <span>Cálculo dinámico basado en tus promedios reales</span>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem',
              alignItems: 'start',
            }}
          >
            {/* Columna Izquierda: Parámetros Configurables */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                background: 'var(--fondo-principal)',
                padding: '1.25rem',
                borderRadius: 'var(--radio-md)',
                border: '1px solid var(--borde-tarjeta)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--texto-principal)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sliders size={15} style={{ color: 'var(--color-primario)' }} />
                  <span>Parámetros de Tarifa y Volumen</span>
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.68rem',
                    color: alertaGuardadoFijo ? '#10b981' : 'var(--texto-atenuado)',
                    background: alertaGuardadoFijo ? 'rgba(16, 185, 129, 0.15)' : 'var(--fondo-tarjeta)',
                    border: alertaGuardadoFijo ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--borde-tarjeta)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '12px',
                    fontWeight: 600,
                    transition: 'all 0.25s ease',
                  }}
                >
                  {alertaGuardadoFijo ? <CheckCircle2 size={12} style={{ color: '#10b981' }} /> : <BookmarkCheck size={12} />}
                  <span>{alertaGuardadoFijo ? 'Parámetros fijados y guardados' : 'Valores fijos en tu navegador'}</span>
                </div>
              </div>

              {/* Selector de Presets Rápidos de Modelos */}
              <div className="modal-campo-grupo">
                <label className="modal-label" style={{ fontSize: '0.72rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>
                  Plantilla de Tarifas Rápidas por Modelo:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  <button
                    type="button"
                    onClick={() => aplicarPresetTarifa('gemini_flash')}
                    style={{
                      padding: '0.25rem 0.55rem',
                      fontSize: '0.69rem',
                      borderRadius: '6px',
                      border: '1px solid var(--borde-tarjeta)',
                      background: presetTarifa === 'gemini_flash' ? 'var(--color-primario)' : 'var(--fondo-tarjeta)',
                      color: presetTarifa === 'gemini_flash' ? '#fff' : 'var(--texto-principal)',
                      cursor: 'pointer',
                      fontWeight: presetTarifa === 'gemini_flash' ? 700 : 500,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Gemini Flash ($0.075 / $0.30)
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarPresetTarifa('gpt4o_mini')}
                    style={{
                      padding: '0.25rem 0.55rem',
                      fontSize: '0.69rem',
                      borderRadius: '6px',
                      border: '1px solid var(--borde-tarjeta)',
                      background: presetTarifa === 'gpt4o_mini' ? 'var(--color-primario)' : 'var(--fondo-tarjeta)',
                      color: presetTarifa === 'gpt4o_mini' ? '#fff' : 'var(--texto-principal)',
                      cursor: 'pointer',
                      fontWeight: presetTarifa === 'gpt4o_mini' ? 700 : 500,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    GPT-4o Mini ($0.15 / $0.60)
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarPresetTarifa('gpt6_luna')}
                    style={{
                      padding: '0.25rem 0.55rem',
                      fontSize: '0.69rem',
                      borderRadius: '6px',
                      border: '1px solid var(--borde-tarjeta)',
                      background: presetTarifa === 'gpt6_luna' ? 'var(--color-primario)' : 'var(--fondo-tarjeta)',
                      color: presetTarifa === 'gpt6_luna' ? '#fff' : 'var(--texto-principal)',
                      cursor: 'pointer',
                      fontWeight: presetTarifa === 'gpt6_luna' ? 700 : 500,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    GPT-6 Luna ($0.30 / $1.20)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetTarifa('personalizado')}
                    style={{
                      padding: '0.25rem 0.55rem',
                      fontSize: '0.69rem',
                      borderRadius: '6px',
                      border: '1px solid var(--borde-tarjeta)',
                      background: presetTarifa === 'personalizado' ? 'var(--color-primario)' : 'var(--fondo-tarjeta)',
                      color: presetTarifa === 'personalizado' ? '#fff' : 'var(--texto-principal)',
                      cursor: 'pointer',
                      fontWeight: presetTarifa === 'personalizado' ? 700 : 500,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Personalizado
                  </button>
                </div>
              </div>

              {/* Precio 1M Tokens Entrada */}
              <div className="modal-campo-grupo">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="modal-label" style={{ fontSize: '0.74rem', fontWeight: 600 }}>
                    Precio 1 Millón Tokens Entrada ($ USD)
                  </label>
                  <span style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)' }}>
                    {presetTarifa === 'personalizado' ? 'Tarifa manual fija' : `Preset: ${PRESETS_TARIFAS_MODELOS[presetTarifa]?.nombre || ''}`}
                  </span>
                </div>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={precioEntrada1M}
                  onChange={(e) => {
                    setPrecioEntrada1M(parseFloat(e.target.value) || 0);
                    setPresetTarifa('personalizado');
                  }}
                  className="modal-input"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
                />
              </div>

              {/* Precio 1M Tokens Salida */}
              <div className="modal-campo-grupo">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="modal-label" style={{ fontSize: '0.74rem', fontWeight: 600 }}>
                    Precio 1 Millón Tokens Salida ($ USD)
                  </label>
                  <span style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)' }}>
                    {presetTarifa === 'personalizado' ? 'Tarifa manual fija' : `Preset: ${PRESETS_TARIFAS_MODELOS[presetTarifa]?.nombre || ''}`}
                  </span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={precioSalida1M}
                  onChange={(e) => {
                    setPrecioSalida1M(parseFloat(e.target.value) || 0);
                    setPresetTarifa('personalizado');
                  }}
                  className="modal-input"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
                />
              </div>

              {/* Cantidad Proyectada de Conversaciones al Mes */}
              <div className="modal-campo-grupo">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="modal-label" style={{ fontSize: '0.74rem', fontWeight: 600 }}>
                    Conversaciones Estimadas al Mes
                  </label>
                  <strong style={{ fontSize: '0.76rem', color: 'var(--color-primario)' }}>
                    {conversacionesMensualesSimuladas.toLocaleString('es-CO')} chats
                  </strong>
                </div>
                <input
                  type="range"
                  min="50"
                  max="10000"
                  step="50"
                  value={conversacionesMensualesSimuladas}
                  onChange={(e) => setConversacionesMensualesSimuladas(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: 'var(--color-primario)', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.25rem' }}>
                  {[100, 500, 1000, 2500, 5000].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setConversacionesMensualesSimuladas(num)}
                      style={{
                        padding: '0.2rem 0.45rem',
                        fontSize: '0.68rem',
                        borderRadius: '6px',
                        border: '1px solid var(--borde-tarjeta)',
                        background: conversacionesMensualesSimuladas === num ? 'var(--color-primario)' : 'var(--fondo-tarjeta)',
                        color: conversacionesMensualesSimuladas === num ? '#fff' : 'var(--texto-atenuado)',
                        cursor: 'pointer',
                      }}
                    >
                      {num.toLocaleString('es-CO')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mensajes promedio por conversación */}
              <div className="modal-campo-grupo">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="modal-label" style={{ fontSize: '0.74rem', fontWeight: 600 }}>
                    Mensajes promedio por conversación
                  </label>
                  <strong style={{ fontSize: '0.76rem', color: 'var(--color-primario)' }}>
                    {mensajesPorConversacionSimulados} msgs
                  </strong>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={mensajesPorConversacionSimulados}
                  onChange={(e) => setMensajesPorConversacionSimulados(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: 'var(--color-primario)', cursor: 'pointer' }}
                />
              </div>

              {/* Tasa de cambio USD -> COP */}
              <div className="modal-campo-grupo">
                <label className="modal-label" style={{ fontSize: '0.74rem', fontWeight: 600 }}>
                  Tasa de Cambio (1 USD en Pesos Colombianos COP)
                </label>
                <input
                  type="number"
                  step="50"
                  min="1000"
                  value={tasaCambioCop}
                  onChange={(e) => setTasaCambioCop(parseFloat(e.target.value) || 4200)}
                  className="modal-input"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
                />
              </div>

              {/* Botones de Acción para Fijar y Guardar */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--borde-tarjeta)' }}>
                <button
                  type="button"
                  onClick={fijarParametrosManualmente}
                  style={{
                    flex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    background: 'var(--color-primario)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  }}
                >
                  <Save size={14} />
                  <span>Fijar y Guardar Parámetros</span>
                </button>
                <button
                  type="button"
                  onClick={restablecerValoresDefecto}
                  title="Restablecer valores originales"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    background: 'var(--fondo-tarjeta)',
                    color: 'var(--texto-atenuado)',
                    border: '1px solid var(--borde-tarjeta)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={13} />
                  <span>Restablecer</span>
                </button>
              </div>
            </div>

            {/* Columna Derecha: Resultados y Proyecciones de Costo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Tarjeta Destacada: Costo Mensual Total */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.05) 100%)',
                  border: '1.5px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: 'var(--radio-lg)',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>
                    Costo Mensual Estimado
                  </span>
                  <DollarSign size={20} style={{ color: '#059669' }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '2.1rem', fontWeight: 900, color: 'var(--texto-principal)', lineHeight: 1 }}>
                    ${calculosCostos.costoMensualTotalUsd.toFixed(2)} USD
                  </span>
                  <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#059669' }}>
                    ≈ ${Math.round(calculosCostos.costoMensualTotalCop).toLocaleString('es-CO')} COP
                  </span>
                </div>

                <p style={{ fontSize: '0.74rem', color: 'var(--texto-atenuado)', margin: 0 }}>
                  Proyección para <strong>{conversacionesMensualesSimuladas.toLocaleString('es-CO')}</strong> conversaciones
                  atendidas (~{(conversacionesMensualesSimuladas * mensajesPorConversacionSimulados).toLocaleString('es-CO')} respuestas al mes).
                </p>
              </div>

              {/* Desglose Unitario: Costo por Mensaje y por Conversación */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.85rem',
                }}
              >
                {/* Costo por Mensaje */}
                <div
                  style={{
                    background: 'var(--fondo-principal)',
                    border: '1px solid var(--borde-tarjeta)',
                    borderRadius: 'var(--radio-md)',
                    padding: '1rem',
                  }}
                >
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--texto-atenuado)' }}>
                    Costo por Mensaje Individual
                  </span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--texto-principal)', marginTop: '0.2rem' }}>
                    ${calculosCostos.costoMensajeUsd.toFixed(5)} USD
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600 }}>
                    ≈ ${calculosCostos.costoMensajeCop.toFixed(2)} COP
                  </div>
                  <span style={{ fontSize: '0.66rem', color: 'var(--texto-atenuado)', display: 'block', marginTop: '0.35rem' }}>
                    Basado en {calculosCostos.promTotal} tokens promedio
                  </span>
                </div>

                {/* Costo por Conversación */}
                <div
                  style={{
                    background: 'var(--fondo-principal)',
                    border: '1px solid var(--borde-tarjeta)',
                    borderRadius: 'var(--radio-md)',
                    padding: '1rem',
                  }}
                >
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--texto-atenuado)' }}>
                    Costo por Conversación Completa
                  </span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--texto-principal)', marginTop: '0.2rem' }}>
                    ${calculosCostos.costoConversacionUsd.toFixed(4)} USD
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
                    ≈ ${calculosCostos.costoConversacionCop.toFixed(1)} COP
                  </div>
                  <span style={{ fontSize: '0.66rem', color: 'var(--texto-atenuado)', display: 'block', marginTop: '0.35rem' }}>
                    {mensajesPorConversacionSimulados} respuestas por chat
                  </span>
                </div>
              </div>

              {/* Tarjeta de Ahorro y Eficiencia */}
              <div
                style={{
                  background: 'rgba(2, 132, 199, 0.05)',
                  border: '1px solid rgba(2, 132, 199, 0.2)',
                  borderRadius: 'var(--radio-md)',
                  padding: '0.85rem 1rem',
                  fontSize: '0.73rem',
                  color: 'var(--texto-principal)',
                  lineHeight: '1.45',
                }}
              >
                <strong style={{ color: 'var(--color-primario)' }}>💡 Ventaja Operativa:</strong> Un call center o asesor humano
                dedicado cuesta aproximadamente <strong>$1.600.000 COP</strong> mensuales por clínica. El agente con IA atiende
                24/7 de manera inmediata con un costo de tokens menor a <strong>${Math.round(calculosCostos.costoMensualTotalCop).toLocaleString('es-CO')} COP</strong> mensuales.
              </div>
            </div>
          </div>
        </section>

        {/* 5. GRÁFICA DE TENDENCIA DIARIA DE CONSUMO */}
        <section
          style={{
            background: 'var(--fondo-tarjeta)',
            border: '1px solid var(--borde-tarjeta)',
            borderRadius: 'var(--radio-lg)',
            padding: '1.5rem',
            boxShadow: 'var(--sombra-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart3 size={17} style={{ color: 'var(--color-primario)' }} />
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--texto-principal)', margin: 0 }}>
                Tendencia Diaria de Consumo de Tokens
              </h4>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.72rem', color: 'var(--texto-atenuado)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#0284c7' }} />
                Tokens Entrada
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#10b981' }} />
                Tokens Salida
              </span>
            </div>
          </div>

          {tendencia.length === 0 ? (
            <div
              style={{
                padding: '2.5rem',
                textAlign: 'center',
                color: 'var(--texto-atenuado)',
                fontSize: '0.8rem',
                background: 'var(--fondo-principal)',
                borderRadius: 'var(--radio-md)',
              }}
            >
              No hay registros de consumo registrados para el período o filtros seleccionados.
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '0.75rem',
                height: '180px',
                padding: '1rem 0.5rem 0.5rem',
                background: 'var(--fondo-principal)',
                borderRadius: 'var(--radio-md)',
                overflowX: 'auto',
              }}
            >
              {tendencia.map((dia, idx) => {
                const totalDia = Number(dia.tokens_totales || 0);
                const entradaDia = Number(dia.tokens_entrada || 0);
                const salidaDia = Number(dia.tokens_salida || 0);
                const alturaPorcentaje = Math.max(10, Math.min(100, Math.round((totalDia / maxTokensDia) * 100)));

                return (
                  <div
                    key={idx}
                    style={{
                      flex: '1 0 45px',
                      maxWidth: '65px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.4rem',
                      height: '100%',
                      justifyContent: 'flex-end',
                    }}
                    title={`Fecha: ${dia.fecha}\nTotal: ${totalDia.toLocaleString('es-CO')} tokens\nEntrada: ${entradaDia.toLocaleString('es-CO')}\nSalida: ${salidaDia.toLocaleString('es-CO')}\nMensajes: ${dia.total_mensajes}`}
                  >
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--texto-principal)' }}>
                      {totalDia > 1000 ? `${(totalDia / 1000).toFixed(1)}k` : totalDia}
                    </span>

                    {/* Barra apilada: Entrada + Salida */}
                    <div
                      style={{
                        width: '18px',
                        height: `${alturaPorcentaje}%`,
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        background: '#e2e8f0',
                      }}
                    >
                      <div
                        style={{
                          flex: totalDia > 0 ? entradaDia / totalDia : 0.5,
                          background: '#0284c7',
                        }}
                      />
                      <div
                        style={{
                          flex: totalDia > 0 ? salidaDia / totalDia : 0.5,
                          background: '#10b981',
                        }}
                      />
                    </div>

                    <span style={{ fontSize: '0.65rem', color: 'var(--texto-atenuado)', whiteSpace: 'nowrap' }}>
                      {dia.fecha.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 6. TABLA DETALLADA DE AUDITORÍA Y HISTORIAL */}
        <section
          style={{
            background: 'var(--fondo-tarjeta)',
            border: '1px solid var(--borde-tarjeta)',
            borderRadius: 'var(--radio-lg)',
            padding: '1.5rem',
            boxShadow: 'var(--sombra-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={17} style={{ color: 'var(--color-primario)' }} />
              <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--texto-principal)', margin: 0 }}>
                Últimos Registros de Auditoría
              </h4>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--texto-atenuado)' }}>
              Mostrando los 50 eventos más recientes
            </span>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--borde-tarjeta)', borderRadius: 'var(--radio-md)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.76rem' }}>
              <thead>
                <tr style={{ background: 'var(--fondo-principal)', borderBottom: '1px solid var(--borde-tarjeta)', color: 'var(--texto-atenuado)' }}>
                  <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>Fecha y Hora</th>
                  <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>Óptica</th>
                  <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>Canal / Origen</th>
                  <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>Modelo IA</th>
                  <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, textAlign: 'right' }}>Entrada</th>
                  <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, textAlign: 'right' }}>Salida</th>
                  <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, textAlign: 'right' }}>Total Tokens</th>
                  <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, textAlign: 'right' }}>Costo Est. ($ USD)</th>
                </tr>
              </thead>
              <tbody>
                {historial.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--texto-atenuado)' }}>
                      No hay registros para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  historial.map((reg) => {
                    const costoFilaUsd =
                      (reg.tokens_entrada * precioEntrada1M) / 1_000_000 +
                      (reg.tokens_salida * precioSalida1M) / 1_000_000;

                    return (
                      <tr
                        key={reg.id}
                        style={{
                          borderBottom: '1px solid var(--borde-tarjeta)',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '0.65rem 0.85rem', whiteSpace: 'nowrap', color: 'var(--texto-principal)' }}>
                          {new Date(reg.creado_en).toLocaleString('es-CO', {
                            dateStyle: 'short',
                            timeStyle: 'medium',
                          })}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--texto-principal)', fontWeight: 600 }}>
                          {reg.nombre_optica || `Óptica #${reg.optica_id}`}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '12px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              background:
                                reg.tipo_evento === 'chat_whatsapp'
                                  ? 'rgba(16, 185, 129, 0.12)'
                                  : 'rgba(2, 132, 199, 0.12)',
                              color: reg.tipo_evento === 'chat_whatsapp' ? '#10b981' : '#0284c7',
                            }}
                          >
                            {reg.tipo_evento === 'chat_whatsapp' ? 'WhatsApp' : 'Simulador'}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--texto-atenuado)' }}>
                          {reg.modelo}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: '#0284c7', fontWeight: 600 }}>
                          {reg.tokens_entrada.toLocaleString('es-CO')}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: '#10b981', fontWeight: 600 }}>
                          {reg.tokens_salida.toLocaleString('es-CO')}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', fontWeight: 800, color: 'var(--texto-principal)' }}>
                          {reg.tokens_totales.toLocaleString('es-CO')}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right', color: 'var(--texto-atenuado)' }}>
                          ${costoFilaUsd.toFixed(5)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
