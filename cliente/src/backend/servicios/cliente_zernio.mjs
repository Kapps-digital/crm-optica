/**
 * Cliente HTTP resiliente para la API unificada de Zernio.
 * Cumple con las directrices de no lanzar excepciones y gestionar reintentos
 * inteligentes con backoff exponencial.
 */
const URL_BASE_PREDETERMINADA = 'https://zernio.com/api/v1';

export class ClienteZernio {
  /**
   * @param {Object} [opciones]
   * @param {string} [opciones.clave_api] - Clave de autenticación API de Zernio
   * @param {string} [opciones.url_base] - URL base del servicio
   * @param {number} [opciones.maximo_reintentos=3] - Intentos máximos en fallos transitorios
   */
  constructor({ clave_api, url_base, maximo_reintentos = 3 } = {}) {
    this.clave_api = clave_api || process.env.ZERNIO_API_KEY || '';
    this.url_base = (url_base || process.env.ZERNIO_API_BASE || URL_BASE_PREDETERMINADA).replace(/\/$/, '');
    this.maximo_reintentos = maximo_reintentos;
  }

  /**
   * Ejecuta una petición HTTP a Zernio devolviendo siempre un resultado discriminado.
   *
   * @param {string} ruta - Ruta del endpoint (ejemplo: '/accounts' o '/inbox/conversations')
   * @param {Object} [configuracion]
   * @param {string} [configuracion.metodo='GET'] - Método HTTP (GET, POST, PUT, DELETE)
   * @param {Object} [configuracion.cuerpo] - Cuerpo JSON de la petición
   * @param {Object} [configuracion.cabeceras] - Cabeceras HTTP adicionales
   * @param {string} [configuracion.clave_idempotencia] - Clave para evitar duplicados en 24h
   * @param {boolean} [configuracion.sin_reintentos=false] - Si es verdadero, no realiza reintentos automáticos
   * @returns {Promise<{ exito: boolean, datos?: any, error?: { estado: number, codigo: string, mensaje: string, reintentar_en?: number | null } }>}
   */
  async solicitar(ruta, { metodo = 'GET', cuerpo, cabeceras = {}, clave_idempotencia, sin_reintentos = false } = {}) {
    if (!this.clave_api) {
      return {
        exito: false,
        error: {
          estado: 401,
          codigo: 'CLAVE_API_FALTANTE',
          mensaje: 'No se encontró la variable ZERNIO_API_KEY configurada.',
          reintentar_en: null,
        },
      };
    }

    const url_completa = `${this.url_base}${ruta.startsWith('/') ? ruta : `/${ruta}`}`;
    const limite_intentos = sin_reintentos ? 1 : this.maximo_reintentos;
    let intento_actual = 0;

    const cabeceras_peticion = {
      'Authorization': `Bearer ${this.clave_api}`,
      'Content-Type': 'application/json',
      ...cabeceras,
    };

    if (clave_idempotencia) {
      cabeceras_peticion['Idempotency-Key'] = clave_idempotencia;
    }

    while (intento_actual < limite_intentos) {
      intento_actual++;

      try {
        const senal_cancelacion = AbortSignal.timeout(15000);
        const respuesta = await fetch(url_completa, {
          method: metodo,
          headers: cabeceras_peticion,
          body: cuerpo ? JSON.stringify(cuerpo) : undefined,
          signal: senal_cancelacion,
        });

        // 1. Respuesta exitosa (2xx)
        if (respuesta.ok) {
          const datos = await respuesta.json().catch(() => ({}));
          return { exito: true, datos };
        }

        // 2. Respuesta con error HTTP
        const estado = respuesta.status;
        const texto_crudo = await respuesta.text().catch(() => '');
        let mensaje = texto_crudo;
        let codigo = `HTTP_${estado}`;

        try {
          const json_error = JSON.parse(texto_crudo);
          mensaje = json_error.message || json_error.error || texto_crudo;
          codigo = json_error.code || codigo;
        } catch {
          // Si no es JSON válido, se conserva el texto crudo
        }

        const reintentar_en = this._obtener_segundos_reintento(respuesta.headers.get('Retry-After'));

        // Regla: Reintentar SOLO en 429, 502, 503, 504. NUNCA en 4xx de validación.
        const es_reintentable = [429, 502, 503, 504].includes(estado);

        if (es_reintentable && intento_actual < limite_intentos) {
          const espera_ms = reintentar_en ? reintentar_en * 1000 : this._calcular_espera_con_jitter(intento_actual);
          await this._pausar(espera_ms);
          continue;
        }

        return {
          exito: false,
          error: {
            estado,
            codigo,
            mensaje,
            reintentar_en,
          },
        };
      } catch (error) {
        const es_timeout = error.name === 'TimeoutError' || error.name === 'AbortError';
        const es_error_red = error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.name === 'TypeError';
        const puede_reintentar = (es_timeout || es_error_red) && intento_actual < limite_intentos;

        if (puede_reintentar) {
          const espera_ms = this._calcular_espera_con_jitter(intento_actual);
          await this._pausar(espera_ms);
          continue;
        }

        return {
          exito: false,
          error: {
            estado: es_timeout ? 408 : 0,
            codigo: es_timeout ? 'TIEMPO_AGOTADO' : 'ERROR_RED',
            mensaje: error.message || 'Error de red o comunicación al contactar Zernio.',
            reintentar_en: null,
          },
        };
      }
    }

    return {
      exito: false,
      error: {
        estado: 504,
        codigo: 'REINTENTOS_AGOTADOS',
        mensaje: 'Se agotó la cantidad máxima de reintentos con Zernio sin obtener respuesta satisfactoria.',
        reintentar_en: null,
      },
    };
  }

  // Métodos auxiliares de conveniencia
  async obtener_cuentas() {
    return this.solicitar('/accounts');
  }

  async obtener_perfiles() {
    return this.solicitar('/profiles');
  }

  async obtener_url_autorizacion(plataforma, { url_redireccion, modo_onboarding = 'business_app', metodo_inicio, id_perfil } = {}) {
    let perfil_efectivo = id_perfil || this.id_perfil;
    if (!perfil_efectivo) {
      const resPerfiles = await this.obtener_perfiles();
      if (resPerfiles.exito && resPerfiles.datos?.profiles?.[0]) {
        perfil_efectivo = resPerfiles.datos.profiles[0]._id || resPerfiles.datos.profiles[0].id;
      }
    }

    let ruta = `/connect/${plataforma}`;
    const parametros = new URLSearchParams();

    if (perfil_efectivo) parametros.append('profileId', perfil_efectivo);
    if (url_redireccion) parametros.append('redirect_url', url_redireccion);
    if (modo_onboarding) parametros.append('onboarding', modo_onboarding);
    if (metodo_inicio) parametros.append('loginMethod', metodo_inicio);

    const cadena_consulta = parametros.toString();
    if (cadena_consulta) {
      ruta += `?${cadena_consulta}`;
    }

    return this.solicitar(ruta);
  }

  async eliminar_cuenta(id_cuenta_zernio) {
    if (!id_cuenta_zernio) {
      return { exito: false, error: { mensaje: 'ID de cuenta Zernio es requerido' } };
    }
    return this.solicitar(`/accounts/${id_cuenta_zernio}`, {
      metodo: 'DELETE',
    });
  }

  async conectar_whatsapp_directo({ token_acceso, id_waba, id_numero_telefono, pin }) {
    return this.solicitar('/connect/whatsapp/credentials', {
      metodo: 'POST',
      cuerpo: {
        accessToken: token_acceso,
        wabaId: id_waba,
        phoneNumberId: id_numero_telefono,
        pin,
      },
    });
  }

  _obtener_segundos_reintento(cabecera_retry_after) {
    if (!cabecera_retry_after) return null;
    const segundos = parseInt(cabecera_retry_after, 10);
    return isNaN(segundos) ? null : segundos;
  }

  _calcular_espera_con_jitter(intento) {
    const base_ms = Math.min(1000 * Math.pow(2, intento - 1), 8000);
    const variacion_jitter = Math.random() * 500;
    return base_ms + variacion_jitter;
  }

  _pausar(milisegundos) {
    return new Promise((resolver) => setTimeout(resolver, milisegundos));
  }
}
