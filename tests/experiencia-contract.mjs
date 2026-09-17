/**
 * CANDADO — Bloques de experiencia laboral.
 *
 * Nace de un fallo encontrado postulándose de verdad en elempleo.com: el
 * campo «Nombre del cargo» de la fila de un empleo pasado se llenó con el
 * titular profesional de la hoja de vida. POSTULA afirmó ante un empleador
 * que el cargo en esa empresa había sido otro.
 *
 * Lo que este archivo protege:
 *
 *  1. **Un campo de fila no es un campo del perfil**, aunque se llamen
 *     parecido. «Cargo al que aspiras» es de la persona; «Nombre del cargo»
 *     dentro de un empleo es de ese empleo.
 *  2. **Cada bloque recibe SU empleo.** Lo que el formulario ya tiene
 *     escrito decide de cuál habla; es la señal más confiable que existe.
 *  3. **Las fechas se reparten.** El perfil dice «Octubre 2020» y el portal
 *     tiene una lista de meses y una casilla de año.
 *
 * Todos los datos son ficticios.
 */
import { cargar, contrato } from './ayuda.mjs';

const ambito = cargar(['extension/lib/normalizar.js', 'extension/content/experiencia.js']);
const X = ambito.POSTULA_Experiencia;
const N = ambito.POSTULA_Normalizar;
const c = contrato('experiencia-contract');

const EXPERIENCIA = [
  { cargo: 'Analista de Soporte Nivel 2', empresa: 'Servicios Ejemplo Dos SAS',
    desde: 'Marzo 2022', hasta: 'Presente', funciones: 'Atención de incidentes.' },
  { cargo: 'Gestor de Proyectos Multimedia', empresa: 'Agencia Ejemplo Uno SAS',
    desde: 'Octubre 2020', hasta: 'Marzo 2021', funciones: 'Contenidos y SEO.' },
  { cargo: 'Auxiliar de Mesa de Ayuda', empresa: 'Ejemplo Tres Ltda',
    desde: 'Enero 2019', hasta: 'Febrero 2020', funciones: 'Registro de tickets.' }
];

// --- 1. Qué es un campo de fila y qué no ---
[
  ['Nombre del cargo', 'cargo'],
  ['Título del cargo', 'cargo'],
  ['Empresa', 'empresa'],
  ['Nombre de la empresa', 'empresa'],
  ['Fecha de inicio', 'desde'],
  ['Mes de inicio', 'desde'],
  ['Año de inicio', 'desde'],
  ['Fecha de finalización', 'hasta'],
  ['Tus logros y responsabilidades', 'funciones'],
  ['Funciones del cargo', 'funciones']
].forEach(([etiqueta, esperado]) => {
  const r = X.detectarCampoDeFila({ etiqueta });
  c.igual(r && r.campo, esperado, `«${etiqueta}» es el campo de fila «${esperado}»`);
});

// Lo que parece de fila pero NO lo es. Estos son los que producen el daño:
// si caen en un bloque, POSTULA escribe el dato de la persona donde va otra
// cosa; si no caen, el motor general los trata como corresponde.
[
  'Cargo al que aspiras',
  'Cargo actual',
  'Cargo deseado',
  'Cargo equivalente',
  'Sector de la empresa',
  'Ubicación',
  'Habilidades requeridas para el cargo',
  'Años de experiencia requeridos',
  'Requisitos del cargo'
].forEach((etiqueta) => {
  c.igual(X.detectarCampoDeFila({ etiqueta }), null,
    `«${etiqueta}» NO pertenece a una fila de experiencia`);
});

// El `name` del campo no puede mandar sobre su rótulo: los portales escriben
// «ubicacionEmpresa» y comparar por subcadena confundiría la ubicación con
// el nombre de la empresa.
c.igual(X.detectarCampoDeFila({ etiqueta: 'Ubicación', nombre: 'ubicacionEmpresa1' }), null,
  'un campo de ubicación con «empresa» en su name no es el nombre de la empresa');

// --- 2. Cada bloque recibe su empleo ---
const porEmpresa = X.emparejar([{ empresa: 'Agencia Ejemplo Uno SAS', anos: [] }], EXPERIENCIA);
c.igual(porEmpresa, [1], 'un bloque que ya dice la empresa recibe ESA entrada');

const porEmpresaSuelta = X.emparejar([{ empresa: 'Agencia Ejemplo Uno', anos: [] }], EXPERIENCIA);
c.igual(porEmpresaSuelta, [1], 'la forma jurídica no impide reconocer la empresa');

const porFechas = X.emparejar([{ empresa: '', anos: [2019, 2020] }], EXPERIENCIA);
c.igual(porFechas, [2], 'sin empresa, las fechas identifican el empleo');

const porOrden = X.emparejar(
  [{ empresa: '', anos: [] }, { empresa: '', anos: [] }, { empresa: '', anos: [] }],
  EXPERIENCIA
);
c.igual(porOrden, [0, 1, 2], 'bloques vacíos se llenan en orden, del más reciente al más antiguo');

const mezclado = X.emparejar(
  [{ empresa: '', anos: [] }, { empresa: 'Ejemplo Tres Ltda', anos: [] }, { empresa: '', anos: [] }],
  EXPERIENCIA
);
c.igual(mezclado[1], 2, 'lo identificado manda sobre el orden');
c.exigir(new Set(mezclado).size === 3, 'ninguna entrada se asigna a dos bloques');

// Más bloques que empleos: los que sobran se quedan sin entrada, no reciben
// el empleo de otro.
const sobran = X.emparejar(
  [{ empresa: '', anos: [] }, { empresa: '', anos: [] }, { empresa: '', anos: [] },
    { empresa: '', anos: [] }, { empresa: '', anos: [] }],
  EXPERIENCIA
);
c.igual(sobran.filter((v) => v !== null).length, 3, 'solo se asignan tantos bloques como empleos hay');
c.igual(sobran.slice(3), [null, null], 'los bloques sobrantes quedan sin entrada');

c.igual(X.emparejar([{ empresa: '', anos: [] }], []), [null],
  'sin experiencia en el perfil no se inventa ninguna');

// --- 3. Las fechas se reparten entre las casillas ---
[
  [{ etiqueta: 'Fecha de inicio', tipo: 'text' }, 'Octubre 2020'],
  [{ etiqueta: 'Mes de inicio', tipo: 'text' }, 'Octubre'],
  [{ etiqueta: 'Año de inicio', tipo: 'text' }, '2020'],
  [{ etiqueta: 'Inicio', tipo: 'month' }, '2020-10'],
  [{ etiqueta: 'Inicio', tipo: 'date' }, '2020-10-01'],
  [{ etiqueta: 'Inicio', tipo: 'text', esLista: true }, 'Octubre']
].forEach(([descriptor, esperado]) => {
  c.igual(X.valorDeFecha(descriptor, 'Octubre 2020'), esperado,
    `«${descriptor.etiqueta}» (${descriptor.tipo}${descriptor.esLista ? ', lista' : ''}) recibe «${esperado}»`);
});

c.igual(X.valorDeFecha({ etiqueta: 'Fecha de finalización', tipo: 'text' }, 'Presente'), '',
  'un empleo en curso deja vacía la fecha de fin, no escribe «Presente» como si fuera fecha');

const sinMes = X.partirFecha('2020');
c.igual([sinMes.mes, sinMes.ano], [null, 2020], 'una fecha con solo año se lee igual');
c.igual(X.valorDeFecha({ etiqueta: 'Mes de inicio', tipo: 'text' }, '2020'), '',
  'si la hoja de vida no dice el mes, la casilla del mes se queda vacía');

// --- 4. El valor de cada campo sale de SU entrada ---
const entrada = EXPERIENCIA[1];
c.igual(X.valorDeFila('cargo', entrada, {}), 'Gestor de Proyectos Multimedia', 'el cargo');
c.igual(X.valorDeFila('empresa', entrada, {}), 'Agencia Ejemplo Uno SAS', 'la empresa');
c.igual(X.valorDeFila('funciones', entrada, {}), 'Contenidos y SEO.', 'las funciones');
c.igual(X.valorDeFila('cargo', null, {}), '', 'sin entrada no se escribe nada');

// --- 5. La normalización de empresas es la misma en todo el proyecto ---
c.exigir(N.mismaEmpresa('Agencia Ejemplo Uno SAS', 'Agencia Ejemplo Uno S.A.S.'),
  'la misma empresa escrita de dos formas se reconoce');
c.exigir(!N.mismaEmpresa('Ejemplo Uno SAS', 'Ejemplo Dos SAS'),
  'dos empresas distintas no se confunden');

c.cerrar();
