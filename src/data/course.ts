import type { Course } from '../domain/course'

export const course: Course = {
  id: 'primer-sistema-de-contenido',
  title: 'Primera pieza en mercado',
  chapters: [
    {
      id: 'chapter-1',
      title: 'Chapter 1 · De idea a señal real',
      shortTitle: '01',
      mapPromise: 'Lleva una idea al mercado y aprende de su primera señal.',
      missions: [
        {
          id: 'N01',
          title: 'Premisa',
          nodeType: 'normal',
          mapRole: 'entry',
          progressState: 'available',
          position: { x: 100, y: 380 },
          description:
            'Define la idea central que hará que tu primera pieza tenga una dirección clara.',
          evidenceType: 'text',
          evidencePrompt: 'Escribe tu premisa en una sola frase.',
          evidenceCriteria:
            'Debe expresar una idea concreta, para una audiencia reconocible y sin explicaciones adicionales.',
          rubric: {
            id: 'rubric-n01',
            version: '1.0.0',
            criteria: [
              {
                id: 'c1_concrete_idea',
                label: 'Idea Concreta',
                description:
                  'Expresa una idea central única, comprensible y sin ambigüedades temáticas.',
                isRequired: true,
              },
              {
                id: 'c2_target_audience',
                label: 'Audiencia Reconocible',
                description:
                  'Identifica con claridad el perfil, segmento o cliente objetivo al que se dirige la pieza.',
                isRequired: true,
              },
              {
                id: 'c3_no_filler',
                label: 'Concisión y Foco',
                description:
                  'Está formulada en una sola frase directa sin explicaciones ni justificaciones accesorias.',
                isRequired: true,
              },
            ],
          },
          producesArtifacts: ['premise'],
          artifactProductions: [
            {
              key: 'premise',
              build: { evidenceField: 'statement' },
              displayLabel: 'Premisa verificada',
            },
          ],
        },
        {
          id: 'N02',
          title: 'Estructura Directa',
          nodeType: 'normal',
          progressState: 'locked',
          prerequisites: ['N01'],
          position: { x: 440, y: 170 },
          description:
            'Convierte la premisa en una estructura breve, explícita y fácil de seguir.',
          evidenceType: 'text',
          evidencePrompt: 'Comparte el esquema directo de tu pieza.',
          evidenceCriteria:
            'Incluye apertura, desarrollo y cierre en un orden que pueda ejecutarse.',
          consumesArtifacts: ['premise'],
          producesArtifacts: ['direct_structure'],
          artifactProductions: [
            {
              key: 'direct_structure',
              build: {
                evidenceField: 'content',
                variant: 'direct',
                linkedConsumed: { property: 'sourcePremiseArtifactId', key: 'premise' },
              },
            },
          ],
          rubric: {
            id: 'rubric-n02',
            version: '1.0.0',
            criteria: [
              {
                id: 'c1_three_part_order',
                label: 'Apertura, Desarrollo y Cierre',
                description:
                  'Estructura la pieza en tres momentos claros y ordenados: apertura/gancho, desarrollo del argumento y cierre/llamado.',
                isRequired: true,
              },
              {
                id: 'c2_premise_consistency',
                label: 'Consistencia con la Premisa Verificada',
                description:
                  'Mantiene fidelidad al público objetivo y problema o resultado de la premisa verificada en N01, sin contradecirla ni cambiar arbitrariamente de audiencia o tema.',
                isRequired: true,
              },
              {
                id: 'c3_actionable_clarity',
                label: 'Claridad y Ejecución Directa',
                description:
                  'El esquema es explícito, conciso y directamente accionable para redactar la pieza sin rodeos ni ambigüedades.',
                isRequired: true,
              },
            ],
          },
        },
        {
          id: 'N03',
          title: 'Estructura Narrativa',
          nodeType: 'normal',
          progressState: 'locked',
          prerequisites: ['N01'],
          position: { x: 440, y: 590 },
          description:
            'Desarrolla la misma premisa como una secuencia con tensión, giro y resolución.',
          evidenceType: 'text',
          evidencePrompt: 'Comparte el esquema narrativo de tu pieza.',
          evidenceCriteria:
            'Debe identificar una situación inicial, un cambio y una resolución conectada con la premisa.',
          consumesArtifacts: ['premise'],
          producesArtifacts: ['narrative_structure'],
          artifactProductions: [
            {
              key: 'narrative_structure',
              build: {
                evidenceField: 'content',
                variant: 'narrative',
                linkedConsumed: { property: 'sourcePremiseArtifactId', key: 'premise' },
              },
            },
          ],
          rubric: {
            id: 'rubric-n03',
            version: '1.0.0',
            criteria: [
              {
                id: 'c1_narrative_arc',
                label: 'Arco Narrativo (Inicio, Cambio, Resolución)',
                description:
                  'Presenta una secuencia de historia identificable con situación inicial (estado actual), cambio/tensión/conflicto y resolución.',
                isRequired: true,
              },
              {
                id: 'c2_premise_consistency',
                label: 'Conexión con la Premisa Verificada',
                description:
                  'La historia y su desenlace ilustran y respaldan directamente la premisa verificada en N01, sin desviarse hacia otra temática o público ajeno.',
                isRequired: true,
              },
              {
                id: 'c3_tension_resolution',
                label: 'Tensión y Aprendizaje',
                description:
                  'El giro o conflicto genera una tensión clara que desemboca en un aprendizaje o conclusión coherente con la premisa.',
                isRequired: true,
              },
            ],
          },
        },
        {
          id: 'N04',
          title: 'Revisión Opcional',
          nodeType: 'optional',
          progressState: 'locked',
          prerequisites: ['N03'],
          position: { x: 740, y: 690 },
          description:
            'Haz una revisión adicional de ritmo y claridad sin detener la ruta principal.',
          evidenceType: 'text',
          evidencePrompt: 'Anota el ajuste más importante que hiciste durante la revisión.',
          evidenceCriteria:
            'Describe un cambio específico y la razón por la que mejora claridad o ritmo.',
        },
        {
          id: 'N05',
          title: 'Ensamble',
          nodeType: 'normal',
          mapRole: 'convergence',
          progressState: 'locked',
          requiresAny: ['N02', 'N03'],
          position: { x: 800, y: 380 },
          description:
            'Une premisa y estructura en un borrador completo listo para producir.',
          evidenceType: 'text',
          evidencePrompt: 'Pega el borrador ensamblado o su versión resumida.',
          evidenceCriteria:
            'La pieza debe sostener la premisa y seguir una de las estructuras elegidas.',
          consumesArtifacts: ['premise'],
          rubric: {
            id: 'rubric-n05',
            version: '1.0.0',
            criteria: [
              {
                id: 'c1_full_draft',
                label: 'Borrador Completo y Fluido',
                description:
                  'Presenta la pieza completa con apertura, desarrollo y cierre en un formato listo para publicar.',
                isRequired: true,
              },
              {
                id: 'c2_premise_alignment',
                label: 'Fidelidad a la Premisa Verificada',
                description:
                  'El borrador sostiene de principio a fin la premisa aprobada en N01 sin desviarse de audiencia ni resultado.',
                isRequired: true,
              },
              {
                id: 'c3_structural_consistency',
                label: 'Coherencia Estructural',
                description:
                  'El texto respeta la arquitectura aprobada previamente (sea directa en N02 o narrativa en N03).',
                isRequired: true,
              },
            ],
          },
        },
        {
          id: 'N06',
          title: 'Publicación',
          nodeType: 'normal',
          progressState: 'locked',
          prerequisites: ['N05'],
          position: { x: 1080, y: 240 },
          description:
            'Publica la pieza terminada en el canal elegido y registra su enlace.',
          evidenceType: 'url',
          evidencePrompt: 'Comparte la URL pública de la pieza.',
          evidenceCriteria:
            'El enlace debe apuntar a la publicación terminada en el canal elegido.',
          rubric: {
            id: 'rubric-n06',
            version: '1.0.0',
            criteria: [
              {
                id: 'c1_valid_public_url',
                label: 'Enlace Público Accesible',
                description:
                  'El enlace compartido es una URL válida, accesible y corresponde a un canal de publicación real.',
                isRequired: true,
              },
              {
                id: 'c2_draft_match',
                label: 'Correspondencia con el Borrador',
                description:
                  'El contenido enlazado refleja el borrador verificado en N05 sin cambios drásticos que alteren la premisa.',
                isRequired: true,
              },
            ],
          },
        },
        {
          id: 'N07',
          title: 'Registro de Señales',
          nodeType: 'normal',
          progressState: 'locked',
          prerequisites: ['N06'],
          position: { x: 1080, y: 520 },
          description:
            'Captura las primeras señales cualitativas y cuantitativas de la publicación.',
          evidenceType: 'text',
          evidencePrompt: 'Registra las primeras señales que observaste.',
          evidenceCriteria:
            'Incluye al menos una señal observable y el periodo en que la mediste.',
          rubric: {
            id: 'rubric-n07',
            version: '1.0.0',
            criteria: [
              {
                id: 'c1_observable_metrics',
                label: 'Métricas o Respuestas Observables',
                description:
                  'Registra datos reales observables (vistas, comentarios, mensajes, conversiones o feedback cualitativo específico).',
                isRequired: true,
              },
              {
                id: 'c2_time_window',
                label: 'Ventana de Medición Definida',
                description:
                  'Declara con claridad el marco temporal en el que se recolectaron las señales registradas.',
                isRequired: true,
              },
            ],
          },
        },
        {
          id: 'N08',
          title: 'Análisis',
          nodeType: 'normal',
          progressState: 'locked',
          prerequisites: ['N07'],
          position: { x: 1340, y: 380 },
          description:
            'Interpreta las señales y decide qué conservar, ajustar o probar después.',
          evidenceType: 'text',
          evidencePrompt: 'Escribe tu conclusión y la siguiente decisión.',
          evidenceCriteria:
            'Conecta una señal registrada con una decisión concreta para la siguiente pieza.',
          rubric: {
            id: 'rubric-n08',
            version: '1.0.0',
            criteria: [
              {
                id: 'c1_signal_interpretation',
                label: 'Interpretación de Señales',
                description:
                  'Analiza objetivamente por qué la audiencia respondió de esa manera, conectando con la premisa inicial.',
                isRequired: true,
              },
              {
                id: 'c2_actionable_next_step',
                label: 'Decisión de Próximo Paso',
                description:
                  'Define una acción correctiva, de escalamiento o de iteración clara y medible.',
                isRequired: true,
              },
            ],
          },
        },
        {
          id: 'N09',
          title: 'Primera Pieza en Mercado',
          nodeType: 'milestone',
          mapSubtitle: 'Una pieza publicada. Una señal real.',
          progressState: 'locked',
          prerequisites: ['N08'],
          position: { x: 1600, y: 380 },
          description:
            'Cierra el ciclo con una pieza publicada y un aprendizaje concreto del mercado.',
          evidenceType: 'text',
          evidencePrompt: 'Resume qué pusiste en el mercado y qué aprendiste del ciclo.',
          evidenceCriteria:
            'Menciona la pieza publicada, la señal más útil y una decisión para continuar.',
          rubric: {
            id: 'rubric-n09',
            version: '1.0.0',
            criteria: [
              {
                id: 'c1_full_cycle_synthesis',
                label: 'Síntesis de Ciclo Completo',
                description:
                  'Sintetiza la travesía desde la premisa original hasta la señal de mercado real y la decisión final.',
                isRequired: true,
              },
              {
                id: 'c2_validated_insight',
                label: 'Aprendizaje Validado',
                description:
                  'Destaca el insight más valioso obtenido del mercado contrastado con la hipótesis de partida.',
                isRequired: true,
              },
            ],
          },
        },
      ],
      edges: [
        {
          id: 'E01',
          source: 'N01',
          target: 'N02',
          via: { x: 280, y: 380 },
        },
        {
          id: 'E02',
          source: 'N01',
          target: 'N03',
          via: { x: 280, y: 380 },
        },
        { id: 'E03', source: 'N02', target: 'N05', via: { x: 620, y: 275 } },
        { id: 'E04', source: 'N03', target: 'N05', via: { x: 620, y: 485 } },
        { id: 'E05', source: 'N03', target: 'N04', optional: true },
        { id: 'E06', source: 'N04', target: 'N05', optional: true, via: { x: 770, y: 535 } },
        { id: 'E07', source: 'N05', target: 'N06', via: { x: 940, y: 310 } },
        { id: 'E08', source: 'N06', target: 'N07', via: { x: 1140, y: 380 } },
        { id: 'E09', source: 'N07', target: 'N08', via: { x: 1210, y: 450 } },
        { id: 'E10', source: 'N08', target: 'N09', via: { x: 1470, y: 380 } },
      ],
      junctions: [{ id: 'branch-01', position: { x: 280, y: 380 } }],
      regions: [
        {
          id: 'territory-workshop',
          title: 'Taller',
          description: 'De premisa a borrador',
          variant: 'workshop',
          position: { x: 40, y: 80 },
          width: 900,
          height: 600,
        },
        {
          id: 'territory-field',
          title: 'Campo',
          description: 'La pieza encuentra la realidad',
          sequence: ['Publica', 'Observa', 'Decide'],
          variant: 'field',
          position: { x: 980, y: 150 },
          width: 480,
          height: 460,
        },
        {
          id: 'territory-market',
          title: 'Mercado',
          description: 'Primera señal real',
          variant: 'market',
          position: { x: 1500, y: 240 },
          width: 320,
          height: 280,
        },
      ],
    },
  ],
}
