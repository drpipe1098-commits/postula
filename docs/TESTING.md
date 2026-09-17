# Pruebas de POSTULA

## Filosofía

Las pruebas de `tests/` **no son solo pruebas unitarias: son candados sobre las decisiones de producto** de la sección 4 de `AGENTS.md`. Cuando se toma una decisión, se escribe la prueba que impide romperla.

Un candado no valida que el código funcione. Valida que el producto siga siendo el producto.

## Ejecutar

```bash
npm test
```

No necesita `npm install`. Todo corre con Node puro, sin dependencias. Cada candado se ejecuta en su propio proceso para que un fallo no tape a los demás.

Un candado suelto:

```bash
node tests/matcher-contract.mjs
```

## Los candados

| Archivo | Qué protege |
|---|---|
| `privacidad-contract.mjs` | que los datos del usuario no salgan de su computador: prohíbe `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `chrome.storage.sync`, URLs externas, permisos de host, content scripts permanentes y procesos en segundo plano |
| `envio-contract.mjs` | que POSTULA nunca envíe el formulario: prohíbe `submit()`, `click()` y eventos de envío en el código inyectado |
| `matcher-contract.mjs` | que el reconocimiento acierte, y sobre todo que **nunca** toque contraseñas, medios de pago, buscadores ni datos de terceros |
| `perfil-contract.mjs` | que el esquema del perfil sea estable y que exportar/importar sea reversible |
| `autofill-contract.mjs` | de dónde sale cada valor, los respaldos y la elección en listas desplegables |
| `navegador-contract.mjs` | el comportamiento real sobre el DOM: que el autorrelleno escriba lo correcto en formularios construidos como los de los portales colombianos, y que no toque las trampas |
| `proyecto-contract.mjs` | la estructura de `AGENTS.md` y `README.md`, que la extensión cargue sin compilar, que matcher y perfil no se desincronicen, y que **no haya datos personales reales en el repositorio** |

## Cómo se prueba código de navegador sin navegador

Los archivos de `extension/` se escriben como scripts clásicos que se cuelgan del objeto global (`globalThis.POSTULA_*`), igual que el navegador los carga uno tras otro. `tests/ayuda.mjs` los carga en un sandbox del módulo `vm` de Node, en el mismo orden.

Ventaja: se prueba exactamente el archivo que se publica, sin compilación y sin dependencias.

## Pruebas en un navegador real

Lo que depende del DOM sí se prueba, en un Chromium de verdad.

`tests/navegador/cdp.mjs` es un cliente mínimo del protocolo de Chrome construido sobre el `WebSocket` nativo de Node 22. Por eso las pruebas de navegador **tampoco necesitan dependencias**: nada de Playwright ni Puppeteer.

Los formularios de `tests/navegador/` reproducen las tres formas reales de construir un formulario de postulación:

| Archivo | Qué reproduce |
|---|---|
| `portal-clasico.html` | `<label for>` explícito, `name` en español, selects, asterisco de obligatorio |
| `portal-sin-labels.html` | el rótulo vive en un `div` hermano o solo hay `placeholder` |
| `portal-moderno.html` | `autocomplete` estándar, campos ocultos, deshabilitados y de solo lectura, e `iframe` |
| `portal-marco.html` | el contenido del `iframe` anterior |

Cada formulario incluye **trampas**: contraseña, usuario, tarjeta de crédito, CVV, buscador de vacantes, nombre de la empresa, contacto de emergencia y salario ofrecido. La prueba verifica que todas queden vacías.

```bash
node tests/navegador-contract.mjs
```

Si el equipo no tiene Chromium, la prueba se omite y no falla. En CI se exige con `POSTULA_EXIGIR_NAVEGADOR=1`, para que la compuerta nunca se salte en silencio.

Esta prueba ya demostró su valor: en su primera corrida encontró que la exclusión de la palabra «donde» —puesta para el buscador de vacantes— estaba descartando rótulos legítimos como «Ciudad donde resides».

## Lenguaje de estado

- **IMPLEMENTADO** — el código existe.
- **VALIDADO EN CÓDIGO** — el CI y las pruebas pasaron.
- **INSTALADO** — la extensión está cargada en el navegador del usuario.
- **VALIDADO EN USO REAL** — se rellenó y envió una postulación de verdad en un portal real.

**Nunca declarar validación en uso real a partir del CI.** Que los candados estén verdes no significa que Computrabajo aceptó la postulación. Esa distinción es la misma que usa BRVTAL y existe porque confundirlas hace que se declare terminado algo que nunca se probó.

## Cuando algo falla en un portal real

Ese es el insumo más valioso que tiene el proyecto:

1. Anotar el portal, el rótulo exacto del campo y qué pasó.
2. Convertirlo en un caso de `tests/matcher-contract.mjs`.
3. Corregir el patrón.
4. `npm test`.

Así cada error de la vida real se convierte en un candado permanente.
