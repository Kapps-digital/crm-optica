'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Sparkles, Building2, Sun, Moon } from 'lucide-react';
import { iniciarSesion, restaurarTemaPorDefecto } from '@/servicios/api_crm';
import { ModalRecuperarContrasena } from '@/componentes/auth/ModalRecuperarContrasena';

export default function PaginaLogin() {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [temaOscuro, setTemaOscuro] = useState(false);
  const [modalRecuperarAbierto, setModalRecuperarAbierto] = useState(false);

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

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !contrasena) {
      setError('Por favor ingresa usuario y contraseña');
      return;
    }

    setError(null);
    setCargando(true);

    try {
      const res = await iniciarSesion(usuario.trim(), contrasena);
      if (res.exito) {
        // Redireccionar al panel principal
        router.push('/');
        router.refresh();
      } else {
        setError(res.error || 'Usuario o contraseña incorrectos');
      }
    } catch {
      setError('Error de comunicación con el servidor');
    } finally {
      setCargando(false);
    }
  };

  const usarCredencialRapida = (usr: string, pass: string) => {
    setUsuario(usr);
    setContrasena(pass);
    setError(null);
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
        {/* Cabecera de la Tarjeta con Isotipo Neutro SaaS */}
        <div className="login-tarjeta-cabecera">
          <div className="login-logo-circulo-saas">
            <Eye className="login-logo-icono-saas" />
          </div>

          <h1 className="login-titulo">CRM Ópticas</h1>
          <p className="login-subtitulo">
            Portal Unificado de Gestión Clínica & Mensajería Omnicanal
          </p>
        </div>

        {/* Alerta de Error */}
        {error && (
          <div className="login-alerta-error" role="alert">
            <span className="login-alerta-icono">⚠️</span>
            <span>{error}</span>
          </div>
        )}

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

        {/* Acceso rápido para desarrollo / evaluación */}
        <div className="login-credenciales-rapidas">
          <div className="login-credenciales-titulo">
            <Sparkles style={{ width: '13px', height: '13px', color: '#0284c7' }} />
            <span>Accesos según rol & óptica:</span>
          </div>
          <div className="login-pildoras-fila">
            <button
              type="button"
              onClick={() => usarCredencialRapida('admin', 'admin123')}
              className="login-pildora-btn"
            >
              <strong>admin</strong> (Superadmin)
            </button>
            <button
              type="button"
              onClick={() => usarCredencialRapida('samir', 'samand1904220122')}
              className="login-pildora-btn"
            >
              <strong>samir</strong> (Tu Visión)
            </button>
            <button
              type="button"
              onClick={() => usarCredencialRapida('lumina', 'lumina123')}
              className="login-pildora-btn"
            >
              <strong>lumina</strong> (Óptica Lumina)
            </button>
          </div>
        </div>

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
