'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, FilePlus2, CheckCircle2, Edit3, Glasses } from 'lucide-react';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';
import { SelectorDesplegable } from '../comunes/SelectorDesplegable';
import type { Contacto, FormulaOptica } from '@/tipos/crm';
import { obtenerOpticaSesion } from '@/servicios/api_crm';
import { formatearTelefono, obtenerNombrePaciente } from '@/utilidades/formato';

// Helpers de normalización y formateo optométrico inteligente
const formatearEsfera = (valorEntrada: string): string => {
  const texto = valorEntrada.trim();
  if (!texto) return '+0.00';
  if (/^(neutro|plano|pl)$/i.test(texto)) return 'Neutro';

  const esNegativo = texto.startsWith('-');
  const limpio = texto.replace(/^[+-]/, '').trim().replace(',', '.');

  if (limpio === '' || limpio === '0') {
    return esNegativo ? '-0.00' : '+0.00';
  }

  let numero = parseFloat(limpio);
  if (isNaN(numero)) return '+0.00';

  // Si se ingresó un entero sin decimal (ej: 50 -> 0.50, 125 -> 1.25)
  if (!limpio.includes('.')) {
    if (numero >= 25) {
      numero = numero / 100;
    }
  }

  const signo = esNegativo ? '-' : '+';
  return `${signo}${numero.toFixed(2)}`;
};

const formatearCilindro = (valorEntrada: string): string => {
  const texto = valorEntrada.trim();
  if (!texto) return '-0.00';
  if (/^(neutro|plano|pl)$/i.test(texto)) return '-0.00';

  const esPositivo = texto.startsWith('+');
  const esNegativo = texto.startsWith('-');
  const limpio = texto.replace(/^[+-]/, '').trim().replace(',', '.');

  if (limpio === '' || limpio === '0') {
    return '-0.00';
  }

  let numero = parseFloat(limpio);
  if (isNaN(numero)) return '-0.00';

  // Si se ingresó sin punto (ej: 50 -> 0.50, 125 -> 1.25)
  if (!limpio.includes('.')) {
    if (numero >= 25) {
      numero = numero / 100;
    }
  }

  // En optometría moderna el cilindro oftálmico es negativo a menos que explícitamente se ingrese '+'
  const signo = esPositivo ? '+' : '-';
  return `${signo}${numero.toFixed(2)}`;
};

const formatearEje = (valorEntrada: string): string => {
  const texto = valorEntrada.trim();
  if (!texto) return '0°';
  const soloDigitos = texto.replace(/[^\d]/g, '');
  if (!soloDigitos) return '0°';
  let angulo = parseInt(soloDigitos, 10);
  if (isNaN(angulo)) return '0°';
  if (angulo > 180) angulo = 180;
  if (angulo < 0) angulo = 0;
  return `${angulo}°`;
};

const formatearAdicion = (valorEntrada: string): string => {
  const texto = valorEntrada.trim();
  if (!texto) return '+0.00';
  const limpio = texto.replace(/^[+-]/, '').trim().replace(',', '.');
  if (limpio === '' || limpio === '0') return '+0.00';

  let numero = parseFloat(limpio);
  if (isNaN(numero)) return '+0.00';

  // Si se ingresó sin punto (ej: 50 -> 0.50, 200 -> 2.00)
  if (!limpio.includes('.')) {
    if (numero >= 25) {
      numero = numero / 100;
    }
  }

  return `+${numero.toFixed(2)}`;
};

const formatearAV = (valorEntrada: string): string => {
  const texto = valorEntrada.trim();
  if (!texto) return '20/20';

  // Notaciones optométricas clínicas especiales
  const abreviaturasEspeciales = ['PL', 'NPL', 'CD', 'MM', 'NLP', 'LP', 'CF', 'HM'];
  const enMayuscula = texto.toUpperCase();
  if (abreviaturasEspeciales.includes(enMayuscula)) {
    return enMayuscula;
  }

  // Notación fraccional Snellen (ej: 20/40)
  if (texto.includes('/')) {
    const partes = texto.split('/');
    const numerador = partes[0].trim();
    const denominador = partes[1]?.trim() || '20';
    return `${numerador || '20'}/${denominador}`;
  }

  // Si el usuario escribe solo el número (ej: 50 -> 20/50, 20 -> 20/20)
  const soloDigitos = texto.replace(/[^\d]/g, '');
  if (soloDigitos) {
    return `20/${soloDigitos}`;
  }

  return texto;
};

// Generador de estado inicial limpio con valores de refracción por defecto
const obtenerValoresPorDefecto = () => {
  const optSesion = typeof window !== 'undefined' ? obtenerOpticaSesion() : null;
  return {
    esfera_od: '+0.00',
    cilindro_od: '-0.00',
    eje_od: '0°',
    adicion_od: '+0.00',
    av_od: '20/20',
    esfera_oi: '+0.00',
    cilindro_oi: '-0.00',
    eje_oi: '0°',
    adicion_oi: '+0.00',
    av_oi: '20/20',
    distancia_pupilar: '',
    tipo_lente: '',
    optometra: optSesion?.especialista_defecto || '',
    proximo_control_en_meses: String(optSesion?.control_meses_defecto || '12'),
    observaciones: '',
  };
};

interface PropiedadesModalNuevaFormula {
  abierto: boolean;
  contacto: Contacto | null;
  alCerrar: () => void;
  alGuardar: (datos: Partial<FormulaOptica>) => Promise<void>;
}

export const ModalNuevaFormula: React.FC<PropiedadesModalNuevaFormula> = ({
  abierto,
  contacto,
  alCerrar,
  alGuardar,
}) => {
  const [montado, setMontado] = useState(false);
  const [cargando, setCargando] = useState(false);

  // Formulario con valores clínicos por defecto en tabla OD/OI y campos complementarios limpios
  const [formulario, setFormulario] = useState(obtenerValoresPorDefecto());
  const [modalConfirmacionAbierto, setModalConfirmacionAbierto] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  // Reiniciar formulario cada vez que se abre el modal o cambia el paciente activo
  useEffect(() => {
    if (abierto) {
      setFormulario(obtenerValoresPorDefecto());
      setModalConfirmacionAbierto(false);
    }
  }, [abierto, contacto?.id]);

  const manejarCierre = () => {
    setModalConfirmacionAbierto(false);
    setFormulario(obtenerValoresPorDefecto());
    alCerrar();
  };

  // Navegación rápida con Enter: aplica formato al instante y avanza al siguiente campo
  const avanzarConEnter = (
    e: React.KeyboardEvent<HTMLInputElement>,
    siguienteId?: string,
    formateador?: (val: string) => string,
    campo?: keyof typeof formulario
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (formateador && campo) {
        const valorFormateado = formateador(e.currentTarget.value);
        setFormulario((prev) => ({ ...prev, [campo]: valorFormateado }));
      }
      if (siguienteId) {
        setTimeout(() => {
          const siguiente = document.getElementById(siguienteId) as HTMLInputElement | null;
          if (siguiente) {
            siguiente.focus();
            siguiente.select();
          }
        }, 10);
      }
    }
  };

  // Cerrar con tecla Escape (cierra confirmación si está abierta, o el modal completo)
  useEffect(() => {
    const alPresionarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && abierto) {
        if (modalConfirmacionAbierto) {
          setModalConfirmacionAbierto(false);
        } else {
          manejarCierre();
        }
      }
    };
    window.addEventListener('keydown', alPresionarTecla);
    return () => window.removeEventListener('keydown', alPresionarTecla);
  }, [abierto, modalConfirmacionAbierto]);

  if (!abierto || !contacto || !montado) return null;

  // Validación: Todos los campos refractivos y técnicos deben estar diligenciados (observaciones opcionales)
  const formularioCompleto =
    formulario.esfera_od.trim() !== '' &&
    formulario.cilindro_od.trim() !== '' &&
    formulario.eje_od.trim() !== '' &&
    formulario.adicion_od.trim() !== '' &&
    formulario.av_od.trim() !== '' &&
    formulario.esfera_oi.trim() !== '' &&
    formulario.cilindro_oi.trim() !== '' &&
    formulario.eje_oi.trim() !== '' &&
    formulario.adicion_oi.trim() !== '' &&
    formulario.av_oi.trim() !== '' &&
    formulario.distancia_pupilar.trim() !== '' &&
    formulario.tipo_lente.trim() !== '' &&
    formulario.optometra.trim() !== '' &&
    String(formulario.proximo_control_en_meses).trim() !== '';

  // Paso 1: Abrir ventana emergente de resumen para verificar la refracción
  const manejarSolicitarConfirmacion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formularioCompleto || cargando) return;
    setModalConfirmacionAbierto(true);
  };

  // Paso 2: Guardar definitivamente tras confirmar en la ventana emergente
  const manejarGuardarConfirmado = async () => {
    if (!formularioCompleto || cargando) return;

    setCargando(true);
    try {
      await alGuardar({
        contacto_id: contacto.id,
        esfera_od: formulario.esfera_od,
        cilindro_od: formulario.cilindro_od,
        eje_od: formulario.eje_od,
        adicion_od: formulario.adicion_od,
        av_od: formulario.av_od,
        esfera_oi: formulario.esfera_oi,
        cilindro_oi: formulario.cilindro_oi,
        eje_oi: formulario.eje_oi,
        adicion_oi: formulario.adicion_oi,
        av_oi: formulario.av_oi,
        distancia_pupilar: formulario.distancia_pupilar,
        tipo_lente: formulario.tipo_lente,
        optometra: formulario.optometra,
        proximo_control_en_meses: Number(formulario.proximo_control_en_meses),
        observaciones: formulario.observaciones || undefined,
        fecha_examen: new Date().toISOString(),
      });
      setModalConfirmacionAbierto(false);
      manejarCierre();
    } catch (error) {
      console.error('Error al guardar fórmula en modal:', error);
    } finally {
      setCargando(false);
    }
  };

  const contenidoModal = (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !modalConfirmacionAbierto) manejarCierre();
      }}
    >
      <div className="modal-tarjeta-clinica" role="dialog" aria-modal="true">
        {/* Cabecera Corporativa */}
        <div className="modal-cabecera-clinica">
          <div className="modal-cabecera-izq">
            <div className="modal-icono-caja">
              <FilePlus2 style={{ width: '20px', height: '20px' }} />
            </div>
            <div>
              <h3 className="modal-titulo-principal">Registrar Refracción Clínica</h3>
              <div className="modal-subtitulo-paciente">
                <span>Paciente:</span>
                <strong>{obtenerNombrePaciente(contacto)}</strong>
                <span className="modal-badge-paciente">#{contacto.id}</span>
                {contacto.telefono && (
                  <span style={{ color: 'var(--texto-atenuado)' }}>• {formatearTelefono(contacto.telefono)}</span>
                )}
              </div>
            </div>
          </div>

          <EtiquetaTooltip texto="Cerrar ventana (Esc)" posicion="abajo">
            <button
              type="button"
              onClick={manejarCierre}
              className="modal-btn-cerrar"
              aria-label="Cerrar modal"
            >
              <X style={{ width: '18px', height: '18px' }} />
            </button>
          </EtiquetaTooltip>
        </div>

        {/* Cuerpo del Formulario */}
        <form onSubmit={manejarSolicitarConfirmacion} style={{ display: 'contents' }}>
          <div className="modal-cuerpo-clinico">
            {/* 1. Tabla de Refracción OD / OI con formateo optométrico inteligente y navegación por Enter */}
            <div>
              <div className="modal-seccion-rotulo">
                <span>Medición Refractiva (OD / OI)</span>
              </div>
              <div className="modal-tabla-envoltorio">
                <table className="modal-tabla-refraccion">
                  <thead>
                    <tr>
                      <th style={{ width: '12%' }}>Ojo</th>
                      <th style={{ width: '18%' }}>Esfera</th>
                      <th style={{ width: '18%' }}>Cilindro</th>
                      <th style={{ width: '16%' }}>Eje</th>
                      <th style={{ width: '18%' }}>Adición</th>
                      <th style={{ width: '18%' }}>AV</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <span className="badge-ojo-od">OD</span>
                      </td>
                      <td>
                        <input
                          id="refraccion-esfera-od"
                          type="text"
                          value={formulario.esfera_od}
                          onChange={(e) => setFormulario((prev) => ({ ...prev, esfera_od: e.target.value }))}
                          onFocus={(e) => e.target.select()}
                          onBlur={(e) => setFormulario((prev) => ({ ...prev, esfera_od: formatearEsfera(e.target.value) }))}
                          onKeyDown={(e) => avanzarConEnter(e, 'refraccion-cilindro-od', formatearEsfera, 'esfera_od')}
                          className="modal-input-tabla"
                          placeholder="+0.00"
                        />
                      </td>
                      <td>
                        <input
                          id="refraccion-cilindro-od"
                          type="text"
                          value={formulario.cilindro_od}
                          onChange={(e) => setFormulario((prev) => ({ ...prev, cilindro_od: e.target.value }))}
                          onFocus={(e) => e.target.select()}
                          onBlur={(e) => setFormulario((prev) => ({ ...prev, cilindro_od: formatearCilindro(e.target.value) }))}
                          onKeyDown={(e) => avanzarConEnter(e, 'refraccion-eje-od', formatearCilindro, 'cilindro_od')}
                          className="modal-input-tabla"
                          placeholder="-0.00"
                        />
                      </td>
                      <td>
                        <input
                          id="refraccion-eje-od"
                          type="text"
                          value={formulario.eje_od}
                          onChange={(e) => setFormulario((prev) => ({ ...prev, eje_od: e.target.value }))}
                          onFocus={(e) => e.target.select()}
                          onBlur={(e) => setFormulario((prev) => ({ ...prev, eje_od: formatearEje(e.target.value) }))}
                          onKeyDown={(e) => avanzarConEnter(e, 'refraccion-adicion-od', formatearEje, 'eje_od')}
                          className="modal-input-tabla"
                          placeholder="0°"
                        />
                      </td>
                      <td>
                        <input
                          id="refraccion-adicion-od"
                          type="text"
                          value={formulario.adicion_od}
                          onChange={(e) => setFormulario((prev) => ({ ...prev, adicion_od: e.target.value }))}
                          onFocus={(e) => e.target.select()}
                          onBlur={(e) => setFormulario((prev) => ({ ...prev, adicion_od: formatearAdicion(e.target.value) }))}
                          onKeyDown={(e) => avanzarConEnter(e, 'refraccion-av-od', formatearAdicion, 'adicion_od')}
                          className="modal-input-tabla"
                          placeholder="+0.00"
                        />
                      </td>
                      <td>
                        <input
                          id="refraccion-av-od"
                          type="text"
                          value={formulario.av_od}
                          onChange={(e) => setFormulario((prev) => ({ ...prev, av_od: e.target.value }))}
                          onFocus={(e) => e.target.select()}
                          onBlur={(e) => setFormulario((prev) => ({ ...prev, av_od: formatearAV(e.target.value) }))}
                          onKeyDown={(e) => avanzarConEnter(e, 'refraccion-esfera-oi', formatearAV, 'av_od')}
                          className="modal-input-tabla"
                          placeholder="20/20"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <span className="badge-ojo-oi">OI</span>
                      </td>
                      <td>
                        <input
                          id="refraccion-esfera-oi"
                          type="text"
                          value={formulario.esfera_oi}
                          onChange={(e) => setFormulario((prev) => ({ ...prev, esfera_oi: e.target.value }))}
                          onFocus={(e) => e.target.select()}
                          onBlur={(e) => setFormulario((prev) => ({ ...prev, esfera_oi: formatearEsfera(e.target.value) }))}
                          onKeyDown={(e) => avanzarConEnter(e, 'refraccion-cilindro-oi', formatearEsfera, 'esfera_oi')}
                          className="modal-input-tabla"
                          placeholder="+0.00"
                        />
                      </td>
                      <td>
                        <input
                          id="refraccion-cilindro-oi"
                          type="text"
                          value={formulario.cilindro_oi}
                          onChange={(e) => setFormulario((prev) => ({ ...prev, cilindro_oi: e.target.value }))}
                          onFocus={(e) => e.target.select()}
                          onBlur={(e) => setFormulario((prev) => ({ ...prev, cilindro_oi: formatearCilindro(e.target.value) }))}
                          onKeyDown={(e) => avanzarConEnter(e, 'refraccion-eje-oi', formatearCilindro, 'cilindro_oi')}
                          className="modal-input-tabla"
                          placeholder="-0.00"
                        />
                      </td>
                      <td>
                        <input
                          id="refraccion-eje-oi"
                          type="text"
                          value={formulario.eje_oi}
                          onChange={(e) => setFormulario((prev) => ({ ...prev, eje_oi: e.target.value }))}
                          onFocus={(e) => e.target.select()}
                          onBlur={(e) => setFormulario((prev) => ({ ...prev, eje_oi: formatearEje(e.target.value) }))}
                          onKeyDown={(e) => avanzarConEnter(e, 'refraccion-adicion-oi', formatearEje, 'eje_oi')}
                          className="modal-input-tabla"
                          placeholder="0°"
                        />
                      </td>
                      <td>
                        <input
                          id="refraccion-adicion-oi"
                          type="text"
                          value={formulario.adicion_oi}
                          onChange={(e) => setFormulario((prev) => ({ ...prev, adicion_oi: e.target.value }))}
                          onFocus={(e) => e.target.select()}
                          onBlur={(e) => setFormulario((prev) => ({ ...prev, adicion_oi: formatearAdicion(e.target.value) }))}
                          onKeyDown={(e) => avanzarConEnter(e, 'refraccion-av-oi', formatearAdicion, 'adicion_oi')}
                          className="modal-input-tabla"
                          placeholder="+0.00"
                        />
                      </td>
                      <td>
                        <input
                          id="refraccion-av-oi"
                          type="text"
                          value={formulario.av_oi}
                          onChange={(e) => setFormulario((prev) => ({ ...prev, av_oi: e.target.value }))}
                          onFocus={(e) => e.target.select()}
                          onBlur={(e) => setFormulario((prev) => ({ ...prev, av_oi: formatearAV(e.target.value) }))}
                          onKeyDown={(e) => avanzarConEnter(e, 'campo-distancia-pupilar', formatearAV, 'av_oi')}
                          className="modal-input-tabla"
                          placeholder="20/20"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Parámetros Técnicos y Prescripción */}
            <div className="modal-grid-parametros">
              <div className="modal-campo-grupo">
                <label className="modal-label">Distancia Pupilar (DP):</label>
                <input
                  id="campo-distancia-pupilar"
                  type="text"
                  value={formulario.distancia_pupilar}
                  onChange={(e) => setFormulario({ ...formulario, distancia_pupilar: e.target.value })}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => avanzarConEnter(e, 'campo-optometra')}
                  className="modal-input"
                  placeholder="Ej: 62 mm"
                />
              </div>

              <div className="modal-campo-grupo">
                <label className="modal-label">Tipo de Lente:</label>
                <SelectorDesplegable
                  valor={formulario.tipo_lente}
                  alCambiar={(val) => setFormulario({ ...formulario, tipo_lente: val })}
                  placeholder="Seleccionar tipo de lente..."
                  anchoMinimo="100%"
                  opciones={[
                    { valor: 'Monofocal Antirreflejo', etiqueta: 'Monofocal Antirreflejo' },
                    { valor: 'Monofocal Blue Block (Filtro Azul)', etiqueta: 'Monofocal Blue Block (Filtro Azul)' },
                    { valor: 'Progresivo Digital Premium', etiqueta: 'Progresivo Digital Premium' },
                    { valor: 'Bifocal Invisible', etiqueta: 'Bifocal Invisible' },
                    { valor: 'Fotocromático Transitions', etiqueta: 'Fotocromático Transitions' },
                    { valor: 'Policarbonato Alto Impacto', etiqueta: 'Policarbonato Alto Impacto' },
                    { valor: 'Lente de Contacto Blando', etiqueta: 'Lente de Contacto Blando' },
                  ]}
                />
              </div>

              <div className="modal-campo-grupo">
                <label className="modal-label">Optómetra Tratante:</label>
                <input
                  id="campo-optometra"
                  type="text"
                  value={formulario.optometra}
                  onChange={(e) => setFormulario({ ...formulario, optometra: e.target.value })}
                  onFocus={(e) => e.target.select()}
                  className="modal-input"
                  placeholder="Nombre del especialista"
                />
              </div>

              <div className="modal-campo-grupo">
                <label className="modal-label">Próximo Control Visual:</label>
                <SelectorDesplegable
                  valor={formulario.proximo_control_en_meses}
                  alCambiar={(val) => setFormulario({ ...formulario, proximo_control_en_meses: val })}
                  placeholder="Seleccionar próximo control..."
                  anchoMinimo="100%"
                  opciones={[
                    { valor: '3', etiqueta: 'En 3 meses' },
                    { valor: '6', etiqueta: 'En 6 meses' },
                    { valor: '12', etiqueta: 'En 12 meses (Recomendado)' },
                    { valor: '18', etiqueta: 'En 18 meses' },
                    { valor: '24', etiqueta: 'En 24 meses' },
                  ]}
                />
              </div>

              <div className="modal-campo-grupo col-span-2">
                <label className="modal-label">Observaciones Clínicas / Diagnóstico:</label>
                <textarea
                  value={formulario.observaciones}
                  onChange={(e) => setFormulario({ ...formulario, observaciones: e.target.value })}
                  className="modal-textarea"
                  placeholder="Ej: Astenopía vespertina al computador, adaptación favorable a filtro azul antirreflejo..."
                />
              </div>
            </div>
          </div>

          {/* Pie del Modal con Acciones */}
          <div className="modal-pie-clinico">
            <button
              type="button"
              onClick={manejarCierre}
              className="modal-btn-cancelar"
              disabled={cargando}
            >
              Cancelar
            </button>
            <EtiquetaTooltip
              texto={
                formularioCompleto
                  ? 'Guardar fórmula en la historia clínica'
                  : 'Diligencia todos los campos refractivos y técnicos para habilitar el guardado'
              }
              posicion="arriba"
            >
              <div style={{ display: 'inline-block' }}>
                <button
                  type="submit"
                  className="modal-btn-guardar"
                  disabled={!formularioCompleto || cargando}
                  style={{
                    pointerEvents: !formularioCompleto || cargando ? 'none' : 'auto',
                  }}
                >
                  <Save style={{ width: '15px', height: '15px' }} />
                  <span>Guardar</span>
                </button>
              </div>
            </EtiquetaTooltip>
          </div>
        </form>

        {/* Ventana Emergente de Resumen y Confirmación */}
        {modalConfirmacionAbierto && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(3px)',
              zIndex: 1100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.25rem',
              animation: 'aparecerSuave 0.15s ease-out',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !cargando) {
                setModalConfirmacionAbierto(false);
              }
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--fondo-tarjeta)',
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: 'var(--radio-lg)',
                padding: '1.5rem',
                width: '100%',
                maxWidth: '540px',
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
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)',
                    color: 'var(--color-primario, #0284c7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Glasses size={22} />
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      color: 'var(--texto-principal)',
                      margin: 0,
                    }}
                  >
                    ¿Confirmar refracción clínica?
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: 'var(--texto-atenuado)', margin: '0.15rem 0 0 0' }}>
                    Revisa los datos antes de registrar la fórmula para{' '}
                    <strong style={{ color: 'var(--texto-principal)' }}>
                      {contacto.nombre || contacto.nombre_completo || 'el paciente'}
                    </strong>
                    .
                  </p>
                </div>
              </div>

              {/* Tarjeta resumen de refracción */}
              <div
                style={{
                  backgroundColor: 'var(--fondo-base)',
                  border: '1px solid var(--borde-tarjeta)',
                  borderRadius: 'var(--radio-md)',
                  padding: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                {/* Tabla OD / OI */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'center' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--borde-tarjeta)', color: 'var(--texto-atenuado)', fontWeight: 600 }}>
                        <th style={{ padding: '0.35rem 0.5rem', textAlign: 'left' }}>Ojo</th>
                        <th style={{ padding: '0.35rem 0.5rem' }}>Esfera</th>
                        <th style={{ padding: '0.35rem 0.5rem' }}>Cilindro</th>
                        <th style={{ padding: '0.35rem 0.5rem' }}>Eje</th>
                        <th style={{ padding: '0.35rem 0.5rem' }}>Adición</th>
                        <th style={{ padding: '0.35rem 0.5rem' }}>AV</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid var(--borde-tarjeta)', color: 'var(--texto-principal)' }}>
                        <td style={{ padding: '0.45rem 0.5rem', textAlign: 'left', fontWeight: 700, color: 'var(--color-primario, #0284c7)' }}>OD</td>
                        <td style={{ padding: '0.45rem 0.5rem', fontWeight: 600 }}>{formulario.esfera_od}</td>
                        <td style={{ padding: '0.45rem 0.5rem', fontWeight: 600 }}>{formulario.cilindro_od}</td>
                        <td style={{ padding: '0.45rem 0.5rem' }}>{formulario.eje_od}</td>
                        <td style={{ padding: '0.45rem 0.5rem' }}>{formulario.adicion_od}</td>
                        <td style={{ padding: '0.45rem 0.5rem', fontWeight: 600, color: '#10b981' }}>{formulario.av_od}</td>
                      </tr>
                      <tr style={{ color: 'var(--texto-principal)' }}>
                        <td style={{ padding: '0.45rem 0.5rem', textAlign: 'left', fontWeight: 700, color: '#8b5cf6' }}>OI</td>
                        <td style={{ padding: '0.45rem 0.5rem', fontWeight: 600 }}>{formulario.esfera_oi}</td>
                        <td style={{ padding: '0.45rem 0.5rem', fontWeight: 600 }}>{formulario.cilindro_oi}</td>
                        <td style={{ padding: '0.45rem 0.5rem' }}>{formulario.eje_oi}</td>
                        <td style={{ padding: '0.45rem 0.5rem' }}>{formulario.adicion_oi}</td>
                        <td style={{ padding: '0.45rem 0.5rem', fontWeight: 600, color: '#10b981' }}>{formulario.av_oi}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Ficha complementaria técnica */}
                <div
                  style={{
                    borderTop: '1px solid var(--borde-tarjeta)',
                    paddingTop: '0.65rem',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '0.5rem',
                    fontSize: '0.78rem',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--texto-atenuado)', display: 'block', fontSize: '0.7rem' }}>Tipo de Lente:</span>
                    <span style={{ fontWeight: 600, color: 'var(--texto-principal)' }}>{formulario.tipo_lente}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--texto-atenuado)', display: 'block', fontSize: '0.7rem' }}>Distancia Pupilar (DP):</span>
                    <span style={{ fontWeight: 600, color: 'var(--texto-principal)' }}>{formulario.distancia_pupilar}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--texto-atenuado)', display: 'block', fontSize: '0.7rem' }}>Optómetra:</span>
                    <span style={{ fontWeight: 600, color: 'var(--texto-principal)' }}>{formulario.optometra}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--texto-atenuado)', display: 'block', fontSize: '0.7rem' }}>Próximo Control:</span>
                    <span style={{ fontWeight: 600, color: 'var(--texto-principal)' }}>En {formulario.proximo_control_en_meses} meses</span>
                  </div>
                  {formulario.observaciones?.trim() && (
                    <div style={{ gridColumn: 'span 2', marginTop: '0.2rem' }}>
                      <span style={{ color: 'var(--texto-atenuado)', display: 'block', fontSize: '0.7rem' }}>Observaciones:</span>
                      <span style={{ color: 'var(--texto-secundario)', fontStyle: 'italic' }}>{formulario.observaciones}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Botones de acción del modal de confirmación */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.2rem' }}>
                <button
                  type="button"
                  onClick={() => setModalConfirmacionAbierto(false)}
                  disabled={cargando}
                  style={{
                    padding: '0.55rem 1.1rem',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--borde-tarjeta)',
                    borderRadius: 'var(--radio-md)',
                    color: 'var(--texto-principal)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <Edit3 size={14} />
                  <span>Editar</span>
                </button>
                <button
                  type="button"
                  onClick={manejarGuardarConfirmado}
                  disabled={cargando}
                  style={{
                    padding: '0.55rem 1.35rem',
                    backgroundColor: 'var(--color-primario, #0284c7)',
                    border: 'none',
                    borderRadius: 'var(--radio-md)',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: cargando ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    boxShadow: 'var(--sombra-sm)',
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>{cargando ? 'Guardando...' : 'Confirmar'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(contenidoModal, document.body) : null;
};
