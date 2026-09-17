# POSTULA — Contexto operativo único (IA / trabajo)

> **ESTE ARCHIVO ES EL ARRANQUE CANÓNICO PARA CUALQUIER AGENTE DE CÓDIGO O PERSONA NUEVA.**
>
> Léelo completo **primero**. No se necesita ninguna conversación previa, memoria guardada ni resumen humano para continuar el proyecto. Después de leerlo, inspecciona el estado del repositorio (`main`, PRs abiertos, CI) y continúa desde el código actual.

## 0. Protocolo de arranque

Para cada sesión nueva:

1. Leer `AGENTS.md` completo.
2. Inspeccionar `main` actual, PRs abiertos y las últimas corridas de **POSTULA CI**.
3. Si un PR abierto ya cubre la siguiente tarea, continuarlo o arreglarlo en vez de duplicar trabajo.
4. Si el CI de `main` exacto no está verde, cerrar ese pendiente antes de abrir una rama nueva.
5. Si no hay PR activo, seguir **Prioridades actuales** (sección 9) salvo que el usuario repriorice.
6. Inspeccionar los archivos de implementación y solo los documentos de `docs/` que la tarea necesite.
7. Seguir rama → implementación → pruebas → PR → CI → correcciones → squash merge → CI sobre `main` exacto, sin preguntar lo rutinario.
8. **Todo PR destinado a entrega debe reemplazar `README.md`** con la foto de esa entrega: archivos modificados, resumen de lo que cambió, estado de validación y qué sigue. No acumular historial. Si el alcance del PR cambia antes del merge, refrescar el README otra vez.
9. Si un PR cambia estado durable de producto o arquitectura, actualizar también las secciones de este archivo.

### Precedencia de la verdad

1. código ya unido en `main`;
2. decisiones y pruebas de PRs unidos más recientes;
3. este `AGENTS.md`;
4. documentos de `docs/`;
5. `README.md` solo para la entrega más reciente;
6. historial de chat o memoria externa.

Si el código demuestra que este archivo quedó viejo, corregirlo en el mismo PR.

---

## 1. Identidad del producto

POSTULA elimina el trabajo repetitivo de postularse a empleos: rellenar los mismos datos personales en el formulario de cada portal, una y otra vez.

| Ítem | Valor canónico |
|---|---|
| Producto | **POSTULA** |
| Forma | Extensión de navegador (Chrome Manifest V3) |
| Navegadores | Chrome, Edge, Brave, Opera (mismo paquete) |
| Repositorio | `drpipe1098-commits/Dr-Pipe-Grind` |
| Rama canónica | `main` |
| Lenguaje del código | JavaScript sin dependencias, sin paso de compilación |
| Idioma del producto | Español (Colombia) |
| Idioma del código y docs | Español |
| Almacenamiento | `chrome.storage.local` — solo en el equipo del usuario |
| Servidores | **Ninguno.** El producto no tiene backend y no debe adquirir uno. |
| Costo de operación | **$0** |
| Mercado inicial | Colombia (Computrabajo, elempleo, Magneto365, LinkedIn, portales propios de empresas) |

**Regla de costo:** cualquier propuesta que exija hosting, dominio, base de datos administrada o servicio pago se rechaza salvo que el usuario lo autorice explícitamente. El presupuesto declarado es cero.

---

## 2. Arquitectura no negociable

**UN PERFIL / UN CLIC / EL USUARIO ENVÍA**

- El usuario llena sus datos **una sola vez** en la página de Perfil.
- En cualquier portal de empleo, un clic rellena el formulario.
- **POSTULA nunca envía el formulario.** No hace clic en «Enviar», «Postular», «Aplicar» ni ningún botón de envío. El usuario revisa y envía.

Reglas:

- la extensión actúa **solo** cuando el usuario hace clic en el botón de POSTULA;
- no hay `content_scripts` permanentes ni ejecución en segundo plano sobre las páginas;
- la inyección ocurre bajo `activeTab` + `scripting`, en la pestaña activa, en ese momento;
- no se piden permisos de host amplios (`<all_urls>`) para inyección automática;
- el motor de reconocimiento debe funcionar en portales desconocidos, no solo en los que tengamos configurados.

### Por qué no es un bot

Un robot que envía postulaciones masivas sin supervisión: (a) viola los términos de LinkedIn, Computrabajo, elempleo y Magneto365; (b) hace que bloqueen la cuenta del usuario; (c) produce postulaciones genéricas que los reclutadores descartan. POSTULA acelera el trabajo del usuario; no lo suplanta. **Esta decisión no se revisa.**

---

## 3. Estado implementado

Tratar esto como base ya construida salvo que el código o las pruebas demuestren lo contrario.

### Entrega 1 — Perfil Único y Autorrelleno Universal

- esquema de perfil con 8 grupos de datos y lista de experiencia laboral (`extension/lib/perfil.js`);
- normalización de texto sin tildes para comparación (`extension/lib/normalizar.js`);
- motor de reconocimiento de campos por puntaje sobre `name`, `id`, `placeholder`, `aria-label`, `autocomplete`, `type` y la etiqueta visible asociada (`extension/content/matcher.js`);
- exclusiones duras: contraseñas, pagos, captcha, búsqueda, cupones y campos ocultos o deshabilitados nunca se rellenan;
- rellenado de `input`, `textarea` y `select` con disparo de eventos `input` y `change` para que React/Angular/Vue registren el valor;
- página de Perfil con guardado local, exportación e importación en JSON;
- popup con botón único, informe de campos llenados y omitidos;
- pruebas de contrato en Node sin dependencias.

### Entrega 2 — Validación en navegador real

- cliente mínimo del protocolo de Chrome (CDP) sobre el `WebSocket` nativo de Node, sin dependencias (`tests/navegador/cdp.mjs`);
- cuatro formularios que reproducen cómo están construidos los portales colombianos: con `<label for>`, con el rótulo en un `div` hermano, con `autocomplete` estándar, y uno embebido en `iframe`;
- el autorrelleno se ejecuta en un Chromium real y se verifica qué quedó escrito en cada campo, incluidas las trampas que nunca debe tocar;
- compuerta `navegador` en POSTULA CI; con `POSTULA_EXIGIR_NAVEGADOR=1` la ausencia de navegador es falla, no omisión.

Primer fallo real que encontró esta entrega: la exclusión amplia de la palabra «donde» descartaba rótulos legítimos como «Ciudad donde resides». Corregido y blindado con casos nuevos en `tests/matcher-contract.mjs`.

### Entrega 3 — De la hoja de vida al perfil, y de la vacante al puntaje

Dos herramientas de terminal (`herramientas/`), ejecutables con `node`, sin
dependencias. No son parte de la extensión y no entran a ningún portal.

- extractor de texto de PDF sin dependencias (`herramientas/lib/pdf-texto.mjs`):
  entiende fuentes simples de un byte —incluido el tramo WinAnsi `0x80–0x9F`,
  donde están las comillas tipográficas y la raya— y fuentes compuestas
  subsetadas con `/ToUnicode`, que es lo que producen WeasyPrint, Canva y
  Chrome; cuando el PDF no tiene capa de texto lo reporta en vez de devolver
  vacío;
- reconocimiento de hoja de vida (`herramientas/lib/hoja-de-vida.mjs`): parte
  el texto en secciones, reconoce identidad, contacto, ubicación, experiencia
  laboral completa, educación, idiomas, habilidades y certificaciones, y
  **calcula** los años de experiencia sin contar dos veces los periodos
  solapados;
- `herramientas/hv-a-perfil.mjs`: escribe el perfil en JSON listo para
  importar, e informa qué campos quedaron vacíos y por qué;
- filtros y puntaje de vacantes (`herramientas/lib/criterios.mjs`,
  `puntaje.mjs`): descarte por salario, modalidad, inglés hablado y trabajo en
  terreno, más un puntaje de compatibilidad de 0 a 100 calculado en el equipo,
  sin red, con las palabras concretas que lo justifican;
- `herramientas/vacantes.mjs`: revisión interactiva en la terminal que ordena
  las vacantes por compatibilidad y, cuando la persona dice que sí, **le
  entrega el enlace**. No abre el navegador, no rellena y no envía;
- dos campos nuevos en el perfil, `habilidades` y `certificaciones`, con sus
  patrones en el matcher: las secciones de la hoja de vida que antes no tenían
  dónde caer.

Fallos reales que encontró esta entrega: el tramo WinAnsi alto se leía como
latin1 y convertía las rayas y comillas de cualquier hoja de vida en
caracteres de control; las funciones de un cargo arrastraban la cabecera del
cargo siguiente; un título «en curso» le ganaba al título terminado; y el
reconocimiento de nivel educativo solo entendía la forma masculina, así que
«Tecnóloga» o «Ingeniera» se quedaban sin título. Los cuatro quedaron
blindados en `tests/hoja-de-vida-contract.mjs` y `tests/pdf-contract.mjs`.

### Entrega 4 — Tablero de postulaciones

Tercera herramienta de terminal (`herramientas/tablero.mjs`), con su lógica en
`herramientas/lib/tablero.mjs`. Un archivo JSON en el equipo de la persona,
sin servidor y sin red.

- ocho estados con seguimiento sugerido propio, de «por postular» a «sin
  respuesta»; el historial guarda cada cambio con su fecha y el estado actual
  es solo un resumen;
- la pregunta que responde es «qué toca hoy»: seguimientos vencidos primero
  los más atrasados, y las postuladas hace más de tres semanas señaladas como
  candidatas a cerrar;
- identidad por empresa y cargo con la forma jurídica descartada, porque los
  portales escriben la misma empresa como «Ejemplo SAS», «Ejemplo S.A.S» o
  «Ejemplo S.A.S.» y sin eso el tablero se llena de duplicados;
- fechas relativas escritas como las escribe una persona (`+7d`, `+2s`,
  `mañana`); lo que no se entiende se rechaza en vez de adivinarse;
- `vacantes.mjs` registra en el tablero lo que la persona marca con «s», que
  es el único momento en que tiene el contexto fresco;
- `mis-postulaciones.json` queda fuera del repositorio por `.gitignore` y por
  un candado que lo verifica.

También se corrigió un defecto del matcher encontrado al verificar la Entrega
3: rótulos como «Habilidades requeridas para el cargo» o «Años de experiencia
requeridos» describen la vacante, no a la persona, y caían en campos del
perfil. POSTULA habría escrito los datos del usuario dentro de la descripción
del puesto. Ahora hay una lista de exclusión comparada solo contra las señales
propias del campo.

### Entrega 5 — El historial laboral se llena por bloques

Primer fallo encontrado **postulándose de verdad**, en elempleo.com: el campo
«Nombre del cargo» de la fila de un empleo pasado se llenó con el titular
profesional de la hoja de vida. POSTULA afirmó ante un empleador que el cargo
en esa empresa había sido otro.

La causa era de arquitectura, no un patrón mal escrito: el motor decidía campo
por campo y no sabía dónde estaba. Eso basta para el correo o la cédula, que la
persona tiene una sola vez, y se rompe en el historial laboral, donde el mismo
rótulo aparece una vez por empleo.

- `extension/content/experiencia.js`: reconoce los campos que pertenecen a una
  fila de experiencia —que son otra cosa que los campos del perfil aunque se
  llamen parecido—, empareja cada bloque con su entrada de `experiencia[]` y
  reparte las fechas entre las casillas del portal;
- el autorrelleno pasa a dos pasadas: primero los bloques, después el resto.
  Los campos de un bloque quedan **fuera del alcance de la segunda pasada
  aunque no se hayan podido llenar**, que es lo que impide que el titular
  vuelva a caer dentro de una fila;
- un bloque se delimita por una regla de producto, no de DOM: **un bloque es
  UN empleo**, así que no puede contener dos cargos ni dos empresas. Las
  fechas sí pueden repetirse, porque los portales parten una fecha en lista de
  meses más casilla de año;
- el emparejado usa lo que el formulario ya tiene escrito: cuando la persona
  escribió la empresa, esa es la señal más confiable sobre de qué empleo
  habla. Sin señales, se asigna por orden, del más reciente al más antiguo;
- `nucleoDeEmpresa` y `mismaEmpresa` suben a `extension/lib/normalizar.js`:
  son la misma regla para el tablero y para el autorrelleno, y duplicarlas era
  dejar que se desincronizaran.

La prueba de navegador encontró dos fallos más, que solo aparecen con DOM: un
campo «Ubicación» cuyo `name` es `ubicacionEmpresa` se clasificaba como nombre
de empresa, y un campo de fila suelto subía por el DOM hasta `body` y adoptaba
el documento entero como bloque.

### Pendiente (ver sección 9)

Lectura automática de las alertas de empleo del correo, Recetas por portal y Redactor.

---

## 4. Decisiones que no se pueden perder

1. **POSTULA no envía formularios.** Ni con confirmación, ni con temporizador, ni «solo en portales seguros».
2. **Los datos del usuario no salen del equipo.** No hay telemetría, analítica, reporte de errores remoto ni sincronización.
3. **Ningún dato personal real entra al repositorio.** Ni hojas de vida, ni correos, ni cédulas, ni teléfonos, ni perfiles exportados. Los ejemplos usan datos ficticios.
4. **Sin dependencias ni paso de compilación.** El usuario debe poder cargar `extension/` directamente en el navegador. `npm install` no puede ser requisito para usar el producto.
5. **Sin scraping de portales.** No se automatiza navegación, login ni extracción masiva en LinkedIn ni en ningún portal.
6. **El reconocimiento de campos es genérico primero.** Las recetas por portal son un refuerzo para casos difíciles, nunca el mecanismo principal.
7. **El producto es multiusuario por distribución, no por servidor.** Cada persona instala la extensión y sus datos viven en su equipo.
8. **El español es el idioma del producto.** El reconocimiento de campos soporta español e inglés porque los portales mezclan, pero la interfaz es en español.
9. **`README.md` es solo la foto de la última entrega.** No acumula arquitectura, historial ni listas de tareas viejas.
10. **El repositorio contiene suficiente contexto durable para que una IA nueva continúe sin memoria previa.**

---

## 5. Reglas de datos y privacidad

- El perfil vive en `chrome.storage.local`. Nunca en `sync`, nunca en un servidor.
- La exportación de perfil es un archivo JSON que el usuario guarda donde quiera; es su copia de seguridad y su forma de pasarlo a otro equipo.
- La extensión no declara permisos de red y no debe hacer `fetch`, `XMLHttpRequest`, `WebSocket` ni `sendBeacon` hacia ningún host.
- No se recogen estadísticas de uso de ninguna clase.
- Como no hay tratamiento de datos personales por parte de un tercero, POSTULA no queda sujeto a las obligaciones de responsable de tratamiento de la Ley 1581 de 2012. **Esa propiedad se pierde en el momento en que aparezca un servidor.** No introducir uno sin decisión explícita del usuario y sin política de datos.

---

## 6. Contrato de pruebas, CI y entrega

Flujo principal: `.github/workflows/ci.yml` — nombre visible **POSTULA CI**.
Verificador de entrega: `.github/workflows/readme-deploy-snapshot.yml` — nombre visible **README Deploy Snapshot**.

### Pruebas de contrato

Las pruebas de `tests/` no son solo pruebas unitarias: **son candados sobre las decisiones de la sección 4**. Cuando se toma una decisión de producto, se escribe la prueba que impide romperla.

Candados vigentes:

- `tests/privacidad-contract.mjs` — la extensión no contiene llamadas de red ni permisos de red; no usa `chrome.storage.sync`.
- `tests/envio-contract.mjs` — el código no hace clic en botones de envío ni llama `form.submit()`; y las herramientas de `herramientas/` no pueden hacer red, arrancar un navegador, leer contraseñas ni navegar a un portal.
- `tests/perfil-contract.mjs` — el esquema de perfil es estable, validable y su exportación es reversible.
- `tests/matcher-contract.mjs` — el reconocimiento acierta en los campos típicos de portales colombianos y **nunca** reconoce contraseñas, pagos ni búsqueda.
- `tests/navegador-contract.mjs` — el autorrelleno se comporta bien en un Chromium real sobre formularios construidos como los de los portales colombianos.
- `tests/pdf-contract.mjs` — el texto se extrae de las cuatro formas reales de escribir un PDF, los acentos sobreviven, y lo ilegible se reporta en vez de devolverse vacío.
- `tests/hoja-de-vida-contract.mjs` — la hoja de vida se convierte en perfil **sin inventar**: lo que el documento no dice queda vacío y se reporta como pendiente.
- `tests/vacantes-contract.mjs` — los filtros descartan lo que deben, ante la duda la vacante pasa con advertencia, y el puntaje es auditable.
- `tests/tablero-contract.mjs` — el tablero no inventa fechas, no pierde historial, no duplica la misma vacante y acierta en «qué toca hoy».
- `tests/experiencia-contract.mjs` — un campo de fila no es un campo del perfil, cada bloque recibe su empleo y las fechas se reparten entre las casillas.
- `tests/proyecto-contract.mjs` — `AGENTS.md`, `README.md` y el manifiesto conservan su estructura obligatoria; ningún archivo del repositorio contiene datos personales reales; ningún archivo de código queda tapado por `.gitignore` y ningún archivo de datos personales queda sin tapar; los workflows se pueden parsear.

### Compuertas de POSTULA CI

- `contratos` — sintaxis de todos los archivos, manifiesto válido, los candados de Node y la ausencia de dependencias;
- `navegador` — el autorrelleno sobre formularios reales en un Chromium del runner;
- `validate` — agregado de las dos anteriores; es la compuerta obligatoria.

Ejecutar todo:

```bash
npm test
```

No requiere `npm install`: las pruebas corren con Node puro. La prueba de navegador se omite sola si el equipo no tiene Chromium, para no bloquear a nadie; en CI se exige.

### Contrato de README por entrega

Para cada PR destinado a entrega:

- reemplazar `README.md` completo; no anexar historial;
- listar **solo los archivos modificados en esa entrega** con una explicación corta de cada uno;
- incluir un resumen **Qué se hizo**;
- incluir el estado de validación real, sin declarar validación en uso real a partir del CI;
- incluir **Qué sigue** con el próximo trabajo accionable;
- mantener la arquitectura durable en `AGENTS.md` o en `docs/`;
- mantener el README por debajo de 8 KB.

### Bucle de entrega obligatorio

1. Rama enfocada desde `main` verde.
2. Implementar el cambio lógico más sus pruebas.
3. Refrescar `README.md` con la foto exacta de la entrega.
4. Abrir PR hacia `main`.
5. Esperar **POSTULA CI** y **README Deploy Snapshot**.
6. Corregir fallas en la misma rama; refrescar el README si cambió el alcance.
7. Con todo verde, squash merge.
8. Verificar el CI completo sobre el SHA exacto de `main`.
9. Solo entonces empezar la rama siguiente.

### Lenguaje de estado

- **IMPLEMENTADO** — el código existe.
- **VALIDADO EN CÓDIGO** — el CI y las pruebas pasaron.
- **INSTALADO** — la extensión está cargada en el navegador del usuario.
- **VALIDADO EN USO REAL** — se rellenó y envió una postulación de verdad en un portal real.

Nunca declarar validación en uso real a partir del CI. Una prueba verde no significa que Computrabajo aceptó la postulación.

---

## 7. Fronteras protegidas

Requieren confirmación explícita del usuario antes de hacerse:

- cualquier forma de envío automático de formularios;
- cualquier llamada de red desde la extensión;
- introducir un backend, base de datos o servicio pago;
- publicar la extensión en una tienda pública;
- pedir permisos de host amplios;
- automatizar navegación o login en un portal;
- cualquier cosa que implique cobrar dinero a usuarios.

Nunca commitear credenciales, tokens, contraseñas, hojas de vida reales ni datos personales de nadie.

---

## 8. Deliberadamente aplazado — no implementar por iniciativa propia

Salvo que el usuario repriorice explícitamente:

- envío automático o «un clic y se manda solo»;
- inicio de sesión automático en portales;
- scraping de resultados de búsqueda de LinkedIn o de cualquier portal;
- cuentas de usuario, sincronización en la nube o panel web;
- aplicación de escritorio o móvil;
- generación de hojas de vida en PDF con plantillas gráficas;
- traducción automática de la hoja de vida al inglés;
- cobros, suscripciones o planes;
- soporte para Firefox o Safari (exige empaquetado aparte);
- métricas de uso, aunque sean anónimas.

---

## 9. Prioridades actuales

Cuando no haya PR abierto ni pedido explícito del usuario, continuar en este orden después de verificar que el código no lo haya hecho ya:

1. **Endurecer el reconocimiento de campos** con casos reales encontrados al postularse. Cada campo que falle en un portal real se convierte en un caso de `tests/matcher-contract.mjs` y, si depende del DOM, en un formulario nuevo bajo `tests/navegador/`. Ya dio su primer resultado: el historial laboral por bloques de la Entrega 5 salió de una postulación real en elempleo.com. Lo siguiente que falte en un portal se trata igual.
2. **Endurecer el tablero con uso real.** Existe (`herramientas/tablero.mjs`) pero nadie lo ha usado durante una búsqueda de verdad. Los estados, los plazos de seguimiento y el umbral de tres semanas son supuestos, no observaciones.
3. **Radar de vacantes** — la mitad del filtrado ya existe en `herramientas/vacantes.mjs`, pero la lista se arma a mano. Falta leer las alertas de empleo que los portales envían al correo del usuario para armarla sola. Sin scraping: el usuario activa las alertas y POSTULA solo lee su propio buzón, con su autorización.
4. **Recetas por portal** — ajustes específicos para formularios difíciles, cuando el motor genérico no alcance.
5. **Redactor** — texto de presentación adaptado a cada vacante, y respuestas preparadas a preguntas frecuentes del reclutador.

Un pedido explícito del usuario siempre manda sobre este orden.

---

## 10. Entrega a una persona y referencias opcionales

`README.md` es **solo la entrega más reciente**. No es un manual, ni la arquitectura, ni una lista de funciones, ni un plan. **Una sesión de IA no debería necesitar leer el README para empezar.**

Referencias opcionales, leer solo cuando la tarea lo pida:

- `docs/INSTALACION.md` — cómo instala y usa la extensión una persona sin conocimientos técnicos;
- `docs/PERFIL.md` — esquema de datos del perfil y reglas de validación;
- `docs/MATCHER.md` — cómo funciona el reconocimiento de campos y cómo agregar patrones;
- `docs/TESTING.md` — comandos de prueba y modelo de evidencia;
- `docs/HERRAMIENTAS.md` — las dos herramientas de terminal, sus opciones y sus límites.

---

## 11. Mapa del repositorio

```text
.github/            GitHub Actions / CI
docs/               referencias técnicas y de producto durables
extension/          la extensión completa, cargable tal cual en el navegador
  lib/              lógica compartida (perfil, normalización)
  content/          código que se inyecta en la página del portal
                    (matcher, experiencia y autorrelleno, en ese orden)
  iconos/           iconos de la extensión
herramientas/       programas de terminal (node, sin dependencias)
  lib/              lectura de PDF, hoja de vida, criterios, puntaje y tablero
tests/              pruebas de contrato en Node, sin dependencias
  navegador/        cliente CDP y formularios que imitan portales reales
  pdf/              constructor de PDF de prueba, en memoria
AGENTS.md           este archivo
README.md           foto de la última entrega únicamente
```

---

## 12. Contrato de mantenimiento de estado

La meta es que una sesión de IA completamente nueva pueda continuar **solo con el repositorio**.

En cada PR destinado a entrega:

- reescribir `README.md` como la foto de esa entrega, nunca como historial acumulado;
- hacer que su lista de archivos coincida con el alcance real del PR;
- resumir qué cambió y qué sigue;
- actualizar aquí el estado, las decisiones, las prioridades o lo aplazado **solo cuando el estado del producto cambie de verdad**;
- no escribir aquí SHAs ni números de corrida como estado permanente;
- registrar las decisiones de arquitectura aquí, no solo en el chat;
- mantener este archivo suficiente para el mensaje **«Lee AGENTS.md y continúa el proyecto de forma autónoma»**.
