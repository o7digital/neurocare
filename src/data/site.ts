export const navItems = [
  { label: 'Inicio', href: '#inicio' },
  { label: 'Especialidades', href: '#especialidades' },
  { label: 'Proceso', href: '#proceso' },
  { label: 'Equipo médico', href: '#equipo' },
  { label: 'Agenda', href: '#agenda' },
  { label: 'Blog', href: '#blog' },
  { label: 'Contacto', href: '#contacto' },
];

export const experienceCards = [
  {
    title: 'Orientación por especialidad',
    icon: 'A',
    description:
      'Identificamos el servicio y el especialista adecuados según el motivo de consulta y las necesidades del paciente.',
  },
  {
    title: 'Valoración responsable',
    icon: 'P',
    description:
      'La atención comienza con una evaluación clínica cuidadosa antes de indicar cualquier tratamiento o procedimiento.',
  },
  {
    title: 'Equipo especializado',
    icon: 'M',
    description:
      'Profesionales de distintas áreas trabajan de forma coordinada para ofrecer una atención integral y personalizada.',
  },
  {
    title: 'Seguimiento continuo',
    icon: 'B',
    description:
      'Acompañamos la evolución del paciente y ajustamos el plan de atención según su respuesta clínica.',
  },
];

export const specialties = [
  {
    title: 'Neuropsiquiatría',
    slug: '/especialidades/neuropsiquiatria',
    summary:
      'Evaluación integral de síntomas cognitivos, emocionales y conductuales, con enfoque médico especializado y coordinación interdisciplinaria.',
    bullets: [
      'Primera valoración médica especializada',
      'Segunda opinión clínica',
      'Plan de seguimiento y coordinación terapéutica',
    ],
  },
  {
    title: 'Psiquiatría clínica',
    slug: '/especialidades/psiquiatria-clinica',
    summary:
      'Atención privada para ansiedad, depresión, sueño, estrés, adaptación y continuidad farmacológica responsable.',
    bullets: [
      'Primera vez y seguimiento',
      'Enfoque humano, claro y estructurado',
      'Modalidad presencial u online para pacientes activos',
    ],
  },
  {
    title: 'Neuropsicología',
    slug: '/especialidades/neuropsicologia',
    summary:
      'Evaluaciones clínicas para memoria, atención, aprendizaje, TDAH, funciones ejecutivas y rendimiento cognitivo.',
    bullets: [
      'Baterías para adultos y adolescentes',
      'Reporte clínico estructurado',
      'Recomendaciones para seguimiento',
    ],
  },
  {
    title: 'Medicina del sueño',
    slug: '/especialidades/medicina-del-sueno',
    summary:
      'Orientación clínica para pacientes con insomnio, fatiga, estrés prolongado y síntomas asociados al descanso.',
    bullets: [
      'Evaluación inicial del sueño',
      'Hábitos, salud mental y contexto laboral',
      'Seguimiento personalizado',
    ],
  },
  {
    title: 'TDAH en adultos',
    slug: '/especialidades/tdah-adultos',
    summary:
      'Evaluación cuidadosa de atención, impulsividad, organización, historia clínica y funcionamiento cotidiano.',
    bullets: [
      'Tamizaje clínico responsable',
      'Diferenciación con ansiedad, sueño y estrés',
      'Plan de orientación y seguimiento',
    ],
  },
  {
    title: 'Ansiedad, depresión y estrés',
    slug: '/especialidades/ansiedad-depresion-estres',
    summary:
      'Atención médica y humana para síntomas emocionales, cambios de ánimo, estrés crónico y procesos de adaptación.',
    bullets: [
      'Valoración inicial estructurada',
      'Seguimiento clínico progresivo',
      'Coordinación con psicoterapia cuando aplica',
    ],
  },
  {
    title: 'Neuromodulación',
    slug: '/especialidades/neuromodulacion',
    summary:
      'Tecnología de estimulación cerebral no invasiva que puede integrarse al plan de atención cuando la valoración médica especializada así lo indica.',
    bullets: [
      'Estimulación magnética transcraneal (EMT/TMS)',
      'Estimulación transcraneal por corriente directa (tDCS)',
      'Valoración de elegibilidad y seguimiento clínico',
    ],
  },
];

export const journeySteps = [
  ['01', 'Motivo de consulta', 'El paciente comparte sus necesidades para orientarlo hacia la valoración médica o especialidad más adecuada.'],
  ['02', 'Filtro administrativo', 'Se recopilan datos básicos, edad, modalidad, disponibilidad y preferencia de especialista.'],
  ['03', 'Orientación interna', 'El equipo puede asignar el médico más adecuado según especialidad, agenda y tipo de caso.'],
  ['04', 'Confirmación humana', 'Recepción confirma por WhatsApp o email con indicaciones y políticas de cancelación.'],
  ['05', 'Seguimiento', 'Estructura preparada para recordatorios, próximas citas e indicaciones administrativas.'],
];

export const doctors = [
  {
    name: 'Dra. Nombre Apellido',
    role: 'Neuropsiquiatra',
    focus: 'Valoración integral de salud mental, síntomas cognitivos y trastornos del ánimo.',
    details: ['Santa Fe, CDMX', 'Español / Inglés', 'Presencial / Online'],
  },
  {
    name: 'Dr. Nombre Apellido',
    role: 'Psiquiatra clínico',
    focus: 'Atención de ansiedad, depresión, sueño, estrés y seguimiento farmacológico.',
    details: ['Consulta privada', 'Cédula profesional visible', 'Primera vez / seguimiento'],
  },
  {
    name: 'Psic. Nombre Apellido',
    role: 'Neuropsicología clínica',
    focus: 'Evaluaciones cognitivas, TDAH, memoria, atención y funciones ejecutivas.',
    details: ['Santa Fe, CDMX', 'Evaluación por batería', 'Reporte clínico estructurado'],
  },
];

export const seoKeywords = [
  'neuromodulación CDMX',
  'estimulación magnética transcraneal CDMX',
  'TMS en Santa Fe',
  'tDCS CDMX',
  'neuropsiquiatra en Santa Fe',
  'psiquiatra en Santa Fe CDMX',
  'evaluación neuropsicológica CDMX',
  'TDAH en adultos CDMX',
  'trastornos de memoria',
  'ansiedad y depresión Santa Fe',
  'medicina del sueño CDMX',
  'segunda opinión psiquiátrica',
  'neuropsicología clínica CDMX',
  'salud mental en Santa Fe',
];

export const futureArchitecture = [
  '/especialidades/neuromodulacion',
  '/especialidades/neuropsiquiatria',
  '/especialidades/psiquiatria-clinica',
  '/especialidades/neuropsicologia',
  '/especialidades/medicina-del-sueno',
  '/medicos/[slug]',
  '/agenda',
  '/blog',
  '/contacto',
  '/aviso-de-privacidad',
];
