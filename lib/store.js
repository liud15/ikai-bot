import { readFileSync, writeFileSync, existsSync } from 'fs'
import { writeFile as writeFileAsync } from 'fs/promises'

const { initAuthCreds, BufferJSON, proto } = await import('@whiskeysockets/baileys')

// ── Wrapper robusto para groupMetadata con reintentos ─────────────────────────
const _delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function getGroupMetadataWithRetry(conn, chatId, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            // Verificar que el WebSocket esté abierto (readyState === 1)
            if (!conn.ws || conn.ws.readyState !== 1) {
                await _delay(1000 * (i + 1))
                continue
            }
            return await conn.groupMetadata(chatId)
        } catch (e) {
            if (i === retries - 1) return null
            await _delay(1000 * (i + 1))
        }
    }
    return null
}

const boundSockets = new WeakSet()

function bind(conn) {
    if (!conn?.ev) {
        throw new TypeError('store.bind requiere un socket válido')
    }
    if (boundSockets.has(conn)) {
        return conn
    }
    boundSockets.add(conn)
    if (!conn.chats) conn.chats = {}

    // --- RECOLECTOR DE BASURA LRU (Evita Memory Leak de chats) ---
    if (!conn.storeGcInterval) {
        conn.storeGcInterval = setInterval(() => {
            if (!conn.chats) return;
            const chatKeys = Object.keys(conn.chats);
            if (chatKeys.length > 500) {
                // Los keys más antiguos están al principio (orden de inserción en JS)
                const keysToRemove = chatKeys.slice(0, chatKeys.length - 500);
                for (const k of keysToRemove) {
                    delete conn.chats[k];
                }
                console.log(`[Store GC] Purgados ${keysToRemove.length} chats antiguos. Total en memoria: 500`);
            }
        }, 30 * 60 * 1000); // 30 minutos

        // Limpiar el interval si el socket muere
        const gcCleanup = (update) => {
            if (update.connection === 'close' && conn.storeGcInterval) {
                clearInterval(conn.storeGcInterval);
                conn.storeGcInterval = null;
                conn.ev.off('connection.update', gcCleanup);
            }
        };
        conn.ev.on('connection.update', gcCleanup);
    }
    // -------------------------------------------------------------
    function updateNameToDb(contacts) {
        if (!contacts) return
        try {
            contacts = contacts.contacts || contacts
            for (const contact of contacts) {
                const id = conn.decodeJid(contact.id)
                if (!id || id === 'status@broadcast') continue
                let chats = conn.chats[id]
                if (!chats) chats = conn.chats[id] = { ...contact, id }
                conn.chats[id] = {
                    ...chats,
                    ...({
                        ...contact, id, ...(id.endsWith('@g.us') ?
                            { subject: contact.subject || contact.name || chats.subject || '' } :
                            { name: contact.notify || contact.name || chats.name || chats.notify || '' })
                    } || {})
                }
            }
        } catch (e) {
            console.error(e)
        }
    }
    conn.ev.on('contacts.upsert', updateNameToDb)
    conn.ev.on('groups.update', updateNameToDb)
    conn.ev.on('contacts.set', updateNameToDb)
    conn.ev.on('chats.set', async ({ chats }) => {
        try {
            const groups = []
            for (let { id, name, readOnly } of chats) {
                id = conn.decodeJid(id)
                if (!id || id === 'status@broadcast') continue
                const isGroup = id.endsWith('@g.us')
                let chat = conn.chats[id]
                if (!chat) chat = conn.chats[id] = { id }
                chat.isChats = !readOnly
                if (name) chat[isGroup ? 'subject' : 'name'] = name
                if (isGroup) groups.push({ id, chat, name })
            }
            // FIX: Procesar grupos en lotes de 3 con 3s de pausa
            // 200 grupos ÷ 3 = ~67 lotes → ~3.5min (vs rate-limit inmediato)
            const BATCH = 3, PAUSE = 3000
            for (let i = 0; i < groups.length; i += BATCH) {
                const batch = groups.slice(i, i + BATCH)
                await Promise.all(batch.map(async ({ id, chat, name }) => {
                    const metadata = await getGroupMetadataWithRetry(conn, id)
                    if (name || metadata?.subject) chat.subject = name || metadata.subject
                    if (metadata) {
                        chat.metadata = metadata
                        global.groupMetadataCache?.set(id, metadata)
                    }
                }))
                if (i + BATCH < groups.length) await _delay(PAUSE)
            }
        } catch (e) {
            console.error(e)
        }
    })
    conn.ev.on('group-participants.update', async function updateParticipantsToDb({ id, participants, action }) {
        if (!id) return
        id = conn.decodeJid(id)
        if (id === 'status@broadcast') return
        if (!(id in conn.chats)) conn.chats[id] = { id }
        let chats = conn.chats[id]
        chats.isChats = true
        // FIX: No llamar groupMetadata() directamente — index.js ya tiene
        // un handler de `group-participants.update` con cola rate-limited.
        // Solo sincronizamos desde el cache si ya está disponible.
        const cached = global.groupMetadataCache?.get(id)
        if (cached) {
            chats.subject = cached.subject
            chats.metadata = cached
        }
    })

    conn.ev.on('groups.update', async function groupUpdatePushToDb(groupsUpdates) {
        try {
            for (const update of groupsUpdates) {
                const id = conn.decodeJid(update.id)
                if (!id || id === 'status@broadcast') continue
                const isGroup = id.endsWith('@g.us')
                if (!isGroup) continue
                let chats = conn.chats[id]
                if (!chats) chats = conn.chats[id] = { id }
                chats.isChats = true
                const metadata = await getGroupMetadataWithRetry(conn, id)
                if (metadata) chats.metadata = metadata
                if (update.subject || metadata?.subject) chats.subject = update.subject || metadata.subject
            }
        } catch (e) {
            console.error(e)
        }
    })
    conn.ev.on('chats.upsert', function chatsUpsertPushToDb(chatsUpsert) {
        try {
            // Baileys 7: chats.upsert entrega un arreglo Chat[]
            const chatArray = Array.isArray(chatsUpsert) ? chatsUpsert : [chatsUpsert]
            for (const chat of chatArray) {
                const id = chat?.id ? conn.decodeJid(chat.id) : null
                if (!id || id === 'status@broadcast') continue
                conn.chats[id] = { ...(conn.chats[id] || {}), ...chat, id, isChats: true }
                const isGroup = id.endsWith('@g.us')
                if (isGroup) conn.insertAllGroup?.().catch(_ => null)
            }
        } catch (e) {
            console.error(e)
        }
    })

    // ── Eventos Baileys 7 adicionales ────────────────────────────────────
    conn.ev.on('contacts.update', function contactsUpdateToDb(updates) {
        if (!updates) return
        try {
            for (const contact of updates) {
                const id = conn.decodeJid(contact.id)
                if (!id || id === 'status@broadcast') continue
                const prev = conn.chats[id] || { id }
                conn.chats[id] = {
                    ...prev,
                    ...contact,
                    id,
                    name: contact.notify || contact.name || prev.name || ''
                }
            }
        } catch (e) {
            console.error(e)
        }
    })

    conn.ev.on('chats.update', function chatsUpdateToDb(updates) {
        if (!updates) return
        try {
            for (const chat of updates) {
                const id = chat?.id ? conn.decodeJid(chat.id) : null
                if (!id || id === 'status@broadcast') continue
                conn.chats[id] = { ...(conn.chats[id] || {}), ...chat, id }
            }
        } catch (e) {
            console.error(e)
        }
    })

    conn.ev.on('chats.delete', function chatsDeleteFromDb(chatIds) {
        for (const rawId of chatIds || []) {
            const id = conn.decodeJid(rawId)
            if (id) delete conn.chats[id]
        }
    })

    conn.ev.on('messaging-history.set', function historySetToDb({ chats = [], contacts = [], messages = [], lidPnMappings = [] }) {
        try {
            for (const chat of chats) {
                const id = chat?.id ? conn.decodeJid(chat.id) : null
                if (!id || id === 'status@broadcast') continue
                conn.chats[id] = { ...(conn.chats[id] || {}), ...chat, id, isChats: true }
            }
            for (const contact of contacts) {
                const id = conn.decodeJid(contact.id)
                if (!id || id === 'status@broadcast') continue
                const prev = conn.chats[id] || { id }
                conn.chats[id] = {
                    ...prev,
                    ...contact,
                    id,
                    name: contact.notify || contact.name || prev.name || ''
                }
            }
            // Guardar mapeos LID
            for (const mapping of lidPnMappings) {
                if (mapping?.lid && mapping?.pn) {
                    global.db.data.lidmap = global.db.data.lidmap || {}
                    global.db.data.lidmap[mapping.lid] = mapping.pn
                    global.db.data.lidmap[mapping.pn] = mapping.lid
                }
            }
        } catch (e) {
            console.error(e)
        }
    })

    conn.ev.on('lid-mapping.update', function lidMappingUpdateToDb(mapping) {
        if (!mapping?.lid || !mapping?.pn) return
        global.db.data.lidmap = global.db.data.lidmap || {}
        global.db.data.lidmap[mapping.lid] = mapping.pn
        global.db.data.lidmap[mapping.pn] = mapping.lid
    })
    // ────────────────────────────────────────────────────────────────────
    conn.ev.on('presence.update', async function presenceUpdatePushToDb({ id, presences }) {
        try {
            const sender = Object.keys(presences)[0] || id
            const _sender = conn.decodeJid(sender)
            const presence = presences[sender]['lastKnownPresence'] || 'composing'
            let chats = conn.chats[_sender]
            if (!chats) chats = conn.chats[_sender] = { id: sender }
            chats.presences = presence
            if (id.endsWith('@g.us')) {
                let chats = conn.chats[id]
                if (!chats) chats = conn.chats[id] = { id }
            }
        } catch (e) {
            console.error(e)
        }
    })
    return conn
}

const KEY_MAP = {
    'pre-key': 'preKeys',
    'session': 'sessions',
    'sender-key': 'senderKeys',
    'app-state-sync-key': 'appStateSyncKeys',
    'app-state-sync-version': 'appStateVersions',
    'sender-key-memory': 'senderKeyMemory',
    'device-list': 'deviceLists',
    'identity-key': 'identityKeys',
    'lid-mapping': 'lidMappings',
    'tctoken': 'tcTokens'
}

function useSingleFileAuthState(filename, logger) {
    let creds, keys = {}, saveCount = 0
    let _saveTimer = null
    const _flushSave = async () => {
        try {
            await writeFileAsync(
                filename,
                JSON.stringify({ creds, keys }, BufferJSON.replacer, 2)
            )
        } catch (e) {
            logger?.error?.('Error saving auth state:', e)
        }
    }
    const saveState = (forceSave) => {
        logger?.trace('saving auth state')
        saveCount++
        if (forceSave || saveCount > 5) {
            saveCount = 0
            if (_saveTimer) clearTimeout(_saveTimer)
            _saveTimer = setTimeout(() => {
                _saveTimer = null
                _flushSave()
            }, 2000)
        }
    }

    if (existsSync(filename)) {
        const result = JSON.parse(
            readFileSync(filename, { encoding: 'utf-8' }),
            BufferJSON.reviver
        )
        creds = result.creds
        keys = result.keys
    } else {
        creds = initAuthCreds()
        keys = {}
    }

    return {
        state: {
            creds,
            keys: {
                get: (type, ids) => {
                    const key = KEY_MAP[type] || type
                    return ids.reduce(
                        (dict, id) => {
                            let value = keys[key]?.[id]
                            if (value) {
                                if (type === 'app-state-sync-key') {
                                    value = proto.AppStateSyncKeyData.create(value)
                                }

                                dict[id] = value
                            }

                            return dict
                        }, {}
                    )
                },
                set: (data) => {
                    for (const _key in data) {
                        const key = KEY_MAP[_key] || _key
                        keys[key] = keys[key] || {}
                        for (const [id, value] of Object.entries(data[_key] || {})) {
                            if (value == null) {
                                delete keys[key][id]
                            } else {
                                keys[key][id] = value
                            }
                        }
                    }

                    saveState()
                }
            }
        },
        saveState
    }
}
export default {
    bind,
    useSingleFileAuthState
}