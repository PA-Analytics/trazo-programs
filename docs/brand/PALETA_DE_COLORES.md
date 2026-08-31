# 🎨 TRAZO — Paleta de Colores Oficial (La Tríada de Acentos)

Este documento define la paleta cromática canónica de **TRAZO**, basada en la **Regla 60-30-10** sobre el lienzo *Dark Mineral* y la tríada de acentos de alta energía.

---

## 🏛️ 1. Lienzo Base y Estructura (Regla 60-30)

| Nombre | Token CSS | Valor HEX | Rol en UI (60% / 30%) |
|---|---|---|---|
| **Mineral Ink** | --trazo-ink | #141A16 | **60% Dominante:** Fondo general de la aplicación, tarjetas oscuras, contraste de profundidad. |
| **Papel Mineral** | --trazo-paper | #F1F1EC | **30% Neutro:** Tipografía principal (Anton & Geist), bordes de contención de 2-3px, botones invertidos. |
| **Piedra Mineral** | --trazo-stone | #7D8A82 | **Neutro Secundario:** Subtítulos, divisores secundarios, estados deshabilitados y metadatos. |

---

## ⚡ 2. La Tríada de Acentos Icónicos (10% Alta Energía)

### 🔵 1. El Azul Rico (Cobalto / Índigo Eléctrico)
*El color del progreso, la precisión y el avance verificable.*

* **Token Principal:** --trazo-indigo: #3657FF (gb(54, 87, 255))
* **Token Suave:** --trazo-indigo-soft: #5E77FF
* **Token Sombra:** --trazo-indigo-dark: #2625B7
* **Uso Canónico:**
  * Veredicto **PASS** (misión aprobada con rigor).
  * Sombras sólidas offset 3D en tarjetas principales (ox-shadow: 14px 14px 0 #3657FF).
  * Botones de acción primaria (setup-primary), CTAs y waypoints activos.
  * Título monumental acentuado (span.coach-step-hero__title-accent / EN PIEDRA).

`css
/* Ejemplo de uso Azul Rico */
.trazo-card-primary {
  background: var(--trazo-ink);
  border: 3px solid var(--trazo-paper);
  box-shadow: 14px 14px 0 var(--trazo-indigo); /* #3657FF */
}
`

---

### 🟡 2. El Amarillo Sex (Ámbar Mineral / Oro Calibración)
*El color del rigor pedagógico, la advertencia constructiva y el pulido.*

* **Token Principal:** --trazo-rework: #D97706 / --trazo-amber-vibrant: #F5A623
* **Token Keycap Bg:** --trazo-rework-bg: #FEF3C7 (Papel ámbar cálido)
* **Token Borde:** --trazo-rework-border: #F59E0B
* **Token Texto:** --trazo-rework-text: #92400E (Óxido mineral legible)
* **Token Sombra 3D:** --trazo-rework-shadow: #D97706 (ox-shadow: 4px 4px 0 #D97706)
* **Uso Canónico:**
  * Veredicto **REWORK** (evidencia que requiere ajuste sin AI-slop).
  * Rondas de calibración activas y modo de edición de rúbricas.
  * Insignias de advertencia pedagógica de Trazz y estados en iteración.

`css
/* Ejemplo de uso Amarillo Sex */
.trazo-card-rework {
  background: #FEF3C7;
  color: #92400E;
  border: 2px solid #F59E0B;
  box-shadow: 4px 4px 0 #D97706;
}
`

---

### 🔴 3. El Rojo God (Carmesí Mineral / Destructivo & Alerta Crítica)
*El color de la gravedad, las acciones irreversibles y el bloqueo de estado.*

* **Token Principal:** --trazo-crimson: #E53935 (gb(229, 57, 53))
* **Token Neón/Acento:** --trazo-crimson-bright: #FF453A / #FF6B6B
* **Token Fondo Alerta:** --trazo-crimson-bg: color-mix(in srgb, #E53935 8%, var(--trazo-ink))
* **Token Sombra Táctica:** --trazo-crimson-shadow: #8B0000 (ox-shadow: 4px 4px 0 #8B0000 / 12px 12px 0 #E53935)
* **Uso Canónico:**
  * Modales de confirmación destructiva (**Borrar Perfil**, Eliminar Calibración).
  * Alerta de alumno **🔴 ATASCADO** en el panel de control del Coach.
  * Botones de peligro (✕ Sí, eliminar definitivamente).
  * Avisos críticos de seguridad de Trazz (	razzSorprendido).

`css
/* Ejemplo de uso Rojo God */
.trazo-modal-danger {
  background: var(--trazo-ink);
  border: 3px solid var(--trazo-paper);
  box-shadow: 12px 12px 0 #E53935;
}

.trazo-btn-danger {
  background: #E53935;
  color: #FFFFFF;
  border: 2px solid #FF6B6B;
  box-shadow: 4px 4px 0 #8B0000;
}
`

---

## 📋 Resumen Rápido (Cheat Sheet)

`
🔵 EL AZUL RICO     -> #3657FF  (PASS, Progreso, Sombras 3D, Acción Primaria)
🟡 EL AMARILLO SEX  -> #F5A623  (REWORK, Calibración, Advertencia Pedagógica, Ámbar Mineral)
🔴 EL ROJO GOD      -> #E53935  (Destructivo, Borrado, Atascado, Sombras #8B0000)
⬛ MINERAL INK      -> #141A16  (Fondo y Profundidad 60%)
📜 PAPEL MINERAL    -> #F1F1EC  (Tipografía y Bordes 30%)
`
