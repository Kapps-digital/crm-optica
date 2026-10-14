'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, IdCard, Phone, Mail, User, Calendar, Check, AlertCircle } from 'lucide-react';
import type { Contacto } from '@/tipos/crm';
import { registrarPaciente, actualizarContactoPaciente, type DatosRegistroPaciente } from '@/servicios/api_crm';
import { SelectorDesplegable, type OpcionDesplegable } from '../comunes/SelectorDesplegable';
import { formatearSeparadorMiles } from '@/utilidades/formato';

export { formatearSeparadorMiles };

interface PropiedadesModalRegistrarPaciente {
  abierto: boolean;
  alCerrar: () => void;
  alGuardarExitoso: (pacienteActualizado: Contacto) => void;
  contactoParaConvertir?: Contacto | null;
}

// Lista oficial y exclusiva de tipos de documento solicitados para Colombia
export const TIPOS_DOCUMENTO_COLOMBIA: OpcionDesplegable[] = [
  {
    valor: 'CC',
    etiqueta: 'Cédula de Ciudadanía',
    etiquetaCorta: 'CC',
  },
  {
    valor: 'CE',
    etiqueta: 'Cédula de Extranjería',
    etiquetaCorta: 'CE',
  },
  {
    valor: 'TI',
    etiqueta: 'Tarjeta de Identidad',
    etiquetaCorta: 'TI',
  },
  {
    valor: 'NIT',
    etiqueta: 'NIT',
    etiquetaCorta: 'NIT',
  },
];

// Opciones de sexo biológico / demográfico para pacientes y auto-segmentación
export const OPCIONES_SEXO_PACIENTE: OpcionDesplegable[] = [
  { valor: 'masculino', etiqueta: 'Masculino', etiquetaCorta: 'Masculino' },
  { valor: 'femenino', etiqueta: 'Femenino', etiquetaCorta: 'Femenino' },
];

// Lista de indicativos internacionales para el selector con buscador
export const INDICATIVOS_PAISES: OpcionDesplegable[] = [
  { valor: '+57', etiqueta: 'Colombia (+57)', etiquetaCorta: '+57', textoBusquedaExtra: 'Colombia 57 CO' },
  { valor: '+58', etiqueta: 'Venezuela (+58)', etiquetaCorta: '+58', textoBusquedaExtra: 'Venezuela 58 VE' },
  { valor: '+1', etiqueta: 'Estados Unidos / Canadá (+1)', etiquetaCorta: '+1', textoBusquedaExtra: 'Estados Unidos Canada USA US CA 1' },
  { valor: '+34', etiqueta: 'España (+34)', etiquetaCorta: '+34', textoBusquedaExtra: 'España Spain 34 ES' },
  { valor: '+52', etiqueta: 'México (+52)', etiquetaCorta: '+52', textoBusquedaExtra: 'México Mexico 52 MX' },
  { valor: '+507', etiqueta: 'Panamá (+507)', etiquetaCorta: '+507', textoBusquedaExtra: 'Panamá Panama 507 PA' },
  { valor: '+593', etiqueta: 'Ecuador (+593)', etiquetaCorta: '+593', textoBusquedaExtra: 'Ecuador 593 EC' },
  { valor: '+51', etiqueta: 'Perú (+51)', etiquetaCorta: '+51', textoBusquedaExtra: 'Perú Peru 51 PE' },
  { valor: '+56', etiqueta: 'Chile (+56)', etiquetaCorta: '+56', textoBusquedaExtra: 'Chile 56 CL' },
  { valor: '+54', etiqueta: 'Argentina (+54)', etiquetaCorta: '+54', textoBusquedaExtra: 'Argentina 54 AR' },
  { valor: '+55', etiqueta: 'Brasil (+55)', etiquetaCorta: '+55', textoBusquedaExtra: 'Brasil Brazil 55 BR' },
  { valor: '+506', etiqueta: 'Costa Rica (+506)', etiquetaCorta: '+506', textoBusquedaExtra: 'Costa Rica 506 CR' },
  { valor: '+502', etiqueta: 'Guatemala (+502)', etiquetaCorta: '+502', textoBusquedaExtra: 'Guatemala 502 GT' },
  { valor: '+504', etiqueta: 'Honduras (+504)', etiquetaCorta: '+504', textoBusquedaExtra: 'Honduras 504 HN' },
  { valor: '+503', etiqueta: 'El Salvador (+503)', etiquetaCorta: '+503', textoBusquedaExtra: 'El Salvador 503 SV' },
  { valor: '+505', etiqueta: 'Nicaragua (+505)', etiquetaCorta: '+505', textoBusquedaExtra: 'Nicaragua 505 NI' },
  { valor: '+591', etiqueta: 'Bolivia (+591)', etiquetaCorta: '+591', textoBusquedaExtra: 'Bolivia 591 BO' },
  { valor: '+595', etiqueta: 'Paraguay (+595)', etiquetaCorta: '+595', textoBusquedaExtra: 'Paraguay 595 PY' },
  { valor: '+598', etiqueta: 'Uruguay (+598)', etiquetaCorta: '+598', textoBusquedaExtra: 'Uruguay 598 UY' },
  { valor: '+1809', etiqueta: 'República Dominicana (+1809)', etiquetaCorta: '+1809', textoBusquedaExtra: 'República Dominicana Dominica DO 1809' },
  { valor: '+39', etiqueta: 'Italia (+39)', etiquetaCorta: '+39', textoBusquedaExtra: 'Italia Italy 39 IT' },
  { valor: '+33', etiqueta: 'Francia (+33)', etiquetaCorta: '+33', textoBusquedaExtra: 'Francia France 33 FR' },
  { valor: '+44', etiqueta: 'Reino Unido (+44)', etiquetaCorta: '+44', textoBusquedaExtra: 'Reino Unido UK England 44 GB' },
  { valor: '+49', etiqueta: 'Alemania (+49)', etiquetaCorta: '+49', textoBusquedaExtra: 'Alemania Germany 49 DE' },
];

// Validación sintáctica de correo electrónico: usuario@dominio.extension (.com, .co, etc.)
export function esCorreoValido(correo: string): boolean {
  const c = correo.trim();
  if (!c) return true; // Es opcional si está vacío
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(c);
}

// Formateador tipo Capitalize: primera letra en mayúscula y resto en minúscula por cada palabra
export function capitalizarNombre(texto: string): string {
  if (!texto) return '';
  return texto
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((palabra) => (palabra.length > 0 ? palabra.charAt(0).toUpperCase() + palabra.slice(1) : ''))
    .join(' ');
}

// Formateador visual para el número de celular local
export function formatearCelularEnCelda(digitos: string, ind: string = '+57'): string {
  const d = digitos.replace(/\D/g, '');
  if (!d) return '';
  if (ind === '+57') {
    const limitados = d.slice(0, 10);
    if (limitados.length <= 3) return `(${limitados}`;
    if (limitados.length <= 6) return `(${limitados.slice(0, 3)}) ${limitados.slice(3)}`;
    return `(${limitados.slice(0, 3)}) ${limitados.slice(3, 6)}-${limitados.slice(6, 10)}`;
  }
  // Formato para otros países con espacios de lectura
  if (d.length <= 4) return d;
  if (d.length <= 8) return `${d.slice(0, 4)} ${d.slice(4)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7, 12)}`;
}

export const ModalRegistrarPaciente: React.FC<PropiedadesModalRegistrarPaciente> = ({
  abierto,
  alCerrar,
  alGuardarExitoso,
  contactoParaConvertir = null,
}) => {
  const [montado, setMontado] = useState(false);
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('CC');
  const [documento, setDocumento] = useState('');
  const [indicativo, setIndicativo] = useState('+57');
  const [celular, setCelular] = useState('');
  const [correo, setCorreo] = useState('');
  const [edad, setEdad] = useState<string>('');
  const [sexo, setSexo] = useState<'masculino' | 'femenino' | ''>('');
  const [guardando, setGuardando] = useState(false);
  const [mensajeError, setMensajeError] = useState<string | null>(null);

  useEffect(() => {
    setMontado(true);
  }, []);

  // Pre-llenar datos si viene de un contacto existente de WhatsApp
  useEffect(() => {
    if (abierto) {
      setMensajeError(null);
      if (contactoParaConvertir) {
        const nom = (contactoParaConvertir.nombre_completo || contactoParaConvertir.nombre || '').trim();
        setNombreCompleto(nom);

        // Validar si el tipo de documento previo existe en la lista oficial
        const tipoPrevio = (contactoParaConvertir.tipo_documento || 'CC').toUpperCase();
        const tipoValido = TIPOS_DOCUMENTO_COLOMBIA.some((t) => t.valor === tipoPrevio) ? tipoPrevio : 'CC';
        setTipoDocumento(tipoValido);

        setDocumento((contactoParaConvertir.cedula || contactoParaConvertir.documento || '').replace(/\D/g, ''));

        // Extraer indicativo y celular local si viene con prefijo internacional
        const telCrudo = (contactoParaConvertir.telefono || '').replace(/\D/g, '');
        let indDetectado = '+57';
        let celDetectado = telCrudo;

        if (telCrudo) {
          for (const item of INDICATIVOS_PAISES) {
            const cod = String(item.valor).replace(/\D/g, '');
            if (telCrudo.startsWith(cod) && telCrudo.length > cod.length) {
              indDetectado = String(item.valor);
              celDetectado = telCrudo.slice(cod.length);
              break;
            }
          }
        }
        setIndicativo(indDetectado);
        setCelular(celDetectado);

        setCorreo((contactoParaConvertir.correo || '').trim());
        setEdad(contactoParaConvertir.edad ? String(contactoParaConvertir.edad).replace(/\D/g, '') : '');
        const sexoPrev = (contactoParaConvertir.sexo || '').toLowerCase();
        setSexo(sexoPrev === 'femenino' ? 'femenino' : sexoPrev === 'masculino' ? 'masculino' : '');
      } else {
        setNombreCompleto('');
        setTipoDocumento('CC');
        setDocumento('');
        setIndicativo('+57');
        setCelular('');
        setCorreo('');
        setEdad('');
        setSexo('');
      }
    }
  }, [abierto, contactoParaConvertir]);

  // Cerrar al pulsar Escape
  useEffect(() => {
    if (!abierto) return;
    const manejarEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !guardando) alCerrar();
    };
    document.addEventListener('keydown', manejarEscape);
    return () => document.removeEventListener('keydown', manejarEscape);
  }, [abierto, guardando, alCerrar]);

  // Validación de estructura de correo electrónico
  const correoInvalido = correo.trim().length > 0 && !esCorreoValido(correo);

  // Validación en tiempo real para habilitar/deshabilitar botón de guardado
  const formularioValido = useMemo(() => {
    const nombreLimpio = nombreCompleto.trim();
    if (nombreLimpio.length < 3) return false;

    const docLimpio = documento.replace(/\D/g, '');
    if (docLimpio.length < 4) return false;

    const celDigitos = celular.replace(/\D/g, '');
    if (indicativo === '+57') {
      if (celDigitos.length !== 10) return false;
    } else {
      if (celDigitos.length < 7) return false;
    }

    // Sexo es obligatorio y no debe quedar en blanco
    if (!sexo) return false;

    if (correo.trim().length > 0 && !esCorreoValido(correo)) return false;

    if (edad.trim().length > 0) {
      const eNum = Number(edad.replace(/\D/g, ''));
      if (isNaN(eNum) || eNum <= 0 || eNum > 125) return false;
    }

    return true;
  }, [nombreCompleto, documento, celular, indicativo, sexo, correo, edad]);

  if (!montado || !abierto) return null;

  const esConversion = Boolean(contactoParaConvertir);

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError(null);

    if (!formularioValido) {
      setMensajeError('Por favor completa todos los campos obligatorios antes de continuar.');
      return;
    }

    // 1. Limpieza y capitalización estricta del nombre (primera mayúscula por palabra)
    const nombreCompletoLimpio = capitalizarNombre(nombreCompleto);

    // 2. Documento: dígitos puros sin puntos ni espacios
    const documentoLimpio = documento.trim().replace(/\D/g, '');

    // 3. Celular: dígitos unidos al indicativo seleccionado
    const celularLimpio = celular.trim().replace(/\D/g, '');
    const telefonoFinal = celularLimpio ? `${indicativo}${celularLimpio}` : undefined;

    // 4. Correo: sin espacios al inicio ni al final
    const correoLimpio = correo.trim().toLowerCase();

    // 5. Edad: solo dígitos y sin espacios
    const edadTexto = edad.trim().replace(/\D/g, '');
    const edadNum = edadTexto ? Number(edadTexto) : undefined;

    setGuardando(true);
    try {
      const datos: DatosRegistroPaciente = {
        nombre: nombreCompletoLimpio,
        nombre_completo: nombreCompletoLimpio,
        tipo_documento: tipoDocumento,
        cedula: documentoLimpio,
        documento: documentoLimpio,
        telefono: telefonoFinal,
        correo: correoLimpio || undefined,
        edad: edadNum,
        sexo: sexo || undefined,
        es_paciente: true,
      };

      if (esConversion && contactoParaConvertir) {
        // Promover contacto existente a paciente
        const respuesta = await actualizarContactoPaciente(contactoParaConvertir.id, datos);
        if (respuesta.exito && respuesta.contacto) {
          alGuardarExitoso(respuesta.contacto);
          alCerrar();
        } else {
          setMensajeError(respuesta.error || 'No se pudo completar el registro del paciente.');
        }
      } else {
        // Crear nuevo paciente desde cero
        const respuesta = await registrarPaciente(datos);
        if (respuesta.exito && respuesta.contacto) {
          alGuardarExitoso(respuesta.contacto);
          alCerrar();
        } else {
          setMensajeError(respuesta.error || 'No se pudo crear el paciente.');
        }
      }
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'Error inesperado';
      setMensajeError(mensaje);
    } finally {
      setGuardando(false);
    }
  };

  return createPortal(
    <div
      className="modal-backdrop-premium"
      onClick={(e) => {
        if (e.target === e.currentTarget && !guardando) alCerrar();
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
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
          maxWidth: '520px',
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
            padding: '1.2rem 1.5rem',
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
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)',
                color: 'var(--color-primario)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserPlus size={20} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: 'var(--texto-principal)',
                  fontFamily: 'var(--fuente-titulos)',
                }}
              >
                {esConversion ? 'Registrar como Paciente' : 'Nuevo Paciente'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--texto-atenuado)' }}>
                {esConversion
                  ? 'Completa los datos de identidad para el historial y facturación.'
                  : 'Ingresa los datos personales del paciente para el registro.'}
              </p>
            </div>
          </div>

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
        </div>

        {/* Formulario */}
        <form noValidate onSubmit={manejarEnvio} style={{ padding: '1.4rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {mensajeError && (
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
              <span>{mensajeError}</span>
            </div>
          )}

          {/* 1. Campo Nombre Completo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--texto-principal)' }}>
              Nombre Completo <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <User size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-atenuado)' }} />
              <input
                type="text"
                required
                placeholder="Ej. Juan Camilo Morales Vargas"
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
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

          {/* 2. Fila Tipo de Documento Premium y Número de Documento con Separador de Miles */}
          <div style={{ display: 'grid', gridTemplateColumns: '95px 1fr', gap: '0.75rem', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--texto-principal)' }}>
                Tipo Doc. <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <SelectorDesplegable
                valor={tipoDocumento}
                alCambiar={(nuevo) => setTipoDocumento(nuevo)}
                opciones={TIPOS_DOCUMENTO_COLOMBIA}
                anchoMinimo="100%"
                tamano="compacto"
                estiloBoton={{
                  height: '36px',
                  borderRadius: 'var(--radio-sm, 6px)',
                  padding: '0 0.55rem',
                  fontWeight: 700,
                  fontSize: '0.80rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--texto-principal)' }}>
                Documento <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <IdCard size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-atenuado)' }} />
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="Ej. 1.045.678.901"
                  value={formatearSeparadorMiles(documento)}
                  onChange={(e) => setDocumento(e.target.value.replace(/\D/g, ''))}
                  style={{
                    width: '100%',
                    height: '36px',
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

          {/* 3. Fila Celular con Indicativo Desplegable con Buscador y Edad */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 0.75fr', gap: '0.75rem', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--texto-principal)' }}>
                Celular / WhatsApp <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                {/* Selector Desplegable Premium con Buscador para Indicativo */}
                <div style={{ width: '80px', flexShrink: 0 }}>
                  <SelectorDesplegable
                    valor={indicativo}
                    alCambiar={(nuevo) => setIndicativo(nuevo)}
                    opciones={INDICATIVOS_PAISES}
                    conBuscador={true}
                    placeholderBuscador="Buscar país o código..."
                    anchoMinimo="100%"
                    tamano="compacto"
                    estiloBoton={{
                      height: '36px',
                      borderRadius: 'var(--radio-sm, 6px)',
                      padding: '0 0.45rem',
                      fontWeight: 700,
                      fontSize: '0.80rem',
                    }}
                  />
                </div>

                {/* Input Celular Formateado con Placeholder Genérico */}
                <div style={{ position: 'relative', flex: 1 }}>
                  <Phone size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-atenuado)' }} />
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder={indicativo === '+57' ? '(300) 123-4567' : 'Número celular'}
                    value={formatearCelularEnCelda(celular, indicativo)}
                    onChange={(e) => {
                      const maxDigitos = indicativo === '+57' ? 10 : 15;
                      setCelular(e.target.value.replace(/\D/g, '').slice(0, maxDigitos));
                    }}
                    style={{
                      width: '100%',
                      height: '36px',
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
              {esConversion && contactoParaConvertir?.telefono && (
                <span style={{ fontSize: '0.66rem', color: 'var(--color-primario)' }}>
                  ✓ Número sincronizado desde el chat.
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--texto-principal)' }}>
                Edad (Años)
              </label>
              <div style={{ position: 'relative' }}>
                <Calendar size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-atenuado)' }} />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  placeholder="Ej. 28"
                  value={edad}
                  onChange={(e) => setEdad(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  style={{
                    width: '100%',
                    height: '36px',
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

          {/* 4. Fila Sexo y Correo Electrónico */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.75rem', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--texto-principal)' }}>
                Sexo <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <SelectorDesplegable
                valor={sexo}
                alCambiar={(nuevo) => setSexo(nuevo as 'masculino' | 'femenino')}
                opciones={OPCIONES_SEXO_PACIENTE}
                placeholder="Seleccionar..."
                anchoMinimo="100%"
                tamano="compacto"
                estiloBoton={{
                  height: '36px',
                  borderRadius: 'var(--radio-sm, 6px)',
                  padding: '0 0.55rem',
                  fontWeight: 600,
                  fontSize: '0.80rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--texto-principal)' }}>
                Correo Electrónico
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '0.65rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: correoInvalido ? '#ef4444' : 'var(--texto-atenuado)',
                    transition: 'color 0.2s',
                  }}
                />
                <input
                  type="email"
                  placeholder="paciente@correo.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  style={{
                    width: '100%',
                    height: '36px',
                    padding: '0 0.65rem 0 2rem',
                    borderRadius: 'var(--radio-sm, 6px)',
                    border: correoInvalido ? '1px solid #ef4444' : '1px solid var(--borde-tarjeta)',
                    background: correoInvalido ? 'rgba(239, 68, 68, 0.05)' : 'var(--fondo-elevado)',
                    color: 'var(--texto-principal)',
                    fontSize: '0.80rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s, background-color 0.2s',
                  }}
                />
              </div>
              {correoInvalido && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    color: '#ef4444',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    marginTop: '0.15rem',
                    fontWeight: 500,
                  }}
                >
                  <AlertCircle size={12} />
                  Formato incorrecto. Ejemplo: nombre@dominio.com o .co
                </span>
              )}
            </div>
          </div>

          {/* Botones de Acción */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.65rem',
              marginTop: '0.8rem',
              paddingTop: '0.8rem',
              borderTop: '1px solid var(--borde-tarjeta)',
            }}
          >
            <button
              type="button"
              onClick={alCerrar}
              disabled={guardando}
              style={{
                height: '34px',
                padding: '0 1rem',
                borderRadius: 'var(--radio-sm, 6px)',
                border: '1px solid var(--borde-tarjeta)',
                background: 'transparent',
                color: 'var(--texto-secundario)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!formularioValido || guardando}
              title={!formularioValido ? 'Completa los campos obligatorios para continuar' : undefined}
              style={{
                height: '34px',
                padding: '0 1.25rem',
                borderRadius: 'var(--radio-sm, 6px)',
                border: 'none',
                background: !formularioValido
                  ? 'var(--fondo-deshabilitado, rgba(148, 163, 184, 0.25))'
                  : 'var(--color-primario)',
                color: !formularioValido ? 'var(--texto-deshabilitado, #94a3b8)' : '#ffffff',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: !formularioValido || guardando ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: !formularioValido ? 'none' : '0 2px 6px rgba(2, 132, 199, 0.3)',
                opacity: !formularioValido ? 0.6 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              <Check size={15} />
              <span>{guardando ? 'Guardando...' : esConversion ? 'Guardar como Paciente' : 'Crear Paciente'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
