'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  X,
  CalendarPlus,
  Send,
  History,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';
import { SelectorDesplegable } from '../comunes/SelectorDesplegable';
import { ModalAlertaVentana24h } from '../comunes/ModalAlertaVentana24h';
import type { Contacto, FormulaOptica } from '@/tipos/crm';
import { formatearTelefono, obtenerNombrePaciente } from '@/utilidades/formato';

interface PropiedadesFichaOptometrica {
  contacto: Contacto | null;
  formula: FormulaOptica | null;
  formulas?: FormulaOptica[];
  enVentana24h?: boolean;
  nombreOptica?: string;
  alAlternarFicha: () => void;
  alAbrirNuevaFormula: () => void;
  alAbrirAgendarCita?: () => void;
  alCompartirPrescripcion?: (texto: string) => void;
  alReactivarConPlantilla?: (nombrePlantilla?: string, idiomaPlantilla?: string) => void;
}

export const FichaOptometrica: React.FC<PropiedadesFichaOptometrica> = ({
  contacto,
  formula,
  formulas = [],
  enVentana24h = true,
  nombreOptica,
  alAlternarFicha,
  alAbrirNuevaFormula,
  alAbrirAgendarCita,
  alCompartirPrescripcion,
  alReactivarConPlantilla,
}) => {
  // Lista normalizada de fórmulas históricas del paciente
  const listaFormulas = formulas && formulas.length > 0 ? formulas : formula ? [formula] : [];

  // Estado para la fórmula activa seleccionada (por defecto la más reciente, índice 0)
  const [formulaSeleccionadaId, setFormulaSeleccionadaId] = useState<number | null>(null);

  // Estados de paginación del historial clínico (por defecto 5 registros por página)
  const [limitePorPagina, setLimitePorPagina] = useState<number>(5);
  const [paginaActual, setPaginaActual] = useState<number>(1);
  const [modalAlerta24hAbierto, setModalAlerta24hAbierto] = useState(false);

  // Reiniciar a la primera página y seleccionar la fórmula vigente al cambiar de paciente
  useEffect(() => {
    setPaginaActual(1);
    if (listaFormulas.length > 0) {
      setFormulaSeleccionadaId(listaFormulas[0].id);
    } else {
      setFormulaSeleccionadaId(null);
    }
  }, [contacto?.id, formulas.length, formula?.id]);

  const formulaActiva =
    listaFormulas.find((f) => f.id === formulaSeleccionadaId) || listaFormulas[0] || null;

  const esVigente = listaFormulas.length > 0 ? formulaActiva?.id === listaFormulas[0]?.id : true;

  // Cálculos de paginación
  const totalRegistros = listaFormulas.length;
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / limitePorPagina));
  const indiceInicio = (paginaActual - 1) * limitePorPagina;
  const indiceFin = indiceInicio + limitePorPagina;
  const formulasPaginadas = listaFormulas.slice(indiceInicio, indiceFin);

  const cambiarLimite = (nuevoLimite: string) => {
    setLimitePorPagina(Number(nuevoLimite));
    setPaginaActual(1);
  };

  const generarTextoPrescripcion = (): string => {
    if (!formulaActiva || !contacto) return '';
    const encabezadoOptica = (nombreOptica || 'Óptica').toUpperCase();
    return [
      `👓 *${encabezadoOptica} - Prescripción Clínica ${esVigente ? 'Vigente' : 'Histórica'}*`,
      `👤 *Paciente:* ${obtenerNombrePaciente(contacto)}`,
      `📅 *Fecha Examen:* ${formulaActiva.fecha_examen ? new Date(formulaActiva.fecha_examen).toLocaleDateString() : new Date().toLocaleDateString()}`,
      ``,
      `👁️ *Ojo Derecho (OD):*`,
      `• Esfera: ${formulaActiva.esfera_od || '+0.00'} | Cil: ${formulaActiva.cilindro_od || '-0.00'} | Eje: ${formulaActiva.eje_od || '0'}° | AV: ${formulaActiva.av_od || '20/20'}${formulaActiva.adicion_od ? ` | Adic: ${formulaActiva.adicion_od}` : ''}`,
      ``,
      `👁️ *Ojo Izquierdo (OI):*`,
      `• Esfera: ${formulaActiva.esfera_oi || '+0.00'} | Cil: ${formulaActiva.cilindro_oi || '-0.00'} | Eje: ${formulaActiva.eje_oi || '0'}° | AV: ${formulaActiva.av_oi || '20/20'}${formulaActiva.adicion_oi ? ` | Adic: ${formulaActiva.adicion_oi}` : ''}`,
      ``,
      `🔬 *Tipo de Lente:* ${formulaActiva.tipo_lente || 'Monofocal Antirreflejo'}`,
      `📏 *Distancia Pupilar (DP):* ${formulaActiva.distancia_pupilar || '62 mm'}`,
      `👨‍⚕️ *Optómetra:* ${formulaActiva.optometra || 'Dr. Samir Bolívar'}`,
      `📅 *Próximo Control:* ${formulaActiva.proximo_control_en_meses ? `En ${formulaActiva.proximo_control_en_meses} meses` : 'En 12 meses'}`,
    ].join('\n');
  };

  const manejarCompartir = () => {
    if (!formulaActiva) {
      alert('Este paciente aún no tiene una fórmula óptica registrada. Haz clic en "+ Fórmula" para añadirla.');
      return;
    }

    // Regla de Meta: si han pasado más de 24 horas, advertir corporativamente y no intentar enviar texto libre
    if (enVentana24h === false) {
      setModalAlerta24hAbierto(true);
      return;
    }

    const texto = generarTextoPrescripcion();
    if (alCompartirPrescripcion) {
      alCompartirPrescripcion(texto);
    }
  };

  return (
    <div id="columna-ficha-optometrica" className="columna-ficha-optometrica">
      <div className="ficha-seccion-cabecera">
        <span className="ficha-seccion-titulo">
          <FileText style={{ color: 'var(--color-primario-claro)', width: '14px', height: '14px' }} />
          <span>Ficha Optométrica</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <EtiquetaTooltip texto="Añadir nueva fórmula óptica" posicion="abajo">
            <button
              type="button"
              className="btn-primario-optica"
              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
              onClick={alAbrirNuevaFormula}
              disabled={!contacto}
            >
              + Fórmula
            </button>
          </EtiquetaTooltip>

          <EtiquetaTooltip texto="Ocultar ficha optométrica para ganar espacio" posicion="abajo">
            <button
              type="button"
              className="btn-cerrar-ficha"
              onClick={alAlternarFicha}
            >
              <X style={{ width: '14px', height: '14px' }} />
            </button>
          </EtiquetaTooltip>
        </div>
      </div>

      <div style={{ background: 'var(--fondo-elevado)', border: '1px solid var(--borde-tarjeta)', borderRadius: 'var(--radio-md)', padding: '0.55rem 0.7rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--texto-principal)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} id="ficha-paciente-nombre">
          <span>{contacto?.nombre || 'Paciente no seleccionado'}</span>
          {contacto?.sexo && (
            <span style={{ fontSize: '0.67rem', fontWeight: 600, color: contacto.sexo === 'femenino' ? '#db2777' : 'var(--color-primario)' }}>
              {contacto.sexo === 'femenino' ? 'Femenino' : 'Masculino'}
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--texto-secundario)', marginTop: '0.15rem' }} id="ficha-paciente-detalles">
          {contacto ? (contacto.telefono ? formatearTelefono(contacto.telefono) : 'Sin teléfono registrado') : 'Selecciona una conversación para cargar su refracción.'}
          {contacto?.edad ? ` • ${contacto.edad} años` : ''}
        </div>
      </div>

      {/* Visualización de la Fórmula Seleccionada (Vigente o Histórica) */}
      {formulaActiva ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <strong style={{ fontSize: '0.82rem', color: 'var(--texto-principal)' }}>
                  {esVigente ? 'Fórmula Actual Vigente:' : 'Fórmula Histórica:'}
                </strong>
                {esVigente ? (
                  <span className="badge-estado-vigente">Vigente</span>
                ) : (
                  <span className="badge-estado-historico">Anterior</span>
                )}
              </div>
              <span id="ficha-fecha-examen" style={{ fontSize: '0.72rem', color: 'var(--texto-atenuado)' }}>
                {formulaActiva.fecha_examen ? new Date(formulaActiva.fecha_examen).toLocaleDateString() : '--/--/----'}
              </span>
            </div>

            <table className="tabla-formula-optica">
              <thead>
                <tr>
                  <th>Ojo</th>
                  <th>Esfera</th>
                  <th>Cil.</th>
                  <th>Eje</th>
                  <th>Adic.</th>
                  <th>AV</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="ojo-rotulo">OD</td>
                  <td id="f-od-esf">{formulaActiva.esfera_od || '+0.00'}</td>
                  <td id="f-od-cil">{formulaActiva.cilindro_od || '-0.00'}</td>
                  <td id="f-od-eje">{formulaActiva.eje_od ? `${formulaActiva.eje_od}°` : '0°'}</td>
                  <td id="f-od-add">{formulaActiva.adicion_od || '+0.00'}</td>
                  <td id="f-od-av">{formulaActiva.av_od || '20/20'}</td>
                </tr>
                <tr>
                  <td className="ojo-rotulo">OI</td>
                  <td id="f-oi-esf">{formulaActiva.esfera_oi || '+0.00'}</td>
                  <td id="f-oi-cil">{formulaActiva.cilindro_oi || '-0.00'}</td>
                  <td id="f-oi-eje">{formulaActiva.eje_oi ? `${formulaActiva.eje_oi}°` : '0°'}</td>
                  <td id="f-oi-add">{formulaActiva.adicion_oi || '+0.00'}</td>
                  <td id="f-oi-av">{formulaActiva.av_oi || '20/20'}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: '0.45rem', fontSize: '0.72rem', color: 'var(--texto-secundario)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div><strong>Distancia Pupilar (DP):</strong> <span id="f-dp">{formulaActiva.distancia_pupilar || '62 mm'}</span></div>
              <div><strong>Tipo de Lente:</strong> <span id="f-lente" style={{ background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)', color: 'var(--color-primario)', padding: '0.05rem 0.35rem', borderRadius: '4px', fontWeight: 600 }}>{formulaActiva.tipo_lente || 'Monofocal Antirreflejo'}</span></div>
              <div><strong>Optómetra:</strong> <span id="f-optometra">{formulaActiva.optometra || 'Dr. Samir Bolívar'}</span></div>
              <div><strong>Próximo Control:</strong> <span id="f-control" style={{ color: '#ea580c', fontWeight: 600 }}>{formulaActiva.proximo_control_en_meses ? `En ${formulaActiva.proximo_control_en_meses} meses` : 'En 12 meses'}</span></div>
            </div>
          </div>

          {/* Tabla de Historial Clínico con Paginación Configurable */}
          {totalRegistros > 0 && (
            <div style={{ marginTop: '0.45rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--texto-secundario)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <History style={{ width: '13px', height: '13px', color: 'var(--color-primario-claro)' }} />
                  <span>Historial de Fórmulas ({totalRegistros})</span>
                </span>
                <span style={{ fontSize: '0.66rem', color: 'var(--texto-atenuado)' }}>
                  Clic en fila para consultar
                </span>
              </div>

              <div className="tabla-historial-formulas-envoltorio">
                <table className="tabla-historial-formulas">
                  <thead>
                    <tr>
                      <th style={{ width: '28%' }}>Fecha</th>
                      <th style={{ width: '36%' }}>Tipo Lente</th>
                      <th style={{ width: '22%' }}>Optómetra</th>
                      <th style={{ width: '14%', textAlign: 'center' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formulasPaginadas.map((f, index) => {
                      const estaSeleccionada = f.id === formulaActiva.id;
                      const esLaMasReciente = (indiceInicio + index) === 0;

                      return (
                        <tr
                          key={f.id || index}
                          onClick={() => setFormulaSeleccionadaId(f.id)}
                          className={`fila-historial-formula ${estaSeleccionada ? 'seleccionada' : ''}`}
                        >
                          <td style={{ fontWeight: estaSeleccionada ? 700 : 500 }}>
                            {f.fecha_examen ? new Date(f.fecha_examen).toLocaleDateString() : '--/--/----'}
                          </td>
                          <td>
                            <span className="celda-tipo-lente">{f.tipo_lente || 'Monofocal'}</span>
                          </td>
                          <td style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.optometra || 'Especialista'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {esLaMasReciente ? (
                              <span className="badge-estado-vigente">Vigente</span>
                            ) : (
                              <span className="badge-estado-historico">Anterior</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Barra de Paginación Configurable (5, 10, 20, 50 por defecto 5) */}
              <div className="ficha-historial-paginacion">
                <div className="paginacion-limite-grupo">
                  <span style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)' }}>Ver:</span>
                  <SelectorDesplegable
                    valor={String(limitePorPagina)}
                    alCambiar={cambiarLimite}
                    opciones={[
                      { valor: '5', etiqueta: '5' },
                      { valor: '10', etiqueta: '10' },
                      { valor: '20', etiqueta: '20' },
                      { valor: '50', etiqueta: '50' },
                    ]}
                    direccion="arriba"
                    tamano="compacto"
                    anchoMinimo="60px"
                  />
                </div>

                <div className="paginacion-controles-grupo">
                  <EtiquetaTooltip texto="Página anterior" posicion="arriba">
                    <button
                      type="button"
                      className="btn-paginacion-flecha"
                      disabled={paginaActual <= 1}
                      onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                      aria-label="Página anterior"
                    >
                      <ChevronLeft style={{ width: '13px', height: '13px' }} />
                    </button>
                  </EtiquetaTooltip>

                  <span className="texto-paginacion-contador">
                    {paginaActual} de {totalPaginas}
                  </span>

                  <EtiquetaTooltip texto="Página siguiente" posicion="arriba">
                    <button
                      type="button"
                      className="btn-paginacion-flecha"
                      disabled={paginaActual >= totalPaginas}
                      onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                      aria-label="Página siguiente"
                    >
                      <ChevronRight style={{ width: '13px', height: '13px' }} />
                    </button>
                  </EtiquetaTooltip>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          padding: '1.2rem 0.75rem',
          textAlign: 'center',
          background: 'var(--fondo-elevado)',
          borderRadius: 'var(--radio-md)',
          border: '1px dashed var(--borde-tarjeta)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.45rem'
        }}>
          <FileText style={{ width: '22px', height: '22px', color: 'var(--color-primario-claro)', opacity: 0.8 }} />
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--texto-principal)' }}>
            Sin refracción registrada
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--texto-atenuado)', margin: 0, lineHeight: 1.3 }}>
            {contacto ? 'Este paciente aún no tiene una fórmula óptica guardada.' : 'Selecciona una conversación para cargar su ficha clínica.'}
          </p>
          {contacto && (
            <button
              type="button"
              className="btn-primario-optica"
              style={{ fontSize: '0.7rem', padding: '0.25rem 0.65rem', marginTop: '0.25rem' }}
              onClick={alAbrirNuevaFormula}
            >
              + Registrar Fórmula
            </button>
          )}
        </div>
      )}

      {/* Acciones Rápidas del Paciente */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem', width: '100%' }}>
        <EtiquetaTooltip
          texto="Programar cita o examen visual en agenda clínica"
          posicion="arriba"
          className="etiqueta-tooltip-ancho-completo"
        >
          <button
            type="button"
            className="btn-primario-optica"
            style={{ width: '100%', background: '#10b981', padding: '0.42rem 0.6rem', fontSize: '0.74rem' }}
            onClick={alAbrirAgendarCita}
            disabled={!contacto}
          >
            <CalendarPlus style={{ width: '14px', height: '14px' }} />
            <span>Agendar Cita de Control</span>
          </button>
        </EtiquetaTooltip>

        <EtiquetaTooltip
          texto={
            formulaActiva
              ? (enVentana24h === false
                  ? 'Ventana de 24h inactiva en WhatsApp. Clic para ver restricciones oficiales de Meta'
                  : `Enviar prescripción ${esVigente ? 'vigente' : 'histórica'} al chat del paciente`)
              : 'Registra primero la fórmula para poder enviarla'
          }
          posicion="arriba"
          className="etiqueta-tooltip-ancho-completo"
        >
          <button
            type="button"
            className="panel-btn-accion-pie"
            style={{
              width: '100%',
              padding: '0.42rem 0.6rem',
              fontSize: '0.74rem',
              ...(enVentana24h === false && formulaActiva ? { borderColor: 'rgba(245, 158, 11, 0.4)' } : {}),
            }}
            onClick={manejarCompartir}
            disabled={!formulaActiva}
          >
            <Send style={{ width: '14px', height: '14px', color: formulaActiva ? (enVentana24h === false ? '#f59e0b' : 'var(--color-primario)') : 'var(--texto-atenuado)' }} />
            <span>Enviar Prescripción al Chat</span>
            {enVentana24h === false && formulaActiva && (
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  color: '#b45309',
                  background: 'rgba(245, 158, 11, 0.15)',
                  padding: '1px 5px',
                  borderRadius: '4px',
                }}
              >
                24h cerrada
              </span>
            )}
          </button>
        </EtiquetaTooltip>
      </div>

      {/* Modal de Advertencia de Ventana de 24 Horas Expirada */}
      <ModalAlertaVentana24h
        abierto={modalAlerta24hAbierto}
        alCerrar={() => setModalAlerta24hAbierto(false)}
        titulo="No es posible enviar la prescripción médica"
        subtitulo="Ventana de 24h Expirada"
        nombrePaciente={obtenerNombrePaciente(contacto)}
        mensaje={`No es posible entregar la prescripción médica directamente por WhatsApp a ${obtenerNombrePaciente(contacto)}: Han transcurrido más de 24 horas desde su última respuesta o mensaje entrante, por lo que la ventana de servicio de Meta se encuentra cerrada. Para compartir este reporte clínico, reanuda primero la conversación enviando una plantilla preaprobada desde el chat o espera a que el paciente te vuelva a escribir.`}
        alReactivarPlantilla={alReactivarConPlantilla}
        accionTexto="Reactivar Chat con Plantilla"
      />
    </div>
  );
};
