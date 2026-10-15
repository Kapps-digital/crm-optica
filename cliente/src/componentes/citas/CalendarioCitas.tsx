'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as IconoCalendario,
  CalendarDays,
  CalendarClock,
  Clock,
  UserCheck,
  UserX,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock4,
  XCircle,
  MessageSquare,
  Phone,
  User,
  MoreVertical,
  CalendarCheck,
} from 'lucide-react';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';
import { SelectorDesplegable } from '../comunes/SelectorDesplegable';
import { ModalAgendarCita, type DatosNuevaCita } from './ModalAgendarCita';
import { ModalReprogramarCita, type DatosReprogramarCita } from './ModalReprogramarCita';
import { ModalConfirmarCancelarCita } from './ModalConfirmarCancelarCita';
import {
  SelectorPeriodoAgenda,
  type FiltroPeriodoAgenda,
  evaluarCoincidenciaPeriodo,
} from './SelectorPeriodoAgenda';
import { BadgeEstadoInteractivo } from './BadgeEstadoInteractivo';
import type { Cita, Contacto, Conversacion, EstadoCita } from '@/tipos/crm';
import {
  obtenerCitas,
  actualizarCita,
  cancelarCita,
  registrarCita,
} from '@/servicios/api_crm';
import { formatearTelefono, obtenerNombrePaciente } from '@/utilidades/formato';

interface PropiedadesCalendarioCitas {
  contactos: Contacto[];
  conversaciones: Conversacion[];
  nombreOptica?: string;
  alSeleccionarContactoChat?: (contactoId: number) => void;
  alEnviarMensajeWhatsApp?: (texto: string, conversacionDestino?: Conversacion | null) => Promise<void>;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// Citas simuladas para pruebas de paginación solicitadas por el usuario (25 registros)
const CITAS_SIMULADAS_25: Cita[] = [
  { id: 901, contacto_id: 101, contacto_nombre: 'Samir Bolívar', contacto_telefono: '+573117415122', fecha_cita: '2026-10-08', hora_cita: '08:00 AM', motivo: 'Primera Vez - Examen Computarizado', especialista: 'Dr. Samir Bolívar', estado: 'confirmada' },
  { id: 902, contacto_id: 102, contacto_nombre: 'María Fernanda Torres', contacto_telefono: '+573204567890', fecha_cita: '2026-10-08', hora_cita: '08:30 AM', motivo: 'Control Anual de Optometría', especialista: 'Dr. Samir Bolívar', estado: 'pendiente' },
  { id: 903, contacto_id: 103, contacto_nombre: 'Carlos Mendoza', contacto_telefono: '+573009876543', fecha_cita: '2026-10-08', hora_cita: '09:00 AM', motivo: 'Adaptación de Lentes de Contacto', especialista: 'Dra. Carolina Gómez', estado: 'confirmada' },
  { id: 904, contacto_id: 104, contacto_nombre: 'Laura Valentina Gómez', contacto_telefono: '+573153216549', fecha_cita: '2026-10-08', hora_cita: '09:30 AM', motivo: 'Revisión de Montura y Graduación', especialista: 'Dr. Samir Bolívar', estado: 'completada' },
  { id: 905, contacto_id: 105, contacto_nombre: 'Andrés Felipe Ruiz', contacto_telefono: '+573128901234', fecha_cita: '2026-10-08', hora_cita: '10:00 AM', motivo: 'Molestia Ocular / Fatiga Visual', especialista: 'Dr. Samir Bolívar', estado: 'confirmada' },
  { id: 906, contacto_id: 106, contacto_nombre: 'Claudia Patricia Morales', contacto_telefono: '+573187654321', fecha_cita: '2026-10-08', hora_cita: '10:30 AM', motivo: 'Examen Visual Ocupacional', especialista: 'Dra. Carolina Gómez', estado: 'pendiente' },
  { id: 907, contacto_id: 107, contacto_nombre: 'Diego Fernando Castro', contacto_telefono: '+573104561237', fecha_cita: '2026-10-08', hora_cita: '11:00 AM', motivo: 'Control de Miopía y Astigmatismo', especialista: 'Dr. Samir Bolívar', estado: 'confirmada' },
  { id: 908, contacto_id: 108, contacto_nombre: 'Valentina Ríos', contacto_telefono: '+573176549870', fecha_cita: '2026-10-08', hora_cita: '11:30 AM', motivo: 'Adaptación Lentes Progresivos', especialista: 'Dr. Samir Bolívar', estado: 'cancelada' },
  { id: 909, contacto_id: 109, contacto_nombre: 'Juan Camilo Herrera', contacto_telefono: '+573169874561', fecha_cita: '2026-10-08', hora_cita: '02:00 PM', motivo: 'Examen Visual y Fondo de Ojo', especialista: 'Dra. Carolina Gómez', estado: 'confirmada' },
  { id: 910, contacto_id: 110, contacto_nombre: 'Diana Marcela Ortiz', contacto_telefono: '+573112345678', fecha_cita: '2026-10-08', hora_cita: '02:30 PM', motivo: 'Primera Vez - Consulta General', especialista: 'Dr. Samir Bolívar', estado: 'pendiente' },
  { id: 911, contacto_id: 111, contacto_nombre: 'Santiago Morales', contacto_telefono: '+573216549873', fecha_cita: '2026-10-09', hora_cita: '08:00 AM', motivo: 'Control Post-Graduación', especialista: 'Dr. Samir Bolívar', estado: 'confirmada' },
  { id: 912, contacto_id: 112, contacto_nombre: 'Paola Andrea Castillo', contacto_telefono: '+573145678901', fecha_cita: '2026-10-09', hora_cita: '08:30 AM', motivo: 'Revisión Lentes Blandos', especialista: 'Dra. Carolina Gómez', estado: 'confirmada' },
  { id: 913, contacto_id: 113, contacto_nombre: 'Gabriel Eduardo Vargas', contacto_telefono: '+573198765432', fecha_cita: '2026-10-09', hora_cita: '09:00 AM', motivo: 'Molestia por Luz / Fotofobia', especialista: 'Dr. Samir Bolívar', estado: 'completada' },
  { id: 914, contacto_id: 114, contacto_nombre: 'Ana María Rojas', contacto_telefono: '+573132109876', fecha_cita: '2026-10-09', hora_cita: '09:30 AM', motivo: 'Examen de Agudeza Visual', especialista: 'Dr. Samir Bolívar', estado: 'confirmada' },
  { id: 915, contacto_id: 115, contacto_nombre: 'Javier Alexander Peña', contacto_telefono: '+573159873214', fecha_cita: '2026-10-09', hora_cita: '10:00 AM', motivo: 'Fórmula para Lentes Deportivos', especialista: 'Dra. Carolina Gómez', estado: 'pendiente' },
  { id: 916, contacto_id: 116, contacto_nombre: 'Natalia Sofía Duarte', contacto_telefono: '+573184561239', fecha_cita: '2026-10-09', hora_cita: '10:30 AM', motivo: 'Cambio de Fórmula Anual', especialista: 'Dr. Samir Bolívar', estado: 'confirmada' },
  { id: 917, contacto_id: 117, contacto_nombre: 'Mateo Alejandro Silva', contacto_telefono: '+573101239874', fecha_cita: '2026-10-09', hora_cita: '11:00 AM', motivo: 'Control Infantil de Miopía', especialista: 'Dr. Samir Bolívar', estado: 'confirmada' },
  { id: 918, contacto_id: 118, contacto_nombre: 'Carolina Méndez', contacto_telefono: '+573173214569', fecha_cita: '2026-10-09', hora_cita: '11:30 AM', motivo: 'Evaluación de Queratocono', especialista: 'Dra. Carolina Gómez', estado: 'cancelada' },
  { id: 919, contacto_id: 119, contacto_nombre: 'Óscar Iván Restrepo', contacto_telefono: '+573164567893', fecha_cita: '2026-10-09', hora_cita: '02:00 PM', motivo: 'Examen Visual Rutinario', especialista: 'Dr. Samir Bolívar', estado: 'confirmada' },
  { id: 920, contacto_id: 120, contacto_nombre: 'Juliana Andrea Cárdenas', contacto_telefono: '+573119876540', fecha_cita: '2026-10-09', hora_cita: '02:30 PM', motivo: 'Adaptación Lentes Tóricos', especialista: 'Dr. Samir Bolívar', estado: 'completada' },
  { id: 921, contacto_id: 121, contacto_nombre: 'Federico Santos', contacto_telefono: '+573214569871', fecha_cita: '2026-10-10', hora_cita: '08:00 AM', motivo: 'Revisión y Ajuste de Cristales', especialista: 'Dra. Carolina Gómez', estado: 'confirmada' },
  { id: 922, contacto_id: 122, contacto_nombre: 'Marcela Quintero', contacto_telefono: '+573149871235', fecha_cita: '2026-10-10', hora_cita: '08:30 AM', motivo: 'Primera Vez - Examen Integral', especialista: 'Dr. Samir Bolívar', estado: 'pendiente' },
  { id: 923, contacto_id: 123, contacto_nombre: 'Ricardo León', contacto_telefono: '+573193216548', fecha_cita: '2026-10-10', hora_cita: '09:00 AM', motivo: 'Examen Ocular para Conducción', especialista: 'Dr. Samir Bolívar', estado: 'confirmada' },
  { id: 924, contacto_id: 124, contacto_nombre: 'Sandra Milena Pineda', contacto_telefono: '+573138901237', fecha_cita: '2026-10-10', hora_cita: '09:30 AM', motivo: 'Control de Presbicia y Progresivos', especialista: 'Dra. Carolina Gómez', estado: 'confirmada' },
];

export const CalendarioCitas: React.FC<PropiedadesCalendarioCitas> = ({
  contactos,
  conversaciones,
  nombreOptica,
  alSeleccionarContactoChat,
  alEnviarMensajeWhatsApp,
}) => {
  const [citas, setCitas] = useState<Cita[]>([]);
  const [cargando, setCargando] = useState(true);
  const [recargando, setRecargando] = useState(false);

  // Fecha actual de navegación del calendario
  const [fechaReferencia, setFechaReferencia] = useState(() => new Date());

  // Modo de visualización: 'mes' (grilla mensual), 'dia' (zoom diario detallado), 'agenda' (lista cronológica)
  const [modoVista, setModoVista] = useState<'mes' | 'dia' | 'agenda'>('mes');
  const [diaZoom, setDiaZoom] = useState<string>(() => {
    const hoy = new Date();
    return hoy.toISOString().split('T')[0];
  });

  // Filtros
  const [filtroEspecialista, setFiltroEspecialista] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [terminoBusqueda, setTerminoBusqueda] = useState<string>('');
  // Filtro tipo calendario interactivo para la vista Agenda (sincronizado con el mes del calendario)
  const [filtroPeriodoAgenda, setFiltroPeriodoAgenda] = useState<FiltroPeriodoAgenda>(() => {
    const ano = fechaReferencia.getFullYear();
    const mes = fechaReferencia.getMonth();
    return {
      tipo: 'mes_especifico',
      ano,
      mes,
      etiqueta: `${MESES[mes]} ${ano}`,
    };
  });

  // Modales
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false);
  const [fechaPreCrear, setFechaPreCrear] = useState<string | undefined>(undefined);
  const [modalReprogramarAbierto, setModalReprogramarAbierto] = useState(false);
  const [citaParaReprogramar, setCitaParaReprogramar] = useState<Cita | null>(null);
  const [citaParaCancelar, setCitaParaCancelar] = useState<Cita | null>(null);

  // Paginación de la vista Agenda (por defecto 5 registros)
  const [limiteAgenda, setLimiteAgenda] = useState<number>(5);
  const [paginaAgenda, setPaginaAgenda] = useState<number>(1);
  const [simulando25Citas, setSimulando25Citas] = useState(false);

  // Cargar citas desde el backend
  const cargarCitas = async () => {
    setCargando(true);
    try {
      const lista = await obtenerCitas();
      setCitas(lista);
    } catch (error) {
      console.error('Error al cargar citas:', error);
    } finally {
      setCargando(false);
      setRecargando(false);
    }
  };

  useEffect(() => {
    cargarCitas();
  }, []);

  const refrescar = () => {
    setRecargando(true);
    cargarCitas();
  };

  // Alternar simulación de 25 registros para evaluar la tabla de agenda
  const alternarSimulacion25 = () => {
    if (!simulando25Citas) {
      setCitas(CITAS_SIMULADAS_25);
      setSimulando25Citas(true);
      setModoVista('agenda');
      setFiltroEstado('todos');
      setFiltroEspecialista('todos');
      setTerminoBusqueda('');
      setPaginaAgenda(1);
    } else {
      cargarCitas();
      setSimulando25Citas(false);
      setPaginaAgenda(1);
    }
  };


  // Especialistas únicos extraídos de las citas existentes
  const listaEspecialistas = useMemo(() => {
    const setEsp = new Set<string>();
    citas.forEach((c) => {
      if (c.especialista && c.especialista.trim()) {
        setEsp.add(c.especialista.trim());
      }
    });
    return Array.from(setEsp);
  }, [citas]);

  // Lista dinámica de especialistas para asignar o reasignar citas
  const opcionesDoctoresReasignar = useMemo(() => {
    const nombres = new Set<string>();
    // Agregar especialistas registrados en citas existentes
    listaEspecialistas.forEach((esp) => {
      if (esp && esp.trim() && esp.toLowerCase() !== 'sin especialista') {
        nombres.add(esp.trim());
      }
    });
    // Base clínica predeterminada si aún no hay citas con médicos asignados
    if (nombres.size === 0) {
      nombres.add('Dr. Samir Bolívar');
      nombres.add('Dr. Juan Vargas');
      nombres.add('Dra. Laura Gómez');
    }
    const lista = Array.from(nombres).map((n) => ({ valor: n, etiqueta: n }));
    lista.push({ valor: 'Sin Especialista', etiqueta: 'Sin especialista' });
    return lista;
  }, [listaEspecialistas]);

  // Citas filtradas
  const citasFiltradas = useMemo(() => {
    return citas.filter((c) => {
      // Filtro de especialista
      if (filtroEspecialista === 'sin_asignar') {
        if (c.especialista && c.especialista.trim() && c.especialista.toLowerCase() !== 'sin especialista') {
          return false;
        }
      } else if (filtroEspecialista !== 'todos') {
        if (c.especialista !== filtroEspecialista) return false;
      }

      // Filtro de estado
      if (filtroEstado !== 'todos' && c.estado !== filtroEstado) {
        return false;
      }

      // Filtro de búsqueda textual
      if (terminoBusqueda.trim()) {
        const busq = terminoBusqueda.toLowerCase();
        const coincidePaciente = c.contacto_nombre?.toLowerCase().includes(busq);
        const coincideTelefono = c.contacto_telefono?.includes(busq);
        const coincideMotivo = c.motivo?.toLowerCase().includes(busq);
        const coincideEsp = c.especialista?.toLowerCase().includes(busq);
        if (!coincidePaciente && !coincideTelefono && !coincideMotivo && !coincideEsp) {
          return false;
        }
      }

      return true;
    });
  }, [citas, filtroEspecialista, filtroEstado, terminoBusqueda]);

  // Opciones de filas por página para la agenda
  const opcionesLimiteAgenda = useMemo(
    () => [
      { valor: '5', etiqueta: '5 registros (Predeterminado)' },
      { valor: '10', etiqueta: '10 registros' },
      { valor: '20', etiqueta: '20 registros' },
      { valor: '50', etiqueta: '50 registros' },
    ],
    []
  );

  // Citas exclusivas para la vista Agenda (filtradas por especialista, estado, búsqueda y período tipo calendario)
  const citasFiltradasAgenda = useMemo(() => {
    const filtradas = citasFiltradas.filter((c) => {
      return evaluarCoincidenciaPeriodo(c.fecha_cita, filtroPeriodoAgenda);
    });
    return filtradas.sort((a, b) => {
      const fA = `${a.fecha_cita || ''} ${a.hora_cita || ''}`;
      const fB = `${b.fecha_cita || ''} ${b.hora_cita || ''}`;
      return fA.localeCompare(fB);
    });
  }, [citasFiltradas, filtroPeriodoAgenda]);

  // Cálculos de paginación en vista Agenda
  const totalRegistrosAgenda = citasFiltradasAgenda.length;
  const totalPaginasAgenda = Math.max(1, Math.ceil(totalRegistrosAgenda / limiteAgenda));
  const indiceInicioAgenda = (paginaAgenda - 1) * limiteAgenda;
  const citasPaginadasAgenda = useMemo(() => {
    return citasFiltradasAgenda.slice(indiceInicioAgenda, indiceInicioAgenda + limiteAgenda);
  }, [citasFiltradasAgenda, indiceInicioAgenda, limiteAgenda]);

  // Reiniciar a la primera página si cambian filtros o búsqueda en la agenda
  useEffect(() => {
    setPaginaAgenda(1);
  }, [filtroEspecialista, filtroEstado, terminoBusqueda, filtroPeriodoAgenda]);

  // Mapa de citas por fecha (YYYY-MM-DD)
  const citasPorFecha = useMemo(() => {
    const mapa = new Map<string, Cita[]>();
    citasFiltradas.forEach((c) => {
      if (!c.fecha_cita) return;
      const f = c.fecha_cita.trim();
      const actual = mapa.get(f) || [];
      actual.push(c);
      mapa.set(f, actual);
    });
    return mapa;
  }, [citasFiltradas]);

  // Métricas y KPIs
  const hoyStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const kpis = useMemo(() => {
    const hoyTotal = citas.filter((c) => c.fecha_cita === hoyStr && c.estado !== 'cancelada').length;
    const mesActual = fechaReferencia.getMonth();
    const anoActual = fechaReferencia.getFullYear();
    const mesTotal = citas.filter((c) => {
      if (!c.fecha_cita) return false;
      const partes = c.fecha_cita.split('-');
      if (partes.length < 2) return false;
      return Number(partes[0]) === anoActual && Number(partes[1]) === mesActual + 1 && c.estado !== 'cancelada';
    }).length;

    const pendientes = citas.filter((c) => c.estado === 'pendiente').length;
    const sinDoctor = citas.filter((c) => !c.especialista || c.especialista.trim() === '' || c.especialista.toLowerCase() === 'sin especialista').length;

    return { hoyTotal, mesTotal, pendientes, sinDoctor };
  }, [citas, hoyStr, fechaReferencia]);

  // Navegación de mes / día
  const irMesAnterior = () => {
    setFechaReferencia((prev) => {
      const nueva = new Date(prev);
      nueva.setMonth(nueva.getMonth() - 1);
      return nueva;
    });
  };

  const irMesSiguiente = () => {
    setFechaReferencia((prev) => {
      const nueva = new Date(prev);
      nueva.setMonth(nueva.getMonth() + 1);
      return nueva;
    });
  };

  const irHoy = () => {
    const hoy = new Date();
    setFechaReferencia(hoy);
    setDiaZoom(hoy.toISOString().split('T')[0]);
  };

  // Cálculo de los días del mes para la grilla
  const diasGrillaMes = useMemo(() => {
    const ano = fechaReferencia.getFullYear();
    const mes = fechaReferencia.getMonth();

    const primerDiaMes = new Date(ano, mes, 1);
    const ultimoDiaMes = new Date(ano, mes + 1, 0);

    // En Javascript 0 = Domingo, 1 = Lunes. Queremos empezar en Lunes (0)
    let diaInicioSemana = primerDiaMes.getDay() - 1;
    if (diaInicioSemana === -1) diaInicioSemana = 6;

    const totalDias = ultimoDiaMes.getDate();

    const dias = [];

    // Días del mes anterior para rellenar
    const mesAnteriorUltimoDia = new Date(ano, mes, 0).getDate();
    for (let i = diaInicioSemana - 1; i >= 0; i--) {
      const diaNum = mesAnteriorUltimoDia - i;
      const mesAnt = mes === 0 ? 11 : mes - 1;
      const anoAnt = mes === 0 ? ano - 1 : ano;
      const fechaIso = `${anoAnt}-${String(mesAnt + 1).padStart(2, '0')}-${String(diaNum).padStart(2, '0')}`;
      dias.push({
        numero: diaNum,
        fechaIso,
        esMesActual: false,
        esHoy: fechaIso === hoyStr,
      });
    }

    // Días del mes actual
    for (let i = 1; i <= totalDias; i++) {
      const fechaIso = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      dias.push({
        numero: i,
        fechaIso,
        esMesActual: true,
        esHoy: fechaIso === hoyStr,
      });
    }

    // Días del mes siguiente para completar múltiplos de 7
    const diasRestantes = (7 - (dias.length % 7)) % 7;
    for (let i = 1; i <= diasRestantes; i++) {
      const mesSig = mes === 11 ? 0 : mes + 1;
      const anoSig = mes === 11 ? ano + 1 : ano;
      const fechaIso = `${anoSig}-${String(mesSig + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      dias.push({
        numero: i,
        fechaIso,
        esMesActual: false,
        esHoy: fechaIso === hoyStr,
      });
    }

    return dias;
  }, [fechaReferencia, hoyStr]);

  // Manejar apertura de Zoom Diario
  const hacerZoomDia = (fechaIso: string) => {
    setDiaZoom(fechaIso);
    setModoVista('dia');
  };

  // Manejar agendar nueva cita desde el calendario
  const manejarGuardarNuevaCita = async (datos: DatosNuevaCita) => {
    const res = await registrarCita({
      contacto_id: datos.contacto_id,
      fecha_cita: datos.fecha_cita,
      hora_cita: datos.hora_cita,
      motivo: datos.motivo,
      especialista: datos.especialista,
      observaciones: datos.observaciones,
    });

    if (res.exito) {
      await cargarCitas();
      setModalCrearAbierto(false);

      // Notificación de WhatsApp si se activó
      if (datos.enviar_confirmacion_whatsapp && alEnviarMensajeWhatsApp) {
        const contactoPaciente = contactos.find((c) => String(c.id) === String(datos.contacto_id));
        const conv = conversaciones.find((cv) => Number(cv.contacto_id) === Number(datos.contacto_id)) || null;

        let fechaFormateada = datos.fecha_cita;
        if (datos.fecha_cita && datos.fecha_cita.includes('-')) {
          const partes = datos.fecha_cita.split('-');
          if (partes.length === 3) {
            fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;
          }
        }

        const encabezado = (nombreOptica || 'Óptica').toUpperCase();
        const texto = [
          `🗓️ *${encabezado} - Confirmación de Cita*`,
          `Hola *${contactoPaciente?.nombre || 'Paciente'}*, tu cita de optometría ha sido programada con éxito:`,
          ``,
          `📅 *Fecha:* ${fechaFormateada}`,
          `⏰ *Hora:* ${datos.hora_cita}`,
          `🎯 *Motivo:* ${datos.motivo}`,
          `👨‍⚕️ *Especialista:* ${datos.especialista || 'Sin especialista'}`,
          ``,
          `📍 Te sugerimos presentarte 10 minutos antes. Si necesitas reprogramar, responde directamente a este chat.`,
        ].join('\n');

        await alEnviarMensajeWhatsApp(texto, conv);
      }
      return { exito: true };
    } else {
      return {
        exito: false,
        error: res.error || 'Este paciente para ese día a esa hora ya tiene una cita asignada.',
      };
    }
  };

  // Manejar reprogramación
  const manejarGuardarReprogramacion = async (datos: DatosReprogramarCita) => {
    // Si la cita ya está completada, no permitir reprogramación
    const citaActual = citas.find((c) => c.id === datos.id);
    if (citaActual?.estado === 'completada') {
      return {
        exito: false,
        error: 'Una cita completada no puede ser reprogramada.',
      };
    }

    const res = await actualizarCita(datos.id, {
      fecha_cita: datos.fecha_cita,
      hora_cita: datos.hora_cita,
      motivo: datos.motivo,
      especialista: datos.especialista,
      observaciones: datos.observaciones,
      estado: datos.estado,
    });

    if (res.exito) {
      await cargarCitas();
      setModalReprogramarAbierto(false);
      setCitaParaReprogramar(null);

      // Notificación opcional por WhatsApp de la reprogramación
      if (datos.enviar_notificacion_whatsapp && alEnviarMensajeWhatsApp && citaParaReprogramar) {
        const conv = conversaciones.find((cv) => Number(cv.contacto_id) === Number(citaParaReprogramar.contacto_id)) || null;

        let fechaFormateada = datos.fecha_cita;
        if (datos.fecha_cita && datos.fecha_cita.includes('-')) {
          const partes = datos.fecha_cita.split('-');
          if (partes.length === 3) {
            fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;
          }
        }

        const encabezado = (nombreOptica || 'Óptica').toUpperCase();
        const texto = [
          `🗓️ *${encabezado} - Cita Reprogramada*`,
          `Hola *${citaParaReprogramar.contacto_nombre || 'Paciente'}*, te confirmamos que tu cita ha sido reprogramada:`,
          ``,
          `📅 *Nueva Fecha:* ${fechaFormateada}`,
          `⏰ *Nueva Hora:* ${datos.hora_cita}`,
          `🎯 *Motivo:* ${datos.motivo || citaParaReprogramar.motivo}`,
          `👨‍⚕️ *Especialista:* ${datos.especialista || citaParaReprogramar.especialista}`,
          ``,
          `📍 Recuerda presentarte 10 minutos antes. Si necesitas alguna modificación, respóndenos directamente a este chat.`,
        ].join('\n');

        await alEnviarMensajeWhatsApp(texto, conv);
      }

      return { exito: true };
    } else {
      return {
        exito: false,
        error: res.error || 'Este paciente para ese día a esa hora ya tiene una cita asignada.',
      };
    }
  };

  // Cambio rápido de estado in-situ con actualización optimista inmediata
  const manejarCambiarEstadoRapido = async (citaId: number, nuevoEstado: EstadoCita) => {
    // Si la cita ya está completada, bloquear cualquier cambio de estado
    const citaActual = citas.find((c) => c.id === citaId);
    if (citaActual?.estado === 'completada') {
      return;
    }

    const estadoPrevio = citaActual?.estado || 'pendiente';

    // 1. Actualización optimista inmediata en el estado de React (feedback instantáneo)
    setCitas((prev) =>
      prev.map((c) => (c.id === citaId ? { ...c, estado: nuevoEstado } : c))
    );

    // 2. Si es cita de prueba simulada (id >= 900 o simulando25Citas), omitir llamada a backend
    if (simulando25Citas || citaId >= 900) {
      return;
    }

    // 3. Persistir en backend para citas reales de la base de datos
    try {
      const res = await actualizarCita(citaId, { estado: nuevoEstado });
      if (!res.exito) {
        console.error('Error al actualizar estado en backend:', res.error);
        // Revertir si el backend devolvió error
        setCitas((prev) =>
          prev.map((c) => (c.id === citaId ? { ...c, estado: estadoPrevio } : c))
        );
      }
    } catch (e) {
      console.error('Error al actualizar estado:', e);
      setCitas((prev) =>
        prev.map((c) => (c.id === citaId ? { ...c, estado: estadoPrevio } : c))
      );
    }
  };

  // Reasignar especialista in-situ rápido
  const manejarReasignarEspecialistaRapido = async (citaId: number, nuevoEspecialista: string) => {
    // Si la cita ya está completada, bloquear cualquier cambio de especialista
    const citaActual = citas.find((c) => c.id === citaId);
    if (citaActual?.estado === 'completada') {
      return;
    }

    try {
      const res = await actualizarCita(citaId, { especialista: nuevoEspecialista });
      if (res.exito) {
        setCitas((prev) =>
          prev.map((c) => (c.id === citaId ? { ...c, especialista: nuevoEspecialista } : c))
        );
      }
    } catch (e) {
      console.error('Error al reasignar especialista:', e);
    }
  };

  // Cancelar cita con confirmación mediante modal corporativo
  const manejarConfirmarCancelarCita = async (citaId: number) => {
    const citaActual = citas.find((c) => c.id === citaId);
    if (citaActual?.estado === 'completada') {
      return;
    }

    try {
      const res = await cancelarCita(citaId);
      if (res.exito) {
        setCitas((prev) =>
          prev.map((c) => (c.id === citaId ? { ...c, estado: 'cancelada' } : c))
        );
      }
    } catch (e) {
      console.error('Error al cancelar cita:', e);
    }
  };

  // Helper para badge de estado
  const renderBadgeEstado = (estado: EstadoCita) => {
    switch (estado) {
      case 'confirmada':
        return (
          <span className="badge-cita confirmada">
            <CheckCircle2 size={11} /> Confirmada
          </span>
        );
      case 'completada':
        return (
          <span className="badge-cita completada">
            <CheckCircle2 size={11} /> Completada
          </span>
        );
      case 'cancelada':
        return (
          <span className="badge-cita cancelada">
            <XCircle size={11} /> Cancelada
          </span>
        );
      case 'pendiente':
      default:
        return (
          <span className="badge-cita pendiente">
            <Clock4 size={11} /> Pendiente
          </span>
        );
    }
  };

  // Fecha legible para el Zoom Diario
  const fechaZoomLegible = useMemo(() => {
    if (!diaZoom) return '';
    const [y, m, d] = diaZoom.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [diaZoom]);

  const citasDelDiaZoom = useMemo(() => {
    return citasPorFecha.get(diaZoom) || [];
  }, [citasPorFecha, diaZoom]);

  return (
    <div className="calendario-contenedor-principal modo-scroll">
      {/* 1. Indicadores KPI Tradicionales y Completos (Opción 2) */}
      <div className="calendario-kpis-fila">
        <div className="calendario-kpi-tarjeta">
          <div className="kpi-icono-caja primario">
            <IconoCalendario size={18} />
          </div>
          <div className="kpi-datos">
            <span className="kpi-etiqueta">Citas de Hoy</span>
            <div className="kpi-valor-fila">
              <span className="kpi-valor">{kpis.hoyTotal}</span>
              <span className="kpi-badge activo">Hoy</span>
            </div>
          </div>
        </div>

        <div className="calendario-kpi-tarjeta">
          <div className="kpi-icono-caja info">
            <CalendarDays size={18} />
          </div>
          <div className="kpi-datos">
            <span className="kpi-etiqueta">Citas de {MESES[fechaReferencia.getMonth()]}</span>
            <div className="kpi-valor-fila">
              <span className="kpi-valor">{kpis.mesTotal}</span>
              <span className="kpi-subtexto">programadas</span>
            </div>
          </div>
        </div>

        <div
          className={`calendario-kpi-tarjeta ${filtroEstado === 'pendiente' ? 'activa' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => setFiltroEstado(filtroEstado === 'pendiente' ? 'todos' : 'pendiente')}
        >
          <div className="kpi-icono-caja alerta">
            <Clock size={18} />
          </div>
          <div className="kpi-datos">
            <span className="kpi-etiqueta">Pendientes de Confirmar</span>
            <div className="kpi-valor-fila">
              <span className="kpi-valor">{kpis.pendientes}</span>
              <span className="kpi-badge alerta">{kpis.pendientes > 0 ? 'Por revisar' : 'Al día'}</span>
            </div>
          </div>
        </div>

        <div
          className={`calendario-kpi-tarjeta ${filtroEspecialista === 'sin_asignar' ? 'activa' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => setFiltroEspecialista(filtroEspecialista === 'sin_asignar' ? 'todos' : 'sin_asignar')}
        >
          <div className="kpi-icono-caja advertencia">
            <UserX size={18} />
          </div>
          <div className="kpi-datos">
            <span className="kpi-etiqueta">Sin Doctor Asignado</span>
            <div className="kpi-valor-fila">
              <span className="kpi-valor">{kpis.sinDoctor}</span>
              {kpis.sinDoctor > 0 ? (
                <span className="kpi-badge error">Requiere asignación</span>
              ) : (
                <span className="kpi-badge activo">Cubiertos</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Barra de Herramientas y Filtros (En una sola línea integrada) */}
      <div className="calendario-barra-herramientas">
        {/* 1. Navegación de Fecha: Flechas y Mes en Calendario / Selector Tipo Calendario en Agenda */}
        {modoVista === 'agenda' ? (
          <div className="calendario-filtro-periodo-agenda">
            <SelectorPeriodoAgenda
              filtro={filtroPeriodoAgenda}
              alCambiarFiltro={(nuevo) => setFiltroPeriodoAgenda(nuevo)}
              citas={citas}
            />
          </div>
        ) : (
          <div className="calendario-controles-fecha">
            <div className="calendario-flechas-grupo">
              <EtiquetaTooltip texto="Mes anterior" posicion="abajo">
                <button
                  type="button"
                  className="calendario-btn-nav"
                  onClick={irMesAnterior}
                  aria-label="Mes anterior"
                >
                  <ChevronLeft size={16} />
                </button>
              </EtiquetaTooltip>
              <EtiquetaTooltip texto="Mes siguiente" posicion="abajo">
                <button
                  type="button"
                  className="calendario-btn-nav"
                  onClick={irMesSiguiente}
                  aria-label="Mes siguiente"
                >
                  <ChevronRight size={16} />
                </button>
              </EtiquetaTooltip>
            </div>

            <h2 className="calendario-titulo-mes">
              {MESES[fechaReferencia.getMonth()]} <span>{fechaReferencia.getFullYear()}</span>
            </h2>
          </div>
        )}

        {/* 2. Conmutador de Vistas: Calendario / Agenda */}
        <div className="calendario-conmutador-vistas">
          <button
            type="button"
            className={`conmutador-btn ${modoVista === 'mes' || modoVista === 'dia' ? 'activo' : ''}`}
            onClick={() => setModoVista('mes')}
          >
            Calendario
          </button>
          <button
            type="button"
            className={`conmutador-btn ${modoVista === 'agenda' ? 'activo' : ''}`}
            onClick={() => {
              const ano = fechaReferencia.getFullYear();
              const mes = fechaReferencia.getMonth();
              setFiltroPeriodoAgenda({
                tipo: 'mes_especifico',
                ano,
                mes,
                etiqueta: `${MESES[mes]} ${ano}`,
              });
              setModoVista('agenda');
              setPaginaAgenda(1);
            }}
          >
            Agenda
          </button>
        </div>

        {/* 3. Filtros: Buscador de Texto y Selectores Desplegables */}
        <div className="calendario-filtros-grupo">
          {/* Buscador de Paciente / Motivo */}
          <div className="calendario-buscador">
            <Search size={14} className="icono-busqueda" />
            <input
              type="text"
              placeholder="Buscar paciente..."
              value={terminoBusqueda}
              onChange={(e) => setTerminoBusqueda(e.target.value)}
              className="calendario-input-busqueda"
            />
            {terminoBusqueda && (
              <button
                type="button"
                className="btn-limpiar-busqueda"
                onClick={() => setTerminoBusqueda('')}
              >
                ×
              </button>
            )}
          </div>

          {/* Filtro de Especialista */}
          <div style={{ minWidth: '150px', flex: '0 0 auto' }}>
            <SelectorDesplegable
              valor={filtroEspecialista}
              alCambiar={(val) => setFiltroEspecialista(val)}
              opciones={[
                { valor: 'todos', etiqueta: 'Todos los especialistas' },
                { valor: 'sin_asignar', etiqueta: 'Sin especialista' },
                ...listaEspecialistas.map((esp) => ({ valor: esp, etiqueta: esp })),
              ]}
              tamano="compacto"
              placeholder="Especialista..."
              anchoMinimo="150px"
            />
          </div>

          {/* Filtro de Estado */}
          <div style={{ minWidth: '160px', flex: '0 0 auto' }}>
            <SelectorDesplegable
              valor={filtroEstado}
              alCambiar={(val) => setFiltroEstado(val)}
              opciones={[
                { valor: 'todos', etiqueta: 'Todos los estados' },
                { valor: 'pendiente', etiqueta: '🟡 Pendientes' },
                { valor: 'confirmada', etiqueta: '🔵 Confirmadas' },
                { valor: 'completada', etiqueta: '🟢 Completadas' },
                { valor: 'cancelada', etiqueta: '🔴 Canceladas' },
              ]}
              tamano="compacto"
              placeholder="Estado..."
              anchoMinimo="160px"
            />
          </div>
        </div>

        {/* Botón Temporal: Probar 25 registros en la tabla agenda (Solo Icono) */}
        <EtiquetaTooltip
          texto={simulando25Citas ? 'Quitar simulación de 25 citas' : 'Probar simulación de 25 citas'}
          posicion="abajo"
        >
          <button
            type="button"
            onClick={alternarSimulacion25}
            style={{
              width: '32px',
              height: '32px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radio-sm)',
              background: simulando25Citas ? 'rgba(16, 185, 129, 0.15)' : 'rgba(2, 132, 199, 0.1)',
              border: `1px solid ${simulando25Citas ? '#10b981' : 'var(--color-primario)'}`,
              color: simulando25Citas ? '#059669' : 'var(--color-primario)',
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              flexShrink: 0,
            }}
            aria-label={simulando25Citas ? 'Quitar simulación de 25 citas' : 'Probar 25 citas'}
          >
            {simulando25Citas ? <CheckCircle2 size={16} /> : <CalendarClock size={16} />}
          </button>
        </EtiquetaTooltip>

        {/* 4. Botón Principal Nueva Cita (Ubicado de último a la derecha) */}
        <button
          type="button"
          className="btn-nueva-cita-principal"
          onClick={() => {
            setFechaPreCrear(undefined);
            setModalCrearAbierto(true);
          }}
        >
          <Plus size={15} />
          <span>Nueva Cita</span>
        </button>
      </div>

      {/* 3. Contenido Principal según el Modo de Vista */}
      <div className="calendario-cuerpo-vista">
        {cargando ? (
          <div className="calendario-estado-cargando">
            <div className="login-spinner" style={{ width: '28px', height: '28px' }} />
            <span>Cargando agenda de citas...</span>
          </div>
        ) : modoVista === 'mes' ? (
          /* ==========================================================================
             VISTA 1: GRILLA MENSUAL INTERACTIVA
             ========================================================================== */
          <div className="calendario-grilla-mes">
            {/* Cabecera de días de la semana */}
            <div className="calendario-semana-dias-cabecera">
              {DIAS_SEMANA.map((dia, idx) => (
                <div key={idx} className="calendario-dia-nombre-col">
                  {dia}
                </div>
              ))}
            </div>

            {/* Celdas de días */}
            <div className="calendario-dias-celdas">
              {diasGrillaMes.map((dia, idx) => {
                const citasDia = citasPorFecha.get(dia.fechaIso) || [];
                const tieneCitas = citasDia.length > 0;
                const maxCitasVisibles = 2;
                const citasVisibles = citasDia.slice(0, maxCitasVisibles);
                const restantes = citasDia.length - maxCitasVisibles;
                const citasRestantes = citasDia.slice(maxCitasVisibles);

                return (
                  <div
                    key={idx}
                    className={`calendario-dia-celda ${!dia.esMesActual ? 'otro-mes' : ''} ${
                      dia.esHoy ? 'hoy' : ''
                    } ${dia.fechaIso === diaZoom ? 'seleccionado' : ''}`}
                    onClick={() => {
                      if (tieneCitas) {
                        hacerZoomDia(dia.fechaIso);
                      }
                    }}
                  >
                    {/* Cabecera del día (Número + Botón rápido de agregar) */}
                    <div className="dia-celda-cabecera">
                      <span className={`dia-numero ${dia.esHoy ? 'hoy-numero' : ''}`}>
                        {dia.numero}
                      </span>

                      {dia.esHoy && <span className="dia-etiqueta-hoy">Hoy</span>}

                      {/* Botón flotante para agendar directamente en este día */}
                      <EtiquetaTooltip texto={`Agendar cita el ${dia.numero}`} posicion="arriba">
                        <button
                          type="button"
                          className="dia-btn-anadir-rapido"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFechaPreCrear(dia.fechaIso);
                            setModalCrearAbierto(true);
                          }}
                        >
                          <Plus size={12} />
                        </button>
                      </EtiquetaTooltip>
                    </div>

                    {/* Lista de citas en el día */}
                    <div className="dia-citas-lista">
                      {citasVisibles.map((cita) => {
                        const esSinDoc = !cita.especialista || cita.especialista.trim() === '' || cita.especialista.toLowerCase() === 'sin especialista';

                        return (
                          <EtiquetaTooltip
                            key={cita.id}
                            posicion="arriba"
                            texto={
                              <div className="tooltip-cita-tarjeta">
                                <div className="tooltip-cita-fila-titulo">
                                  <span className="tooltip-cita-hora">{cita.hora_cita}</span>
                                  <span className="tooltip-cita-paciente">{cita.contacto_nombre || 'Paciente'}</span>
                                </div>
                                {cita.motivo && <div className="tooltip-cita-motivo">{cita.motivo}</div>}
                                <div className="tooltip-cita-pie">
                                  <span className="tooltip-cita-especialista">
                                    {esSinDoc ? '⚠️ Sin doctor asignado' : `👨‍⚕️ ${cita.especialista}`}
                                  </span>
                                  <span className={`badge-cita-mini ${cita.estado}`}>{cita.estado}</span>
                                </div>
                              </div>
                            }
                          >
                            <div
                              className={`pildora-cita-mes ${cita.estado} ${esSinDoc ? 'alerta-doc' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                hacerZoomDia(dia.fechaIso);
                              }}
                            >
                              <span className="pildora-punto-estado" />
                              <span className="pildora-hora">{cita.hora_cita.replace(' ', '')}</span>
                              <span className="pildora-paciente">
                                {cita.contacto_nombre || 'Paciente'}
                              </span>
                              {esSinDoc && <span className="pildora-punto-alerta">!</span>}
                            </div>
                          </EtiquetaTooltip>
                        );
                      })}

                      {/* Botón interactivo "+X más" con EtiquetaTooltip Premium */}
                      {restantes > 0 && (
                        <EtiquetaTooltip texto={`Ver todas las ${citasDia.length} citas de este día`} posicion="arriba">
                          <button
                            type="button"
                            className="dia-btn-ver-mas"
                            onClick={(e) => {
                              e.stopPropagation();
                              hacerZoomDia(dia.fechaIso);
                            }}
                          >
                            +{restantes} más
                          </button>
                        </EtiquetaTooltip>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : modoVista === 'dia' ? (
          /* ==========================================================================
             VISTA 2: ZOOM DIARIO DETALLADO POR HORAS (REQUERIMIENTO PRINCIPAL)
             ========================================================================== */
          <div className="calendario-zoom-dia-contenedor">
            {/* Cabecera del Zoom Diario */}
            <div className="zoom-dia-cabecera">
              <div className="zoom-dia-cabecera-izq">
                <button
                  type="button"
                  className="btn-volver-mes"
                  onClick={() => setModoVista('mes')}
                >
                  <ChevronLeft size={16} />
                  <span>Volver al Mes</span>
                </button>
                <div className="zoom-dia-titulares">
                  <h3 className="zoom-dia-fecha-texto">{fechaZoomLegible}</h3>
                  <span className="zoom-dia-contador-citas">
                    {citasDelDiaZoom.length === 0
                      ? 'Sin citas programadas para este día'
                      : `${citasDelDiaZoom.length} cita${citasDelDiaZoom.length > 1 ? 's' : ''} en agenda`}
                  </span>
                </div>
              </div>

              <div className="zoom-dia-cabecera-der">
                <button
                  type="button"
                  className="btn-primario-modal"
                  style={{ height: '34px', fontSize: '0.80rem' }}
                  onClick={() => {
                    setFechaPreCrear(diaZoom);
                    setModalCrearAbierto(true);
                  }}
                >
                  <Plus size={14} />
                  <span>Agendar en este día</span>
                </button>
              </div>
            </div>

            {/* Listado Detallado de Citas del Día */}
            {citasDelDiaZoom.length === 0 ? (
              <div className="calendario-dia-vacio">
                <div className="dia-vacio-icono">
                  <CalendarClock size={36} />
                </div>
                <h4>No hay citas registradas para este día</h4>
                <p>Aprovecha la disponibilidad de agenda para programar consultas u optometría.</p>
                <button
                  type="button"
                  className="btn-primario-modal"
                  style={{ marginTop: '0.8rem', height: '36px' }}
                  onClick={() => {
                    setFechaPreCrear(diaZoom);
                    setModalCrearAbierto(true);
                  }}
                >
                  <Plus size={14} />
                  <span>Agendar Primera Cita</span>
                </button>
              </div>
            ) : (
              <div className="zoom-dia-tarjetas-grid">
                {citasDelDiaZoom.map((cita) => {
                  const tieneDoctor =
                    cita.especialista &&
                    cita.especialista.trim() !== '' &&
                    cita.especialista.toLowerCase() !== 'sin especialista';

                  return (
                    <div key={cita.id} className={`tarjeta-cita-detalle ${cita.estado}`}>
                      {/* Bloque Superior: Hora, Estado y Menú de Acciones */}
                      <div className="tarjeta-cita-cabecera">
                        <div className="tarjeta-cita-hora-bloque">
                          <Clock size={15} style={{ color: 'var(--color-primario)' }} />
                          <span className="hora-texto">{cita.hora_cita}</span>
                        </div>

                        <div className="tarjeta-cita-badges-grupo">
                          {renderBadgeEstado(cita.estado)}
                        </div>
                      </div>

                      {/* Información del Paciente */}
                      <div className="tarjeta-cita-paciente-bloque">
                        <div className="avatar-paciente-cita">
                          <User size={16} />
                        </div>
                        <div className="datos-paciente-cita">
                          <h4 className="nombre-paciente">
                            {obtenerNombrePaciente(cita)}
                          </h4>
                          <div className="subdatos-paciente">
                            {cita.contacto_telefono && (
                              <span className="telefono-item">
                                <Phone size={12} />
                                {formatearTelefono(cita.contacto_telefono)}
                              </span>
                            )}
                            <span className="id-item">#{cita.contacto_id}</span>
                          </div>
                        </div>
                      </div>

                      {/* Motivo de la Cita */}
                      <div className="tarjeta-cita-campo-motivo">
                        <span className="campo-etiqueta">Motivo de Consulta:</span>
                        <p className="motivo-texto">{cita.motivo || 'Examen visual y control'}</p>
                      </div>

                      {/* Especialista Asignado (Requisito clave: Si no tiene, dejar asignar; si tiene, dejar cambiar; si está completada, solo lectura) */}
                      <div className="tarjeta-cita-especialista-bloque">
                        <span className="campo-etiqueta">Doctor / Optómetra Asignado:</span>
                        <div className="especialista-selector-rapido">
                          {tieneDoctor ? (
                            <div className="especialista-actual-con-badge">
                              <UserCheck size={14} style={{ color: '#10b981' }} />
                              <span className="especialista-nombre">{cita.especialista}</span>
                            </div>
                          ) : (
                            <div className="alerta-sin-doctor-box">
                              <AlertCircle size={14} style={{ color: '#ef4444' }} />
                              <span className="sin-doctor-texto">¡Cita sin doctor asignado!</span>
                            </div>
                          )}

                          {/* Selector rápido in-situ: Oculto si la cita está completada */}
                          {cita.estado !== 'completada' && (
                            <div style={{ minWidth: '160px' }}>
                              <SelectorDesplegable
                                valor={tieneDoctor ? cita.especialista : ''}
                                alCambiar={(nuevoDoctor) =>
                                  manejarReasignarEspecialistaRapido(cita.id, nuevoDoctor)
                                }
                                opciones={opcionesDoctoresReasignar}
                                tamano="compacto"
                                placeholder={tieneDoctor ? 'Cambiar doctor...' : 'Asignar doctor ahora...'}
                                anchoMinimo="160px"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Observaciones si las hay */}
                      {cita.observaciones && (
                        <div className="tarjeta-cita-observaciones">
                          <span className="campo-etiqueta">Observaciones:</span>
                          <p>{cita.observaciones}</p>
                        </div>
                      )}

                      {/* Barra de Acciones Clínicas */}
                      <div className="tarjeta-cita-pie-acciones">
                        {/* Selector Rápido de Estado (Sin opción Cancelar: usar botón dedicado) */}
                        <div style={{ minWidth: '130px' }}>
                          {cita.estado === 'completada' ? (
                            <EtiquetaTooltip texto="Cita completada: estado finalizado y bloqueado" posicion="arriba">
                              <div style={{ display: 'inline-block' }}>
                                <SelectorDesplegable
                                  valor="completada"
                                  alCambiar={() => {}}
                                  opciones={[
                                    { valor: 'completada', etiqueta: '🟢 Completada' },
                                  ]}
                                  tamano="compacto"
                                  deshabilitado={true}
                                  placeholder="Completada"
                                  anchoMinimo="130px"
                                />
                              </div>
                            </EtiquetaTooltip>
                          ) : cita.estado === 'cancelada' ? (
                            <EtiquetaTooltip texto="Cita cancelada: no admite modificaciones directas" posicion="arriba">
                              <div style={{ display: 'inline-block' }}>
                                <SelectorDesplegable
                                  valor="cancelada"
                                  alCambiar={() => {}}
                                  opciones={[
                                    { valor: 'cancelada', etiqueta: '🔴 Cancelada' },
                                  ]}
                                  tamano="compacto"
                                  deshabilitado={true}
                                  placeholder="Cancelada"
                                  anchoMinimo="130px"
                                />
                              </div>
                            </EtiquetaTooltip>
                          ) : (
                            <SelectorDesplegable
                              valor={cita.estado}
                              alCambiar={(nuevoEst) =>
                                manejarCambiarEstadoRapido(cita.id, nuevoEst as EstadoCita)
                              }
                              opciones={[
                                { valor: 'pendiente', etiqueta: '🟡 Pendiente' },
                                { valor: 'confirmada', etiqueta: '🔵 Confirmar' },
                                { valor: 'completada', etiqueta: '🟢 Completar' },
                              ]}
                              tamano="compacto"
                              placeholder="Cambiar estado..."
                              anchoMinimo="130px"
                            />
                          )}
                        </div>

                        <div className="botones-acciones-derecha">
                          {/* Abrir Chat del Paciente */}
                          {alSeleccionarContactoChat && (
                            <EtiquetaTooltip texto="Abrir Chat" posicion="arriba">
                              <button
                                type="button"
                                className="btn-accion-cita chat"
                                onClick={() => alSeleccionarContactoChat(cita.contacto_id)}
                              >
                                <MessageSquare size={14} />
                              </button>
                            </EtiquetaTooltip>
                          )}

                          {/* Botón de Reprogramar (Abre modal de fecha/hora) - Oculto si está completada o cancelada */}
                          {cita.estado !== 'completada' && cita.estado !== 'cancelada' && (
                            <EtiquetaTooltip texto="Reprogramar cita" posicion="arriba">
                              <button
                                type="button"
                                className="btn-accion-cita reprogramar"
                                onClick={() => {
                                  setCitaParaReprogramar(cita);
                                  setModalReprogramarAbierto(true);
                                }}
                              >
                                <CalendarClock size={14} />
                                <span>Reprogramar</span>
                              </button>
                            </EtiquetaTooltip>
                          )}

                          {/* Cancelar Cita - Abre modal corporativo de confirmación */}
                          {cita.estado !== 'cancelada' && cita.estado !== 'completada' && (
                            <EtiquetaTooltip texto="Cancelar cita" posicion="arriba">
                              <button
                                type="button"
                                className="btn-accion-cita cancelar"
                                onClick={() => setCitaParaCancelar(cita)}
                              >
                                <XCircle size={14} />
                              </button>
                            </EtiquetaTooltip>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ==========================================================================
             VISTA 3: AGENDA COMPLETA / LISTA CRONOLÓGICA
             ========================================================================== */
          <div className="calendario-agenda-contenedor">
            {citasFiltradasAgenda.length === 0 ? (
              <div className="calendario-dia-vacio">
                <IconoCalendario size={36} />
                <h4>No se encontraron citas con los filtros aplicados</h4>
                <p>Prueba ajustando los filtros de período, especialista, estado o término de búsqueda.</p>
              </div>
            ) : (
              <div className="tabla-agenda-contenedor">
                <table className="tabla-agenda-citas">
                  <thead>
                    <tr>
                      <th>Fecha & Hora</th>
                      <th>Paciente</th>
                      <th>Motivo</th>
                      <th>Especialista</th>
                      <th>Estado</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {citasPaginadasAgenda.map((cita) => {
                      const tieneDoctor =
                        cita.especialista &&
                        cita.especialista.trim() !== '' &&
                        cita.especialista.toLowerCase() !== 'sin especialista';

                      let fechaFormateada = cita.fecha_cita;
                      if (cita.fecha_cita && cita.fecha_cita.includes('-')) {
                        const partes = cita.fecha_cita.split('-');
                        if (partes.length === 3) {
                          fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;
                        }
                      }

                      return (
                        <tr key={cita.id} className={cita.estado === 'cancelada' ? 'fila-cancelada' : ''}>
                          <td>
                            <div className="agenda-td-fecha">
                              <span className="fecha-val">{fechaFormateada}</span>
                              <span className="hora-val">{cita.hora_cita}</span>
                            </div>
                          </td>
                          <td>
                            <div className="agenda-td-paciente">
                              <strong>{cita.contacto_nombre || 'Sin nombre'}</strong>
                              {cita.contacto_telefono && (
                                <span className="tel">{formatearTelefono(cita.contacto_telefono)}</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className="agenda-td-motivo">{cita.motivo}</span>
                          </td>
                          <td>
                            {tieneDoctor ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.80rem' }}>
                                <UserCheck size={13} style={{ color: '#10b981' }} />
                                <span>{cita.especialista}</span>
                              </div>
                            ) : (
                              <span className="badge-aviso-rojo">⚠️ Sin Asignar</span>
                            )}
                          </td>
                          <td>
                            <BadgeEstadoInteractivo
                              citaId={cita.id}
                              estado={cita.estado}
                              alCambiarEstado={manejarCambiarEstadoRapido}
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                              {/* Botón Reprogramar: Solo icono en la tabla de la agenda */}
                              {cita.estado !== 'completada' && cita.estado !== 'cancelada' && (
                                <EtiquetaTooltip texto="Reprogramar cita" posicion="arriba">
                                  <button
                                    type="button"
                                    className="btn-accion-cita reprogramar"
                                    style={{ padding: '0.35rem' }}
                                    onClick={() => {
                                      setCitaParaReprogramar(cita);
                                      setModalReprogramarAbierto(true);
                                    }}
                                  >
                                    <CalendarClock size={13} />
                                  </button>
                                </EtiquetaTooltip>
                              )}

                              {/* Cancelar Cita - Abre modal corporativo de confirmación */}
                              {cita.estado !== 'cancelada' && cita.estado !== 'completada' && (
                                <EtiquetaTooltip texto="Cancelar cita" posicion="arriba">
                                  <button
                                    type="button"
                                    className="btn-accion-cita cancelar"
                                    style={{ padding: '0.35rem' }}
                                    onClick={() => setCitaParaCancelar(cita)}
                                  >
                                    <XCircle size={13} />
                                  </button>
                                </EtiquetaTooltip>
                              )}

                              {alSeleccionarContactoChat && (
                                <EtiquetaTooltip texto="Abrir chat" posicion="arriba">
                                  <button
                                    type="button"
                                    className="btn-accion-cita chat"
                                    style={{ padding: '0.35rem' }}
                                    onClick={() => alSeleccionarContactoChat(cita.contacto_id)}
                                  >
                                    <MessageSquare size={13} />
                                  </button>
                                </EtiquetaTooltip>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Barra de Paginación Corporativa de la Agenda */}
                <div className="tabla-agenda-paginacion-barra">
                  <div className="agenda-paginacion-info-grupo">
                    <span className="agenda-paginacion-resumen">
                      Mostrando <strong>{citasPaginadasAgenda.length}</strong> de <strong>{totalRegistrosAgenda}</strong> registros
                    </span>

                    <div className="agenda-paginacion-selector-grupo">
                      <span className="agenda-paginacion-etiqueta-ver">Ver por página:</span>
                      <SelectorDesplegable
                        valor={String(limiteAgenda)}
                        alCambiar={(val) => {
                          setLimiteAgenda(Number(val));
                          setPaginaAgenda(1);
                        }}
                        opciones={opcionesLimiteAgenda}
                        tamano="compacto"
                        direccion="arriba"
                        anchoMinimo="200px"
                      />
                    </div>
                  </div>

                  <div className="agenda-paginacion-botones-grupo">
                    <button
                      type="button"
                      className="agenda-btn-paginacion-nav"
                      disabled={paginaAgenda <= 1}
                      onClick={() => setPaginaAgenda((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={15} />
                      <span>Anterior</span>
                    </button>

                    <span className="agenda-paginacion-pagina-texto">
                      Página <strong>{paginaAgenda}</strong> de <strong>{totalPaginasAgenda}</strong>
                    </span>

                    <button
                      type="button"
                      className="agenda-btn-paginacion-nav"
                      disabled={paginaAgenda >= totalPaginasAgenda}
                      onClick={() => setPaginaAgenda((p) => Math.min(totalPaginasAgenda, p + 1))}
                    >
                      <span>Siguiente</span>
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal para Agendar Nueva Cita (Reutilizado y versátil) */}
      <ModalAgendarCita
        abierto={modalCrearAbierto}
        contacto={null}
        contactosDisponibles={contactos}
        fechaPreseleccionada={fechaPreCrear}
        alCerrar={() => {
          setModalCrearAbierto(false);
          setFechaPreCrear(undefined);
        }}
        alGuardarCita={manejarGuardarNuevaCita}
      />

      {/* Modal para Reprogramar / Editar Cita Existente */}
      <ModalReprogramarCita
        abierto={modalReprogramarAbierto}
        cita={citaParaReprogramar}
        alCerrar={() => {
          setModalReprogramarAbierto(false);
          setCitaParaReprogramar(null);
        }}
        alGuardar={manejarGuardarReprogramacion}
      />

      {/* Modal Corporativo para Confirmar Cancelación de Cita */}
      <ModalConfirmarCancelarCita
        abierto={Boolean(citaParaCancelar)}
        cita={citaParaCancelar}
        alCerrar={() => setCitaParaCancelar(null)}
        alConfirmar={manejarConfirmarCancelarCita}
      />
    </div>
  );
};
