'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Users,
  Building2,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Search,
  RefreshCw,
  Key,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff,
  User,
  Mail,
  Lock,
  Building,
  Shield,
  Clock,
  Calendar,
  Plus,
  Upload,
  RotateCcw,
  Image as ImageIcon,
  Check,
  X,
  Bot,
  Sparkles,
} from 'lucide-react';
import { SelectorDesplegable } from '../comunes/SelectorDesplegable';
import { SelectorColorPopover } from '../comunes/SelectorColorPopover';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';
import { BarraPaginacionTabla } from '../comunes/BarraPaginacionTabla';
import { BarraPestanas } from '../comunes/BarraPestanas';
import { FiltroBusqueda } from '../comunes/FiltroBusqueda';
import {
  obtenerUsuariosApi,
  crearUsuarioApi,
  actualizarUsuarioApi,
  cambiarEstadoUsuarioApi,
  eliminarUsuarioApi,
  obtenerUsuarioSesion,
  crearOpticaApi,
  actualizarOpticaApi,
  cambiarEstadoOpticaApi,
  cambiarIaOpticaApi,
  subirLogoOpticaApi,
  obtenerOpticaSesion,
  guardarOpticaSesion,
} from '@/servicios/api_crm';
import type { Usuario, EstadisticasUsuarios, Optica } from '@/tipos/crm';

interface PropiedadesModuloUsuarios {
  opticasDisponibles?: { id: number; nombre: string }[];
}

export const ModuloUsuarios: React.FC<PropiedadesModuloUsuarios> = ({
  opticasDisponibles = [],
}) => {
  // Usuario en sesión
  const [usuarioSesion, setUsuarioSesion] = useState<Usuario | null>(null);

  // Pestaña activa ('usuarios' | 'opticas')
  const [pestanaActiva, setPestanaActiva] = useState<'usuarios' | 'opticas'>('usuarios');

  // Estados de datos
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [opticas, setOpticas] = useState<Optica[]>([]);
  const [estadisticas, setEstadisticas] = useState<EstadisticasUsuarios>({
    total_usuarios: 0,
    total_activos: 0,
    total_inactivos: 0,
    total_opticas: 0,
    total_admins: 0,
    total_admins_optica: 0,
  });
  const [cargando, setCargando] = useState(true);
  const [mensajeNotificacion, setMensajeNotificacion] = useState<{
    tipo: 'exito' | 'error';
    texto: string;
  } | null>(null);

  // Filtros de usuarios
  const [busquedaTexto, setBusquedaTexto] = useState('');
  const [filtroRol, setFiltroRol] = useState<string>('todos'); // 'todos' | 'admin' | 'admin_optica'
  const [filtroOptica, setFiltroOptica] = useState<string>('todas');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos'); // 'todos' | 'activos' | 'inactivos'

  // Filtros de ópticas
  const [busquedaOptica, setBusquedaOptica] = useState('');
  const [filtroEstadoOptica, setFiltroEstadoOptica] = useState<string>('todos'); // 'todos' | 'activas' | 'inactivas'

  // Modales de usuarios
  const [modalFormularioAbierto, setModalFormularioAbierto] = useState(false);
  const [usuarioParaEditar, setUsuarioParaEditar] = useState<Usuario | null>(null);

  const [modalClaveAbierto, setModalClaveAbierto] = useState(false);
  const [usuarioParaClave, setUsuarioParaClave] = useState<Usuario | null>(null);

  const [modalEliminarAbierto, setModalEliminarAbierto] = useState(false);
  const [usuarioParaEliminar, setUsuarioParaEliminar] = useState<Usuario | null>(null);

  // Modal de Óptica
  const [modalOpticaAbierto, setModalOpticaAbierto] = useState(false);
  const [opticaParaEditar, setOpticaParaEditar] = useState<Optica | null>(null);
  const [formOpticaNombre, setFormOpticaNombre] = useState('');
  const [formOpticaSlug, setFormOpticaSlug] = useState('');
  const [formOpticaColorPrimario, setFormOpticaColorPrimario] = useState('#0d2167');
  const [formOpticaColorSecundario, setFormOpticaColorSecundario] = useState('#08133f');
  const [formOpticaActivo, setFormOpticaActivo] = useState(true);
  const [formOpticaIaHabilitada, setFormOpticaIaHabilitada] = useState(true);
  const [formOpticaLogoUrl, setFormOpticaLogoUrl] = useState<string | null>(null);
  const [archivoLogoOptica, setArchivoLogoOptica] = useState<File | null>(null);
  const [previsualizacionLogoOptica, setPrevisualizacionLogoOptica] = useState<string | null>(null);
  const [logoEliminado, setLogoEliminado] = useState(false);
  const refInputLogoOptica = useRef<HTMLInputElement>(null);
  const [guardandoOptica, setGuardandoOptica] = useState(false);
  const [errorOptica, setErrorOptica] = useState<string | null>(null);

  // Modal de confirmación de cambios al editar óptica
  const [modalConfirmarCambiosOpticaAbierto, setModalConfirmarCambiosOpticaAbierto] = useState(false);
  const [listaCambiosOptica, setListaCambiosOptica] = useState<
    Array<{
      campo: string;
      anterior: string;
      nuevo: string;
      tipo: 'texto' | 'color' | 'logo' | 'estado';
      nota?: string;
    }>
  >([]);

  // Estados de formulario Crear / Editar Usuario
  const [formNombre, setFormNombre] = useState('');
  const [formUsuario, setFormUsuario] = useState('');
  const [formCorreo, setFormCorreo] = useState('');
  const [formRol, setFormRol] = useState<'admin' | 'admin_optica'>('admin_optica');
  const [formOpticaId, setFormOpticaId] = useState<string>('');
  const [formContrasena, setFormContrasena] = useState('');
  const [formActivo, setFormActivo] = useState(true);
  const [guardandoFormulario, setGuardandoFormulario] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);

  // Estados de formulario Cambiar Contraseña
  const [nuevaClave, setNuevaClave] = useState('');
  const [confirmarClave, setConfirmarClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [guardandoClave, setGuardandoClave] = useState(false);
  const [errorClave, setErrorClave] = useState<string | null>(null);

  // Estado para eliminar usuario
  const [eliminando, setEliminando] = useState(false);

  // Cargar usuario en sesión
  useEffect(() => {
    const u = obtenerUsuarioSesion();
    setUsuarioSesion(u);
  }, []);

  // Notificación con temporizador
  const notificar = useCallback((tipo: 'exito' | 'error', texto: string) => {
    setMensajeNotificacion({ tipo, texto });
    setTimeout(() => {
      setMensajeNotificacion((prev) => (prev?.texto === texto ? null : prev));
    }, 4000);
  }, []);

  // Cargar usuarios y ópticas desde la API
  const cargarUsuarios = useCallback(async () => {
    try {
      setCargando(true);
      const res = await obtenerUsuariosApi();
      if (res.exito) {
        setUsuarios(res.usuarios || []);
        if (res.opticas && res.opticas.length > 0) {
          setOpticas(
            res.opticas.map((o: any) => ({
              id: Number(o.id),
              nombre: o.nombre || 'Óptica',
              slug: o.slug || '',
              telefono: o.telefono || null,
              logo_url: o.logo_url || null,
              color_primario: o.color_primario || '#0d2167',
              color_secundario: o.color_secundario || '#08133f',
              activo: o.activo !== false,
              ia_activa: Boolean(o.ia_activa ?? true),
              ia_habilitada: o.ia_habilitada !== undefined ? Boolean(o.ia_habilitada) : true,
              total_usuarios: Number(o.total_usuarios || 0),
            }))
          );
        }
        if (res.estadisticas) {
          setEstadisticas(res.estadisticas);
        }
      } else {
        notificar('error', res.error || 'Error al consultar la lista de usuarios');
      }
    } catch {
      notificar('error', 'Error inesperado al conectar con el servidor');
    } finally {
      setCargando(false);
    }
  }, [notificar]);

  useEffect(() => {
    cargarUsuarios();
    const alActualizarOptica = () => cargarUsuarios();
    window.addEventListener('crm_cambio_optica', alActualizarOptica);
    window.addEventListener('crm_recargar_opticas', alActualizarOptica);
    return () => {
      window.removeEventListener('crm_cambio_optica', alActualizarOptica);
      window.removeEventListener('crm_recargar_opticas', alActualizarOptica);
    };
  }, [cargarUsuarios]);

  // Configuración de pestañas con componente estandarizado BarraPestanas
  const pestanasModulo = useMemo(
    () => [
      {
        id: 'usuarios' as const,
        etiqueta: 'Usuarios',
        icono: Users,
        conteo: usuarios.length,
      },
      {
        id: 'opticas' as const,
        etiqueta: 'Ópticas',
        icono: Building2,
        conteo: opticas.length,
      },
    ],
    [usuarios.length, opticas.length]
  );

  // Lista de ópticas unificada para selects
  const listaOpticasFinal = useMemo(() => {
    if (opticas.length > 0) return opticas;
    return opticasDisponibles.map((o) => ({
      id: o.id,
      nombre: o.nombre,
      slug: '',
      telefono: null,
      logo_url: null,
      color_primario: '#0d2167',
      color_secundario: '#08133f',
      activo: true,
      total_usuarios: 0,
    }));
  }, [opticas, opticasDisponibles]);

  // Opciones de filtro para SelectorDesplegable
  const opcionesFiltroRol = useMemo(
    () => [
      { valor: 'todos', etiqueta: 'Todos los roles' },
      { valor: 'admin', etiqueta: 'Admin Global' },
      { valor: 'admin_optica', etiqueta: 'Admin de Óptica' },
    ],
    []
  );

  const opcionesFiltroOptica = useMemo(() => {
    const lista = [{ valor: 'todas', etiqueta: 'Todas las ópticas' }];
    for (const opt of listaOpticasFinal) {
      lista.push({
        valor: String(opt.id),
        etiqueta: opt.nombre,
      });
    }
    return lista;
  }, [listaOpticasFinal]);

  const opcionesFiltroEstado = useMemo(
    () => [
      { valor: 'todos', etiqueta: 'Todos los estados' },
      { valor: 'activos', etiqueta: 'Activos' },
      { valor: 'inactivos', etiqueta: 'Inactivos' },
    ],
    []
  );

  // Filtrado de usuarios en cliente
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((u) => {
      // Texto: nombre, usuario o correo
      if (busquedaTexto.trim()) {
        const query = busquedaTexto.toLowerCase();
        const coincideNombre = u.nombre?.toLowerCase().includes(query);
        const coincideUsuario = u.usuario?.toLowerCase().includes(query);
        const coincideCorreo = u.correo?.toLowerCase().includes(query);
        const coincideOptica = u.optica_nombre?.toLowerCase().includes(query);
        if (!coincideNombre && !coincideUsuario && !coincideCorreo && !coincideOptica) {
          return false;
        }
      }

      // Rol
      if (filtroRol !== 'todos' && u.rol !== filtroRol) {
        return false;
      }

      // Óptica
      if (filtroOptica !== 'todas') {
        if (Number(u.optica_id) !== Number(filtroOptica)) {
          return false;
        }
      }

      // Estado
      if (filtroEstado === 'activos' && !u.activo) return false;
      if (filtroEstado === 'inactivos' && u.activo) return false;

      return true;
    });
  }, [usuarios, busquedaTexto, filtroRol, filtroOptica, filtroEstado]);

  // Estados de paginación estandarizada (predeterminado: 5 registros)
  const [paginaActual, setPaginaActual] = useState(1);
  const [limitePorPagina, setLimitePorPagina] = useState(5);

  // Reiniciar a la primera página al cambiar filtros o términos de búsqueda
  useEffect(() => {
    setPaginaActual(1);
  }, [busquedaTexto, filtroRol, filtroOptica, filtroEstado]);

  // Segmentación por páginas de usuarios
  const totalRegistros = usuariosFiltrados.length;
  const usuariosPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * limitePorPagina;
    return usuariosFiltrados.slice(inicio, inicio + limitePorPagina);
  }, [usuariosFiltrados, paginaActual, limitePorPagina]);

  // Opciones de filtro para estado de óptica
  const opcionesFiltroEstadoOptica = useMemo(
    () => [
      { valor: 'todos', etiqueta: 'Todos los estados' },
      { valor: 'activas', etiqueta: 'Activas' },
      { valor: 'inactivas', etiqueta: 'Inactivas' },
    ],
    []
  );

  // Estados de paginación para ópticas
  const [paginaActualOpticas, setPaginaActualOpticas] = useState(1);
  const [limitePorPaginaOpticas, setLimitePorPaginaOpticas] = useState(5);

  // Función para normalizar texto a slug identificador
  const generarSlugOptica = (nombre: string): string => {
    return nombre
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  // Filtrado de ópticas en cliente
  const opticasFiltradas = useMemo(() => {
    return opticas.filter((o) => {
      if (busquedaOptica.trim()) {
        const query = busquedaOptica.toLowerCase();
        const coincideNombre = o.nombre?.toLowerCase().includes(query);
        const coincideSlug = o.slug?.toLowerCase().includes(query);
        if (!coincideNombre && !coincideSlug) return false;
      }
      if (filtroEstadoOptica === 'activas' && !o.activo) return false;
      if (filtroEstadoOptica === 'inactivas' && o.activo) return false;
      return true;
    });
  }, [opticas, busquedaOptica, filtroEstadoOptica]);

  // Reiniciar página de ópticas al cambiar filtros
  useEffect(() => {
    setPaginaActualOpticas(1);
  }, [busquedaOptica, filtroEstadoOptica]);

  // Segmentación por páginas de ópticas
  const totalOpticasRegistros = opticasFiltradas.length;
  const opticasPaginadas = useMemo(() => {
    const inicio = (paginaActualOpticas - 1) * limitePorPaginaOpticas;
    return opticasFiltradas.slice(inicio, inicio + limitePorPaginaOpticas);
  }, [opticasFiltradas, paginaActualOpticas, limitePorPaginaOpticas]);

  // Manejar selección de archivo para el logo de la óptica
  const manejarSeleccionarArchivoLogoOptica = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    if (!archivo.type.startsWith('image/')) {
      setErrorOptica('Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP, SVG)');
      return;
    }

    setArchivoLogoOptica(archivo);
    const urlPrevia = URL.createObjectURL(archivo);
    setPrevisualizacionLogoOptica(urlPrevia);
    setLogoEliminado(false);
    setErrorOptica(null);
  };

  // Descartar archivo nuevo seleccionado de logo
  const manejarDescartarLogoOptica = () => {
    if (previsualizacionLogoOptica) {
      URL.revokeObjectURL(previsualizacionLogoOptica);
    }
    setArchivoLogoOptica(null);
    setPrevisualizacionLogoOptica(null);
    if (refInputLogoOptica.current) {
      refInputLogoOptica.current.value = '';
    }
  };

  // Eliminar logo de la óptica (marcar para borrar en base de datos)
  const manejarEliminarLogoOptica = () => {
    manejarDescartarLogoOptica();
    setFormOpticaLogoUrl(null);
    setLogoEliminado(true);
  };

  // Restaurar logo original guardado previamente
  const manejarRestaurarLogoOriginal = () => {
    manejarDescartarLogoOptica();
    if (opticaParaEditar?.logo_url) {
      setFormOpticaLogoUrl(opticaParaEditar.logo_url);
    }
    setLogoEliminado(false);
  };

  // Convertir archivo File a Base64
  const convertirArchivoABase64 = (archivo: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.readAsDataURL(archivo);
      lector.onload = () => resolve(lector.result as string);
      lector.onerror = (error) => reject(error);
    });
  };

  // Manejar apertura modal crear óptica
  const abrirModalCrearOptica = () => {
    setOpticaParaEditar(null);
    setFormOpticaNombre('');
    setFormOpticaSlug('');
    setFormOpticaColorPrimario('#0d2167');
    setFormOpticaColorSecundario('#08133f');
    setFormOpticaActivo(true);
    setFormOpticaIaHabilitada(true);
    setFormOpticaLogoUrl(null);
    setLogoEliminado(false);
    manejarDescartarLogoOptica();
    setErrorOptica(null);
    setModalOpticaAbierto(true);
  };

  // Manejar apertura modal editar óptica
  const abrirModalEditarOptica = (optica: Optica) => {
    setOpticaParaEditar(optica);
    setFormOpticaNombre(optica.nombre || '');
    setFormOpticaSlug(optica.slug || generarSlugOptica(optica.nombre || ''));
    setFormOpticaColorPrimario(optica.color_primario || '#0d2167');
    setFormOpticaColorSecundario(optica.color_secundario || '#08133f');
    setFormOpticaActivo(optica.activo !== false);
    setFormOpticaIaHabilitada(optica.ia_habilitada !== false);
    setFormOpticaLogoUrl(optica.logo_url || null);
    setLogoEliminado(false);
    manejarDescartarLogoOptica();
    setErrorOptica(null);
    setModalOpticaAbierto(true);
  };

  // Solicitar confirmación de cambios antes de guardar (o crear directamente si es nueva)
  const manejarSolicitarGuardarOptica = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorOptica(null);

    const nombreLimpio = formOpticaNombre.trim();
    if (!nombreLimpio) {
      setErrorOptica('El nombre de la óptica es obligatorio');
      return;
    }

    // Si es creación nueva de óptica, guardar sin modal de confirmación de edición
    if (!opticaParaEditar) {
      ejecutarGuardarOptica();
      return;
    }

    // Detectar cambios realizados en la edición de la sede
    const cambios: Array<{
      campo: string;
      anterior: string;
      nuevo: string;
      tipo: 'texto' | 'color' | 'logo' | 'estado';
      nota?: string;
    }> = [];

    const nombreOriginal = (opticaParaEditar.nombre || '').trim();
    if (nombreLimpio !== nombreOriginal) {
      cambios.push({
        campo: 'Nombre Comercial',
        anterior: nombreOriginal || 'Sin nombre',
        nuevo: nombreLimpio,
        tipo: 'texto',
      });
    }

    const colorPrimarioOriginal = (opticaParaEditar.color_primario || '#0d2167').toLowerCase();
    const colorPrimarioActual = formOpticaColorPrimario.toLowerCase();
    if (colorPrimarioActual !== colorPrimarioOriginal) {
      cambios.push({
        campo: 'Color Primario (Marca)',
        anterior: colorPrimarioOriginal,
        nuevo: colorPrimarioActual,
        tipo: 'color',
      });
    }

    const colorSecundarioOriginal = (opticaParaEditar.color_secundario || '#08133f').toLowerCase();
    const colorSecundarioActual = formOpticaColorSecundario.toLowerCase();
    if (colorSecundarioActual !== colorSecundarioOriginal) {
      cambios.push({
        campo: 'Color Secundario (Oscuro)',
        anterior: colorSecundarioOriginal,
        nuevo: colorSecundarioActual,
        tipo: 'color',
      });
    }

    if (archivoLogoOptica) {
      cambios.push({
        campo: 'Logo Corporativo',
        anterior: opticaParaEditar.logo_url ? 'Logotipo actual' : 'Sin logotipo',
        nuevo: archivoLogoOptica.name,
        tipo: 'logo',
        nota: 'La imagen previa será reemplazada en el almacenamiento seguro institucional.',
      });
    } else if (logoEliminado && opticaParaEditar.logo_url) {
      cambios.push({
        campo: 'Logo Corporativo',
        anterior: 'Logotipo actual',
        nuevo: 'Eliminado (Sin logotipo)',
        tipo: 'logo',
        nota: 'La imagen se eliminará permanentemente de Supabase Storage.',
      });
    }

    const activoOriginal = opticaParaEditar.activo !== false;
    if (formOpticaActivo !== activoOriginal) {
      cambios.push({
        campo: 'Estado de la Sede',
        anterior: activoOriginal ? 'Activa y Operativa' : 'Suspendida / Inactiva',
        nuevo: formOpticaActivo ? 'Activa y Operativa' : 'Suspendida / Inactiva',
        tipo: 'estado',
      });
    }

    const iaHabilitadaOriginal = opticaParaEditar.ia_habilitada !== false;
    if (formOpticaIaHabilitada !== iaHabilitadaOriginal) {
      cambios.push({
        campo: 'Módulo de Inteligencia Artificial',
        anterior: iaHabilitadaOriginal ? 'Servicio Habilitado' : 'Servicio Deshabilitado / Oculto',
        nuevo: formOpticaIaHabilitada ? 'Servicio Habilitado' : 'Servicio Deshabilitado / Oculto',
        tipo: 'estado',
        nota: formOpticaIaHabilitada
          ? 'La sede tendrá acceso a la configuración de IA y respuestas automáticas.'
          : 'El módulo de IA quedará completamente oculto en su panel y el bot no procesará mensajes.',
      });
    }

    if (cambios.length === 0) {
      setErrorOptica('No se han detectado modificaciones pendientes en la óptica.');
      return;
    }

    setListaCambiosOptica(cambios);
    setModalConfirmarCambiosOpticaAbierto(true);
  };

  // Ejecutar el guardado en base de datos y Supabase Storage
  const ejecutarGuardarOptica = async () => {
    setGuardandoOptica(true);
    setErrorOptica(null);
    try {
      if (opticaParaEditar) {
        let urlLogoFinal: string | null = opticaParaEditar.logo_url || null;

        // Si se marcó explícitamente para eliminar
        if (logoEliminado) {
          urlLogoFinal = null;
        }

        // Si se cargó un nuevo archivo de logo, subirlo a Supabase Storage y asociarlo
        if (archivoLogoOptica) {
          const base64 = await convertirArchivoABase64(archivoLogoOptica);
          const resLogo = await subirLogoOpticaApi({
            imagen_base64: base64,
            tipo_mime: archivoLogoOptica.type || 'image/png',
            nombre_archivo: archivoLogoOptica.name,
            optica_id: opticaParaEditar.id,
          });

          if (!resLogo.exito) {
            setErrorOptica(resLogo.error || 'No se pudo subir la imagen del logotipo');
            setGuardandoOptica(false);
            setModalConfirmarCambiosOpticaAbierto(false);
            return;
          }
          urlLogoFinal = resLogo.logo_url || null;
        }

        const res = await actualizarOpticaApi({
          id: opticaParaEditar.id,
          nombre: formOpticaNombre.trim(),
          slug: formOpticaSlug.trim() || undefined,
          color_primario: formOpticaColorPrimario,
          color_secundario: formOpticaColorSecundario,
          logo_url: urlLogoFinal,
          activo: formOpticaActivo,
          ia_habilitada: formOpticaIaHabilitada,
        });

        if (res.exito) {
          // Actualización inmediata en el estado de ópticas
          setOpticas((prev) =>
            prev.map((o) =>
              o.id === opticaParaEditar.id
                ? {
                    ...o,
                    nombre: formOpticaNombre.trim(),
                    slug: formOpticaSlug.trim() || o.slug,
                    color_primario: formOpticaColorPrimario,
                    color_secundario: formOpticaColorSecundario,
                    logo_url: urlLogoFinal,
                    activo: formOpticaActivo,
                    ia_habilitada: formOpticaIaHabilitada,
                  }
                : o
            )
          );

          notificar('exito', `Óptica "${formOpticaNombre}" actualizada correctamente`);
          const optSesion = obtenerOpticaSesion();
          if (optSesion && Number(optSesion.id) === Number(opticaParaEditar.id)) {
            const optActualizada = {
              ...optSesion,
              nombre: formOpticaNombre.trim(),
              slug: formOpticaSlug.trim() || optSesion.slug,
              color_primario: formOpticaColorPrimario,
              color_secundario: formOpticaColorSecundario,
              logo_url: urlLogoFinal,
              activo: formOpticaActivo,
              ia_habilitada: formOpticaIaHabilitada,
            };
            guardarOpticaSesion(optActualizada);
          }
          setModalConfirmarCambiosOpticaAbierto(false);
          setModalOpticaAbierto(false);
          await cargarUsuarios();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('crm_cambio_optica'));
            window.dispatchEvent(new Event('crm_recargar_opticas'));
          }
        } else {
          setErrorOptica(res.error || 'No se pudo actualizar la óptica');
          setModalConfirmarCambiosOpticaAbierto(false);
        }
      } else {
        // 1. Crear óptica primero
        const res = await crearOpticaApi({
          nombre: formOpticaNombre.trim(),
          slug: formOpticaSlug.trim() || undefined,
          color_primario: formOpticaColorPrimario,
          color_secundario: formOpticaColorSecundario,
          activo: formOpticaActivo,
          ia_habilitada: formOpticaIaHabilitada,
        });

        if (res.exito && res.optica) {
          const nuevaOpticaId = res.optica.id;

          // 2. Si se adjuntó un logo para la nueva óptica, subirlo ahora
          if (archivoLogoOptica && nuevaOpticaId) {
            try {
              const base64 = await convertirArchivoABase64(archivoLogoOptica);
              const resLogo = await subirLogoOpticaApi({
                imagen_base64: base64,
                tipo_mime: archivoLogoOptica.type || 'image/png',
                nombre_archivo: archivoLogoOptica.name,
                optica_id: nuevaOpticaId,
              });
              if (resLogo.exito && resLogo.logo_url) {
                await actualizarOpticaApi({
                  id: nuevaOpticaId,
                  logo_url: resLogo.logo_url,
                });
              }
            } catch (errLogo) {
              console.warn('Aviso: Óptica creada pero hubo un error al cargar el logo inicial:', errLogo);
            }
          }

          notificar('exito', `Óptica "${formOpticaNombre}" creada exitosamente`);
          setModalOpticaAbierto(false);
          await cargarUsuarios();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('crm_cambio_optica'));
            window.dispatchEvent(new Event('crm_recargar_opticas'));
          }
        } else {
          setErrorOptica(res.error || 'No se pudo crear la óptica');
        }
      }
    } catch {
      setErrorOptica('Error de red al procesar la óptica');
      setModalConfirmarCambiosOpticaAbierto(false);
    } finally {
      setGuardandoOptica(false);
    }
  };

  // Alternar estado activo / inactivo de la óptica
  const manejarCambiarEstadoOptica = async (optica: Optica) => {
    const estadoPrevio = optica.activo !== false;
    const nuevoEstado = !estadoPrevio;

    // Actualización optimista instantánea en UI
    setOpticas((prev) =>
      prev.map((o) => (o.id === optica.id ? { ...o, activo: nuevoEstado } : o))
    );

    try {
      const res = await cambiarEstadoOpticaApi(optica.id, nuevoEstado);
      if (res.exito) {
        notificar(
          'exito',
          `Óptica "${optica.nombre}" ${nuevoEstado ? 'activada' : 'desactivada'}`
        );
        await cargarUsuarios();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('crm_cambio_optica'));
          window.dispatchEvent(new Event('crm_recargar_opticas'));
        }
      } else {
        // Revertir estado si falló
        setOpticas((prev) =>
          prev.map((o) => (o.id === optica.id ? { ...o, activo: estadoPrevio } : o))
        );
        notificar('error', res.error || 'No se pudo cambiar el estado de la óptica');
      }
    } catch {
      setOpticas((prev) =>
        prev.map((o) => (o.id === optica.id ? { ...o, activo: estadoPrevio } : o))
      );
      notificar('error', 'Error al cambiar estado de la óptica');
    }
  };

  // Alternar servicio IA de la óptica
  const manejarCambiarIaOptica = async (optica: Optica) => {
    const estadoPrevio = optica.ia_habilitada !== false;
    const nuevoEstado = !estadoPrevio;

    // Actualización optimista instantánea en UI
    setOpticas((prev) =>
      prev.map((o) => (o.id === optica.id ? { ...o, ia_habilitada: nuevoEstado } : o))
    );

    try {
      const res = await cambiarIaOpticaApi(optica.id, nuevoEstado);
      if (res.exito) {
        notificar(
          'exito',
          `Módulo IA para "${optica.nombre}" ${nuevoEstado ? 'habilitado' : 'deshabilitado'}`
        );
        const optSesion = obtenerOpticaSesion();
        if (optSesion && Number(optSesion.id) === Number(optica.id)) {
          const optActualizada = { ...optSesion, ia_habilitada: nuevoEstado };
          guardarOpticaSesion(optActualizada);
        }
        await cargarUsuarios();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('crm_cambio_optica'));
          window.dispatchEvent(new Event('crm_recargar_opticas'));
        }
      } else {
        // Revertir estado si falló
        setOpticas((prev) =>
          prev.map((o) => (o.id === optica.id ? { ...o, ia_habilitada: estadoPrevio } : o))
        );
        notificar('error', res.error || 'No se pudo cambiar el servicio IA de la óptica');
      }
    } catch {
      setOpticas((prev) =>
        prev.map((o) => (o.id === optica.id ? { ...o, ia_habilitada: estadoPrevio } : o))
      );
      notificar('error', 'Error al cambiar servicio IA de la óptica');
    }
  };

  // Manejar apertura modal de creación
  const abrirModalCrear = () => {
    setUsuarioParaEditar(null);
    setFormNombre('');
    setFormUsuario('');
    setFormCorreo('');
    setFormRol('admin_optica');
    setFormOpticaId(listaOpticasFinal.length > 0 ? String(listaOpticasFinal[0].id) : '');
    setFormContrasena('');
    setFormActivo(true);
    setErrorFormulario(null);
    setModalFormularioAbierto(true);
  };

  // Manejar apertura modal de edición
  const abrirModalEditar = (u: Usuario) => {
    setUsuarioParaEditar(u);
    setFormNombre(u.nombre || '');
    setFormUsuario(u.usuario || '');
    setFormCorreo(u.correo || '');
    setFormRol(u.rol as 'admin' | 'admin_optica');
    setFormOpticaId(u.optica_id ? String(u.optica_id) : '');
    setFormContrasena('');
    setFormActivo(Boolean(u.activo));
    setErrorFormulario(null);
    setModalFormularioAbierto(true);
  };

  // Guardar formulario (Crear o Actualizar)
  const manejarGuardarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorFormulario(null);

    if (!formNombre.trim()) {
      setErrorFormulario('El nombre completo es obligatorio');
      return;
    }
    if (!formUsuario.trim()) {
      setErrorFormulario('El nombre de usuario es obligatorio');
      return;
    }

    if (!usuarioParaEditar && (!formContrasena || formContrasena.length < 6)) {
      setErrorFormulario('La contraseña inicial debe tener al menos 6 caracteres');
      return;
    }

    setGuardandoFormulario(true);
    try {
      const opticaIdNumero = formOpticaId ? Number(formOpticaId) : null;

      if (usuarioParaEditar) {
        // Actualizar
        const res = await actualizarUsuarioApi({
          id: usuarioParaEditar.id,
          nombre: formNombre.trim(),
          usuario: formUsuario.trim().toLowerCase(),
          correo: formCorreo.trim() || null,
          rol: formRol,
          optica_id: opticaIdNumero,
          activo: formActivo,
          contrasena: formContrasena.trim() ? formContrasena : undefined,
        });

        if (res.exito && res.usuario) {
          notificar('exito', `Usuario ${res.usuario.nombre} actualizado correctamente`);
          setModalFormularioAbierto(false);
          await cargarUsuarios();
        } else {
          setErrorFormulario(res.error || 'No se pudo actualizar el usuario');
        }
      } else {
        // Crear
        const res = await crearUsuarioApi({
          nombre: formNombre.trim(),
          usuario: formUsuario.trim().toLowerCase(),
          correo: formCorreo.trim() || null,
          rol: formRol,
          optica_id: opticaIdNumero,
          activo: formActivo,
          contrasena: formContrasena,
        });

        if (res.exito && res.usuario) {
          notificar('exito', `Usuario ${res.usuario.nombre} creado exitosamente`);
          setModalFormularioAbierto(false);
          await cargarUsuarios();
        } else {
          setErrorFormulario(res.error || 'No se pudo crear el usuario');
        }
      }
    } catch {
      setErrorFormulario('Error de conexión al guardar el usuario');
    } finally {
      setGuardandoFormulario(false);
    }
  };

  // Alternar estado activo/inactivo directamente desde la tabla
  const manejarCambiarEstado = async (u: Usuario) => {
    if (usuarioSesion && Number(u.id) === Number(usuarioSesion.id)) {
      notificar('error', 'No puedes desactivar tu propia cuenta en sesión');
      return;
    }

    const nuevoEstado = !u.activo;
    try {
      const res = await cambiarEstadoUsuarioApi(u.id, nuevoEstado);
      if (res.exito) {
        setUsuarios((prev) =>
          prev.map((item) => (item.id === u.id ? { ...item, activo: nuevoEstado } : item))
        );
        setEstadisticas((prev) => ({
          ...prev,
          total_activos: nuevoEstado ? prev.total_activos + 1 : prev.total_activos - 1,
          total_inactivos: nuevoEstado ? prev.total_inactivos - 1 : prev.total_inactivos + 1,
        }));
        notificar('exito', `Usuario ${u.nombre} marcado como ${nuevoEstado ? 'Activo' : 'Inactivo'}`);
      } else {
        notificar('error', res.error || 'No se pudo cambiar el estado');
      }
    } catch {
      notificar('error', 'Error al cambiar estado del usuario');
    }
  };

  // Abrir modal de cambio de contraseña
  const abrirModalClave = (u: Usuario) => {
    setUsuarioParaClave(u);
    setNuevaClave('');
    setConfirmarClave('');
    setVerClave(false);
    setErrorClave(null);
    setModalClaveAbierto(true);
  };

  // Guardar nueva contraseña
  const manejarGuardarClave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioParaClave) return;
    setErrorClave(null);

    if (nuevaClave.length < 6) {
      setErrorClave('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (nuevaClave !== confirmarClave) {
      setErrorClave('Las contraseñas no coinciden');
      return;
    }

    setGuardandoClave(true);
    try {
      const res = await actualizarUsuarioApi({
        id: usuarioParaClave.id,
        contrasena: nuevaClave,
      });

      if (res.exito) {
        notificar('exito', `Contraseña de ${usuarioParaClave.nombre} actualizada correctamente`);
        setModalClaveAbierto(false);
      } else {
        setErrorClave(res.error || 'No se pudo actualizar la contraseña');
      }
    } catch {
      setErrorClave('Error de conexión al actualizar la contraseña');
    } finally {
      setGuardandoClave(false);
    }
  };

  // Abrir modal de eliminación
  const abrirModalEliminar = (u: Usuario) => {
    if (usuarioSesion && Number(u.id) === Number(usuarioSesion.id)) {
      notificar('error', 'No puedes eliminar tu propia cuenta en sesión');
      return;
    }
    setUsuarioParaEliminar(u);
    setModalEliminarAbierto(true);
  };

  // Confirmar eliminación
  const manejarConfirmarEliminar = async () => {
    if (!usuarioParaEliminar) return;
    setEliminando(true);
    try {
      const res = await eliminarUsuarioApi(usuarioParaEliminar.id);
      if (res.exito) {
        notificar('exito', `Usuario ${usuarioParaEliminar.nombre} eliminado`);
        setModalEliminarAbierto(false);
        await cargarUsuarios();
      } else {
        notificar('error', res.error || 'No se pudo eliminar el usuario');
      }
    } catch {
      notificar('error', 'Error de red al eliminar el usuario');
    } finally {
      setEliminando(false);
    }
  };

  // Control de Acceso: Exclusivo Administrador Global
  if (usuarioSesion && usuarioSesion.rol !== 'admin') {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '3rem',
          textAlign: 'center',
          background: 'var(--fondo-principal)',
          color: 'var(--texto-principal)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.12)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem',
          }}
        >
          <ShieldAlert size={32} />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--texto-principal)' }}>
          Acceso Restringido
        </h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--texto-atenuado)', maxWidth: '440px', marginTop: '0.5rem' }}>
          Este módulo de gestión de usuarios y ópticas está reservado exclusivamente para Administradores Globales de la plataforma.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--fondo-principal)',
        overflowY: 'auto',
      }}
    >
      {/* Toast Notificación */}
      {mensajeNotificacion && (
        <div
          style={{
            position: 'fixed',
            top: '1.5rem',
            right: '1.5rem',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radio-md)',
            background: mensajeNotificacion.tipo === 'exito' ? 'var(--fondo-tarjeta)' : 'var(--fondo-tarjeta)',
            border: `1px solid ${mensajeNotificacion.tipo === 'exito' ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
            color: mensajeNotificacion.tipo === 'exito' ? '#16a34a' : '#dc2626',
            fontSize: '0.85rem',
            fontWeight: 600,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {mensajeNotificacion.tipo === 'exito' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{mensajeNotificacion.texto}</span>
        </div>
      )}

      {/* CONTENEDOR PRINCIPAL: PESTAÑAS Y ACCIONES -> FILTROS -> TABLA */}
      <div style={{ padding: '1.25rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* NAVEGACIÓN POR PESTAÑAS: USUARIOS VS ÓPTICAS + BOTONES DE ACCIÓN PRINCIPALES */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Pestañas a la izquierda con componente estandarizado BarraPestanas */}
          <BarraPestanas<'usuarios' | 'opticas'>
            pestanas={pestanasModulo}
            pestanaActiva={pestanaActiva}
            alCambiarPestana={setPestanaActiva}
          />

          {/* Acciones principales a la derecha (en la misma fila de pestañas) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {/* Botón Refrescar */}
            <EtiquetaTooltip texto={pestanaActiva === 'usuarios' ? 'Actualizar usuarios' : 'Actualizar ópticas'} posicion="abajo">
              <button
                type="button"
                onClick={cargarUsuarios}
                disabled={cargando}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '34px',
                  height: '34px',
                  borderRadius: 'var(--radio-md)',
                  background: 'var(--fondo-elevado)',
                  border: '1px solid var(--borde-tarjeta)',
                  color: 'var(--texto-principal)',
                  cursor: cargando ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (!cargando) e.currentTarget.style.background = 'var(--fondo-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--fondo-elevado)';
                }}
              >
                <RefreshCw size={14} className={cargando ? 'animacion-rotar' : ''} />
              </button>
            </EtiquetaTooltip>

            {/* Botón Nuevo usuario / Nueva Optica */}
            {pestanaActiva === 'usuarios' ? (
              <button
                type="button"
                onClick={abrirModalCrear}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  height: '34px',
                  padding: '0 0.95rem',
                  background: 'var(--color-primario)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radio-md)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.80rem',
                  boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.92')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <UserPlus size={15} />
                <span>Nuevo usuario</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={abrirModalCrearOptica}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  height: '34px',
                  padding: '0 0.95rem',
                  background: 'var(--color-primario)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radio-md)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.80rem',
                  boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.92')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <Plus size={15} />
                <span>Nueva Optica</span>
              </button>
            )}
          </div>
        </div>

        {pestanaActiva === 'usuarios' && (
          <>
            {/* 2. BARRA DE FILTROS Y ACCIÓN */}
            <section
              style={{
                padding: '0.75rem 1.25rem',
                background: 'var(--fondo-tarjeta)',
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: 'var(--radio-lg)',
                boxShadow: 'var(--sombra-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.65rem',
                flexWrap: 'wrap',
              }}
            >
              {/* Buscador de usuarios estandarizado */}
              <FiltroBusqueda
                valor={busquedaTexto}
                alCambiar={setBusquedaTexto}
                placeholder="Buscar por nombre, usuario, correo..."
                flex="2 1 200px"
                anchoMinimo="180px"
                anchoMaximo="300px"
              />

              {/* Filtro por Rol */}
              <div style={{ flex: '1 1 140px', minWidth: '130px', maxWidth: '155px' }}>
                <SelectorDesplegable
                  valor={filtroRol}
                  alCambiar={setFiltroRol}
                  opciones={opcionesFiltroRol}
                  tamano="compacto"
                  anchoMinimo="100%"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Filtro por Óptica */}
              <div style={{ flex: '1.2 1 155px', minWidth: '142px', maxWidth: '180px' }}>
                <SelectorDesplegable
                  valor={filtroOptica}
                  alCambiar={setFiltroOptica}
                  opciones={opcionesFiltroOptica}
                  tamano="compacto"
                  anchoMinimo="100%"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Filtro por Estado */}
              <div style={{ flex: '1 1 135px', minWidth: '130px', maxWidth: '175px' }}>
                <SelectorDesplegable
                  valor={filtroEstado}
                  alCambiar={setFiltroEstado}
                  opciones={opcionesFiltroEstado}
                  tamano="compacto"
                  anchoMinimo="100%"
                  style={{ width: '100%' }}
                />
              </div>
            </section>

            {/* 3. TABLA DE USUARIOS */}
            <section
              style={{
                background: 'var(--fondo-tarjeta)',
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: 'var(--radio-lg)',
                boxShadow: 'var(--sombra-sm)',
                overflow: 'hidden',
              }}
            >

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                  <thead>
                    <tr
                      style={{
                        background: 'var(--fondo-elevado)',
                        borderBottom: '1px solid var(--borde-tarjeta)',
                        color: 'var(--texto-atenuado)',
                        fontSize: '0.72rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      <th style={{ padding: '0.75rem 1.25rem', fontWeight: 700 }}>Usuario</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>Correo</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>Rol</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>Óptica</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>Estado</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>Último Acceso</th>
                      <th style={{ padding: '0.75rem 1.25rem', fontWeight: 700, textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargando ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--texto-atenuado)' }}>
                          <RefreshCw size={20} className="animacion-rotar" style={{ margin: '0 auto 0.5rem auto' }} />
                          <div>Cargando directorio de usuarios...</div>
                        </td>
                      </tr>
                    ) : usuariosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--texto-atenuado)' }}>
                          <Users size={32} style={{ margin: '0 auto 0.5rem auto', opacity: 0.4 }} />
                          <div style={{ fontWeight: 600 }}>No se encontraron usuarios</div>
                          <div style={{ fontSize: '0.74rem', marginTop: '0.25rem' }}>
                            Prueba ajustando los filtros de búsqueda o rol.
                          </div>
                        </td>
                      </tr>
                    ) : (
                      usuariosPaginados.map((u) => {
                        const esUsuarioActual = usuarioSesion && Number(u.id) === Number(usuarioSesion.id);
                        const iniciales = u.nombre
                          ? u.nombre
                            .split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()
                          : 'U';

                        return (
                          <tr
                            key={u.id}
                            style={{
                              borderBottom: '1px solid var(--borde-tarjeta)',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--fondo-hover)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            {/* 1. Usuario */}
                            <td style={{ padding: '0.85rem 1.25rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div
                                  style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    background: u.rol === 'admin'
                                      ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
                                      : 'linear-gradient(135deg, var(--color-primario, #0284c7) 0%, #0369a1 100%)',
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '0.78rem',
                                    flexShrink: 0,
                                  }}
                                >
                                  {iniciales}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, color: 'var(--texto-principal)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span>{u.nombre}</span>
                                    {esUsuarioActual && (
                                      <span
                                        style={{
                                          fontSize: '0.62rem',
                                          padding: '0.1rem 0.4rem',
                                          borderRadius: '4px',
                                          fontWeight: 700,
                                          background: 'var(--fondo-elevado)',
                                          border: '1px solid var(--borde-tarjeta)',
                                          color: 'var(--color-primario)',
                                        }}
                                      >
                                        Tú
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--texto-atenuado)' }}>
                                    @{u.usuario}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* 2. Correo */}
                            <td style={{ padding: '0.85rem 1rem', color: 'var(--texto-principal)' }}>
                              {u.correo ? (
                                <span style={{ fontSize: '0.76rem' }}>{u.correo}</span>
                              ) : (
                                <span style={{ color: 'var(--texto-atenuado)', fontSize: '0.75rem' }}>—</span>
                              )}
                            </td>

                            {/* 3. Rol (SOLO ROLES EXISTENTES) */}
                            <td style={{ padding: '0.85rem 1rem' }}>
                              {u.rol === 'admin' ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.25rem 0.65rem',
                                    borderRadius: '9999px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    background: 'var(--fondo-elevado)',
                                    border: '1px solid var(--borde-tarjeta)',
                                    color: '#8b5cf6',
                                  }}
                                >
                                  <ShieldCheck size={12} />
                                  <span>Admin Global</span>
                                </span>
                              ) : (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.25rem 0.65rem',
                                    borderRadius: '9999px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    background: 'var(--fondo-elevado)',
                                    border: '1px solid var(--borde-tarjeta)',
                                    color: 'var(--color-primario)',
                                  }}
                                >
                                  <Shield size={12} />
                                  <span>Admin de Óptica</span>
                                </span>
                              )}
                            </td>

                            {/* 4. Óptica */}
                            <td style={{ padding: '0.85rem 1rem' }}>
                              {u.optica_nombre ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.2rem 0.55rem',
                                    borderRadius: '6px',
                                    background: 'var(--fondo-elevado)',
                                    border: '1px solid var(--borde-tarjeta)',
                                    color: 'var(--texto-principal)',
                                    fontSize: '0.73rem',
                                    fontWeight: 600,
                                  }}
                                >
                                  <Building2 size={12} style={{ color: 'var(--texto-atenuado)' }} />
                                  <span>{u.optica_nombre}</span>
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    color: 'var(--texto-atenuado)',
                                    fontStyle: 'italic',
                                  }}
                                >
                                  Acceso Global
                                </span>
                              )}
                            </td>

                            {/* 5. Estado Interactivo (Píldora) */}
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <EtiquetaTooltip
                                texto={
                                  esUsuarioActual
                                    ? 'No puedes desactivar tu propia cuenta'
                                    : u.activo
                                      ? 'Clic para desactivar'
                                      : 'Clic para activar'
                                }
                                posicion="arriba"
                              >
                                <button
                                  type="button"
                                  onClick={() => manejarCambiarEstado(u)}
                                  disabled={Boolean(esUsuarioActual)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                    padding: '0.28rem 0.75rem',
                                    borderRadius: '9999px',
                                    border: 'none',
                                    background: u.activo ? 'rgba(16, 185, 129, 0.16)' : 'rgba(100, 116, 139, 0.14)',
                                    color: u.activo ? '#059669' : '#475569',
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    cursor: esUsuarioActual ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!esUsuarioActual) {
                                      e.currentTarget.style.opacity = '0.82';
                                      e.currentTarget.style.transform = 'translateY(-0.5px)';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.opacity = '1';
                                    e.currentTarget.style.transform = 'none';
                                  }}
                                >
                                  <span
                                    style={{
                                      width: '7px',
                                      height: '7px',
                                      borderRadius: '50%',
                                      background: u.activo ? '#059669' : '#64748b',
                                      display: 'inline-block',
                                      flexShrink: 0,
                                    }}
                                  />
                                  <span>{u.activo ? 'Activo' : 'Inactivo'}</span>
                                </button>
                              </EtiquetaTooltip>
                            </td>

                            {/* 6. Último Acceso */}
                            <td style={{ padding: '0.85rem 1rem', color: 'var(--texto-atenuado)', fontSize: '0.73rem' }}>
                              {u.ultimo_acceso ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <Clock size={12} />
                                  <span>{new Date(u.ultimo_acceso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                </div>
                              ) : (
                                <span>Nunca</span>
                              )}
                            </td>

                            {/* 7. Acciones */}
                            <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                {/* Editar datos */}
                                <EtiquetaTooltip texto="Editar usuario" posicion="arriba">
                                  <button
                                    type="button"
                                    onClick={() => abrirModalEditar(u)}
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '6px',
                                      background: 'var(--fondo-elevado)',
                                      border: '1px solid var(--borde-tarjeta)',
                                      color: 'var(--texto-principal)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--fondo-hover)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--fondo-elevado)')}
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                </EtiquetaTooltip>

                                {/* Cambiar contraseña */}
                                <EtiquetaTooltip texto="Cambiar contraseña" posicion="arriba">
                                  <button
                                    type="button"
                                    onClick={() => abrirModalClave(u)}
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '6px',
                                      background: 'var(--fondo-elevado)',
                                      border: '1px solid var(--borde-tarjeta)',
                                      color: '#f59e0b',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--fondo-hover)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--fondo-elevado)')}
                                  >
                                    <Key size={13} />
                                  </button>
                                </EtiquetaTooltip>

                                {/* Eliminar usuario */}
                                <EtiquetaTooltip
                                  texto={esUsuarioActual ? 'No puedes eliminarte a ti mismo' : 'Eliminar usuario'}
                                  posicion="arriba"
                                >
                                  <button
                                    type="button"
                                    onClick={() => abrirModalEliminar(u)}
                                    disabled={Boolean(esUsuarioActual)}
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '6px',
                                      background: 'var(--fondo-elevado)',
                                      border: '1px solid var(--borde-tarjeta)',
                                      color: esUsuarioActual ? 'var(--texto-atenuado)' : '#ef4444',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: esUsuarioActual ? 'not-allowed' : 'pointer',
                                      opacity: esUsuarioActual ? 0.4 : 1,
                                      transition: 'all 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!esUsuarioActual) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!esUsuarioActual) e.currentTarget.style.background = 'var(--fondo-elevado)';
                                    }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </EtiquetaTooltip>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Barra de Paginación Estandarizada */}
              <BarraPaginacionTabla
                totalRegistros={totalRegistros}
                paginaActual={paginaActual}
                limitePorPagina={limitePorPagina}
                alCambiarPagina={setPaginaActual}
                alCambiarLimite={setLimitePorPagina}
                cantidadVisibles={usuariosPaginados.length}
              />
            </section>
          </>
        )}

        {pestanaActiva === 'opticas' && (
          <>
            {/* 2. BARRA DE FILTROS Y ACCIÓN PARA ÓPTICAS */}
            <section
              style={{
                padding: '0.75rem 1.25rem',
                background: 'var(--fondo-tarjeta)',
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: 'var(--radio-lg)',
                boxShadow: 'var(--sombra-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                flexWrap: 'wrap',
              }}
            >
              {/* Buscador de ópticas estandarizado */}
              <FiltroBusqueda
                valor={busquedaOptica}
                alCambiar={setBusquedaOptica}
                placeholder="Buscar óptica por nombre o código..."
                flex="2.5 1 240px"
                anchoMinimo="180px"
                anchoMaximo="300px"
              />

              {/* Selector Estado */}
              <div style={{ flex: '1 1 160px', minWidth: '140px', maxWidth: '180px' }}>
                <SelectorDesplegable
                  opciones={opcionesFiltroEstadoOptica}
                  valor={filtroEstadoOptica}
                  alCambiar={setFiltroEstadoOptica}
                  tamano="compacto"
                  anchoMinimo="100%"
                  style={{ width: '100%' }}
                />
              </div>
            </section>

            {/* 3. TABLA DE ÓPTICAS */}
            <section
              style={{
                background: 'var(--fondo-tarjeta)',
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: 'var(--radio-lg)',
                boxShadow: 'var(--sombra-sm)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    textAlign: 'left',
                    fontSize: '0.78rem',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: 'var(--fondo-elevado)',
                        borderBottom: '1px solid var(--borde-tarjeta)',
                        color: 'var(--texto-atenuado)',
                        textTransform: 'uppercase',
                        fontSize: '0.70rem',
                        fontWeight: 700,
                        letterSpacing: '0.5px',
                      }}
                    >
                      <th style={{ padding: '0.85rem 1.25rem' }}>Óptica</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Código de Óptica</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Identidad Visual</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Usuarios</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Servicio IA</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Estado</th>
                      <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cargando ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--texto-atenuado)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                            <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--color-primario)' }} />
                            <span>Cargando catálogo de ópticas...</span>
                          </div>
                        </td>
                      </tr>
                    ) : opticasFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--texto-atenuado)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                            <Building2 size={32} style={{ opacity: 0.3 }} />
                            <p style={{ margin: 0, fontWeight: 600, color: 'var(--texto-principal)' }}>
                              No se encontraron ópticas
                            </p>
                            <span style={{ fontSize: '0.72rem' }}>
                              Intenta cambiar los términos de búsqueda o el filtro de estado.
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      opticasPaginadas.map((o) => {
                        return (
                          <tr
                            key={o.id}
                            onClick={() => abrirModalEditarOptica(o)}
                            style={{
                              borderBottom: '1px solid var(--borde-tarjeta)',
                              transition: 'background 0.15s ease',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--fondo-hover)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            {/* 1. Nombre de la Óptica */}
                            <td style={{ padding: '0.85rem 1.25rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div
                                  style={{
                                    width: '34px',
                                    height: '34px',
                                    borderRadius: '8px',
                                    background: o.logo_url ? '#ffffff' : (o.color_primario || 'var(--color-primario)'),
                                    border: o.logo_url ? '1px solid var(--borde-tarjeta)' : 'none',
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 800,
                                    fontSize: '0.82rem',
                                    flexShrink: 0,
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                    overflow: 'hidden',
                                    padding: o.logo_url ? '2px' : 0,
                                  }}
                                >
                                  {o.logo_url ? (
                                    <img
                                      src={o.logo_url}
                                      alt={o.nombre}
                                      style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'contain',
                                        borderRadius: '6px',
                                      }}
                                    />
                                  ) : (
                                    o.nombre.substring(0, 2).toUpperCase()
                                  )}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, color: 'var(--texto-principal)', fontSize: '0.82rem' }}>
                                    {o.nombre}
                                  </div>
                                  <div style={{ fontSize: '0.70rem', color: 'var(--texto-atenuado)' }}>
                                    ID Óptica: #{o.id}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* 2. Identificador (@slug) */}
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '6px',
                                  fontSize: '0.72rem',
                                  fontFamily: 'monospace',
                                  fontWeight: 600,
                                  background: 'var(--fondo-elevado)',
                                  border: '1px solid var(--borde-tarjeta)',
                                  color: 'var(--texto-principal)',
                                }}
                              >
                                @{o.slug || `optica-${o.id}`}
                              </span>
                            </td>

                            {/* 3. Identidad Visual */}
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  <div
                                    title={`Color Primario: ${o.color_primario || '#0d2167'}`}
                                    style={{
                                      width: '18px',
                                      height: '18px',
                                      borderRadius: '50%',
                                      background: o.color_primario || '#0d2167',
                                      border: '2px solid var(--fondo-tarjeta)',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                    }}
                                  />
                                  <div
                                    title={`Color Secundario: ${o.color_secundario || '#08133f'}`}
                                    style={{
                                      width: '18px',
                                      height: '18px',
                                      borderRadius: '50%',
                                      background: o.color_secundario || '#08133f',
                                      marginLeft: '-6px',
                                      border: '2px solid var(--fondo-tarjeta)',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                    }}
                                  />
                                </div>
                                <span style={{ fontSize: '0.70rem', fontFamily: 'monospace', color: 'var(--texto-atenuado)' }}>
                                  {o.color_primario || '#0d2167'}
                                </span>
                              </div>
                            </td>

                            {/* 5. Usuarios Asignados */}
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  padding: '0.22rem 0.6rem',
                                  borderRadius: '9999px',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  background: 'var(--fondo-elevado)',
                                  border: '1px solid var(--borde-tarjeta)',
                                  color: (o.total_usuarios || 0) > 0 ? 'var(--texto-principal)' : 'var(--texto-atenuado)',
                                }}
                              >
                                <Users
                                  size={12}
                                  style={{
                                    color: (o.total_usuarios || 0) > 0 ? 'var(--color-primario)' : 'var(--texto-atenuado)',
                                  }}
                                />
                                <span>{o.total_usuarios || 0} usuarios</span>
                              </span>
                            </td>

                            {/* 6. Servicio IA Interactivo (Píldora) */}
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <EtiquetaTooltip
                                texto={o.ia_habilitada !== false ? 'Clic para deshabilitar y ocultar módulo IA a esta óptica' : 'Clic para habilitar y activar módulo IA a esta óptica'}
                                posicion="arriba"
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    manejarCambiarIaOptica(o);
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                    padding: '0.28rem 0.75rem',
                                    borderRadius: '9999px',
                                    border: 'none',
                                    background: o.ia_habilitada !== false ? 'rgba(2, 132, 199, 0.14)' : 'rgba(100, 116, 139, 0.14)',
                                    color: o.ia_habilitada !== false ? 'var(--color-primario)' : '#64748b',
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.opacity = '0.82';
                                    e.currentTarget.style.transform = 'translateY(-0.5px)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.opacity = '1';
                                    e.currentTarget.style.transform = 'none';
                                  }}
                                >
                                  <Bot
                                    size={13}
                                    style={{
                                      color: o.ia_habilitada !== false ? 'var(--color-primario)' : '#64748b',
                                    }}
                                  />
                                  <span>{o.ia_habilitada !== false ? 'IA Habilitada' : 'Sin IA'}</span>
                                </button>
                              </EtiquetaTooltip>
                            </td>

                            {/* 7. Estado Interactivo (Píldora) */}
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <EtiquetaTooltip
                                texto={o.activo ? 'Clic para suspender óptica' : 'Clic para activar óptica'}
                                posicion="arriba"
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    manejarCambiarEstadoOptica(o);
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                    padding: '0.28rem 0.75rem',
                                    borderRadius: '9999px',
                                    border: 'none',
                                    background: o.activo ? 'rgba(16, 185, 129, 0.16)' : 'rgba(100, 116, 139, 0.14)',
                                    color: o.activo ? '#059669' : '#475569',
                                    fontSize: '0.74rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.opacity = '0.82';
                                    e.currentTarget.style.transform = 'translateY(-0.5px)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.opacity = '1';
                                    e.currentTarget.style.transform = 'none';
                                  }}
                                >
                                  <span
                                    style={{
                                      width: '7px',
                                      height: '7px',
                                      borderRadius: '50%',
                                      background: o.activo ? '#059669' : '#64748b',
                                      display: 'inline-block',
                                      flexShrink: 0,
                                    }}
                                  />
                                  <span>{o.activo ? 'Activa' : 'Inactiva'}</span>
                                </button>
                              </EtiquetaTooltip>
                            </td>

                            {/* 7. Acciones */}
                            <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                              <EtiquetaTooltip texto="Editar óptica" posicion="arriba">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    abrirModalEditarOptica(o);
                                  }}
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    background: 'var(--fondo-elevado)',
                                    border: '1px solid var(--borde-tarjeta)',
                                    color: 'var(--texto-principal)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--fondo-hover)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--fondo-elevado)')}
                                >
                                  <Edit3 size={13} />
                                </button>
                              </EtiquetaTooltip>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Barra de Paginación Estandarizada para Ópticas */}
              <BarraPaginacionTabla
                totalRegistros={totalOpticasRegistros}
                paginaActual={paginaActualOpticas}
                limitePorPagina={limitePorPaginaOpticas}
                alCambiarPagina={setPaginaActualOpticas}
                alCambiarLimite={setLimitePorPaginaOpticas}
                cantidadVisibles={opticasPaginadas.length}
              />
            </section>
          </>
        )}
      </div>

      {/* 4. MODAL CREAR / EDITAR USUARIO */}
      {modalFormularioAbierto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '1rem',
          }}
          onClick={() => setModalFormularioAbierto(false)}
        >
          <div
            style={{
              background: 'var(--fondo-tarjeta)',
              border: '1px solid var(--borde-tarjeta)',
              borderRadius: 'var(--radio-lg)',
              width: '100%',
              maxWidth: '520px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              animation: 'fadeIn 0.18s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del modal */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--borde-tarjeta)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'rgba(2, 132, 199, 0.12)',
                    color: 'var(--color-primario)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {usuarioParaEditar ? <Edit3 size={18} /> : <UserPlus size={18} />}
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--texto-principal)' }}>
                    {usuarioParaEditar ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
                  </h3>
                  <p style={{ fontSize: '0.74rem', color: 'var(--texto-atenuado)', margin: '0.15rem 0 0 0' }}>
                    {usuarioParaEditar ? `Modificando datos de @${usuarioParaEditar.usuario}` : 'Complete los datos para habilitar el acceso'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalFormularioAbierto(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--texto-atenuado)',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  padding: '0.25rem',
                }}
              >
                ✕
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={manejarGuardarUsuario} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {errorFormulario && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--radio-md)',
                    padding: '0.65rem 0.85rem',
                    color: '#ef4444',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                  }}
                >
                  {errorFormulario}
                </div>
              )}

              {/* Nombre Completo */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--texto-principal)', marginBottom: '0.35rem' }}>
                  Nombre Completo *
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-atenuado)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    required
                    placeholder="Ej: Laura Gómez"
                    value={formNombre}
                    onChange={(e) => setFormNombre(e.target.value)}
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: '0 0.75rem 0 2.2rem',
                      borderRadius: 'var(--radio-md)',
                      border: '1px solid var(--borde-tarjeta)',
                      background: 'var(--fondo-elevado)',
                      color: 'var(--texto-principal)',
                      fontSize: '0.80rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'all 0.15s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primario)';
                      e.currentTarget.style.boxShadow = '0 0 0 2.5px rgba(2, 132, 199, 0.18)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--borde-tarjeta)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              {/* Nombre de Usuario y Correo en 2 columnas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--texto-principal)', marginBottom: '0.35rem' }}>
                    Usuario (@username) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-atenuado)', fontSize: '0.82rem', fontWeight: 700, pointerEvents: 'none' }}>@</span>
                    <input
                      type="text"
                      required
                      placeholder="laura_optica"
                      value={formUsuario}
                      onChange={(e) => setFormUsuario(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                      style={{
                        width: '100%',
                        height: '36px',
                        padding: '0 0.75rem 0 1.8rem',
                        borderRadius: 'var(--radio-md)',
                        border: '1px solid var(--borde-tarjeta)',
                        background: 'var(--fondo-elevado)',
                        color: 'var(--texto-principal)',
                        fontSize: '0.80rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'all 0.15s ease',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-primario)';
                        e.currentTarget.style.boxShadow = '0 0 0 2.5px rgba(2, 132, 199, 0.18)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--borde-tarjeta)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--texto-principal)', marginBottom: '0.35rem' }}>
                    Correo Electrónico
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-atenuado)', pointerEvents: 'none' }} />
                    <input
                      type="email"
                      placeholder="laura@optica.com"
                      value={formCorreo}
                      onChange={(e) => setFormCorreo(e.target.value)}
                      style={{
                        width: '100%',
                        height: '36px',
                        padding: '0 0.75rem 0 2.2rem',
                        borderRadius: 'var(--radio-md)',
                        border: '1px solid var(--borde-tarjeta)',
                        background: 'var(--fondo-elevado)',
                        color: 'var(--texto-principal)',
                        fontSize: '0.80rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'all 0.15s ease',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-primario)';
                        e.currentTarget.style.boxShadow = '0 0 0 2.5px rgba(2, 132, 199, 0.18)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--borde-tarjeta)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Rol y Óptica en 2 columnas (SOLO ROLES EXISTENTES) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--texto-principal)', marginBottom: '0.35rem' }}>
                    Rol en el Sistema *
                  </label>
                  <SelectorDesplegable
                    valor={formRol}
                    alCambiar={(v) => setFormRol(v as 'admin' | 'admin_optica')}
                    opciones={[
                      { valor: 'admin_optica', etiqueta: 'Admin de Óptica' },
                      { valor: 'admin', etiqueta: 'Administrador Global' },
                    ]}
                    tamano="compacto"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--texto-principal)', marginBottom: '0.35rem' }}>
                    Óptica Asignada {formRol === 'admin_optica' && '*'}
                  </label>
                  <SelectorDesplegable
                    valor={formOpticaId}
                    alCambiar={setFormOpticaId}
                    opciones={opcionesFiltroOptica.filter((o) => o.valor !== 'todas')}
                    tamano="compacto"
                    placeholder="Seleccione óptica..."
                  />
                </div>
              </div>

              {/* Contraseña (Obligatoria si crea, Opcional si edita) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--texto-principal)', marginBottom: '0.35rem' }}>
                  {usuarioParaEditar ? 'Cambiar Contraseña (dejar en blanco para conservar actual)' : 'Contraseña Inicial *'}
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-atenuado)', pointerEvents: 'none' }} />
                  <input
                    type="password"
                    placeholder={usuarioParaEditar ? '••••••••' : 'Mínimo 6 caracteres'}
                    value={formContrasena}
                    onChange={(e) => setFormContrasena(e.target.value)}
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: '0 0.75rem 0 2.2rem',
                      borderRadius: 'var(--radio-md)',
                      border: '1px solid var(--borde-tarjeta)',
                      background: 'var(--fondo-elevado)',
                      color: 'var(--texto-principal)',
                      fontSize: '0.80rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'all 0.15s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primario)';
                      e.currentTarget.style.boxShadow = '0 0 0 2.5px rgba(2, 132, 199, 0.18)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--borde-tarjeta)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              {/* Checkbox Estado Activo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.25rem' }}>
                <input
                  type="checkbox"
                  id="check-activo"
                  checked={formActivo}
                  onChange={(e) => setFormActivo(e.target.checked)}
                  style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--color-primario)' }}
                />
                <label htmlFor="check-activo" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--texto-principal)', cursor: 'pointer' }}>
                  Usuario activo (puede iniciar sesión en la plataforma)
                </label>
              </div>

              {/* Botones de acción */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setModalFormularioAbierto(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 'var(--radio-md)',
                    background: 'transparent',
                    border: '1px solid var(--borde-tarjeta)',
                    color: 'var(--texto-principal)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoFormulario}
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: 'var(--radio-md)',
                    background: 'var(--color-primario)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: guardandoFormulario ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)',
                  }}
                >
                  {guardandoFormulario ? 'Guardando...' : usuarioParaEditar ? 'Actualizar Usuario' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL CAMBIAR CONTRASEÑA ESPECÍFICO */}
      {modalClaveAbierto && usuarioParaClave && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '1rem',
          }}
          onClick={() => setModalClaveAbierto(false)}
        >
          <div
            style={{
              background: 'var(--fondo-tarjeta)',
              border: '1px solid var(--borde-tarjeta)',
              borderRadius: 'var(--radio-lg)',
              width: '100%',
              maxWidth: '420px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              animation: 'fadeIn 0.18s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--borde-tarjeta)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'rgba(245, 158, 11, 0.12)',
                    color: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Key size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--texto-principal)' }}>
                    Cambiar Contraseña
                  </h3>
                  <p style={{ fontSize: '0.74rem', color: 'var(--texto-atenuado)', margin: '0.15rem 0 0 0' }}>
                    Usuario: {usuarioParaClave.nombre} (@{usuarioParaClave.usuario})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalClaveAbierto(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--texto-atenuado)',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                }}
              >
                ✕
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={manejarGuardarClave} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {errorClave && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--radio-md)',
                    padding: '0.65rem 0.85rem',
                    color: '#ef4444',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                  }}
                >
                  {errorClave}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--texto-principal)', marginBottom: '0.35rem' }}>
                  Nueva Contraseña *
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-atenuado)', pointerEvents: 'none' }} />
                  <input
                    type={verClave ? 'text' : 'password'}
                    required
                    placeholder="Mínimo 6 caracteres"
                    value={nuevaClave}
                    onChange={(e) => setNuevaClave(e.target.value)}
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: '0 2.2rem 0 2.2rem',
                      borderRadius: 'var(--radio-md)',
                      border: '1px solid var(--borde-tarjeta)',
                      background: 'var(--fondo-elevado)',
                      color: 'var(--texto-principal)',
                      fontSize: '0.80rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'all 0.15s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primario)';
                      e.currentTarget.style.boxShadow = '0 0 0 2.5px rgba(2, 132, 199, 0.18)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--borde-tarjeta)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setVerClave((prev) => !prev)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--texto-atenuado)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {verClave ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--texto-principal)', marginBottom: '0.35rem' }}>
                  Confirmar Nueva Contraseña *
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-atenuado)', pointerEvents: 'none' }} />
                  <input
                    type={verClave ? 'text' : 'password'}
                    required
                    placeholder="Repita la contraseña"
                    value={confirmarClave}
                    onChange={(e) => setConfirmarClave(e.target.value)}
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: '0 0.75rem 0 2.2rem',
                      borderRadius: 'var(--radio-md)',
                      border: '1px solid var(--borde-tarjeta)',
                      background: 'var(--fondo-elevado)',
                      color: 'var(--texto-principal)',
                      fontSize: '0.80rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'all 0.15s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primario)';
                      e.currentTarget.style.boxShadow = '0 0 0 2.5px rgba(2, 132, 199, 0.18)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--borde-tarjeta)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setModalClaveAbierto(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 'var(--radio-md)',
                    background: 'transparent',
                    border: '1px solid var(--borde-tarjeta)',
                    color: 'var(--texto-principal)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoClave}
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: 'var(--radio-md)',
                    background: '#f59e0b',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: guardandoClave ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.25)',
                  }}
                >
                  {guardandoClave ? 'Actualizando...' : 'Actualizar Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL CONFIRMAR ELIMINACIÓN */}
      {modalEliminarAbierto && usuarioParaEliminar && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '1rem',
          }}
          onClick={() => setModalEliminarAbierto(false)}
        >
          <div
            style={{
              background: 'var(--fondo-tarjeta)',
              border: '1px solid var(--borde-tarjeta)',
              borderRadius: 'var(--radio-lg)',
              width: '100%',
              maxWidth: '420px',
              padding: '1.5rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
              textAlign: 'center',
              animation: 'fadeIn 0.18s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto',
              }}
            >
              <Trash2 size={24} />
            </div>

            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--texto-principal)' }}>
              ¿Eliminar usuario?
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--texto-atenuado)', margin: '0.5rem 0 1.25rem 0', lineHeight: '1.4' }}>
              Está a punto de eliminar a <strong>{usuarioParaEliminar.nombre}</strong> (@{usuarioParaEliminar.usuario}).
              Esta acción revocará de inmediato todo su acceso a la plataforma.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setModalEliminarAbierto(false)}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: 'var(--radio-md)',
                  background: 'transparent',
                  border: '1px solid var(--borde-tarjeta)',
                  color: 'var(--texto-principal)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={manejarConfirmarEliminar}
                disabled={eliminando}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: 'var(--radio-md)',
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: eliminando ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                }}
              >
                {eliminando ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL CREAR / EDITAR ÓPTICA */}
      {modalOpticaAbierto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '1rem',
          }}
          onClick={() => setModalOpticaAbierto(false)}
        >
          <div
            style={{
              background: 'var(--fondo-tarjeta)',
              border: '1px solid var(--borde-tarjeta)',
              borderRadius: 'var(--radio-lg)',
              width: '100%',
              maxWidth: '520px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              animation: 'fadeIn 0.18s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del modal */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--borde-tarjeta)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Building2 size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--texto-principal)' }}>
                    {opticaParaEditar ? 'Editar Óptica' : 'Nueva Óptica'}
                  </h3>
                  <p style={{ fontSize: '0.74rem', color: 'var(--texto-atenuado)', margin: '0.15rem 0 0 0' }}>
                    {opticaParaEditar
                      ? `Modificando configuración de ${opticaParaEditar.nombre}`
                      : 'Habilite una nueva óptica para asignación de usuarios y pacientes'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpticaAbierto(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--texto-atenuado)',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  padding: '0.25rem',
                }}
              >
                ✕
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={manejarSolicitarGuardarOptica} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
              {errorOptica && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 'var(--radio-md)',
                    padding: '0.65rem 0.85rem',
                    color: '#ef4444',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                  }}
                >
                  {errorOptica}
                </div>
              )}

              {/* Fila 1: Nombre de la Óptica (Izquierda) e Identificador / Código (Derecha) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                {/* Nombre de la Óptica */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--texto-principal)', marginBottom: '0.35rem' }}>
                    Nombre de la Óptica *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Building2 size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-atenuado)' }} />
                    <input
                      type="text"
                      required
                      placeholder="Ej. Óptica Central Laureles"
                      value={formOpticaNombre}
                      onChange={(e) => {
                        const nuevoNombre = e.target.value;
                        setFormOpticaNombre(nuevoNombre);
                        setFormOpticaSlug(generarSlugOptica(nuevoNombre));
                      }}
                      style={{
                        width: '100%',
                        height: '36px',
                        padding: '0 0.75rem 0 2.2rem',
                        borderRadius: 'var(--radio-md)',
                        border: '1px solid var(--borde-tarjeta)',
                        background: 'var(--fondo-elevado)',
                        color: 'var(--texto-principal)',
                        fontSize: '0.80rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'all 0.15s ease',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-primario)';
                        e.currentTarget.style.boxShadow = '0 0 0 2.5px rgba(2, 132, 199, 0.18)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--borde-tarjeta)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>

                {/* Código de Óptica (Solo lectura, autollenado dinámico) */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--texto-principal)' }}>
                      Código de Óptica
                    </label>
                    <span style={{ fontSize: '0.65rem', color: 'var(--texto-atenuado)', fontWeight: 600 }}>
                      Solo lectura
                    </span>
                  </div>
                  <input
                    type="text"
                    readOnly
                    placeholder="@slug-automatico"
                    value={formOpticaSlug ? `@${formOpticaSlug}` : ''}
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: '0 0.75rem',
                      borderRadius: 'var(--radio-md)',
                      border: '1px solid var(--borde-tarjeta)',
                      background: 'var(--fondo-elevado)',
                      color: formOpticaSlug ? 'var(--color-primario)' : 'var(--texto-atenuado)',
                      fontSize: '0.80rem',
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      outline: 'none',
                      boxSizing: 'border-box',
                      cursor: 'default',
                      opacity: 0.95,
                    }}
                  />
                  <span style={{ fontSize: '0.66rem', color: 'var(--texto-atenuado)', display: 'block', marginTop: '0.2rem' }}>
                    Generado automáticamente del nombre
                  </span>
                </div>
              </div>

              {/* Fila 2: Selectores de Color Premium Institucionales */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                {/* Color Primario */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--texto-principal)', marginBottom: '0.35rem' }}>
                    Color Primario (Marca)
                  </label>
                  <SelectorColorPopover
                    valor={formOpticaColorPrimario}
                    alCambiar={(nuevoColor) => setFormOpticaColorPrimario(nuevoColor)}
                    placeholder="Seleccionar Color Primario"
                  />
                </div>

                {/* Color Secundario */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--texto-principal)', marginBottom: '0.35rem' }}>
                    Color Secundario (Oscuro)
                  </label>
                  <SelectorColorPopover
                    valor={formOpticaColorSecundario}
                    alCambiar={(nuevoColor) => setFormOpticaColorSecundario(nuevoColor)}
                    placeholder="Seleccionar Color Secundario"
                  />
                </div>
              </div>

              {/* Fila 3: Logotipo Corporativo (Opcional) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--texto-principal)', marginBottom: '0.35rem' }}>
                  Logo Corporativo <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--texto-atenuado)' }}>(Opcional)</span>
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    background: 'var(--fondo-elevado)',
                    border: '1px solid var(--borde-tarjeta)',
                    borderRadius: 'var(--radio-md)',
                    padding: '0.75rem 1rem',
                  }}
                >
                  {/* Vista Previa del Logotipo */}
                  <div
                    className="logo-previsualizacion-caja"
                    style={{
                      width: '64px',
                      height: '64px',
                      minWidth: '64px',
                      borderRadius: 'var(--radio-md)',
                      background: '#ffffff',
                      border: '1px solid var(--borde-tarjeta)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      padding: '4px',
                      boxShadow: 'var(--sombra-sm)',
                    }}
                  >
                    {previsualizacionLogoOptica || (!logoEliminado && formOpticaLogoUrl) ? (
                      <img
                        src={previsualizacionLogoOptica || formOpticaLogoUrl || ''}
                        alt="Logotipo Corporativo"
                        className="logo-previsualizacion-img"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                        }}
                      />
                    ) : (
                      <ImageIcon style={{ width: '28px', height: '28px', color: 'var(--texto-atenuado)', opacity: 0.6 }} />
                    )}
                  </div>

                  {/* Acciones para Carga de Imagen */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <input
                        ref={refInputLogoOptica}
                        type="file"
                        accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                        onChange={manejarSeleccionarArchivoLogoOptica}
                        style={{ display: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => refInputLogoOptica.current?.click()}
                        style={{
                          padding: '0.38rem 0.85rem',
                          borderRadius: '9999px',
                          border: '1px solid var(--borde-tarjeta)',
                          background: 'var(--fondo-tarjeta)',
                          color: 'var(--texto-principal)',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          boxShadow: 'var(--sombra-sm)',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-primario)';
                          e.currentTarget.style.color = 'var(--color-primario)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--borde-tarjeta)';
                          e.currentTarget.style.color = 'var(--texto-principal)';
                        }}
                      >
                        <Upload style={{ width: '13px', height: '13px' }} />
                        <span>
                          {archivoLogoOptica
                            ? 'Cambiar Imagen'
                            : (formOpticaLogoUrl && !logoEliminado ? 'Cambiar Imagen' : 'Subir Nuevo Logo')}
                        </span>
                      </button>

                      {/* Botón Restaurar Actual (cuando se seleccionó un archivo nuevo) */}
                      {archivoLogoOptica && (
                        <button
                          type="button"
                          onClick={manejarDescartarLogoOptica}
                          style={{
                            padding: '0.38rem 0.75rem',
                            borderRadius: '9999px',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            background: 'var(--fondo-tarjeta)',
                            color: 'var(--color-peligro-rojo)',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            boxShadow: 'var(--sombra-sm)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <RotateCcw style={{ width: '12px', height: '12px' }} />
                          <span>Restaurar Actual</span>
                        </button>
                      )}

                      {/* Botón Eliminar Logo (cuando tiene logo existente y no hay archivo nuevo seleccionado) */}
                      {!archivoLogoOptica && formOpticaLogoUrl && !logoEliminado && (
                        <button
                          type="button"
                          onClick={manejarEliminarLogoOptica}
                          style={{
                            padding: '0.38rem 0.75rem',
                            borderRadius: '9999px',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            background: 'var(--fondo-tarjeta)',
                            color: 'var(--color-peligro-rojo)',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            boxShadow: 'var(--sombra-sm)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Trash2 style={{ width: '12px', height: '12px' }} />
                          <span>Eliminar Logo</span>
                        </button>
                      )}

                      {/* Botón Restaurar Original (cuando se marcó para eliminar) */}
                      {logoEliminado && opticaParaEditar?.logo_url && (
                        <button
                          type="button"
                          onClick={manejarRestaurarLogoOriginal}
                          style={{
                            padding: '0.38rem 0.75rem',
                            borderRadius: '9999px',
                            border: '1px solid var(--borde-tarjeta)',
                            background: 'var(--fondo-tarjeta)',
                            color: 'var(--texto-principal)',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            boxShadow: 'var(--sombra-sm)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <RotateCcw style={{ width: '12px', height: '12px' }} />
                          <span>Restaurar Original</span>
                        </button>
                      )}
                    </div>

                    <div style={{ fontSize: '0.71rem', color: 'var(--texto-atenuado)' }}>
                      {archivoLogoOptica ? (
                        <span style={{ color: 'var(--color-primario)', fontWeight: 600 }}>
                          {archivoLogoOptica.name} ({(archivoLogoOptica.size / 1024).toFixed(1)} KB)
                        </span>
                      ) : logoEliminado ? (
                        <span style={{ color: 'var(--color-peligro-rojo)', fontWeight: 600 }}>
                          Logotipo marcado para eliminar al guardar los cambios.
                        </span>
                      ) : formOpticaLogoUrl ? (
                        <span>Logotipo corporativo activo. Formatos: PNG, JPG, WEBP, SVG.</span>
                      ) : (
                        <span>Formatos: PNG, JPG, WEBP, SVG. Visible en cabecera y recetas.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Estado Activo */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radio-md)',
                  background: 'var(--fondo-elevado)',
                  border: '1px solid var(--borde-tarjeta)',
                  marginTop: '0.25rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--texto-principal)' }}>
                    Óptica Operativa y Habilitada
                  </div>
                  <div style={{ fontSize: '0.70rem', color: 'var(--texto-atenuado)' }}>
                    Permite asignación de pacientes, citas y colaboradores
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formOpticaActivo}
                  onChange={(e) => setFormOpticaActivo(e.target.checked)}
                  style={{
                    width: '18px',
                    height: '18px',
                    accentColor: 'var(--color-primario)',
                    cursor: 'pointer',
                  }}
                />
              </div>

              {/* Módulo Agente de IA (Servicio Adicional) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radio-md)',
                  background: 'var(--fondo-elevado)',
                  border: '1px solid var(--borde-tarjeta)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Sparkles size={14} style={{ color: 'var(--color-primario)' }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--texto-principal)' }}>
                      Módulo Agente de IA (Servicio Adicional)
                    </span>
                  </div>
                  <div style={{ fontSize: '0.70rem', color: 'var(--texto-atenuado)', marginTop: '0.15rem' }}>
                    Si se desactiva, la sección de IA quedará completamente oculta para esta óptica y el bot no responderá mensajes
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formOpticaIaHabilitada}
                  onChange={(e) => setFormOpticaIaHabilitada(e.target.checked)}
                  style={{
                    width: '18px',
                    height: '18px',
                    accentColor: 'var(--color-primario)',
                    cursor: 'pointer',
                  }}
                />
              </div>

              {/* Botones de acción */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setModalOpticaAbierto(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 'var(--radio-md)',
                    background: 'transparent',
                    border: '1px solid var(--borde-tarjeta)',
                    color: 'var(--texto-principal)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoOptica}
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: 'var(--radio-md)',
                    background: 'var(--color-primario)',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: guardandoOptica ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.28)',
                  }}
                >
                  {guardandoOptica
                    ? 'Guardando...'
                    : opticaParaEditar
                      ? 'Actualizar Óptica'
                      : 'Guardar Óptica'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL CONFIRMAR CAMBIOS EN LA ÓPTICA */}
      {modalConfirmarCambiosOpticaAbierto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '1rem',
          }}
          onClick={() => !guardandoOptica && setModalConfirmarCambiosOpticaAbierto(false)}
        >
          <div
            style={{
              background: 'var(--fondo-tarjeta)',
              border: '1px solid var(--borde-tarjeta)',
              borderRadius: 'var(--radio-lg)',
              maxWidth: '480px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: 'var(--sombra-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.15rem',
              animation: 'fadeIn 0.18s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del modal */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'var(--fondo-elevado)',
                    border: '1px solid var(--borde-tarjeta)',
                    color: 'var(--color-primario)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Building2 style={{ width: '18px', height: '18px' }} />
                </div>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, margin: 0, color: 'var(--texto-principal)' }}>
                  Confirmar Cambios en el Perfil
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalConfirmarCambiosOpticaAbierto(false)}
                disabled={guardandoOptica}
                style={{ background: 'none', border: 'none', color: 'var(--texto-atenuado)', cursor: 'pointer' }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            <p style={{ fontSize: '0.80rem', color: 'var(--texto-atenuado)', margin: 0, lineHeight: 1.45 }}>
              Revisa los ajustes que se aplicarán a la identidad y diseño corporativo de tu óptica:
            </p>

            {/* Lista Detallada de Cambios Detectados */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                maxHeight: '260px',
                overflowY: 'auto',
                paddingRight: '0.25rem',
              }}
            >
              {listaCambiosOptica.map((cambio, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--fondo-elevado)',
                    border: '1px solid var(--borde-tarjeta)',
                    borderRadius: 'var(--radio-md)',
                    padding: '0.75rem 0.95rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.73rem',
                      fontWeight: 700,
                      color: 'var(--color-primario)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {cambio.campo}
                  </span>

                  {(cambio.tipo === 'texto' || cambio.tipo === 'estado') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--texto-atenuado)', textDecoration: 'line-through' }}>
                        {cambio.anterior}
                      </span>
                      <span style={{ color: 'var(--texto-atenuado)' }}>→</span>
                      <span style={{ fontWeight: 700, color: 'var(--texto-principal)' }}>
                        {cambio.nuevo}
                      </span>
                    </div>
                  )}

                  {cambio.tipo === 'color' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.82rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: cambio.anterior,
                            border: '1px solid rgba(0,0,0,0.1)',
                          }}
                        />
                        <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--texto-atenuado)' }}>
                          {cambio.anterior}
                        </span>
                      </div>
                      <span style={{ color: 'var(--texto-atenuado)' }}>→</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: cambio.nuevo,
                            border: '1px solid rgba(0,0,0,0.1)',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                          }}
                        />
                        <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700, color: 'var(--texto-principal)' }}>
                          {cambio.nuevo}
                        </span>
                      </div>
                    </div>
                  )}

                  {cambio.tipo === 'logo' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.80rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--texto-atenuado)' }}>{cambio.anterior}</span>
                        <span style={{ color: 'var(--texto-atenuado)' }}>→</span>
                        <span style={{ fontWeight: 700, color: 'var(--color-primario)' }}>
                          {cambio.nuevo}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.71rem', color: 'var(--texto-atenuado)', fontStyle: 'italic' }}>
                        {cambio.nota || 'La imagen previa será reemplazada en el almacenamiento seguro institucional.'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Botones de Acción */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.35rem' }}>
              <button
                type="button"
                onClick={() => setModalConfirmarCambiosOpticaAbierto(false)}
                disabled={guardandoOptica}
                className="btn-pildora-secundario"
                style={{ padding: '0.45rem 1.1rem', fontSize: '0.82rem' }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={ejecutarGuardarOptica}
                disabled={guardandoOptica}
                className="btn-pildora-primario"
                style={{ padding: '0.45rem 1.25rem', fontSize: '0.82rem' }}
              >
                <Check style={{ width: '14px', height: '14px' }} />
                <span>{guardandoOptica ? 'Guardando...' : 'Confirmar y Guardar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
