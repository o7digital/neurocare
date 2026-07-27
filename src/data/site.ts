export const doctorProfile = {
  fullName: 'Dra. Ariadna Montserrat Mondragon Medellin',
  firstName: 'Ariadna',
  monogram: 'AM',
  specialty: 'Psiquiatra · Medica general',
  location: 'San Angel · Ciudad de Mexico',
  shortLocation: 'San Angel, CDMX',
  address: 'Calle Cracovia 72, Edi Torre A, Oficina 216, San Angel, Alvaro Obregon, 01000',
  license: 'Cedulas profesionales: 12575520 · 14609330',
  doctoraliaUrl: 'https://www.doctoralia.com.mx/perfil/ariadna-montserrat-mondragon-medellin',
  whatsappUrl: 'https://www.doctoralia.com.mx/perfil/ariadna-montserrat-mondragon-medellin',
  phoneLabel: '55 7191 9515',
  phoneHref: 'tel:+525571919515',
  secondaryPhoneLabel: '55 5616 2095',
  secondaryPhoneHref: 'tel:+525556162095',
  portrait: '/dra-ariadna-mondragon.jpg',
  avatar: '/dra-ariadna-mondragon-avatar.jpg',
  onlineCareNote: 'Consulta presencial y videoconsulta disponibles en Doctoralia',
};

export const navItems = [
  { label: 'Inicio', href: '#inicio' },
  { label: 'Sobre mi', href: '#sobre-mi' },
  { label: 'Areas de atencion', href: '#areas' },
  { label: 'Mi enfoque', href: '#enfoque' },
  { label: 'Primera consulta', href: '#primera-consulta' },
  { label: 'Articulos', href: '#articulos' },
  { label: 'Contacto', href: '#contacto' },
];

export const trustItems = [
  'Medicina basada en evidencia',
  'Atencion confidencial',
  'Tratamiento personalizado',
  'Seguimiento medico',
  'Consulta en San Angel',
];

export const profileFields = [
  ['Nombre completo', doctorProfile.fullName],
  ['Especialidad', doctorProfile.specialty],
  ['Alta especialidad', 'Neuropsiquiatria, INNN Manuel Velasco Suarez (2024-2025)'],
  ['Especialidad', 'Psiquiatria, INNN Manuel Velasco Suarez (2020-2024)'],
  ['Formacion medica', 'Medico Cirujano, Universidad Nacional Autonoma de Mexico (2019)'],
  ['Cedulas profesionales', '12575520 · 14609330'],
  ['Idiomas', 'Espanol · Ingles'],
  ['Consulta', 'Presencial en San Angel y consulta en linea'],
  ['Pacientes', 'Adultos y ninos, segun disponibilidad indicada en Doctoralia'],
];

export const careAreas = [
  {
    title: 'Trastorno de ansiedad generalizada',
    description:
      'Valoracion psiquiatrica para comprender sintomas de ansiedad, su contexto y las opciones de tratamiento adecuadas.',
    icon: 'wave',
  },
  {
    title: 'Depresion',
    description:
      'Acompanamiento medico para cambios persistentes del animo, energia, interes y funcionamiento cotidiano.',
    icon: 'circle',
  },
  {
    title: 'TDAH',
    description:
      'Evaluacion cuidadosa de atencion, hiperactividad, impulsividad, historia clinica y funcionamiento cotidiano.',
    icon: 'spark',
  },
  {
    title: 'Trastorno del espectro autista',
    description:
      'Abordaje psiquiatrico integral cuando hay necesidades clinicas, emocionales o conductuales asociadas.',
    icon: 'moon',
  },
  {
    title: 'Fibromialgia',
    description:
      'Valoracion de sintomas, impacto funcional y relacion con salud mental para orientar un plan medico responsable.',
    icon: 'focus',
  },
  {
    title: 'Seguimiento psiquiatrico',
    description:
      'Continuidad medica para revisar evolucion, respuesta al tratamiento, dudas y ajustes cuando sean necesarios.',
    icon: 'path',
  },
];

export const approachCards = [
  {
    title: 'Escucha clinica',
    description:
      'La consulta inicia con una conversacion cuidadosa para entender sintomas, historia, contexto y prioridades.',
  },
  {
    title: 'Neuropsiquiatria basada en evidencia',
    description:
      'Su formacion integra psiquiatria y neuropsiquiatria para valorar salud mental, sintomas neurologicos y bienestar general.',
  },
  {
    title: 'Plan personalizado',
    description:
      'El tratamiento se construye segun necesidades individuales, seguimiento y objetivos realistas.',
  },
];

export const firstConsultationSteps = [
  ['01', 'Agenda', 'Solicita disponibilidad directamente en Doctoralia o por telefono.'],
  ['02', 'Primera valoracion', 'La doctora revisa el motivo de consulta, antecedentes y necesidades actuales.'],
  ['03', 'Plan de tratamiento', 'Recibiras una explicacion medica clara y los siguientes pasos propuestos.'],
  ['04', 'Seguimiento', 'Las consultas posteriores permiten ajustar el plan segun evolucion y respuesta.'],
];

export const articles = [
  {
    category: 'Ansiedad',
    title: 'Cuando buscar ayuda psiquiatrica por ansiedad',
    description:
      'Senales frecuentes, diferencias con el estres cotidiano y que informacion conviene llevar a consulta.',
  },
  {
    category: 'Primera consulta',
    title: 'Que esperar de una primera valoracion psiquiatrica',
    description:
      'Una guia clara para llegar con dudas, antecedentes y expectativas sin sentir que debes tener todo resuelto.',
  },
  {
    category: 'Neuropsiquiatria',
    title: 'Que es la neuropsiquiatria y cuando puede ayudar',
    description:
      'Una mirada integral para entender sintomas emocionales, cognitivos y neurologicos dentro de una valoracion medica.',
  },
];

export const services = [
  'Consulta en linea',
  'Consulta Psiquiatrica',
  'Primera visita Psiquiatria',
  'Visita Psiquiatria',
  'Evaluaciones clinicas',
  'Terapia cognitivo-conductual (TCC)',
];
