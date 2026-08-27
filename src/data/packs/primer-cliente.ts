import type { Course } from '../../domain/course'

export const primerClienteDigital: Course = {
  id: 'primer-cliente-digital',
  title: 'Primer cliente digital',
  chapters: [
    {
      id: 'chapter-1',
      title: 'Chapter 1 · De cero a primer contacto real',
      shortTitle: '01',
      mapPromise: 'Define una oferta, sal al mercado y registra tu primer contacto real.',
      missions: [
        {
          id: 'C01',
          title: 'Define tu oferta',
          nodeType: 'normal',
          mapRole: 'entry',
          progressState: 'available',
          position: { x: 140, y: 360 },
          description:
            'Escribe la oferta concreta que vas a ofrecer, para quién es y qué resultado promete.',
          evidenceType: 'text',
          evidencePrompt: 'Escribe tu oferta en dos o tres frases.',
          evidenceCriteria:
            'Debe nombrar un resultado concreto, una audiencia específica y la forma de entrega.',
          rubric: {
            id: 'rubric-c01',
            version: '1.0.0',
            criteria: [
              {
                id: 'c1_concrete_outcome',
                label: 'Resultado Concreto',
                description:
                  'La oferta nombra un resultado observable que el cliente obtiene, sin frases genéricas de valor.',
                isRequired: true,
              },
              {
                id: 'c2_specific_audience',
                label: 'Audiencia Específica',
                description:
                  'Identifica un perfil o segmento reconocible, no "todo el mundo" ni un sector difuso.',
                isRequired: true,
              },
              {
                id: 'c3_delivery_shape',
                label: 'Forma de Entrega',
                description:
                  'Queda claro qué recibe el cliente y en qué formato (sesión, proyecto, entregable, servicio).',
                isRequired: true,
              },
            ],
          },
          producesArtifacts: ['offer'],
          artifactProductions: [
            {
              key: 'offer',
              build: { evidenceField: 'content' },
              displayLabel: 'Oferta verificada',
            },
          ],
        },
        {
          id: 'C02',
          title: 'Lista de prospectos',
          nodeType: 'normal',
          progressState: 'locked',
          prerequisites: ['C01'],
          position: { x: 430, y: 210 },
          description:
            'Construye una lista de prospectos reales que encajen con la oferta verificada.',
          evidenceType: 'text',
          evidencePrompt: 'Comparte tu lista de prospectos con nombre y canal de contacto.',
          evidenceCriteria:
            'Incluye al menos cinco prospectos concretos con el canal por el que los contactarás.',
          consumesArtifacts: ['offer'],
          producesArtifacts: ['prospect_list'],
          artifactProductions: [
            {
              key: 'prospect_list',
              build: {
                evidenceField: 'content',
                linkedConsumed: { property: 'sourceOfferArtifactId', key: 'offer' },
              },
            },
          ],
          rubric: {
            id: 'rubric-c02',
            version: '1.0.0',
            criteria: [
              {
                id: 'c1_minimum_five_prospects',
                label: 'Cinco Prospectos Reales',
                description:
                  'La lista contiene al menos cinco prospectos identificables, no categorías ni ejemplos hipotéticos.',
                isRequired: true,
              },
              {
                id: 'c1_offer_alignment',
                label: 'Alineados con la Oferta Verificada',
                description:
                  'Los prospectos encajan con la audiencia y el resultado de la oferta verificada, sin contradecirla.',
                isRequired: true,
              },
              {
                id: 'c3_contact_channel',
                label: 'Canal de Contacto Definido',
                description:
                  'Cada prospecto tiene un canal de contacto concreto y alcanzable (correo, red, formulario).',
                isRequired: true,
              },
            ],
          },
        },
        {
          id: 'C03',
          title: 'Primer contacto real',
          nodeType: 'normal',
          progressState: 'locked',
          prerequisites: ['C02'],
          position: { x: 760, y: 400 },
          description: 'Envía el primer mensaje real a un prospecto de tu lista verificada.',
          evidenceType: 'url',
          evidencePrompt: 'Comparte el enlace del contacto enviado (hilo, correo o registro).',
          evidenceCriteria:
            'El enlace debe apuntar a un contacto enviado a un prospecto concreto de la lista.',
          consumesArtifacts: ['prospect_list'],
          producesArtifacts: ['outreach_sent'],
          artifactProductions: [
            {
              key: 'outreach_sent',
              build: {
                evidenceField: 'content',
                linkedConsumed: { property: 'sourceProspectListArtifactId', key: 'prospect_list' },
              },
            },
          ],
          rubric: {
            id: 'rubric-c03',
            version: '1.0.0',
            criteria: [
              {
                id: 'c1_verifiable_link',
                label: 'Enlace Verificable',
                description:
                  'El enlace apunta a un contacto real enviado, accesible o registrable por el creador.',
                isRequired: true,
              },
              {
                id: 'c2_personalized_message',
                label: 'Mensaje Dirigido',
                description:
                  'El mensaje referencia algo específico del prospecto y conecta con la oferta verificada.',
                isRequired: true,
              },
            ],
          },
        },
        {
          id: 'C04',
          title: 'Primer Contacto Logrado',
          nodeType: 'milestone',
          mapSubtitle: 'Un contacto enviado. Un mercado real tocando a la puerta.',
          progressState: 'locked',
          prerequisites: ['C03'],
          position: { x: 1060, y: 180 },
          description:
            'Cierra el ciclo registrando qué enviaste, a quién y cuál fue el siguiente paso acordado.',
          evidenceType: 'text',
          evidencePrompt: 'Resume a quién contactaste, qué enviaste y qué respuesta o paso sigue.',
          evidenceCriteria:
            'Menciona el prospecto contactado, el envío realizado y el siguiente paso concreto.',
          consumesArtifacts: ['outreach_sent'],
          rubric: {
            id: 'rubric-c04',
            version: '1.0.0',
            criteria: [
              {
                id: 'c1_prospect_identified',
                label: 'Prospecto Identificado',
                description: 'El resumen nombra el prospecto contactado de la lista verificada.',
                isRequired: true,
              },
              {
                id: 'c2_submission_described',
                label: 'Envío Descrito',
                description: 'Describe qué se envió exactamente y por qué era el momento adecuado.',
                isRequired: true,
              },
              {
                id: 'c3_next_step',
                label: 'Siguiente Paso Concreto',
                description: 'Declara el siguiente paso acordado o planeado tras el contacto.',
                isRequired: true,
              },
            ],
          },
        },
      ],
      edges: [
        { id: 'EC01', source: 'C01', target: 'C02', via: { x: 300, y: 400 } },
        { id: 'EC02', source: 'C02', target: 'C03' },
        { id: 'EC03', source: 'C03', target: 'C04' },
      ],
      junctions: [{ id: 'branch-client-01', position: { x: 300, y: 400 } }],
    },
  ],
}
