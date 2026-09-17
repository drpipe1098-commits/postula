/**
 * CANDADO — Comportamiento del autorrelleno en un navegador real.
 *
 * Los demás candados prueban la lógica sin DOM. Este abre un Chromium de
 * verdad sobre formularios que reproducen cómo están construidos los
 * portales de empleo colombianos, y comprueba qué quedó escrito en cada
 * campo.
 *
 * Cubre las tres formas reales de construir un formulario:
 *  - `portal-clasico.html`     · <label for> explícito y selects
 *  - `portal-sin-labels.html`  · el rótulo vive en un div hermano
 *  - `portal-moderno.html`     · autocomplete estándar, iframe y trampas
 *  - `portal-experiencia.html` · historial laboral repetido, como elempleo.com
 *
 * Si no hay navegador disponible, la prueba se salta sin fallar: el resto
 * de los candados sigue corriendo con Node puro.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrato, RAIZ } from './ayuda.mjs';
import { abrirNavegador } from './navegador/cdp.mjs';

const c = contrato('navegador-contract');

const ARCHIVOS = [
  'extension/lib/normalizar.js',
  'extension/lib/perfil.js',
  'extension/content/matcher.js',
  'extension/content/experiencia.js',
  'extension/content/autofill.js'
];
const FUENTES = ARCHIVOS.map((a) => readFileSync(join(RAIZ, a), 'utf8'));

// Datos ficticios: el repositorio nunca contiene datos personales reales.
const PERFIL = {
  nombres: 'Ana María', apellidos: 'Gómez Ruiz',
  tipoDocumento: 'Cédula de ciudadanía', numeroDocumento: '1234567890',
  fechaNacimiento: '', genero: '', nacionalidad: 'Colombiana',
  email: 'ana@ejemplo.com', celular: '3001234567', telefono: '',
  direccion: 'Calle 10 # 5-25', ciudad: 'Pereira', departamento: 'Risaralda',
  pais: 'Colombia', codigoPostal: '660001',
  linkedin: 'https://www.linkedin.com/in/ejemplo/', portafolio: '', github: '',
  titularProfesional: 'Analista de Soporte TI',
  resumenProfesional: 'Analista de soporte con experiencia en mesa de ayuda.',
  anosExperiencia: '6', pretensionSalarial: 'Desde el mínimo, negociable',
  disponibilidad: 'Inmediata', modalidad: 'Remoto',
  disponibilidadViajar: '', licenciaConduccion: '', tieneVehiculo: '',
  nivelEducativo: 'Tecnólogo', titulo: 'Tecnólogo en ADSI',
  institucion: 'SENA', anoGrado: '2021',
  experiencia: [
    { cargo: 'Analista de Soporte Nivel 2', empresa: 'Servicios Ejemplo Dos SAS',
      desde: 'Marzo 2022', hasta: 'Presente',
      funciones: 'Atención de incidentes y escalamiento a proveedores.' },
    { cargo: 'Gestor de Proyectos Multimedia', empresa: 'Agencia Ejemplo Uno SAS',
      desde: 'Octubre 2020', hasta: 'Marzo 2021',
      funciones: 'Administración de contenidos y optimización SEO.' },
    { cargo: 'Auxiliar de Mesa de Ayuda', empresa: 'Ejemplo Tres Ltda',
      desde: 'Enero 2019', hasta: 'Febrero 2020',
      funciones: 'Registro de tickets y soporte a usuarios finales.' }
  ],
  idiomas: []
};

const LEER_CAMPOS = `JSON.stringify(
  Array.from(document.querySelectorAll('input, textarea, select'))
    .map((e) => [e.name || e.id, e.value])
)`;

async function contextosDe(navegador) {
  const vistos = [];
  navegador.alRecibir((mensaje) => {
    if (mensaje.method === 'Runtime.executionContextCreated') {
      vistos.push(mensaje.params.context.id);
    }
  });
  return vistos;
}

async function correrFormulario(navegador, contextos, archivo) {
  await navegador.enviar('Page.navigate', { url: `file://${join(RAIZ, 'tests/navegador', archivo)}` });
  await navegador.esperarEvento('Page.loadEventFired');
  await new Promise((listo) => setTimeout(listo, 400)); // que asienten los iframes

  const campos = {};
  let informe = { llenados: [], omitidos: [], sinCoincidencia: 0 };

  for (const contextId of [...contextos]) {
    try {
      for (const fuente of FUENTES) {
        await navegador.enviar('Runtime.evaluate', { expression: fuente, contextId });
      }
      const ejecucion = await navegador.enviar('Runtime.evaluate', {
        expression: `JSON.stringify(globalThis.POSTULA_Autofill.rellenar(${JSON.stringify(PERFIL)}))`,
        contextId, returnByValue: true
      });
      if (ejecucion.result && ejecucion.result.value) {
        const parcial = JSON.parse(ejecucion.result.value);
        informe.llenados.push(...parcial.llenados);
        informe.omitidos.push(...parcial.omitidos);
        informe.sinCoincidencia += parcial.sinCoincidencia;
      }
      const lectura = await navegador.enviar('Runtime.evaluate', {
        expression: LEER_CAMPOS, contextId, returnByValue: true
      });
      if (lectura.result && lectura.result.value) {
        JSON.parse(lectura.result.value).forEach(([nombre, valor]) => { campos[nombre] = valor; });
      }
    } catch {
      // Contexto ya destruido (navegación anterior): se ignora.
    }
  }
  return { campos, informe };
}

const navegador = await abrirNavegador();

if (!navegador) {
  // En CI la ausencia de navegador es una falla: la compuerta existe para correr.
  if (process.env.POSTULA_EXIGIR_NAVEGADOR === '1') {
    c.exigir(false, 'no se encontró ningún navegador y POSTULA_EXIGIR_NAVEGADOR=1');
  } else {
    console.log('… navegador-contract omitido: no hay Chromium disponible en este equipo.');
  }
} else {
  try {
    await navegador.enviar('Page.enable');
    await navegador.enviar('Runtime.enable');
    const contextos = await contextosDe(navegador);

    // ---------- 1. Portal clásico ----------
    let r = await correrFormulario(navegador, contextos, 'portal-clasico.html');
    const esperadoClasico = {
      nombres: 'Ana María',
      apellidos: 'Gómez Ruiz',
      tipoDocumento: 'CC',
      numeroDocumento: '1234567890',
      email: 'ana@ejemplo.com',
      celular: '3001234567',
      direccion: 'Calle 10 # 5-25',
      ciudad: 'Pereira',
      departamento: 'Risaralda',
      nivelEducativo: 'Tecnólogo',
      aspiracionSalarial: 'Desde el mínimo, negociable',
      presentacion: 'Analista de soporte con experiencia en mesa de ayuda.'
    };
    Object.entries(esperadoClasico).forEach(([campo, valor]) => {
      c.igual(r.campos[campo], valor, `portal clásico · campo «${campo}»`);
    });
    c.igual(r.campos.palabraClave, '', 'portal clásico · el buscador de empleo NO se toca');
    c.igual(r.campos.usuario, '', 'portal clásico · el usuario de acceso NO se toca');
    c.igual(r.campos.clave, '', 'portal clásico · la contraseña NO se toca');

    // ---------- 2. Portal sin etiquetas ----------
    r = await correrFormulario(navegador, contextos, 'portal-sin-labels.html');
    const esperadoSinLabels = {
      fullName: 'Ana María Gómez Ruiz',
      mail01: 'ana@ejemplo.com',
      mobile01: '3001234567',
      loc01: 'Pereira',
      social01: 'https://www.linkedin.com/in/ejemplo/',
      exp01: '6',
      avail01: 'Inmediata',
      mod01: 'Remoto',
      cover01: 'Analista de soporte con experiencia en mesa de ayuda.'
    };
    Object.entries(esperadoSinLabels).forEach(([campo, valor]) => {
      c.igual(r.campos[campo], valor, `portal sin etiquetas · campo «${campo}»`);
    });
    c.igual(r.campos.currentCompany, '', 'sin etiquetas · el nombre de la EMPRESA NO se llena con el del candidato');
    c.igual(r.campos.emergencyName, '', 'sin etiquetas · el contacto de emergencia NO se toca');
    c.igual(r.campos.emergencyPhone, '', 'sin etiquetas · el teléfono de emergencia NO se toca');
    c.igual(r.campos.offeredSalary, '', 'sin etiquetas · el salario OFRECIDO no es la aspiración del candidato');

    // ---------- 3. Portal moderno, con iframe y trampas ----------
    r = await correrFormulario(navegador, contextos, 'portal-moderno.html');
    const esperadoModerno = {
      givenName: 'Ana María',
      familyName: 'Gómez Ruiz',
      mail: 'ana@ejemplo.com',
      phone: '3001234567',
      city: 'Pereira',
      country: 'Colombia',
      paisLista: 'CO',
      frameNombres: 'Ana María',
      frameApellidos: 'Gómez Ruiz',
      frameEmail: 'ana@ejemplo.com'
    };
    Object.entries(esperadoModerno).forEach(([campo, valor]) => {
      c.igual(r.campos[campo], valor, `portal moderno · campo «${campo}»`);
    });
    c.igual(r.campos.csrfToken, 'abc123', 'moderno · un campo oculto queda intacto');
    c.igual(r.campos.ciudadBloqueada, '', 'moderno · un campo deshabilitado no se toca');
    c.igual(r.campos.correoBloqueado, 'no-tocar@ejemplo.com', 'moderno · un campo de solo lectura no se toca');
    c.igual(r.campos.tarjeta, '', 'moderno · la tarjeta de crédito NUNCA se toca');
    c.igual(r.campos.cvv, '', 'moderno · el CVV NUNCA se toca');
    c.igual(r.campos.invisible, '', 'moderno · un campo invisible no se toca');
    // ---------- 4. Historial laboral repetido (elempleo.com) ----------
    //
    // El fallo real: «Nombre del cargo» dentro de la fila de un empleo se
    // llenaba con el titular profesional. POSTULA declaraba ante un
    // empleador un cargo que la persona nunca tuvo en esa empresa.
    r = await correrFormulario(navegador, contextos, 'portal-experiencia.html');

    // El bloque 1 ya decía de qué empleo habla: «Agencia Ejemplo Uno SAS»,
    // 2020–2021. Le corresponde la segunda entrada, no la primera.
    c.igual(r.campos.cargo1, 'Gestor de Proyectos Multimedia',
      'experiencia · el cargo sale de la entrada que corresponde al bloque');
    c.exigir(r.campos.cargo1 !== PERFIL.titularProfesional,
      'experiencia · el titular profesional NUNCA va dentro de una fila de empleo');
    c.igual(r.campos.logros1, 'Administración de contenidos y optimización SEO.',
      'experiencia · las funciones son las de ese empleo');
    c.igual(r.campos.mesInicio1, 'Oct', 'experiencia · el mes va a la lista de meses');
    c.igual(r.campos.mesFin1, 'Mar', 'experiencia · el mes de fin también');
    c.igual(r.campos.empresa1, 'Agencia Ejemplo Uno SAS',
      'experiencia · lo que la persona ya escribió no se pisa');
    c.igual(r.campos.anoInicio1, '2020', 'experiencia · el año ya escrito tampoco');

    // El bloque 2 estaba vacío: le toca la entrada más reciente que quedaba.
    c.igual(r.campos.cargo2, 'Analista de Soporte Nivel 2',
      'experiencia · un bloque vacío recibe la entrada más reciente disponible');
    c.igual(r.campos.empresa2, 'Servicios Ejemplo Dos SAS',
      'experiencia · con su empresa');
    c.igual(r.campos.mesInicio2, 'Marzo', 'experiencia · mes en una casilla de texto');
    c.igual(r.campos.anoInicio2, '2022', 'experiencia · año en su propia casilla');
    c.exigir(r.campos.cargo2 !== r.campos.cargo1,
      'experiencia · dos bloques nunca reciben el mismo empleo');

    // Fuera de los bloques, el titular profesional sí es lo correcto.
    c.igual(r.campos.cargoAspira, 'Analista de Soporte TI',
      'experiencia · «Cargo al que aspiras» SÍ es el titular de la persona');
    c.igual(r.campos.email, 'ana@ejemplo.com',
      'experiencia · los datos normales del perfil se siguen llenando');

    // Trampas.
    c.igual(r.campos.cargoEquivalente1, '',
      'experiencia · «Cargo equivalente» es sugerencia del portal: no se toca');
    c.igual(r.campos.sector1, '',
      'experiencia · el sector de la empresa no es un dato de la persona');
    c.igual(r.campos.ubicacionEmpresa1, '',
      'experiencia · la ubicación es de la EMPRESA: no se pone la ciudad de la persona');
    c.igual(r.campos.requisitosCargo, '',
      'experiencia · los requisitos de la vacante siguen sin tocarse');
    c.igual(r.campos.palabraClave, '', 'experiencia · el buscador NO se toca');
    c.igual(r.campos.clave, '', 'experiencia · la contraseña NUNCA se toca');

  } catch (error) {
    c.exigir(false, 'la prueba de navegador reventó: ' + (error.message || error));
  } finally {
    await navegador.cerrar();
  }
}

c.cerrar();
