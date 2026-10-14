'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Plus,
  Sparkles,
  MessageSquare,
  AlertCircle,
  Trash2,
  ShieldCheck,
  Globe,
  Upload,
  Link as IconoLink,
  CheckCircle2,
} from 'lucide-react';
import { SelectorDesplegable } from '../comunes/SelectorDesplegable';
import { BurbujaWhatsApp } from './BurbujaWhatsApp';
import type { PlantillaWhatsApp, BotonPlantilla } from '@/tipos/crm';

interface PropiedadesModalCrearPlantilla {
  abierto: boolean;
  alCerrar: () => void;
  alGuardarExitoso: (nuevaPlantilla: PlantillaWhatsApp) => void;
  nombreOptica?: string;
  opticaId?: number;
}

// Opciones de idioma con nombres limpios y profesionales en español
const OPCIONES_IDIOMA = [
  { valor: 'es', etiqueta: 'Español' },
  { valor: 'es_LA', etiqueta: 'Español (Latinoamérica)' },
  { valor: 'es_ES', etiqueta: 'Español (España)' },
  { valor: 'en_US', etiqueta: 'Inglés' },
  { valor: 'pt_BR', etiqueta: 'Portugués' },
];

// Opciones de botones oficiales limpias en español (sin iconos)
const OPCIONES_TIPOS_BOTON = [
  { valor: 'QUICK_REPLY', etiqueta: 'Respuesta rápida' },
  { valor: 'URL', etiqueta: 'Visitar sitio web' },
  { valor: 'PHONE_NUMBER', etiqueta: 'Llamar por teléfono' },
  { valor: 'COPY_CODE', etiqueta: 'Copiar código' },
  { valor: 'CATALOG', etiqueta: 'Ver catálogo' },
];

export const ModalCrearPlantilla: React.FC<PropiedadesModalCrearPlantilla> = ({
  abierto,
  alCerrar,
  alGuardarExitoso,
  nombreOptica,
  opticaId,
}) => {
  const [etiqueta, setEtiqueta] = useState('');
  const [categoria, setCategoria] = useState<'MARKETING' | 'UTILITY'>('MARKETING');
  const [idioma, setIdioma] = useState('es');

  // Tipo de encabezado: NINGUNO, TEXTO, IMAGEN o VIDEO (PDF eliminado)
  const [encabezadoTipo, setEncabezadoTipo] = useState<'NINGUNO' | 'TEXTO' | 'IMAGEN' | 'VIDEO'>('NINGUNO');

  // Estados separados para evitar que la URL se filtre en el texto del encabezado
  const [encabezadoTexto, setEncabezadoTexto] = useState('');
  const [multimediaUrl, setMultimediaUrl] = useState('');
  const [urlServidor, setUrlServidor] = useState('');
  const [multimediaModo, setMultimediaModo] = useState<'archivo' | 'url'>('archivo');
  const [nombreArchivoCargado, setNombreArchivoCargado] = useState<string | null>(null);
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);

  const [cuerpo, setCuerpo] = useState('');
  const [pie, setPie] = useState('');
  const [botones, setBotones] = useState<BotonPlantilla[]>([]);

  const [guardando, setGuardando] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);

  const refInputArchivo = useRef<HTMLInputElement>(null);

  const limpiarFormulario = () => {
    setEtiqueta('');
    setCategoria('MARKETING');
    setIdioma('es');
    setEncabezadoTipo('NINGUNO');
    setEncabezadoTexto('');
    setMultimediaUrl('');
    setUrlServidor('');
    setMultimediaModo('archivo');
    setNombreArchivoCargado(null);
    setCuerpo('');
    setPie('');
    setBotones([]);
    setErrorFormulario(null);
  };

  const manejarCerrar = () => {
    limpiarFormulario();
    alCerrar();
  };

  // Cambio de tipo de encabezado: mantiene limpios los campos sin cruzar textos
  const manejarCambioEncabezadoTipo = (nuevoTipo: 'NINGUNO' | 'TEXTO' | 'IMAGEN' | 'VIDEO') => {
    setEncabezadoTipo(nuevoTipo);
    setErrorFormulario(null);
  };

  // Carga de archivo desde el equipo
  const manejarSeleccionArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    setNombreArchivoCargado(archivo.name);
    setErrorFormulario(null);

    // Leer como DataURL directamente para previsualización inmediata 100% infalible en el celular
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setMultimediaUrl(dataUrl);

      // Persistir en servidor en segundo plano
      try {
        setSubiendoArchivo(true);
        const res = await fetch('/api/plantillas/subir-multimedia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: archivo.name,
            base64: dataUrl,
            mimeType: archivo.type,
            optica_id: opticaId,
          }),
        });
        const datos = await res.json();
        if (datos.exito && datos.url) {
          setUrlServidor(datos.url);
        }
      } catch (err) {
        console.warn('Aviso al subir multimedia al servidor:', err);
      } finally {
        setSubiendoArchivo(false);
      }
    };
    reader.readAsDataURL(archivo);
  };

  // Manejo de botones dinámicos (hasta 3)
  const agregarBoton = () => {
    if (botones.length >= 3) return;
    const nuevoBoton: BotonPlantilla = {
      tipo: 'QUICK_REPLY',
      texto: `Opción ${botones.length + 1}`,
    };
    setBotones([...botones, nuevoBoton]);
  };

  const actualizarCampoBoton = (indice: number, campo: keyof BotonPlantilla, valor: string) => {
    setBotones(
      botones.map((b, i) => {
        if (i !== indice) return b;
        const actualizado = { ...b, [campo]: valor };

        // Ajustes predeterminados según tipo seleccionado
        if (campo === 'tipo') {
          // Limpiar atributos de otros tipos para evitar interferencias
          delete actualizado.url;
          delete actualizado.telefono;
          delete actualizado.codigo;

          if (valor === 'URL') {
            actualizado.texto = 'Visitar sitio web';
            actualizado.url = 'https://tuvisionoptica.com';
          } else if (valor === 'PHONE_NUMBER') {
            actualizado.texto = 'Llamar a Óptica';
            actualizado.telefono = '+573132531694';
          } else if (valor === 'COPY_CODE') {
            actualizado.texto = 'Copiar cupón';
            actualizado.codigo = 'PROMO50';
          } else if (valor === 'CATALOG') {
            actualizado.texto = 'Ver catálogo';
          } else if (valor === 'QUICK_REPLY') {
            actualizado.texto = 'Respuesta rápida';
          }
        }
        return actualizado;
      })
    );
  };

  const eliminarBoton = (indice: number) => {
    setBotones(botones.filter((_, i) => i !== indice));
  };

  const insertarVariable = (variable: string) => {
    setCuerpo((prev) => `${prev} ${variable}`);
  };

  // Contenido de encabezado a enviar al backend
  const contenidoEncabezadoAEnviar = useMemo(() => {
    if (encabezadoTipo === 'TEXTO') return encabezadoTexto.trim() || null;
    if (encabezadoTipo === 'IMAGEN' || encabezadoTipo === 'VIDEO') {
      return (urlServidor || multimediaUrl || '').trim() || null;
    }
    return null;
  }, [encabezadoTipo, encabezadoTexto, urlServidor, multimediaUrl]);

  const formularioValido = useMemo(() => {
    if (!etiqueta.trim() || !cuerpo.trim()) return false;
    if (encabezadoTipo === 'TEXTO' && !encabezadoTexto.trim()) return false;
    for (const b of botones) {
      if (!b.texto.trim()) return false;
      if (b.tipo === 'URL' && (!b.url || !b.url.trim())) return false;
      if (b.tipo === 'PHONE_NUMBER' && (!b.telefono || !b.telefono.trim())) return false;
    }
    return true;
  }, [etiqueta, cuerpo, encabezadoTipo, encabezadoTexto, botones]);

  const manejarGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formularioValido) {
      setErrorFormulario('Por favor completa todos los campos requeridos y valida los botones.');
      return;
    }

    setGuardando(true);
    setErrorFormulario(null);

    try {
      const res = await fetch('/api/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          etiqueta: etiqueta.trim(),
          categoria,
          idioma,
          encabezado_tipo: encabezadoTipo,
          encabezado_contenido: contenidoEncabezadoAEnviar,
          cuerpo: cuerpo.trim(),
          pie: pie.trim() || null,
          botones,
        }),
      });

      const datos = await res.json();
      if (!datos.exito) {
        throw new Error(datos.error || 'Error al guardar la plantilla en el canal oficial');
      }

      alGuardarExitoso(datos.plantilla);
      manejarCerrar();
    } catch (err: any) {
      setErrorFormulario(err.message || 'Error de conexión');
    } finally {
      setGuardando(false);
    }
  };

  if (!abierto) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !guardando) manejarCerrar();
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
        padding: '1rem',
        animation: 'aparecerSuave 0.15s ease-out',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--fondo-tarjeta)',
          border: '1px solid var(--borde-tarjeta)',
          borderRadius: 'var(--radio-lg)',
          width: '100%',
          maxWidth: '960px',
          maxHeight: '92vh',
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
            padding: '0.85rem 1.3rem',
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
                backgroundColor: 'rgba(37, 211, 102, 0.12)',
                color: '#25D366',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageSquare size={19} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.02rem', fontWeight: 700, color: 'var(--texto-principal)', margin: 0 }}>
                Crear Plantilla Oficial
              </h2>
              <p style={{ fontSize: '0.74rem', color: 'var(--texto-atenuado)', margin: '0.1rem 0 0 0' }}>
                Diseña el mensaje multimedia con botones que se enviará en los lotes de WhatsApp.
              </p>
            </div>
          </div>
          <button
            onClick={manejarCerrar}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--texto-atenuado)',
              cursor: 'pointer',
              padding: '0.35rem',
              borderRadius: 'var(--radio-sm)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido dividido: Formulario a la izquierda (con scroll) | Previsualización WhatsApp a la derecha (sin scroll) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Lado izquierdo: Formulario de edición */}
          <form
            onSubmit={manejarGuardar}
            style={{
              padding: '1.1rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              overflowY: 'auto',
              minHeight: 0,
            }}
          >
            {errorFormulario && (
              <div
                style={{
                  padding: '0.55rem 0.75rem',
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
                <AlertCircle size={15} />
                <span>{errorFormulario}</span>
              </div>
            )}

            {/* Título de la plantilla */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--texto-secundario)',
                  marginBottom: '0.25rem',
                }}
              >
                Título / Etiqueta de la plantilla *
              </label>
              <input
                type="text"
                value={etiqueta}
                onChange={(e) => setEtiqueta(e.target.value)}
                placeholder="Ej: Recordatorio Control Anual de Lentes"
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'var(--fondo-base)',
                  border: '1px solid var(--borde-tarjeta)',
                  borderRadius: 'var(--radio-md)',
                  color: 'var(--texto-principal)',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            {/* Categoría e Idioma (nombres limpios sin códigos) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--texto-secundario)',
                    marginBottom: '0.25rem',
                  }}
                >
                  Categoría
                </label>
                <SelectorDesplegable
                  valor={categoria}
                  alCambiar={(val) => setCategoria(val as any)}
                  opciones={[
                    { valor: 'MARKETING', etiqueta: 'Marketing (Promociones)' },
                    { valor: 'UTILITY', etiqueta: 'Utilidad (Avisos/Citas)' },
                  ]}
                  anchoMinimo="100%"
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--texto-secundario)',
                    marginBottom: '0.25rem',
                  }}
                >
                  <Globe size={13} color="#10b981" />
                  <span>Idioma de la plantilla *</span>
                </label>
                <SelectorDesplegable
                  valor={idioma}
                  alCambiar={(val) => setIdioma(val)}
                  opciones={OPCIONES_IDIOMA}
                  anchoMinimo="100%"
                />
              </div>
            </div>

            {/* Tipo de Encabezado */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--texto-secundario)',
                  marginBottom: '0.25rem',
                }}
              >
                Tipo de Encabezado
              </label>
              <SelectorDesplegable
                valor={encabezadoTipo}
                alCambiar={(val) => manejarCambioEncabezadoTipo(val as any)}
                opciones={[
                  { valor: 'NINGUNO', etiqueta: 'Sin encabezado' },
                  { valor: 'TEXTO', etiqueta: 'Texto destacado' },
                  { valor: 'IMAGEN', etiqueta: 'Imagen' },
                  { valor: 'VIDEO', etiqueta: 'Video' },
                ]}
                anchoMinimo="100%"
              />
            </div>

            {/* Encabezado: TEXTO */}
            {encabezadoTipo === 'TEXTO' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--texto-secundario)' }}>
                    Texto del Encabezado *
                  </label>
                  <span style={{ fontSize: '0.7rem', color: 'var(--texto-atenuado)' }}>
                    {encabezadoTexto.length} / 60
                  </span>
                </div>
                <input
                  type="text"
                  value={encabezadoTexto}
                  onChange={(e) => setEncabezadoTexto(e.target.value)}
                  placeholder="Ej: ¡Hola, {{1}}! Gran Jornada de Salud Visual 👓"
                  maxLength={60}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: 'var(--fondo-base)',
                    border: '1px solid var(--borde-tarjeta)',
                    borderRadius: 'var(--radio-md)',
                    color: 'var(--texto-principal)',
                    fontSize: '0.85rem',
                  }}
                />
              </div>
            )}

            {/* Encabezado: IMAGEN o VIDEO */}
            {(encabezadoTipo === 'IMAGEN' || encabezadoTipo === 'VIDEO') && (
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  backgroundColor: 'var(--fondo-base)',
                  border: '1px solid var(--borde-tarjeta)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.55rem',
                }}
              >
                {/* Selector de modo: Cargar desde el equipo vs Enlace URL */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--texto-secundario)' }}>
                    {encabezadoTipo === 'IMAGEN' ? 'Multimedia: Imagen' : 'Multimedia: Video'}
                  </span>

                  <div
                    style={{
                      display: 'flex',
                      backgroundColor: 'var(--fondo-tarjeta)',
                      borderRadius: '6px',
                      padding: '2px',
                      border: '1px solid var(--borde-tarjeta)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setMultimediaModo('archivo')}
                      style={{
                        padding: '0.2rem 0.55rem',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        borderRadius: '4px',
                        border: 'none',
                        backgroundColor:
                          multimediaModo === 'archivo' ? 'var(--fondo-elevado)' : 'transparent',
                        color:
                          multimediaModo === 'archivo'
                            ? 'var(--texto-principal)'
                            : 'var(--texto-secundario)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <Upload size={12} />
                      <span>Cargar del equipo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMultimediaModo('url')}
                      style={{
                        padding: '0.2rem 0.55rem',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        borderRadius: '4px',
                        border: 'none',
                        backgroundColor:
                          multimediaModo === 'url' ? 'var(--fondo-elevado)' : 'transparent',
                        color:
                          multimediaModo === 'url'
                            ? 'var(--texto-principal)'
                            : 'var(--texto-secundario)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <IconoLink size={12} />
                      <span>Enlace URL</span>
                    </button>
                  </div>
                </div>

                {/* Modo 1: Carga desde el equipo */}
                {multimediaModo === 'archivo' && (
                  <div>
                    <input
                      ref={refInputArchivo}
                      type="file"
                      accept={encabezadoTipo === 'IMAGEN' ? 'image/png,image/jpeg,image/webp,image/jpg' : 'video/mp4,video/quicktime'}
                      onChange={manejarSeleccionArchivo}
                      style={{ display: 'none' }}
                    />
                    <div
                      onClick={() => refInputArchivo.current?.click()}
                      style={{
                        padding: '0.9rem',
                        border: '1px dashed var(--borde-suave)',
                        borderRadius: '6px',
                        backgroundColor: 'var(--fondo-tarjeta)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        transition: 'border-color 0.2s ease',
                      }}
                    >
                      <Upload size={18} color="#10b981" />
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--texto-principal)' }}>
                        {nombreArchivoCargado
                          ? `Archivo cargado: ${nombreArchivoCargado}`
                          : encabezadoTipo === 'IMAGEN'
                          ? 'Haz clic para seleccionar una imagen de tu equipo'
                          : 'Haz clic para seleccionar un video MP4 de tu equipo'}
                      </span>
                      <span style={{ fontSize: '0.67rem', color: 'var(--texto-atenuado)' }}>
                        {encabezadoTipo === 'IMAGEN'
                          ? 'Formatos recomendados: JPG, PNG, WEBP (hasta 5MB)'
                          : 'Formato recomendado: MP4 (hasta 16MB)'}
                      </span>
                    </div>

                    {nombreArchivoCargado && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: '0.35rem',
                          fontSize: '0.72rem',
                          color: '#10b981',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <CheckCircle2 size={13} />
                          {subiendoArchivo ? 'Guardando en servidor...' : 'Imagen visible en vista previa'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setMultimediaUrl('');
                            setUrlServidor('');
                            setNombreArchivoCargado(null);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ef4444',
                            fontSize: '0.68rem',
                            cursor: 'pointer',
                          }}
                        >
                          Quitar archivo
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Modo 2: Enlace URL */}
                {multimediaModo === 'url' && (
                  <div>
                    <input
                      type="url"
                      value={multimediaUrl}
                      onChange={(e) => {
                        setMultimediaUrl(e.target.value);
                        setUrlServidor(e.target.value);
                        setNombreArchivoCargado(null);
                      }}
                      placeholder={
                        encabezadoTipo === 'IMAGEN'
                          ? 'https://ejemplo.com/promocion-optica.jpg'
                          : 'https://ejemplo.com/video-promocion.mp4'
                      }
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.7rem',
                        backgroundColor: 'var(--fondo-tarjeta)',
                        border: '1px solid var(--borde-tarjeta)',
                        borderRadius: 'var(--radio-sm)',
                        color: 'var(--texto-principal)',
                        fontSize: '0.8rem',
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Mensaje del cuerpo */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.25rem',
                }}
              >
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--texto-secundario)' }}>
                  Mensaje del Cuerpo *
                </label>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  <button
                    type="button"
                    onClick={() => insertarVariable('{{1}}')}
                    style={{
                      padding: '0.15rem 0.45rem',
                      fontSize: '0.68rem',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#10b981',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    + {'{{1}}'} Nombre
                  </button>
                  <button
                    type="button"
                    onClick={() => insertarVariable('{{2}}')}
                    style={{
                      padding: '0.15rem 0.45rem',
                      fontSize: '0.68rem',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(2, 132, 199, 0.1)',
                      border: '1px solid rgba(2, 132, 199, 0.3)',
                      color: '#0284c7',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    + {'{{2}}'} Control / Fecha
                  </button>
                </div>
              </div>
              <textarea
                value={cuerpo}
                onChange={(e) => setCuerpo(e.target.value)}
                placeholder="Escribe el mensaje. Puedes usar {{1}} para el nombre del paciente y {{2}} para fechas o datos de la óptica..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'var(--fondo-base)',
                  border: '1px solid var(--borde-tarjeta)',
                  borderRadius: 'var(--radio-md)',
                  color: 'var(--texto-principal)',
                  fontSize: '0.85rem',
                  resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.15rem' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)' }}>
                  {cuerpo.length} / 1024 caracteres
                </span>
              </div>
            </div>

            {/* Pie de página */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--texto-secundario)' }}>
                  Pie de página (Opcional)
                </label>
                <span style={{ fontSize: '0.68rem', color: 'var(--texto-atenuado)' }}>
                  {pie.length} / 60
                </span>
              </div>
              <input
                type="text"
                value={pie}
                onChange={(e) => setPie(e.target.value)}
                placeholder={`Ej: Atención personalizada ${nombreOptica || 'en nuestra óptica'}`}
                maxLength={60}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'var(--fondo-base)',
                  border: '1px solid var(--borde-tarjeta)',
                  borderRadius: 'var(--radio-md)',
                  color: 'var(--texto-principal)',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            {/* Sección de Botones Interactivos (limpio sin iconos en desplegables ni botones de añadir) */}
            <div
              style={{
                padding: '0.75rem',
                borderRadius: '8px',
                backgroundColor: 'var(--fondo-base)',
                border: '1px solid var(--borde-tarjeta)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.55rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--texto-secundario)' }}>
                    Botones interactivos ({botones.length}/3)
                  </label>
                </div>

                {botones.length < 3 && (
                  <button
                    type="button"
                    onClick={agregarBoton}
                    style={{
                      padding: '0.25rem 0.6rem',
                      fontSize: '0.72rem',
                      borderRadius: '4px',
                      backgroundColor: 'var(--fondo-tarjeta)',
                      border: '1px solid var(--borde-tarjeta)',
                      color: 'var(--texto-principal)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontWeight: 600,
                    }}
                  >
                    <Plus size={12} color="#10b981" />
                    <span>Añadir botón</span>
                  </button>
                )}
              </div>

              {botones.length === 0 && (
                <p style={{ fontSize: '0.72rem', color: 'var(--texto-atenuado)', margin: '0.2rem 0' }}>
                  Sin botones añadidos. Puedes agregar hasta 3 botones para guiar la respuesta del paciente.
                </p>
              )}

              {/* Lista de botones configurados */}
              {botones.map((btn, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.55rem',
                    backgroundColor: 'var(--fondo-tarjeta)',
                    border: '1px solid var(--borde-tarjeta)',
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {/* Selector de Tipo oficial en español (sin iconos) */}
                    <div style={{ width: '180px' }}>
                      <SelectorDesplegable
                        valor={btn.tipo}
                        alCambiar={(val) => actualizarCampoBoton(idx, 'tipo', val)}
                        opciones={OPCIONES_TIPOS_BOTON}
                        anchoMinimo="100%"
                      />
                    </div>

                    {/* Texto del Botón */}
                    <input
                      type="text"
                      value={btn.texto}
                      onChange={(e) => actualizarCampoBoton(idx, 'texto', e.target.value)}
                      maxLength={25}
                      placeholder="Texto del botón (máx 25)"
                      style={{
                        flex: 1,
                        padding: '0.35rem 0.6rem',
                        backgroundColor: 'var(--fondo-base)',
                        border: '1px solid var(--borde-tarjeta)',
                        borderRadius: 'var(--radio-sm)',
                        color: 'var(--texto-principal)',
                        fontSize: '0.8rem',
                      }}
                    />

                    {/* Botón Eliminar */}
                    <button
                      type="button"
                      onClick={() => eliminarBoton(idx)}
                      title="Eliminar botón"
                      style={{
                        padding: '0.35rem',
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        borderRadius: '4px',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Campo si es URL */}
                  {btn.tipo === 'URL' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        type="url"
                        value={btn.url || ''}
                        onChange={(e) => actualizarCampoBoton(idx, 'url', e.target.value)}
                        placeholder="Dirección web (ej: https://tuvisionoptica.com/catalogo)"
                        style={{
                          flex: 1,
                          padding: '0.3rem 0.55rem',
                          backgroundColor: 'var(--fondo-base)',
                          border: '1px solid var(--borde-tarjeta)',
                          borderRadius: 'var(--radio-sm)',
                          color: 'var(--texto-principal)',
                          fontSize: '0.76rem',
                        }}
                      />
                    </div>
                  )}

                  {/* Campo si es Teléfono */}
                  {btn.tipo === 'PHONE_NUMBER' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        type="tel"
                        value={btn.telefono || ''}
                        onChange={(e) => actualizarCampoBoton(idx, 'telefono', e.target.value)}
                        placeholder="Número telefónico con indicativo (ej: +57 313 253 1694)"
                        style={{
                          flex: 1,
                          padding: '0.3rem 0.55rem',
                          backgroundColor: 'var(--fondo-base)',
                          border: '1px solid var(--borde-tarjeta)',
                          borderRadius: 'var(--radio-sm)',
                          color: 'var(--texto-principal)',
                          fontSize: '0.76rem',
                        }}
                      />
                    </div>
                  )}

                  {/* Campo si es Copiar Código */}
                  {btn.tipo === 'COPY_CODE' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <input
                        type="text"
                        value={btn.codigo || ''}
                        onChange={(e) => actualizarCampoBoton(idx, 'codigo', e.target.value)}
                        placeholder="Código de cupón o descuento (ej: SALUDVISUAL2026)"
                        style={{
                          flex: 1,
                          padding: '0.3rem 0.55rem',
                          backgroundColor: 'var(--fondo-base)',
                          border: '1px solid var(--borde-tarjeta)',
                          borderRadius: 'var(--radio-sm)',
                          color: 'var(--texto-principal)',
                          fontSize: '0.76rem',
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Aviso informativo corporativo sin marcas externas */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.55rem 0.8rem',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                fontSize: '0.74rem',
                color: 'var(--texto-secundario)',
              }}
            >
              <ShieldCheck size={16} color="#10b981" />
              <span>
                Esta plantilla se enviará automáticamente para su <strong>aprobación oficial</strong> con estado <em>PENDIENTE</em>.
              </span>
            </div>

            {/* Botones de acción inferior */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.65rem',
                marginTop: 'auto',
                paddingTop: '0.45rem',
              }}
            >
              <button
                type="button"
                onClick={manejarCerrar}
                disabled={guardando}
                style={{
                  padding: '0.5rem 0.95rem',
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
                type="submit"
                disabled={!formularioValido || guardando}
                style={{
                  padding: '0.5rem 1.25rem',
                  backgroundColor: '#25D366',
                  border: 'none',
                  borderRadius: 'var(--radio-md)',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: !formularioValido || guardando ? 'not-allowed' : 'pointer',
                  opacity: !formularioValido || guardando ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <Sparkles size={15} />
                <span>{guardando ? 'Guardando...' : 'Crear y Enviar a Aprobación'}</span>
              </button>
            </div>
          </form>

          {/* Lado derecho: Previsualización en el simulador de WhatsApp (Ajustada sin scrollbar) */}
          <div
            style={{
              backgroundColor: 'var(--fondo-base)',
              borderLeft: '1px solid var(--borde-tarjeta)',
              padding: '0.65rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: 'var(--texto-atenuado)',
                marginBottom: '0.35rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Vista previa oficial en WhatsApp
            </span>

            {/* Simulador */}
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              <BurbujaWhatsApp
                encabezadoTipo={encabezadoTipo}
                encabezadoContenido={multimediaUrl || (encabezadoTipo === 'TEXTO' ? encabezadoTexto : null)}
                cuerpo={
                  cuerpo.trim() ||
                  'Escribe el mensaje de la plantilla a la izquierda para ver cómo lo recibirá el paciente en su teléfono...'
                }
                pie={pie.trim() || null}
                botones={botones}
                hora="10:45 AM"
                vistaPreviaVariables={false}
                modo="celular"
                nombreOptica={nombreOptica}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
