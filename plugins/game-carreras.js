// Juego: CARRERA DE AUTOS - Versión Mejorada con Bot Automático (Derecha a Izquierda - CORREGIDO)
import { delay } from "@whiskeysockets/baileys"

// --- CONSTANTES Y CONFIGURACIÓN ---
const carreras = {} // Estado en memoria para carreras activas por chat
const MIN_APUESTA = 50
const MAX_APUESTA = 50000
const EMOJIS_VALIDOS = ["🚗", "🚕", "🚙", "🏎️", "🚓", "🚚"]
const META_DISTANCIA = 15 // Longitud visual de la pista
const TIEMPO_ESPERA_UNION = 25000 // 25 segundos para unirse
const DELAY_ANIMACION = 1200 // Delay entre frames
const PISTA_EMOJI = "█"
const ESPACIO_VACIO = "░"
const META_EMOJI = "🏁"
const PRECIO_GANANCIA = 2.5 // Multiplicador (x2.5)
const MIN_CARRILES = 2 // Mínimo de autos en carrera

// --- HANDLER PRINCIPAL ---
let handler = async (m, { conn, text, command, args }) => {
  const chatId = m.chat
  const userId = m.sender
  const userData = global.db.data.users[userId]

  // Inicializar user si no existe
  if (!userData.carrera) {
    userData.carrera = {
      juegos: 0,
      victorias: 0,
      perdidas: 0,
      gananciasTotal: 0,
      perdidasTotal: 0
    }
  }

  // --- COMANDOS AUXILIARES ---
  if (text.toLowerCase() === 'stats') {
    return mostrarStats(m, conn, userId)
  }

  if (text.toLowerCase() === 'ayuda' || text.toLowerCase() === 'reglas') {
    return mostrarAyuda(m, conn, command)
  }

  // --- PARSEAR ENTRADA ---
  const partes = text.trim().split(' ')
  const emojiSeleccionado = partes[0]
  const apuestaStr = partes[1]
  const apuesta = parseInt(apuestaStr)

  // Validaciones
  if (!emojiSeleccionado || !EMOJIS_VALIDOS.includes(emojiSeleccionado)) {
    return conn.reply(m.chat, `
❌ *Vehículo no válido*

📌 *Usa:* ${command} <emoji> <apuesta>

*Ejemplo:*
${command} 🚗 500

*Vehículos disponibles:*
${EMOJIS_VALIDOS.join(" ")}

*Límites:*
Mín: ${MIN_APUESTA} | Máx: ${MAX_APUESTA} coins

🏆 *Gana x${PRECIO_GANANCIA}* tu apuesta
    `, m)
  }

  if (isNaN(apuesta) || apuesta < MIN_APUESTA || apuesta > MAX_APUESTA) {
    return m.reply(`❌ *Apuesta inválida*\n\nMínimo: ${MIN_APUESTA}\nMáximo: ${MAX_APUESTA}`)
  }

  if (!Number.isInteger(apuesta)) {
    return m.reply('❌ *Las apuestas no pueden tener decimales*')
  }

  const coinsActuales = userData.coin || 0
  if (coinsActuales < apuesta) {
    return m.reply(`❌ *Fondos insuficientes*\n\n💰 Tienes: ${coinsActuales} coins\n📊 Necesitas: ${apuesta} coins`)
  }

  // --- CREAR O UNIRSE A CARRERA ---
  if (!carreras[chatId] || carreras[chatId].finalizada) {
    await crearCarrera(chatId, conn, m)
    await delay(500)
  }

  const carrera = carreras[chatId]

  if (!carrera || carrera.creando) {
    return m.reply('⏳ Se está creando una carrera, espera un momento...')
  }

  if (carrera.enCurso) {
    return m.reply('⚠️ La carrera ya comenzó. ¡Espera a la siguiente!')
  }

  if (carrera.jugadores[userId]) {
    return m.reply(`⚠️ Ya estás participando con ${carrera.jugadores[userId].emoji}`)
  }

  // --- RESTAR APUESTA Y AÑADIR JUGADOR ---
  userData.coin -= apuesta
  const nombre = m.pushName || userId.split('@')[0]

  carrera.jugadores[userId] = {
    emoji: emojiSeleccionado,
    apuesta,
    nombre,
    gano: false,
    esBot: false
  }

  // Notificar unión
  await conn.reply(m.chat, `✅ *${nombre}* se une con ${emojiSeleccionado} apostando *${apuesta}* coins!`, m)

  // Actualizar mensaje de espera
  if (carrera.mensajeKey) {
    await actualizarMensajeEspera(conn, chatId, carrera)
  }
}

// --- CREAR CARRERA ---
async function crearCarrera(chatId, conn, m) {
  carreras[chatId] = {
    jugadores: {},
    enCurso: false,
    finalizada: false,
    mensajeKey: null,
    creando: true,
    timeoutId: null
  }

  const mensaje = `
${META_EMOJI} *¡NUEVA CARRERA INICIADA!* ${META_EMOJI}

⏱️ *${TIEMPO_ESPERA_UNION / 1000} segundos para unirse*

*Cómo participar:*
.carrera <emoji> <apuesta>

*Vehículos:*
${EMOJIS_VALIDOS.join(" ")}

*Premio:* x${PRECIO_GANANCIA} tu apuesta

*Participantes:* 0
_Esperando..._ ⏳
  `.trim()

  const { key } = await conn.sendMessage(chatId, { text: mensaje }, { quoted: m })
  carreras[chatId].mensajeKey = key
  carreras[chatId].creando = false

  // Iniciar carrera después del tiempo
  carreras[chatId].timeoutId = setTimeout(() => iniciarCarrera(chatId, conn, m), TIEMPO_ESPERA_UNION)
}

// --- ACTUALIZAR MENSAJE DE ESPERA ---
async function actualizarMensajeEspera(conn, chatId, carrera) {
  if (!carrera || !carrera.mensajeKey || carrera.enCurso || carrera.finalizada) return

  const participantes = Object.entries(carrera.jugadores)
  let listadoParticipantes = '_Esperando..._ ⏳'

  if (participantes.length > 0) {
    listadoParticipantes = participantes
      .map(([_, data]) => `> ${data.emoji} *${data.nombre}* (${data.apuesta} coins)`)
      .join('\n')
  }

  const textoActualizado = `
${META_EMOJI} *¡CARRERA POR COMENZAR!* ${META_EMOJI}

⏱️ *${TIEMPO_ESPERA_UNION / 1000} segundos para unirse*

*Cómo participar:*
> .carrera <emoji> <apuesta>

*Vehículos:*
> ${EMOJIS_VALIDOS.join(" ")}

*Premio:* x${PRECIO_GANANCIA} tu apuesta

*Participantes: ${participantes.length}*
${listadoParticipantes}
  `.trim()

  try {
    await conn.relayMessage(chatId, {
      protocolMessage: {
        key: carrera.mensajeKey,
        type: 14,
        editedMessage: { conversation: textoActualizado }
      }
    }, {})
  } catch (e) {
    console.error("Error actualizando mensaje de espera:", e)
  }
}

// --- INICIAR CARRERA ---
async function iniciarCarrera(chatId, conn, m) {
  const carrera = carreras[chatId]

  if (carrera?.timeoutId) {
    clearTimeout(carrera.timeoutId)
    carrera.timeoutId = null
  }

  if (!carrera || Object.keys(carrera.jugadores).length === 0) {
    try {
      await conn.relayMessage(chatId, {
        protocolMessage: {
          key: carrera?.mensajeKey,
          type: 14,
          editedMessage: { conversation: "🚫 *Carrera cancelada.* No hubo participantes." }
        }
      }, {})
    } catch (e) {
      conn.reply(chatId, "🚫 *Carrera cancelada.* No hubo participantes.", m)
    }
    delete carreras[chatId]
    return
  }

  carrera.enCurso = true

  // --- AGREGAR BOT AUTOMÁTICO SI HAY MENOS DE 2 JUGADORES ---
  if (Object.keys(carrera.jugadores).length < MIN_CARRILES) {
    const emojiDisponibles = EMOJIS_VALIDOS.filter(emoji =>
      !Object.values(carrera.jugadores).some(j => j.emoji === emoji)
    )

    if (emojiDisponibles.length > 0) {
      const emojiBot = emojiDisponibles[Math.floor(Math.random() * emojiDisponibles.length)]
      const botId = `bot_${chatId}_${Date.now()}`

      carrera.jugadores[botId] = {
        emoji: emojiBot,
        apuesta: 0, // El bot no apuesta
        nombre: '🤖 Bot',
        gano: false,
        esBot: true
      }

      await conn.reply(chatId, `🤖 *Bot automático añadido: ${emojiBot}*\n\n¡Ahora la carrera puede comenzar!`, m)
    }
  }

  // --- LÓGICA DE RENDERIZADO DE CARRIL (DERECHA A IZQUIERDA) CORREGIDA ---
  const renderCarril = (emoji, posicion) => {
    // Asegurarnos de que la posición no sea menor a 0 para evitar errores en .repeat()
    const posActual = Math.max(0, posicion)

    // Pista restante (░) va entre la meta y el auto. Disminuye conforme se acerca a 0.
    const pistaRestante = ESPACIO_VACIO.repeat(posActual)

    // Pista recorrida (█) va detrás del auto (a la derecha). Aumenta conforme avanza.
    const pistaRecorrida = PISTA_EMOJI.repeat(META_DISTANCIA - posActual)

    if (posActual === 0) {
      // El auto llegó a la meta. Se muestra la bandera, el auto y toda la estela detrás.
      return `${META_EMOJI}${emoji}${pistaRecorrida}`
    }

    // El auto en movimiento
    return `${META_EMOJI}${pistaRestante}${emoji}${pistaRecorrida}`
  }

  // --- INICIALIZAR POSICIONES ---
  // Todos comienzan con posición 15 (lado derecho, lejos de la meta)
  let posiciones = {}
  for (const [userId, data] of Object.entries(carrera.jugadores)) {
    posiciones[userId] = META_DISTANCIA
  }

  let ganador = null
  let frame = 0

  // Mensaje inicial
  const renderCarrera = () => {
    let texto = ''
    for (const [userId, data] of Object.entries(carrera.jugadores)) {
      texto += `| ${renderCarril(data.emoji, posiciones[userId])}\n`
    }
    return texto
  }

  const textoInicio = `
🚦 *¡LA CARRERA COMIENZA!* 🚦
META ← ← ← DIRECCIÓN

${renderCarrera()}

${Object.values(carrera.jugadores).map(j => `${j.emoji} ${j.nombre}`).join(' • ')}
  `.trim()

  // Borrar mensaje anterior
  if (carrera.mensajeKey) {
    try {
      await conn.sendMessage(chatId, { delete: carrera.mensajeKey })
    } catch (e) { }
  }

  const { key } = await conn.sendMessage(chatId, { text: textoInicio }, { quoted: m })

  // --- BUCLE PRINCIPAL DE CARRERA ---
  try {
    while (!ganador) {
      await delay(DELAY_ANIMACION)

      // Avance de cada vehículo (decrementar posición = avanzar hacia la izquierda/meta)
      for (const userId of Object.keys(carrera.jugadores)) {
        if (!ganador && posiciones[userId] > 0) {
          const avance = Math.floor(Math.random() * 3) + 1 // 1-3
          posiciones[userId] = Math.max(0, posiciones[userId] - avance)

          if (posiciones[userId] <= 0) {
            ganador = userId
            carrera.jugadores[userId].gano = true
            break
          }
        }
      }

      if (ganador) break

      // Actualizar frame
      frame++

      const textoProgreso = `
🚦 *CARRERA EN PROGRESO...* 🚦

${renderCarrera()}

Frame: ${frame} ⏱️
      `.trim()

      try {
        await conn.relayMessage(chatId, {
          protocolMessage: {
            key,
            type: 14,
            editedMessage: { conversation: textoProgreso }
          }
        }, {})
      } catch (e) {
        console.error("Error actualizando carrera:", e)
      }
    }

    // --- RESULTADOS ---
    const userData = global.db.data.users
    const ganadorData = carrera.jugadores[ganador]

    let mensajeFinal = `\n🎉 *¡GANÓ ${ganadorData.nombre} CON ${ganadorData.emoji}!* 🎉\n\n`

    let ganadoresInfo = []
    let hayGanadores = false

    for (const [userId, data] of Object.entries(carrera.jugadores)) {
      if (data.gano) {
        // Solo dar premio si no es bot
        if (!data.esBot) {
          const premio = Math.floor(data.apuesta * PRECIO_GANANCIA)
          userData[userId].coin += premio

          ganadoresInfo.push({
            id: userId,
            nombre: data.nombre,
            emoji: data.emoji,
            premio
          })

          mensajeFinal += `💰 *${data.nombre}* gana *${premio}* coins!\n`

          userData[userId].carrera.victorias++
          userData[userId].carrera.gananciasTotal += premio
          hayGanadores = true
        } else {
          // El bot ganó
          mensajeFinal += `🤖 *${data.nombre}* ganó la carrera (no hay premio para bots)\n`
        }
      } else {
        // Solo restar si no es bot
        if (!data.esBot) {
          userData[userId].carrera.perdidas++
          userData[userId].carrera.perdidasTotal += data.apuesta
        }
      }

      // Contar juegos solo para jugadores reales
      if (!data.esBot) {
        userData[userId].carrera.juegos++
      }
    }

    const textoFinal = `
${META_EMOJI} *¡CARRERA FINALIZADA!* ${META_EMOJI}

${renderCarrera()}
${mensajeFinal}
    `.trim()

    try {
      await conn.relayMessage(chatId, {
        protocolMessage: {
          key,
          type: 14,
          editedMessage: { conversation: textoFinal }
        }
      }, {})
    } catch (e) {
      await conn.sendMessage(chatId, { text: textoFinal }, { quoted: m })
    }

  } catch (error) {
    console.error("Error durante carrera:", error)
    conn.reply(chatId, "💥 ¡Error inesperado durante la carrera!", m)
  } finally {
    if (carreras[chatId]) {
      carreras[chatId].finalizada = true
      // Limpiar después de 2 minutos
      setTimeout(() => delete carreras[chatId], 120000)
    }
  }
}

// --- MOSTRAR ESTADÍSTICAS ---
async function mostrarStats(m, conn, userId) {
  const userData = global.db.data.users[userId]
  const stats = userData.carrera || {
    juegos: 0,
    victorias: 0,
    perdidas: 0,
    gananciasTotal: 0,
    perdidasTotal: 0
  }

  const tasaVictoria = stats.juegos > 0
    ? ((stats.victorias / stats.juegos) * 100).toFixed(1)
    : 0

  const saldoNeto = stats.gananciasTotal - stats.perdidasTotal
  const coinsActuales = userData.coin || 0

  const mensaje = `
📊 *ESTADÍSTICAS DE CARRERA* 📊

━━━━━━━━━━━━━━━━━━━━━━
💎 *COINS ACTUALES:* ${coinsActuales}

🏁 *CARRERAS:* ${stats.juegos}
✅ *VICTORIAS:* ${stats.victorias}
❌ *DERROTAS:* ${stats.perdidas}

━━━━━━━━━━━━━━━━━━━━━━

💰 *ANÁLISIS FINANCIERO:*
📈 Ganancias: +${stats.gananciasTotal}
📉 Pérdidas: -${stats.perdidasTotal}
💵 *Saldo Neto: ${saldoNeto > 0 ? '+' : ''}${saldoNeto} coins*

📊 *TASA DE VICTORIA:* ${tasaVictoria}%

${stats.juegos === 0 ? '\n🏎️ ¡Aún no has corrido! Comienza ahora.' : ''}
  `.trim()

  return conn.reply(m.chat, mensaje, m)
}

// --- MOSTRAR AYUDA ---
async function mostrarAyuda(m, conn, command) {
  const mensaje = `
🏁 *CARRERA DE AUTOS - GUÍA* 🏁
━━━━━━━━━━━━━━━━━━━━━━
📋 *OBJETIVO:*
Apuesta en un auto y gana x${PRECIO_GANANCIA} si llega primero a la META.

💰 *CÓMO JUGAR:*
${command} <emoji> <apuesta>

*Ejemplo:*
${command} 🚗 500

🚗 *VEHÍCULOS:*
${EMOJIS_VALIDOS.join(" ")}

━━━━━━━━━━━━━━━━━━━━━━
💰 *APUESTAS:*
Mín: ${MIN_APUESTA} | Máx: ${MAX_APUESTA} coins

✅ GANA: x${PRECIO_GANANCIA}
❌ PIERDE: -apuesta

⏱️ *ESPERA:* ${TIEMPO_ESPERA_UNION / 1000}s para unirse

🤖 *NOTA:* Si solo hay 1 jugador, se añade un Bot automáticamente

📌 *COMANDOS:*
> ${command} stats - Ver estadísticas
> ${command} ayuda - Ver esta guía
━━━━━━━━━━━━━━━━━━━━━━
🍀 *¡Que gane tu auto!* 🍀
  `.trim()

  return conn.reply(m.chat, mensaje, m)
}

handler.help = ['carrera <emoji> <apuesta>']
handler.tags = ['juegos', 'carreras', 'apuestas']
handler.command = ['carrera', 'race']
handler.group = true

export default handler