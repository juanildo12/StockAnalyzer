import type { ShopItem } from '../types';

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'skin_classic', name: 'Toro Clásico', description: 'El Toro original, fuerte y elegante.', category: 'skin', price: 0, icon: '🐂', rarity: 'comun' },
  { id: 'skin_gold', name: 'Toro Dorado', description: 'Brilla como el oro... porque es oro.', category: 'skin', price: 500, icon: '🐃', rarity: 'raro' },
  { id: 'skin_ninja', name: 'Toro Ninja', description: 'Sigiloso y letal en los mercados.', category: 'skin', price: 1200, icon: '🥷', rarity: 'epico' },
  { id: 'skin_summit', name: 'Toro Alpinista', description: 'Listo para escalar los picos más altos del mercado.', category: 'skin', price: 1000, icon: '🏔️', rarity: 'raro' },
  { id: 'skin_crypto', name: 'Toro Cyber', description: 'Del futuro. O del pasado. Es confuso.', category: 'skin', price: 2000, icon: '🤖', rarity: 'legendario' },
  { id: 'skin_beach', name: 'Toro Playa', description: 'Relajado mientras otros se estresan.', category: 'skin', price: 800, icon: '🏖️', rarity: 'comun' },
  { id: 'theme_classic', name: 'Tema Clásico', description: 'Azul oscuro, el favorito de todos.', category: 'theme', price: 0, icon: '🌙', rarity: 'comun' },
  { id: 'theme_dark', name: 'Tema Oscuro', description: 'Para traders nocturnos.', category: 'theme', price: 0, icon: '🌚', rarity: 'comun' },
  { id: 'theme_forest', name: 'Tema Bosque', description: 'Verde y natural. Como tus ganancias.', category: 'theme', price: 300, icon: '🌲', rarity: 'raro' },
  { id: 'theme_sunset', name: 'Tema Atardecer', description: 'Colores cálidos para tu pantalla.', category: 'theme', price: 300, icon: '🌅', rarity: 'raro' },
  { id: 'theme_neon', name: 'Tema Neón', description: 'Luces de neón. Late night trading.', category: 'theme', price: 600, icon: '💜', rarity: 'epico' },
  { id: 'theme_ocean', name: 'Tema Océano', description: 'Tranquilo como el mar en calma.', category: 'theme', price: 400, icon: '🌊', rarity: 'raro' },
  { id: 'powerup_xp_boost', name: 'XP Boost x2', description: 'Doble XP por 30 minutos.', category: 'powerup', price: 150, icon: '⚡', rarity: 'epico' },
  { id: 'powerup_shield', name: 'Escudo de Pérdidas', description: 'Protege una pérdida grande (una vez).', category: 'powerup', price: 300, icon: '🛡️', rarity: 'legendario' },
  { id: 'powerup_skip', name: 'Skip Quiz', description: 'Salta una pregunta sin perder racha.', category: 'powerup', price: 100, icon: '⏭️', rarity: 'epico' },
  { id: 'powerup_multi', name: 'Multiplicador de Coins', description: 'Ganas 2x coins por 10 compras.', category: 'powerup', price: 250, icon: '🎰', rarity: 'legendario' },
  { id: 'trinket_horseshoe', name: 'Herradura de la Suerte', description: '¿Suerte? Tal vez no. Pero se ve bien en tu perfil.', category: 'trinket', price: 200, icon: '🧲', rarity: 'raro' },
  { id: 'trinket_glasses', name: 'Lentes de Trader', description: 'Te ves inteligente. Eso cuenta.', category: 'trinket', price: 250, icon: '👓', rarity: 'raro' },
  { id: 'trinket_crown', name: 'Corona de Toro', description: 'Porque eres el rey del mercado.', category: 'trinket', price: 500, icon: '👑', rarity: 'epico' },
];

export const SKINS = SHOP_ITEMS.filter(i => i.category === 'skin');
export const THEMES = SHOP_ITEMS.filter(i => i.category === 'theme');
