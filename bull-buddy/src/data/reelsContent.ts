export interface ReelQuiz {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface ReelLesson {
  id: string;
  emoji: string;
  title: string;
  content: string;
  tip: string;
}

export interface ReelSeries {
  id: string;
  title: string;
  icon: string;
  color: string;
  lessons: ReelLesson[];
  quiz: ReelQuiz;
}

export const REEL_SERIES: ReelSeries[] = [
  {
    id: 'que-es-una-accion',
    title: '¿Qué es una acción?',
    icon: '📄',
    color: '#4EC5F1',
    lessons: [
      {
        id: 'accion-definicion',
        emoji: '🏢',
        title: 'Ser dueño de un pedacito',
        content: 'Una acción es como comprar un pedacito de una empresa. Cuando compras una acción de MOONCO, eres dueño de una parte minúscula de la empresa imaginaria MOONCO.',
        tip: '💡 Las empresas venden acciones para conseguir dinero y crecer.',
      },
      {
        id: 'accion-precio',
        emoji: '💰',
        title: '¿Por qué cambia el precio?',
        content: 'El precio de una acción sube y baja según cuánta gente quiera comprar o vender. Si muchos quieren comprar, sube. Si muchos quieren vender, baja. Oferta y demanda.',
        tip: '💡 Es como los cromos: si todos quieren el mismo, sube de precio.',
      },
      {
        id: 'accion-dividendos',
        emoji: '🎁',
        title: 'Ganar sin vender',
        content: 'Algunas empresas reparten parte de sus ganancias entre todos sus dueños (los que tienen acciones). Eso se llama dividendo. ¡Como un regalo por ser dueño!',
        tip: '💡 No todas las empresas pagan dividendos. Algunas prefieren reinvertir.',
      },
      {
        id: 'accion-riesgo',
        emoji: '🎢',
        title: 'Precio que sube y baja',
        content: 'El valor de las acciones puede subir o bajar. Si la empresa va bien, tu acción vale más. Si va mal, vale menos. Por eso es importante no poner todos los huevos en la misma canasta.',
        tip: '💡 Invertir en varias empresas diferentes reduce el riesgo.',
      },
    ],
    quiz: {
      question: '¿Qué representa una acción?',
      options: [
        'Un préstamo que le haces a la empresa',
        'Una parte de la propiedad de la empresa',
        'Un bono que paga intereses',
        'Un producto que vende la empresa',
      ],
      correctIndex: 1,
      explanation: '¡Así es! Una acción representa una pequeña parte de la propiedad de una empresa. Eres dueño de un pedacito.',
    },
  },
  {
    id: 'compra-y-venta',
    title: 'Compra y Venta',
    icon: '🔄',
    color: '#3FD6A0',
    lessons: [
      {
        id: 'comprar-accion',
        emoji: '🛒',
        title: 'Comprar: entrar al juego',
        content: 'Comprar una acción significa que crees que la empresa va a ir bien y su precio subirá. En el simulador de Bull Buddy, usas dinero ficticio para comprar acciones de MOONCO.',
        tip: '💡 En la vida real, compras a través de un "bróker" (una app o sitio web especializado).',
      },
      {
        id: 'vender-accion',
        emoji: '💵',
        title: 'Vender: cobrar ganancias',
        content: 'Vendes tus acciones cuando quieres recuperar tu dinero. Si las vendes más caro de lo que las compraste, ¡tienes ganancia! Si las vendes más barato, tienes pérdida.',
        tip: '💡 "Comprar barato, vender caro" es el objetivo, pero no siempre es fácil.',
      },
      {
        id: 'ordenes-mercado',
        emoji: '⚡',
        title: 'Tipos de órdenes',
        content: 'Una "orden de mercado" compra o vende AL INSTANTE al precio actual. Una "orden límite" solo compra o vende si el precio llega a un valor que tú eliges. Como una oferta.',
        tip: '💡 Las órdenes límite te protegen de pagar más de lo que quieres.',
      },
      {
        id: 'bid-ask',
        emoji: '🤝',
        title: 'El precio de compra y de venta',
        content: 'Siempre hay dos precios: el "bid" (lo que ofrecen los compradores) y el "ask" (lo que piden los vendedores). La diferencia se llama "spread". Entre más gente negocie, menor es el spread.',
        tip: '💡 Las acciones más populares tienen spread más pequeño.',
      },
    ],
    quiz: {
      question: '¿Qué es una "orden de mercado"?',
      options: [
        'Una orden que solo se ejecuta a un precio específico',
        'Una orden que se ejecuta inmediatamente al precio actual',
        'Una orden para comprar en el mercado de frutas',
        'Una orden que dura una semana',
      ],
      correctIndex: 1,
      explanation: '¡Correcto! La orden de mercado se ejecuta de inmediato al mejor precio disponible. Es la forma más rápida de comprar o vender.',
    },
  },
  {
    id: 'diversificacion',
    title: 'Riesgo y Diversificación',
    icon: '🛡️',
    color: '#9B5DE5',
    lessons: [
      {
        id: 'que-es-riesgo',
        emoji: '⚠️',
        title: 'El riesgo de invertir',
        content: 'Invertir siempre tiene riesgo. El precio puede subir o bajar. No hay ninguna inversión 100% segura. Por eso es importante entender cuánto riesgo estás dispuesto a tomar.',
        tip: '💡 "Alta rentabilidad = alto riesgo". Si suena demasiado bueno para ser cierto, probablemente lo es.',
      },
      {
        id: 'diversificar',
        emoji: '🧺',
        title: 'No todos los huevos en la misma canasta',
        content: 'Diversificar significa repartir tu dinero entre diferentes inversiones. Si una va mal, las otras pueden ir bien y compensar. Es como tener un plan B, C y D.',
        tip: '💡 Los inversores expertos tienen acciones de muchos sectores diferentes.',
      },
      {
        id: 'horizonte',
        emoji: '📅',
        title: 'Tiempo: tu mejor aliado',
        content: 'Entre más tiempo dejes tu dinero invertido, menos riesgo corres. El mercado sube y baja a corto plazo, pero a largo plazo (10+ años) tiende a subir. La paciencia es clave.',
        tip: '💡 Warren Buffett dice: "El mercado es un dispositivo para transferir dinero del impaciente al paciente."',
      },
      {
        id: 'perdida',
        emoji: '📉',
        title: 'Perder no es fracasar',
        content: 'Todos los inversores pierden dinero alguna vez. Lo importante es aprender de cada error. Pregúntate: ¿invertí sin investigar? ¿me dejé llevar por la emoción? ¿no diversifiqué?',
        tip: '💡 Las pérdidas son tu mejor maestra. Cada error te hace mejor inversor.',
      },
    ],
    quiz: {
      question: '¿Qué significa diversificar?',
      options: [
        'Invertir todo tu dinero en una sola acción',
        'Repartir tu dinero entre diferentes inversiones',
        'Comprar y vender el mismo día',
        'Guardar el dinero debajo del colchón',
      ],
      correctIndex: 1,
      explanation: '¡Exacto! Diversificar es repartir tu dinero entre varias inversiones para reducir el riesgo. Nunca pongas todos los huevos en la misma canasta.',
    },
  },
  {
    id: 'velas-japonesas',
    title: 'Velas Japonesas',
    icon: '🕯️',
    color: '#FF6B6B',
    lessons: [
      {
        id: 'vela-que-es',
        emoji: '🕯️',
        title: '¿Qué es una vela?',
        content: 'Cada vela en el gráfico representa UN período de tiempo (1 minuto, 1 hora, 1 día...). Muestra 4 datos: precio de apertura, cierre, máximo y mínimo. El cuerpo de la vela es la diferencia entre apertura y cierre.',
        tip: '💡 Vela verde = el precio subió. Vela roja = el precio bajó.',
      },
      {
        id: 'vela-cuerpo',
        emoji: '📊',
        title: 'Cuerpo y mechas',
        content: 'El "cuerpo" de la vela muestra dónde abrió y cerró. Las "mechas" (líneas finas arriba y abajo) muestran el precio más alto y más bajo del período. Una vela sin mecha significa que el precio nunca superó el apertura/cierre.',
        tip: '💡 Velas con mechas largas significan mucha pelea entre compradores y vendedores.',
      },
      {
        id: 'vela-patrones',
        emoji: '🔍',
        title: 'Patrones famosos',
        content: 'Hay patrones de velas que los inversores usan para predecir movimientos. El "martillo" (una vela con mecha larga abajo) puede indicar que el precio va a subir. El "hombre colgado" (mecha larga arriba) puede indicar que va a bajar.',
        tip: '💡 Los patrones no son 100% seguros. Son pistas, no certezas.',
      },
      {
        id: 'vela-tendencias',
        emoji: '📈',
        title: 'Leer la tendencia',
        content: 'Varias velas seguidas que suben forman una "tendencia alcista". Varias que bajan = "tendencia bajista". Cuando ninguna domina, el mercado está "lateraleando" (sin tendencia clara).',
        tip: '💡 "La tendencia es tu amiga" — es más fácil ganar cuando operas a favor de la tendencia.',
      },
    ],
    quiz: {
      question: '¿Qué muestra el cuerpo de una vela japonesa?',
      options: [
        'El precio más alto y más bajo del período',
        'La diferencia entre el precio de apertura y cierre',
        'Cuántas acciones se negociaron',
        'El pronóstico del precio para mañana',
      ],
      correctIndex: 1,
      explanation: '¡Correcto! El cuerpo de la vela muestra la diferencia entre el precio de apertura (donde empezó) y el precio de cierre (donde terminó).',
    },
  },
];
