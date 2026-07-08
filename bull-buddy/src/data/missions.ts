import type { Mission } from '../types';

export const MISSIONS: Mission[] = [
  {
    id: 'm001',
    title: 'Salva el Puesto de Limonada',
    description: 'Ayuda a Lalo a salvar su puesto de limonada antes de que cierre.',
    icon: '🍋',
    order: 1,
    conceptLearned: 'Ingresos, gastos y margen de ganancia',
    steps: [
      {
        id: 'm001_s1',
        narrative: 'Lalo tiene un puesto de limonada pero está perdiendo dinero. Te pide ayuda. Su mamá le prestó $20 para empezar. Cada limonada la vende a $1 y cuesta $0.30 hacerla. Pero vende solo 10 por día. ¿Qué le recomiendas?',
        options: [
          { id: 'm001_s1_a', text: 'Subir el precio a $1.50', consequence: 'Buenos ingresos... pero algunos clientes se quejan.', nextStepId: 'm001_s2a', isCorrect: false, coinsReward: 5, xpReward: 10 },
          { id: 'm001_s1_b', text: 'Poner un cartel más grande y ofrecer descuento por 2', consequence: '¡Buena idea de marketing!', nextStepId: 'm001_s2b', isCorrect: true, coinsReward: 10, xpReward: 20 },
          { id: 'm001_s1_c', text: 'Cerrar el puesto y dedicarse a otra cosa', consequence: 'Lalo se pone triste...', nextStepId: 'm001_s2c', isCorrect: false, coinsReward: 2, xpReward: 5 },
        ],
      },
      {
        id: 'm001_s2a',
        narrative: 'Subiste el precio. Algunos clientes se fueron, pero los que se quedaron pagan más. Vendes 8 limonadas al día a $1.50. Ganas $12, gastas $2.40. Ganancia: $9.60. ¿Qué haces ahora?',
        options: [
          { id: 'm001_s2a_a', text: 'Bajar el precio a $1 otra vez', consequence: 'Vuelves a vender 10 pero con menos margen.', nextStepId: 'm001_s3', isCorrect: false, coinsReward: 3, xpReward: 8 },
          { id: 'm001_s2a_b', text: 'Mantener el precio y mejorar la receta', consequence: '¡La calidad atrae más clientes!', nextStepId: 'm001_s3', isCorrect: true, coinsReward: 8, xpReward: 15 },
        ],
      },
      {
        id: 'm001_s2b',
        narrative: '¡El cartel funcionó! Ahora vendes 18 limonadas al día. Ingresas $18, gastas $5.40. Ganancia del día: $12.60. Lalo está contento. ¿Cómo sigues?',
        options: [
          { id: 'm001_s2b_a', text: 'Ahorrar la ganancia para crecer', consequence: 'Buena decisión financiera. El negocio crece.', nextStepId: 'm001_s3', isCorrect: true, coinsReward: 12, xpReward: 20 },
          { id: 'm001_s2b_b', text: 'Gastar toda la ganancia en dulces', consequence: 'Lalo se divierte pero el negocio no crece...', nextStepId: 'm001_s3', isCorrect: false, coinsReward: 2, xpReward: 5 },
        ],
      },
      {
        id: 'm001_s2c',
        narrative: 'Lalo cerró su puesto. Está triste porque no intentó otras opciones. A veces hay que perseverar.',
        options: [
          { id: 'm001_s2c_a', text: 'Reabrir el puesto con un nuevo plan', consequence: '¡Segunda oportunidad!', nextStepId: 'm001_s1', isCorrect: true, coinsReward: 3, xpReward: 5 },
          { id: 'm001_s2c_b', text: 'Dejarlo cerrado y buscar otro sueño', consequence: 'A veces hay que saber cuándo pivotear.', nextStepId: 'm001_s3', isCorrect: false, coinsReward: 1, xpReward: 3 },
        ],
      },
      {
        id: 'm001_s3',
        narrative: 'Fin de la misión. Lalo aprendió que para tener un negocio exitoso hay que entender cuánto ingresas, cuánto gastas y cómo crecer. ¡Como en la bolsa!',
        options: [],
      },
    ],
  },
  {
    id: 'm002',
    title: 'El Concierto de tus Sueños',
    description: 'Ahorra e invierte para comprar entradas para tu banda favorita.',
    icon: '🎸',
    order: 2,
    conceptLearned: 'Ahorro, interés compuesto y paciencia',
    steps: [
      {
        id: 'm002_s1',
        narrative: 'Tu banda favorita, "Los Chocochips", viene a la ciudad en 6 meses. Las entradas cuestan $120. Tienes $20 de mesada. ¿Cuál es tu plan?',
        options: [
          { id: 'm002_s1_a', text: 'Guardar $20 cada mes en una alcancía', consequence: 'En 6 meses tendrás $120. ¡Justo!', nextStepId: 'm002_s2a', isCorrect: false, coinsReward: 8, xpReward: 15 },
          { id: 'm002_s1_b', text: 'Guardar $15 al mes e invertir $5 en acciones de MOONCO', consequence: '¡Interesante! Podrías ganar más que solo ahorrando.', nextStepId: 'm002_s2b', isCorrect: true, coinsReward: 15, xpReward: 25 },
          { id: 'm002_s1_c', text: 'Gastar todo y pedir prestado después', consequence: 'Las deudas no son buena idea...', nextStepId: 'm002_s2c', isCorrect: false, coinsReward: 2, xpReward: 5 },
        ],
      },
      {
        id: 'm002_s2a',
        narrative: 'Ahorraste $120 en 6 meses. ¡Compraste las entradas! Pero no te sobró nada para gastar en el concierto. ¿Qué aprendiste?',
        options: [
          { id: 'm002_s2a_a', text: 'Debería haber ahorrado un poco más', consequence: 'El ahorro es bueno, pero invertir puede hacer crecer tu dinero.', nextStepId: 'm002_s3', isCorrect: true, coinsReward: 5, xpReward: 10 },
          { id: 'm002_s2a_b', text: 'Fue perfecto así', consequence: 'Está bien, pero pudiste haber ganado más con inversión.', nextStepId: 'm002_s3', isCorrect: false, coinsReward: 3, xpReward: 5 },
        ],
      },
      {
        id: 'm002_s2b',
        narrative: '¡Buena estrategia! Ahorraste $90 en 6 meses y tus $30 invertidos en MOONCO crecieron a $45 porque la acción subió. ¡Tienes $135! Entradas ($120) y te sobran $15 para una camiseta.',
        options: [
          { id: 'm002_s2b_a', text: '¡Invertir es genial! Seguiré haciéndolo', consequence: 'El interés compuesto es tu mejor amigo para el futuro.', nextStepId: 'm002_s3', isCorrect: true, coinsReward: 15, xpReward: 25 },
          { id: 'm002_s2b_b', text: 'Fue suerte, mejor solo ahorrar', consequence: 'Invertir tiene riesgo, pero a largo plazo suele dar frutos.', nextStepId: 'm002_s3', isCorrect: false, coinsReward: 5, xpReward: 10 },
        ],
      },
      {
        id: 'm002_s2c',
        narrative: 'Pediste prestado $120 al 10% de interés. Terminaste pagando $132. Aprendiste que las deudas pueden salir caras. Más vale ahorrar e invertir.',
        options: [
          { id: 'm002_s2c_a', text: 'Nunca más pediré prestado', consequence: '¡Buena lección!', nextStepId: 'm002_s3', isCorrect: true, coinsReward: 5, xpReward: 10 },
          { id: 'm002_s2c_b', text: 'Valió la pena por el concierto', consequence: 'El concierto fue increíble pero pagaste más de la cuenta.', nextStepId: 'm002_s3', isCorrect: false, coinsReward: 2, xpReward: 5 },
        ],
      },
      {
        id: 'm002_s3',
        narrative: 'Fin de la misión. Aprendiste que ahorrar es bueno, pero invertir (con cuidado) puede hacer tu dinero crecer. El interés compuesto es como una bola de nieve: empieza chica y crece con el tiempo.',
        options: [],
      },
    ],
  },
  {
    id: 'm003',
    title: 'La Tienda de Cómics',
    description: 'Invierte en el negocio de tus sueños.',
    icon: '🚀',
    order: 3,
    conceptLearned: 'Riesgo, diversificación y emprendimiento',
    steps: [
      {
        id: 'm003_s1',
        narrative: 'Tu amiga Val quiere abrir una tienda de cómics. Necesita $500 para empezar. Tú tienes $300 ahorrados. Ella te ofrece ser socio. ¿Qué haces?',
        options: [
          { id: 'm003_s1_a', text: 'Invertir todos tus $300', consequence: 'Mucho riesgo si la tienda no funciona...', nextStepId: 'm003_s2a', isCorrect: false, coinsReward: 5, xpReward: 10 },
          { id: 'm003_s1_b', text: 'Invertir $150 y guardar $150 para otras cosas', consequence: '¡Diversificaste! Repartiste el riesgo.', nextStepId: 'm003_s2b', isCorrect: true, coinsReward: 12, xpReward: 22 },
          { id: 'm003_s1_c', text: 'No invertir y solo ir a comprar cómics', consequence: 'Te pierdes la oportunidad de ser dueño de una tienda.', nextStepId: 'm003_s2c', isCorrect: false, coinsReward: 3, xpReward: 5 },
        ],
      },
      {
        id: 'm003_s2a',
        narrative: 'Invertiste todo. La tienda abre y las primeras semanas son lentas. Val está estresada. ¿Qué haces?',
        options: [
          { id: 'm003_s2a_a', text: 'Sacar tu dinero ahora', consequence: 'Pierdes porque la tienda recién empieza.', nextStepId: 'm003_s3', isCorrect: false, coinsReward: 2, xpReward: 5 },
          { id: 'm003_s2a_b', text: 'Tener paciencia y ayudar a promocionar', consequence: '¡La paciencia paga!', nextStepId: 'm003_s3', isCorrect: true, coinsReward: 8, xpReward: 15 },
        ],
      },
      {
        id: 'm003_s2b',
        narrative: 'Invertiste $150. La tienda abre con un evento de cómics gratis. ¡Llega mucha gente! Val contrata a un dibujante para firmar cómics. El negocio despega.',
        options: [
          { id: 'm003_s2b_a', text: 'Reinvertir tus ganancias en más cómics', consequence: 'El negocio crece y tu parte también.', nextStepId: 'm003_s3', isCorrect: true, coinsReward: 15, xpReward: 25 },
          { id: 'm003_s2b_b', text: 'Retirar tus ganancias y celebrar', consequence: 'Está bien, pero pudiste haber ganado más a largo plazo.', nextStepId: 'm003_s3', isCorrect: false, coinsReward: 5, xpReward: 10 },
        ],
      },
      {
        id: 'm003_s2c',
        narrative: 'No invertiste. La tienda de Val se vuelve un éxito. Ahora ves a los clientes felices y piensas "pude haber sido parte de esto".',
        options: [
          { id: 'm003_s2c_a', text: 'Ofrecer ayuda a Val para participar ahora', consequence: 'Nunca es tarde. Pero tu participación será menor.', nextStepId: 'm003_s3', isCorrect: true, coinsReward: 5, xpReward: 10 },
          { id: 'm003_s2c_b', text: 'Abrir tu propio negocio diferente', consequence: 'Emprender también es válido. Pero recuerda diversificar.', nextStepId: 'm003_s3', isCorrect: false, coinsReward: 3, xpReward: 5 },
        ],
      },
      {
        id: 'm003_s3',
        narrative: 'Fin de la misión. Aprendiste que invertir tiene riesgo, pero no invertir también tiene un costo de oportunidad. La clave está en diversificar y tener paciencia.',
        options: [],
      },
    ],
  },
];
