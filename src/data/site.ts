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
    title: 'Agenda por especialidad',
    icon: 'A',
    description:
      'Flujos por servicio, modalidad, duración y requisitos administrativos para ordenar la demanda desde el primer contacto.',
  },
  {
    title: 'Preconsulta administrativa',
    icon: 'P',
    description:
      'Solicitud breve y privada para orientar al equipo antes de confirmar una cita, sin diagnóstico en línea.',
  },
  {
    title: 'Perfiles médicos premium',
    icon: 'M',
    description:
      'Formación, cédula, enfoque clínico, idiomas, publicaciones y disponibilidad preparados para crecer con el equipo.',
  },
  {
    title: 'Contenido médico claro',
    icon: 'B',
    description:
      'Artículos educativos revisados por especialistas, con lenguaje humano y sin promesas clínicas.',
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
];

export const journeySteps = [
  ['01', 'Motivo de consulta', 'El paciente indica si busca neuropsiquiatría, psiquiatría, evaluación, sueño o segunda opinión.'],
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
