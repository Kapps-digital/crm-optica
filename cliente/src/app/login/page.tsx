'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Sparkles, Building2, Sun, Moon, MessageCircle, X } from 'lucide-react';
import { iniciarSesion, restaurarTemaPorDefecto } from '@/servicios/api_crm';
import { ModalRecuperarContrasena } from '@/componentes/auth/ModalRecuperarContrasena';
import { EtiquetaTooltip } from '@/componentes/comunes/EtiquetaTooltip';

export default function PaginaLogin() {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codigoError, setCodigoError] = useState<string | null>(null);
  const [temaOscuro, setTemaOscuro] = useState(false);
  const [modalRecuperarAbierto, setModalRecuperarAbierto] = useState(false);

  // Modo Oculto / Accesos Rápidos (Oculto por defecto, se activa con 3 clics en el logo del ojo)
  const [mostrarAccesosRapidos, setMostrarAccesosRapidos] = useState(false);
  const contadorClicsLogo = useRef(0);
  const temporizadorClics = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const parametroDev = urlParams.get('dev') === '1' || urlParams.get('admin') === '1';
      const guardadoEnStorage = localStorage.getItem('crm_modo_desarrollador') === '1';

      if (parametroDev || guardadoEnStorage) {
        setMostrarAccesosRapidos(true);
      }
    }
  }, []);

  const manejarClicLogo = () => {
    contadorClicsLogo.current += 1;
    if (temporizadorClics.current) {
      clearTimeout(temporizadorClics.current);
    }

    if (contadorClicsLogo.current >= 3) {
      setMostrarAccesosRapidos((prev) => {
        const nuevoEstado = !prev;
        if (typeof window !== 'undefined') {
          if (nuevoEstado) {
            localStorage.setItem('crm_modo_desarrollador', '1');
          } else {
            localStorage.removeItem('crm_modo_desarrollador');
          }
        }
        return nuevoEstado;
      });
      contadorClicsLogo.current = 0;
    } else {
      temporizadorClics.current = setTimeout(() => {
        contadorClicsLogo.current = 0;
      }, 1200);
    }
  };

  useEffect(() => {
    // Garantizar que ninguna variable CSS residual de una óptica contamine el login
    restaurarTemaPorDefecto();

    // Sincronizar preferencia de tema
    const guardado = typeof window !== 'undefined' ? localStorage.getItem('crm_tema') : null;
    const esOscuro = guardado === 'oscuro' || document.documentElement.getAttribute('data-tema') === 'oscuro';
    setTemaOscuro(esOscuro);
    document.documentElement.setAttribute('data-tema', esOscuro ? 'oscuro' : 'claro');
  }, []);

  const alternarTema = () => {
    const nuevo = !temaOscuro;
    setTemaOscuro(nuevo);
    document.documentElement.setAttribute('data-tema', nuevo ? 'oscuro' : 'claro');
    if (typeof window !== 'undefined') {
      localStorage.setItem('crm_tema', nuevo ? 'oscuro' : 'claro');
    }
  };

  // Desvanecer o retirar alerta automáticamente a los 10 segundos
  useEffect(() => {
    if (!error) return;
    const temporizador = setTimeout(() => {
      setError(null);
      setCodigoError(null);
    }, 10000);

    return () => clearTimeout(temporizador);
  }, [error]);

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !contrasena) {
      setError('Por favor ingresa usuario y contraseña');
      return;
    }

    setError(null);
    setCodigoError(null);
    setCargando(true);

    try {
      const res = await iniciarSesion(usuario.trim(), contrasena);
      if (res.exito) {
        // Redireccionar al panel principal
        window.location.replace('/');
      } else {
        setError(res.error || 'Usuario o contraseña incorrectos');
        setCodigoError(res.codigo || null);
      }
    } catch {
      setError('Error de comunicación con el servidor');
      setCodigoError(null);
    } finally {
      setCargando(false);
    }
  };

  const usarCredencialRapida = (usr: string, pass: string) => {
    setUsuario(usr);
    setContrasena(pass);
    const inputUsr = document.getElementById('campo-usuario') as HTMLInputElement | null;
    const inputPass = document.getElementById('campo-contrasena') as HTMLInputElement | null;
    if (inputUsr) inputUsr.value = usr;
    if (inputPass) inputPass.value = pass;
    setError(null);
    setCodigoError(null);
  };

  return (
    <main className="login-pantalla-fondo">
      {/* Botón flotante para alternar Tema Claro / Oscuro (Solo Icono) */}
      <button
        type="button"
        onClick={alternarTema}
        className="login-boton-tema"
        title={temaOscuro ? 'Cambiar a modo Claro' : 'Cambiar a modo Oscuro'}
        aria-label={temaOscuro ? 'Cambiar a modo Claro' : 'Cambiar a modo Oscuro'}
      >
        {temaOscuro ? (
          <Sun style={{ width: '20px', height: '20px' }} />
        ) : (
          <Moon style={{ width: '20px', height: '20px' }} />
        )}
      </button>

      {/* Círculos decorativos de fondo con desenfoque */}
      <div className="login-decoracion-circulo circulo-1" />
      <div className="login-decoracion-circulo circulo-2" />

      <div className="login-tarjeta-contenedor">
        {/* Cabecera de la Tarjeta con Isotipo Neutro SaaS (3 clics activan accesos rápidos) */}
        <div className="login-tarjeta-cabecera">
          <div
            className="login-logo-circulo-saas"
            onClick={manejarClicLogo}
            style={{ cursor: 'pointer', userSelect: 'none', touchAction: 'manipulation' }}
            title="CRM Ópticas (3 toques para accesos rápidos)"
          >
            <Eye className="login-logo-icono-saas" />
          </div>

          <h1 className="login-titulo">CRM Ópticas</h1>
          <p className="login-subtitulo">
            Portal Unificado de Gestión Clínica & Mensajería Omnicanal
          </p>
        </div>

        {/* Alerta de Error */}
        {error && (() => {
          const esSuscripcionVencida =
            codigoError === 'SUSCRIPCION_VENCIDA' ||
            (error && (error.toLowerCase().includes('suspendido') || error.toLowerCase().includes('venció')));

          return (
            <div
              className="login-alerta-error"
              role="alert"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: esSuscripcionVencida ? '0.65rem' : '0',
                padding: '0.65rem 0.85rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                  <span className="login-alerta-icono" style={{ marginTop: '1px' }}>⚠️</span>
                  <span style={{ flex: 1, lineHeight: 1.4 }}>{error}</span>
                </div>
                <EtiquetaTooltip texto="Cerrar notificación" posicion="arriba">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setCodigoError(null);
                    }}
                    aria-label="Cerrar notificación"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: '3px',
                      borderRadius: '6px',
                      color: 'inherit',
                      opacity: 0.7,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                      marginTop: '1px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.16)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0.7';
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <X size={15} />
                  </button>
                </EtiquetaTooltip>
              </div>

              {esSuscripcionVencida && (
                <a
                  href="https://wa.me/573117415122?text=Hola%2C%20me%20comunico%20para%20reportar%20el%20pago%20de%20la%20mensualidad%20o%20solicitar%20las%20cuentas%20para%20reactivar%20el%20CRM."
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Contactar a soporte vía WhatsApp (+57 311 7415122)"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    padding: '0.42rem 0.75rem',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    marginLeft: '1.6rem',
                    width: 'fit-content',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                    transition: 'all 0.15s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.35)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.25)';
                  }}
                >
                  <MessageCircle size={14} />
                  <span>Contactar a Soporte (+57 311 7415122)</span>
                </a>
              )}
            </div>
          );
        })()}

        {/* Formulario de Login */}
        <form onSubmit={manejarEnvio} className="login-formulario">
          {/* Campo Usuario */}
          <div className="login-campo-grupo">
            <label htmlFor="campo-usuario" className="login-etiqueta">
              Usuario
            </label>
            <div className="login-input-caja">
              <User className="login-input-icono" />
              <input
                id="campo-usuario"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="ej. usuario"
                className="login-input-control"
                disabled={cargando}
              />
            </div>
          </div>

          {/* Campo Contraseña */}
          <div className="login-campo-grupo">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label htmlFor="campo-contrasena" className="login-etiqueta" style={{ marginBottom: 0 }}>
                Contraseña
              </label>
              <button
                type="button"
                onClick={() => setModalRecuperarAbierto(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primario, #0284c7)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >
                ¿Olvidó su contraseña?
              </button>
            </div>
            <div className="login-input-caja">
              <Lock className="login-input-icono" />
              <input
                id="campo-contrasena"
                type={mostrarContrasena ? 'text' : 'password'}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                placeholder="••••••••••••"
                className="login-input-control"
                disabled={cargando}
              />
              <button
                type="button"
                className="login-toggle-ojo"
                onClick={() => setMostrarContrasena(!mostrarContrasena)}
                tabIndex={-1}
                title={mostrarContrasena ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {mostrarContrasena ? (
                  <EyeOff style={{ width: '18px', height: '18px' }} />
                ) : (
                  <Eye style={{ width: '18px', height: '18px' }} />
                )}
              </button>
            </div>
          </div>

          {/* Botón de Envío */}
          <button
            type="submit"
            className="login-boton-ingresar"
            disabled={cargando}
          >
            {cargando ? (
              <span className="login-cargando-fila">
                <span className="login-spinner" />
                <span>Validando acceso...</span>
              </span>
            ) : (
              <span className="login-cargando-fila">
                <span>Ingresar al Sistema</span>
                <ArrowRight style={{ width: '18px', height: '18px' }} />
              </span>
            )}
          </button>
        </form>

        {/* Acceso rápido para desarrollo / evaluación (Oculto por defecto, visible tras 3 toques en el logo) */}
        {mostrarAccesosRapidos && (
          <div className="login-credenciales-rapidas">
            <div className="login-credenciales-titulo" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles style={{ width: '13px', height: '13px', color: '#0284c7' }} />
                <span>Accesos rápidos (Modo Dev):</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMostrarAccesosRapidos(false);
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem('crm_modo_desarrollador');
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  color: 'inherit',
                  opacity: 0.6,
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Ocultar accesos rápidos"
              >
                <X style={{ width: '13px', height: '13px' }} />
              </button>
            </div>
            <div className="login-pildoras-fila">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  usarCredencialRapida('admin', 'admin123');
                }}
                className="login-pildora-btn"
                style={{ touchAction: 'manipulation' }}
                title="Llenar credenciales de Superadmin"
              >
                <strong>admin</strong> (Superadmin)
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  usarCredencialRapida('samir', 'samand1904220122');
                }}
                className="login-pildora-btn"
                style={{ touchAction: 'manipulation' }}
                title="Llenar credenciales de Tu Visión"
              >
                <strong>samir</strong> (Tu Visión)
              </button>
            </div>
          </div>
        )}

        {/* Pie de seguridad */}
        <div className="login-pie-seguridad">
          <ShieldCheck style={{ width: '15px', height: '15px', color: '#10b981' }} />
          <span>Aislamiento y protección segura de datos por sede</span>
        </div>
      </div>

      {/* Modal interactivo de autogestión de recuperación de contraseña */}
      <ModalRecuperarContrasena
        abierto={modalRecuperarAbierto}
        alCerrar={() => setModalRecuperarAbierto(false)}
        alExito={(usrRecuperado) => {
          setUsuario(usrRecuperado);
          setContrasena('');
          setError(null);
        }}
      />
    </main>
  );
}
