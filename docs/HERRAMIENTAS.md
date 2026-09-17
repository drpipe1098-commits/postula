# Herramientas de terminal

Tres programas que se ejecutan con `node`, sin instalar nada. No son parte de
la extensión: preparan lo que la extensión usa, ayudan a decidir a qué vacante
vale la pena postularse, y llevan el registro de lo que ya se envió.

Ninguna de las dos entra a un portal de empleo, inicia sesión ni envía una
postulación. `tests/envio-contract.mjs` lo impide: prohíbe en `herramientas/`
las llamadas de red, los controladores de navegador, la lectura de
contraseñas y las direcciones de los portales.

---

## `hv-a-perfil.mjs` — de la hoja de vida al Perfil Único

```bash
node herramientas/hv-a-perfil.mjs mi-hoja-de-vida.pdf
```

Lee el PDF, reconoce los datos y escribe `mi-perfil-postula.json`. Ese archivo
se carga desde **POSTULA → Perfil → Importar**.

| Opción | Qué hace |
|---|---|
| `--salida <archivo>` | Dónde escribir el perfil. Por defecto `mi-perfil-postula.json`. |
| `--texto` | Muestra el texto extraído del PDF y no escribe nada. Sirve para ver qué leyó. |
| `--ayuda` | Ayuda. |

También acepta un `.txt`, para cuando el PDF no tiene capa de texto.

### Qué reconoce

Nombres y apellidos, titular profesional, correo, celular, ciudad,
departamento, modalidad, resumen profesional, años de experiencia, nivel
educativo con su título e institución, habilidades, certificaciones, la lista
completa de experiencia laboral y los idiomas.

### La regla que nunca se rompe

**Un campo que la hoja de vida no dice se queda vacío.** La cédula, la fecha
de nacimiento, el género o la aspiración salarial casi nunca están en una
hoja de vida, y adivinarlos pondría una afirmación falsa sobre la persona en
el formulario de un empleador. La herramienta los reporta como pendientes
para que se llenen una sola vez en la página de Perfil.

Los años de experiencia se **calculan** sumando los meses realmente
trabajados, sin contar dos veces los periodos que se solapan.

---

## `vacantes.mjs` — filtrar, puntuar y decidir

```bash
node herramientas/vacantes.mjs mis-vacantes.txt --perfil mi-perfil-postula.json
```

| Opción | Qué hace |
|---|---|
| `--perfil <archivo>` | Perfil contra el que se calcula la compatibilidad. |
| `--criterios <archivo>` | JSON con filtros propios; si falta, usa los de por defecto. |
| `--minimo <pesos>` | Salario mínimo aceptable. |
| `--descartadas` | Muestra también las descartadas y por qué. |
| `--reporte` | Solo imprime; no pregunta nada. |

### De dónde salen las vacantes

Las trae la persona. POSTULA no rastrea los portales (`AGENTS.md` §4.5). La
vía prevista es activar las alertas de empleo de cada portal y armar el
archivo con lo que llega al correo. `herramientas/ejemplo-vacantes.txt`
muestra el formato:

```
Cargo: Analista de Mesa de Ayuda
Empresa: Ejemplo SAS
Salario: $3.200.000
Modalidad: Remoto
Ubicación: Bogotá
Enlace: https://ejemplo.com/vacante/1
Descripción: Atención de incidentes de primer y segundo nivel...
---
```

También se acepta un `.json` con una lista de objetos.

### Filtros

Los de por defecto viven en `CRITERIOS_POR_DEFECTO`, en
`herramientas/lib/criterios.mjs`: salario desde `$2.500.000`, modalidad
remota o híbrida, presencial solo en Pereira, y descarte de las vacantes que
exigen inglés hablado B2+ o tareas operativas en terreno.

El filtro distingue el inglés que se pide para leer documentación —que no
descarta— del que se pide para hablar con clientes —que sí—. Y **ante la duda
la vacante pasa**: una que no publica salario o no declara modalidad se
muestra con una advertencia, porque esconderla sería perder una oferta buena
por una palabra que el reclutador no escribió.

### Puntaje

De 0 a 100, calculado en el equipo, sin llamar a ningún servicio: el costo de
operación del producto es cero (`AGENTS.md` §1) y el resultado tiene que ser
auditable. El reparto es cargo 35, conocimientos 40, modalidad 15, salario 10.

Cada puntaje se muestra con las palabras concretas que lo produjeron. Un
número que la persona no puede verificar no sirve para decidir a qué se
postula.

### El final del flujo

Cuando la persona marca una vacante con `s`, la herramienta **anota el
enlace**. No abre el navegador, no llena nada y no envía nada. Al terminar
entrega la lista para que la persona abra cada aviso, use el botón de POSTULA
para rellenar el formulario, revise lo que quedó escrito y envíe ella misma.

---

## `tablero.mjs` — a qué te postulaste y qué toca hoy

```bash
node herramientas/tablero.mjs                        # qué toca hoy
node herramientas/tablero.mjs listar
node herramientas/tablero.mjs estado <id> postulado
```

Buscar empleo en serio significa tener veinte procesos abiertos a la vez, cada
uno en un estado distinto. A las tres semanas nadie recuerda a cuál portal
aplicó, cuándo, ni a quién le prometió enviar algo. Eso no se arregla con
memoria.

El tablero vive en `mis-postulaciones.json`, en el equipo de la persona.
`.gitignore` y un candado lo mantienen fuera del repositorio: es de lo más
sensible que produce este proyecto.

### Cómo se llena

Solo. Cuando marcas una vacante con `s` en `vacantes.mjs`, entra al tablero
como **Por postular**. Ese es el único momento en que tienes el contexto
fresco; si hay que acordarse de anotarla después, no se anota.

También se puede a mano con `tablero.mjs agregar --titulo … --empresa …`, y
apagar el registro automático con `vacantes.mjs --sin-tablero`.

### Estados

| Estado | Seguimiento sugerido |
|---|---|
| `porPostular` | 2 días |
| `postulado` | 7 días desde el envío |
| `enProceso` | 5 días |
| `entrevista` | 3 días |
| `prueba` | 3 días |
| `oferta` | 2 días |
| `descartado` | — |
| `sinRespuesta` | — |

`sinRespuesta` no es un fracaso ni un final: es reconocer que la mayoría de las
postulaciones no reciben respuesta nunca, y que seguir esperándolas consume
atención que sirve para otra cosa. El tablero señala las que llevan más de tres
semanas enviadas y propone cerrarlas.

### Órdenes

| Orden | Qué hace |
|---|---|
| (ninguna) | Seguimientos vencidos, estancadas y conteo por estado |
| `listar` | Las abiertas; con `--todas`, también las cerradas |
| `agregar` | Registra una a mano |
| `estado <id> <estado>` | Mueve de estado; `--nota "texto"` la acompaña |
| `nota <id> "texto"` | Anota en el historial |
| `seguimiento <id> <cuando>` | `+7d`, `+2s`, `mañana`, `2026-10-01` |

### Las tres reglas

- **No se inventan fechas.** Una postulación sin fecha de envío no tiene una
  supuesta. Un registro que rellena huecos por su cuenta deja de servir para
  decidir.
- **Nada se pierde.** Cada cambio deja su línea en el historial; el estado
  actual es un resumen, no el dato.
- **La misma vacante no entra dos veces.** Las listas se solapan entre
  corridas y los portales escriben la misma empresa de cinco maneras
  —«Ejemplo SAS», «Ejemplo S.A.S», «Ejemplo S.A.S.»—, así que la forma
  jurídica no cuenta para identificarla.

---

## Cómo leen el PDF

`herramientas/lib/pdf-texto.mjs` extrae el texto sin dependencias: Node ya
trae `zlib`, que es lo único necesario para descomprimir los flujos de un PDF.

Cubre las dos formas en que los generadores reales escriben texto:

- **fuente simple de un byte** (Word, LibreOffice, imprimir desde el
  navegador), incluido el tramo WinAnsi `0x80–0x9F` donde viven las comillas
  tipográficas y la raya, que no coincide con latin1;
- **fuente compuesta subsetada con `/ToUnicode`** (WeasyPrint, Canva,
  Chrome), donde los bytes del contenido son identificadores de glifo y el
  texto solo se recupera con el mapa de la fuente.

Cuando el PDF no se puede leer —un escaneo sin capa de texto, uno cifrado, o
una fuente compuesta sin mapa— la herramienta **lo dice y se detiene**.
Devolver una cadena vacía en silencio haría que escribiera un perfil vacío
como si ese fuera el resultado correcto.

Los PDF de prueba se construyen en memoria (`tests/pdf/constructor.mjs`)
porque el repositorio no admite archivos PDF.
