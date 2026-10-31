'use client';

import React from 'react';
import {
  MessageSquare,
  Users,
  CalendarDays,
  Target,
  FileText,
  Settings,
} from 'lucide-react';

interface PropiedadesBarraNavegacionInferiorMovil {
  vistaActiva: string;
  alCambiarVista: (vista: string) => void;
  conteoChats?: number | null;
  requiereAsesorChats?: boolean;
}

export const BarraNavegacionInferiorMovil: React.FC<PropiedadesBarraNavegacionInferiorMovil> = ({
  vistaActiva,
  alCambiarVista,
  conteoChats = 0,
  requiereAsesorChats = false,
}) => {
  const elementos = [
    {
      id: 'mensajeria',
      etiqueta: 'Bandeja',
      icono: MessageSquare,
      conteo: conteoChats,
      esUrgente: Boolean(requiereAsesorChats),
    },
    {
      id: 'pacientes',
      etiqueta: 'Pacientes',
      icono: Users,
      conteo: null,
      esUrgente: false,
    },
    {
      id: 'citas',
      etiqueta: 'Citas',
      icono: CalendarDays,
      conteo: null,
      esUrgente: false,
    },
    {
      id: 'campanas',
      etiqueta: 'Campañas',
      icono: Target,
      conteo: null,
      esUrgente: false,
    },
    {
      id: 'plantillas',
      etiqueta: 'Plantillas',
      icono: FileText,
      conteo: null,
      esUrgente: false,
    },
    {
      id: 'configuracion',
      etiqueta: 'Ajustes',
      icono: Settings,
      conteo: null,
      esUrgente: false,
    },
  ];

  return (
    <nav className="barra-inferior-movil" aria-label="Navegación principal móvil">
      {elementos.map((item) => {
        const Icono = item.icono;
        const estaActivo = vistaActiva === item.id;

        return (
          <button
            key={item.id}
            type="button"
            className={`item-barra-inferior ${estaActivo ? 'activo' : ''}`}
            onClick={() => alCambiarVista(item.id)}
            aria-current={estaActivo ? 'page' : undefined}
          >
            <div className="icono-envoltorio-barra-inferior">
              <Icono size={20} strokeWidth={estaActivo ? 2.4 : 1.8} />
              {item.conteo !== null && Number(item.conteo) > 0 && (
                <span
                  className={`badge-barra-inferior ${item.esUrgente ? 'urgente' : ''}`}
                >
                  {Number(item.conteo) > 99 ? '99+' : item.conteo}
                </span>
              )}
            </div>
            <span className="etiqueta-barra-inferior">{item.etiqueta}</span>
          </button>
        );
      })}
    </nav>
  );
};

