// Service Worker para Notificaciones Push Web - CRM Óptica
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        titulo: 'CRM Óptica',
        cuerpo: event.data.text(),
      };
    }
  }

  const titulo = data.titulo || '🔔 Alerta de Atención - CRM Óptica';
  const opciones = {
    body: data.cuerpo || 'Un paciente requiere atención de un asesor humano.',
    icon: data.icono || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    tag: data.tag || 'crm-alerta-asesor',
    renotify: true,
    requireInteraction: true,
    vibrate: data.vibrate || [200, 100, 200, 100, 200],
    data: {
      url: data.url || '/',
      ...data.datos,
    },
  };

  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlDestino = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientesVentana) => {
      // Si ya hay una pestaña del CRM abierta, enfocarla y navegar
      for (const cliente of clientesVentana) {
        if ('focus' in cliente) {
          cliente.navigate(urlDestino);
          return cliente.focus();
        }
      }
      // Si no hay ninguna ventana abierta, abrir una nueva
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlDestino);
      }
    })
  );
});

