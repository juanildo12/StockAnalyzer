# Bull Buddy 🐂

App móvil gamificada que enseña trading en la bolsa de EE.UU. a principiantes de cualquier edad. Construida con React Native / Expo.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | React Native 0.80, Expo SDK 57 |
| Navegación | Expo Router (file-based routing) |
| Estado | Zustand + persist con AsyncStorage |
| Backend | Supabase (Auth, DB, Edge Functions) |
| IA | Claude (Anthropic) vía Supabase Edge Function |
| Animaciones | react-native-reanimated 4 |
| Gráfico velas | react-native-svg |
| Notificaciones | expo-notifications |
| Ads | react-native-google-mobile-ads (child-directed) |
| Sonido | expo-av |
| Tipografía | Baloo 2 (títulos) + Quicksand (texto) |

## Requisitos

- Node.js 20+
- Expo CLI: `npm install -g expo-cli`
- Expo Go (iOS/Android) para pruebas en físico
- (Opcional) Proyecto Supabase para features sociales

## Instalación

```bash
cd bull-buddy
npm install
```

## Configuración de Supabase (opcional)

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Copia `.env` a `.env.local` y completa las variables:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
   ```
3. Ejecuta el schema SQL en `supabase/migrations/001_schema.sql` desde el SQL Editor de Supabase
4. (Opcional) Despliega la Edge Function para el chat con Toro:
   ```bash
   npx supabase functions deploy toro-chat --no-verify-jwt
   ```
   Luego configura `ANTHROPIC_API_KEY` en los secrets del proyecto Supabase.

Sin Supabase configurado, la app funciona completamente offline con datos mock.

## Ejecutar

```bash
# Web
npx expo start --web

# iOS Simulator
npx expo start --ios

# Android Emulator
npx expo start --android

# Escanear con Expo Go (LAN)
npx expo start --lan
```

## Estructura del proyecto

```
bull-buddy/
├── app/                    # Expo Router (rutas)
│   ├── (tabs)/             # Pestañas principales
│   ├── chat/               # Chat con Toro
│   └── modal/              # Modales (racha, logros, tienda, ranking, eventos, amigos)
├── src/
│   ├── screens/            # Componentes de pantalla
│   ├── components/         # Componentes reutilizables
│   ├── store/              # Zustand stores
│   ├── services/           # API calls (Supabase, chat, social)
│   ├── data/               # Contenido estático (quiz, misiones, reels, eventos)
│   ├── utils/              # Utilidades (haptics, achievements, adaptive difficulty)
│   ├── types/              # TypeScript types
│   └── constants/          # Tema visual (colores, fuentes)
├── supabase/
│   ├── functions/toro-chat/ # Edge Function para Claude
│   └── migrations/         # Schema SQL
└── assets/                 # Imágenes, sonidos
```

## Seguridad y compliance infantil

- **API keys**: La clave de Anthropic NUNCA está en el cliente. Se llama desde una Supabase Edge Function.
- **Chat**: El system prompt de Claude tiene guardrails explícitos: nunca habla de inversión real, nunca da consejos financieros, nunca sale del personaje "Toro".
- **Anuncios**: Configurados en modo child-directed (sin personalización, sin tracking), cumpliendo COPPA y Google Play Families.
- **Sin patrones oscuros**: No hay temporizadores de presión, no se culpa al jugador por no volver, los costos en monedas son transparentes.
- **Disclaimer visible**: "Juego educativo. Dinero y acciones ficticios. No es asesoría financiera real."

## Features

- 📊 **Simulador**: Velas OHLC de MOONCO, comprar/vender con dinero virtual
- 🧠 **Aprende**: Quiz con combo system (🔥 aciertos consecutivos = bonus)
- 🍋 **Misión**: Historias tipo "elige tu propia aventura"
- 📱 **Reels**: Micro-lecciones en vertical (TikTok-style)
- 📅 **Racha diaria**: Calendario de 7 días con recompensa creciente
- 🏆 **Logros**: 8+ coleccionables con confetti + toast
- 🛒 **Tienda**: Skins para Toro + temas de color
- 🏅 **Ranking**: Leaderboard global y de amigos
- 🤖 **Chat con Toro**: Compañero IA conversacional (Claude)
- 👥 **Amigos y retos**: Sistema social con desafíos semanales
- 🎪 **Eventos**: Misiones de tiempo limitado con recompensas exclusivas
- 🎬 **Ads recompensados**: 100% opcional, child-directed

## Licencia

Uso educativo. No para distribución comercial sin permiso.
