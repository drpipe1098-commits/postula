/**
 * CANDADO — Filtros y puntaje de vacantes.
 *
 * Dos propiedades que este archivo protege:
 *
 *  1. **Ante la duda, la vacante pasa.** El filtro sirve para no perder el
 *     tiempo en avisos imposibles, no para decidir por la persona. Una
 *     vacante sin salario publicado o sin modalidad declarada se muestra
 *     con una advertencia; esconderla sería esconder la oferta buena por
 *     una palabra que el reclutador no escribió.
 *  2. **El puntaje se puede auditar.** Cada puntaje viene con las palabras
 *     concretas que lo produjeron. Un número que la persona no puede
 *     verificar no sirve para decidir a qué se postula.
 *
 * Todos los datos son ficticios.
 */
import { contrato } from './ayuda.mjs';
import { leerVacantes, leerTexto } from '../herramientas/lib/vacantes.mjs';
import { CRITERIOS_POR_DEFECTO, evaluar, leerSalario, leerModalidad,
  exigeInglesHablado, exigeTrabajoEnTerreno } from '../herramientas/lib/criterios.mjs';
import { calcular } from '../herramientas/lib/puntaje.mjs';
import { Normalizar } from '../herramientas/lib/esquema.mjs';

const c = contrato('vacantes-contract');

// --- 1. El salario, escrito como lo escriben los portales ---
[
  ['$2.500.000', 2500000, 2500000],
  ['2.000.000 a 2.400.000', 2000000, 2400000],
  ["COP 3'500.000", 3500000, 3500000],
  ['Salario: 4000000', 4000000, 4000000],
  ['$1.900.000 mensuales', 1900000, 1900000]
].forEach(([texto, minimo, maximo]) => {
  const leido = leerSalario(texto);
  c.exigir(leido.publicado, `«${texto}» debería leerse como un salario publicado`);
  c.igual([leido.minimo, leido.maximo], [minimo, maximo], `«${texto}» mal leído`);
});

['A convenir', 'Salario a negociar', 'Confidencial', ''].forEach((texto) => {
  c.exigir(!leerSalario(texto).publicado, `«${texto}» no es un salario publicado`);
});

// Un «nivel 2» o un año no son un sueldo.
c.exigir(!leerSalario('Soporte nivel 2, vacante de 2024').publicado,
  'los números que no son sueldos no se leen como sueldo');

// --- 2. El inglés que descarta y el que no ---
[
  'Se requiere inglés B2 conversacional',
  'Inglés C1 para atención de llamadas en inglés',
  'Candidato bilingüe español-inglés',
  'Inglés avanzado hablado'
].forEach((texto) => {
  c.exigir(exigeInglesHablado(texto), `«${texto}» exige inglés hablado y debe descartar`);
});

[
  'Inglés técnico de lectura deseable',
  'Comprensión de lectura en inglés para documentación',
  'Inglés escrito básico',
  'No se requiere inglés'
].forEach((texto) => {
  c.exigir(!exigeInglesHablado(texto),
    `«${texto}» no exige inglés hablado: no puede descartar la vacante`);
});

// --- 3. Trabajo en terreno ---
['Incluye cableado estructurado', 'Visitas a clientes en la ciudad',
  'Mantenimiento físico de equipos', 'Trabajo en alturas'].forEach((texto) => {
  c.exigir(exigeTrabajoEnTerreno(texto), `«${texto}» es trabajo en terreno`);
});
c.exigir(!exigeTrabajoEnTerreno('Soporte remoto a usuarios finales'),
  'el soporte remoto no es trabajo en terreno');

// --- 4. Modalidad ---
c.igual(leerModalidad('100% teletrabajo'), 'remoto', 'teletrabajo es remoto');
c.igual(leerModalidad('Trabajo híbrido'), 'hibrido', 'híbrido');
c.igual(leerModalidad('Presencial en oficina'), 'presencial', 'presencial');
c.igual(leerModalidad('No dice nada'), '', 'sin pistas, sin modalidad');

// --- 5. Los descartes, sobre vacantes completas ---
const bajoSalario = evaluar({ titulo: 'Analista', salario: '$1.800.000', modalidad: 'Remoto' });
c.exigir(!bajoSalario.pasa, 'por debajo del mínimo se descarta');

const presencialLejos = evaluar({ titulo: 'Analista', salario: '$3.000.000',
  modalidad: 'Presencial', ubicacion: 'Cali' });
c.exigir(!presencialLejos.pasa, 'presencial fuera de las ciudades aceptadas se descarta');

const hibridoEnCasa = evaluar({ titulo: 'Analista', salario: '$3.000.000',
  modalidad: 'Híbrido', ubicacion: 'Pereira, Risaralda' });
c.exigir(hibridoEnCasa.pasa, 'híbrido en la ciudad de la persona sí pasa');

// --- 6. Ante la duda, pasa y avisa ---
const sinSalario = evaluar({ titulo: 'Moderador de contenido', salario: 'A convenir',
  modalidad: 'Remoto' });
c.exigir(sinSalario.pasa, 'una vacante sin salario publicado no se esconde');
c.exigir(sinSalario.avisos.some((a) => a.includes('salario')),
  'pero sí se avisa que no publica salario');

const sinModalidad = evaluar({ titulo: 'Asistente virtual', salario: '$3.000.000',
  descripcion: 'Apoyo administrativo' });
c.exigir(sinModalidad.pasa, 'una vacante sin modalidad declarada no se esconde');
c.exigir(sinModalidad.avisos.some((a) => a.includes('modalidad')),
  'pero sí se avisa que hay que confirmarla');

// --- 7. El puntaje es explicable y ordena bien ---
const perfil = {
  titularProfesional: 'Analista de soporte TI y automatización',
  resumenProfesional: 'Soporte técnico de segundo nivel, automatización con Python, SLAs.',
  habilidades: 'Python, Microsoft 365, AnyDesk, TeamViewer, sistemas de tickets',
  certificaciones: 'Google IT Support',
  titulo: 'Tecnóloga en Análisis y Desarrollo de Sistemas',
  nivelEducativo: 'Tecnólogo',
  experiencia: [{ cargo: 'Analista de Soporte Nivel 2', empresa: 'Ejemplo SAS',
    funciones: 'Atención de incidentes, escalamiento, documentación técnica, SLAs.' }]
};

const encaja = calcular({
  titulo: 'Analista de Soporte Nivel 2',
  modalidad: 'Remoto', salario: '$3.500.000',
  descripcion: 'Atención de incidentes, documentación técnica, Microsoft 365, AnyDesk, SLAs.'
}, perfil, CRITERIOS_POR_DEFECTO);

const noEncaja = calcular({
  titulo: 'Chef ejecutivo de cocina',
  modalidad: 'Presencial', salario: '$2.600.000',
  descripcion: 'Manejo de cocina caliente, montaje de platos y control de inventario de alimentos.'
}, perfil, CRITERIOS_POR_DEFECTO);

c.exigir(encaja.puntaje > noEncaja.puntaje,
  'la vacante del oficio de la persona debe puntuar más alto que una ajena');
c.exigir(encaja.puntaje >= 70, `una coincidencia clara debe pasar de 70 (dio ${encaja.puntaje})`);
c.exigir(noEncaja.puntaje < 45, `un oficio ajeno debe quedar bajo (dio ${noEncaja.puntaje})`);
c.exigir(encaja.razones.length > 0, 'el puntaje alto debe venir con sus razones');
c.exigir(encaja.detalle.terminosComunes.length > 0,
  'las razones deben incluir las palabras concretas que coincidieron');
// Se comparan sobre texto normalizado, que es como se calcularon: en el
// perfil «documentación técnica» lleva tilde y el término coincidente no.
const perfilNormalizado = Normalizar.normalizar(JSON.stringify(perfil));
encaja.detalle.terminosComunes.forEach((termino) => {
  c.exigir(perfilNormalizado.includes(termino),
    `«${termino}» se presenta como coincidencia pero no está en el perfil`);
});

// El puntaje siempre cabe en 0..100, incluso sin perfil.
const sinPerfil = calcular({ titulo: 'Analista', descripcion: 'x' }, {}, CRITERIOS_POR_DEFECTO);
c.exigir(sinPerfil.puntaje >= 0 && sinPerfil.puntaje <= 100,
  'el puntaje debe quedar entre 0 y 100 aunque no haya perfil');

// --- 8. Lectura del archivo de vacantes, en sus dos formatos ---
const enTexto = leerTexto(`Cargo: Analista de Mesa de Ayuda
Empresa: Ejemplo SAS
Salario: $3.000.000
Modalidad: Remoto
Enlace: https://ejemplo.com/1
Descripción: Atención de incidentes
  y escalamiento a proveedores.
---
Cargo: Asistente Virtual
Empresa: Otra Ejemplo Ltda
Modalidad: Híbrido`);

c.igual(enTexto.length, 2, 'dos bloques separados por --- son dos vacantes');
c.igual(enTexto[0].titulo, 'Analista de Mesa de Ayuda', 'el cargo');
c.igual(enTexto[0].empresa, 'Ejemplo SAS', 'la empresa');
c.igual(enTexto[0].enlace, 'https://ejemplo.com/1', 'el enlace');
c.exigir(enTexto[0].descripcion.includes('escalamiento a proveedores'),
  'la descripción continúa en los renglones sin etiqueta');

const enJson = leerVacantes(JSON.stringify([
  { titulo: 'Soporte Remoto', empresa: 'Ejemplo', salario: '$2.900.000' },
  { cargo: 'Moderador', company: 'Otra' }
]));
c.igual(enJson.length, 2, 'el JSON también se lee');
c.igual(enJson[1].titulo, 'Moderador', 'se aceptan nombres alternos de campo');

c.igual(leerVacantes('[]'), [], 'una lista vacía no produce vacantes fantasma');

c.cerrar();
