// Juego: WORDLE - Adivina la palabra de 5 letras en 6 intentos
const wordleGames = global.wordleGames || (global.wordleGames = {})

// Banco de palabras en español de 5 letras (sin tildes para facilidad)
const WORDS = [
    'perro', 'gatos', 'mundo', 'fuego', 'playa', 'campo', 'verde', 'negro',
    'golpe', 'dulce', 'claro', 'llano', 'fresa', 'juego', 'comer', 'beber',
    'reina', 'plaza', 'huevo', 'leche', 'queso', 'trigo', 'magia', 'bruja',
    'angel', 'demón', 'motor', 'carro', 'sabor', 'mujer', 'noche', 'sueño',
    'cielo', 'nubes', 'llama', 'tigre', 'locos', 'pizza', 'pecho', 'danza',
    'salsa', 'ritmo', 'disco', 'grupo', 'canto', 'piano', 'fondo', 'bolsa',
    'poder', 'furia', 'luz', 'carne', 'finca', 'volar', 'corte', 'dados',
    'papel', 'lapiz', 'tinta', 'libro', 'mesa', 'silla', 'reloj', 'globo',
    'barco', 'avion', 'tren', 'mango', 'limon', 'cerro', 'coral', 'palma',
    'hielo', 'vapor', 'arena', 'raton', 'pulpo', 'buena', 'feliz', 'plomo',
    'bravo', 'ciego', 'prisa', 'filos', 'dardo', 'lacra', 'grasa', 'crema',
    'soplo', 'mosto', 'torre', 'barro', 'tumba', 'genio', 'miedo', 'selva',
    'ancla', 'casco', 'grito', 'freno', 'bucle', 'truco', 'perno', 'clavo',
    'linea', 'cobro', 'droga', 'rabia', 'brisa', 'chica', 'chico', 'perla',
    'media', 'muslo', 'dueño', 'copia', 'molde', 'forma', 'punto', 'marca',
    'bomba', 'sitio', 'rango', 'lucha', 'duelo', 'honor', 'noble', 'justo',
    'aguas', 'gusto', 'torta', 'brazo', 'diente', 'grano', 'ojera', 'pluma',
    'drama', 'calma', 'opera', 'virus', 'diosa', 'siglo', 'omega', 'delta',
    'karma', 'ninja', 'anime', 'manga', 'otaku', 'ramen', 'sushi', 'bento',
    'titan', 'espía', 'brujo', 'elfo', 'orcos', 'mazo', 'hacha', 'lanza'
]

// Filtrar solo palabras de exactamente 5 letras
const VALID_WORDS = WORDS.filter(w => w.length === 5)

function normalize(str) {
    return str.toLowerCase()
        .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
        .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n')
}

function evaluateGuess(guess, answer) {
    const result = []
    const answerArr = [...answer]
    const guessArr = [...guess]
    const used = new Array(5).fill(false)

    // Primero: marcas verdes (posición correcta)
    for (let i = 0; i < 5; i++) {
        if (guessArr[i] === answerArr[i]) {
            result[i] = '🟩'
            used[i] = true
            guessArr[i] = null
        }
    }

    // Segundo: marcas amarillas (letra correcta, posición incorrecta)
    for (let i = 0; i < 5; i++) {
        if (result[i]) continue
        const idx = answerArr.findIndex((c, j) => !used[j] && c === guessArr[i])
        if (idx !== -1) {
            result[i] = '🟨'
            used[idx] = true
        } else {
            result[i] = '⬛'
        }
    }

    return result
}

function renderBoard(game) {
    let board = '🔤 *W O R D L E* 🔤\n━━━━━━━━━━━━━━━\n\n'

    for (let i = 0; i < 6; i++) {
        if (i < game.guesses.length) {
            const { word, result } = game.guesses[i]
            const letters = [...word.toUpperCase()].map((l, j) => `${result[j]}`)
            board += `${letters.join('')}  ${[...word.toUpperCase()].join(' ')}\n`
        } else {
            board += `⬜⬜⬜⬜⬜  _ _ _ _ _\n`
        }
    }

    board += `\n━━━━━━━━━━━━━━━\n📊 Intento: *${game.guesses.length}/6*`
    return board
}

let handler = async (m, { conn, text, command, usedPrefix }) => {
    const userId = m.sender
    const chatId = m.chat
    const key = `${chatId}_${userId}`
    const sub = (text || '').trim().toLowerCase()

    // Iniciar nuevo juego
    if (!wordleGames[key]) {
        if (sub && sub.length === 5) {
            // Si el usuario ya puso una palabra al iniciar, crear juego y procesar
        } else {
            const answer = VALID_WORDS[Math.floor(Math.random() * VALID_WORDS.length)]
            const game = {
                answer: normalize(answer),
                guesses: [],
                msgKey: null,
                createdAt: Date.now()
            }

            const initialText = renderBoard(game) + `\n\n💡 Adivina la palabra de *5 letras*\n📝 Escribe: *${usedPrefix}wordle <palabra>*`
            const { key: msgKey } = await conn.sendMessage(m.chat, { text: initialText }, { quoted: m })
            game.msgKey = msgKey
            wordleGames[key] = game

            // Auto-expirar en 14 minutos
            setTimeout(() => {
                if (wordleGames[key]) {
                    const g = wordleGames[key]
                    conn.sendMessage(m.chat, {
                        text: renderBoard(g) + `\n\n⏰ *Tiempo agotado*\n🔑 La palabra era: *${g.answer.toUpperCase()}*`,
                        edit: g.msgKey
                    }).catch(() => { })
                    delete wordleGames[key]
                }
            }, 14 * 60 * 1000)

            return
        }
    }

    // Juego activo — procesar intento
    if (!wordleGames[key]) {
        // Crear juego y continuar abajo
        const answer = VALID_WORDS[Math.floor(Math.random() * VALID_WORDS.length)]
        wordleGames[key] = {
            answer: normalize(answer),
            guesses: [],
            msgKey: null,
            createdAt: Date.now()
        }

        const game = wordleGames[key]
        const initialText = renderBoard(game) + `\n\n💡 Adivina la palabra de *5 letras*\n📝 Escribe: *${usedPrefix}wordle <palabra>*`
        const { key: msgKey } = await conn.sendMessage(m.chat, { text: initialText }, { quoted: m })
        game.msgKey = msgKey

        setTimeout(() => {
            if (wordleGames[key]) {
                delete wordleGames[key]
            }
        }, 14 * 60 * 1000)

        if (!sub || sub.length !== 5) return
    }

    const game = wordleGames[key]

    if (!sub || sub.length !== 5) {
        return m.reply(`📝 Escribe una palabra de *exactamente 5 letras*.\nEjemplo: *${usedPrefix}wordle perro*`)
    }

    if (!/^[a-záéíóúñ]+$/i.test(sub)) {
        return m.reply('❌ Solo se permiten letras (sin números ni símbolos).')
    }

    const guess = normalize(sub)
    const result = evaluateGuess(guess, game.answer)

    game.guesses.push({ word: guess, result })

    // Victoria
    if (guess === game.answer) {
        const coins = Math.max(50, 350 - (game.guesses.length - 1) * 50)
        const user = global.db.data.users[userId]
        if (!Number.isFinite(user.coin)) user.coin = 0
        user.coin += coins

        const finalText = renderBoard(game) + `\n\n🎉 *¡CORRECTO!* 🎉\n🔑 Palabra: *${game.answer.toUpperCase()}*\n🪙 Premio: *+${coins} coins* (intento ${game.guesses.length}/6)\n💰 Wallet: *${user.coin}*`

        try {
            if (game.msgKey) await conn.sendMessage(m.chat, { text: finalText, edit: game.msgKey })
            else await conn.sendMessage(m.chat, { text: finalText }, { quoted: m })
        } catch (e) {
            await conn.sendMessage(m.chat, { text: finalText }, { quoted: m })
        }

        delete wordleGames[key]
        return
    }

    // Sin intentos restantes
    if (game.guesses.length >= 6) {
        const finalText = renderBoard(game) + `\n\n💀 *¡SIN INTENTOS!* 💀\n🔑 La palabra era: *${game.answer.toUpperCase()}*`

        try {
            if (game.msgKey) await conn.sendMessage(m.chat, { text: finalText, edit: game.msgKey })
            else await conn.sendMessage(m.chat, { text: finalText }, { quoted: m })
        } catch (e) {
            await conn.sendMessage(m.chat, { text: finalText }, { quoted: m })
        }

        delete wordleGames[key]
        return
    }

    // Continuar juego
    const updatedText = renderBoard(game) + `\n\n💡 Sigue intentando...\n📝 *${usedPrefix}wordle <palabra>*`

    try {
        if (game.msgKey) await conn.sendMessage(m.chat, { text: updatedText, edit: game.msgKey })
        else {
            const { key: newKey } = await conn.sendMessage(m.chat, { text: updatedText }, { quoted: m })
            game.msgKey = newKey
        }
    } catch (e) {
        const { key: newKey } = await conn.sendMessage(m.chat, { text: updatedText }, { quoted: m })
        game.msgKey = newKey
    }
}

handler.help = ['wordle <palabra>']
handler.tags = ['juegos']
handler.command = ['wordle']
handler.group = true

export default handler
