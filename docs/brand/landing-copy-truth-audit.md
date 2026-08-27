# TRAZO LANDING COPY TRUTH AUDIT (FINAL FREEZE)

**Target:** `C:\Proyectos\opus-landing-page`  
**Source of Truth:** `C:\Proyectos\acompañante de ia` (`PROJECT_HYPOTHESIS.md`, `EVIDENCE_PACK.md`, `src/domain/evaluationPolicy.ts`, `src/data/course.ts`)  
**Audit Date:** 2026-08-16  

---

## 1. Classification Taxonomy

* **A. CURRENT PRODUCT FACT:** Direct, verifiable capability of the current codebase.
* **B. VERIFIED EXTERNAL EVIDENCE:** Backed by real empirical data or cited research.
* **C. POSITIONING / ASPIRATION:** Product hypothesis or strategic intent clearly framed as such.
* **D. UNSUPPORTED CLAIM:** Plausible but unverified claim with zero empirical proof or code backing.
* **E. MISLEADING / OVERSTATED:** False, exaggerated, or presenting future ideas/integrations as current facts.

---

## 2. Comprehensive Claim-by-Claim Audit & Final Resolutions

### Hero Section (`components/sections/hero-section.tsx` & `app/layout.tsx`)

| # | Final Freeze Copy | Classification | Ground Truth & Rationale | Status |
| :--- | :--- | :--- | :--- | :--- |
| 1 | *"Convierte tu curso en una ruta donde cada avance se demuestra."* (H1 & Title) | **C. POSITIONING** | Clear category anchor and functional promise without outcome guarantees. | **FROZEN** |
| 2 | *"Para creadores de cursos y programas prácticos: convierte tu metodología en una ruta visual donde cada avance requiere trabajo verificado."* (`layout.tsx` metadata) | **C. POSITIONING** | Truthful target audience and product mechanism. | **FROZEN** |
| 3 | *"TRAZO convierte tu metodología en una ruta visual de acciones. El alumno hace el trabajo, entrega evidencia y avanza cuando ese trabajo es verificado."* (Hero body) | **A. CURRENT PRODUCT FACT** | Matches the canonical 4-step execution loop. | **FROZEN** |
| 4 | *"Tu contenido puede seguir viviendo donde ya está. TRAZO se suma a tu programa actual."* (Hero subtext) | **A. CURRENT PRODUCT FACT** | Standalone web app; content remains in creator's original files/videos. | **FROZEN** |

---

### Content + Implementation Section (`components/sections/problem-section.tsx`)

| # | Final Freeze Copy | Classification | Ground Truth & Rationale | Status |
| :--- | :--- | :--- | :--- | :--- |
| 5 | *"Saber qué hacer no significa haberlo hecho."* (H2) | **C. POSITIONING** | Philosophical and practical distinction between knowledge acquisition and execution. | **FROZEN** |
| 6 | *"Tu curso ya enseña la metodología. TRAZO toma la parte práctica y la convierte en una ruta: qué hacer ahora, qué trabajo entregar y qué puede venir después."* (Body) | **A. CURRENT PRODUCT FACT** | Accurately defines the boundary between course content and TRAZO execution. | **FROZEN** |
| 7 | *Visual transition: Lo que enseñas (Lecciones) $\rightarrow$ Lo que el alumno hace (Paso 01: Premisa verificada, Paso 02: Parte de tu premisa verificada, Paso 03: Disponible después)* | **A. CURRENT PRODUCT FACT** | Accurately models the `premise` artifact generation and downstream consumption. | **FROZEN** |
| 8 | *"El contenido sigue donde ya está. TRAZO organiza su ejecución."* (Closing banner) | **C. POSITIONING** | Core positioning rule: content teaches, TRAZO organizes execution. | **FROZEN** |

---

### Student Experience Section (`components/sections/demo-section.tsx`)

| # | Final Freeze Copy | Classification | Ground Truth & Rationale | Status |
| :--- | :--- | :--- | :--- | :--- |
| 9 | *"El progreso no se marca. Se demuestra."* (H2) | **C. POSITIONING** | Replaces vanity progress bars with verified work. | **FROZEN** |
| 10 | *"El alumno hace el trabajo, entrega una prueba y recibe feedback. Si cumple el criterio, la ruta sigue."* (Body) | **A. CURRENT PRODUCT FACT** | Truthful 4-step loop summary. | **FROZEN** |
| 11 | *Paso 1: Misión activa ("Qué toca hacer ahora.") / Paso 2: Entrega ("El trabajo que demuestra que lo hiciste.") / Paso 3: Feedback ("Se revisa contra el criterio de la metodología.") / Paso 4: Ruta abierta ("Si cuenta, el recorrido continúa.")* | **A. CURRENT PRODUCT FACT** | Ultra-concise, non-redundant description of the product flow. | **FROZEN** |

---

### Coach / Accompanying Section (`components/sections/creator-section.tsx`)

| # | Final Freeze Copy | Classification | Ground Truth & Rationale | Status |
| :--- | :--- | :--- | :--- | :--- |
| 12 | *"Ve en qué parte del proceso necesita ayuda cada alumno."* (H2) | **A. CURRENT PRODUCT FACT** | Implementation state dashboard visibility. | **FROZEN** |
| 13 | *"No necesitas perseguir a nadie a ciegas. Ves quién avanza, quién ya entregó trabajo y quién lleva tiempo detenido."* + *"Así puedes decidir dónde vale la pena entrar."* | **A. CURRENT PRODUCT FACT** | Clarifies that TRAZO makes state visible, while the human coach retains decision authority. | **FROZEN** |
| 14 | *Signals: Mariana ("Sin avance reciente"), Leo ("Por validar"), Sofía ("En progreso")* | **A. CURRENT PRODUCT FACT (ILLUSTRATIVE)** | Factual state tags only; zero automated prioritization algorithms claimed. | **FROZEN** |
| 15 | *"No necesitas otra gráfica. Necesitas saber quién necesita atención hoy."* (Bottom note) | **C. POSITIONING / PHILOSOPHY** | Human-centered actionable visibility over vanity analytics. | **FROZEN** |

---

### CTA & Contact Section (`components/sections/cta-section.tsx` & `components/contact-form.tsx`)

| # | Final Freeze Copy | Classification | Ground Truth & Rationale | Status |
| :--- | :--- | :--- | :--- | :--- |
| 16 | *"Convirtamos tu metodología en una ruta de implementación."* (H2) | **C. POSITIONING** | Direct invitation for creators with practical deliverables. | **FROZEN** |
| 17 | *"15 minutos para entender tu programa y ver si TRAZO encaja."* (Bullet 1) | **A. CURRENT PRODUCT FACT** | Single, non-redundant reassurance. | **FROZEN** |
| 18 | *"Pensado para programas y mentorías con entregables prácticos."* (Bullet 2) | **A. CURRENT PRODUCT FACT** | Clear audience qualification. | **FROZEN** |
| 19 | *"Tu contenido puede seguir viviendo donde ya está (videos, documentos o plataforma actual)."* (Bullet 3) | **A. CURRENT PRODUCT FACT** | Content-agnostic truth. | **FROZEN** |

---

## 3. Truth & Positioning Summary

* **Core Truth:** TRAZO is the platform where methodologies are executed.
* **Capitalization:** Standardized to `TRAZO` throughout the interface and metadata.
* **Zero false claims:** No completion rate statistics, no automated triage promises, no unbuilt platform integrations.
