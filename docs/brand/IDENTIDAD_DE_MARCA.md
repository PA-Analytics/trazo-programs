# Identidad de marca — TRAZO

## 1. Esencia

**TRAZO convierte la metodología de un creador en un recorrido de implementación.**

Un curso contiene información. TRAZO convierte esa información en misiones, evidencia, feedback y desbloqueos que ayudan a una persona a hacer el trabajo real.

La marca debe sentirse:

- Clara y orientada a la acción.
- Editorial, cálida y humana.
- Seria, sin ser corporativa.
- Exploratoria, sin parecer un videojuego infantil.
- Como producto real, no como una promesa de IA.

TRAZO no es un chatbot, un LMS nuevo ni una capa de badges. Es una **capa visual de implementación** que se monta sobre el programa existente del creador.

---

## 2. Método de marca

### La idea que debe sostener cada pieza

> El contenido explica. El recorrido pide acción.

La comunicación debe mostrar el cambio antes de explicarlo:

```text
contenido → misión → evidencia → feedback → desbloqueo → siguiente paso
```

### Orden narrativo de la landing

1. **Promesa:** un programa puede convertirse en un mapa que se recorre.
2. **Problema:** ver contenido no garantiza implementar.
3. **Método:** TRAZO traduce metodología a rutas y misiones.
4. **Prueba visual:** una lección se transforma en una acción verificable.
5. **Alumno:** claridad sobre el siguiente paso y el progreso.
6. **Creador:** señales concretas sobre dónde intervenir.
7. **Categoría:** no es chat, LMS ni gamificación decorativa.
8. **Invitación:** convertir un programa real en un recorrido.

Cada sección debe introducir una idea nueva. No repetir la tesis con diferentes palabras si el elemento visual ya la demuestra.

---

## 3. Voz y copy

### Tono

- Directo, sobrio y cálido.
- Específico antes que abstracto.
- Frases cortas, con verbos de acción.
- En español natural, sin jerga EdTech ni promesas grandilocuentes.

### Palabras y construcciones recomendadas

- recorrido
- misión
- evidencia
- siguiente paso
- desbloquear
- implementar
- ver dónde intervenir
- metodología
- hacer el trabajo

### Evitar

- revolucionario, next-generation, AI-powered, potenciar
- engagement, inmersivo, gamificación como reclamo
- “todo en uno”, “sin límites”, “cientos de creadores”
- métricas, testimonios o urgencia no verificables
- lenguaje de “startup de IA” o de dashboard SaaS

### Ejemplos

| En lugar de | Preferir |
| --- | --- |
| “Mejora el engagement de tus alumnos” | “Haz visible qué misión toca ahora.” |
| “Un copiloto de IA para tu curso” | “Una capa de implementación sobre tu programa.” |
| “Gamifica tu experiencia educativa” | “Pide evidencia y desbloquea el siguiente paso.” |

---

## 4. Paleta

La paleta está definida en `app/globals.css`. El token histórico `--lime` representa el **índigo TRAZO**, no un verde lima.

| Rol | Token | Valor | Uso |
| --- | --- | --- | --- |
| Papel | `--paper` | `#F3EEE2` | Fondo principal cálido. |
| Tinta | `--ink` | `#1A2119` | Tipografía, bordes, paneles oscuros. |
| Superficie | `--surface` | `#EBE5D6` | Paneles secundarios y contraste suave. |
| Superficie profunda | `--surface-2` | `#E0D9C7` | Separaciones y zonas auxiliares. |
| Azul TRAZO | `--lime` | `#2625B7` | Único acento saturado: ruta activa, CTA, progreso y desbloqueos. |
| Azul suave | `--lime-soft` | `#4646D7` | Variantes de énfasis cuando el azul principal no sea legible. |
| Piedra | `--stone` | `#969181` | Estado bloqueado, contenido secundario y contraste de baja prioridad. |
| Línea | `--line` | `#D0C8B6` | Divisores y estructura secundaria. |

### Reglas de color

- El azul es el único acento saturado dominante.
- La tinta es estructural: bordes, rutas presentes y texto principal.
- Piedra comunica futuro, bloqueo o información menos prioritaria; nunca debe ser el único indicador de estado.
- No usar degradados de marca, púrpuras, glows gratuitos ni color por decoración.
- Un panel oscuro debe tener una función: misión actual, afirmación central o zona de decisión.

---

## 5. Tipografía y jerarquía

### Familias

| Rol | Familia | Uso |
| --- | --- | --- |
| Display | Anton | Ideas principales, títulos y nombres de misión importantes. Siempre en mayúsculas por la regla global. |
| Texto e interfaz | Geist | Párrafos, navegación, botones, listas y estados legibles. |
| Técnico (excepcional) | Geist Mono | Datos verdaderamente técnicos o referencias internas; no usar como recurso decorativo. |

### Escala de jerarquía

| Nivel | Uso | Tamaño de referencia |
| --- | --- | --- |
| H1 | Promesa del hero | `3.4rem` móvil → `4.8rem` desktop; `leading: 0.9` |
| H2 | Idea de sección | `2.25rem` móvil → `3.55rem` desktop; `leading: 0.92` |
| H3 display | Subidea o misión | `1.875rem` → `3rem`; `leading: 0.94–0.96` |
| Body principal | Explicación | `1rem` → `1.125rem`; `leading-relaxed` |
| Body interfaz | Listas, evidencia y controles | `0.875rem–1rem` |
| Auxiliar | Detalles necesarios | `0.75rem`; Geist Sans, peso medio; sin mayúsculas espaciadas |

### Regla importante sobre labels

No usar rótulos micro en mono, numeraciones del tipo `02 — EL PROBLEMA`, ni texto en mayúsculas con tracking amplio como decoración. Hace que la marca parezca una interfaz de IA genérica.

Si una etiqueta es necesaria, debe:

- ser Geist Sans;
- tener tamaño legible (`text-xs` o mayor);
- explicar un estado real del producto;
- desaparecer si el componente ya se entiende sin ella.

---

## 6. Sistema espacial y estructura

### Contenedor y ritmo

- Contenedor principal: `max-w-6xl`.
- Padding lateral: `px-6`.
- Secciones: `py-20` móvil y `md:py-28` desktop.
- Separación interior habitual: `mt-6`, `mt-8` o `mt-10`; no crear huecos decorativos que no sostengan una relación entre elementos.
- Una sección debe tener un punto de atención dominante y aire suficiente alrededor.

### Bordes y esquinas

- Bordes principales: `2px` de tinta.
- Hero y piezas protagonistas pueden usar `3px`.
- Divisores internos: `1px`, tinta al 20–25% o token de línea.
- Esquinas asimétricas de TRAZO:
  - `.edge`: `13px 3px 13px 3px`
  - `.edge-alt`: `3px 13px 3px 13px`
- No usar `rounded-xl` ni esquinas uniformes por defecto.

### Texturas

`.paper-grid` es la trama de papel cartográfico: puntos de tinta al 6%, separados por 22 px. Úsala en mapas y superficies que necesiten comunicar exploración, no en cada bloque.

---

## 7. Gramática visual: el mapa

El mapa de quest es la metáfora estructural de TRAZO. Debe evolucionar a lo largo de la experiencia, no repetirse como un adorno.

### Estados

| Estado | Forma y tratamiento | Significado |
| --- | --- | --- |
| Completado | Nodo azul con check | La evidencia ya satisfizo la condición. |
| Activo | Nodo de tinta, centro azul y tamaño mayor | Es el siguiente trabajo relevante. |
| Disponible | Nodo de papel con borde de tinta | Puede iniciarse. |
| Bloqueado | Nodo piedra, borde discontinuo | Depende de una condición anterior. |
| Hito | Diamante | Resume o culmina un tramo. |

### Rutas

- Ruta completada: azul, continua.
- Ruta disponible: tinta, discontinua.
- Ruta futura/bloqueada: piedra, discontinua.
- El nodo activo debe ser visiblemente mayor que el resto.
- Las líneas deben unir información o estados; nunca cruzar copy de manera decorativa.

### Cómo usar el mapa fuera del hero

- **Problema:** diferencia entre una lista que termina y una ruta que continúa.
- **Demo:** muestra una conversión real de módulo a misión.
- **Alumno:** representa progreso, dependencias y evidencia.
- **Creador:** traduce movimiento a una lista de intervención.
- **CTA:** cierra la historia con un hito o ruta final, sin reproducir el mapa completo.

---

## 8. Componentes y patrones

### Botones

- CTA principal: azul TRAZO sobre papel, texto Geist medio, borde asimétrico.
- Hover: tinta. No añadir glow.
- CTA de conversación: “Quiero ver mi curso en TRAZO” o equivalente específico.
- Evitar: “Start free”, “Comprar ahora”, “Get started”.

### Paneles funcionales

Un panel debe organizar una tarea, no llenar espacio.

- Misión: título, acción concreta, evidencia y desbloqueo.
- Alumno: capítulo, misión actual, prueba y feedback.
- Creador: persona, punto de bloqueo/avance y contexto para actuar.
- No construir filas de tarjetas equivalentes para explicar una idea sencilla.

### Formularios

- Fondo de superficie, borde de tinta de 2 px y `edge-alt`.
- Labels legibles en Geist Sans.
- Conectar el envío a un canal real antes de producción; no prometer seguimiento si no existe.

---

## 9. Movimiento y accesibilidad

### Movimiento permitido

- El trazo de una ruta completándose.
- Un nodo que se activa o desbloquea.
- Reveals suaves al entrar en viewport.
- Apertura de un detalle de misión.

### Movimiento prohibido

- Flotación continua.
- Parallax decorativo.
- Gradientes animados.
- Pulsos o glows sin relación con un cambio de estado.

La aplicación debe respetar `prefers-reduced-motion`; esta regla ya está definida en `app/globals.css`.

### Responsive

- Mobile no es una versión recortada: conserva jerarquía, rutas y acciones claras.
- Las composiciones complejas deben apilarse según su secuencia lógica.
- Evitar SVGs o rutas que atraviesen texto al colapsar.
- Mantener controles táctiles cómodos y evitar overflow horizontal.

---

## 10. Lista de control antes de añadir una sección

- ¿Introduce una idea que no se haya explicado visualmente ya?
- ¿Se entiende qué se debe mirar primero?
- ¿El azul comunica un estado o una acción importante?
- ¿Se puede quitar un label o una tarjeta sin perder significado?
- ¿La composición conserva aire y no deja huecos sin función?
- ¿Se parece a una editorial de producto y no a una landing SaaS genérica?
- ¿Funciona en móvil sin líneas atravesando el contenido?
- ¿El copy muestra una acción concreta en lugar de hablar de “IA” o “engagement”?

Si la respuesta a cualquiera de estas preguntas es no, ajustar antes de implementar.
