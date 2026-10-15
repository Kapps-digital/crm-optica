'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Moon, Sun, Building2 } from 'lucide-react';
import { PanelLateral } from '@/componentes/navegacion/PanelLateral';
import { ListaConversaciones } from '@/componentes/chat/ListaConversaciones';
import { VentanaChat } from '@/componentes/chat/VentanaChat';
import { FichaOptometrica } from '@/componentes/chat/FichaOptometrica';
import { DirectorioPacientes } from '@/componentes/pacientes/DirectorioPacientes';
import { ModalRegistrarPaciente } from '@/componentes/pacientes/ModalRegistrarPaciente';
import { ModalNuevaFormula } from '@/componentes/pacientes/ModalNuevaFormula';
import { ModalAgendarCita, type DatosNuevaCita } from '@/componentes/citas/ModalAgendarCita';
import { CalendarioCitas } from '@/componentes/citas/CalendarioCitas';
import { ModuloAutoSegmentacion } from '@/componentes/campanas/ModuloAutoSegmentacion';
import { ModuloPlantillas } from '@/componentes/plantillas/ModuloPlantillas';
import { ModuloConfiguracion } from '@/componentes/configuracion/ModuloConfiguracion';
import { EtiquetaTooltip } from '@/componentes/comunes/EtiquetaTooltip';
import { SelectorDesplegable } from '@/componentes/comunes/SelectorDesplegable';
import {
  obtenerTokenAutenticacion,
  obtenerUsuarioSesion,
  obtenerOpticaSesion,
  guardarOpticaSesion,
  obtenerPerfilUsuario,
  obtenerOpticas,
  obtenerIdOpticaActiva,
  establecerIdOpticaActiva,
  aplicarTemaOptica,
  obtenerConversaciones,
  sincronizarConversaciones,
  obtenerMensajes,
  obtenerDetalleContacto,
  obtenerPacientes,
  enviarMensajeChat,
  marcarConversacionLeida,
  registrarFormulaOptica,
  registrarCita,
  obtenerEstadoCanalesApi,
} from '@/servicios/api_crm';
import type { Contacto, Conversacion, Mensaje, FormulaOptica, Usuario, Optica, Segmento } from '@/tipos/crm';
import { formatearTelefono, estaEnVentana24Horas } from '@/utilidades/formato';

const CATALOGO_OPTICAS_BASE: Optica[] = [
  {
    id: 1,
    nombre: 'Tu Visión Óptica',
    slug: 'tu-vision',
    logo_url: null,
    color_primario: '#0284c7',
    color_secundario: '#0369a1',
    telefono: '+57 313 2531694',
    activo: true,
  },
  {
    id: 2,
    nombre: 'Óptica Lumina',
    slug: 'optica-lumina',
    logo_url: null,
    color_primario: '#059669',
    color_secundario: '#047857',
    telefono: '+57 300 9876543',
    activo: true,
  },
];

export default function PaginaPrincipal() {
  const router = useRouter();
  const [autenticado, setAutenticado] = useState<boolean | null>(null);
  const [usuarioActual, setUsuarioActual] = useState<Usuario | null>(null);
  const [opticaActual, setOpticaActual] = useState<Optica | null>(CATALOGO_OPTICAS_BASE[0]);
  const [listaOpticas, setListaOpticas] = useState<Optica[]>(CATALOGO_OPTICAS_BASE);
  const [idOpticaActiva, setIdOpticaActiva] = useState<number>(1);

  const [panelColapsado, setPanelColapsado] = useState(false);
  const [vistaActiva, setVistaActiva] = useState('mensajeria');
  const [temaOscuro, setTemaOscuro] = useState(false);

  // Ficha colapsada por defecto para máxima ganancia de espacio
  const [fichaAbierta, setFichaAbierta] = useState(false);
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [conversacionActiva, setConversacionActiva] = useState<Conversacion | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [pacienteActivo, setPacienteActivo] = useState<Contacto | null>(null);
  const [formulaVigente, setFormulaVigente] = useState<FormulaOptica | null>(null);
  const [formulasPaciente, setFormulasPaciente] = useState<FormulaOptica[]>([]);

  const [pacientes, setPacientes] = useState<Contacto[]>([]);
  const [cargandoChats, setCargandoChats] = useState(true);
  const [cargandoPacientes, setCargandoPacientes] = useState(false);
  const [modalFormulaAbierto, setModalFormulaAbierto] = useState(false);
  const [contactoParaFormula, setContactoParaFormula] = useState<Contacto | null>(null);

  const [modalCitaAbierto, setModalCitaAbierto] = useState(false);
  const [contactoParaCita, setContactoParaCita] = useState<Contacto | null>(null);
  const [modalRegistrarPacienteChatAbierto, setModalRegistrarPacienteChatAbierto] = useState(false);

  // Caché de mensajes en memoria para cambio de chat instantáneo (0ms)
  const cacheMensajes = useRef<Record<number, Mensaje[]>>({});
  const idChatEnCarga = useRef<number | null>(null);
  const conversacionActivaRef = useRef<number | null>(null);
  const [cargandoMensajesChat, setCargandoMensajesChat] = useState(false);

  useEffect(() => {
    conversacionActivaRef.current = conversacionActiva?.id || null;
  }, [conversacionActiva]);

  const [sincronizandoChats, setSincronizandoChats] = useState(false);

  // Estado del canal de atención para la barra superior
  const [estadoCanalWhatsApp, setEstadoCanalWhatsApp] = useState<{
    conectado: boolean;
    numero: string | null;
  }>({ conectado: false, numero: null });

  const sincronizarCanalCabecera = useCallback(async () => {
    try {
      const res = await obtenerEstadoCanalesApi();
      if (res.exito && res.cuenta_whatsapp) {
        setEstadoCanalWhatsApp({
          conectado: Boolean(res.cuenta_whatsapp.conectado),
          numero: res.cuenta_whatsapp.numero || null,
        });
      } else {
        setEstadoCanalWhatsApp({
          conectado: false,
          numero: null,
        });
      }
    } catch {
      setEstadoCanalWhatsApp({ conectado: false, numero: null });
    }
  }, []);

  useEffect(() => {
    sincronizarCanalCabecera();
    const alActualizarCanal = () => sincronizarCanalCabecera();
    window.addEventListener('crm_canal_whatsapp_actualizado', alActualizarCanal);
    window.addEventListener('crm_cambio_optica', alActualizarCanal);
    return () => {
      window.removeEventListener('crm_canal_whatsapp_actualizado', alActualizarCanal);
      window.removeEventListener('crm_cambio_optica', alActualizarCanal);
    };
  }, [sincronizarCanalCabecera]);

  // Conteo total de mensajes no leídos recibidos por el usuario
  const totalMensajesNoLeidos = useMemo(() => {
    return conversaciones.reduce((total, c) => {
      const cantidad = Number(c.mensajes_no_leidos || 0);
      if (c.no_leido || cantidad > 0) {
        return total + Math.max(cantidad, 1);
      }
      return total;
    }, 0);
  }, [conversaciones]);

  // Verificación de autenticación y carga de datos de la óptica
  useEffect(() => {
    const token = obtenerTokenAutenticacion();
    if (!token) {
      router.push('/login');
      return;
    }

    const usr = obtenerUsuarioSesion();
    const optSesion = obtenerOpticaSesion();
    const idGuardado = obtenerIdOpticaActiva();
    const idInicial = idGuardado ? Number(idGuardado) : (optSesion ? Number(optSesion.id) : 1);

    setIdOpticaActiva(idInicial);

    if (usr) setUsuarioActual(usr);
    const opticaInicial =
      (optSesion && Number(optSesion.id) === idInicial ? optSesion : null) ||
      CATALOGO_OPTICAS_BASE.find((o) => Number(o.id) === idInicial) ||
      optSesion ||
      CATALOGO_OPTICAS_BASE[0];
    setOpticaActual(opticaInicial);
    aplicarTemaOptica(opticaInicial);
    setAutenticado(true);

    obtenerPerfilUsuario().then(async (res) => {
      if (res.exito) {
        if (res.usuario) {
          setUsuarioActual(res.usuario);
        }
        // Aplicar la óptica fresca asociada al usuario retornada por la API
        if (res.optica) {
          const opticaBd: Optica = {
            ...res.optica,
            id: Number(res.optica.id),
          };
          setOpticaActual(opticaBd);
          aplicarTemaOptica(opticaBd);
          guardarOpticaSesion(opticaBd);
        }

        // Cargar catálogo completo de ópticas desde el backend
        const opts = await obtenerOpticas();
        if (opts.length > 0) {
          setListaOpticas(opts);
          const idActiva = obtenerIdOpticaActiva() || idInicial;
          const encontrada = opts.find((o) => Number(o.id) === Number(idActiva));
          if (encontrada) {
            setOpticaActual(encontrada);
            aplicarTemaOptica(encontrada);
            guardarOpticaSesion(encontrada);
          }
        }
      }
    });
  }, [router]);

  // Listener para sincronización instantánea de cambios de óptica o logotipo entre módulos
  useEffect(() => {
    const alActualizarOpticaGlobal = () => {
      const optGuardada = obtenerOpticaSesion();
      if (optGuardada) {
        setOpticaActual(optGuardada);
        aplicarTemaOptica(optGuardada);
      }
    };
    window.addEventListener('crm_cambio_optica', alActualizarOpticaGlobal);
    return () => window.removeEventListener('crm_cambio_optica', alActualizarOpticaGlobal);
  }, []);

  const manejarCambioOptica = async (id: number | string) => {
    const idNumerico = Number(id);
    setIdOpticaActiva(idNumerico);
    establecerIdOpticaActiva(idNumerico);

    let catalogo = listaOpticas && listaOpticas.length > 0 ? listaOpticas : CATALOGO_OPTICAS_BASE;
    let seleccionada = catalogo.find((o) => Number(o.id) === idNumerico);
    if (!seleccionada) {
      const opts = await obtenerOpticas();
      if (opts.length > 0) {
        setListaOpticas(opts);
        seleccionada = opts.find((o) => Number(o.id) === idNumerico);
      }
    }
    if (!seleccionada) {
      seleccionada = CATALOGO_OPTICAS_BASE.find((o) => Number(o.id) === idNumerico);
    }

    if (seleccionada) {
      setOpticaActual(seleccionada);
      aplicarTemaOptica(seleccionada);
      if (typeof window !== 'undefined') {
        localStorage.setItem('crm_optica', JSON.stringify(seleccionada));
        window.dispatchEvent(new Event('crm_cambio_optica'));
      }
    }

    // Limpieza profunda e instantánea de estados para no mezclar datos entre ópticas
    cacheMensajes.current = {};
    setConversacionActiva(null);
    setMensajes([]);
    setPacienteActivo(null);
    setFormulaVigente(null);
    setFormulasPaciente([]);
    setConversaciones([]);
    setCargandoChats(true);

    const [nuevasConversaciones] = await Promise.all([
      obtenerConversaciones(),
      recargarPacientes(),
    ]);
    setConversaciones(nuevasConversaciones);
    setCargandoChats(false);
  };

  const alternarTema = () => {
    const nuevoTema = !temaOscuro;
    setTemaOscuro(nuevoTema);
    document.documentElement.setAttribute('data-tema', nuevoTema ? 'oscuro' : 'claro');
  };

  const recargarConversaciones = useCallback(async () => {
    const lista = await obtenerConversaciones();
    const idActiva = vistaActiva === 'mensajeria' ? conversacionActivaRef.current : null;
    const listaNormalizada = Array.isArray(lista)
      ? lista.map((c) =>
          c.id === idActiva
            ? { ...c, no_leido: false, mensajes_no_leidos: 0 }
            : c
        )
      : [];

    setConversaciones(listaNormalizada);
    setCargandoChats(false);

    // Precargar en segundo plano los mensajes de las conversaciones recientes para que el cambio de chat sea instantáneo (0ms)
    if (listaNormalizada && Array.isArray(listaNormalizada)) {
      listaNormalizada.slice(0, 8).forEach((c) => {
        if (!cacheMensajes.current[c.id]) {
          obtenerMensajes(c.id).then((msgs) => {
            if (msgs && Array.isArray(msgs)) {
              cacheMensajes.current[c.id] = msgs;
            }
          }).catch(() => {});
        }
      });
    }
  }, [vistaActiva]);

  // Sincronización instantánea de activación/desactivación masiva de IA en todos los chats
  useEffect(() => {
    const alCambiarIAGlobal = async () => {
      await recargarConversaciones();
      if (conversacionActivaRef.current) {
        const lista = await obtenerConversaciones();
        if (Array.isArray(lista)) {
          const act = lista.find((c) => c.id === conversacionActivaRef.current);
          if (act) {
            setConversacionActiva(act);
          }
        }
      }
    };
    window.addEventListener('crm_cambio_ia_global', alCambiarIAGlobal);
    return () => window.removeEventListener('crm_cambio_ia_global', alCambiarIAGlobal);
  }, [recargarConversaciones]);

  const manejarSincronizarChats = useCallback(async () => {
    setSincronizandoChats(true);
    try {
      await sincronizarConversaciones();
      await recargarConversaciones();
      if (conversacionActiva) {
        const nuevosMensajes = await obtenerMensajes(conversacionActiva.id);
        cacheMensajes.current[conversacionActiva.id] = nuevosMensajes;
        setMensajes(nuevosMensajes);
      }
    } catch (error) {
      console.error('Error en sincronización manual:', error);
    } finally {
      setSincronizandoChats(false);
    }
  }, [recargarConversaciones, conversacionActiva]);

  const recargarPacientes = useCallback(async () => {
    setCargandoPacientes(true);
    const lista = await obtenerPacientes();
    setPacientes(lista);
    setCargandoPacientes(false);
  }, []);

  useEffect(() => {
    recargarConversaciones();
    recargarPacientes();
    const intervalo = setInterval(recargarConversaciones, 2500);
    return () => clearInterval(intervalo);
  }, [recargarConversaciones, recargarPacientes]);

  useEffect(() => {
    if (vistaActiva === 'pacientes') {
      recargarPacientes();
    }
  }, [vistaActiva, recargarPacientes]);

  const manejarSeleccionarConversacion = async (conv: Conversacion) => {
    conversacionActivaRef.current = conv.id;

    // Limpiar siempre no leídos en estado local y notificar al backend
    setConversaciones((prev) =>
      prev.map((c) =>
        c.id === conv.id ? { ...c, no_leido: false, mensajes_no_leidos: 0 } : c
      )
    );
    if (conv.id) {
      marcarConversacionLeida(conv.id);
    }

    const convLimpia = { ...conv, no_leido: false, mensajes_no_leidos: 0 };
    setConversacionActiva(convLimpia);
    idChatEnCarga.current = conv.id;

    // Si ya están en caché, renderizarlos de inmediato (0 ms)
    if (conv.id && cacheMensajes.current[conv.id]) {
      setMensajes(cacheMensajes.current[conv.id]);
      setCargandoMensajesChat(false);
    } else {
      // Limpiar de inmediato los mensajes del chat anterior para que no se queden pegados
      setMensajes([]);
      setCargandoMensajesChat(Boolean(conv.id));
    }

    if (!conv.id) {
      // Conversación nueva/temporal sin historial remoto
      setCargandoMensajesChat(false);
      return;
    }

    try {
      // Cargar en paralelo mensajes y detalle de paciente
      const [listaMensajes, detalle] = await Promise.all([
        obtenerMensajes(conv.id),
        conv.contacto_id ? obtenerDetalleContacto(conv.contacto_id) : Promise.resolve(null),
      ]);

      // Evitar condición de carrera si el usuario dio clic en otro chat rápidamente
      if (idChatEnCarga.current === conv.id) {
        cacheMensajes.current[conv.id] = listaMensajes;
        setMensajes(listaMensajes);

        if (detalle) {
          setPacienteActivo(detalle.contacto);
          setFormulasPaciente(detalle.formulas || []);
          setFormulaVigente(detalle.formulas.length > 0 ? detalle.formulas[0] : null);
        } else {
          setPacienteActivo({
            id: conv.contacto_id || 0,
            nombre_completo: conv.contacto_nombre || null,
            nombre: conv.contacto_nombre || null,
            telefono: conv.contacto_telefono || null,
            correo: null,
            business_scoped_user_id: conv.contacto_bsuid || null,
            creado_en: conv.creado_en,
            actualizado_en: conv.actualizado_en,
          });
          setFormulasPaciente([]);
          setFormulaVigente(null);
        }
      }
    } catch (error) {
      console.error('Error al cargar mensajes del chat:', error);
    } finally {
      if (idChatEnCarga.current === conv.id) {
        setCargandoMensajesChat(false);
      }
    }
  };

  // Navegación universal e instantánea (0ms) hacia un chat desde cualquier vista del CRM
  const navegarAlChatContacto = useCallback(
    (contactoId: number) => {
      // 1. Cambiar inmediatamente de vista (0ms de latencia percibida)
      setVistaActiva('mensajeria');

      // 2. Buscar en memoria por contacto_id
      let conv = conversaciones.find((c) => Number(c.contacto_id) === Number(contactoId));

      // 3. Si no coincide, buscar por número de teléfono
      const paciente = pacientes.find((p) => Number(p.id) === Number(contactoId));
      if (!conv && paciente?.telefono) {
        const telDigitos = String(paciente.telefono).replace(/\D/g, '');
        if (telDigitos) {
          conv = conversaciones.find(
            (c) => String(c.contacto_telefono || '').replace(/\D/g, '') === telDigitos
          );
        }
      }

      if (conv) {
        // Cargar conversación encontrada sin congelar la interfaz
        manejarSeleccionarConversacion(conv);
      } else if (paciente) {
        // Inicializar contexto visual para contacto sin conversación histórica aún
        const convTemporal: Conversacion = {
          id: 0,
          contacto_id: paciente.id,
          canal: 'whatsapp',
          id_cuenta_zernio: null,
          id_conversacion_zernio: '',
          ultimo_mensaje_entrante_en: null,
          estado: 'activa',
          creado_en: new Date().toISOString(),
          actualizado_en: new Date().toISOString(),
          contacto_nombre: paciente.nombre_completo || paciente.nombre || 'Paciente',
          contacto_telefono: paciente.telefono || '',
        };
        conversacionActivaRef.current = 0;
        setConversacionActiva(convTemporal);
        setPacienteActivo(paciente);
        setMensajes([]);
        setCargandoMensajesChat(false);

        // En segundo plano consultar si el servidor tiene una conversación recién creada
        obtenerConversaciones().then((listaFresca) => {
          if (Array.isArray(listaFresca) && listaFresca.length > 0) {
            setConversaciones(listaFresca);
            const coincidencia =
              listaFresca.find((c) => Number(c.contacto_id) === Number(contactoId)) ||
              (paciente.telefono
                ? listaFresca.find(
                    (c) =>
                      String(c.contacto_telefono || '').replace(/\D/g, '') ===
                      String(paciente.telefono).replace(/\D/g, '')
                  )
                : null);
            if (coincidencia) {
              manejarSeleccionarConversacion(coincidencia);
            }
          }
        }).catch(() => {});
      }
    },
    [conversaciones, pacientes]
  );

  // Sondeo en tiempo real de mensajes del chat abierto cada 3.5 segundos con preservación de mensajes en vuelo
  useEffect(() => {
    if (!conversacionActiva) return;

    const refrescarMensajesActivos = async () => {
      const lista = await obtenerMensajes(conversacionActiva.id);
      setMensajes((prev) => {
        // Preservar mensajes temporales/optimistas que todavía estén en vuelo hacia Zernio
        const temporalesEnVuelo = prev.filter(
          (m) =>
            m.id_mensaje_plataforma?.startsWith('temp_') &&
            !lista.some(
              (real) =>
                real.direccion === 'saliente' &&
                real.texto === m.texto &&
                Math.abs(new Date(real.creado_en).getTime() - new Date(m.creado_en).getTime()) < 30000
            )
        );

        const listaCombinada = [...lista, ...temporalesEnVuelo];
        cacheMensajes.current[conversacionActiva.id] = listaCombinada;

        if (
          listaCombinada.length === prev.length &&
          listaCombinada.every((m, idx) => m.id === prev[idx]?.id && m.estado_entrega === prev[idx]?.estado_entrega)
        ) {
          return prev;
        }

        return listaCombinada;
      });
    };

    const intervaloChat = setInterval(refrescarMensajesActivos, 2000);
    return () => clearInterval(intervaloChat);
  }, [conversacionActiva]);

  const manejarEnviarMensaje = async (texto: string, convExplicita?: Conversacion) => {
    const conv = convExplicita || conversacionActiva;
    if (!conv || !conv.id) {
      alert('Por favor selecciona una conversación para enviar el mensaje.');
      return;
    }

    const idConv = Number(conv.id);
    const idTemp = Date.now();
    const mensajeOptimista: Mensaje = {
      id: idTemp,
      conversacion_id: idConv,
      id_mensaje_plataforma: `temp_${idTemp}`,
      id_mensaje_zernio: null,
      direccion: 'saliente',
      tipo_mensaje: 'texto',
      texto,
      payload_json: null,
      estado_entrega: 'enviado',
      creado_en: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    // 1. Respuesta visual instantánea sin parpadeo (0ms de retraso percibido)
    setMensajes((prev) => [...prev, mensajeOptimista]);

    // 2. Envío a través de la API
    const res = await enviarMensajeChat(idConv, texto, false);
    if (res.exito) {
      // 3. Si el backend nos devolvió el registro persistido, reconciliar inmediatamente en memoria
      if (res.mensaje) {
        setMensajes((prev) =>
          prev.map((m) => (m.id === idTemp ? res.mensaje! : m))
        );
      } else {
        // Traer lista completa de la BD y reconciliar sin perder nada
        const lista = await obtenerMensajes(idConv);
        setMensajes((prev) => {
          const otrosTemporales = prev.filter(
            (m) => m.id !== idTemp && m.id_mensaje_plataforma?.startsWith('temp_')
          );
          return [...lista, ...otrosTemporales];
        });
      }
      setConversaciones((prev) =>
        prev.map((c) =>
          Number(c.id) === idConv
            ? {
                ...c,
                sin_contestar: false,
                ultimo_mensaje_direccion: 'saliente',
                ultimo_mensaje_texto: texto,
                ultimo_mensaje_fecha: new Date().toISOString(),
              }
            : c
        )
      );
      recargarConversaciones();
    } else {
      // Si falló el envío, remover el temporal y alertar
      setMensajes((prev) => prev.filter((m) => m.id !== idTemp));
      alert(`No se pudo entregar el mensaje: ${res.error || 'Fallo de entrega en WhatsApp'}`);
    }
  };

  const manejarReactivarPlantilla = async (nombrePlantilla?: string, idiomaPlantilla?: string) => {
    if (!conversacionActiva) return;
    const res = await enviarMensajeChat(
      conversacionActiva.id,
      '',
      true,
      nombrePlantilla,
      idiomaPlantilla
    );
    if (res.exito) {
      if (res.mensaje) {
        setMensajes((prev) => [...prev, res.mensaje!]);
      } else {
        const lista = await obtenerMensajes(conversacionActiva.id);
        setMensajes(lista);
      }
      const nombreMostrar = nombrePlantilla || 'optica_digital';
      setConversaciones((prev) =>
        prev.map((c) =>
          c.id === conversacionActiva.id
            ? {
                ...c,
                sin_contestar: false,
                ultimo_mensaje_direccion: 'saliente',
                ultimo_mensaje_texto: `[Template: ${nombreMostrar}]`,
                ultimo_mensaje_fecha: new Date().toISOString(),
              }
            : c
        )
      );
      recargarConversaciones();
    } else {
      alert(`No se pudo enviar la plantilla: ${res.error || 'WhatsApp rechazó la plantilla o la cuenta no tiene saldo'}`);
    }
  };

  const manejarGuardarFormula = async (datos: Partial<FormulaOptica>) => {
    const res = await registrarFormulaOptica(datos);
    if (res.exito) {
      const idContacto = datos.contacto_id || pacienteActivo?.id;
      if (idContacto) {
        const detalle = await obtenerDetalleContacto(idContacto);
        if (detalle) {
          setPacienteActivo(detalle.contacto);
          setFormulasPaciente(detalle.formulas || []);
          setFormulaVigente(detalle.formulas.length > 0 ? detalle.formulas[0] : null);
        }
      }
      recargarPacientes();
      recargarConversaciones();
    } else {
      alert('Error al guardar la fórmula clínica');
    }
  };

  const manejarGuardarCita = async (datos: DatosNuevaCita): Promise<{ exito: boolean; error?: string }> => {
    const res = await registrarCita({
      contacto_id: datos.contacto_id,
      fecha_cita: datos.fecha_cita,
      hora_cita: datos.hora_cita,
      motivo: datos.motivo,
      especialista: datos.especialista,
      observaciones: datos.observaciones,
    });

    if (res.exito) {
      // Si se activó la notificación por WhatsApp y hay conversación activa en ventana
      if (datos.enviar_confirmacion_whatsapp && conversacionActiva) {
        const enVentana = estaEnVentana24Horas(conversacionActiva.ultimo_mensaje_entrante_en);
        if (enVentana) {
          let fechaFormateada = datos.fecha_cita;
          if (datos.fecha_cita && datos.fecha_cita.includes('-')) {
            const partes = datos.fecha_cita.split('-');
            if (partes.length === 3) {
              fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;
            }
          }

          const encabezadoOptica = (opticaActual?.nombre || 'Óptica').toUpperCase();
          const lineasNotificacion = [
            `🗓️ *${encabezadoOptica} - Confirmación de Cita*`,
            `Hola *${contactoParaCita?.nombre || 'Paciente'}*, tu cita de optometría ha sido programada con éxito:`,
            ``,
            `📅 *Fecha:* ${fechaFormateada}`,
            `⏰ *Hora:* ${datos.hora_cita}`,
            `🎯 *Motivo:* ${datos.motivo}`,
          ];
          if (datos.especialista?.trim()) {
            lineasNotificacion.push(`👨‍⚕️ *Especialista:* ${datos.especialista.trim()}`);
          }
          lineasNotificacion.push(``);
          lineasNotificacion.push(`📍 Te sugerimos presentarte 10 minutos antes. Si necesitas reprogramar, responde directamente a este chat.`);

          const textoNotificacion = lineasNotificacion.join('\n');

          await manejarEnviarMensaje(textoNotificacion);
        }
      }
      setModalCitaAbierto(false);
      return { exito: true };
    } else {
      return {
        exito: false,
        error: res.error || 'Este paciente para ese día a esa hora ya tiene una cita asignada.',
      };
    }
  };

  if (autenticado !== true) {
    return (
      <div className="login-pantalla-fondo">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem', color: '#94a3b8' }}>
          <div className="login-spinner" style={{ width: '28px', height: '28px', borderWidth: '3px' }} />
          <span style={{ fontSize: '0.85rem' }}>Verificando acceso al sistema...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="layout-con-panel-lateral">
      {/* 1. Panel Lateral Corporativo */}
      <PanelLateral
        colapsado={panelColapsado}
        alAlternarColapso={() => setPanelColapsado(!panelColapsado)}
        vistaActiva={vistaActiva}
        alCambiarVista={(v) => setVistaActiva(v)}
        temaOscuro={temaOscuro}
        alAlternarTema={alternarTema}
        conteoChats={totalMensajesNoLeidos}
        conteoPacientes={null}
        optica={opticaActual}
        usuario={usuarioActual}
      />

      {/* 2. Contenido Principal */}
      <main className="contenido-principal">
        {/* Barra Superior Compacta (Título de Hoja, Píldora WhatsApp y Selector de Modo Oscuro/Claro) */}
        <header className="barra-superior">
          <div className="barra-titulo-grupo">
            <h1>
              {vistaActiva === 'mensajeria' && 'Bandeja de Entrada'}
              {vistaActiva === 'pacientes' && (
                <>
                  Pacientes <span className="ampersand-titular">&</span> Contactos
                </>
              )}
              {vistaActiva === 'citas' && 'Calendario de Citas'}
              {vistaActiva === 'campanas' && (
                <>
                  Auto-Segmentación <span className="ampersand-titular">&</span> Audiencias
                </>
              )}
              {vistaActiva === 'plantillas' && 'Plantillas'}
              {vistaActiva === 'analitica' && (
                <>
                  Analítica <span className="ampersand-titular">&</span> Reportes
                </>
              )}
              {vistaActiva === 'configuracion' && 'Configuración'}
            </h1>
            <p>
              {vistaActiva === 'mensajeria' && 'Gestión centralizada de mensajes y atención al cliente en tiempo real'}
              {vistaActiva === 'pacientes' && 'Directorio de pacientes con historial clínico y contactos de mensajería'}
              {vistaActiva === 'citas' && 'Agenda clínica, programación de turnos y control de consultas'}
              {vistaActiva === 'campanas' && 'Filtros automáticos por historial clínico, fecha de control y tipo de lente'}
              {vistaActiva === 'plantillas' && 'Gestión de plantillas preaprobadas para mensajería empresarial'}
              {vistaActiva === 'analitica' && 'Métricas de atención y desempeño del equipo de optometría'}
              {vistaActiva === 'configuracion' && 'Canales de atención, perfil de la óptica y reglas de atención clínica'}
            </p>
          </div>

          {/* Acciones de la derecha: Selector de Óptica (Superadmin), Píldora de Conexión y Alternador de Tema */}
          <div className="barra-acciones">
            {usuarioActual?.rol === 'admin' && (
              <div style={{ minWidth: '210px' }}>
                <SelectorDesplegable
                  valor={String(idOpticaActiva)}
                  alCambiar={(nuevoId) => manejarCambioOptica(Number(nuevoId))}
                  opciones={listaOpticas.map((opt) => ({
                    valor: String(opt.id),
                    etiqueta: opt.nombre,
                    colorIndicador: opt.color_primario,
                    badge: Number(opt.id) === 1 ? 'Matriz' : 'Sede',
                    icono: Building2,
                  }))}
                  icono={Building2}
                  placeholder="Seleccionar óptica..."
                  tamano="compacto"
                  posicionAlineacion="derecha"
                  anchoMinimo="210px"
                />
              </div>
            )}

            {estadoCanalWhatsApp.conectado && estadoCanalWhatsApp.numero ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--fondo-elevado)', padding: '0.35rem 0.85rem', borderRadius: 'var(--radio-completo)', border: '1px solid var(--borde-tarjeta)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }}></span>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--texto-secundario)', whiteSpace: 'nowrap' }}>
                  Canal Activo: {formatearTelefono(estadoCanalWhatsApp.numero) || estadoCanalWhatsApp.numero}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--fondo-elevado)', padding: '0.35rem 0.85rem', borderRadius: 'var(--radio-completo)', border: '1px solid var(--borde-tarjeta)' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#94a3b8' }}></span>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--texto-atenuado)', whiteSpace: 'nowrap' }}>
                  Sin número conectado
                </span>
              </div>
            )}

            <EtiquetaTooltip
              texto={temaOscuro ? 'Modo Claro' : 'Modo Oscuro'}
              posicion="abajo"
            >
              <button
                type="button"
                onClick={alternarTema}
                className="barra-boton-tema"
                aria-label={temaOscuro ? 'Modo Claro' : 'Modo Oscuro'}
              >
                {temaOscuro ? (
                  <Sun style={{ width: '17px', height: '17px' }} />
                ) : (
                  <Moon style={{ width: '17px', height: '17px' }} />
                )}
              </button>
            </EtiquetaTooltip>
          </div>
        </header>

        {/* Secciones del CRM */}
        {vistaActiva === 'mensajeria' && (
          <section id="vista-mensajeria" className={`vista-mensajeria-tripartita ${!fichaAbierta ? 'ficha-colapsada' : ''}`}>
            {/* 1. Lista de Conversaciones */}
            <ListaConversaciones
              conversaciones={conversaciones}
              conversacionActivaId={conversacionActiva?.id || null}
              alSeleccionarConversacion={manejarSeleccionarConversacion}
              cargando={cargandoChats}
              alSincronizar={manejarSincronizarChats}
              sincronizando={sincronizandoChats}
            />

            {/* 2. Chat Principal */}
            <VentanaChat
              conversacion={conversacionActiva}
              mensajes={mensajes}
              cargandoMensajes={cargandoMensajesChat}
              alEnviarMensaje={manejarEnviarMensaje}
              alReactivarConPlantilla={manejarReactivarPlantilla}
              fichaAbierta={fichaAbierta}
              alAbrirFicha={() => setFichaAbierta(true)}
              paciente={pacienteActivo}
              alRegistrarPaciente={() => setModalRegistrarPacienteChatAbierto(true)}
            />

            {/* 3. Ficha Optométrica Lateral */}
            <FichaOptometrica
              contacto={pacienteActivo}
              formula={formulaVigente}
              formulas={formulasPaciente}
              nombreOptica={opticaActual?.nombre}
              enVentana24h={
                conversacionActiva
                  ? estaEnVentana24Horas(conversacionActiva.ultimo_mensaje_entrante_en)
                  : (pacienteActivo
                      ? estaEnVentana24Horas(conversaciones.find((c) => Number(c.contacto_id) === Number(pacienteActivo.id))?.ultimo_mensaje_entrante_en)
                      : false)
              }
              alAlternarFicha={() => setFichaAbierta(!fichaAbierta)}
              alAbrirNuevaFormula={() => {
                setContactoParaFormula(pacienteActivo);
                setModalFormulaAbierto(true);
              }}
              alAbrirAgendarCita={() => {
                setContactoParaCita(pacienteActivo);
                setModalCitaAbierto(true);
              }}
              alCompartirPrescripcion={(texto) => {
                let convDestino = conversacionActiva;
                if ((!convDestino || !convDestino.id) && pacienteActivo) {
                  convDestino = conversaciones.find((c) => Number(c.contacto_id) === Number(pacienteActivo.id)) || null;
                  if (convDestino) {
                    setConversacionActiva(convDestino);
                  }
                }

                if (convDestino && convDestino.id) {
                  manejarEnviarMensaje(texto, convDestino);
                } else {
                  alert('Por favor selecciona una conversación para enviar la prescripción al chat.');
                }
              }}
              alReactivarConPlantilla={manejarReactivarPlantilla}
            />
          </section>
        )}

        {vistaActiva === 'pacientes' && (
          <DirectorioPacientes
            pacientes={pacientes}
            cargando={cargandoPacientes}
            alAbrirNuevaFormula={(p) => {
              setContactoParaFormula(p);
              setModalFormulaAbierto(true);
            }}
            alRecargarPacientes={recargarPacientes}
            alSeleccionarContactoChat={navegarAlChatContacto}
          />
        )}

        {vistaActiva === 'citas' && (
          <CalendarioCitas
            contactos={pacientes}
            conversaciones={conversaciones}
            nombreOptica={opticaActual?.nombre}
            alSeleccionarContactoChat={navegarAlChatContacto}
            alEnviarMensajeWhatsApp={async (texto, convDestino) => {
              await manejarEnviarMensaje(texto, convDestino || undefined);
            }}
          />
        )}

        {vistaActiva === 'campanas' && (
          <ModuloAutoSegmentacion
            alSeleccionarContactoChat={navegarAlChatContacto}
            nombreOptica={opticaActual?.nombre}
            opticaId={opticaActual?.id}
          />
        )}

        {vistaActiva === 'plantillas' && (
          <ModuloPlantillas
            nombreOptica={opticaActual?.nombre}
            opticaId={opticaActual?.id}
            alSeleccionarContactoChat={navegarAlChatContacto}
          />
        )}

        {vistaActiva === 'configuracion' && (
          <ModuloConfiguracion
            opticaActual={opticaActual}
            alActualizarOptica={(opticaActualizada) => {
              setOpticaActual(opticaActualizada);
              setListaOpticas((prev) =>
                prev.map((o) => (Number(o.id) === Number(opticaActualizada.id) ? { ...o, ...opticaActualizada } : o))
              );
              aplicarTemaOptica(opticaActualizada);
              guardarOpticaSesion(opticaActualizada);
            }}
          />
        )}

        {vistaActiva !== 'mensajeria' && vistaActiva !== 'pacientes' && vistaActiva !== 'citas' && vistaActiva !== 'campanas' && vistaActiva !== 'plantillas' && vistaActiva !== 'configuracion' && (
          <div style={{ flex: 1, padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--texto-atenuado)' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--texto-principal)', textTransform: 'capitalize' }}>
              Módulo de {vistaActiva}
            </h2>
            <p style={{ fontSize: '0.8rem', maxWidth: '400px', marginTop: '0.5rem' }}>
              Este módulo se conectará con los endpoints REST y la base de datos en las siguientes fases del plan.
            </p>
          </div>
        )}
      </main>

      {/* Modal de Prescripción Óptica */}
      <ModalNuevaFormula
        abierto={modalFormulaAbierto}
        contacto={contactoParaFormula}
        alCerrar={() => setModalFormulaAbierto(false)}
        alGuardar={manejarGuardarFormula}
      />

      {/* Modal de Agendamiento de Citas */}
      <ModalAgendarCita
        abierto={modalCitaAbierto}
        contacto={contactoParaCita}
        contactosDisponibles={pacientes}
        conversaciones={conversaciones}
        alCerrar={() => setModalCitaAbierto(false)}
        alGuardarCita={manejarGuardarCita}
      />

      {/* Modal de Registro / Conversión a Paciente desde el Chat */}
      <ModalRegistrarPaciente
        abierto={modalRegistrarPacienteChatAbierto}
        alCerrar={() => setModalRegistrarPacienteChatAbierto(false)}
        alGuardarExitoso={async (pacienteActualizado) => {
          await recargarPacientes();
          const idActualizado = Number(pacienteActualizado.id);
          if (conversacionActiva && Number(conversacionActiva.contacto_id) === idActualizado) {
            const detalle = await obtenerDetalleContacto(idActualizado);
            if (detalle) {
              setPacienteActivo(detalle.contacto);
              setFormulasPaciente(detalle.formulas || []);
              setFormulaVigente(detalle.formulas.length > 0 ? detalle.formulas[0] : null);
            } else {
              setPacienteActivo(pacienteActualizado);
            }
          }
          setConversaciones((prev) =>
            prev.map((c) =>
              Number(c.contacto_id) === idActualizado
                ? {
                    ...c,
                    contacto_nombre: pacienteActualizado.nombre_completo || pacienteActualizado.nombre || c.contacto_nombre,
                    contacto_telefono: pacienteActualizado.telefono || c.contacto_telefono,
                    contacto_correo: pacienteActualizado.correo || c.contacto_correo,
                  }
                : c
            )
          );
        }}
        contactoParaConvertir={pacienteActivo}
      />
    </div>
  );
}
