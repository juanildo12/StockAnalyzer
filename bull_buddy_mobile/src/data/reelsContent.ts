import type { ReelSeries } from '../types';

export const REEL_SERIES: ReelSeries[] = [
  {
    id: 'que-es-una-accion', title: '¿Qué es una acción?', icon: '📄', color: '#4EC5F1',
    lessons: [
      { id: 'accion-def', emoji: '🏢', title: 'Ser dueño de un pedacito', content: 'Una acción es como comprar un pedacito de una empresa. Cuando compras una de MOONCO, eres dueño de una parte minúscula.', tip: '💡 Las empresas venden acciones para conseguir dinero y crecer.' },
      { id: 'accion-precio', emoji: '💰', title: '¿Por qué cambia el precio?', content: 'El precio sube y baja según cuánta gente quiera comprar o vender. Muchos compradores = sube. Muchos vendedores = baja.', tip: '💡 Es como los cromos: si todos quieren el mismo, sube de precio.' },
      { id: 'accion-dividendos', emoji: '🎁', title: 'Ganar sin vender', content: 'Algunas empresas reparten parte de sus ganancias entre sus accionistas. Eso se llama dividendo. ¡Como un regalo por ser dueño!', tip: '💡 No todas pagan dividendos. Algunas reinvierten.' },
      { id: 'accion-riesgo', emoji: '🎢', title: 'Precio que sube y baja', content: 'El valor de las acciones puede subir o bajar. Por eso es importante no poner todos los huevos en la misma canasta.', tip: '💡 Invertir en varias empresas reduce el riesgo.' },
    ],
    quiz: { question: '¿Qué representa una acción?', options: ['Un préstamo a la empresa', 'Una parte de la propiedad', 'Un bono', 'Un producto'], correctIndex: 1, explanation: '¡Así es! Una acción representa una pequeña parte de la propiedad.' },
  },
  {
    id: 'compra-y-venta', title: 'Compra y Venta', icon: '🔄', color: '#3FD6A0',
    lessons: [
      { id: 'comprar', emoji: '🛒', title: 'Comprar: entrar al juego', content: 'Comprar una acción significa que crees que la empresa irá bien y su precio subirá. Usas dinero ficticio en Bull Buddy.', tip: '💡 En la vida real, compras a través de un bróker.' },
      { id: 'vender', emoji: '💵', title: 'Vender: cobrar ganancias', content: 'Vendes cuando quieres recuperar tu dinero. Más caro de lo que compraste = ganancia. Más barato = pérdida.', tip: '💡 "Comprar barato, vender caro" es el objetivo.' },
      { id: 'ordenes', emoji: '⚡', title: 'Tipos de órdenes', content: 'Una "orden de mercado" ejecuta al instante. Una "orden límite" solo ejecuta a un precio que tú eliges.', tip: '💡 Las órdenes límite te protegen de pagar más de lo que quieres.' },
      { id: 'bid-ask', emoji: '🤝', title: 'El precio de compra y venta', content: 'Siempre hay dos precios: "bid" (compradores) y "ask" (vendedores). La diferencia es el "spread".', tip: '💡 Acciones populares tienen spread más pequeño.' },
    ],
    quiz: { question: '¿Qué es una "orden de mercado"?', options: ['Solo a precio específico', 'Se ejecuta al instante al precio actual', 'Para comprar frutas', 'Dura una semana'], correctIndex: 1, explanation: '¡Se ejecuta de inmediato al mejor precio disponible!' },
  },
  {
    id: 'diversificacion', title: 'Riesgo y Diversificación', icon: '🛡️', color: '#9B5DE5',
    lessons: [
      { id: 'riesgo', emoji: '⚠️', title: 'El riesgo de invertir', content: 'Invertir siempre tiene riesgo. El precio puede subir o bajar. No hay inversión 100% segura.', tip: '💡 "Alta rentabilidad = alto riesgo".' },
      { id: 'diversificar', emoji: '🧺', title: 'No todos los huevos en la misma canasta', content: 'Diversificar es repartir tu dinero entre diferentes inversiones. Si una va mal, las otras pueden compensar.', tip: '💡 Los expertos tienen acciones de muchos sectores.' },
      { id: 'horizonte', emoji: '📅', title: 'Tiempo: tu mejor aliado', content: 'A largo plazo (10+ años) el mercado tiende a subir. La paciencia es clave.', tip: '💡 Warren Buffett: "El mercado transfiere dinero del impaciente al paciente."' },
      { id: 'perdida', emoji: '📉', title: 'Perder no es fracasar', content: 'Todos pierden alguna vez. Lo importante es aprender: ¿invertí sin investigar? ¿me dejé llevar por la emoción?', tip: '💡 Las pérdidas son tu mejor maestra.' },
    ],
    quiz: { question: '¿Qué significa diversificar?', options: ['Invertir todo en una acción', 'Repartir en varias inversiones', 'Comprar y vender el mismo día', 'Guardar bajo el colchón'], correctIndex: 1, explanation: '¡Repartir tu dinero reduce el riesgo!' },
  },
  {
    id: 'velas-japonesas', title: 'Velas Japonesas', icon: '🕯️', color: '#FF6B6B',
    lessons: [
      { id: 'vela-que-es', emoji: '🕯️', title: '¿Qué es una vela?', content: 'Cada vela muestra UN período. 4 datos: apertura, cierre, máximo y mínimo. Vela verde = subió. Vela roja = bajó.', tip: '💡 El cuerpo es la diferencia entre apertura y cierre.' },
      { id: 'vela-cuerpo', emoji: '📊', title: 'Cuerpo y mechas', content: 'El "cuerpo" muestra apertura/cierre. Las "mechas" muestran el máximo y mínimo del período.', tip: '💡 Mechas largas = mucha pelea entre compradores y vendedores.' },
      { id: 'vela-patrones', emoji: '🔍', title: 'Patrones famosos', content: 'El "martillo" (mecha larga abajo) puede indicar que subirá. El "hombre colgado" (mecha arriba) que bajará.', tip: '💡 Los patrones son pistas, no certezas.' },
      { id: 'vela-tendencias', emoji: '📈', title: 'Leer la tendencia', content: 'Varias velas subiendo = tendencia alcista. Varias bajando = tendencia bajista. Sin dirección clara = lateral.', tip: '💡 "La tendencia es tu amiga".' },
    ],
    quiz: { question: '¿Qué muestra el cuerpo de una vela?', options: ['Máximo y mínimo', 'Diferencia entre apertura y cierre', 'Volumen negociado', 'Pronóstico'], correctIndex: 1, explanation: 'El cuerpo muestra apertura vs cierre del período.' },
  },
];
