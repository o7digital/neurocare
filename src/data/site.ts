export const doctorProfile = {
  fullName: 'Dra. Nombre y Apellidos',
  firstName: 'Nombre',
  monogram: 'Dra.',
  specialty: 'Medica Psiquiatra',
  location: 'San Angel · Ciudad de Mexico',
  shortLocation: 'San Angel, CDMX',
  license: 'Cedula profesional por confirmar',
  doctoraliaUrl: '#agenda',
  whatsappUrl: 'https://wa.me/525500000000',
  phoneLabel: '+52 55 0000 0000',
  phoneHref: 'tel:+525500000000',
  onlineCareNote: 'Presencial y en linea, sujeto a confirmacion de la doctora',
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
  ['Nombre completo', 'Por confirmar'],
  ['Especialidad', doctorProfile.specialty],
  ['Formacion academica', 'Por confirmar'],
  ['Cedula profesional', 'Por confirmar'],
  ['Certificaciones', 'Por confirmar'],
  ['Experiencia', 'Por confirmar'],
  ['Idiomas', 'Por confirmar'],
  ['Asociaciones profesionales', 'Por confirmar'],
];

export const careAreas = [
  {
    title: 'Ansiedad',
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
    title: 'Estres y crisis emocionales',
    description:
      'Atencion para momentos de sobrecarga, crisis vitales o sintomas emocionales que requieren claridad clinica.',
    icon: 'spark',
  },
  {
    title: 'Trastornos del sueno',
    description:
      'Revision responsable de habitos, sintomas, horarios y factores medicos o emocionales relacionados con el descanso.',
    icon: 'moon',
  },
  {
    title: 'TDAH en adultos',
    description:
      'Evaluacion cuidadosa de atencion, organizacion, impulsividad e historia clinica antes de definir recomendaciones.',
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
    title: 'Ciencia y criterio medico',
    description:
      'Las decisiones se apoyan en evaluacion clinica, medicina basada en evidencia y explicaciones claras.',
  },
  {
    title: 'Plan personalizado',
    description:
      'El tratamiento se construye segun necesidades individuales, seguimiento y objetivos realistas.',
  },
];

export const firstConsultationSteps = [
  ['01', 'Agenda', 'Solicita disponibilidad en Doctoralia, WhatsApp o telefono.'],
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
    category: 'Sueno',
    title: 'Insomnio, salud mental y tratamiento medico',
    description:
      'Como describir tus sintomas de sueno y por que una evaluacion integral puede orientar mejor el tratamiento.',
  },
];
