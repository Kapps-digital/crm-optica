'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  UserX,
  Copy,
  Check,
  Download,
  Search,
  RefreshCw,
  AlertTriangle,
  FileSpreadsheet,
  Phone,
  UserCheck,
  Info,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { obtenerDestinatariosFallidosCampanaApi, type DestinatarioFallidoCampana } from '@/servicios/api_crm';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';

interface PropiedadesModalDestinatariosFallidos {
  abierto: boolean;
  campanaId: number | null;
  nombreCampana?: string;
  totalFallidosReportados?: number;
  opticaId?: number;
  alCerrar: () => void;
}

/**
 * Traduce códigos y motivos técnicos de Meta/WhatsApp al español corporativo.
 */
function traducirMotivoMeta(error?: string | null, errorCode?: number | null): string {
  const errStr = (error || '').toLowerCase();

  // 1. Límite de ecosistema publicitario / mensajes comerciales por usuario de Meta
  if (
    errStr.includes('ecosystem') ||
    errStr.includes('healthy') ||
    errStr.includes('per-user') ||
    errStr.includes('marketing limit') ||
    errStr.includes('declined to deliver this marketing')
  ) {
    return 'Límite publicitario por usuario (Protección contra saturación de Meta)';
  }

  // 2. Errores conocidos por código numérico de Meta
  if (errorCode === 131026 || errStr.includes('undeliverable') || errStr.includes('could not deliver')) {
    return 'Mensaje no entregable (Límite comercial o número no disponible)';
  }
  if (errorCode === 130472 || errStr.includes('experiment')) {
    return 'Número en grupo de control / experimento publicitario de Meta';
  }
  if (errorCode === 131042 || errStr.includes('payment') || errStr.includes('pago')) {
    return 'Problema con método de pago en WhatsApp Business';
  }
  if (errorCode === 132000 || errStr.includes('parameter') || errStr.includes('mismatch')) {
    return 'Incompatibilidad de parámetros o variables en plantilla';
  }
  if (errorCode === 131056 || errStr.includes('pairing rate') || errStr.includes('too many messages')) {
    return 'Límite de frecuencia de envío excedido';
  }
  if (errorCode === 131047 || errStr.includes('24 hour') || errStr.includes('re-engagement') || errStr.includes('window')) {
    return 'Ventana de conversación de 24 horas cerrada';
  }
  if (errorCode === 130429 || errStr.includes('rate limit')) {
    return 'Límite de volumen de mensajes alcanzado en Meta';
  }
  if (errStr.includes('opted out') || errStr.includes('opt out')) {
    return 'El destinatario desactivó mensajes comerciales';
  }
  if (errStr.includes('not on whatsapp') || errStr.includes('not a valid') || errStr.includes('invalid number')) {
    return 'Número no registrado en WhatsApp o inválido';
  }
  if (errStr.includes('spam') || errStr.includes('policy') || errStr.includes('blocked')) {
    return 'Envío restringido por políticas de mensajería de Meta';
  }

  // 3. Fallback: cualquier texto en inglés de no entrega traducirlo al español
  if (
    errStr.includes('not delivered') ||
    errStr.includes('message was not') ||
    errStr.includes('failed to send') ||
    errStr.includes('delivery failed')
  ) {
    return 'Entrega no completada por restricciones de Meta';
  }

  return error || 'Mensaje no entregado por Meta';
}

/**
 * Traduce y formaliza la explicación extendida de Meta al español.
 */
function traducirExplicacionMeta(explanation?: string | null, error?: string | null, errorCode?: number | null): string {
  const expStr = (explanation || '').toLowerCase();
  const errStr = (error || '').toLowerCase();

  // 1. Límite de ecosistema publicitario Meta
  if (
    expStr.includes('ecosystem') ||
    expStr.includes('per-user') ||
    expStr.includes('marketing limit') ||
    expStr.includes('wait at least 24 hours') ||
    errStr.includes('ecosystem') ||
    errStr.includes('healthy')
  ) {
    return 'Meta declinó entregar este mensaje publicitario debido a los límites de marketing por usuario (frecuencia basada en cuántos mensajes comerciales recibe e interactúa el destinatario). Espera al menos 24 horas antes de reintentar. Las plantillas de utilidad o servicio no se ven afectadas.';
  }

  // 2. Mensajes no entregables
  if (
    errorCode === 131026 ||
    expStr.includes('could not deliver') ||
    expStr.includes('turned off marketing') ||
    errStr.includes('undeliverable')
  ) {
    return 'WhatsApp no pudo entregar el mensaje. Es muy probable que el destinatario haya desactivado los mensajes publicitarios, que Meta limite la publicidad comercial hacia este número, o que el teléfono no esté activo en WhatsApp. Las plantillas de utilidad no se ven afectadas.';
  }

  // 3. Grupo de experimento
  if (errorCode === 130472 || expStr.includes('experiment') || errStr.includes('experiment')) {
    return 'El número del destinatario forma parte de un grupo de control o experimento temporal de Meta para evaluar la recepción de anuncios en WhatsApp. La plataforma restringió la entrega de este mensaje publicitario.';
  }

  // 4. Pago
  if (errorCode === 131042 || expStr.includes('payment') || errStr.includes('payment') || expStr.includes('pago')) {
    return 'Meta rechazó el envío debido a un problema con el método de pago registrado en Meta Business Suite. Debes asociar o verificar tu tarjeta en la sección de Cuentas de WhatsApp -> Pagos.';
  }

  // 5. Parámetros
  if (errorCode === 132000 || expStr.includes('parameter') || errStr.includes('parameter') || expStr.includes('mismatch')) {
    return 'El número o formato de las variables enviadas no coincide con los parámetros definidos y aprobados en la plantilla oficial de Meta.';
  }

  // 6. Ventana 24h
  if (errorCode === 131047 || expStr.includes('24 hour') || expStr.includes('re-engagement') || errStr.includes('24 hour')) {
    return 'Han transcurrido más de 24 horas desde la última interacción del contacto. Para comunicarte debes usar una plantilla oficial preaprobada.';
  }

  // 7. Límite de tasa
  if (errorCode === 131056 || errorCode === 130429 || expStr.includes('rate limit') || expStr.includes('too many')) {
    return 'Se alcanzó el límite de envíos simultáneos permitido por Meta. Espera unos momentos antes de reintentar.';
  }

  // 8. Si la explicación contiene inglés, nunca devolver inglés crudo
  if (
    expStr.includes('meta declined') ||
    expStr.includes('this message was') ||
    expStr.includes('whatsapp could not') ||
    expStr.includes('because of')
  ) {
    return 'Meta no pudo concretar la entrega de este mensaje comercial al destinatario según sus reglas de frecuencia y calidad de mensajería empresarial.';
  }

  return explanation || traducirMotivoMeta(error, errorCode);
}

/**
 * Formatea fecha y hora en formato compacto vertical hispanoamericano (Colombia).
 */
function formatearFechaCompacta(fechaIso?: string | null) {
  if (!fechaIso) return { fecha: '—', hora: '' };
  try {
    const f = new Date(fechaIso);
    const fecha = f.toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const hora = f.toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return { fecha, hora };
  } catch {
    return { fecha: '—', hora: '' };
  }
}

export const ModalDestinatariosFallidos: React.FC<PropiedadesModalDestinatariosFallidos> = ({
  abierto,
  campanaId,
  nombreCampana = 'Campaña',
  totalFallidosReportados = 0,
  opticaId,
  alCerrar,
}) => {
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [fallidos, setFallidos] = useState<DestinatarioFallidoCampana[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [copiadoTelefonos, setCopiadoTelefonos] = useState(false);
  const [copiadoExcel, setCopiadoExcel] = useState(false);
  const [campanaDetalle, setCampanaDetalle] = useState<any>(null);

  useEffect(() => {
    if (!abierto || !campanaId) {
      setFallidos([]);
      setCampanaDetalle(null);
      setErrorCarga(null);
      setBusqueda('');
      return;
    }

    let cancelado = false;
    const cargarFallidos = async () => {
      setCargando(true);
      setErrorCarga(null);
      try {
        const res = await obtenerDestinatariosFallidosCampanaApi(campanaId, opticaId);
        if (cancelado) return;
        if (res.exito) {
          setFallidos(res.fallidos || []);
          setCampanaDetalle(res.campana || null);
        } else {
          setErrorCarga(res.error || 'No fue posible obtener los destinatarios fallidos.');
        }
      } catch (err: any) {
        if (!cancelado) {
          setErrorCarga(err.message || 'Error de red al consultar fallidos.');
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    };

    cargarFallidos();

    return () => {
      cancelado = true;
    };
  }, [abierto, campanaId, opticaId]);

  const fallidosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return fallidos;
    const q = busqueda.toLowerCase().trim();
    return fallidos.filter((f) => {
      const tel = (f.telefono || '').toLowerCase();
      const nom = (f.nombre || '').toLowerCase();
      const errTraducido = traducirMotivoMeta(f.error, f.errorCode).toLowerCase();
      const errOriginal = (f.error || '').toLowerCase();
      return tel.includes(q) || nom.includes(q) || errTraducido.includes(q) || errOriginal.includes(q);
    });
  }, [fallidos, busqueda]);

  const copiarTelefonosAlPortapapeles = async () => {
    if (fallidosFiltrados.length === 0) return;
    const lista = fallidosFiltrados.map((f) => f.telefono).filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(lista);
      setCopiadoTelefonos(true);
      setTimeout(() => setCopiadoTelefonos(false), 2200);
    } catch (err) {
      console.warn('Error al copiar teléfonos:', err);
    }
  };

  const copiarParaExcel = async () => {
    if (fallidosFiltrados.length === 0) return;
    const encabezados = ['Fecha', 'Destinatario', 'Teléfono', 'Tipo', 'Motivo Rechazo', 'Explicación Oficial Meta'];
    const filas = fallidosFiltrados.map((f) => {
      const { fecha, hora } = formatearFechaCompacta(f.sentAt);
      return [
        f.sentAt ? `${fecha} ${hora}` : '',
        f.nombre || 'Contacto',
        f.telefono || '',
        f.es_paciente ? 'Paciente Registrado' : 'Contacto',
        traducirMotivoMeta(f.error, f.errorCode),
        traducirExplicacionMeta(f.errorExplanation, f.error, f.errorCode).replace(/[\t\n\r]/g, ' '),
      ];
    });

    const textoTSV = [
      encabezados.join('\t'),
      ...filas.map((fila) => fila.join('\t')),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(textoTSV);
      setCopiadoExcel(true);
      setTimeout(() => setCopiadoExcel(false), 2200);
    } catch (err) {
      console.warn('Error al copiar para Excel:', err);
    }
  };

  const descargarExcel = () => {
    if (fallidosFiltrados.length === 0) return;
    const filasParaXlsx = fallidosFiltrados.map((f) => {
      const { fecha, hora } = formatearFechaCompacta(f.sentAt);
      return {
        Fecha: f.sentAt ? `${fecha} ${hora}` : '',
        Destinatario: f.nombre || 'Contacto',
        Teléfono: f.telefono || '',
        Tipo: f.es_paciente ? 'Paciente' : 'Contacto',
        'Motivo Rechazo': traducirMotivoMeta(f.error, f.errorCode),
        'Explicación Oficial Meta': traducirExplicacionMeta(f.errorExplanation, f.error, f.errorCode),
      };
    });

    const hoja = XLSX.utils.json_to_sheet(filasParaXlsx);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Destinatarios Fallidos');

    const nombreArchivo = `fallidos_${(campanaDetalle?.nombre_campana || nombreCampana || 'lote').replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
    XLSX.writeFile(libro, nombreArchivo);
  };

  if (!abierto) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '90vh',
          background: 'var(--fondo-tarjeta, #ffffff)',
          color: 'var(--texto-principal, #0f172a)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--borde-suave, #e2e8f0)',
        }}
      >
        {/* Encabezado */}
        <div
          style={{
            padding: '1.1rem 1.5rem',
            borderBottom: '1px solid var(--borde-suave, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <UserX size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                  Destinatarios con Fallo de Entrega
                </h3>
                <span
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '999px',
                    padding: '0.15rem 0.6rem',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                  }}
                >
                  {cargando ? '...' : `${fallidos.length} números`}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--texto-secundario, #64748b)' }}>
                {campanaDetalle?.nombre_campana || nombreCampana}
              </p>
            </div>
          </div>

          <EtiquetaTooltip texto="Cerrar ventana" posicion="izquierda">
            <button
              onClick={alCerrar}
              aria-label="Cerrar modal"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--texto-secundario, #64748b)',
                cursor: 'pointer',
                padding: '0.4rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} />
            </button>
          </EtiquetaTooltip>
        </div>

        {/* Barra de Acciones y Filtros */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            background: 'rgba(0, 0, 0, 0.02)',
            borderBottom: '1px solid var(--borde-suave, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          {/* Buscador */}
          <div
            style={{
              position: 'relative',
              flex: '1 1 240px',
              maxWidth: '360px',
            }}
          >
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--texto-secundario, #64748b)',
              }}
            />
            <input
              type="text"
              placeholder="Buscar por teléfono, nombre o motivo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                fontSize: '0.82rem',
                borderRadius: '8px',
                border: '1px solid var(--borde-suave, #e2e8f0)',
                background: 'var(--fondo-tarjeta, #ffffff)',
                color: 'var(--texto-principal, #0f172a)',
                outline: 'none',
              }}
            />
          </div>

          {/* Botones de Exportación / Copia con Etiquetas Tooltip Premium */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <EtiquetaTooltip
              texto="Copiar lista de números de teléfono al portapapeles para pegar en un nuevo lote"
              posicion="arriba"
            >
              <button
                onClick={copiarTelefonosAlPortapapeles}
                disabled={cargando || fallidosFiltrados.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--borde-suave, #e2e8f0)',
                  background: copiadoTelefonos ? 'rgba(16, 185, 129, 0.12)' : 'var(--fondo-tarjeta, #ffffff)',
                  color: copiadoTelefonos ? '#10b981' : 'var(--texto-principal, #0f172a)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: fallidosFiltrados.length === 0 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {copiadoTelefonos ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                <span>{copiadoTelefonos ? '¡Números Copiados!' : 'Copiar Teléfonos'}</span>
              </button>
            </EtiquetaTooltip>

            <EtiquetaTooltip
              texto="Copiar tabla completa en formato compatible para pegar directamente en Excel (Ctrl + V)"
              posicion="arriba"
            >
              <button
                onClick={copiarParaExcel}
                disabled={cargando || fallidosFiltrados.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid var(--borde-suave, #e2e8f0)',
                  background: copiadoExcel ? 'rgba(16, 185, 129, 0.12)' : 'var(--fondo-tarjeta, #ffffff)',
                  color: copiadoExcel ? '#10b981' : 'var(--texto-principal, #0f172a)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: fallidosFiltrados.length === 0 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {copiadoExcel ? <Check size={14} color="#10b981" /> : <FileSpreadsheet size={14} />}
                <span>{copiadoExcel ? '¡Copiado para Excel!' : 'Copiar Tabla'}</span>
              </button>
            </EtiquetaTooltip>

            <EtiquetaTooltip
              texto="Descargar archivo Excel oficial (.xlsx) con los datos y motivos de rechazo en español"
              posicion="arriba"
            >
              <button
                onClick={descargarExcel}
                disabled={cargando || fallidosFiltrados.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--color-primario, #0284c7)',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: fallidosFiltrados.length === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 6px rgba(var(--color-primario-rgb, 2, 132, 199), 0.25)',
                }}
              >
                <Download size={14} />
                <span>Descargar Excel (.xlsx)</span>
              </button>
            </EtiquetaTooltip>
          </div>
        </div>

        {/* Nota informativa sobre exclusión */}
        <div
          style={{
            padding: '0.65rem 1.5rem',
            background: 'rgba(59, 130, 246, 0.08)',
            borderBottom: '1px solid rgba(59, 130, 246, 0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.76rem',
            color: '#1e40af',
          }}
        >
          <Info size={14} style={{ flexShrink: 0 }} />
          <span>
            <strong>Reintentos permitidos:</strong> Los números fallidos <strong>no se excluyen</strong> del cálculo inteligente de audiencia. Puedes volver a enviarles la plantilla cuando desees.
          </span>
        </div>

        {/* Cuerpo / Tabla */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
          {cargando ? (
            <div
              style={{
                padding: '4rem 2rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                color: 'var(--texto-secundario, #64748b)',
              }}
            >
              <RefreshCw size={26} className="animate-spin" color="var(--color-primario, #0284c7)" />
              <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                Consultando registros de auditoría de WhatsApp y Meta...
              </span>
            </div>
          ) : errorCarga ? (
            <div
              style={{
                padding: '3rem 2rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
                color: '#ef4444',
                textAlign: 'center',
              }}
            >
              <AlertTriangle size={32} />
              <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600 }}>{errorCarga}</p>
            </div>
          ) : fallidosFiltrados.length === 0 ? (
            <div
              style={{
                padding: '4rem 2rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                color: 'var(--texto-secundario, #64748b)',
                textAlign: 'center',
              }}
            >
              <UserCheck size={36} color="#10b981" />
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--texto-principal, #0f172a)' }}>
                {busqueda ? 'No hay resultados para la búsqueda' : 'No hay destinatarios fallidos'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.8rem', maxWidth: '380px' }}>
                {busqueda
                  ? 'Intenta con otro término de búsqueda o limpia el filtro.'
                  : 'Todos los mensajes de este lote fueron entregados o no reportaron rechazos.'}
              </p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
              <thead>
                <tr
                  style={{
                    background: 'rgba(0, 0, 0, 0.02)',
                    borderBottom: '1px solid var(--borde-suave, #e2e8f0)',
                    color: 'var(--texto-secundario, #64748b)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    fontSize: '0.70rem',
                    letterSpacing: '0.04em',
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <th style={{ padding: '0.75rem 1rem', width: '130px' }}>Fecha</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Destinatario</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Teléfono</th>
                  <th style={{ padding: '0.75rem 1.25rem' }}>Motivo de Rechazo (Meta)</th>
                </tr>
              </thead>
              <tbody>
                {fallidosFiltrados.map((item, idx) => {
                  const { fecha, hora } = formatearFechaCompacta(item.sentAt);
                  const motivoTraducido = traducirMotivoMeta(item.error, item.errorCode);
                  const explicacionTraducida = traducirExplicacionMeta(item.errorExplanation, item.error, item.errorCode);

                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid var(--borde-suave, #e2e8f0)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* 1. Fecha compacta de primero */}
                      <td style={{ padding: '0.7rem 1rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                          <span style={{ fontWeight: 600, color: 'var(--texto-principal, #0f172a)', fontSize: '0.78rem' }}>
                            {fecha}
                          </span>
                          <span style={{ fontSize: '0.70rem', color: 'var(--texto-secundario, #64748b)' }}>
                            {hora}
                          </span>
                        </div>
                      </td>

                      {/* 2. Destinatario */}
                      <td style={{ padding: '0.7rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--texto-principal, #0f172a)' }}>
                            {item.nombre || 'Contacto'}
                          </span>
                          {item.es_paciente && (
                            <span
                              style={{
                                background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)',
                                color: 'var(--color-primario, #0284c7)',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '0.1rem 0.45rem',
                                borderRadius: '4px',
                              }}
                            >
                              Paciente
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. Teléfono */}
                      <td style={{ padding: '0.7rem 1rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--texto-secundario, #64748b)', fontFamily: 'monospace' }}>
                          <Phone size={13} />
                          <span>{item.telefono}</span>
                        </div>
                      </td>

                      {/* 4. Motivo de rechazo en español con tooltip explicativo */}
                      <td style={{ padding: '0.7rem 1.25rem' }}>
                        <EtiquetaTooltip texto={explicacionTraducida} posicion="arriba">
                          <span
                            style={{
                              display: 'inline-block',
                              maxWidth: '380px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: '#ef4444',
                              fontWeight: 600,
                              cursor: 'help',
                            }}
                          >
                            {motivoTraducido}
                          </span>
                        </EtiquetaTooltip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pie del modal */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            borderTop: '1px solid var(--borde-suave, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            background: 'rgba(0, 0, 0, 0.02)',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: 'var(--texto-secundario, #64748b)' }}>
            Mostrando <strong>{fallidosFiltrados.length}</strong> de <strong>{fallidos.length}</strong> fallidos
          </span>

          <EtiquetaTooltip texto="Cerrar lista de fallidos" posicion="arriba">
            <button
              onClick={alCerrar}
              style={{
                padding: '0.45rem 1.1rem',
                borderRadius: '8px',
                border: '1px solid var(--borde-suave, #e2e8f0)',
                background: 'var(--fondo-tarjeta, #ffffff)',
                color: 'var(--texto-principal, #0f172a)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </EtiquetaTooltip>
        </div>
      </div>
    </div>
  );
};
