# Cómo POSTULA reconoce los campos

Archivo: `extension/content/matcher.js`.

El objetivo es acertar en portales que **nunca hemos visto**. Por eso el reconocimiento es genérico y las recetas por portal quedan como refuerzo posterior, no como mecanismo principal.

## Las pistas

Para cada campo se junta todo lo que la página revela:

| Pista | Peso | Por qué |
|---|---|---|
| `etiqueta` (el `<label>` visible) | 1.00 | es lo que lee la persona |
| `aria-label` | 1.00 | pensado para ser descriptivo |
| `placeholder` | 0.90 | casi siempre correcto |
| `name` | 0.85 | lo escribió quien programó el formulario |
| `id` | 0.80 | igual, pero a veces es genérico |
| texto cercano | 0.55 | muchos portales ponen el rótulo en un div hermano |
| clases CSS | 0.35 | ruidoso, solo desempata |

Todo se normaliza antes de comparar: sin tildes, en minúsculas, sin signos. Así `Número de Documento*` y `numero_documento` son lo mismo.

## Orden de decisión

1. **Descarte duro.** Contraseñas, pagos, captcha, búsqueda, campos ocultos, deshabilitados o de solo lectura: se devuelve `null` y el campo no se toca. Esto pasa antes que cualquier otra cosa.
2. **`autocomplete` estándar.** Si el formulario declara `autocomplete="family-name"`, se usa eso. Es la pista más confiable que existe y gana sobre toda heurística.
3. **Puntaje por patrones.** Cada campo tiene `fuertes`, `debiles` y `veta`.

## Puntaje

```
puntaje = peso_de_la_frase × peso_de_la_pista  (+8 si el type= coincide)
peso_de_la_frase = (fuerte ? 26 : 10) × (1 + 0,55 × (palabras − 1))
```

Las frases largas valen más que las cortas. Por eso `ciudad de residencia` le gana a `ciudad` y `dirección de correo electrónico` se reconoce como correo, no como dirección.

Umbral: **22**. Por debajo de eso el campo se deja en paz. **Ante la duda, no se toca nada:** un campo vacío se corrige en dos segundos; un campo con el dato equivocado se va en la postulación.

## `veta`: lo que descarta un campo

Es lo que evita el error más caro: escribir los datos del usuario donde van los de otro.

- `nombres` tiene vetado `empresa`, `razón social`, `contacto de emergencia`, `institución`. Así `Nombre de la empresa` no se llena con el nombre de la persona.
- `direccion` tiene vetado `correo`, `email`, `url`.
- `pretensionSalarial` tiene vetado `actual`, `ofrecido`, `rango de la vacante`.

## Agregar o corregir un patrón

Cuando un campo falle en un portal real:

1. Mira el rótulo exacto que usa el portal.
2. Agrégalo a `fuertes` del campo correcto, o a `veta` del campo que se equivocó.
3. **Agrega el caso a `tests/matcher-contract.mjs`.** Sin esto el arreglo se pierde en el próximo cambio.
4. `npm test`.

Los casos con esperado `null` son la parte más importante de ese archivo: son los que garantizan que POSTULA jamás toque una contraseña ni un medio de pago.


---

## Campos que pertenecen a una fila de experiencia

El motor de `matcher.js` decide campo por campo y **no sabe dónde está**. Eso
alcanza para los datos que la persona tiene una sola vez, y se rompe en el
historial laboral, donde «Nombre del cargo» aparece una vez por empleo.

`extension/content/experiencia.js` resuelve esa parte y se consulta **antes**
que el matcher general:

1. reconoce los campos de fila (`cargo`, `empresa`, `desde`, `hasta`,
   `funciones`) mirando **solo las señales propias del campo**, nunca el texto
   cercano: dentro de un bloque, el texto cercano contiene los rótulos de
   todos los demás campos y cualquiera parecería cualquiera;
2. los agrupa en bloques. Un bloque es el ancestro más pequeño que contiene al
   menos dos clases distintas y **como mucho un cargo y una empresa**, porque
   un bloque es un empleo;
3. empareja cada bloque con su entrada de `experiencia[]`, primero por lo que
   el formulario ya tenga escrito (empresa, luego fechas) y después por orden.

Los campos de un bloque quedan fuera del alcance del matcher general **aunque
no se hayan podido llenar**. Esa es la garantía que impide que `Cargo actual`
—que sí es el titular profesional— se confunda con el cargo de un empleo
pasado.

Para agregar un rótulo nuevo del historial laboral se toca `CAMPOS_DE_FILA` en
`experiencia.js`, no `PATRONES` en `matcher.js`.
