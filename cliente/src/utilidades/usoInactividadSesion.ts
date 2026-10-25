'use client';

import { useEffect, useRef } from 'react';
import { verificarSesionExpirada, registrarActividadUsuario } from '@/servicios/api_crm';

/**
 * Hook para monitorear inactividad del usuario en la plataforma.
 * Si el usuario no realiza ninguna interacción en la ventana de tiempo configurada
 * (definida en src/constantes/sesion.ts), la sesión se cerrará de forma automática.
 */
export function useInactividadSesion(activo: boolean = true) {
  const ultimaEscrituraRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!activo || typeof window === 'undefined') return;

    // 1. Verificación inmediata al montar
    if (verificarSesionExpirada()) return;

    // 2. Manejador de eventos de interacción (con aceleración / throttle de 30 segundos)
    const manejarInteraccion = () => {
      const ahora = Date.now();
      // Solo escribir en localStorage como máximo una vez cada 30 segundos para cero impacto en rendimiento
      if (ahora - ultimaEscrituraRef.current > 30000) {
        ultimaEscrituraRef.current = ahora;
        registrarActividadUsuario();
      }
    };

    const eventos = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    eventos.forEach((evento) => {
      window.addEventListener(evento, manejarInteraccion, { passive: true });
    });

    // 3. Verificación periódica cada 30 segundos mientras la página está abierta
    const intervalo = setInterval(() => {
      verificarSesionExpirada();
    }, 30000);

    // 4. Verificación inmediata al reenfocar la ventana o cambiar de pestaña
    const manejarVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        verificarSesionExpirada();
      }
    };

    const manejarFoco = () => {
      verificarSesionExpirada();
    };

    document.addEventListener('visibilitychange', manejarVisibilidad);
    window.addEventListener('focus', manejarFoco);

    return () => {
      eventos.forEach((evento) => {
        window.removeEventListener(evento, manejarInteraccion);
      });
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', manejarVisibilidad);
      window.removeEventListener('focus', manejarFoco);
    };
  }, [activo]);
}

// Alias en español para cumplir con las directrices del proyecto
export const usoInactividadSesion = useInactividadSesion;
