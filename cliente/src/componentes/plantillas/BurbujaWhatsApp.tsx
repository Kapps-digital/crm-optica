'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ExternalLink,
  Phone,
  ChevronDown,
  ChevronLeft,
  MoreVertical,
  Video,
  Smile,
  Paperclip,
  Camera,
  Mic,
  CheckCheck,
  Image as IconoImagen,
  Play,
  Copy,
  ShoppingBag,
} from 'lucide-react';
import { obtenerOpticaSesion } from '@/servicios/api_crm';
import type { BotonPlantilla } from '@/tipos/crm';

interface PropiedadesBurbujaWhatsApp {
  encabezadoTipo?: 'TEXTO' | 'IMAGEN' | 'VIDEO' | 'NINGUNO';
  encabezadoContenido?: string | null;
  cuerpo: string;
  pie?: string | null;
  botones?: BotonPlantilla[];
  hora?: string;
  nombrePacienteSimulado?: string;
  vistaPreviaVariables?: boolean;
  modo?: 'celular' | 'tarjeta' | string;
  nombreOptica?: string;
}

/**
 * Componente: BurbujaWhatsApp
 * Simulador Smartphone ultra-fiel de WhatsApp para previsualización de plantillas:
 * - Dimensiones optimizadas para encajar 100% visible en pantalla de escritorio sin scroll.
 * - Chasis de smartphone realista con dynamic island, barra 9:41/5G, cabecera WhatsApp verde,
 *   fondo doodle oficial, burbuja compacta vertical, botones oficiales y barra inferior con mic.
 * - Avatar corporativo dinámico con las iniciales de la óptica activa y nombre dinámico del negocio.
 */
export const BurbujaWhatsApp: React.FC<PropiedadesBurbujaWhatsApp> = ({
  encabezadoTipo = 'NINGUNO',
  encabezadoContenido = null,
  cuerpo,
  pie = null,
  botones = [],
  hora = '11:07 a.m.',
  nombrePacienteSimulado = 'Carlos',
  vistaPreviaVariables = false,
  nombreOptica,
}) => {
  // Sincronización dinámica de nombre de óptica activa
  const [nombreNegocioLocal, setNombreNegocioLocal] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const sesion = obtenerOpticaSesion();
      if (sesion?.nombre) return sesion.nombre;
    }
    return 'Óptica';
  });

  useEffect(() => {
    const actualizarOptica = () => {
      const sesion = obtenerOpticaSesion();
      if (sesion?.nombre) {
        setNombreNegocioLocal(sesion.nombre);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', actualizarOptica);
      window.addEventListener('crm_cambio_optica', actualizarOptica);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', actualizarOptica);
        window.removeEventListener('crm_cambio_optica', actualizarOptica);
      }
    };
  }, []);

  const nombreNegocio = (nombreOptica?.trim() || nombreNegocioLocal || 'Óptica').trim();

  // Iniciales corporativas dinámicas de la óptica (ej. "Tu Visión Óptica" -> "TV")
  const inicialesNegocio = useMemo(() => {
    if (!nombreNegocio) return 'ÓP';
    const partes = nombreNegocio.split(/\s+/);
    if (partes.length >= 2) {
      return (partes[0][0] + partes[1][0]).toUpperCase();
    }
    return nombreNegocio.substring(0, 2).toUpperCase();
  }, [nombreNegocio]);

  // Reemplazar o resaltar variables {{1}}, {{2}}
  const formatearCuerpo = (texto: string) => {
    if (!texto) return '';

    if (vistaPreviaVariables) {
      return texto
        .replace(/\{\{1\}\}/g, nombrePacienteSimulado)
        .replace(/\{\{2\}\}/g, nombreNegocio)
        .replace(/\{\{3\}\}/g, 'Examen Visual');
    }

    const partes = texto.split(/(\{\{\d+\}\})/g);
    return partes.map((parte, index) => {
      if (/^\{\{\d+\}\}$/.test(parte)) {
        return (
          <span
            key={index}
            style={{
              backgroundColor: 'rgba(37, 211, 102, 0.18)',
              color: '#075e54',
              padding: '0.08rem 0.28rem',
              borderRadius: '3px',
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: '0.86em',
              border: '1px solid rgba(37, 211, 102, 0.35)',
              display: 'inline-block',
              margin: '0 1px',
            }}
          >
            {parte}
          </span>
        );
      }
      return parte;
    });
  };

  const fondoDoodleWhatsApp = "url('/imagenes/fondo-whatsapp.png')";

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        padding: '0.25rem 0',
        userSelect: 'none',
      }}
    >
      {/* Chasis exterior del Smartphone (Proporción compacta 270px x 412px sin desborde) */}
      <div
        style={{
          width: '270px',
          height: '412px',
          backgroundColor: '#0f172a',
          borderRadius: '28px',
          padding: '6px',
          boxShadow:
            '0 18px 40px -10px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.12), inset 0 0 0 1.5px rgba(255, 255, 255, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Pantalla Interna */}
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#efeae2',
            borderRadius: '23px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {/* Notch / Dynamic Island */}
          <div
            style={{
              position: 'absolute',
              top: '5px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '64px',
              height: '14px',
              backgroundColor: '#000000',
              borderRadius: '9px',
              zIndex: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: '6px',
            }}
          >
            <div
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                backgroundColor: '#0a101f',
                border: '1px solid #1e293b',
              }}
            />
          </div>

          {/* Barra de Estado del Sistema */}
          <div
            style={{
              height: '21px',
              backgroundColor: '#075e54',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 0.9rem',
              fontSize: '0.62rem',
              fontWeight: 700,
              zIndex: 10,
            }}
          >
            <span>9:41</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.58rem' }}>
              <span>5G</span>
              <span>100%</span>
            </div>
          </div>

          {/* Cabecera Oficial de Chat WhatsApp */}
          <div
            style={{
              backgroundColor: '#075e54',
              color: '#ffffff',
              padding: '0.25rem 0.45rem 0.35rem 0.35rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.35rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
              zIndex: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1, minWidth: 0 }}>
              <ChevronLeft size={16} color="#ffffff" style={{ cursor: 'pointer' }} />
              {/* Avatar Óptica con Iniciales Corporativas */}
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 800,
                  color: '#ffffff',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  flexShrink: 0,
                  letterSpacing: '0.02em',
                }}
              >
                {inicialesNegocio}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <span
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={nombreNegocio}
                  >
                    {nombreNegocio}
                  </span>
                  <span
                    style={{
                      fontSize: '0.55rem',
                      backgroundColor: '#25d366',
                      color: '#075e54',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                    }}
                  >
                    ✓
                  </span>
                </div>
                <span style={{ fontSize: '0.58rem', opacity: 0.9, display: 'block', lineHeight: 1 }}>
                  en línea
                </span>
              </div>
            </div>

            {/* Iconos de cabecera */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Video size={13} color="#ffffff" />
              <Phone size={12} color="#ffffff" />
              <MoreVertical size={13} color="#ffffff" />
            </div>
          </div>

          {/* Área de Conversación con Fondo Oficial y Scroll Interno Suave */}
          <div
            style={{
              flex: 1,
              backgroundImage: fondoDoodleWhatsApp,
              backgroundRepeat: 'repeat',
              backgroundSize: '290px auto',
              backgroundColor: '#efeae2',
              padding: '0.5rem 0.45rem',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.04)',
            }}
          >
            {/* Chip de Fecha "HOY" */}
            <div
              style={{
                alignSelf: 'center',
                backgroundColor: '#ffffff',
                color: '#54656f',
                fontSize: '0.58rem',
                fontWeight: 600,
                padding: '0.1rem 0.45rem',
                borderRadius: '6px',
                boxShadow: '0 1px 0.5px rgba(0,0,0,0.12)',
                marginBottom: '0.35rem',
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
              }}
            >
              Hoy
            </div>

            {/* Aviso de cifrado */}
            <div
              style={{
                alignSelf: 'center',
                backgroundColor: '#ffeecd',
                color: '#54656f',
                fontSize: '0.54rem',
                textAlign: 'center',
                padding: '0.15rem 0.4rem',
                borderRadius: '5px',
                boxShadow: '0 1px 0.5px rgba(0,0,0,0.06)',
                marginBottom: '0.45rem',
                maxWidth: '92%',
                lineHeight: 1.2,
              }}
            >
              🔒 Los mensajes están cifrados de extremo a extremo.
            </div>

            {/* Burbuja del mensaje (Centrada armoniosamente en la pantalla del celular) */}
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  width: '100%',
                  maxWidth: '246px',
                  backgroundColor: '#ffffff',
                  borderRadius: '9px',
                  boxShadow: '0 1px 0.5px rgba(11, 20, 26, 0.13)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                }}
              >
                {/* 1. Cabecera WhatsApp Business */}
                <div
                  style={{
                    padding: '0.35rem 0.55rem 0.25rem 0.55rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid rgba(0,0,0,0.03)',
                  }}
                >
                  <span
                    style={{
                      color: '#b02a37',
                      fontSize: '0.62rem',
                      fontWeight: 600,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    WhatsApp Business
                  </span>
                  <ChevronDown size={11} color="#667781" style={{ cursor: 'pointer' }} />
                </div>

                {/* 2. Encabezado de Imagen o Video (Proporción banner 82px) */}
                {encabezadoTipo === 'IMAGEN' && (
                  <div
                    style={{
                      width: '100%',
                      height: '82px',
                      backgroundColor: '#e2e8f0',
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {encabezadoContenido ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={encabezadoContenido}
                        src={encabezadoContenido}
                        alt="Encabezado de plantilla"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          zIndex: 2,
                          display: 'block',
                        }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : null}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 1,
                        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        gap: '0.2rem',
                        padding: '0.4rem',
                        textAlign: 'center',
                      }}
                    >
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: 'rgba(255,255,255,0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <IconoImagen size={14} color="#ffffff" />
                      </div>
                      <span style={{ fontSize: '0.64rem', fontWeight: 700 }}>Imagen de Muestra</span>
                      <span style={{ fontSize: '0.55rem', opacity: 0.9 }}>Promoción Óptica</span>
                    </div>
                  </div>
                )}

                {encabezadoTipo === 'VIDEO' && (
                  <div
                    style={{
                      width: '100%',
                      height: '82px',
                      backgroundColor: '#0f172a',
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                    }}
                  >
                    {encabezadoContenido ? (
                      <video
                        key={encabezadoContenido}
                        src={encabezadoContenido}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          opacity: 0.85,
                          zIndex: 2,
                        }}
                        muted
                        autoPlay
                        loop
                      />
                    ) : null}
                    <div
                      style={{
                        position: 'absolute',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(0, 0, 0, 0.65)',
                        border: '1.5px solid #ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                        zIndex: 3,
                      }}
                    >
                      <Play size={14} color="#ffffff" fill="#ffffff" style={{ marginLeft: '2px' }} />
                    </div>
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '5px',
                        left: '6px',
                        fontSize: '0.52rem',
                        fontWeight: 600,
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        zIndex: 3,
                      }}
                    >
                      Video
                    </span>
                  </div>
                )}

                {/* 3. Cuerpo y Contenido */}
                <div style={{ padding: '0.4rem 0.55rem 0.35rem 0.55rem' }}>
                  {/* Encabezado de Texto */}
                  {encabezadoTipo === 'TEXTO' && encabezadoContenido && (
                    <div
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        color: '#111b21',
                        lineHeight: 1.25,
                        marginBottom: '0.25rem',
                      }}
                    >
                      {encabezadoContenido}
                    </div>
                  )}

                  {/* Texto del cuerpo */}
                  <div
                    style={{
                      fontSize: '0.71rem',
                      color: '#111b21',
                      lineHeight: 1.35,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {formatearCuerpo(cuerpo)}
                  </div>

                  {/* Pie y Micro-hora */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-end',
                      marginTop: '0.35rem',
                      fontSize: '0.58rem',
                      color: '#667781',
                    }}
                  >
                    <span style={{ flex: 1, paddingRight: '0.4rem', fontStyle: pie ? 'italic' : 'normal' }}>
                      {pie || ''}
                    </span>
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: '0.58rem',
                        color: '#667781',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.15rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {hora}
                      <CheckCheck size={11} color="#53bdeb" />
                    </span>
                  </div>
                </div>

                {/* 4. Botones Oficiales al pie de la burbuja */}
                {botones && botones.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      borderTop: '1px solid #e9edef',
                    }}
                  >
                    {botones.map((btn, index) => {
                      const tipoBoton = (btn.tipo || '').toUpperCase();
                      const esUrl = tipoBoton === 'URL' || (!btn.tipo && !!btn.url);
                      const esTelefono = tipoBoton === 'PHONE_NUMBER' || (!btn.tipo && !!btn.telefono);
                      const esCodigo = tipoBoton === 'COPY_CODE' || (!btn.tipo && !!btn.codigo);
                      const esCatalogo = tipoBoton === 'CATALOG';

                      return (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.3rem',
                            height: '30px',
                            backgroundColor: '#ffffff',
                            color: '#008069',
                            fontSize: '0.71rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            borderBottom: index < botones.length - 1 ? '1px solid #e9edef' : 'none',
                            transition: 'background-color 0.15s ease',
                            padding: '0 0.4rem',
                            textAlign: 'center',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f7f8fa')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                        >
                          {esUrl ? (
                            <ExternalLink size={12} color="#008069" strokeWidth={2.2} />
                          ) : esTelefono ? (
                            <Phone size={12} color="#008069" strokeWidth={2.2} />
                          ) : esCodigo ? (
                            <Copy size={12} color="#008069" strokeWidth={2.2} />
                          ) : esCatalogo ? (
                            <ShoppingBag size={12} color="#008069" strokeWidth={2.2} />
                          ) : null}
                          <span>{btn.texto}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Barra de Entrada WhatsApp */}
          <div
            style={{
              padding: '0.28rem 0.4rem',
              backgroundColor: '#f0f2f5',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              borderTop: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <div
              style={{
                flex: 1,
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: '0.25rem 0.45rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 1px 1px rgba(0,0,0,0.06)',
              }}
            >
              <Smile size={13} color="#8696a0" />
              <span style={{ fontSize: '0.68rem', color: '#8696a0', flex: 1 }}>Mensaje</span>
              <Paperclip size={12} color="#8696a0" />
              <Camera size={12} color="#8696a0" />
            </div>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                backgroundColor: '#00a884',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                flexShrink: 0,
              }}
            >
              <Mic size={12} color="#ffffff" />
            </div>
          </div>

          {/* Home indicator bar (iOS / Android) */}
          <div
            style={{
              height: '8px',
              backgroundColor: '#f0f2f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '65px',
                height: '2.5px',
                backgroundColor: '#94a3b8',
                borderRadius: '2px',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
