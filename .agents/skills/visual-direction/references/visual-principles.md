# Visual principles — TRAZO

1. **La Acción Verificada es la Primitiva Central:**
   - La progresión no es `ver contenido -> checkbox -> progreso`, sino `ACCIÓN -> EVIDENCIA -> VERIFICACIÓN -> PROGRESO VÁLIDO`.
   - El mapa de progresión es el protagonista y debe reflejar la realidad del trabajo realizado.

2. **Tensión Central: Estructura x Movimiento (Precisión x Progreso):**
   - La estructura se mantiene sobria y calmada (`papel`, `tinta`, `piedra`).
   - El movimiento y el color se activan cuando algo cambia (verificación, desbloqueo, nueva ruta disponible).
   - "Estructuralmente serio pero conductualmente vivo."

3. **Jerarquía Visual y Semántica:**
   - **Display (Anton):** Carácter, títulos principales, nombres de misión clave, promesas de impacto.
   - **UI / Body (Geist Sans):** Claridad, controles, evidencia, feedback y lectura densa.
   - **Técnico (Geist Mono):** Solo para datos genuinamente técnicos o hashes; prohibido como decoración.

4. **Semántica Rigurosa de Nodos y Rutas:**
   - **Completado / Verificado:** Nodo y trazo azul continuo (`--lime` #2625B7).
   - **Activo / Siguiente:** Nodo de tinta destacado con centro azul; indica dónde actuar ahora.
   - **Disponible:** Nodo de papel con borde de tinta y trazo discontinuo; listo para iniciarse.
   - **Bloqueado:** Nodo piedra con trazo discontinuo; depende de una condición previa explícita (nunca usar solo color para indicar bloqueo).
   - **Hito:** Diamante que resume o culmina un tramo significativo.

5. **El Detalle es Contextual:**
   - Los paneles laterales y overlays de misión aparecen solo cuando el alumno los necesita y devuelven la atención al mapa.
   - Prohibido transformar la experiencia en un feed de tarjetas o un dashboard de KPIs genérico.

6. **Semántica de Materialidad y Esquinas Asimétricas:**
   - Bordes principales de 2px de tinta (`#1A2119`).
   - Radio asimétrico distintivo: `.edge` (`13px 3px 13px 3px`) y `.edge-alt` (`3px 13px 3px 13px`).
   - Trama `.paper-grid` (puntos al 6%, 22px de paso) solo en superficies cartográficas.

