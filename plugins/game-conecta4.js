// Juego: Conecta 4 - Versión mejorada con IA y detección de victoria
let handler = async (m, { conn, text, command, args }) => {
  const chatData = global.db.data.chats[m.chat]

  // Comando stop para salir
  if (text === 'stop' && chatData.conecta4Active) {
    if (chatData.conecta4Player && chatData.conecta4Player !== m.sender) {
      return m.reply('❌ Solo quien inició el juego puede detenerlo.')
    }
    chatData.conecta4Active = false
    delete chatData.conecta4Tablero
    delete chatData.conecta4MsgKey
    delete chatData.conecta4Turno
    delete chatData.conecta4Player
    return conn.reply(m.chat, '❌ Juego terminado. ¡Gracias por jugar!', m)
  }

  // Si hay un juego activo
  if (chatData.conecta4Active) {
    // Solo el jugador que inició puede jugar
    if (chatData.conecta4Player && chatData.conecta4Player !== m.sender) {
      return m.reply(`❌ @${chatData.conecta4Player.split('@')[0]} está jugando. Espera a que termine.`)
    }
    const columna = parseInt(text) - 1

    // Validaciones
    if (isNaN(columna) || columna < 0 || columna > 6) {
      return m.reply('❌ *Ingresa un número del 1 al 7*')
    }

    const tablero = chatData.conecta4Tablero

    // Verificar si la columna está llena
    if (tablero[0][columna] !== '⬜') {
      return m.reply('❌ *Esa columna está llena, intenta otra*')
    }

    // Colocar ficha del jugador
    for (let i = 5; i >= 0; i--) {
      if (tablero[i][columna] === '⬜') {
        tablero[i][columna] = '🔴'
        break
      }
    }

    // Verificar si el jugador ganó
    if (verificarVictoria(tablero, '🔴')) {
      const mensajeTablero = generarTablero(tablero)
      const stats = chatData.conecta4Stats || { ganancias: 0, derrotas: 0, empates: 0 }
      stats.ganancias++
      chatData.conecta4Stats = stats

      chatData.conecta4Active = false
      delete chatData.conecta4Player
      const msgKey = chatData.conecta4MsgKey

      await conn.sendMessage(m.chat, {
        text: mensajeTablero + `\n\n🎉 *¡GANASTE!* 🎉\n\n📊 *Tu record:* ${stats.ganancias}W - ${stats.derrotas}L - ${stats.empates}E`,
        edit: msgKey
      })
      return
    }

    // Verificar si es empate
    if (tableroLleno(tablero)) {
      const mensajeTablero = generarTablero(tablero)
      const stats = chatData.conecta4Stats || { ganancias: 0, derrotas: 0, empates: 0 }
      stats.empates++
      chatData.conecta4Stats = stats

      chatData.conecta4Active = false
      delete chatData.conecta4Player
      const msgKey = chatData.conecta4MsgKey

      await conn.sendMessage(m.chat, {
        text: mensajeTablero + `\n\n🤝 *¡EMPATE!* 🤝\n\n📊 *Tu record:* ${stats.ganancias}W - ${stats.derrotas}L - ${stats.empates}E`,
        edit: msgKey
      })
      return
    }

    // Turno del bot con IA estratégica
    const columnaBot = obtenerMovimientoBot(tablero)

    for (let i = 5; i >= 0; i--) {
      if (tablero[i][columnaBot] === '⬜') {
        tablero[i][columnaBot] = '🔵'
        break
      }
    }

    // Verificar si el bot ganó
    if (verificarVictoria(tablero, '🔵')) {
      const mensajeTablero = generarTablero(tablero)
      const stats = chatData.conecta4Stats || { ganancias: 0, derrotas: 0, empates: 0 }
      stats.derrotas++
      chatData.conecta4Stats = stats

      chatData.conecta4Active = false
      delete chatData.conecta4Player
      const msgKey = chatData.conecta4MsgKey

      await conn.sendMessage(m.chat, {
        text: mensajeTablero + `\n\n🤖 *¡BOT GANÓ!* 🤖\n\n📊 *Tu record:* ${stats.ganancias}W - ${stats.derrotas}L - ${stats.empates}E`,
        edit: msgKey
      })
      return
    }

    // Verificar si es empate después del turno del bot
    if (tableroLleno(tablero)) {
      const mensajeTablero = generarTablero(tablero)
      const stats = chatData.conecta4Stats || { ganancias: 0, derrotas: 0, empates: 0 }
      stats.empates++
      chatData.conecta4Stats = stats

      chatData.conecta4Active = false
      const msgKey = chatData.conecta4MsgKey

      await conn.sendMessage(m.chat, {
        text: mensajeTablero + `\n\n🤝 *¡EMPATE!* 🤝\n\n📊 *Tu record:* ${stats.ganancias}W - ${stats.derrotas}L - ${stats.empates}E`,
        edit: msgKey
      })
      return
    }

    // Continuar el juego
    const mensajeTablero = generarTablero(tablero) + `\n\n🔴 *Tu turno!*`
    const msgKey = chatData.conecta4MsgKey

    await conn.sendMessage(m.chat, {
      text: mensajeTablero,
      edit: msgKey
    })

    return
  }

  // Iniciar juego
  chatData.conecta4Active = true
  chatData.conecta4Turno = 1
  chatData.conecta4Player = m.sender
  const tablero = Array(6).fill(null).map(() => Array(7).fill('⬜'))
  chatData.conecta4Tablero = tablero

  // Inicializar estadísticas si no existen
  if (!chatData.conecta4Stats) {
    chatData.conecta4Stats = { ganancias: 0, derrotas: 0, empates: 0 }
  }

  const stats = chatData.conecta4Stats
  const mensajeInicio = generarTablero(tablero) + `

🎮 *¡CONECTA 4 INICIADO!* 🎮

*Reglas:*
• Coloca 4 fichas en línea (horizontal, vertical o diagonal)
• Escribe el número de columna (1-7)
• El primer jugador que haga 4 en línea gana

📊 *Tu record:* ${stats.ganancias}W - ${stats.derrotas}L - ${stats.empates}E

👉 *Escribe: ${command} <columna (1-7)>*
❌ *Para salir: ${command} stop*`

  const { key } = await conn.sendMessage(m.chat, { text: mensajeInicio }, { quoted: m })
  chatData.conecta4MsgKey = key
}

/**
 * Verifica si hay una victoria (4 en línea)
 */
function verificarVictoria(tablero, ficha) {
  // Verificar horizontales
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 7; j++) {
      if (j <= 3) {
        if (tablero[i][j] === ficha &&
          tablero[i][j + 1] === ficha &&
          tablero[i][j + 2] === ficha &&
          tablero[i][j + 3] === ficha) {
          return true
        }
      }
    }
  }

  // Verificar verticales
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 7; j++) {
      if (i <= 2) {
        if (tablero[i][j] === ficha &&
          tablero[i + 1][j] === ficha &&
          tablero[i + 2][j] === ficha &&
          tablero[i + 3][j] === ficha) {
          return true
        }
      }
    }
  }

  // Verificar diagonales (arriba-izquierda a abajo-derecha)
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 7; j++) {
      if (i <= 2 && j <= 3) {
        if (tablero[i][j] === ficha &&
          tablero[i + 1][j + 1] === ficha &&
          tablero[i + 2][j + 2] === ficha &&
          tablero[i + 3][j + 3] === ficha) {
          return true
        }
      }
    }
  }

  // Verificar diagonales (abajo-izquierda a arriba-derecha)
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 7; j++) {
      if (i >= 3 && j <= 3) {
        if (tablero[i][j] === ficha &&
          tablero[i - 1][j + 1] === ficha &&
          tablero[i - 2][j + 2] === ficha &&
          tablero[i - 3][j + 3] === ficha) {
          return true
        }
      }
    }
  }

  return false
}

/**
 * Verifica si el tablero está lleno (empate)
 */
function tableroLleno(tablero) {
  for (let j = 0; j < 7; j++) {
    if (tablero[0][j] === '⬜') {
      return false
    }
  }
  return true
}

/**
 * IA del bot: intenta ganar, bloquea al jugador, o elige una columna estratégica
 */
function obtenerMovimientoBot(tablero) {
  // 1. Intentar ganar
  for (let col = 0; col < 7; col++) {
    if (puedeMover(tablero, col)) {
      const tableroTemp = JSON.parse(JSON.stringify(tablero))
      for (let i = 5; i >= 0; i--) {
        if (tableroTemp[i][col] === '⬜') {
          tableroTemp[i][col] = '🔵'
          break
        }
      }
      if (verificarVictoria(tableroTemp, '🔵')) {
        return col
      }
    }
  }

  // 2. Bloquear victoria del jugador
  for (let col = 0; col < 7; col++) {
    if (puedeMover(tablero, col)) {
      const tableroTemp = JSON.parse(JSON.stringify(tablero))
      for (let i = 5; i >= 0; i--) {
        if (tableroTemp[i][col] === '⬜') {
          tableroTemp[i][col] = '🔴'
          break
        }
      }
      if (verificarVictoria(tableroTemp, '🔴')) {
        return col
      }
    }
  }

  // 3. Preferir columnas del centro (estrategia)
  const columnasPreferidas = [3, 2, 4, 1, 5, 0, 6]
  for (let col of columnasPreferidas) {
    if (puedeMover(tablero, col)) {
      return col
    }
  }

  // 4. Si no hay opción, elegir aleatoriamente
  const columnasValidas = []
  for (let col = 0; col < 7; col++) {
    if (puedeMover(tablero, col)) {
      columnasValidas.push(col)
    }
  }

  return columnasValidas[Math.floor(Math.random() * columnasValidas.length)]
}

/**
 * Verifica si se puede mover en una columna
 */
function puedeMover(tablero, columna) {
  return tablero[0][columna] === '⬜'
}

/**
 * Genera el tablero visual
 */
function generarTablero(tablero) {
  let mensaje = '🎮 *CONECTA 4* 🎮\n\n'
  mensaje += '1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣\n'

  tablero.forEach(fila => {
    mensaje += fila.join('') + '\n'
  })

  return mensaje
}

handler.help = ['conecta4 <columna>']
handler.tags = ['juegos']
handler.command = ['conecta4']
handler.group = true

export default handler