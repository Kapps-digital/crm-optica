'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Target,
  Plus,
  Sliders,
  Calendar,
  CalendarClock,
  Glasses,
  Laptop,
  Eye,
  Sparkles,
  UserX,
  Users,
  Filter,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import type { CriteriosSegmento, Segmento } from '@/tipos/crm';
import { crearSegmentoPersonalizado, actualizarSegmentoPersonalizado } from '@/servicios/api_crm';
import { SelectorDesplegable } from '../comunes/SelectorDesplegable';

interface PropiedadesModalCrearSegmento {
  abierto: boolean;
  alCerrar: () => void;
  alGuardarExitoso: (segmento: Segmento) => void;
  segmentoParaEditar?: Segmento | null;
}

const ICONOS_DISPONIBLES = [
  { id: 'Target', etiqueta: 'Objetivo', icono: Target },
  { id: 'Users', etiqueta: 'Género / Pacientes', icono: Users },
  { id: 'CalendarClock', etiqueta: 'Calendario', icono: CalendarClock },
  { id: 'Glasses', etiqueta: 'Gafas', icono: Glasses },
  { id: 'Laptop', etiqueta: 'Pantallas', icono: Laptop },
  { id: 'Eye', etiqueta: 'Ojo / Visión', icono: Eye },
  { id: 'Sparkles', etiqueta: 'Especial', icono: Sparkles },
  { id: 'UserX', etiqueta: 'Inactivo', icono: UserX },
];

const COLORES_DISPONIBLES = [
  '#0284c7', // Azul brillante
  '#db2777', // Rosa fucsia / Género
  '#10b981', // Verde esmeralda
  '#8b5cf6', // Violeta
  '#ea580c', // Naranja
  '#06b6d4', // Cyan
  '#ec4899', // Rosa
  '#64748b', // Gris corporativo
];

export const ModalCrearSegmento: React.FC<PropiedadesModalCrearSegmento> = ({
  abierto,
  alCerrar,
  alGuardarExitoso,
  segmentoParaEditar,
}) => {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [icono, setIcono] = useState('Target');
  const [color, setColor] = useState('#0284c7');

  // Criterios de filtrado
  const [activarControlVencido, setActivarControlVencido] = useState(false);
  const [mesesControl, setMesesControl] = useState<number>(12);

  const [activarEdad, setActivarEdad] = useState(false);
  const [edadMinima, setEdadMinima] = useState<string>('');
  const [edadMaxima, setEdadMaxima] = useState<string>('');

  const [requiereAdicion, setRequiereAdicion] = useState(false);

  const [activarTipoLente, setActivarTipoLente] = useState(false);
  const [tipoLente, setTipoLente] = useState('Monofocal');

  const [activarCilindro, setActivarCilindro] = useState(false);
  const [cilindroMinimo, setCilindroMinimo] = useState<number>(2.0);

  const [activarInactividad, setActivarInactividad] = useState(false);
  const [diasInactividad, setDiasInactividad] = useState<number>(180);

  const [activarSexo, setActivarSexo] = useState(false);
  const [sexoSeleccionado, setSexoSeleccionado] = useState<'femenino' | 'masculino'>('femenino');

  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);

  // Estado para ventana emergente de confirmación / resumen
  const [modalConfirmacionAbierto, setModalConfirmacionAbierto] = useState(false);

  // Función para resetear completamente el formulario a blanco
  const limpiarFormulario = () => {
    setNombre('');
    setDescripcion('');
    setIcono('Target');
    setColor('#0284c7');
    setActivarControlVencido(false);
    setMesesControl(12);
    setActivarEdad(false);
    setEdadMinima('');
    setEdadMaxima('');
    setRequiereAdicion(false);
    setActivarTipoLente(false);
    setTipoLente('Monofocal');
    setActivarCilindro(false);
    setCilindroMinimo(2.0);
    setActivarInactividad(false);
    setDiasInactividad(180);
    setActivarSexo(false);
    setSexoSeleccionado('femenino');
    setErrorFormulario(null);
    setModalConfirmacionAbierto(false);
  };

  const manejarCerrar = () => {
    limpiarFormulario();
    alCerrar();
  };

  // Cargar datos al abrir (si es edición prellena, si es creación limpia)
  useEffect(() => {
    if (!abierto) {
      limpiarFormulario();
      return;
    }

    if (segmentoParaEditar) {
      setNombre(segmentoParaEditar.nombre || '');
      setDescripcion(segmentoParaEditar.descripcion || '');
      setIcono(segmentoParaEditar.icono || 'Target');
      setColor(segmentoParaEditar.color || '#0284c7');

      const crit: CriteriosSegmento =
        typeof segmentoParaEditar.criterios_json === 'string'
          ? JSON.parse(segmentoParaEditar.criterios_json)
          : (segmentoParaEditar.criterios_json || segmentoParaEditar.criterios || {});

      if (crit.control_vencido_meses) {
        setActivarControlVencido(true);
        setMesesControl(Number(crit.control_vencido_meses) || 12);
      } else {
        setActivarControlVencido(false);
        setMesesControl(12);
      }

      if (crit.edad_minima !== undefined || crit.edad_maxima !== undefined) {
        setActivarEdad(true);
        setEdadMinima(crit.edad_minima !== undefined && crit.edad_minima !== null ? String(crit.edad_minima) : '');
        setEdadMaxima(crit.edad_maxima !== undefined && crit.edad_maxima !== null ? String(crit.edad_maxima) : '');
      } else {
        setActivarEdad(false);
        setEdadMinima('');
        setEdadMaxima('');
      }

      setRequiereAdicion(!!crit.tiene_adicion);

      if (crit.tipo_lente) {
        setActivarTipoLente(true);
        setTipoLente(crit.tipo_lente);
      } else {
        setActivarTipoLente(false);
        setTipoLente('Monofocal');
      }

      if (crit.cilindro_minimo) {
        setActivarCilindro(true);
        setCilindroMinimo(Number(crit.cilindro_minimo) || 2.0);
      } else {
        setActivarCilindro(false);
        setCilindroMinimo(2.0);
      }

      if (crit.dias_sin_cita) {
        setActivarInactividad(true);
        setDiasInactividad(Number(crit.dias_sin_cita) || 180);
      } else {
        setActivarInactividad(false);
        setDiasInactividad(180);
      }

      if (crit.sexo) {
        setActivarSexo(true);
        setSexoSeleccionado(crit.sexo === 'masculino' ? 'masculino' : 'femenino');
      } else {
        setActivarSexo(false);
        setSexoSeleccionado('femenino');
      }
    } else {
      limpiarFormulario();
    }
  }, [abierto, segmentoParaEditar]);

  // Cerrar con tecla Escape
  useEffect(() => {
    const alPresionarEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && abierto) {
        if (modalConfirmacionAbierto) {
          setModalConfirmacionAbierto(false);
        } else {
          manejarCerrar();
        }
      }
    };
    window.addEventListener('keydown', alPresionarEscape);
    return () => window.removeEventListener('keydown', alPresionarEscape);
  }, [abierto, modalConfirmacionAbierto]);

  // Validación estricta para activar el botón Crear Segmento / Guardar Cambios
  const formularioValido = useMemo(() => {
    if (!nombre.trim()) return false;

    const algunCriterioActivo =
      activarControlVencido ||
      activarEdad ||
      requiereAdicion ||
      activarTipoLente ||
      activarCilindro ||
      activarInactividad ||
      activarSexo;

    if (!algunCriterioActivo) return false;

    // Si se activa rango de edad, debe ingresar al menos un valor numérico válido
    if (activarEdad) {
      const minLleno = edadMinima.trim() !== '';
      const maxLleno = edadMaxima.trim() !== '';
      if (!minLleno && !maxLleno) return false;
      if (minLleno && maxLleno && Number(edadMinima) > Number(edadMaxima)) {
        return false;
      }
    }

    if (activarControlVencido && (!mesesControl || mesesControl <= 0)) {
      return false;
    }

    if (activarTipoLente && !tipoLente.trim()) {
      return false;
    }

    if (activarCilindro && (!cilindroMinimo || cilindroMinimo <= 0)) {
      return false;
    }

    if (activarInactividad && (!diasInactividad || diasInactividad <= 0)) {
      return false;
    }

    return true;
  }, [
    nombre,
    activarControlVencido,
    mesesControl,
    activarEdad,
    edadMinima,
    edadMaxima,
    requiereAdicion,
    activarTipoLente,
    tipoLente,
    activarCilindro,
    cilindroMinimo,
    activarInactividad,
    diasInactividad,
    activarSexo,
    sexoSeleccionado,
  ]);

  if (!abierto) return null;

  // Paso 1: Abrir ventana emergente de resumen y confirmación
  const manejarSolicitarConfirmacion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formularioValido) {
      setErrorFormulario('Verifica que el nombre y los criterios seleccionados estén diligenciados.');
      return;
    }
    setErrorFormulario(null);
    setModalConfirmacionAbierto(true);
  };

  // Paso 2: Ejecutar guardado definitivo tras confirmar
  const manejarGuardarConfirmado = async () => {
    const criterios: CriteriosSegmento = {};

    if (activarControlVencido) {
      criterios.control_vencido_meses = Number(mesesControl) || 12;
    }

    if (activarEdad) {
      if (edadMinima !== '') criterios.edad_minima = Number(edadMinima);
      if (edadMaxima !== '') criterios.edad_maxima = Number(edadMaxima);
    }

    if (requiereAdicion) {
      criterios.tiene_adicion = true;
    }

    if (activarTipoLente && tipoLente.trim()) {
      criterios.tipo_lente = tipoLente.trim();
    }

    if (activarCilindro) {
      criterios.cilindro_minimo = Number(cilindroMinimo) || 2.0;
    }

    if (activarInactividad) {
      criterios.dias_sin_cita = Number(diasInactividad) || 180;
    }

    if (activarSexo) {
      criterios.sexo = sexoSeleccionado;
    }

    setGuardando(true);
    setErrorFormulario(null);

    try {
      let res;
      if (segmentoParaEditar) {
        res = await actualizarSegmentoPersonalizado(segmentoParaEditar.id, {
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || undefined,
          icono,
          color,
          criterios,
        });
      } else {
        res = await crearSegmentoPersonalizado({
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || undefined,
          icono,
          color,
          criterios,
        });
      }

      if (res.exito && res.segmento) {
        alGuardarExitoso(res.segmento);
        manejarCerrar();
      } else {
        setErrorFormulario(res.error || 'No se pudo procesar el segmento.');
        setModalConfirmacionAbierto(false);
      }
    } catch (err: unknown) {
      const msj = err instanceof Error ? err.message : 'Error al guardar segmento';
      setErrorFormulario(msj);
      setModalConfirmacionAbierto(false);
    } finally {
      setGuardando(false);
    }
  };

  // Resumen legible de criterios para la ventana de confirmación
  const listaResumenCriterios = [];
  if (activarControlVencido) {
    listaResumenCriterios.push(`Control visual vencido: Más de ${mesesControl} meses sin revisión`);
  }
  if (activarEdad) {
    if (edadMinima && edadMaxima) {
      listaResumenCriterios.push(`Rango de edad: De ${edadMinima} a ${edadMaxima} años`);
    } else if (edadMinima) {
      listaResumenCriterios.push(`Rango de edad: A partir de ${edadMinima} años`);
    } else if (edadMaxima) {
      listaResumenCriterios.push(`Rango de edad: Hasta ${edadMaxima} años`);
    }
  }
  if (requiereAdicion) {
    listaResumenCriterios.push('Presbicia: Fórmula con adición cercana formulada o mayor de 40 años');
  }
  if (activarTipoLente) {
    listaResumenCriterios.push(`Tipo de lente: ${tipoLente}`);
  }
  if (activarCilindro) {
    listaResumenCriterios.push(`Astigmatismo / Cilindro: Mayor o igual a ${cilindroMinimo} D`);
  }
  if (activarInactividad) {
    listaResumenCriterios.push(`Inactividad: Sin citas registradas en los últimos ${diasInactividad} días`);
  }
  if (activarSexo) {
    listaResumenCriterios.push(`Género: Pacientes de sexo ${sexoSeleccionado === 'femenino' ? 'Femenino' : 'Masculino'}`);
  }

  const IconoSeleccionado = ICONOS_DISPONIBLES.find((i) => i.id === icono)?.icono || Target;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !modalConfirmacionAbierto) manejarCerrar();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--fondo-tarjeta)',
          border: '1px solid var(--borde-tarjeta)',
          borderRadius: 'var(--radio-lg)',
          width: '100%',
          maxWidth: '580px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--sombra-lg)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
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
                borderRadius: '8px',
                backgroundColor: color,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sliders size={20} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: 'var(--texto-principal)',
                  margin: 0,
                }}
              >
                {segmentoParaEditar?.es_sistema
                  ? 'Personalizar Segmento Predeterminado'
                  : segmentoParaEditar
                  ? 'Editar Segmento Personalizado'
                  : 'Nuevo Segmento Personalizado'}
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--texto-atenuado)', margin: 0 }}>
                {segmentoParaEditar
                  ? 'Modifica los parámetros y criterios automáticos del segmento.'
                  : 'Filtra pacientes automáticamente según criterios clínicos en tiempo real.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={manejarCerrar}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--texto-atenuado)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido / Formulario */}
        <form
          onSubmit={manejarSolicitarConfirmacion}
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {errorFormulario && (
            <div
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--color-peligro-rojo-suave)',
                color: 'var(--color-peligro-rojo)',
                borderRadius: 'var(--radio-md)',
                fontSize: '0.8rem',
                fontWeight: 500,
              }}
            >
              {errorFormulario}
            </div>
          )}

          {/* Información General */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                marginBottom: '0.35rem',
                color: 'var(--texto-principal)',
              }}
            >
              Nombre del Segmento *
            </label>
            <input
              type="text"
              placeholder="Ej: Pacientes Miopes Altos, Pacientes VIP..."
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                backgroundColor: 'var(--fondo-base)',
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: 'var(--radio-md)',
                color: 'var(--texto-principal)',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                marginBottom: '0.35rem',
                color: 'var(--texto-principal)',
              }}
            >
              Descripción u Objetivo
            </label>
            <textarea
              rows={2}
              placeholder="Explica qué tipo de pacientes reúne este segmento..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                backgroundColor: 'var(--fondo-base)',
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: 'var(--radio-md)',
                color: 'var(--texto-principal)',
                fontSize: '0.85rem',
                outline: 'none',
                resize: 'none',
              }}
            />
          </div>

          {/* Ícono y Color */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  marginBottom: '0.4rem',
                  color: 'var(--texto-principal)',
                }}
              >
                Color Representativo
              </label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {COLORES_DISPONIBLES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: c,
                      border: color === c ? '2px solid var(--texto-principal)' : '2px solid transparent',
                      cursor: 'pointer',
                      transform: color === c ? 'scale(1.15)' : 'scale(1)',
                      transition: 'all 0.15s ease',
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  marginBottom: '0.4rem',
                  color: 'var(--texto-principal)',
                }}
              >
                Ícono
              </label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {ICONOS_DISPONIBLES.map((ic) => {
                  const IconoComp = ic.icono;
                  const seleccionado = icono === ic.id;
                  return (
                    <button
                      key={ic.id}
                      type="button"
                      title={ic.etiqueta}
                      onClick={() => setIcono(ic.id)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        backgroundColor: seleccionado ? 'var(--fondo-hover)' : 'transparent',
                        border: seleccionado ? `1.5px solid ${color}` : '1px solid var(--borde-tarjeta)',
                        color: seleccionado ? color : 'var(--texto-atenuado)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <IconoComp size={15} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sección Criterios Clínicos */}
          <div
            style={{
              marginTop: '0.5rem',
              padding: '1rem',
              backgroundColor: 'var(--fondo-elevado)',
              borderRadius: 'var(--radio-md)',
              border: '1px solid var(--borde-tarjeta)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <Filter size={15} style={{ color }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--texto-principal)' }}>
                Criterios de Auto-Segmentación
              </span>
            </div>

            {/* 1. Control Vencido */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--fondo-tarjeta)',
                borderRadius: 'var(--radio-sm)',
                border: '1px solid var(--borde-tarjeta)',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--texto-principal)' }}>
                <input
                  type="checkbox"
                  checked={activarControlVencido}
                  onChange={(e) => setActivarControlVencido(e.target.checked)}
                />
                <span>Control visual vencido</span>
              </label>
              {activarControlVencido && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem' }}>
                  <span style={{ color: 'var(--texto-atenuado)' }}>Hace más de</span>
                  <SelectorDesplegable
                    valor={String(mesesControl)}
                    alCambiar={(val) => setMesesControl(Number(val))}
                    opciones={[
                      { valor: '6', etiqueta: '6 meses' },
                      { valor: '12', etiqueta: '12 meses (1 año)' },
                      { valor: '18', etiqueta: '18 meses' },
                      { valor: '24', etiqueta: '24 meses (2 años)' },
                    ]}
                    tamano="compacto"
                    posicionAlineacion="derecha"
                    anchoMinimo="155px"
                  />
                </div>
              )}
            </div>

            {/* 2. Rango de Edad */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--fondo-tarjeta)',
                borderRadius: 'var(--radio-sm)',
                border: '1px solid var(--borde-tarjeta)',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--texto-principal)' }}>
                <input
                  type="checkbox"
                  checked={activarEdad}
                  onChange={(e) => setActivarEdad(e.target.checked)}
                />
                <span>Rango de edad</span>
              </label>
              {activarEdad && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem' }}>
                  <input
                    type="number"
                    placeholder="Mín"
                    value={edadMinima}
                    onChange={(e) => setEdadMinima(e.target.value)}
                    style={{
                      width: '68px',
                      height: '30px',
                      padding: '0.2rem 0.5rem',
                      borderRadius: 'var(--radio-md)',
                      border: '1px solid var(--borde-tarjeta)',
                      backgroundColor: 'var(--fondo-base)',
                      color: 'var(--texto-principal)',
                      textAlign: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      outline: 'none',
                      boxShadow: 'var(--sombra-sm)',
                    }}
                  />
                  <span style={{ color: 'var(--texto-atenuado)', fontWeight: 500 }}>a</span>
                  <input
                    type="number"
                    placeholder="Máx"
                    value={edadMaxima}
                    onChange={(e) => setEdadMaxima(e.target.value)}
                    style={{
                      width: '68px',
                      height: '30px',
                      padding: '0.2rem 0.5rem',
                      borderRadius: 'var(--radio-md)',
                      border: '1px solid var(--borde-tarjeta)',
                      backgroundColor: 'var(--fondo-base)',
                      color: 'var(--texto-principal)',
                      textAlign: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      outline: 'none',
                      boxShadow: 'var(--sombra-sm)',
                    }}
                  />
                  <span style={{ color: 'var(--texto-secundario)', fontWeight: 600 }}>años</span>
                </div>
              )}
            </div>

            {/* 3. Presbicia / Adición */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--fondo-tarjeta)',
                borderRadius: 'var(--radio-sm)',
                border: '1px solid var(--borde-tarjeta)',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--texto-principal)' }}>
                <input
                  type="checkbox"
                  checked={requiereAdicion}
                  onChange={(e) => setRequiereAdicion(e.target.checked)}
                />
                <span>Presbicia (Fórmula con adición de cerca o mayor de 40 años)</span>
              </label>
            </div>

            {/* 4. Tipo de Lente */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--fondo-tarjeta)',
                borderRadius: 'var(--radio-sm)',
                border: '1px solid var(--borde-tarjeta)',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--texto-principal)' }}>
                <input
                  type="checkbox"
                  checked={activarTipoLente}
                  onChange={(e) => setActivarTipoLente(e.target.checked)}
                />
                <span>Tipo de lente formulado</span>
              </label>
              {activarTipoLente && (
                <SelectorDesplegable
                  valor={tipoLente}
                  alCambiar={(val) => setTipoLente(val)}
                  opciones={[
                    { valor: 'Monofocal', etiqueta: 'Monofocal' },
                    { valor: 'Progresivo', etiqueta: 'Progresivo' },
                    { valor: 'Bifocal', etiqueta: 'Bifocal' },
                    { valor: 'Contacto', etiqueta: 'Lentes de Contacto' },
                    { valor: 'Blue', etiqueta: 'Filtro Azul / Blue Block' },
                    { valor: 'Antirreflejo', etiqueta: 'Antirreflejo' },
                    { valor: 'Transitions', etiqueta: 'Fotocromático / Transitions' },
                  ]}
                  tamano="compacto"
                  posicionAlineacion="derecha"
                  anchoMinimo="195px"
                />
              )}
            </div>

            {/* 5. Astigmatismo Alto */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--fondo-tarjeta)',
                borderRadius: 'var(--radio-sm)',
                border: '1px solid var(--borde-tarjeta)',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--texto-principal)' }}>
                <input
                  type="checkbox"
                  checked={activarCilindro}
                  onChange={(e) => setActivarCilindro(e.target.checked)}
                />
                <span>Cilindro alto (Astigmatismo)</span>
              </label>
              {activarCilindro && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem' }}>
                  <span style={{ color: 'var(--texto-atenuado)' }}>Mayor a</span>
                  <SelectorDesplegable
                    valor={String(cilindroMinimo)}
                    alCambiar={(val) => setCilindroMinimo(Number(val))}
                    opciones={[
                      { valor: '1.5', etiqueta: '≥ 1.50 D' },
                      { valor: '2', etiqueta: '≥ 2.00 D' },
                      { valor: '2.5', etiqueta: '≥ 2.50 D' },
                      { valor: '3', etiqueta: '≥ 3.00 D' },
                    ]}
                    tamano="compacto"
                    posicionAlineacion="derecha"
                    anchoMinimo="125px"
                  />
                </div>
              )}
            </div>

            {/* 6. Inactividad de citas */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--fondo-tarjeta)',
                borderRadius: 'var(--radio-sm)',
                border: '1px solid var(--borde-tarjeta)',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--texto-principal)' }}>
                <input
                  type="checkbox"
                  checked={activarInactividad}
                  onChange={(e) => setActivarInactividad(e.target.checked)}
                />
                <span>Sin citas en los últimos</span>
              </label>
              {activarInactividad && (
                <SelectorDesplegable
                  valor={String(diasInactividad)}
                  alCambiar={(val) => setDiasInactividad(Number(val))}
                  opciones={[
                    { valor: '90', etiqueta: '90 días (3 meses)' },
                    { valor: '180', etiqueta: '180 días (6 meses)' },
                    { valor: '365', etiqueta: '365 días (1 año)' },
                  ]}
                  tamano="compacto"
                  posicionAlineacion="derecha"
                  anchoMinimo="175px"
                />
              )}
            </div>

            {/* 7. Género / Sexo */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--fondo-tarjeta)',
                borderRadius: 'var(--radio-sm)',
                border: '1px solid var(--borde-tarjeta)',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--texto-principal)' }}>
                <input
                  type="checkbox"
                  checked={activarSexo}
                  onChange={(e) => setActivarSexo(e.target.checked)}
                />
                <span>Género del paciente</span>
              </label>
              {activarSexo && (
                <SelectorDesplegable
                  valor={sexoSeleccionado}
                  alCambiar={(val) => setSexoSeleccionado(val as 'femenino' | 'masculino')}
                  opciones={[
                    { valor: 'femenino', etiqueta: 'Femenino' },
                    { valor: 'masculino', etiqueta: 'Masculino' },
                  ]}
                  tamano="compacto"
                  posicionAlineacion="derecha"
                  anchoMinimo="150px"
                />
              )}
            </div>
          </div>

          {/* Botones de Acción */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              marginTop: '0.5rem',
              borderTop: '1px solid var(--borde-tarjeta)',
              paddingTop: '1rem',
            }}
          >
            <button
              type="button"
              onClick={manejarCerrar}
              disabled={guardando}
              style={{
                padding: '0.6rem 1.1rem',
                backgroundColor: 'transparent',
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: 'var(--radio-md)',
                color: 'var(--texto-principal)',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!formularioValido || guardando}
              style={{
                padding: '0.6rem 1.3rem',
                backgroundColor: formularioValido ? color : 'var(--fondo-elevado)',
                border: formularioValido ? 'none' : '1px solid var(--borde-tarjeta)',
                borderRadius: 'var(--radio-md)',
                color: formularioValido ? '#ffffff' : 'var(--texto-atenuado)',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: formularioValido && !guardando ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                opacity: formularioValido ? 1 : 0.6,
                boxShadow: formularioValido ? 'var(--sombra-sm)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Plus size={16} />
              <span>
                {guardando
                  ? 'Guardando...'
                  : segmentoParaEditar
                  ? 'Guardar'
                  : 'Crear Segmento'}
              </span>
            </button>
          </div>
        </form>

        {/* ================================================================== */}
        {/* VENTANA EMERGENTE DE RESUMEN Y CONFIRMACIÓN ANTES DE CREAR/EDITAR */}
        {/* ================================================================== */}
        {modalConfirmacionAbierto && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(3px)',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.25rem',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--fondo-tarjeta)',
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: 'var(--radio-lg)',
                padding: '1.5rem',
                width: '100%',
                maxWidth: '480px',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.1rem',
                boxShadow: 'var(--sombra-lg)',
                animation: 'escalarEntrada 0.18s ease-out',
              }}
            >
              {/* Encabezado confirmación */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    backgroundColor: `${color}18`,
                    color: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <IconoSeleccionado size={20} />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: 'var(--texto-principal)',
                      margin: 0,
                    }}
                  >
                    {segmentoParaEditar?.es_sistema
                      ? '¿Confirmar personalización del segmento?'
                      : segmentoParaEditar
                      ? '¿Confirmar cambios del segmento?'
                      : '¿Confirmar creación de segmento?'}
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--texto-atenuado)', margin: '0.15rem 0 0 0' }}>
                    Revisa el resumen antes de aplicar las reglas a los pacientes.
                  </p>
                </div>
              </div>

              {/* Tarjeta de Resumen */}
              <div
                style={{
                  backgroundColor: 'var(--fondo-base)',
                  border: '1px solid var(--borde-tarjeta)',
                  borderRadius: 'var(--radio-md)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--texto-atenuado)', textTransform: 'uppercase' }}>
                    Nombre del Segmento
                  </span>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--texto-principal)' }}>
                    {nombre}
                  </div>
                  {descripcion.trim() && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--texto-secundario)', marginTop: '0.15rem' }}>
                      {descripcion}
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid var(--borde-tarjeta)', paddingTop: '0.6rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: color, textTransform: 'uppercase' }}>
                    Criterios Seleccionados ({listaResumenCriterios.length})
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.4rem' }}>
                    {listaResumenCriterios.map((crit, idx) => (
                      <div
                        key={idx}
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--texto-principal)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.45rem',
                        }}
                      >
                        <CheckCircle2 size={13} style={{ color, flexShrink: 0, marginTop: '2px' }} />
                        <span>{crit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Botones de Confirmación */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
                <button
                  type="button"
                  onClick={() => setModalConfirmacionAbierto(false)}
                  disabled={guardando}
                  style={{
                    padding: '0.55rem 1rem',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--borde-tarjeta)',
                    borderRadius: 'var(--radio-md)',
                    color: 'var(--texto-principal)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Volver a editar
                </button>
                <button
                  type="button"
                  onClick={manejarGuardarConfirmado}
                  disabled={guardando}
                  style={{
                    padding: '0.55rem 1.25rem',
                    backgroundColor: color,
                    border: 'none',
                    borderRadius: 'var(--radio-md)',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: guardando ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: 'var(--sombra-sm)',
                  }}
                >
                  <Plus size={15} />
                  <span>
                    {guardando ? 'Procesando...' : 'Confirmar'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
