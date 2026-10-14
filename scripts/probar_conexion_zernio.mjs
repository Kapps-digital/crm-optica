import { ClienteZernio } from '../servicios/cliente_zernio.mjs';

async function probar_conexion() {
  console.log('==============================================');
  console.log('   PRUEBA DE CONEXIÓN CON ZERNIO (CRM ÓPTICA) ');
  console.log('==============================================\n');

  const cliente = new ClienteZernio();

  if (!cliente.clave_api) {
    console.log('⚠️  ATENCIÓN: La variable ZERNIO_API_KEY está vacía en tu archivo .env.');
    console.log('   Por favor abre el archivo .env y asigna tu API Key obtenida en:');
    console.log('   👉 https://zernio.com/dashboard/api-keys\n');
    process.exit(0);
  }

  console.log('1. Verificando credenciales contra la API de Zernio...');
  const resultado_cuentas = await cliente.obtener_cuentas();

  if (!resultado_cuentas.exito) {
    console.error('❌ Error de conexión:');
    console.error(`   Estado HTTP: ${resultado_cuentas.error.estado}`);
    console.error(`   Código:      ${resultado_cuentas.error.codigo}`);
    console.error(`   Mensaje:     ${resultado_cuentas.error.mensaje}`);

    if (resultado_cuentas.error.estado === 401) {
      console.log('\n💡 Sugerencia: Verifica que la clave en ZERNIO_API_KEY sea correcta y esté activa.');
    }
    process.exit(1);
  }

  const datos_respuesta = resultado_cuentas.datos;
  console.log('Respuesta recibida de /accounts:');
  console.log(JSON.stringify(datos_respuesta, null, 2));

  let cuentas = [];
  if (Array.isArray(datos_respuesta)) {
    cuentas = datos_respuesta;
  } else if (Array.isArray(datos_respuesta?.data)) {
    cuentas = datos_respuesta.data;
  } else if (Array.isArray(datos_respuesta?.accounts)) {
    cuentas = datos_respuesta.accounts;
  }

  console.log(`\n✅ Conexión exitosa. Cuentas conectadas encontradas: ${cuentas.length}\n`);

  if (cuentas.length === 0) {
    console.log('ℹ️  Aún no tienes cuentas de mensajería vinculadas en Zernio.');
    console.log('   Puedes conectar WhatsApp, Instagram o Messenger desde tu panel o mediante el flujo OAuth.');
  } else {
    console.log('Cuentas vinculadas:');
    cuentas.forEach((cuenta, indice) => {
      const id = cuenta.id || cuenta._id;
      const plataforma = cuenta.platform || cuenta.channel || 'Desconocida';
      const nombre = cuenta.name || cuenta.username || cuenta.phoneNumber || 'Sin nombre';
      console.log(`   [${indice + 1}] Plataforma: ${plataforma} | Nombre: ${nombre} | ID: ${id}`);
    });
  }

  console.log('\n2. Verificando perfiles agrupadores...');
  const resultado_perfiles = await cliente.obtener_perfiles();
  if (resultado_perfiles.exito) {
    const datos_perfiles = resultado_perfiles.datos;
    let perfiles = [];
    if (Array.isArray(datos_perfiles)) {
      perfiles = datos_perfiles;
    } else if (Array.isArray(datos_perfiles?.data)) {
      perfiles = datos_perfiles.data;
    } else if (Array.isArray(datos_perfiles?.profiles)) {
      perfiles = datos_perfiles.profiles;
    }
    console.log(`✅ Perfiles disponibles: ${perfiles.length}`);
    if (perfiles.length > 0) {
      perfiles.forEach((p, idx) => {
        const id_p = p.id || p._id;
        console.log(`   [${idx + 1}] Perfil: ${p.name || 'Sin nombre'} (ID: ${id_p})`);
      });
    }
  } else {
    console.log(`ℹ️  No se pudieron obtener perfiles: ${resultado_perfiles.error.mensaje}`);
  }

  console.log('\n==============================================');
  console.log('   ¡Cliente HTTP de Zernio listo y validado!  ');
  console.log('==============================================\n');
}

probar_conexion();
