'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  User,
  Mail,
  KeyRound,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';
import {
  consultarUsuarioRecuperacion,
  verificarCorreoYEnviarCodigo,
  restablecerContrasenaApi,
} from '@/servicios/api_crm';

interface PropiedadesModalRecuperarContrasena {
  abierto: boolean;
  alCerrar: () => void;
  alExito: (usuario: string) => void;
}

type PasoRecuperacion = 'usuario' | 'correo' | 'codigo' | 'exito';

export const ModalRecuperarContrasena: React.FC<PropiedadesModalRecuperarContrasena> = ({
  abierto,
  alCerrar,
  alExito,
}) => {
  const [montado, setMontado] = useState(false);
  const [paso, setPaso] = useState<PasoRecuperacion>('usuario');

  // Datos del formulario
  const [usuario, setUsuario] = useState('');
  const [nombreTitular, setNombreTitular] = useState('');
  const [correoCensurado, setCorreoCensurado] = useState('');
  const [correoIngresado, setCorreoIngresado] = useState('');
  const [codigoOtp, setCodigoOtp] = useState('');
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [confirmarContrasena, setConfirmarContrasena] = useState('');

  // Estados visuales
  const [mostrarNuevaContrasena, setMostrarNuevaContrasena] = useState(false);
  const [mostrarConfirmarContrasena, setMostrarConfirmarContrasena] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campoConError, setCampoConError] = useState<
    'usuario' | 'correo' | 'codigo' | 'contrasena' | 'confirmar' | null
  >(null);

  useEffect(() => {
    setMontado(true);
  }, []);

  // Reiniciar estado al abrir el modal
  useEffect(() => {
    if (abierto) {
      setPaso('usuario');
      setUsuario('');
      setNombreTitular('');
      setCorreoCensurado('');
      setCorreoIngresado('');
      setCodigoOtp('');
      setNuevaContrasena('');
      setConfirmarContrasena('');
      setError(null);
      setCampoConError(null);
    }
  }, [abierto]);

  if (!montado || !abierto) return null;

  // Paso 1: Consultar usuario y obtener pista de correo
  const manejarConsultarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim()) {
      setCampoConError('usuario');
      setError('Por favor ingresa tu nombre de usuario');
      return;
    }

    setCampoConError(null);
    setError(null);
    setCargando(true);
    try {
      const res = await consultarUsuarioRecuperacion(usuario.trim());
      if (res.exito && res.correo_censurado) {
        setNombreTitular(res.nombre || usuario.trim());
        setCorreoCensurado(res.correo_censurado);
        setPaso('correo');
      } else {
        setCampoConError('usuario');
        setError(res.error || 'No se encontró ninguna cuenta asociada a este usuario.');
      }
    } catch {
      setError('Error al conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  };

  // Paso 2: Verificar correo exacto y disparar envío de código por Resend
  const manejarVerificarCorreoYEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correoIngresado.trim()) {
      setCampoConError('correo');
      setError('Por favor ingresa tu dirección de correo electrónico.');
      return;
    }

    setCampoConError(null);
    setError(null);
    setCargando(true);
    try {
      const res = await verificarCorreoYEnviarCodigo(usuario.trim(), correoIngresado.trim());
      if (res.exito) {
        setPaso('codigo');
      } else {
        setCampoConError('correo');
        setError(res.error || 'El correo ingresado no coincide con el registrado.');
      }
    } catch {
      setError('Error al procesar la solicitud.');
    } finally {
      setCargando(false);
    }
  };

  // Paso 3: Validar código OTP y cambiar contraseña
  const manejarRestablecerContrasena = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoOtp.trim()) {
      setCampoConError('codigo');
      setError('Por favor ingresa el código de 6 dígitos recibido por correo.');
      return;
    }
    if (codigoOtp.trim().length !== 6) {
      setCampoConError('codigo');
      setError('El código debe contener exactamente 6 dígitos.');
      return;
    }
    if (nuevaContrasena.length < 6) {
      setCampoConError('contrasena');
      setError('La nueva contraseña debe tener mínimo 6 caracteres.');
      return;
    }
    if (nuevaContrasena !== confirmarContrasena) {
      setCampoConError('confirmar');
      setError('Las contraseñas no coinciden. Por favor verifícalas.');
      return;
    }

    setCampoConError(null);
    setError(null);
    setCargando(true);
    try {
      const res = await restablecerContrasenaApi(
        usuario.trim(),
        correoIngresado.trim(),
        codigoOtp.trim(),
        nuevaContrasena
      );
      if (res.exito) {
        setPaso('exito');
      } else {
        setError(res.error || 'No se pudo restablecer la contraseña.');
      }
    } catch {
      setError('Error de comunicación con el servidor.');
    } finally {
      setCargando(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        padding: '16px',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: 'var(--fondo-tarjeta, #ffffff)',
          color: 'var(--texto-principal, #0f172a)',
          borderRadius: '20px',
          border: '1px solid var(--borde-tarjeta, #e2e8f0)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div
          style={{
            padding: '22px 26px 18px',
            borderBottom: '1px solid var(--borde-tarjeta, #f1f5f9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
              }}
            >
              <KeyRound style={{ width: '20px', height: '20px' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
                Recuperación de Contraseña
              </h2>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
                Autogestión de Acceso Seguro
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={alCerrar}
            disabled={cargando}
            aria-label="Cerrar modal"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              borderRadius: '8px',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.06)';
              e.currentTarget.style.color = '#0f172a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        {/* Mensaje de Error General (Servidor/Red) */}
        {error && !campoConError && (
          <div
            className="login-alerta-error"
            style={{
              margin: '18px 26px 0',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}
          >
            <AlertCircle style={{ width: '18px', height: '18px', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>{error}</div>
          </div>
        )}

        {/* CUERPO - PASO 1: Ingreso de Usuario */}
        {paso === 'usuario' && (
          <form noValidate onSubmit={manejarConsultarUsuario} style={{ padding: '24px 26px' }}>
            <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              Ingresa tu <strong>nombre de usuario</strong> registrado para buscar tu cuenta y validar tu identidad mediante tu correo electrónico.
            </p>

            <div className="login-campo-grupo" style={{ marginBottom: '22px' }}>
              <label htmlFor="campo-recuperar-usuario" className="login-etiqueta">
                Nombre de Usuario
              </label>
              <div className={`login-input-caja ${campoConError === 'usuario' ? 'con-error' : ''}`}>
                <User className="login-input-icono" />
                <input
                  id="campo-recuperar-usuario"
                  type="text"
                  autoFocus
                  value={usuario}
                  onChange={(e) => {
                    setUsuario(e.target.value);
                    if (campoConError === 'usuario') setCampoConError(null);
                    if (error) setError(null);
                  }}
                  placeholder="ej. usuario"
                  disabled={cargando}
                  className="login-input-control"
                />
              </div>
              {campoConError === 'usuario' && (
                <div className="login-etiqueta-error">
                  <AlertCircle style={{ width: '13px', height: '13px', flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={alCerrar}
                disabled={cargando}
                style={{
                  padding: '10px 18px',
                  borderRadius: '11px',
                  border: '1px solid #cbd5e1',
                  background: 'transparent',
                  color: '#64748b',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={cargando}
                className="login-boton-ingresar"
                style={{
                  width: 'auto',
                  marginTop: 0,
                  padding: '10px 22px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: cargando ? 0.65 : 1,
                  cursor: cargando ? 'not-allowed' : 'pointer',
                }}
              >
                {cargando ? 'Buscando cuenta...' : 'Continuar'}
                <ArrowRight style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          </form>
        )}

        {/* CUERPO - PASO 2: Confirmación de Correo con Pista Censurada */}
        {paso === 'correo' && (
          <form noValidate onSubmit={manejarVerificarCorreoYEnviar} style={{ padding: '24px 26px' }}>
            <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              Hola <strong>{nombreTitular}</strong>. Para verificar que eres el propietario de la cuenta, confirma tu correo electrónico completo:
            </p>

            {/* Tarjeta de pista con correo censurado estilo premium */}
            <div
              style={{
                background: 'rgba(2, 132, 199, 0.08)',
                border: '1px solid rgba(2, 132, 199, 0.25)',
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <Mail style={{ width: '22px', height: '22px', color: '#0284c7', flexShrink: 0 }} />
              <div>
                <span className="login-etiqueta" style={{ color: '#0369a1', marginBottom: '2px', display: 'block' }}>
                  Pista de correo registrado
                </span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0284c7', letterSpacing: '0.4px' }}>
                  {correoCensurado}
                </span>
              </div>
            </div>

            <div className="login-campo-grupo" style={{ marginBottom: '24px' }}>
              <label htmlFor="campo-confirmar-correo" className="login-etiqueta">
                Correo Electrónico Completo
              </label>
              <div className={`login-input-caja ${campoConError === 'correo' ? 'con-error' : ''}`}>
                <Mail className="login-input-icono" />
                <input
                  id="campo-confirmar-correo"
                  type="email"
                  autoFocus
                  value={correoIngresado}
                  onChange={(e) => {
                    setCorreoIngresado(e.target.value);
                    if (campoConError === 'correo') setCampoConError(null);
                    if (error) setError(null);
                  }}
                  placeholder="ejemplo@correo.com"
                  disabled={cargando}
                  className="login-input-control"
                />
              </div>
              {campoConError === 'correo' && (
                <div className="login-etiqueta-error">
                  <AlertCircle style={{ width: '13px', height: '13px', flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setCampoConError(null);
                  setPaso('usuario');
                }}
                disabled={cargando}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 0',
                }}
              >
                <ArrowLeft style={{ width: '15px', height: '15px' }} />
                Atrás
              </button>

              <button
                type="submit"
                disabled={cargando}
                className="login-boton-ingresar"
                style={{
                  width: 'auto',
                  marginTop: 0,
                  padding: '10px 22px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: cargando ? 0.65 : 1,
                  cursor: cargando ? 'not-allowed' : 'pointer',
                }}
              >
                {cargando ? 'Verificando y enviando...' : 'Enviar Código de Seguridad'}
                <ArrowRight style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          </form>
        )}

        {/* CUERPO - PASO 3: Código OTP y Nueva Contraseña */}
        {paso === 'codigo' && (
          <form noValidate onSubmit={manejarRestablecerContrasena} style={{ padding: '24px 26px' }}>
            <p style={{ fontSize: '0.86rem', color: '#64748b', margin: '0 0 18px 0', lineHeight: 1.45 }}>
              Enviamos un código de 6 dígitos a <strong>{correoIngresado}</strong>. Ingrésalo y establece tu nueva contraseña:
            </p>

            {/* Input de código OTP con etiquetas premium */}
            <div className="login-campo-grupo" style={{ marginBottom: '18px' }}>
              <label htmlFor="campo-codigo-otp" className="login-etiqueta">
                Código de Verificación (6 dígitos)
              </label>
              <div
                className={`login-input-caja ${campoConError === 'codigo' ? 'con-error' : ''}`}
                style={campoConError !== 'codigo' ? { borderColor: '#0284c7' } : {}}
              >
                <KeyRound className="login-input-icono" style={{ color: '#0284c7' }} />
                <input
                  id="campo-codigo-otp"
                  type="text"
                  maxLength={6}
                  autoFocus
                  value={codigoOtp}
                  onChange={(e) => {
                    setCodigoOtp(e.target.value.replace(/\D/g, ''));
                    if (campoConError === 'codigo') setCampoConError(null);
                    if (error) setError(null);
                  }}
                  placeholder="000000"
                  disabled={cargando}
                  className="login-input-control"
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    letterSpacing: '6px',
                    fontFamily: 'monospace',
                  }}
                />
              </div>
              {campoConError === 'codigo' ? (
                <div className="login-etiqueta-error">
                  <AlertCircle style={{ width: '13px', height: '13px', flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              ) : (
                <span style={{ fontSize: '0.73rem', color: '#64748b', marginTop: '2px' }}>
                  Válido por 15 minutos. Revisa tu bandeja de entrada o spam.
                </span>
              )}
            </div>

            {/* Nueva Contraseña */}
            <div className="login-campo-grupo" style={{ marginBottom: '16px' }}>
              <label htmlFor="campo-nueva-pass" className="login-etiqueta">
                Nueva Contraseña
              </label>
              <div className={`login-input-caja ${campoConError === 'contrasena' ? 'con-error' : ''}`}>
                <Lock className="login-input-icono" />
                <input
                  id="campo-nueva-pass"
                  type={mostrarNuevaContrasena ? 'text' : 'password'}
                  value={nuevaContrasena}
                  onChange={(e) => {
                    setNuevaContrasena(e.target.value);
                    if (campoConError === 'contrasena') setCampoConError(null);
                    if (error) setError(null);
                  }}
                  placeholder="Mínimo 6 caracteres"
                  disabled={cargando}
                  className="login-input-control"
                />
                <button
                  type="button"
                  className="login-toggle-ojo"
                  onClick={() => setMostrarNuevaContrasena(!mostrarNuevaContrasena)}
                  tabIndex={-1}
                  title={mostrarNuevaContrasena ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {mostrarNuevaContrasena ? (
                    <EyeOff style={{ width: '17px', height: '17px' }} />
                  ) : (
                    <Eye style={{ width: '17px', height: '17px' }} />
                  )}
                </button>
              </div>
              {campoConError === 'contrasena' && (
                <div className="login-etiqueta-error">
                  <AlertCircle style={{ width: '13px', height: '13px', flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Confirmar Contraseña */}
            <div className="login-campo-grupo" style={{ marginBottom: '24px' }}>
              <label htmlFor="campo-confirmar-pass" className="login-etiqueta">
                Confirmar Nueva Contraseña
              </label>
              <div className={`login-input-caja ${campoConError === 'confirmar' ? 'con-error' : ''}`}>
                <Lock className="login-input-icono" />
                <input
                  id="campo-confirmar-pass"
                  type={mostrarConfirmarContrasena ? 'text' : 'password'}
                  value={confirmarContrasena}
                  onChange={(e) => {
                    setConfirmarContrasena(e.target.value);
                    if (campoConError === 'confirmar') setCampoConError(null);
                    if (error) setError(null);
                  }}
                  placeholder="Repite la nueva contraseña"
                  disabled={cargando}
                  className="login-input-control"
                />
                <button
                  type="button"
                  className="login-toggle-ojo"
                  onClick={() => setMostrarConfirmarContrasena(!mostrarConfirmarContrasena)}
                  tabIndex={-1}
                  title={mostrarConfirmarContrasena ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {mostrarConfirmarContrasena ? (
                    <EyeOff style={{ width: '17px', height: '17px' }} />
                  ) : (
                    <Eye style={{ width: '17px', height: '17px' }} />
                  )}
                </button>
              </div>
              {campoConError === 'confirmar' && (
                <div className="login-etiqueta-error">
                  <AlertCircle style={{ width: '13px', height: '13px', flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setCampoConError(null);
                  setPaso('correo');
                }}
                disabled={cargando}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 0',
                }}
              >
                <ArrowLeft style={{ width: '15px', height: '15px' }} />
                Atrás
              </button>

              <button
                type="submit"
                disabled={cargando}
                className="login-boton-ingresar"
                style={{
                  width: 'auto',
                  marginTop: 0,
                  padding: '10px 22px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: cargando ? 0.65 : 1,
                  cursor: cargando ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                }}
              >
                {cargando ? 'Actualizando contraseña...' : 'Guardar Nueva Contraseña'}
                <ShieldCheck style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          </form>
        )}

        {/* CUERPO - PASO 4: Éxito */}
        {paso === 'exito' && (
          <div style={{ padding: '40px 28px', textAlign: 'center' }}>
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                backgroundColor: '#ecfdf5',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                boxShadow: '0 6px 18px rgba(16, 185, 129, 0.25)',
              }}
            >
              <CheckCircle2 style={{ width: '42px', height: '42px' }} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px 0', color: '#0f172a' }}>
              ¡Contraseña restablecida con éxito!
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0 0 26px 0', lineHeight: 1.5 }}>
              Tu cuenta <strong>{usuario}</strong> ha sido actualizada de forma segura. Ahora puedes iniciar sesión con tu nueva contraseña.
            </p>

            <button
              type="button"
              onClick={() => {
                alExito(usuario);
                alCerrar();
              }}
              className="login-boton-ingresar"
              style={{
                width: '100%',
                marginTop: 0,
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <span>Iniciar Sesión Ahora</span>
              <ArrowRight style={{ width: '18px', height: '18px' }} />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
