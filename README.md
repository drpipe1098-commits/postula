# POSTULA — Última entrega

Este README es una **foto operativa de la entrega actual únicamente**. El contexto durable vive en `AGENTS.md` y `docs/`.

## Qué se hizo

**Entrega 5 — El historial laboral se llena por bloques.**

Primer fallo encontrado **postulándose de verdad**, en elempleo.com. En la fila de un empleo pasado, el campo «Nombre del cargo» se llenó con el titular profesional de la hoja de vida:

```
esperado:  Gestor de Proyectos Multimedia y Desarrollo Web (Prácticas)
escrito:   ANALISTA DE SOPORTE TI, AUTOMATIZACIÓN DE PROCESOS Y GESTIÓN DIGITAL
```

POSTULA afirmó ante un empleador que el cargo en esa empresa había sido otro. Un dato equivocado en un formulario de postulación no es un detalle de interfaz.

**La causa era de arquitectura.** El motor decidía campo por campo y no sabía dónde estaba. Eso basta para el correo o la cédula —que la persona tiene una sola vez— y se rompe en el historial laboral, donde el mismo rótulo aparece una vez por empleo.

- **Campos de fila.** `experiencia.js` reconoce los campos que pertenecen a *un* empleo. Son otra cosa que los del perfil aunque se llamen parecido: «Cargo al que aspiras» es de la persona, «Nombre del cargo» dentro de un empleo es de ese empleo.
- **Un bloque es UN empleo.** Así se delimita: el ancestro más pequeño con al menos dos clases distintas de campo y **como mucho un cargo y una empresa**. Las fechas sí pueden repetirse, porque los portales parten una fecha en lista de meses más casilla de año.
- **Cada bloque recibe su empleo.** Primero por lo que el formulario ya tenga escrito —cuando la persona escribió la empresa, esa es la señal más confiable sobre de qué empleo habla—, después por fechas, y al final por orden: del más reciente al más antiguo.
- **Dos pasadas.** Primero los bloques, después el resto del perfil. Los campos de un bloque quedan fuera del alcance de la segunda pasada **aunque no se hayan podido llenar**: eso es lo que impide que el titular vuelva a caer dentro de una fila.
- **`nucleoDeEmpresa` y `mismaEmpresa`** suben a `extension/lib/normalizar.js`. Son la misma regla para el tablero y para el autorrelleno; duplicarlas era dejar que se desincronizaran.

**Tres fallos más que encontró el trabajo,** dos de ellos solo visibles con DOM:

1. Un campo «Ubicación» cuyo `name` es `ubicacionEmpresa` se clasificaba como nombre de empresa: la comparación cae a subcadena y el `name` mandaba sobre el rótulo.
2. Un campo de fila suelto —«Habilidades requeridas para el cargo», que ni siquiera es del historial— subía por el DOM hasta `body`, encontraba campos de sobra y adoptaba el documento entero como su bloque.
3. La lista de archivos a inyectar está en `popup.js` y se repite en las pruebas. Al agregar `experiencia.js` se actualizó una y no la otra, y la prueba de navegador falló entera con 31 errores que no decían la causa. Quedó con candado.

## Archivos modificados en esta entrega

- `AGENTS.md` — estado de la Entrega 5, candado nuevo y mapa.
- `README.md` — esta foto de entrega.
- `docs/MATCHER.md` — cómo se reconocen y agrupan los campos de una fila de experiencia.
- `extension/content/experiencia.js` — campos de fila, bloques, emparejado y reparto de fechas.
- `extension/content/autofill.js` — dos pasadas y delimitación de bloques.
- `extension/lib/normalizar.js` — `nucleoDeEmpresa` y `mismaEmpresa`, compartidas.
- `extension/popup.js` — inyecta `content/experiencia.js`.
- `herramientas/lib/tablero.mjs` — usa la normalización compartida en vez de su copia.
- `tests/experiencia-contract.mjs` — candado de campos de fila, emparejado y fechas.
- `tests/navegador/portal-experiencia.html` — el historial laboral de elempleo, con sus trampas.
- `tests/navegador-contract.mjs` — el formulario nuevo y sus 20 comprobaciones.
- `tests/proyecto-contract.mjs` — candado nuevo: las pruebas inyectan lo mismo que la extensión.

## Validación

- **VALIDADO EN CÓDIGO** localmente: los **12 candados** pasan (`npm test`), uno de ellos nuevo.
- **En un Chromium real**, sobre un formulario que reproduce el de elempleo: el bloque que ya decía «Agencia Ejemplo Uno SAS / 2020–2021» recibió el cargo de *esa* entrada y no el titular; el bloque vacío recibió el empleo más reciente que quedaba; el mes fue a la lista de meses y el año a su casilla; y lo que la persona ya había escrito no se pisó.
- Las trampas quedaron intactas: «Cargo equivalente», «Sector de la empresa», «Ubicación» de la empresa, los requisitos de la vacante, el buscador y la contraseña.
- **El fallo original ya no se puede repetir en silencio**: hay una comprobación que exige que el cargo de una fila nunca sea igual al titular profesional.
- Pendiente de las compuertas del PR: **POSTULA CI / validate** y **README Deploy Snapshot**.
- **NO está validado en uso real.** El formulario de prueba imita a elempleo, pero no es elempleo. La próxima postulación de verdad es la prueba que falta.

## Qué sigue

1. **Volver a postularse en elempleo** y comprobar que el historial laboral queda bien. Si algún campo falla, entra como caso nuevo.
2. **Educación por bloques.** El mismo problema existe en el historial académico: «Título obtenido» se repite por cada estudio. La maquinaria ya está; falta el vocabulario.
3. **Radar de vacantes** — leer las alertas de empleo del correo para armar solo el archivo que hoy se escribe a mano.
