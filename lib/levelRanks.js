// ─────────────────────────────────────────────────────
//  LevelRanks — Sistema de categorías por nivel
//  100 rangos temáticos de anime/fantasía
//  Cada rango cubre un bloque de 5 niveles
// ─────────────────────────────────────────────────────

const RANKS = [
  // ── BLOQUE 1: Mortales comunes (Niveles 1–25) ─────────
  { min: 1,   max: 5,   title: 'Aldeano Sin Clase',    emoji: '🌾' },
  { min: 6,   max: 10,  title: 'Aspirante',            emoji: '📜' },
  { min: 11,  max: 15,  title: 'Aprendiz de Magia',    emoji: '🔮' },
  { min: 16,  max: 20,  title: 'Iniciado del Clan',    emoji: '🏯' },
  { min: 21,  max: 25,  title: 'Genin',                emoji: '🍃' },

  // ── BLOQUE 2: Combatientes en ascenso (Niveles 26–50) ─
  { min: 26,  max: 30,  title: 'Cazador Rango E',      emoji: '🗡️' },
  { min: 31,  max: 35,  title: 'Espadachín Novel',     emoji: '⚔️' },
  { min: 36,  max: 40,  title: 'Chunin',               emoji: '🌀' },
  { min: 41,  max: 45,  title: 'Mago de Batalla',      emoji: '🧙' },
  { min: 46,  max: 50,  title: 'Guerrero Mercenario',  emoji: '💰' },

  // ── BLOQUE 3: Clase intermedia (Niveles 51–75) ────────
  { min: 51,  max: 55,  title: 'Cazador Rango D',      emoji: '🔱' },
  { min: 56,  max: 60,  title: 'Nigromante Aprendiz',  emoji: '💀' },
  { min: 61,  max: 65,  title: 'Jonin',                emoji: '🌪️' },
  { min: 66,  max: 70,  title: 'Mago de Gremio',       emoji: '🏰' },
  { min: 71,  max: 75,  title: 'Caballero de Bronce',  emoji: '🛡️' },

  // ── BLOQUE 4: Clase avanzada (Niveles 76–100) ─────────
  { min: 76,  max: 80,  title: 'Cazador Rango C',      emoji: '⚡' },
  { min: 81,  max: 85,  title: 'Invocador de Bestias', emoji: '🐉' },
  { min: 86,  max: 90,  title: 'Samurái del Clan',     emoji: '🀄' },
  { min: 91,  max: 95,  title: 'Maestro Espadachín',   emoji: '🌸' },
  { min: 96,  max: 100, title: 'Caballero de Plata',   emoji: '🪬' },

  // ── BLOQUE 5: Élite de la humanidad (101–125) ─────────
  { min: 101, max: 105, title: 'Cazador Rango B',      emoji: '🔥' },
  { min: 106, max: 110, title: 'Comandante de Legión', emoji: '⚜️' },
  { min: 111, max: 115, title: 'Alquimista de Estado', emoji: '⚗️' },
  { min: 116, max: 120, title: 'Espectro de la Niebla',emoji: '🌫️' },
  { min: 121, max: 125, title: 'Caballero de Oro',     emoji: '🌟' },

  // ── BLOQUE 6: Leyendas vivientes (126–150) ────────────
  { min: 126, max: 130, title: 'Cazador Rango A',      emoji: '🦅' },
  { min: 131, max: 135, title: 'Anbu de las Sombras',  emoji: '🖤' },
  { min: 136, max: 140, title: 'Conjurador Arcano',    emoji: '🌙' },
  { min: 141, max: 145, title: 'Héroe del Continente', emoji: '🏆' },
  { min: 146, max: 150, title: 'Paladín Sagrado',      emoji: '✝️' },

  // ── BLOQUE 7: Semihéroes (151–175) ───────────────────
  { min: 151, max: 155, title: 'Cazador Rango S',      emoji: '💠' },
  { min: 156, max: 160, title: 'Maestro de los Pilares',emoji: '🔭' },
  { min: 161, max: 165, title: 'Shinigami',            emoji: '⚰️' },
  { min: 166, max: 170, title: 'Portador del Sharingan',emoji: '👁️' },
  { min: 171, max: 175, title: 'Titan de la Aurora',   emoji: '☀️' },

  // ── BLOQUE 8: Semidioses (176–200) ───────────────────
  { min: 176, max: 180, title: 'Cazador Rango SS',     emoji: '🌠' },
  { min: 181, max: 185, title: 'Arcanista del Vacío',  emoji: '🕳️' },
  { min: 186, max: 190, title: 'Portador del Sage Mode',emoji: '🐸' },
  { min: 191, max: 195, title: 'Demonio de Rango Alto',emoji: '😈' },
  { min: 196, max: 200, title: 'Espada Sagrada',       emoji: '🗡️' },

  // ── BLOQUE 9: Deidades menores (201–225) ─────────────
  { min: 201, max: 205, title: 'Portador del Bankai',  emoji: '🌑' },
  { min: 206, max: 210, title: 'Mago del Gremio S',    emoji: '🔴' },
  { min: 211, max: 215, title: 'Calamidad del Mundo',  emoji: '🌊' },
  { min: 216, max: 220, title: 'General del Infierno', emoji: '🔱' },
  { min: 221, max: 225, title: 'Espíritu Ancestral',   emoji: '👻' },

  // ── BLOQUE 10: Divinidades (226–250) ─────────────────
  { min: 226, max: 230, title: 'Ángel Caído',          emoji: '🕊️' },
  { min: 231, max: 235, title: 'Dragón Divino',        emoji: '🐲' },
  { min: 236, max: 240, title: 'Portador del Infinity',emoji: '♾️' },
  { min: 241, max: 245, title: 'Dios del Purgatorio',  emoji: '🩸' },
  { min: 246, max: 250, title: 'Kami de Guerra',       emoji: '⚡' },

  // ── BLOQUE 11: Trascendentes (251–275) ───────────────
  { min: 251, max: 255, title: 'Señor de los Espíritus',emoji: '🌌' },
  { min: 256, max: 260, title: 'Celestial de Oro',     emoji: '✨' },
  { min: 261, max: 265, title: 'Arcángel Supremo',     emoji: '👼' },
  { min: 266, max: 270, title: 'Dios del Caos',        emoji: '🌀' },
  { min: 271, max: 275, title: 'Portador del Ultra Instinct', emoji: '⚪' },

  // ── BLOQUE 12: Soberanos (276–300) ───────────────────
  { min: 276, max: 280, title: 'Soberano de las Tinieblas', emoji: '🖤' },
  { min: 281, max: 285, title: 'Dios del Tiempo',      emoji: '⏳' },
  { min: 286, max: 290, title: 'Monarca del Abismo',   emoji: '🕳️' },
  { min: 291, max: 295, title: 'Portador del Yami',    emoji: '🌑' },
  { min: 296, max: 300, title: 'Señor de Todas las Magias', emoji: '🔮' },

  // ── BLOQUE 13: Cósmicos (301–325) ────────────────────
  { min: 301, max: 305, title: 'Destructor de Mundos', emoji: '💥' },
  { min: 306, max: 310, title: 'Guardián del Cosmos',  emoji: '🪐' },
  { min: 311, max: 315, title: 'Dios de la Creación',  emoji: '🌍' },
  { min: 316, max: 320, title: 'Señor del Multiverso', emoji: '🌐' },
  { min: 321, max: 325, title: 'Dios de la Destrucción',emoji: '💢' },

  // ── BLOQUE 14: Absolutos (326–350) ───────────────────
  { min: 326, max: 330, title: 'Primer Ancestro',      emoji: '🦇' },
  { min: 331, max: 335, title: 'Fundador del Universo',emoji: '🌠' },
  { min: 336, max: 340, title: 'Portador del Truth',   emoji: '👁️' },
  { min: 341, max: 345, title: 'Ente Primordial',      emoji: '🐚' },
  { min: 346, max: 350, title: 'Ser Sin Nombre',       emoji: '❓' },

  // ── BLOQUE 15: Más allá del concepto (351–375) ───────
  { min: 351, max: 355, title: 'Árbol del Mundo',      emoji: '🌳' },
  { min: 356, max: 360, title: 'Madre de los Chakras', emoji: '🌿' },
  { min: 361, max: 365, title: 'Rikudo Sennin',        emoji: '☯️' },
  { min: 366, max: 370, title: 'Hagoromo Otsutsuki',   emoji: '🌕' },
  { min: 371, max: 375, title: 'Kaguya Otsutsuki',     emoji: '🐰' },

  // ── BLOQUE 16: Presencias antiguas (376–400) ─────────
  { min: 376, max: 380, title: 'Primer Mago del Mundo',emoji: '📿' },
  { min: 381, max: 385, title: 'Dios Mazmorra',        emoji: '🏛️' },
  { min: 386, max: 390, title: 'Soberano de los Mazungos',emoji: '🌊' },
  { min: 391, max: 395, title: 'Portador del Nen Absoluto',emoji: '🔑' },
  { min: 396, max: 400, title: 'Ser del Más Allá',     emoji: '🌫️' },

  // ── BLOQUE 17: Existencias imposibles (401–425) ──────
  { min: 401, max: 405, title: 'Concepto Viviente',    emoji: '💭' },
  { min: 406, max: 410, title: 'Paradoja Eterna',      emoji: '♻️' },
  { min: 411, max: 415, title: 'Vacío Absoluto',       emoji: '🌑' },
  { min: 416, max: 420, title: 'Luz Primordial',       emoji: '☀️' },
  { min: 421, max: 425, title: 'Llama del Origen',     emoji: '🔥' },

  // ── BLOQUE 18: Omnipotentes menores (426–450) ────────
  { min: 426, max: 430, title: 'Señor del Destino',    emoji: '🎲' },
  { min: 431, max: 435, title: 'Escritor del Fatum',   emoji: '📖' },
  { min: 436, max: 440, title: 'Guardián de la Eternidad',emoji: '⏰' },
  { min: 441, max: 445, title: 'Dios Olvidado',        emoji: '📿' },
  { min: 446, max: 450, title: 'Existencia Sin Igual', emoji: '🌟' },

  // ── BLOQUE 19: Omnipotentes supremos (451–475) ────────
  { min: 451, max: 455, title: 'Señor del Fin',        emoji: '💀' },
  { min: 456, max: 460, title: 'Dios del Principio',   emoji: '🌅' },
  { min: 461, max: 465, title: 'El Que No Puede Morir',emoji: '♾️' },
  { min: 466, max: 470, title: 'Portador de Todo',     emoji: '🌌' },
  { min: 471, max: 475, title: 'El Creador Absoluto',  emoji: '✨' },

  // ── BLOQUE 20: El Pinnacle (476–500+) ────────────────
  { min: 476, max: 480, title: 'Dios Primordial',      emoji: '👑' },
  { min: 481, max: 485, title: 'Divinidad Sin Forma',  emoji: '🪷' },
  { min: 486, max: 490, title: 'El Ser Más Alto',      emoji: '🏰' },
  { min: 491, max: 495, title: 'Trascendencia Pura',   emoji: '💫' },
  { min: 496, max: Infinity, title: 'ISEKAI GOD',      emoji: '🌠' },
]

/**
 * Retorna el rango de un nivel dado.
 * @param {number} level
 * @returns {{ title: string, emoji: string, min: number, max: number }}
 */
export function getLevelRank(level) {
  const lv = Math.max(1, Math.floor(level) || 1)
  const found = RANKS.find(r => lv >= r.min && lv <= r.max)
  return found || RANKS[RANKS.length - 1]
}

/**
 * Retorna el texto formateado del rango para mensajes.
 * @param {number} level
 * @returns {string}  ej: "⚔️ Espadachín Novel (Nv. 33)"
 */
export function getRankLabel(level) {
  const r = getLevelRank(level)
  return `${r.emoji} ${r.title} (Nv. ${level})`
}

export default { getLevelRank, getRankLabel, RANKS }
