// Utilidad de Notificaciones Push Web para Cliente Móvil / Escritorio - CRM Óptica

export const CLAVE_PUBLICA_VAPID_DEFECTO = 'BCx3K3gUN-0vW8EQuBm4cHfhQwjux-_05eW4OS8YRRVpeyVCHg2TRzbKO9dNudGJV6nKxMHHlkb77tS5IuwIUDc';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function verificarSoportePush(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function obtenerEstadoPermisoPush(): NotificationPermission | 'no_soportado' {
  if (!verificarSoportePush()) return 'no_soportado';
  return Notification.permission;
}

export async function registrarServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!verificarSoportePush()) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.error('❌ Error registrando Service Worker:', err);
    return null;
  }
}

export async function verificarSuscripcionActiva(): Promise<boolean> {
  if (!verificarSoportePush()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub !== null;
  } catch {
    return false;
  }
}

export async function suscribirDispositivoPush(opticaId: number, usuarioId?: number): Promise<{ exito: boolean; error?: string }> {
  if (!verificarSoportePush()) {
    return { exito: false, error: 'Tu navegador o dispositivo no soporta notificaciones Web Push' };
  }

  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') {
      return { exito: false, error: 'Permiso de notificaciones denegado en este navegador' };
    }

    const reg = await registrarServiceWorker();
    if (!reg) {
      return { exito: false, error: 'No se pudo iniciar el Service Worker' };
    }

    // Obtener clave pública VAPID (con fallback directo garantizado)
    let clavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
    if (!clavePublica) {
      try {
        const resClave = await fetch('/api/push/clave-publica');
        if (resClave.ok) {
          const datosClave = await resClave.json();
          clavePublica = datosClave.clavePublica || '';
        }
      } catch {
        // Fallback de red
      }
    }

    if (!clavePublica) {
      clavePublica = CLAVE_PUBLICA_VAPID_DEFECTO;
    }

    const appServerKey = urlBase64ToUint8Array(clavePublica);

    // Cancelar suscripción residual previa si existe para evitar conflictos
    let sub = await reg.pushManager.getSubscription();
    if (sub) {
      try {
        await sub.unsubscribe();
      } catch {
        // Ignorar
      }
    }

    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey as unknown as BufferSource,
    });

    const token = typeof window !== 'undefined' ? localStorage.getItem('crm_token') : null;
    const encabezados: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) encabezados['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/push/suscribir', {
      method: 'POST',
      headers: encabezados,
      body: JSON.stringify({
        optica_id: opticaId,
        usuario_id: usuarioId || null,
        suscripcion: sub.toJSON(),
      }),
    });

    const resJson = await res.json();
    if (!resJson.exito) {
      return { exito: false, error: resJson.error || 'Error guardando suscripción en el servidor' };
    }

    return { exito: true };
  } catch (error: any) {
    console.error('❌ Error suscribiendo dispositivo a Push:', error);
    return { exito: false, error: error.message || 'Error inesperado al suscribir dispositivo' };
  }
}

export async function desuscribirDispositivoPush(): Promise<boolean> {
  if (!verificarSoportePush()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();

      const token = typeof window !== 'undefined' ? localStorage.getItem('crm_token') : null;
      const encabezados: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) encabezados['Authorization'] = `Bearer ${token}`;

      await fetch('/api/push/desuscribir', {
        method: 'POST',
        headers: encabezados,
        body: JSON.stringify({ endpoint }),
      });
    }
    return true;
  } catch (e) {
    console.error('❌ Error desuscribiendo dispositivo push:', e);
    return false;
  }
}

export async function enviarPruebaPush(opticaId: number): Promise<{ exito: boolean; mensaje?: string; error?: string }> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('crm_token') : null;
    const encabezados: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) encabezados['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/push/probar', {
      method: 'POST',
      headers: encabezados,
      body: JSON.stringify({ optica_id: opticaId }),
    });

    return await res.json();
  } catch (e: any) {
    return { exito: false, error: e.message };
  }
}

