'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Users,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Sparkles,
  Info,
  Download,
  UploadCloud,
  FileText,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SelectorDesplegable } from '../comunes/SelectorDesplegable';
import { BurbujaWhatsApp } from './BurbujaWhatsApp';
import { calcularAudienciaLoteCampana, lanzarLoteCampanaApi } from '@/servicios/api_crm';
import type { PlantillaWhatsApp, Segmento, CuotaDiariaWhatsApp, CalculoAudienciaLote } from '@/tipos/crm';

interface PropiedadesModalLanzarLote {
  abierto: boolean;
  plantilla: PlantillaWhatsApp | null;
  plantillasDisponibles?: PlantillaWhatsApp[];
  alSeleccionarPlantilla?: (plantilla: PlantillaWhatsApp) => void;
  segmentos: Segmento[];
  segmentoPreseleccionadoId?: number | null;
  cuota: CuotaDiariaWhatsApp | null;
  alCerrar: () => void;
  alLanzarExitoso: (resultado: any) => void;
  nombreOptica?: string;
  opticaId?: number;
}

export const ModalLanzarLote: React.FC<PropiedadesModalLanzarLote> = ({
  abierto,
  plantilla,
  plantillasDisponibles,
  alSeleccionarPlantilla,
  segmentos,
  segmentoPreseleccionadoId = null,
  cuota,
  alCerrar,
  alLanzarExitoso,
  nombreOptica,
  opticaId,
}) => {
  const [plantillaActiva, setPlantillaActiva] = useState<PlantillaWhatsApp | null>(plantilla);
  const [origenTipo, setOrigenTipo] = useState<'segmento' | 'csv'>('segmento');
  const [segmentoSeleccionadoId, setSegmentoSeleccionadoId] = useState<string>('');
  const [textoTelefonosCsv, setTextoTelefonosCsv] = useState('');
  const [archivoCargadoInfo, setArchivoCargadoInfo] = useState<{ nombre: string; total: number } | null>(null);
  const [modoEntradaCsv, setModoEntradaCsv] = useState<'archivo' | 'manual'>('archivo');
  const [nombreCampana, setNombreCampana] = useState('');
  const [forzarReenvio, setForzarReenvio] = useState(false);
  const [mostrarDetalleExcluidos, setMostrarDetalleExcluidos] = useState(false);

  const [calculando, setCalculando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultadoCalculo, setResultadoCalculo] = useState<CalculoAudienciaLote | null>(null);
  const [errorOperacion, setErrorOperacion] = useState<string | null>(null);

  const inputArchivoRef = useRef<HTMLInputElement>(null);

  // Sincronizar plantilla inicial cuando cambia prop o cambian las disponibles
  useEffect(() => {
    if (plantilla) {
      setPlantillaActiva(plantilla);
    } else if (plantillasDisponibles && plantillasDisponibles.length > 0) {
      if (!plantillaActiva || !plantillasDisponibles.some((p) => p.id === plantillaActiva.id)) {
        setPlantillaActiva(plantillasDisponibles[0]);
      }
    }
  }, [plantilla, plantillasDisponibles]);

  // Inicializar estado cuando se abre el modal
  useEffect(() => {
    if (abierto && (plantilla || plantillaActiva)) {
      setErrorOperacion(null);
      setResultadoCalculo(null);
      setTextoTelefonosCsv('');
      setArchivoCargadoInfo(null);
      setModoEntradaCsv('archivo');
      setForzarReenvio(false);
      setMostrarDetalleExcluidos(false);

      if (segmentoPreseleccionadoId) {
        setSegmentoSeleccionadoId(String(segmentoPreseleccionadoId));
      } else if (segmentos.length > 0) {
        setSegmentoSeleccionadoId(String(segmentos[0].id));
      }
    }
  }, [abierto, plantilla, plantillaActiva, segmentoPreseleccionadoId, segmentos]);

  // Recalcular audiencia cuando cambia el segmento, la plantilla, los teléfonos o la opción de forzar reenvío
  useEffect(() => {
    if (!abierto || !plantillaActiva) return;

    const ejecutarCalculo = async () => {
      setCalculando(true);
      setErrorOperacion(null);

      try {
        let telefonosArray: string[] = [];
        if (origenTipo === 'csv' && textoTelefonosCsv.trim()) {
          telefonosArray = textoTelefonosCsv
            .split(/[\n,;]+/)
            .map((t) => t.trim())
            .filter((t) => t.length >= 7);
        }

        const res = await calcularAudienciaLoteCampana({
          plantillaId: plantillaActiva.id,
          segmentoId: origenTipo === 'segmento' && segmentoSeleccionadoId ? Number(segmentoSeleccionadoId) : null,
          telefonosDirectos: origenTipo === 'csv' ? telefonosArray : undefined,
          diasExclusion: 7,
          forzarReenvio: forzarReenvio,
        });

        if (res.exito !== false && (res.exito || res.plantilla)) {
          setResultadoCalculo(res as CalculoAudienciaLote);
          const numLote = res.lote_numero || 1;
          const etiqueta = plantillaActiva.etiqueta || plantillaActiva.nombre;
          setNombreCampana(`Lote #${numLote} - ${etiqueta}`);
        } else {
          setErrorOperacion(res.error || 'Error al calcular audiencia');
          setResultadoCalculo(null);
        }
      } catch (err: any) {
        setErrorOperacion(err.message || 'Error calculando audiencia');
      } finally {
        setCalculando(false);
      }
    };

    ejecutarCalculo();
  }, [abierto, plantillaActiva?.id, origenTipo, segmentoSeleccionadoId, textoTelefonosCsv, forzarReenvio]);

  // Descargar plantilla base oficial en formato Excel (.xlsx)
  const descargarPlantillaBase = () => {
    const datosEjemplo = [
      { Telefono: '3001234567' },
    ];

    const libro = XLSX.utils.book_new();
    const hoja = XLSX.utils.json_to_sheet(datosEjemplo);
    hoja['!cols'] = [{ wch: 20 }];
    XLSX.utils.book_append_sheet(libro, hoja, 'Telefonos');
    XLSX.writeFile(libro, 'plantilla_telefonos_whatsapp.xlsx', { bookType: 'xlsx' });
  };

  // Procesar archivo Excel / CSV subido por el usuario
  const procesarArchivoSubido = async (archivo: File) => {
    setErrorOperacion(null);
    try {
      const extension = archivo.name.split('.').pop()?.toLowerCase();

      if (extension === 'txt' || extension === 'csv') {
        const texto = await archivo.text();
        const lineas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
        const telefonos: string[] = [];

        for (const linea of lineas) {
          const partes = linea.split(/[,;\t]/).map((p) => p.trim().replace(/^["']|["']$/g, ''));
          const parteTel = partes.find((p) => p.replace(/[^0-9]/g, '').length >= 7) || partes[partes.length - 1];
          if (parteTel) {
            const limpio = parteTel.replace(/[^0-9+]/g, '');
            if (limpio.replace(/[^0-9]/g, '').length >= 7) {
              telefonos.push(limpio);
            }
          }
        }

        if (telefonos.length === 0) {
          throw new Error('No se encontraron números de teléfono válidos en el archivo.');
        }

        setArchivoCargadoInfo({ nombre: archivo.name, total: telefonos.length });
        setTextoTelefonosCsv(telefonos.join('\n'));
        return;
      }

      // Procesar archivo Excel (.xlsx / .xls)
      const arrayBuffer = await archivo.arrayBuffer();
      const libro = XLSX.read(arrayBuffer, { type: 'array' });
      const nombreHoja = libro.SheetNames[0];
      const primeraHoja = libro.Sheets[nombreHoja];
      const filas: any[] = XLSX.utils.sheet_to_json(primeraHoja, { header: 1 });

      if (!filas || filas.length === 0) {
        throw new Error('El archivo Excel está vacío.');
      }

      // Buscar índice de la columna de teléfono
      const cabecera = filas[0] || [];
      let indiceColumnaTel = -1;

      if (Array.isArray(cabecera)) {
        indiceColumnaTel = cabecera.findIndex((c: any) =>
          /tel[eé]fono|celular|phone|mobile|numero|número|contacto|whatsapp/i.test(String(c))
        );
      }

      const telefonosExtraidos: string[] = [];
      const inicioFila = indiceColumnaTel !== -1 ? 1 : 0;

      for (let i = inicioFila; i < filas.length; i++) {
        const fila = filas[i];
        if (!fila || !Array.isArray(fila)) continue;

        let valorTel = '';
        if (indiceColumnaTel !== -1 && fila[indiceColumnaTel] !== undefined) {
          valorTel = String(fila[indiceColumnaTel]);
        } else {
          const celdaTel = fila.find((c: any) => String(c).replace(/[^0-9]/g, '').length >= 7);
          if (celdaTel !== undefined) valorTel = String(celdaTel);
        }

        if (valorTel) {
          const telLimpio = valorTel.replace(/[^0-9+]/g, '');
          if (telLimpio.replace(/[^0-9]/g, '').length >= 7) {
            telefonosExtraidos.push(telLimpio);
          }
        }
      }

      if (telefonosExtraidos.length === 0) {
        throw new Error('No se encontraron números de teléfono válidos en el archivo Excel.');
      }

      setArchivoCargadoInfo({ nombre: archivo.name, total: telefonosExtraidos.length });
      setTextoTelefonosCsv(telefonosExtraidos.join('\n'));
    } catch (err: any) {
      setErrorOperacion(err.message || 'Error al procesar el archivo Excel / CSV');
    }
  };

  const limpiarArchivoCargado = () => {
    setArchivoCargadoInfo(null);
    setTextoTelefonosCsv('');
    if (inputArchivoRef.current) inputArchivoRef.current.value = '';
  };

  if (!abierto || !plantillaActiva) return null;

  const limiteDiarioOptica = cuota?.limite_diario || resultadoCalculo?.limite_diario_disponible || 250;

  const manejarLanzarLote = async () => {
    if (!resultadoCalculo || resultadoCalculo.cantidad_a_enviar_hoy <= 0) return;

    setEnviando(true);
    setErrorOperacion(null);

    try {
      let telefonosArray: string[] = [];
      if (origenTipo === 'csv' && textoTelefonosCsv.trim()) {
        telefonosArray = textoTelefonosCsv
          .split(/[\n,;]+/)
          .map((t) => t.trim())
          .filter((t) => t.length >= 7);
      }

      const nombreFinalCampana =
        nombreCampana.trim() ||
        (resultadoCalculo?.lote_numero
          ? `Lote #${resultadoCalculo.lote_numero} - ${plantillaActiva.etiqueta || plantillaActiva.nombre}`
          : `Lote #1 - ${plantillaActiva.etiqueta || plantillaActiva.nombre}`);

      const res = await lanzarLoteCampanaApi({
        plantillaId: plantillaActiva.id,
        segmentoId: origenTipo === 'segmento' ? Number(segmentoSeleccionadoId) : null,
        telefonosDirectos: origenTipo === 'csv' ? telefonosArray : undefined,
        nombreCampana: nombreFinalCampana,
        diasExclusion: 7,
        tamanoLoteDeseado: limiteDiarioOptica,
        forzarReenvio: forzarReenvio,
      });

      if (!res.exito) {
        throw new Error(res.error || 'No se pudo lanzar el lote');
      }

      alLanzarExitoso(res);
      alCerrar();
    } catch (err: any) {
      setErrorOperacion(err.message || 'Error al procesar el envío del lote');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !enviando) alCerrar();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        animation: 'aparecerSuave 0.15s ease-out',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--fondo-tarjeta)',
          border: '1px solid var(--borde-tarjeta)',
          borderRadius: 'var(--radio-lg)',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--sombra-lg)',
          overflow: 'hidden',
          animation: 'escalarEntrada 0.18s ease-out',
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: '1.1rem 1.4rem',
            borderBottom: '1px solid var(--borde-tarjeta)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--fondo-base)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)',
                color: 'var(--color-primario)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Send size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--texto-principal)', margin: 0 }}>
                Lanzar Campaña por Lote
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--texto-atenuado)', margin: '0.1rem 0 0 0' }}>
                Plantilla: <strong style={{ color: 'var(--texto-principal)' }}>{plantillaActiva.etiqueta || plantillaActiva.nombre}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={alCerrar}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--texto-atenuado)',
              cursor: 'pointer',
              padding: '0.35rem',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {errorOperacion && (
            <div
              style={{
                padding: '0.65rem 0.85rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                borderRadius: 'var(--radio-sm)',
                color: '#ef4444',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertTriangle size={15} />
              <span>{errorOperacion}</span>
            </div>
          )}

          {/* Selector de plantilla si hay múltiples disponibles */}
          {plantillasDisponibles && plantillasDisponibles.length > 1 && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--texto-secundario)', marginBottom: '0.35rem' }}>
                Seleccionar Plantilla Oficial
              </label>
              <SelectorDesplegable
                valor={plantillaActiva.id ? String(plantillaActiva.id) : ''}
                alCambiar={(val) => {
                  const elegida = plantillasDisponibles.find((p) => String(p.id) === val);
                  if (elegida) {
                    setPlantillaActiva(elegida);
                    if (alSeleccionarPlantilla) alSeleccionarPlantilla(elegida);
                  }
                }}
                opciones={plantillasDisponibles.map((p) => ({
                  valor: String(p.id),
                  etiqueta: `${p.etiqueta || p.nombre} (${p.categoria || 'UTILIDAD'})`,
                }))}
                anchoMinimo="100%"
              />
            </div>
          )}

          {/* Selector de origen de audiencia */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--texto-secundario)', marginBottom: '0.4rem' }}>
              Origen de la Audiencia
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setOrigenTipo('segmento')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radio-md)',
                  border: origenTipo === 'segmento' ? '2px solid var(--color-primario)' : '1px solid var(--borde-tarjeta)',
                  backgroundColor: origenTipo === 'segmento' ? 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.08)' : 'var(--fondo-base)',
                  color: 'var(--texto-principal)',
                  fontSize: '0.82rem',
                  fontWeight: origenTipo === 'segmento' ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                <Users size={16} style={{ color: 'var(--color-primario)' }} />
                <span>Auto-Segmentación</span>
              </button>

              <button
                type="button"
                onClick={() => setOrigenTipo('csv')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radio-md)',
                  border: origenTipo === 'csv' ? '2px solid var(--color-primario)' : '1px solid var(--borde-tarjeta)',
                  backgroundColor: origenTipo === 'csv' ? 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.08)' : 'var(--fondo-base)',
                  color: 'var(--texto-principal)',
                  fontSize: '0.82rem',
                  fontWeight: origenTipo === 'csv' ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                <FileSpreadsheet size={16} style={{ color: '#10b981' }} />
                <span>Carga Masiva (Excel)</span>
              </button>
            </div>
          </div>

          {/* Configuración según origen */}
          {origenTipo === 'segmento' ? (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--texto-secundario)', marginBottom: '0.35rem' }}>
                Seleccionar Segmento de Pacientes
              </label>
              <SelectorDesplegable
                valor={segmentoSeleccionadoId}
                alCambiar={(val) => setSegmentoSeleccionadoId(val)}
                opciones={segmentos.map((s) => ({
                  valor: String(s.id),
                  etiqueta: `${s.nombre} (${s.total_pacientes || 0} pacientes)`,
                }))}
                anchoMinimo="100%"
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Barra de herramientas para descargar plantilla */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: 'var(--radio-md)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <FileSpreadsheet size={16} style={{ color: '#10b981' }} />
                  <div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--texto-principal)', display: 'block' }}>
                      Plantilla oficial para carga de contactos
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--texto-atenuado)' }}>
                      Descarga el formato Excel (.xlsx), pega tus números telefónicos y súbelo aquí.
                    </span>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={descargarPlantillaBase}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.75rem',
                      backgroundColor: '#10b981',
                      border: 'none',
                      borderRadius: 'var(--radio-sm)',
                      color: '#ffffff',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: 'var(--sombra-sm)',
                    }}
                  >
                    <Download size={14} />
                    <span>Descargar Plantilla Excel (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Selector de modo de carga (archivo o manual) */}
              <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid var(--borde-tarjeta)', paddingBottom: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setModoEntradaCsv('archivo')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.75rem',
                    fontWeight: modoEntradaCsv === 'archivo' ? 700 : 500,
                    color: modoEntradaCsv === 'archivo' ? 'var(--color-primario)' : 'var(--texto-atenuado)',
                    borderBottom: modoEntradaCsv === 'archivo' ? '2px solid var(--color-primario)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  Subir Archivo Excel
                </button>
                <button
                  type="button"
                  onClick={() => setModoEntradaCsv('manual')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.75rem',
                    fontWeight: modoEntradaCsv === 'manual' ? 700 : 500,
                    color: modoEntradaCsv === 'manual' ? 'var(--color-primario)' : 'var(--texto-atenuado)',
                    borderBottom: modoEntradaCsv === 'manual' ? '2px solid var(--color-primario)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  Pegar Lista Manualmente
                </button>
              </div>

              {modoEntradaCsv === 'archivo' ? (
                <div>
                  <input
                    ref={inputArchivoRef}
                    type="file"
                    accept=".xlsx, .xls"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const archivo = e.target.files?.[0];
                      if (archivo) procesarArchivoSubido(archivo);
                    }}
                  />

                  {archivoCargadoInfo ? (
                    <div
                      style={{
                        padding: '0.85rem',
                        backgroundColor: 'var(--fondo-base)',
                        border: '1px solid #10b981',
                        borderRadius: 'var(--radio-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <CheckCircle2 size={18} />
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.82rem', color: 'var(--texto-principal)', display: 'block' }}>
                            {archivoCargadoInfo.nombre}
                          </strong>
                          <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
                            ✓ {archivoCargadoInfo.total} números de teléfono identificados
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => inputArchivoRef.current?.click()}
                          style={{
                            padding: '0.35rem 0.65rem',
                            backgroundColor: 'var(--fondo-tarjeta)',
                            border: '1px solid var(--borde-tarjeta)',
                            borderRadius: 'var(--radio-sm)',
                            color: 'var(--texto-principal)',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                          }}
                        >
                          Cambiar archivo
                        </button>
                        <button
                          type="button"
                          onClick={limpiarArchivoCargado}
                          style={{
                            padding: '0.35rem 0.5rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: 'var(--radio-sm)',
                            color: '#ef4444',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                          }}
                          title="Eliminar archivo cargado"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => inputArchivoRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const archivo = e.dataTransfer.files?.[0];
                        if (archivo) procesarArchivoSubido(archivo);
                      }}
                      style={{
                        padding: '1.25rem',
                        border: '2px dashed var(--borde-tarjeta)',
                        borderRadius: 'var(--radio-md)',
                        backgroundColor: 'var(--fondo-base)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        textAlign: 'center',
                        gap: '0.45rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.1)',
                          color: 'var(--color-primario)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <UploadCloud size={20} />
                      </div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--texto-principal)' }}>
                        Haz clic para subir o arrastra tu archivo Excel aquí
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--texto-atenuado)' }}>
                        Formatos soportados: .xlsx, .xls
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--texto-secundario)' }}>
                      Lista de Teléfonos (Uno por línea o separados por coma)
                    </label>
                    {textoTelefonosCsv.trim() && (
                      <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>
                        {textoTelefonosCsv.split(/[\n,;]+/).filter((t) => t.trim().replace(/[^0-9]/g, '').length >= 7).length} números ingresados
                      </span>
                    )}
                  </div>
                  <textarea
                    value={textoTelefonosCsv}
                    onChange={(e) => setTextoTelefonosCsv(e.target.value)}
                    placeholder="+573001234567&#10;+573109876543&#10;3204567890..."
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      backgroundColor: 'var(--fondo-base)',
                      border: '1px solid var(--borde-tarjeta)',
                      borderRadius: 'var(--radio-md)',
                      color: 'var(--texto-principal)',
                      fontSize: '0.85rem',
                      fontFamily: "'SF Mono', 'Fira Code', 'Roboto Mono', 'Cascadia Code', Consolas, ui-monospace, monospace",
                      fontVariantNumeric: 'tabular-nums',
                      fontFeatureSettings: '"tnum" 1',
                      letterSpacing: '0.04em',
                      lineHeight: '1.6',
                    }}
                  />
                </div>
              )}
            </div>
          )}



          {/* Tarjeta de Cálculo Inteligente de Lote */}
          <div
            style={{
              backgroundColor: 'var(--fondo-base)',
              border: '1px solid var(--borde-tarjeta)',
              borderRadius: 'var(--radio-md)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--texto-principal)' }}>
                <Clock size={15} style={{ color: 'var(--color-primario)' }} />
                <span>
                  Cálculo Inteligente de Lote ({limiteDiarioOptica.toLocaleString('es-CO')} / día)
                </span>
              </div>
              {calculando && <span style={{ fontSize: '0.72rem', color: 'var(--texto-atenuado)' }}>Calculando...</span>}
            </div>

            {resultadoCalculo ? (
              <>
                {/* Cuadrícula de Métricas de Audiencia */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                  <div style={{ padding: '0.5rem', backgroundColor: 'var(--fondo-tarjeta)', borderRadius: 'var(--radio-sm)', border: '1px solid var(--borde-tarjeta)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)' }}>Audiencia Total</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--texto-principal)' }}>
                      {resultadoCalculo.total_audiencia_inicial}
                    </div>
                  </div>

                  <div style={{ padding: '0.5rem', backgroundColor: 'var(--fondo-tarjeta)', borderRadius: 'var(--radio-sm)', border: '1px solid var(--borde-tarjeta)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)' }}>Excluidos</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: resultadoCalculo.forzar_reenvio_activo ? '#10b981' : '#ea580c' }}>
                      {resultadoCalculo.ya_contactados_recientes}
                    </div>
                    {resultadoCalculo.forzar_reenvio_activo && (
                      <span style={{ fontSize: '0.62rem', color: '#10b981', display: 'block', fontWeight: 600, marginTop: '2px' }}>
                        Reenvío forzado
                      </span>
                    )}
                  </div>

                  <div style={{ padding: '0.5rem', backgroundColor: 'var(--fondo-tarjeta)', borderRadius: 'var(--radio-sm)', border: '1px solid var(--borde-tarjeta)' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)' }}>Pendientes Elegibles</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#10b981' }}>
                      {resultadoCalculo.pendientes_elegibles}
                    </div>
                  </div>
                </div>

                {/* Detalle de Excluidos, Desglose y Forzar Reenvío */}
                {resultadoCalculo.ya_contactados_recientes > 0 && (
                  <div
                    style={{
                      backgroundColor: 'var(--fondo-tarjeta)',
                      border: '1px solid rgba(234, 88, 12, 0.25)',
                      borderRadius: 'var(--radio-sm)',
                      padding: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.6rem',
                    }}
                  >
                    {/* Encabezado con toggle de detalle */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <AlertTriangle size={15} style={{ color: '#ea580c', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--texto-principal)' }}>
                          {resultadoCalculo.ya_contactados_recientes} {resultadoCalculo.ya_contactados_recientes === 1 ? 'paciente recibió' : 'pacientes recibieron'} esta plantilla hace menos de 7 días
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMostrarDetalleExcluidos(!mostrarDetalleExcluidos)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--color-primario)',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          padding: '0.2rem 0.4rem',
                          borderRadius: '4px',
                        }}
                      >
                        <span>{mostrarDetalleExcluidos ? 'Ocultar detalle' : 'Ver quiénes y por qué'}</span>
                        {mostrarDetalleExcluidos ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>

                    {/* Lista desplegable con scroll de quiénes y por qué */}
                    {mostrarDetalleExcluidos && (
                      <div
                        style={{
                          maxHeight: '160px',
                          overflowY: 'auto',
                          borderRadius: 'var(--radio-sm)',
                          border: '1px solid var(--borde-tarjeta)',
                          backgroundColor: 'var(--fondo-base)',
                          padding: '0.4rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                        }}
                      >
                        {resultadoCalculo.excluidos_detalle && resultadoCalculo.excluidos_detalle.length > 0 ? (
                          resultadoCalculo.excluidos_detalle.map((exc, idx) => (
                            <div
                              key={`${exc.telefono}-${idx}`}
                              style={{
                                padding: '0.35rem 0.5rem',
                                backgroundColor: 'var(--fondo-tarjeta)',
                                borderRadius: '4px',
                                border: '1px solid var(--borde-tarjeta)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '0.72rem',
                                gap: '0.5rem',
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <strong style={{ color: 'var(--texto-principal)' }}>{exc.nombre || 'Paciente'}</strong>
                                <span
                                  style={{
                                    color: 'var(--texto-atenuado)',
                                    fontFamily: "'SF Mono', Consolas, monospace",
                                    fontSize: '0.68rem',
                                  }}
                                >
                                  {exc.telefono}
                                </span>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '0.15rem 0.4rem',
                                    backgroundColor: 'rgba(234, 88, 12, 0.1)',
                                    color: '#ea580c',
                                    borderRadius: '3px',
                                    fontSize: '0.66rem',
                                    fontWeight: 600,
                                  }}
                                >
                                  {exc.dias_hace === 0 ? 'Hoy' : `Hace ${exc.dias_hace} días`}
                                </span>
                                {exc.motivo && (
                                  <div style={{ fontSize: '0.65rem', color: 'var(--texto-atenuado)', marginTop: '2px' }}>
                                    {exc.motivo}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.72rem', color: 'var(--texto-atenuado)' }}>
                            No hay información disponible de exclusiones.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Casilla opcional para forzar reenvío */}
                    <div
                      style={{
                        paddingTop: '0.4rem',
                        borderTop: '1px dashed var(--borde-tarjeta)',
                      }}
                    >
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.55rem',
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={forzarReenvio}
                          onChange={(e) => setForzarReenvio(e.target.checked)}
                          style={{
                            marginTop: '2px',
                            cursor: 'pointer',
                            accentColor: 'var(--color-primario)',
                            width: '15px',
                            height: '15px',
                          }}
                        />
                        <div>
                          <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--texto-principal)' }}>
                            Forzar reenvío a los {resultadoCalculo.ya_contactados_recientes} pacientes contactados recientemente (&lt; 7 días)
                          </span>
                          <span style={{ display: 'block', fontSize: '0.69rem', color: 'var(--texto-atenuado)', marginTop: '1px' }}>
                            Omite la pausa de 7 días e incluye a estos pacientes en la lista de envío de este lote.
                          </span>
                        </div>
                      </label>
                    </div>

                    {/* Disclaimer de Meta cuando se activa el forzado */}
                    {forzarReenvio && (
                      <div
                        style={{
                          padding: '0.6rem 0.75rem',
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          borderRadius: 'var(--radio-sm)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.5rem',
                          marginTop: '0.2rem',
                          animation: 'aparecerSuave 0.2s ease',
                        }}
                      >
                        <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0, marginTop: '1px' }} />
                        <div style={{ fontSize: '0.71rem', color: 'var(--texto-principal)', lineHeight: '1.4' }}>
                          <strong style={{ color: '#ef4444', display: 'block', marginBottom: '0.15rem' }}>
                            Advertencia de Políticas de Calidad de WhatsApp (Meta):
                          </strong>
                          Enviar plantillas masivas repetidas a un mismo destinatario en lapsos menores a 7 días eleva drásticamente la tasa de bloqueos y reportes de <strong>SPAM</strong>. Si los usuarios reportan tus mensajes, Meta bajará la calificación de tu número a nivel <strong style={{ color: '#ef4444' }}>Rojo (Bajo)</strong> o podrá <strong>suspender de forma temporal o permanente la línea de WhatsApp de la óptica</strong>.
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Explicación de Lote */}
                <div
                  style={{
                    padding: '0.65rem 0.85rem',
                    backgroundColor: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.08)',
                    borderRadius: 'var(--radio-sm)',
                    border: '1px solid rgba(var(--color-primario-rgb, 2, 132, 199), 0.2)',
                    fontSize: '0.78rem',
                    color: 'var(--texto-principal)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.45rem',
                  }}
                >
                  <Info size={15} style={{ color: 'var(--color-primario)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Lote #{resultadoCalculo.lote_numero} programado para hoy:</strong> Se enviarán{' '}
                    <strong style={{ color: 'var(--color-primario)' }}>{resultadoCalculo.cantidad_a_enviar_hoy} mensajes</strong>.
                    {resultadoCalculo.pendientes_elegibles > resultadoCalculo.cantidad_a_enviar_hoy && (
                      <span style={{ display: 'block', marginTop: '0.2rem', color: 'var(--texto-secundario)' }}>
                        Quedarán {resultadoCalculo.pendientes_elegibles - resultadoCalculo.cantidad_a_enviar_hoy} pacientes pendientes para el Lote #{resultadoCalculo.lote_numero + 1} mañana.
                      </span>
                    )}
                  </div>
                </div>

                {/* Control de cuota diaria */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--texto-atenuado)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <ShieldCheck size={13} style={{ color: '#10b981' }} />
                    <span>Límite diario:</span>
                  </div>
                  <strong style={{ color: 'var(--texto-principal)' }}>
                    {resultadoCalculo.limite_diario_disponible} / {limiteDiarioOptica} disponibles hoy
                  </strong>
                </div>

                {/* Previsualización del mensaje a enviar */}
                <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--borde-tarjeta)', paddingTop: '0.75rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--texto-atenuado)', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                    Mensaje que recibirá el paciente
                  </span>
                  <BurbujaWhatsApp
                    encabezadoTipo={plantillaActiva.encabezado_tipo}
                    encabezadoContenido={plantillaActiva.encabezado_contenido}
                    cuerpo={plantillaActiva.cuerpo}
                    pie={plantillaActiva.pie}
                    botones={plantillaActiva.botones}
                    hora="10:45 AM"
                    nombrePacienteSimulado={resultadoCalculo.destinatarios_lote_hoy[0]?.nombre || 'Carlos'}
                    vistaPreviaVariables={true}
                    nombreOptica={nombreOptica}
                  />
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--texto-atenuado)', fontSize: '0.8rem' }}>
                Selecciona una audiencia para calcular el tamaño del lote.
              </div>
            )}
          </div>
        </div>

        {/* Pie con botones */}
        <div
          style={{
            padding: '1rem 1.4rem',
            borderTop: '1px solid var(--borde-tarjeta)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.65rem',
            backgroundColor: 'var(--fondo-base)',
          }}
        >
          <button
            type="button"
            onClick={alCerrar}
            disabled={enviando}
            style={{
              padding: '0.55rem 1rem',
              backgroundColor: 'transparent',
              border: '1px solid var(--borde-tarjeta)',
              borderRadius: 'var(--radio-md)',
              color: 'var(--texto-principal)',
              fontSize: '0.82rem',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={manejarLanzarLote}
            disabled={!resultadoCalculo || resultadoCalculo.cantidad_a_enviar_hoy <= 0 || enviando}
            style={{
              padding: '0.55rem 1.35rem',
              backgroundColor: 'var(--color-primario, #0284c7)',
              border: 'none',
              borderRadius: 'var(--radio-md)',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: !resultadoCalculo || resultadoCalculo.cantidad_a_enviar_hoy <= 0 || enviando ? 'not-allowed' : 'pointer',
              opacity: !resultadoCalculo || resultadoCalculo.cantidad_a_enviar_hoy <= 0 || enviando ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: 'var(--sombra-sm)',
            }}
          >
            <Send size={15} />
            <span>
              {enviando
                ? 'Enviando Lote...'
                : resultadoCalculo && resultadoCalculo.cantidad_a_enviar_hoy > 0
                ? `Lanzar Lote #${resultadoCalculo.lote_numero} (${resultadoCalculo.cantidad_a_enviar_hoy} msgs)`
                : 'Lanzar Lote'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
