'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Save,
  Check,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Clock,
  User,
  IdCard,
  FileText,
  AlertCircle,
  Glasses,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';
import { SelectorDesplegable } from '../comunes/SelectorDesplegable';
import type { Contacto, FormulaOptica, HistoriaClinicaOptometrica, TratamientoLente, Optica } from '@/tipos/crm';
import {
  obtenerOpticaSesion,
  obtenerTratamientosLentesApi,
  crearTratamientoLenteApi,
  registrarHistoriaClinica,
  actualizarHistoriaClinica,
  obtenerEstadoCanalesApi,
} from '@/servicios/api_crm';
import {
  formatearTelefono,
  obtenerNombrePaciente,
  formatearDistanciaPupilar,
  formatearNombreEspecialista,
} from '@/utilidades/formato';

// Helpers de normalización optométrica para el Paso 2 (Fórmula)
const formatearEsfera = (valorEntrada: string): string => {
  const texto = valorEntrada.trim();
  if (!texto) return '+0.00';
  if (/^(neutro|plano|pl)$/i.test(texto)) return 'Neutro';
  const esNegativo = texto.startsWith('-');
  const limpio = texto.replace(/^[+-]/, '').trim().replace(',', '.');
  if (limpio === '' || limpio === '0') return esNegativo ? '-0.00' : '+0.00';
  let numero = parseFloat(limpio);
  if (isNaN(numero)) return '+0.00';
  if (!limpio.includes('.') && numero >= 25) numero = numero / 100;
  const signo = esNegativo ? '-' : '+';
  return `${signo}${numero.toFixed(2)}`;
};

const formatearCilindro = (valorEntrada: string): string => {
  const texto = valorEntrada.trim();
  if (!texto || /^(neutro|plano|pl)$/i.test(texto)) return '-0.00';
  const esPositivo = texto.startsWith('+');
  const limpio = texto.replace(/^[+-]/, '').trim().replace(',', '.');
  if (limpio === '' || limpio === '0') return '-0.00';
  let numero = parseFloat(limpio);
  if (isNaN(numero)) return '-0.00';
  if (!limpio.includes('.') && numero >= 25) numero = numero / 100;
  const signo = esPositivo ? '+' : '-';
  return `${signo}${numero.toFixed(2)}`;
};

const formatearEje = (valorEntrada: string): string => {
  const texto = valorEntrada.trim();
  if (!texto) return '0°';
  const soloDigitos = texto.replace(/[^\d]/g, '');
  if (!soloDigitos) return '0°';
  let angulo = parseInt(soloDigitos, 10);
  if (isNaN(angulo)) return '0°';
  if (angulo > 180) angulo = 180;
  if (angulo < 0) angulo = 0;
  return `${angulo}°`;
};

const formatearAdicion = (valorEntrada: string): string => {
  const texto = valorEntrada.trim();
  if (!texto) return '+0.00';
  const limpio = texto.replace(/^[+-]/, '').trim().replace(',', '.');
  if (limpio === '' || limpio === '0') return '+0.00';
  let numero = parseFloat(limpio);
  if (isNaN(numero)) return '+0.00';
  if (!limpio.includes('.') && numero >= 25) numero = numero / 100;
  return `+${numero.toFixed(2)}`;
};

// Formateo de Agudeza Visual: solo permite dígitos y /
const formatearAV = (valorEntrada: string): string => {
  const texto = valorEntrada.trim();
  if (!texto) return '';
  if (texto.includes('/')) {
    const partes = texto.split('/');
    const num = partes[0].replace(/[^\d]/g, '');
    const den = partes[1]?.replace(/[^\d]/g, '') || '';
    if (!num && !den) return '';
    return `${num || '20'}/${den || '20'}`;
  }
  const soloDigitos = texto.replace(/[^\d]/g, '');
  return soloDigitos ? `20/${soloDigitos}` : '';
};

// Formateo de Presión Intraocular: extrae SOLO dígitos y le agrega " mmHg"
const formatearPresion = (valorEntrada: string): string => {
  const texto = valorEntrada.trim();
  if (!texto) return '';
  const soloDigitos = texto.replace(/[^\d]/g, '');
  if (!soloDigitos) return '';
  return `${soloDigitos} mmHg`;
};

// Catálogo base de opciones
const OPCIONES_SINTOMAS = [
  'Visión borrosa',
  'Cansancio visual',
  'Dolor de cabeza',
  'Ojos rojos',
];

const OPCIONES_ANTECEDENTES_PERSONALES = [
  'Diabetes',
  'Hipertensión',
  'Cirugías',
];

const OPCIONES_ANTECEDENTES_OCULARES = [
  'Uso de gafas',
  'Cirugía ocular',
];

const OPCIONES_ANTECEDENTES_FAMILIARES = [
  'Miopía',
  'Hipermetropía',
  'Glaucoma',
];

const OPCIONES_PLAN_MANEJO = [
  'Lentes',
  'Terapia Visual',
];

interface PropiedadesModalRegistroClinicoCompleto {
  abierto: boolean;
  contacto: Contacto | null;
  opticaActual?: Optica | null;
  alCerrar: () => void;
  alCompletarTodo: (datos: {
    historia: Partial<HistoriaClinicaOptometrica>;
    formula?: Partial<FormulaOptica>;
  }) => Promise<void>;
  historiaInicialParaEditar?: HistoriaClinicaOptometrica | null;
  iniciarEnPaso?: 1 | 2;
}

export const ModalRegistroClinicoCompleto: React.FC<PropiedadesModalRegistroClinicoCompleto> = ({
  abierto,
  contacto,
  opticaActual,
  alCerrar,
  alCompletarTodo,
  historiaInicialParaEditar = null,
  iniciarEnPaso = 1,
}) => {
  const [montado, setMontado] = useState(false);
  const [pasoActual, setPasoActual] = useState<1 | 2>(iniciarEnPaso);
  const [cargando, setCargando] = useState(false);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);

  // Pestañas de Anamnesis: Motivo & Síntomas vs Antecedentes Médicos
  const [pestañaAnamnesis, setPestañaAnamnesis] = useState<'sintomas' | 'antecedentes'>('sintomas');

  // Datos de atención (Fecha y Hora frescos al momento de abrir el formulario)
  const [fechaAtencion, setFechaAtencion] = useState<string>('');
  const [horaAtencion, setHoraAtencion] = useState<string>('');

  // Estado del Paso 1: Historia Clínica
  const [idHistoriaGuardada, setIdHistoriaGuardada] = useState<number | null>(null);
  const [motivoConsulta, setMotivoConsulta] = useState('');
  const [sintomas, setSintomas] = useState<string[]>([]);
  const [otrosSintomas, setOtrosSintomas] = useState<string[]>([]);
  const [editandoOtroSintoma, setEditandoOtroSintoma] = useState(false);
  const [textoTempOtroSintoma, setTextoTempOtroSintoma] = useState('');

  const [antPersonales, setAntPersonales] = useState<string[]>([]);
  const [otrosAntPersonales, setOtrosAntPersonales] = useState<string[]>([]);
  const [editandoOtroAntPersonal, setEditandoOtroAntPersonal] = useState(false);
  const [textoTempOtroAntPersonal, setTextoTempOtroAntPersonal] = useState('');

  const [antOculares, setAntOculares] = useState<string[]>([]);
  const [otrosAntOculares, setOtrosAntOculares] = useState<string[]>([]);
  const [editandoOtroAntOcular, setEditandoOtroAntOcular] = useState(false);
  const [textoTempOtroAntOcular, setTextoTempOtroAntOcular] = useState('');

  const [antFamiliares, setAntFamiliares] = useState<string[]>([]);
  const [otrosAntFamiliares, setOtrosAntFamiliares] = useState<string[]>([]);
  const [editandoOtroAntFamiliar, setEditandoOtroAntFamiliar] = useState(false);
  const [textoTempOtroAntFamiliar, setTextoTempOtroAntFamiliar] = useState('');

  const [avScOd, setAvScOd] = useState('');
  const [avScOi, setAvScOi] = useState('');
  const [refraccionOd, setRefraccionOd] = useState('');
  const [refraccionOi, setRefraccionOi] = useState('');
  const [queratometriaOd, setQueratometriaOd] = useState('');
  const [queratometriaOi, setQueratometriaOi] = useState('');
  const [presionOd, setPresionOd] = useState('');
  const [presionOi, setPresionOi] = useState('');
  const [biomicroscopia, setBiomicroscopia] = useState('');
  const [fondoOjo, setFondoOjo] = useState('');

  const [diagnostico, setDiagnostico] = useState('');
  const [planManejo, setPlanManejo] = useState<string[]>([]);
  const [otrosPlanManejo, setOtrosPlanManejo] = useState<string[]>([]);
  const [editandoOtroPlan, setEditandoOtroPlan] = useState(false);
  const [textoTempOtroPlan, setTextoTempOtroPlan] = useState('');
  const [planControlMeses, setPlanControlMeses] = useState('');

  const [observaciones, setObservaciones] = useState('');
  const [optometra, setOptometra] = useState('');
  const [tarjetaProfesional, setTarjetaProfesional] = useState('');

  // Estado del Paso 2: Fórmula Óptica
  const [tiposLentes, setTiposLentes] = useState<TratamientoLente[]>([]);
  const [formularioFormula, setFormularioFormula] = useState({
    esfera_od: '+0.00',
    cilindro_od: '-0.00',
    eje_od: '0°',
    adicion_od: '+0.00',
    av_od: '20/20',
    esfera_oi: '+0.00',
    cilindro_oi: '-0.00',
    eje_oi: '0°',
    adicion_oi: '+0.00',
    av_oi: '20/20',
    distancia_pupilar: '',
    tipo_lente: '',
    proximo_control_en_meses: '12',
    observaciones_formula: '',
  });

  const [modalConfirmacionFormula, setModalConfirmacionFormula] = useState(false);

  // Estados para selección modular de fórmula en el Paso 2: Diseño base + Tratamientos
  const [disenoBaseFormula, setDisenoBaseFormula] = useState<string>('Monofocal');
  const [tratamientosSeleccionadosFormula, setTratamientosSeleccionadosFormula] = useState<string[]>([]);
  const [editandoOtroTratamientoFormula, setEditandoOtroTratamientoFormula] = useState(false);
  const [textoTempOtroTratamientoFormula, setTextoTempOtroTratamientoFormula] = useState('');

  const componerLenteFormula = (base: string, trats: string[]) => {
    const partes = [base, ...trats].map((s) => s.trim()).filter(Boolean);
    return partes.join(' ');
  };

  const cambiarDisenoBaseFormula = (nuevoDiseno: string) => {
    setDisenoBaseFormula(nuevoDiseno);
    const resultado = componerLenteFormula(nuevoDiseno, tratamientosSeleccionadosFormula);
    setFormularioFormula((prev) => ({ ...prev, tipo_lente: resultado }));
  };

  const alternarTratamientoFormula = (nombreTrat: string) => {
    setTratamientosSeleccionadosFormula((prev) => {
      const existe = prev.includes(nombreTrat);
      const nuevos = existe ? prev.filter((t) => t !== nombreTrat) : [...prev, nombreTrat];
      const resultado = componerLenteFormula(disenoBaseFormula, nuevos);
      setFormularioFormula((p) => ({ ...p, tipo_lente: resultado }));
      return nuevos;
    });
  };

  const manejarCrearOtroTratamientoFormula = async () => {
    const limpio = textoTempOtroTratamientoFormula.trim();
    if (!limpio) {
      setEditandoOtroTratamientoFormula(false);
      return;
    }
    try {
      const res = await crearTratamientoLenteApi(limpio);
      const creado = res.tratamiento_lente || res.tipo_lente;
      if (res.exito && creado) {
        setTiposLentes((prev) => {
          const yaExiste = prev.some((t) => t.id === creado.id);
          if (yaExiste) return prev;
          return [...prev, creado].sort((a, b) => a.nombre.localeCompare(b.nombre));
        });
        alternarTratamientoFormula(limpio);
      }
    } catch (err) {
      console.error('Error al crear nuevo tratamiento:', err);
    } finally {
      setTextoTempOtroTratamientoFormula('');
      setEditandoOtroTratamientoFormula(false);
    }
  };

  useEffect(() => {
    setMontado(true);
    obtenerTratamientosLentesApi()
      .then((res) => {
        if (res.exito) setTiposLentes(res.tratamientos_lentes || res.tipos_lentes || []);
      })
      .catch(() => { });
  }, []);

  const parsearListaOtros = (val?: string | null): string[] => {
    if (!val) return [];
    return val.split(',').map((s) => s.trim()).filter(Boolean);
  };

  // Cargar optómetra principal y datos iniciales
  useEffect(() => {
    if (!abierto) return;

    // Calcular fecha y hora actual en zona horaria de Colombia al momento de abrir el formulario
    const ahora = new Date();
    const horaActualStr = new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(ahora);

    const fechaActualStr = ahora.toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    // Siempre reiniciar en la pestaña Motivo & Síntomas al abrir
    setPestañaAnamnesis('sintomas');

    const optSesion = opticaActual || obtenerOpticaSesion();
    const optometraPredeterminado = optSesion?.especialista_defecto || '';
    const registroPredeterminado = optSesion?.registro_profesional_defecto || '';
    const controlMeses = String(optSesion?.control_meses_defecto || '12');

    // Respaldo asíncrono si la sesión local aún no tenía especialista configurado
    if (!optometraPredeterminado && !historiaInicialParaEditar) {
      obtenerEstadoCanalesApi()
        .then((res) => {
          if (res.exito && res.optica) {
            if (res.optica.especialista_defecto) {
              setOptometra((actual) => (actual ? actual : res.optica!.especialista_defecto || ''));
            }
            if (res.optica.registro_profesional_defecto) {
              setTarjetaProfesional((actual) => (actual ? actual : res.optica!.registro_profesional_defecto || ''));
            }
            if (res.optica.control_meses_defecto) {
              setPlanControlMeses((actual) => (actual ? actual : String(res.optica!.control_meses_defecto)));
            }
          }
        })
        .catch(() => {});
    }

    if (historiaInicialParaEditar) {
      setFechaAtencion(historiaInicialParaEditar.fecha_atencion || fechaActualStr);
      setHoraAtencion(historiaInicialParaEditar.hora_atencion || horaActualStr);
      setIdHistoriaGuardada(historiaInicialParaEditar.id);
      setMotivoConsulta(historiaInicialParaEditar.motivo_consulta || '');
      setSintomas(historiaInicialParaEditar.sintomas || []);
      setOtrosSintomas(parsearListaOtros(historiaInicialParaEditar.sintomas_otros));
      setTextoTempOtroSintoma('');
      setEditandoOtroSintoma(false);

      setAntPersonales(historiaInicialParaEditar.antecedentes_personales || []);
      setOtrosAntPersonales(parsearListaOtros(historiaInicialParaEditar.antecedentes_personales_otros));
      setTextoTempOtroAntPersonal('');
      setEditandoOtroAntPersonal(false);

      setAntOculares(historiaInicialParaEditar.antecedentes_oculares || []);
      setOtrosAntOculares(parsearListaOtros(historiaInicialParaEditar.antecedentes_oculares_otros));
      setTextoTempOtroAntOcular('');
      setEditandoOtroAntOcular(false);

      setAntFamiliares(historiaInicialParaEditar.antecedentes_familiares || []);
      setOtrosAntFamiliares(parsearListaOtros(historiaInicialParaEditar.antecedentes_familiares_otros));
      setTextoTempOtroAntFamiliar('');
      setEditandoOtroAntFamiliar(false);

      setAvScOd(historiaInicialParaEditar.av_sc_od || '');
      setAvScOi(historiaInicialParaEditar.av_sc_oi || '');
      setRefraccionOd(historiaInicialParaEditar.refraccion_od || '');
      setRefraccionOi(historiaInicialParaEditar.refraccion_oi || '');
      setQueratometriaOd(historiaInicialParaEditar.queratometria_od || '');
      setQueratometriaOi(historiaInicialParaEditar.queratometria_oi || '');
      const limpiarMmHg = (v?: string | null) => {
        if (!v) return '';
        const num = v.replace(/[^\d]/g, '').trim();
        return num ? `${num} mmHg` : '';
      };
      setPresionOd(limpiarMmHg(historiaInicialParaEditar.presion_intraocular_od));
      setPresionOi(limpiarMmHg(historiaInicialParaEditar.presion_intraocular_oi));
      setBiomicroscopia(historiaInicialParaEditar.biomicroscopia || '');
      setFondoOjo(historiaInicialParaEditar.fondo_ojo || '');

      setDiagnostico(historiaInicialParaEditar.diagnostico || '');
      setPlanManejo(historiaInicialParaEditar.plan_manejo || []);
      setOtrosPlanManejo(parsearListaOtros(historiaInicialParaEditar.plan_manejo_otros));
      setTextoTempOtroPlan('');
      setEditandoOtroPlan(false);
      setPlanControlMeses(
        historiaInicialParaEditar.plan_manejo_control_meses
          ? String(historiaInicialParaEditar.plan_manejo_control_meses)
          : ''
      );

      setObservaciones(historiaInicialParaEditar.observaciones || '');
      setOptometra(historiaInicialParaEditar.optometra || optometraPredeterminado);
      setTarjetaProfesional(
        historiaInicialParaEditar.tarjeta_profesional || registroPredeterminado
      );
    } else {
      setFechaAtencion(fechaActualStr);
      setHoraAtencion(horaActualStr);
      setIdHistoriaGuardada(null);
      setMotivoConsulta('');
      setSintomas([]);
      setOtrosSintomas([]);
      setTextoTempOtroSintoma('');
      setEditandoOtroSintoma(false);

      setAntPersonales([]);
      setOtrosAntPersonales([]);
      setTextoTempOtroAntPersonal('');
      setEditandoOtroAntPersonal(false);

      setAntOculares([]);
      setOtrosAntOculares([]);
      setTextoTempOtroAntOcular('');
      setEditandoOtroAntOcular(false);

      setAntFamiliares([]);
      setOtrosAntFamiliares([]);
      setTextoTempOtroAntFamiliar('');
      setEditandoOtroAntFamiliar(false);

      setAvScOd('');
      setAvScOi('');
      setRefraccionOd('');
      setRefraccionOi('');
      setQueratometriaOd('');
      setQueratometriaOi('');
      setPresionOd('');
      setPresionOi('');
      setBiomicroscopia('');
      setFondoOjo('');
      setDiagnostico('');
      setPlanManejo([]);
      setOtrosPlanManejo([]);
      setTextoTempOtroPlan('');
      setEditandoOtroPlan(false);
      setPlanControlMeses(controlMeses || '12');
      setObservaciones('');
      setOptometra(optometraPredeterminado);
      setTarjetaProfesional(registroPredeterminado);

      setFormularioFormula({
        esfera_od: '+0.00',
        cilindro_od: '-0.00',
        eje_od: '0°',
        adicion_od: '+0.00',
        av_od: '20/20',
        esfera_oi: '+0.00',
        cilindro_oi: '-0.00',
        eje_oi: '0°',
        adicion_oi: '+0.00',
        av_oi: '20/20',
        distancia_pupilar: '',
        tipo_lente: '',
        proximo_control_en_meses: controlMeses,
        observaciones_formula: '',
      });
      setPasoActual(iniciarEnPaso);
    }
  }, [abierto, historiaInicialParaEditar, iniciarEnPaso, opticaActual]);

  const alternarItemArray = (lista: string[], item: string, setter: (val: string[]) => void) => {
    setter(lista.includes(item) ? lista.filter((x) => x !== item) : [...lista, item]);
  };

  const agregarOtroItem = (
    texto: string,
    listaActual: string[],
    setLista: (nueva: string[]) => void,
    setModoEdicion: (val: boolean) => void,
    setTextoTemp: (val: string) => void
  ) => {
    const limpio = texto.trim();
    if (limpio && !listaActual.includes(limpio)) {
      setLista([...listaActual, limpio]);
    }
    setTextoTemp('');
    setModoEdicion(false);
  };

  const eliminarOtroItem = (
    itemAEliminar: string,
    listaActual: string[],
    setLista: (nueva: string[]) => void
  ) => {
    setLista(listaActual.filter((x) => x !== itemAEliminar));
  };

  const historiaValida = useMemo(() => {
    return (
      motivoConsulta.trim().length > 0 &&
      diagnostico.trim().length > 0 &&
      optometra.trim().length > 0
    );
  }, [motivoConsulta, diagnostico, optometra]);

  const construirObjetoHistoria = (): Partial<HistoriaClinicaOptometrica> => {
    return {
      contacto_id: contacto?.id,
      fecha_atencion: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }),
      hora_atencion: horaAtencion.trim(),
      motivo_consulta: motivoConsulta.trim(),
      sintomas,
      sintomas_otros: otrosSintomas.join(', ') || undefined,
      antecedentes_personales: antPersonales,
      antecedentes_personales_otros: otrosAntPersonales.join(', ') || undefined,
      antecedentes_oculares: antOculares,
      antecedentes_oculares_otros: otrosAntOculares.join(', ') || undefined,
      antecedentes_familiares: antFamiliares,
      antecedentes_familiares_otros: otrosAntFamiliares.join(', ') || undefined,
      av_sc_od: avScOd.trim() || undefined,
      av_sc_oi: avScOi.trim() || undefined,
      refraccion_od: refraccionOd.trim() || undefined,
      refraccion_oi: refraccionOi.trim() || undefined,
      queratometria_od: queratometriaOd.trim() || undefined,
      queratometria_oi: queratometriaOi.trim() || undefined,
      presion_intraocular_od: (() => {
        const digitos = presionOd.replace(/[^\d]/g, '').trim();
        return digitos ? `${digitos} mmHg` : undefined;
      })(),
      presion_intraocular_oi: (() => {
        const digitos = presionOi.replace(/[^\d]/g, '').trim();
        return digitos ? `${digitos} mmHg` : undefined;
      })(),
      biomicroscopia: biomicroscopia.trim() || undefined,
      fondo_ojo: fondoOjo.trim() || undefined,
      diagnostico: diagnostico.trim(),
      plan_manejo: planManejo,
      plan_manejo_otros: otrosPlanManejo.join(', ') || undefined,
      plan_manejo_control_meses: planControlMeses ? Number(planControlMeses) : undefined,
      observaciones: observaciones.trim() || undefined,
      optometra: formatearNombreEspecialista(optometra) || optometra.trim(),
      tarjeta_profesional: tarjetaProfesional.trim() || undefined,
    };
  };

  const manejarAvanzarPasoFormula = async () => {
    if (!historiaValida || !contacto?.id) {
      setErrorValidacion('Por favor completa los campos obligatorios marcados con *');
      return;
    }

    setErrorValidacion(null);
    setCargando(true);
    try {
      const datosHistoria = construirObjetoHistoria();
      if (idHistoriaGuardada) {
        await actualizarHistoriaClinica(idHistoriaGuardada, datosHistoria);
      } else {
        const res = await registrarHistoriaClinica(datosHistoria);
        if (res.exito && res.historia_id) {
          setIdHistoriaGuardada(res.historia_id);
        }
      }
      if (planControlMeses && !formularioFormula.proximo_control_en_meses) {
        setFormularioFormula((prev) => ({ ...prev, proximo_control_en_meses: planControlMeses }));
      }
      setPasoActual(2);
    } catch (err: any) {
      setErrorValidacion(err?.message || 'Error al guardar la historia clínica');
    } finally {
      setCargando(false);
    }
  };

  const manejarGuardarSoloHistoria = async () => {
    if (!historiaValida || !contacto?.id) {
      setErrorValidacion('Por favor completa los campos obligatorios marcados con *');
      return;
    }

    setErrorValidacion(null);
    setCargando(true);
    try {
      const datosHistoria = construirObjetoHistoria();
      let historiaIdFinal = idHistoriaGuardada;
      if (idHistoriaGuardada) {
        await actualizarHistoriaClinica(idHistoriaGuardada, datosHistoria);
      } else {
        const resH = await registrarHistoriaClinica(datosHistoria);
        if (resH.exito && resH.historia_id) {
          historiaIdFinal = resH.historia_id;
          setIdHistoriaGuardada(resH.historia_id);
        }
      }
      await alCompletarTodo({ historia: { ...datosHistoria, id: historiaIdFinal || undefined } });
      alCerrar();
    } catch (err: any) {
      setErrorValidacion(err?.message || 'Error al guardar la historia clínica');
    } finally {
      setCargando(false);
    }
  };

  const formulaValida = useMemo(() => {
    return (
      formularioFormula.esfera_od.trim() !== '' &&
      formularioFormula.cilindro_od.trim() !== '' &&
      formularioFormula.eje_od.trim() !== '' &&
      formularioFormula.adicion_od.trim() !== '' &&
      formularioFormula.av_od.trim() !== '' &&
      formularioFormula.esfera_oi.trim() !== '' &&
      formularioFormula.cilindro_oi.trim() !== '' &&
      formularioFormula.eje_oi.trim() !== '' &&
      formularioFormula.adicion_oi.trim() !== '' &&
      formularioFormula.av_oi.trim() !== '' &&
      formularioFormula.distancia_pupilar.trim() !== '' &&
      formularioFormula.tipo_lente.trim() !== ''
    );
  }, [formularioFormula]);

  const manejarGuardarFormulaFinal = async () => {
    if (!contacto?.id) return;
    setCargando(true);
    try {
      const datosHistoria = construirObjetoHistoria();
      let historiaIdFinal = idHistoriaGuardada;
      if (idHistoriaGuardada) {
        await actualizarHistoriaClinica(idHistoriaGuardada, datosHistoria);
      } else {
        const resH = await registrarHistoriaClinica(datosHistoria);
        if (resH.exito && resH.historia_id) {
          historiaIdFinal = resH.historia_id;
          setIdHistoriaGuardada(resH.historia_id);
        }
      }

      const datosFormula: Partial<FormulaOptica> = {
        contacto_id: contacto.id,
        esfera_od: formularioFormula.esfera_od,
        cilindro_od: formularioFormula.cilindro_od,
        eje_od: formularioFormula.eje_od,
        adicion_od: formularioFormula.adicion_od,
        av_od: formularioFormula.av_od,
        esfera_oi: formularioFormula.esfera_oi,
        cilindro_oi: formularioFormula.cilindro_oi,
        eje_oi: formularioFormula.eje_oi,
        adicion_oi: formularioFormula.adicion_oi,
        av_oi: formularioFormula.av_oi,
        distancia_pupilar: formatearDistanciaPupilar(formularioFormula.distancia_pupilar) || formularioFormula.distancia_pupilar.trim(),
        tipo_lente: formularioFormula.tipo_lente,
        optometra: formatearNombreEspecialista(optometra) || optometra.trim(),
        proximo_control_en_meses: Number(formularioFormula.proximo_control_en_meses) || 12,
        observaciones: formularioFormula.observaciones_formula.trim() || undefined,
        fecha_examen: new Date().toISOString(),
      };

      await alCompletarTodo({ historia: { ...datosHistoria, id: historiaIdFinal || undefined }, formula: datosFormula });
      setModalConfirmacionFormula(false);
      alCerrar();
    } catch (err: any) {
      console.error('Error al guardar consulta optométrica integral:', err);
    } finally {
      setCargando(false);
    }
  };

  if (!montado || !abierto || !contacto) return null;

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 1050 }}>
      <div
        className="modal-tarjeta-clinica"
        role="dialog"
        aria-modal="true"
        style={{
          maxWidth: pasoActual === 1 ? '780px' : '620px',
          width: '95vw',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          transition: 'max-width 0.2s ease',
        }}
      >
        {/* Encabezado Principal */}
        <div className="modal-cabecera-clinica" style={{ padding: '0.9rem 1.4rem' }}>
          <div className="modal-cabecera-izq" style={{ gap: '0.85rem' }}>
            <div
              className="modal-icono-caja"
              style={{
                width: '38px',
                height: '38px',
                background: 'rgba(2, 132, 199, 0.12)',
                color: 'var(--color-primario)',
              }}
            >
              {pasoActual === 1 ? <FileText size={20} /> : <Glasses size={20} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h3 className="modal-titulo-principal" style={{ fontSize: '1.05rem', margin: 0 }}>
                  {pasoActual === 1 ? 'Historia Clínica Optométrica' : 'Prescripción Final'}
                </h3>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.15rem 0.55rem',
                    borderRadius: '20px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    background: 'var(--fondo-hover)',
                    border: '1px solid var(--borde-tarjeta)',
                    color: 'var(--texto-secundario)',
                  }}
                >
                  <span>Paso {pasoActual} de 2</span>
                </div>
              </div>

              {/* Subtítulo Paciente con Datos Relevantes */}
              <div
                className="modal-subtitulo-paciente"
                style={{ marginTop: '0.25rem', gap: '0.5rem', fontSize: '0.78rem' }}
              >
                <strong>{obtenerNombrePaciente(contacto)}</strong>
                <span className="modal-badge-paciente">
                  {contacto.tipo_documento || 'CC'}: {contacto.cedula || 'S/N'}
                </span>
                {contacto.edad && (
                  <span style={{ color: 'var(--texto-atenuado)' }}>• {contacto.edad} años</span>
                )}
                {contacto.sexo && (
                  <span
                    style={{
                      textTransform: 'capitalize',
                      color: contacto.sexo === 'femenino' ? '#db2777' : 'var(--color-primario)',
                    }}
                  >
                    • {contacto.sexo}
                  </span>
                )}
              </div>
            </div>
          </div>

          <EtiquetaTooltip texto="Cerrar ventana (Esc)" posicion="abajo">
            <button
              type="button"
              onClick={alCerrar}
              className="modal-btn-cerrar"
              aria-label="Cerrar modal"
            >
              <X style={{ width: '18px', height: '18px' }} />
            </button>
          </EtiquetaTooltip>
        </div>

        {/* Barra de Progreso Visual */}
        <div
          style={{
            height: '3px',
            background: 'var(--borde-tarjeta)',
            position: 'relative',
            width: '100%',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: pasoActual === 1 ? '50%' : '100%',
              background: 'var(--color-primario)',
              transition: 'width 0.25s ease',
            }}
          />
        </div>

        {/* Mensaje de Error si Existe */}
        {errorValidacion && (
          <div
            style={{
              margin: '0.75rem 1.4rem 0 1.4rem',
              padding: '0.6rem 0.85rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#ef4444',
              fontSize: '0.78rem',
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{errorValidacion}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* PASO 1: HISTORIA CLÍNICA OPTOMÉTRICA                      */}
        {/* ========================================================= */}
        {pasoActual === 1 && (
          <div
            className="scroll-suave-optica"
            style={{
              flex: '1 1 0%',
              overflowY: 'auto',
              padding: '1.1rem 1.4rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.1rem',
            }}
          >
            {/* SECCIÓN 1: DATOS GENERALES DE ATENCIÓN */}
            <div
              style={{
                background: 'var(--fondo-elevado)',
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: '10px',
                padding: '0.8rem 1rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '0.85rem',
              }}
            >
              <div>
                <label className="modal-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={13} style={{ color: 'var(--texto-atenuado)' }} />
                  <span>Fecha de Atención</span>
                </label>
                <input
                  type="text"
                  value={fechaAtencion}
                  readOnly
                  disabled
                  className="modal-input"
                  style={{
                    backgroundColor: 'var(--fondo-tarjeta)',
                    cursor: 'default',
                    opacity: 0.9,
                    fontWeight: 600,
                  }}
                />
              </div>

              <div>
                <label className="modal-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Clock size={13} style={{ color: 'var(--texto-atenuado)' }} />
                  <span>Hora de Atención</span>
                </label>
                <input
                  type="text"
                  value={horaAtencion}
                  readOnly
                  disabled
                  className="modal-input"
                  style={{
                    backgroundColor: 'var(--fondo-tarjeta)',
                    cursor: 'default',
                    opacity: 0.9,
                    fontWeight: 600,
                  }}
                />
              </div>

              <div>
                <label className="modal-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <IdCard size={13} style={{ color: 'var(--texto-atenuado)' }} />
                  <span>Documento</span>
                </label>
                <input
                  type="text"
                  value={`${contacto.tipo_documento || 'CC'} ${contacto.cedula || 'Sin documento'}`}
                  readOnly
                  disabled
                  className="modal-input"
                  style={{
                    backgroundColor: 'var(--fondo-tarjeta)',
                    cursor: 'default',
                    opacity: 0.9,
                    fontWeight: 600,
                  }}
                />
              </div>

              <div>
                <label className="modal-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <User size={13} style={{ color: 'var(--texto-atenuado)' }} />
                  <span>Edad / Género</span>
                </label>
                <input
                  type="text"
                  value={`${contacto.edad ? `${contacto.edad} años` : 'S/E'} • ${contacto.sexo === 'femenino' ? 'F' : 'M'}`}
                  readOnly
                  disabled
                  className="modal-input"
                  style={{
                    backgroundColor: 'var(--fondo-tarjeta)',
                    cursor: 'default',
                    opacity: 0.9,
                    fontWeight: 600,
                  }}
                />
              </div>
            </div>

            {/* SECCIÓN 2 & 3: SÍNTOMAS Y ANTECEDENTES CON PESTAÑAS */}
            <div
              style={{
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: '10px',
                padding: '0.85rem 1rem',
                background: 'var(--fondo-elevado)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
              }}
            >
              {/* Cabecera de Sección */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--borde-tarjeta)', paddingBottom: '0.55rem' }}>
                <div
                  className="modal-seccion-rotulo"
                  style={{
                    margin: 0,
                    textTransform: 'none',
                    letterSpacing: 'normal',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: 'var(--texto-principal)',
                  }}
                >
                  <span>Síntomas y Antecedentes</span>
                </div>

                {/* Pestañas de Navegación con los Colores de la Marca */}
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    type="button"
                    onClick={() => setPestañaAnamnesis('sintomas')}
                    style={{
                      padding: '0.28rem 0.8rem',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: pestañaAnamnesis === 'sintomas' ? '1px solid var(--color-primario)' : '1px solid var(--borde-tarjeta)',
                      background: pestañaAnamnesis === 'sintomas' ? 'var(--color-primario-transparente, rgba(2, 132, 199, 0.15))' : 'var(--fondo-tarjeta)',
                      color: pestañaAnamnesis === 'sintomas' ? 'var(--color-primario)' : 'var(--texto-secundario)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Motivo & Síntomas
                  </button>
                  <button
                    type="button"
                    onClick={() => setPestañaAnamnesis('antecedentes')}
                    style={{
                      padding: '0.28rem 0.8rem',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: pestañaAnamnesis === 'antecedentes' ? '1px solid var(--color-primario)' : '1px solid var(--borde-tarjeta)',
                      background: pestañaAnamnesis === 'antecedentes' ? 'var(--color-primario-transparente, rgba(2, 132, 199, 0.15))' : 'var(--fondo-tarjeta)',
                      color: pestañaAnamnesis === 'antecedentes' ? 'var(--color-primario)' : 'var(--texto-secundario)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Antecedentes Médicos
                  </button>
                </div>
              </div>

              {/* Contenido según la pestaña activa */}
              {pestañaAnamnesis === 'sintomas' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem', alignItems: 'stretch' }}>
                  {/* Tarjeta Motivo de Consulta */}
                  <div
                    style={{
                      background: 'var(--fondo-tarjeta)',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--borde-tarjeta)',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <label className="modal-label" style={{ margin: 0, fontWeight: 700 }}>Motivo de Consulta *</label>
                    </div>
                    <textarea
                      value={motivoConsulta}
                      onChange={(e) => setMotivoConsulta(e.target.value)}
                      className="modal-textarea"
                      rows={2}
                      placeholder="Razón de la consulta..."
                      style={{ minHeight: '60px', height: '100%', flex: 1, resize: 'vertical' }}
                    />
                  </div>

                  {/* Tarjeta Síntomas Actuales */}
                  <div
                    style={{
                      background: 'var(--fondo-tarjeta)',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--borde-tarjeta)',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <label className="modal-label" style={{ margin: 0, fontWeight: 600 }}>Síntomas Actuales</label>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
                      {OPCIONES_SINTOMAS.map((s) => {
                        const sel = sintomas.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => alternarItemArray(sintomas, s, setSintomas)}
                            style={{
                              padding: '0.3rem 0.7rem',
                              borderRadius: '16px',
                              fontSize: '0.76rem',
                              fontWeight: sel ? 600 : 500,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              border: sel ? '1px solid var(--color-primario)' : '1px solid var(--borde-tarjeta)',
                              background: sel ? 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)' : 'var(--fondo-tarjeta)',
                              color: sel ? 'var(--color-primario)' : 'var(--texto-principal)',
                            }}
                          >
                            {sel && <Check size={12} style={{ strokeWidth: 3 }} />}
                            <span>{s}</span>
                          </button>
                        );
                      })}

                      {/* Chips de Otros Síntomas agregados */}
                      {otrosSintomas.map((item) => (
                        <span
                          key={item}
                          style={{
                            padding: '0.3rem 0.7rem',
                            borderRadius: '16px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            border: '1px solid var(--color-primario)',
                            background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)',
                            color: 'var(--color-primario)',
                          }}
                        >
                          <Check size={12} style={{ strokeWidth: 3 }} />
                          <span>{item}</span>
                          <button
                            type="button"
                            onClick={() => eliminarOtroItem(item, otrosSintomas, setOtrosSintomas)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              color: 'inherit',
                              marginLeft: '0.2rem',
                            }}
                            title="Eliminar opción"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}

                      {/* Input compacto para ingresar Otro Síntoma o Botón + Otro */}
                      {editandoOtroSintoma ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <input
                            type="text"
                            value={textoTempOtroSintoma}
                            onChange={(e) => setTextoTempOtroSintoma(e.target.value)}
                            onBlur={() =>
                              agregarOtroItem(
                                textoTempOtroSintoma,
                                otrosSintomas,
                                setOtrosSintomas,
                                setEditandoOtroSintoma,
                                setTextoTempOtroSintoma
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                agregarOtroItem(
                                  textoTempOtroSintoma,
                                  otrosSintomas,
                                  setOtrosSintomas,
                                  setEditandoOtroSintoma,
                                  setTextoTempOtroSintoma
                                );
                              } else if (e.key === 'Escape') {
                                setEditandoOtroSintoma(false);
                                setTextoTempOtroSintoma('');
                              }
                            }}
                            placeholder="Otro síntoma..."
                            className="modal-input"
                            style={{
                              width: '140px',
                              height: '28px',
                              fontSize: '0.74rem',
                              padding: '0 0.5rem',
                              borderRadius: '16px',
                              borderColor: 'var(--color-primario)',
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setEditandoOtroSintoma(false);
                              setTextoTempOtroSintoma('');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--texto-atenuado)',
                              padding: '2px',
                              display: 'inline-flex',
                            }}
                            title="Cancelar"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditandoOtroSintoma(true);
                            setTextoTempOtroSintoma('');
                          }}
                          style={{
                            background: 'none',
                            border: '1px dashed var(--borde-tarjeta)',
                            color: 'var(--color-primario)',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '0.24rem 0.65rem',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <Plus size={11} />
                          <span>Otro</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  {/* Personales */}
                  <div style={{ background: 'var(--fondo-tarjeta)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--borde-tarjeta)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--texto-secundario)' }}>Personales:</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem' }}>
                      {OPCIONES_ANTECEDENTES_PERSONALES.map((item) => {
                        const sel = antPersonales.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => alternarItemArray(antPersonales, item, setAntPersonales)}
                            style={{
                              padding: '0.22rem 0.55rem',
                              borderRadius: '14px',
                              fontSize: '0.72rem',
                              fontWeight: sel ? 600 : 500,
                              cursor: 'pointer',
                              border: sel ? '1px solid var(--color-primario)' : '1px solid var(--borde-tarjeta)',
                              background: sel ? 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)' : 'var(--fondo-elevado)',
                              color: sel ? 'var(--color-primario)' : 'var(--texto-principal)',
                            }}
                          >
                            {sel && <Check size={11} style={{ strokeWidth: 3 }} />}
                            <span>{item}</span>
                          </button>
                        );
                      })}

                      {/* Chips Otros Personales */}
                      {otrosAntPersonales.map((item) => (
                        <span
                          key={item}
                          style={{
                            padding: '0.22rem 0.55rem',
                            borderRadius: '14px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            border: '1px solid var(--color-primario)',
                            background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)',
                            color: 'var(--color-primario)',
                          }}
                        >
                          <Check size={11} style={{ strokeWidth: 3 }} />
                          <span>{item}</span>
                          <button
                            type="button"
                            onClick={() => eliminarOtroItem(item, otrosAntPersonales, setOtrosAntPersonales)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', color: 'inherit', marginLeft: '0.15rem' }}
                            title="Eliminar"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}

                      {/* Input compacto para ingresar Otro Personal o Botón + Otro */}
                      {editandoOtroAntPersonal ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <input
                            type="text"
                            value={textoTempOtroAntPersonal}
                            onChange={(e) => setTextoTempOtroAntPersonal(e.target.value)}
                            onBlur={() =>
                              agregarOtroItem(
                                textoTempOtroAntPersonal,
                                otrosAntPersonales,
                                setOtrosAntPersonales,
                                setEditandoOtroAntPersonal,
                                setTextoTempOtroAntPersonal
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                agregarOtroItem(
                                  textoTempOtroAntPersonal,
                                  otrosAntPersonales,
                                  setOtrosAntPersonales,
                                  setEditandoOtroAntPersonal,
                                  setTextoTempOtroAntPersonal
                                );
                              } else if (e.key === 'Escape') {
                                setEditandoOtroAntPersonal(false);
                                setTextoTempOtroAntPersonal('');
                              }
                            }}
                            placeholder="Otro..."
                            className="modal-input"
                            style={{
                              width: '120px',
                              height: '24px',
                              fontSize: '0.72rem',
                              padding: '0 0.4rem',
                              borderRadius: '14px',
                              borderColor: 'var(--color-primario)',
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setEditandoOtroAntPersonal(false);
                              setTextoTempOtroAntPersonal('');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--texto-atenuado)',
                              padding: '2px',
                              display: 'inline-flex',
                            }}
                            title="Cancelar"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditandoOtroAntPersonal(true);
                            setTextoTempOtroAntPersonal('');
                          }}
                          style={{
                            background: 'none',
                            border: '1px dashed var(--borde-tarjeta)',
                            color: 'var(--color-primario)',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '14px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                          }}
                        >
                          <Plus size={10} />
                          <span>Otro</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Oculares */}
                  <div style={{ background: 'var(--fondo-tarjeta)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--borde-tarjeta)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--texto-secundario)' }}>Oculares:</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem' }}>
                      {OPCIONES_ANTECEDENTES_OCULARES.map((item) => {
                        const sel = antOculares.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => alternarItemArray(antOculares, item, setAntOculares)}
                            style={{
                              padding: '0.22rem 0.55rem',
                              borderRadius: '14px',
                              fontSize: '0.72rem',
                              fontWeight: sel ? 600 : 500,
                              cursor: 'pointer',
                              border: sel ? '1px solid var(--color-primario)' : '1px solid var(--borde-tarjeta)',
                              background: sel ? 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)' : 'var(--fondo-elevado)',
                              color: sel ? 'var(--color-primario)' : 'var(--texto-principal)',
                            }}
                          >
                            {sel && <Check size={11} style={{ strokeWidth: 3 }} />}
                            <span>{item}</span>
                          </button>
                        );
                      })}

                      {/* Chips Otros Oculares */}
                      {otrosAntOculares.map((item) => (
                        <span
                          key={item}
                          style={{
                            padding: '0.22rem 0.55rem',
                            borderRadius: '14px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            border: '1px solid var(--color-primario)',
                            background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)',
                            color: 'var(--color-primario)',
                          }}
                        >
                          <Check size={11} style={{ strokeWidth: 3 }} />
                          <span>{item}</span>
                          <button
                            type="button"
                            onClick={() => eliminarOtroItem(item, otrosAntOculares, setOtrosAntOculares)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', color: 'inherit', marginLeft: '0.15rem' }}
                            title="Eliminar"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}

                      {/* Input compacto para ingresar Otro Ocular o Botón + Otro */}
                      {editandoOtroAntOcular ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <input
                            type="text"
                            value={textoTempOtroAntOcular}
                            onChange={(e) => setTextoTempOtroAntOcular(e.target.value)}
                            onBlur={() =>
                              agregarOtroItem(
                                textoTempOtroAntOcular,
                                otrosAntOculares,
                                setOtrosAntOculares,
                                setEditandoOtroAntOcular,
                                setTextoTempOtroAntOcular
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                agregarOtroItem(
                                  textoTempOtroAntOcular,
                                  otrosAntOculares,
                                  setOtrosAntOculares,
                                  setEditandoOtroAntOcular,
                                  setTextoTempOtroAntOcular
                                );
                              } else if (e.key === 'Escape') {
                                setEditandoOtroAntOcular(false);
                                setTextoTempOtroAntOcular('');
                              }
                            }}
                            placeholder="Otro..."
                            className="modal-input"
                            style={{
                              width: '120px',
                              height: '24px',
                              fontSize: '0.72rem',
                              padding: '0 0.4rem',
                              borderRadius: '14px',
                              borderColor: 'var(--color-primario)',
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setEditandoOtroAntOcular(false);
                              setTextoTempOtroAntOcular('');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--texto-atenuado)',
                              padding: '2px',
                              display: 'inline-flex',
                            }}
                            title="Cancelar"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditandoOtroAntOcular(true);
                            setTextoTempOtroAntOcular('');
                          }}
                          style={{
                            background: 'none',
                            border: '1px dashed var(--borde-tarjeta)',
                            color: 'var(--color-primario)',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '14px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                          }}
                        >
                          <Plus size={10} />
                          <span>Otro</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Familiares */}
                  <div style={{ background: 'var(--fondo-tarjeta)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--borde-tarjeta)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--texto-secundario)' }}>Familiares:</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem' }}>
                      {OPCIONES_ANTECEDENTES_FAMILIARES.map((item) => {
                        const sel = antFamiliares.includes(item);
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => alternarItemArray(antFamiliares, item, setAntFamiliares)}
                            style={{
                              padding: '0.22rem 0.55rem',
                              borderRadius: '14px',
                              fontSize: '0.72rem',
                              fontWeight: sel ? 600 : 500,
                              cursor: 'pointer',
                              border: sel ? '1px solid var(--color-primario)' : '1px solid var(--borde-tarjeta)',
                              background: sel ? 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)' : 'var(--fondo-elevado)',
                              color: sel ? 'var(--color-primario)' : 'var(--texto-principal)',
                            }}
                          >
                            {sel && <Check size={11} style={{ strokeWidth: 3 }} />}
                            <span>{item}</span>
                          </button>
                        );
                      })}

                      {/* Chips Otros Familiares */}
                      {otrosAntFamiliares.map((item) => (
                        <span
                          key={item}
                          style={{
                            padding: '0.22rem 0.55rem',
                            borderRadius: '14px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            border: '1px solid var(--color-primario)',
                            background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)',
                            color: 'var(--color-primario)',
                          }}
                        >
                          <Check size={11} style={{ strokeWidth: 3 }} />
                          <span>{item}</span>
                          <button
                            type="button"
                            onClick={() => eliminarOtroItem(item, otrosAntFamiliares, setOtrosAntFamiliares)}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', color: 'inherit', marginLeft: '0.15rem' }}
                            title="Eliminar"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}

                      {/* Input compacto para ingresar Otro Familiar o Botón + Otro */}
                      {editandoOtroAntFamiliar ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <input
                            type="text"
                            value={textoTempOtroAntFamiliar}
                            onChange={(e) => setTextoTempOtroAntFamiliar(e.target.value)}
                            onBlur={() =>
                              agregarOtroItem(
                                textoTempOtroAntFamiliar,
                                otrosAntFamiliares,
                                setOtrosAntFamiliares,
                                setEditandoOtroAntFamiliar,
                                setTextoTempOtroAntFamiliar
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                agregarOtroItem(
                                  textoTempOtroAntFamiliar,
                                  otrosAntFamiliares,
                                  setOtrosAntFamiliares,
                                  setEditandoOtroAntFamiliar,
                                  setTextoTempOtroAntFamiliar
                                );
                              } else if (e.key === 'Escape') {
                                setEditandoOtroAntFamiliar(false);
                                setTextoTempOtroAntFamiliar('');
                              }
                            }}
                            placeholder="Otro..."
                            className="modal-input"
                            style={{
                              width: '120px',
                              height: '24px',
                              fontSize: '0.72rem',
                              padding: '0 0.4rem',
                              borderRadius: '14px',
                              borderColor: 'var(--color-primario)',
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setEditandoOtroAntFamiliar(false);
                              setTextoTempOtroAntFamiliar('');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--texto-atenuado)',
                              padding: '2px',
                              display: 'inline-flex',
                            }}
                            title="Cancelar"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditandoOtroAntFamiliar(true);
                            setTextoTempOtroAntFamiliar('');
                          }}
                          style={{
                            background: 'none',
                            border: '1px dashed var(--borde-tarjeta)',
                            color: 'var(--color-primario)',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '14px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                          }}
                        >
                          <Plus size={10} />
                          <span>Otro</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* SECCIÓN 4: AGUDEZA VISUAL & EXAMEN OPTOMÉTRICO */}
            <div
              style={{
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: '10px',
                padding: '0.9rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
              }}
            >
              <div
                className="modal-seccion-rotulo"
                style={{
                  margin: 0,
                  textTransform: 'none',
                  letterSpacing: 'normal',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: 'var(--texto-principal)',
                }}
              >
                <span>Agudeza Visual & Examen Optométrico</span>
              </div>

              {/* Agudeza Visual S/C */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="modal-label" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span className="badge-ojo-od" style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem' }}>OD</span>
                    <span>Agudeza Visual OD</span>
                  </label>
                  <input
                    type="text"
                    value={avScOd}
                    onChange={(e) => {
                      // Solo permite números y / (sin letras)
                      const val = e.target.value.replace(/[^0-9/]/g, '');
                      setAvScOd(val);
                    }}
                    onBlur={(e) => setAvScOd(formatearAV(e.target.value))}
                    className="modal-input"
                    placeholder="Ej: 20/20"
                    style={{ height: '32px' }}
                  />
                </div>
                <div>
                  <label className="modal-label" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span className="badge-ojo-oi" style={{ fontSize: '0.68rem', padding: '0.1rem 0.35rem' }}>OI</span>
                    <span>Agudeza Visual OI</span>
                  </label>
                  <input
                    type="text"
                    value={avScOi}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9/]/g, '');
                      setAvScOi(val);
                    }}
                    onBlur={(e) => setAvScOi(formatearAV(e.target.value))}
                    className="modal-input"
                    placeholder="Ej: 20/20"
                    style={{ height: '32px' }}
                  />
                </div>
              </div>

              {/* Refracción Preliminar */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="modal-label">Refracción OD</label>
                  <input
                    type="text"
                    value={refraccionOd}
                    onChange={(e) => {
                      // Bloquea letras comunes; solo caracteres ópticos (+, -, números, x, /, °, espacio)
                      const val = e.target.value.replace(/[^0-9+\-.,xX/°\s]/g, '');
                      setRefraccionOd(val);
                    }}
                    className="modal-input"
                    placeholder="Esf / Cil x Eje"
                    style={{ height: '32px' }}
                  />
                </div>
                <div>
                  <label className="modal-label">Refracción OI</label>
                  <input
                    type="text"
                    value={refraccionOi}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9+\-.,xX/°\s]/g, '');
                      setRefraccionOi(val);
                    }}
                    className="modal-input"
                    placeholder="Esf / Cil x Eje"
                    style={{ height: '32px' }}
                  />
                </div>
              </div>

              {/* Queratometría & Presión Intraocular */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="modal-label">Queratometría (OD / OI)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    <input
                      type="text"
                      value={queratometriaOd}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.,/xX°@\s]/g, '');
                        setQueratometriaOd(val);
                      }}
                      placeholder="OD: 42.50 / 43.00"
                      className="modal-input"
                      style={{ height: '32px', fontSize: '0.75rem' }}
                    />
                    <input
                      type="text"
                      value={queratometriaOi}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.,/xX°@\s]/g, '');
                        setQueratometriaOi(val);
                      }}
                      placeholder="OI: 42.50 / 43.00"
                      className="modal-input"
                      style={{ height: '32px', fontSize: '0.75rem' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="modal-label">Presión Intraocular (mmHg)</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    <input
                      type="text"
                      value={presionOd}
                      onChange={(e) => {
                        // Solo números en el campo de presión
                        const val = e.target.value.replace(/[^\d]/g, '');
                        setPresionOd(val);
                      }}
                      onFocus={() => {
                        setPresionOd((prev) => prev.replace(/[^\d]/g, ''));
                      }}
                      onBlur={(e) => {
                        const val = e.target.value.replace(/[^\d]/g, '').trim();
                        setPresionOd(val ? `${val} mmHg` : '');
                      }}
                      placeholder="OD (ej: 15)"
                      className="modal-input"
                      style={{ height: '32px', fontSize: '0.75rem' }}
                    />
                    <input
                      type="text"
                      value={presionOi}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^\d]/g, '');
                        setPresionOi(val);
                      }}
                      onFocus={() => {
                        setPresionOi((prev) => prev.replace(/[^\d]/g, ''));
                      }}
                      onBlur={(e) => {
                        const val = e.target.value.replace(/[^\d]/g, '').trim();
                        setPresionOi(val ? `${val} mmHg` : '');
                      }}
                      placeholder="OI (ej: 15)"
                      className="modal-input"
                      style={{ height: '32px', fontSize: '0.75rem' }}
                    />
                  </div>
                </div>
              </div>

              {/* Biomicroscopía y Fondo de Ojo (Texto descriptivo clínico) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="modal-label">Biomicroscopía (Polo Anterior)</label>
                  <textarea
                    value={biomicroscopia}
                    onChange={(e) => setBiomicroscopia(e.target.value)}
                    rows={2}
                    className="modal-textarea"
                    placeholder="Córnea transparente, cámara anterior amplia..."
                    style={{ minHeight: '48px', fontSize: '0.78rem' }}
                  />
                </div>
                <div>
                  <label className="modal-label">Fondo de Ojo (Retina y Nervio)</label>
                  <textarea
                    value={fondoOjo}
                    onChange={(e) => setFondoOjo(e.target.value)}
                    rows={2}
                    className="modal-textarea"
                    placeholder="Papila de bordes definidos, mácula normal..."
                    style={{ minHeight: '48px', fontSize: '0.78rem' }}
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 5: DIAGNÓSTICO Y PLAN DE MANEJO */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div className="modal-campo-grupo">
                <label className="modal-label" style={{ fontWeight: 700 }}>
                  Diagnóstico Clínico *
                </label>
                <textarea
                  value={diagnostico}
                  onChange={(e) => setDiagnostico(e.target.value)}
                  className="modal-textarea"
                  rows={2}
                  placeholder="Ej: Astigmatismo miópico compuesto OD/OI, presbicia inicial..."
                  style={{ minHeight: '52px' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                  <label className="modal-label" style={{ margin: 0 }}>
                    Plan de Manejo
                  </label>
                </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.45rem' }}>
                    {OPCIONES_PLAN_MANEJO.map((plan) => {
                      const sel = planManejo.includes(plan);
                      return (
                        <button
                          key={plan}
                          type="button"
                          onClick={() => alternarItemArray(planManejo, plan, setPlanManejo)}
                          style={{
                            padding: '0.32rem 0.7rem',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            fontWeight: sel ? 600 : 500,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            border: sel ? '1px solid var(--color-primario)' : '1px solid var(--borde-tarjeta)',
                            background: sel ? 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)' : 'var(--fondo-elevado)',
                            color: sel ? 'var(--color-primario)' : 'var(--texto-principal)',
                          }}
                        >
                          {sel && <Check size={13} style={{ strokeWidth: 3 }} />}
                          <span>{plan}</span>
                        </button>
                      );
                    })}

                    {otrosPlanManejo.map((item) => (
                      <span
                        key={item}
                        style={{
                          padding: '0.32rem 0.7rem',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          border: '1px solid var(--color-primario)',
                          background: 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)',
                          color: 'var(--color-primario)',
                        }}
                      >
                        <Check size={13} style={{ strokeWidth: 3 }} />
                        <span>{item}</span>
                        <button
                          type="button"
                          onClick={() => eliminarOtroItem(item, otrosPlanManejo, setOtrosPlanManejo)}
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', color: 'inherit', marginLeft: '0.2rem' }}
                          title="Eliminar opción"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}

                    {editandoOtroPlan ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <input
                          type="text"
                          value={textoTempOtroPlan}
                          onChange={(e) => setTextoTempOtroPlan(e.target.value)}
                          onBlur={() =>
                            agregarOtroItem(
                              textoTempOtroPlan,
                              otrosPlanManejo,
                              setOtrosPlanManejo,
                              setEditandoOtroPlan,
                              setTextoTempOtroPlan
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              agregarOtroItem(
                                textoTempOtroPlan,
                                otrosPlanManejo,
                                setOtrosPlanManejo,
                                setEditandoOtroPlan,
                                setTextoTempOtroPlan
                              );
                            } else if (e.key === 'Escape') {
                              setEditandoOtroPlan(false);
                              setTextoTempOtroPlan('');
                            }
                          }}
                          placeholder="Otra indicación..."
                          className="modal-input"
                          style={{
                            width: '135px',
                            height: '28px',
                            fontSize: '0.74rem',
                            padding: '0 0.5rem',
                            borderRadius: '16px',
                            borderColor: 'var(--color-primario)',
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setEditandoOtroPlan(false);
                            setTextoTempOtroPlan('');
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--texto-atenuado)',
                            padding: '2px',
                            display: 'inline-flex',
                          }}
                          title="Cancelar"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditandoOtroPlan(true);
                          setTextoTempOtroPlan('');
                        }}
                        style={{
                          background: 'none',
                          border: '1px dashed var(--borde-tarjeta)',
                          color: 'var(--color-primario)',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '0.24rem 0.65rem',
                          borderRadius: '16px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <Plus size={11} />
                        <span>Otro</span>
                      </button>
                    )}

                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.2rem' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--texto-secundario)' }}>Control en:</span>
                      <input
                        type="text"
                        value={planControlMeses}
                        onChange={(e) => setPlanControlMeses(e.target.value.replace(/[^\d]/g, ''))}
                        placeholder="12"
                        className="modal-input"
                        style={{ width: '48px', height: '28px', textAlign: 'center', padding: '0 0.2rem', fontSize: '0.74rem' }}
                      />
                      <span style={{ fontSize: '0.74rem', color: 'var(--texto-secundario)' }}>meses</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECCIÓN 6: OBSERVACIONES Y ESPECIALISTA TRATANTE (Recuadro blanco uniforme) */}
              <div
                style={{
                  border: '1px solid var(--borde-tarjeta)',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  background: 'var(--fondo-tarjeta)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '0.85rem',
                }}
              >
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="modal-label" style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Observaciones</label>
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    className="modal-textarea"
                    rows={2}
                    placeholder="Comentarios adicionales o notas específicas del examen..."
                    style={{ minHeight: '48px', fontSize: '0.78rem' }}
                  />
                </div>

                <div>
                  <label className="modal-label" style={{ fontWeight: 600 }}>Optómetra / Especialista *</label>
                  <input
                    type="text"
                    value={optometra}
                    onChange={(e) => setOptometra(e.target.value)}
                    onBlur={() => setOptometra(formatearNombreEspecialista(optometra))}
                    placeholder="Nombre y apellido del especialista"
                    className="modal-input"
                    style={{ height: '34px' }}
                  />
                </div>

                <div>
                  <label className="modal-label" style={{ fontWeight: 600 }}>Tarjeta Profesional (T.P.)</label>
                  <input
                    type="text"
                    value={tarjetaProfesional}
                    onChange={(e) => setTarjetaProfesional(e.target.value)}
                    placeholder="Ej: OPT-84920"
                    className="modal-input"
                    style={{ height: '34px' }}
                  />
                </div>
              </div>
            </div>
        )}

        {/* ========================================================= */}
        {/* PASO 2: FÓRMULA ÓPTICA                                    */}
        {/* ========================================================= */}
        {pasoActual === 2 && (
          <div
            className="scroll-suave-optica"
            style={{
              flex: '1 1 0%',
              overflowY: 'auto',
              padding: '1.2rem 1.4rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.1rem',
            }}
          >
            {/* Resumen Clínico Previo */}
            <div
              style={{
                background: 'var(--color-primario-transparente, rgba(2, 132, 199, 0.08))',
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.78rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--texto-atenuado)' }}>Diagnóstico asociado: </span>
                <strong style={{ color: 'var(--texto-principal)' }}>{diagnostico}</strong>
              </div>
              <button
                type="button"
                onClick={() => setPasoActual(1)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primario)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.74rem',
                }}
              >
                <ChevronLeft size={13} />
                <span>Modificar Historia</span>
              </button>
            </div>

            {/* Tabla de Refracción OD / OI */}
            <div>
              <div
                className="modal-seccion-rotulo"
                style={{
                  marginBottom: '0.45rem',
                  textTransform: 'none',
                  letterSpacing: 'normal',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: 'var(--texto-principal)',
                }}
              >
                <span>Medición Refractiva (OD / OI)</span>
              </div>
              <div className="modal-tabla-envoltorio">
                <table className="modal-tabla-refraccion">
                  <thead>
                    <tr>
                      <th style={{ width: '12%' }}>Ojo</th>
                      <th style={{ width: '18%' }}>Esfera</th>
                      <th style={{ width: '18%' }}>Cilindro</th>
                      <th style={{ width: '16%' }}>Eje</th>
                      <th style={{ width: '18%' }}>Adición</th>
                      <th style={{ width: '18%' }}>AV</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <span className="badge-ojo-od">OD</span>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={formularioFormula.esfera_od}
                          onChange={(e) => setFormularioFormula((prev) => ({ ...prev, esfera_od: e.target.value }))}
                          onBlur={(e) => setFormularioFormula((prev) => ({ ...prev, esfera_od: formatearEsfera(e.target.value) }))}
                          className="modal-input-tabla"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={formularioFormula.cilindro_od}
                          onChange={(e) => setFormularioFormula((prev) => ({ ...prev, cilindro_od: e.target.value }))}
                          onBlur={(e) => setFormularioFormula((prev) => ({ ...prev, cilindro_od: formatearCilindro(e.target.value) }))}
                          className="modal-input-tabla"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={formularioFormula.eje_od}
                          onChange={(e) => setFormularioFormula((prev) => ({ ...prev, eje_od: e.target.value }))}
                          onBlur={(e) => setFormularioFormula((prev) => ({ ...prev, eje_od: formatearEje(e.target.value) }))}
                          className="modal-input-tabla"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={formularioFormula.adicion_od}
                          onChange={(e) => setFormularioFormula((prev) => ({ ...prev, adicion_od: e.target.value }))}
                          onBlur={(e) => setFormularioFormula((prev) => ({ ...prev, adicion_od: formatearAdicion(e.target.value) }))}
                          className="modal-input-tabla"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={formularioFormula.av_od}
                          onChange={(e) => setFormularioFormula((prev) => ({ ...prev, av_od: e.target.value }))}
                          onBlur={(e) => setFormularioFormula((prev) => ({ ...prev, av_od: formatearAV(e.target.value) }))}
                          className="modal-input-tabla"
                        />
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <span className="badge-ojo-oi">OI</span>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={formularioFormula.esfera_oi}
                          onChange={(e) => setFormularioFormula((prev) => ({ ...prev, esfera_oi: e.target.value }))}
                          onBlur={(e) => setFormularioFormula((prev) => ({ ...prev, esfera_oi: formatearEsfera(e.target.value) }))}
                          className="modal-input-tabla"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={formularioFormula.cilindro_oi}
                          onChange={(e) => setFormularioFormula((prev) => ({ ...prev, cilindro_oi: e.target.value }))}
                          onBlur={(e) => setFormularioFormula((prev) => ({ ...prev, cilindro_oi: formatearCilindro(e.target.value) }))}
                          className="modal-input-tabla"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={formularioFormula.eje_oi}
                          onChange={(e) => setFormularioFormula((prev) => ({ ...prev, eje_oi: e.target.value }))}
                          onBlur={(e) => setFormularioFormula((prev) => ({ ...prev, eje_oi: formatearEje(e.target.value) }))}
                          className="modal-input-tabla"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={formularioFormula.adicion_oi}
                          onChange={(e) => setFormularioFormula((prev) => ({ ...prev, adicion_oi: e.target.value }))}
                          onBlur={(e) => setFormularioFormula((prev) => ({ ...prev, adicion_oi: formatearAdicion(e.target.value) }))}
                          className="modal-input-tabla"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={formularioFormula.av_oi}
                          onChange={(e) => setFormularioFormula((prev) => ({ ...prev, av_oi: e.target.value }))}
                          onBlur={(e) => setFormularioFormula((prev) => ({ ...prev, av_oi: formatearAV(e.target.value) }))}
                          className="modal-input-tabla"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Parámetros Técnicos de la Prescripción */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
              {/* Fila 1 Columna 1: Distancia Pupilar */}
              <div className="modal-campo-grupo">
                <label className="modal-label">Distancia Pupilar (DP / DNP):</label>
                <input
                  type="text"
                  value={formularioFormula.distancia_pupilar}
                  onChange={(e) => setFormularioFormula((prev) => ({ ...prev, distancia_pupilar: e.target.value }))}
                  onBlur={(e) =>
                    setFormularioFormula((prev) => ({
                      ...prev,
                      distancia_pupilar: formatearDistanciaPupilar(e.target.value),
                    }))
                  }
                  className="modal-input"
                  placeholder="Ej: 64 o 32/32"
                />
              </div>

              {/* Fila 1 Columna 2: Tipo de Lente (Junto a DP) */}
              <div className="modal-campo-grupo">
                <label className="modal-label">Tipo de Lente:</label>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', height: '38px', alignItems: 'center' }}>
                  {['Monofocal', 'Bifocal', 'Progresivo'].map((t) => {
                    const seleccionado = disenoBaseFormula === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => cambiarDisenoBaseFormula(t)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          fontSize: '0.74rem',
                          fontWeight: seleccionado ? 700 : 500,
                          border: seleccionado ? '1px solid var(--color-primario)' : '1px solid var(--borde-tarjeta)',
                          background: seleccionado ? 'var(--color-primario)' : 'var(--fondo-elevado)',
                          color: seleccionado ? '#ffffff' : 'var(--texto-principal)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          flex: '1 1 auto',
                          textAlign: 'center',
                        }}
                      >
                        {seleccionado && '✓ '}{t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fila 2 (Ancho Completo): Tratamientos y Lente Prescrito */}
              <div className="modal-campo-grupo col-span-2" style={{ gridColumn: '1 / -1' }}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                    background: 'var(--fondo-tarjeta)',
                    border: '1px solid var(--borde-tarjeta)',
                    padding: '0.85rem',
                    borderRadius: '8px',
                  }}
                >
                  <div>
                    <label className="modal-label" style={{ marginBottom: '0.35rem', display: 'block', fontSize: '0.74rem' }}>
                      Tratamiento:
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                      {tiposLentes.map((trat) => {
                        const seleccionado = tratamientosSeleccionadosFormula.includes(trat.nombre);
                        return (
                          <button
                            key={trat.id}
                            type="button"
                            onClick={() => alternarTratamientoFormula(trat.nombre)}
                            style={{
                              padding: '0.22rem 0.6rem',
                              borderRadius: '16px',
                              fontSize: '0.72rem',
                              fontWeight: seleccionado ? 600 : 500,
                              border: seleccionado
                                ? '1px solid var(--color-primario)'
                                : '1px solid var(--borde-tarjeta)',
                              background: seleccionado
                                ? 'rgba(var(--color-primario-rgb, 2, 132, 199), 0.12)'
                                : 'var(--fondo-elevado)',
                              color: seleccionado
                                ? 'var(--color-primario)'
                                : 'var(--texto-secundario)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            {seleccionado ? '✓ ' : '+ '}{trat.nombre}
                          </button>
                        );
                      })}

                      {editandoOtroTratamientoFormula ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <input
                            type="text"
                            autoFocus
                            value={textoTempOtroTratamientoFormula}
                            onChange={(e) => setTextoTempOtroTratamientoFormula(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                manejarCrearOtroTratamientoFormula();
                              } else if (e.key === 'Escape') {
                                setEditandoOtroTratamientoFormula(false);
                                setTextoTempOtroTratamientoFormula('');
                              }
                            }}
                            placeholder="Nuevo..."
                            className="modal-input"
                            style={{ height: '26px', fontSize: '0.72rem', width: '120px', padding: '0.1rem 0.4rem' }}
                          />
                          <button
                            type="button"
                            onClick={manejarCrearOtroTratamientoFormula}
                            className="modal-btn-guardar"
                            style={{ height: '26px', padding: '0 0.45rem', fontSize: '0.7rem' }}
                          >
                            OK
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditandoOtroTratamientoFormula(false);
                              setTextoTempOtroTratamientoFormula('');
                            }}
                            className="modal-btn-cancelar"
                            style={{ height: '26px', padding: '0 0.35rem', fontSize: '0.7rem' }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditandoOtroTratamientoFormula(true)}
                          style={{
                            padding: '0.22rem 0.55rem',
                            borderRadius: '16px',
                            fontSize: '0.72rem',
                            border: '1px dashed var(--color-primario)',
                            background: 'transparent',
                            color: 'var(--color-primario)',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          + Otro Tratamiento
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Lente Prescrito Resultante */}
                  <div
                    style={{
                      marginTop: '0.2rem',
                      padding: '0.45rem 0.75rem',
                      borderRadius: '6px',
                      background: 'var(--fondo-elevado)',
                      border: '1px solid var(--borde-tarjeta)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span style={{ fontSize: '0.71rem', color: 'var(--texto-atenuado)', fontWeight: 600 }}>Lente a Prescribir:</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-primario)' }}>
                      {formularioFormula.tipo_lente || disenoBaseFormula}
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal-campo-grupo">
                <label className="modal-label">Próximo Control Visual:</label>
                <SelectorDesplegable
                  valor={formularioFormula.proximo_control_en_meses}
                  alCambiar={(val) => setFormularioFormula((prev) => ({ ...prev, proximo_control_en_meses: String(val) }))}
                  placeholder="Próximo control..."
                  anchoMinimo="100%"
                  opciones={[
                    { valor: '3', etiqueta: 'En 3 meses' },
                    { valor: '6', etiqueta: 'En 6 meses' },
                    { valor: '12', etiqueta: 'En 12 meses (Recomendado)' },
                    { valor: '18', etiqueta: 'En 18 meses' },
                    { valor: '24', etiqueta: 'En 24 meses' },
                  ]}
                />
              </div>

              <div className="modal-campo-grupo">
                <label className="modal-label">Optómetra:</label>
                <input
                  type="text"
                  value={optometra}
                  readOnly
                  disabled
                  className="modal-input"
                  style={{ backgroundColor: 'var(--fondo-elevado)' }}
                />
              </div>

              <div className="modal-campo-grupo" style={{ gridColumn: '1 / -1' }}>
                <label className="modal-label">Observaciones de la Fórmula:</label>
                <textarea
                  value={formularioFormula.observaciones_formula}
                  onChange={(e) => setFormularioFormula((prev) => ({ ...prev, observaciones_formula: e.target.value }))}
                  className="modal-textarea"
                  rows={2}
                  placeholder="Indicaciones específicas para el laboratorio óptico o el paciente..."
                />
              </div>
            </div>
          </div>
        )}

        {/* PIE DE ACCIONES Y NAVEGACIÓN DEL MODAL */}
        <div className="modal-pie-clinico" style={{ padding: '0.85rem 1.4rem' }}>
          {pasoActual === 1 ? (
            <>
              <button
                type="button"
                onClick={alCerrar}
                className="modal-btn-cancelar"
                disabled={cargando}
              >
                Cancelar
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <EtiquetaTooltip
                  texto={
                    historiaValida
                      ? 'Guarda la historia clínica sin prescribir fórmula en este momento'
                      : 'Completa los campos con * para guardar'
                  }
                  posicion="arriba"
                >
                  <button
                    type="button"
                    onClick={manejarGuardarSoloHistoria}
                    className="modal-btn-cancelar"
                    disabled={!historiaValida || cargando}
                    style={{
                      borderColor: 'var(--borde-tarjeta)',
                      fontWeight: 600,
                      opacity: !historiaValida || cargando ? 0.6 : 1,
                    }}
                  >
                    <Save size={14} />
                    <span>Guardar solo Historia</span>
                  </button>
                </EtiquetaTooltip>

                <EtiquetaTooltip
                  texto={
                    historiaValida
                      ? 'Guarda la historia y avanza al registro de la fórmula óptica'
                      : 'Completa motivo de consulta, diagnóstico y optómetra'
                  }
                  posicion="arriba"
                >
                  <button
                    type="button"
                    onClick={manejarAvanzarPasoFormula}
                    className="btn-primario-optica"
                    disabled={!historiaValida || cargando}
                    style={{
                      height: '34px',
                      padding: '0 1rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      borderRadius: 'var(--radio-md, 8px)',
                      cursor: !historiaValida || cargando ? 'not-allowed' : 'pointer',
                      opacity: !historiaValida || cargando ? 0.6 : 1,
                    }}
                  >
                    <span>Siguiente: Registrar Fórmula</span>
                    <ChevronRight size={15} />
                  </button>
                </EtiquetaTooltip>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setPasoActual(1)}
                className="modal-btn-cancelar"
                disabled={cargando}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <ChevronLeft size={15} />
                <span>Volver a Historia Clínica</span>
              </button>

              <EtiquetaTooltip
                texto={
                  formulaValida
                    ? 'Verificar y guardar prescripción final'
                    : 'Diligencia los campos refractivos para guardar'
                }
                posicion="arriba"
              >
                <button
                  type="button"
                  onClick={() => setModalConfirmacionFormula(true)}
                  className="modal-btn-guardar"
                  disabled={!formulaValida || cargando}
                  style={{
                    opacity: !formulaValida || cargando ? 0.6 : 1,
                    cursor: !formulaValida || cargando ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Save size={15} />
                  <span>Finalizar y Guardar Todo</span>
                </button>
              </EtiquetaTooltip>
            </>
          )}
        </div>

        {/* Modal Confirmación de Fórmula Final */}
        {modalConfirmacionFormula && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(3px)',
              zIndex: 1150,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.25rem',
            }}
          >
            <div
              className="modal-tarjeta-clinica"
              style={{
                maxWidth: '460px',
                width: '100%',
                padding: '1.5rem',
                gap: '1.2rem',
                border: '1px solid var(--borde-tarjeta)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--texto-principal)' }}>
                    Confirmar Prescripción Óptica
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--texto-atenuado)' }}>
                    {obtenerNombrePaciente(contacto)}
                  </p>
                </div>
              </div>

              <div
                style={{
                  background: 'var(--fondo-elevado)',
                  border: '1px solid var(--borde-tarjeta)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  fontSize: '0.78rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <div>
                  <strong>OD:</strong> {formularioFormula.esfera_od} / {formularioFormula.cilindro_od} x {formularioFormula.eje_od} (Ad: {formularioFormula.adicion_od} | AV: {formularioFormula.av_od})
                </div>
                <div>
                  <strong>OI:</strong> {formularioFormula.esfera_oi} / {formularioFormula.cilindro_oi} x {formularioFormula.eje_oi} (Ad: {formularioFormula.adicion_oi} | AV: {formularioFormula.av_oi})
                </div>
                <div>
                  <strong>Lente:</strong> {formularioFormula.tipo_lente} • <strong>DP:</strong> {formularioFormula.distancia_pupilar}
                </div>
                <div>
                  <strong>Especialista:</strong> {optometra}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
                <button
                  type="button"
                  onClick={() => setModalConfirmacionFormula(false)}
                  className="modal-btn-cancelar"
                  disabled={cargando}
                >
                  Modificar
                </button>
                <button
                  type="button"
                  onClick={manejarGuardarFormulaFinal}
                  className="modal-btn-guardar"
                  disabled={cargando}
                >
                  <span>Confirmar y Guardar</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
