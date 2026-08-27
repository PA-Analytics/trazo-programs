# UI Anti-Slop Checklist — TRAZO

Validar rigurosamente cada pantalla o componente frente a esta lista:

### 1. Paleta de Color y Proporción (Regla 60-30-10)
- **60% Dominante:** Superficie neutra/papel (`#F3EEE2` o `#111612` en dark mode).
- **30% Estructural:** Tinta (`#1A2119`), bordes de 2px, tipografía principal y paneles de tarea.
- **10% Acento:** Azul/Índigo TRAZO (`#2625B7`). **Únicamente** para rutas activas, nodos transitables, CTAs primarios y estados de progreso verificado.
- ❌ **Prohibido:** Superficies enteras de color azul sin función de estado, degradados púrpura/neón o sombras de color gratuitas.

### 2. Geometría, Bordes y Esquinas
- **Bordes:** 2px de tinta estructural. Los hero o paneles clave pueden usar 3px.
- **Esquinas:** Radios asimétricos TRAZO (`.edge` / `.edge-alt`).
- ❌ **Prohibido:** `rounded-xl` uniforme en todos lados o convertir cada elemento en una píldora (`rounded-full`).
- ❌ **Prohibido:** Bordes grises genéricos de 1px (`border-gray-200`) que convierten la UI en un template SaaS indistinguible.

### 3. Iconografía y Elementos Decorativos
- **Iconos:** Solo trazos geométricos claros en tinta o índigo que acompañan una acción o estado real.
- ❌ **Prohibido:** Emojis en botones o encabezados.
- ❌ **Prohibido:** Badges tipo "✨ AI-Powered", "Smart Assistant", estrellas brillantes, hologramas o fondos de partículas.
- ❌ **Prohibido:** Bento-boxes atiborradas de iconos ornamentales sin interacción.

### 4. Jerarquía y Tipografía
- **Display:** Anton (uppercase) para afirmaciones principales y nombres de misiones clave.
- **UI & Lectura:** Geist Sans en tamaños y pesos legibles.
- ❌ **Prohibido:** Tracking excesivo (`tracking-widest`) en microtextos grises de 10px que dificultan la lectura.

### 5. Semántica y Accesibilidad
- **Contraste APCA:** Todo texto debe superar las ratios de contraste estándar.
- **Touch Target:** Mínimo de 44x44px en todos los elementos interactivos.
- **Focus visible:** Outline índigo de 3px con offset de 3px obligatorio.
