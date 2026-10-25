/**
 * Utilidades de Notificación Sonora para CRM Óptica
 * Convención de código: Estrictamente en español
 * Implementado con Web Audio API (cero transferencias en red, cero consumo de Vercel)
 */

let contextoAudioCompartido: AudioContext | null = null;
let ultimaReproduccionMs = 0;
const TIEMPO_MINIMO_ENTRE_SONIDOS_MS = 450;

/**
 * Obtiene o inicializa la instancia compartida de AudioContext del navegador
 */
function obtenerContextoAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  try {
    if (!contextoAudioCompartido) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        contextoAudioCompartido = new AudioCtx();
      }
    }

    if (contextoAudioCompartido && contextoAudioCompartido.state === 'suspended') {
      contextoAudioCompartido.resume().catch(() => {});
    }

    return contextoAudioCompartido;
  } catch {
    return null;
  }
}

/**
 * Desbloquea el audio al primer clic o interacción del usuario para cumplir con las políticas de autoplay
 */
if (typeof window !== 'undefined') {
  const desbloquearAlInteractuar = () => {
    const ctx = obtenerContextoAudio();
    if (ctx && ctx.state === 'running') {
      window.removeEventListener('click', desbloquearAlInteractuar);
      window.removeEventListener('keydown', desbloquearAlInteractuar);
      window.removeEventListener('touchstart', desbloquearAlInteractuar);
    }
  };

  window.addEventListener('click', desbloquearAlInteractuar, { passive: true });
  window.addEventListener('keydown', desbloquearAlInteractuar, { passive: true });
  window.addEventListener('touchstart', desbloquearAlInteractuar, { passive: true });
}

/**
 * Sonido 1: Mensaje entrante estándar tipo WhatsApp Web (doble tono armónico suave)
 * Se reproduce cuando la IA está inactiva y llega un mensaje nuevo.
 */
export function reproducirSonidoMensajeEntrante(): void {
  const ahora = Date.now();
  if (ahora - ultimaReproduccionMs < TIEMPO_MINIMO_ENTRE_SONIDOS_MS) return;
  ultimaReproduccionMs = ahora;

  const ctx = obtenerContextoAudio();
  if (!ctx) return;

  try {
    const tiempoInicio = ctx.currentTime + 0.02;

    // Nota 1: Sol 5 (784 Hz)
    const oscilador1 = ctx.createOscillator();
    const ganancia1 = ctx.createGain();
    oscilador1.type = 'sine';
    oscilador1.frequency.setValueAtTime(783.99, tiempoInicio);

    ganancia1.gain.setValueAtTime(0, tiempoInicio);
    ganancia1.gain.linearRampToValueAtTime(0.18, tiempoInicio + 0.015);
    ganancia1.gain.exponentialRampToValueAtTime(0.001, tiempoInicio + 0.08);

    oscilador1.connect(ganancia1);
    ganancia1.connect(ctx.destination);
    oscilador1.start(tiempoInicio);
    oscilador1.stop(tiempoInicio + 0.09);

    // Nota 2: Do 6 (1046.5 Hz) - Sonido característico campana WhatsApp
    const tiempoNota2 = tiempoInicio + 0.075;
    const oscilador2 = ctx.createOscillator();
    const ganancia2 = ctx.createGain();
    oscilador2.type = 'sine';
    oscilador2.frequency.setValueAtTime(1046.5, tiempoNota2);

    ganancia2.gain.setValueAtTime(0, tiempoNota2);
    ganancia2.gain.linearRampToValueAtTime(0.22, tiempoNota2 + 0.015);
    ganancia2.gain.exponentialRampToValueAtTime(0.0001, tiempoNota2 + 0.22);

    oscilador2.connect(ganancia2);
    ganancia2.connect(ctx.destination);
    oscilador2.start(tiempoNota2);
    oscilador2.stop(tiempoNota2 + 0.23);
  } catch (error) {
    console.warn('No se pudo emitir sonido de mensaje entrante:', error);
  }
}

/**
 * Sonido 2: Alerta de Asesor Humano - Doble campana de mostrador ("Ding! Ding!" metálico resonante)
 * Sonido penetrante con armónicos agudos y decaimiento prolongado para llamar la atención en la óptica.
 */
export function reproducirSonidoAlertaAsesor(): void {
  const ahora = Date.now();
  if (ahora - ultimaReproduccionMs < TIEMPO_MINIMO_ENTRE_SONIDOS_MS) return;
  ultimaReproduccionMs = ahora;

  const ctx = obtenerContextoAudio();
  if (!ctx) return;

  try {
    const tiempoInicio = ctx.currentTime + 0.02;

    const emitirCampanada = (t: number, frecuenciaBase: number, volumen: number, duracion: number) => {
      // Fundamental + Armónico agudo brillante para efecto campana metálica
      const oscBase = ctx.createOscillator();
      const oscArmonico = ctx.createOscillator();
      const ganancia = ctx.createGain();

      oscBase.type = 'sine';
      oscArmonico.type = 'triangle';

      oscBase.frequency.setValueAtTime(frecuenciaBase, t);
      oscArmonico.frequency.setValueAtTime(frecuenciaBase * 2.05, t); // Ligeramente desfasado para timbre metálico natural

      ganancia.gain.setValueAtTime(0, t);
      ganancia.gain.linearRampToValueAtTime(volumen, t + 0.008);
      ganancia.gain.exponentialRampToValueAtTime(0.0001, t + duracion);

      oscBase.connect(ganancia);
      oscArmonico.connect(ganancia);
      ganancia.connect(ctx.destination);

      oscBase.start(t);
      oscArmonico.start(t);
      oscBase.stop(t + duracion + 0.02);
      oscArmonico.stop(t + duracion + 0.02);
    };

    // Ding 1: Si 5 (987.77 Hz)
    emitirCampanada(tiempoInicio, 987.77, 0.34, 0.45);
    // Ding 2: Mi 6 (1318.51 Hz) - más agudo y resonante
    emitirCampanada(tiempoInicio + 0.22, 1318.51, 0.38, 0.75);
  } catch (error) {
    console.warn('No se pudo emitir sonido de alerta de asesor:', error);
  }
}
