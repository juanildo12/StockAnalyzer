import type { Mission } from '../types';

export const MISSIONS: Mission[] = [
  {
    id: 'm001', title: 'Salva el Puesto de Limonada', description: 'Ayuda a Lalo a salvar su puesto de limonada.',
    icon: '🍋', order: 1, conceptLearned: 'Ingresos, gastos y margen de ganancia',
    steps: [
      { id: 'm001_s1', narrative: 'Lalo tiene un puesto de limonada pero pierde dinero. Su mamá le prestó $20. Vende cada limonada a $1, cuesta $0.30 hacerla, vende 10 por día. ¿Qué haces?', options: [
        { id: 'a', text: 'Subir el precio a $1.50', consequence: 'Buenos ingresos pero clientes se quejan.', nextStepId: 'm001_s2a', isCorrect: false, coinsReward: 5, xpReward: 10 },
        { id: 'b', text: 'Poner un cartel y ofrecer descuento por 2', consequence: '¡Buena idea de marketing!', nextStepId: 'm001_s2b', isCorrect: true, coinsReward: 10, xpReward: 20 },
        { id: 'c', text: 'Cerrar el puesto', consequence: 'Lalo se pone triste...', nextStepId: 'm001_s2c', isCorrect: false, coinsReward: 2, xpReward: 5 },
      ]},
      { id: 'm001_s2a', narrative: 'Subiste el precio. Vendes 8 limonadas/día a $1.50. Ganas $12, gastas $2.40, ganancia $9.60. ¿Ahora qué?', options: [
        { id: 'a', text: 'Bajar el precio a $1 otra vez', consequence: 'Vuelves a 10 ventas con menos margen.', nextStepId: 'm001_s3', isCorrect: false, coinsReward: 3, xpReward: 8 },
        { id: 'b', text: 'Mantener precio y mejorar receta', consequence: '¡La calidad atrae más clientes!', nextStepId: 'm001_s3', isCorrect: true, coinsReward: 8, xpReward: 15 },
      ]},
      { id: 'm001_s2b', narrative: '¡El cartel funcionó! 18 limonadas/día. Ingresas $18, gastas $5.40. Ganancia: $12.60. Lalo está contento. ¿Cómo sigues?', options: [
        { id: 'a', text: 'Ahorrar la ganancia para crecer', consequence: 'Buena decisión financiera.', nextStepId: 'm001_s3', isCorrect: true, coinsReward: 12, xpReward: 20 },
        { id: 'b', text: 'Gastarlo todo en dulces', consequence: 'Lalo se divierte pero el negocio no crece...', nextStepId: 'm001_s3', isCorrect: false, coinsReward: 2, xpReward: 5 },
      ]},
      { id: 'm001_s2c', narrative: 'Lalo cerró su puesto. Está triste. A veces hay que perseverar.', options: [
        { id: 'a', text: 'Reabrir con un nuevo plan', consequence: '¡Segunda oportunidad!', nextStepId: 'm001_s1', isCorrect: true, coinsReward: 3, xpReward: 5 },
        { id: 'b', text: 'Buscar otro sueño', consequence: 'A veces hay que saber pivotear.', nextStepId: 'm001_s3', isCorrect: false, coinsReward: 1, xpReward: 3 },
      ]},
      { id: 'm001_s3', narrative: 'Fin. Lalo aprendió que para tener un negocio hay que entender ingresos, gastos y crecimiento. ¡Como en la bolsa!', options: []},
    ],
  },
  {
    id: 'm002', title: 'El Concierto de tus Sueños', description: 'Ahorra e invierte para comprar entradas.',
    icon: '🎸', order: 2, conceptLearned: 'Ahorro, interés compuesto y paciencia',
    steps: [
      { id: 'm002_s1', narrative: 'Tu banda favorita viene en 6 meses. Entradas cuestan $120. Tienes $20 de mesada. ¿Cuál es tu plan?', options: [
        { id: 'a', text: 'Guardar $20 cada mes en una alcancía', consequence: 'En 6 meses tienes $120. ¡Justo!', nextStepId: 'm002_s2a', isCorrect: false, coinsReward: 8, xpReward: 15 },
        { id: 'b', text: 'Guardar $15 e invertir $5 en MOONCO', consequence: '¡Interesante! Podrías ganar más.', nextStepId: 'm002_s2b', isCorrect: true, coinsReward: 15, xpReward: 25 },
        { id: 'c', text: 'Gastar todo y pedir prestado', consequence: 'Las deudas no son buena idea...', nextStepId: 'm002_s2c', isCorrect: false, coinsReward: 2, xpReward: 5 },
      ]},
      { id: 'm002_s2a', narrative: 'Ahorraste $120. ¡Compraste entradas! Pero no te sobró nada para gastar en el concierto.', options: [
        { id: 'a', text: 'Debí ahorrar un poco más', consequence: 'El ahorro es bueno, invertir puede hacer crecer tu dinero.', nextStepId: 'm002_s3', isCorrect: true, coinsReward: 5, xpReward: 10 },
        { id: 'b', text: 'Fue perfecto así', consequence: 'Pudiste haber ganado más invirtiendo.', nextStepId: 'm002_s3', isCorrect: false, coinsReward: 3, xpReward: 5 },
      ]},
      { id: 'm002_s2b', narrative: '¡Buena estrategia! Ahorraste $90 y tus $30 en MOONCO crecieron a $45. ¡Tienes $135! Entradas ($120) + camiseta ($15).', options: [
        { id: 'a', text: '¡Invertir es genial! Seguiré haciéndolo', consequence: 'El interés compuesto es tu mejor amigo.', nextStepId: 'm002_s3', isCorrect: true, coinsReward: 15, xpReward: 25 },
        { id: 'b', text: 'Fue suerte, mejor solo ahorrar', consequence: 'Invertir tiene riesgo pero a largo plazo da frutos.', nextStepId: 'm002_s3', isCorrect: false, coinsReward: 5, xpReward: 10 },
      ]},
      { id: 'm002_s2c', narrative: 'Pediste prestado $120 al 10% de interés. Pagaste $132. Las deudas salen caras.', options: [
        { id: 'a', text: 'Nunca más pediré prestado', consequence: '¡Buena lección!', nextStepId: 'm002_s3', isCorrect: true, coinsReward: 5, xpReward: 10 },
        { id: 'b', text: 'Valió la pena', consequence: 'El concierto fue increíble pero pagaste de más.', nextStepId: 'm002_s3', isCorrect: false, coinsReward: 2, xpReward: 5 },
      ]},
      { id: 'm002_s3', narrative: 'Fin. Aprendiste que ahorrar es bueno pero invertir puede hacer tu dinero crecer. El interés compuesto es como una bola de nieve.', options: []},
    ],
  },
  {
    id: 'm003', title: 'La Tienda de Cómics', description: 'Invierte en el negocio de tus sueños.',
    icon: '🚀', order: 3, conceptLearned: 'Riesgo, diversificación y emprendimiento',
    steps: [
      { id: 'm003_s1', narrative: 'Tu amiga Val quiere abrir una tienda de cómics. Necesita $500. Tú tienes $300 ahorrados. Te ofrece ser socio.', options: [
        { id: 'a', text: 'Invertir todos tus $300', consequence: 'Mucho riesgo si no funciona...', nextStepId: 'm003_s2a', isCorrect: false, coinsReward: 5, xpReward: 10 },
        { id: 'b', text: 'Invertir $150 y guardar $150', consequence: '¡Diversificaste el riesgo!', nextStepId: 'm003_s2b', isCorrect: true, coinsReward: 12, xpReward: 22 },
        { id: 'c', text: 'No invertir, solo ir a comprar', consequence: 'Te pierdes la oportunidad.', nextStepId: 'm003_s2c', isCorrect: false, coinsReward: 3, xpReward: 5 },
      ]},
      { id: 'm003_s2a', narrative: 'Invertiste todo. La tienda abre lento las primeras semanas. Val está estresada.', options: [
        { id: 'a', text: 'Sacar tu dinero ahora', consequence: 'Pierdes porque recién empieza.', nextStepId: 'm003_s3', isCorrect: false, coinsReward: 2, xpReward: 5 },
        { id: 'b', text: 'Tener paciencia y ayudar', consequence: '¡La paciencia paga!', nextStepId: 'm003_s3', isCorrect: true, coinsReward: 8, xpReward: 15 },
      ]},
      { id: 'm003_s2b', narrative: 'Invertiste $150. La tienda abre con evento de cómics gratis. ¡Llega mucha gente! El negocio despega.', options: [
        { id: 'a', text: 'Reinvertir ganancias en más cómics', consequence: 'El negocio crece y tu parte también.', nextStepId: 'm003_s3', isCorrect: true, coinsReward: 15, xpReward: 25 },
        { id: 'b', text: 'Retirar ganancias y celebrar', consequence: 'Pudiste ganar más a largo plazo.', nextStepId: 'm003_s3', isCorrect: false, coinsReward: 5, xpReward: 10 },
      ]},
      { id: 'm003_s2c', narrative: 'No invertiste. La tienda de Val es un éxito. Ves a los clientes felices y piensas "pude haber sido parte".', options: [
        { id: 'a', text: 'Ofrecer ayuda para participar ahora', consequence: 'Nunca es tarde. Tu participación será menor.', nextStepId: 'm003_s3', isCorrect: true, coinsReward: 5, xpReward: 10 },
        { id: 'b', text: 'Abrir tu propio negocio', consequence: 'Emprender también es válido.', nextStepId: 'm003_s3', isCorrect: false, coinsReward: 3, xpReward: 5 },
      ]},
      { id: 'm003_s3', narrative: 'Fin. Aprendiste que invertir tiene riesgo, pero no invertir también tiene un costo de oportunidad. La clave: diversificar y tener paciencia.', options: []},
    ],
  },
];
