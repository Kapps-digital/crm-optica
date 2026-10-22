'use client';

import React, { useMemo } from 'react';
import { MessageSquare } from 'lucide-react';
import { EtiquetaTooltip } from '../comunes/EtiquetaTooltip';
import { formatearTelefonoSinPrefijo } from '@/utilidades/formato';

interface PropiedadesIndicadorCanalWhatsApp {
  conectado: boolean;
  numero?: string | null;
}

export const IndicadorCanalWhatsApp: React.FC<PropiedadesIndicadorCanalWhatsApp> = ({
  conectado,
  numero,
}) => {
  const numeroFormateado = useMemo(() => {
    if (!numero) return 'Sin número';
    return formatearTelefonoSinPrefijo(numero) || numero;
  }, [numero]);

  if (!conectado || !numero) {
    return (
      <EtiquetaTooltip
        texto="Sin número conectado. Activa tu canal en Configuración."
        posicion="abajo"
      >
        <div className="pildora-whatsapp-inactiva">
          <span className="punto-canal-inactivo" />
          <span>Sin canal activo</span>
        </div>
      </EtiquetaTooltip>
    );
  }

  return (
    <EtiquetaTooltip
      texto="Canal WhatsApp oficial activo • Mensajería en tiempo real"
      posicion="abajo"
    >
      <div className="wa-variante-tarjeta">
        <div className="wa-mini-avatar">
          <MessageSquare size={14} className="icono-wa-blanco" />
          <span className="wa-avatar-punto-online" />
        </div>
        <div className="wa-tarjeta-info">
          <span className="wa-tarjeta-etiqueta">Canal WhatsApp</span>
          <span className="wa-tarjeta-numero">{numeroFormateado}</span>
        </div>
      </div>
    </EtiquetaTooltip>
  );
};
