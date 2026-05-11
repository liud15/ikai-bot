import fetch from 'node-fetch';

let handler = async (m, { text, usedPrefix, command, conn }) => {
    if (!text) {
        return m.reply(
            `📖 *Uso correcto:*\n` +
            `${usedPrefix + command} <palabra>\n\n` +
            `*Ejemplos:*\n` +
            `${usedPrefix}definir efímero\n` +
            `${usedPrefix}definir love\n` +
            `${usedPrefix}sinonimos feliz`
        );
    }

    const query = text.trim();

    await conn.sendMessage(m.chat, { react: { text: '📖', key: m.key } });

    try {
        if (/^(sinonimos?|synonyms?)$/i.test(command)) {
            // ─── Modo sinónimos ───
            const result = await buscarSinonimos(query);
            if (!result) {
                await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
                return m.reply(`❌ No se encontraron sinónimos para *"${query}"*`);
            }
            await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
            return m.reply(result);
        }

        // ─── Modo definición ───
        // Detectar idioma: si contiene caracteres españoles o es palabra española, buscar en ES
        let resultado = null;
        let idioma = 'es';

        // Intentar primero en español
        resultado = await buscarDefinicion(query, 'es');

        // Si no hay resultado en español, intentar en inglés
        if (!resultado) {
            resultado = await buscarDefinicion(query, 'en');
            idioma = 'en';
        }

        if (!resultado) {
            await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
            return m.reply(
                `❌ *No encontrado*\n\n` +
                `No se encontró definición para *"${query}"*\n\n` +
                `💡 *Sugerencias:*\n` +
                `• Revisa la ortografía\n` +
                `• Intenta con la forma base de la palabra\n` +
                `• Prueba en otro idioma`
            );
        }

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
        return m.reply(resultado);

    } catch (e) {
        console.error('[diccionario] Error:', e.message);
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
        return m.reply('⚠️ Error al buscar la definición. Inténtalo más tarde.');
    }
};

async function buscarDefinicion(palabra, lang = 'es') {
    try {
        const res = await fetch(
            `https://api.dictionaryapi.dev/api/v2/entries/${lang}/${encodeURIComponent(palabra)}`,
            {
                headers: { 'User-Agent': 'WhatsAppBot/2.0' },
                timeout: 10000
            }
        );

        if (!res.ok) return null;

        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return null;

        const entry = data[0];
        const langLabel = lang === 'es' ? '🇪🇸 Español' : '🇺🇸 English';

        let msg = `📖 *DICCIONARIO*\n\n`;
        msg += `📝 *Palabra:* ${entry.word}\n`;
        msg += `🌐 *Idioma:* ${langLabel}\n`;

        // Fonética
        if (entry.phonetic) {
            msg += `🔊 *Fonética:* ${entry.phonetic}\n`;
        } else if (entry.phonetics?.length > 0) {
            const phonetic = entry.phonetics.find(p => p.text);
            if (phonetic) msg += `🔊 *Fonética:* ${phonetic.text}\n`;
        }

        // Origen
        if (entry.origin) {
            msg += `📜 *Origen:* ${entry.origin}\n`;
        }

        msg += `\n`;

        // Significados (máximo 3 categorías)
        const meanings = entry.meanings.slice(0, 3);
        for (const meaning of meanings) {
            const partOfSpeech = traducirCategoria(meaning.partOfSpeech);
            msg += `━━━━━━━━━━━━━━━\n`;
            msg += `📌 *${partOfSpeech}*\n\n`;

            // Definiciones (máximo 3 por categoría)
            const defs = meaning.definitions.slice(0, 3);
            defs.forEach((def, i) => {
                msg += `  ${i + 1}. ${def.definition}\n`;
                if (def.example) {
                    msg += `     💬 _"${def.example}"_\n`;
                }
            });

            // Sinónimos
            if (meaning.synonyms?.length > 0) {
                const syns = meaning.synonyms.slice(0, 5).join(', ');
                msg += `\n  🔄 *Sinónimos:* ${syns}\n`;
            }

            // Antónimos
            if (meaning.antonyms?.length > 0) {
                const ants = meaning.antonyms.slice(0, 5).join(', ');
                msg += `  ⚡ *Antónimos:* ${ants}\n`;
            }

            msg += `\n`;
        }

        msg += `━━━━━━━━━━━━━━━\n`;
        msg += `⪛✰ IKAIBOT - Diccionario ✰⪜`;

        return msg;
    } catch {
        return null;
    }
}

async function buscarSinonimos(palabra) {
    try {
        // Intentar en español primero
        let res = await fetch(
            `https://api.dictionaryapi.dev/api/v2/entries/es/${encodeURIComponent(palabra)}`,
            { headers: { 'User-Agent': 'WhatsAppBot/2.0' }, timeout: 10000 }
        );

        let lang = 'es';
        if (!res.ok) {
            res = await fetch(
                `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(palabra)}`,
                { headers: { 'User-Agent': 'WhatsAppBot/2.0' }, timeout: 10000 }
            );
            lang = 'en';
        }

        if (!res.ok) return null;

        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return null;

        const entry = data[0];
        let allSynonyms = [];
        let allAntonyms = [];

        for (const meaning of entry.meanings) {
            if (meaning.synonyms) allSynonyms.push(...meaning.synonyms);
            if (meaning.antonyms) allAntonyms.push(...meaning.antonyms);
            for (const def of meaning.definitions) {
                if (def.synonyms) allSynonyms.push(...def.synonyms);
                if (def.antonyms) allAntonyms.push(...def.antonyms);
            }
        }

        // Eliminar duplicados
        allSynonyms = [...new Set(allSynonyms)];
        allAntonyms = [...new Set(allAntonyms)];

        if (allSynonyms.length === 0 && allAntonyms.length === 0) {
            return null;
        }

        let msg = `📖 *SINÓNIMOS Y ANTÓNIMOS*\n\n`;
        msg += `📝 *Palabra:* ${entry.word}\n`;
        msg += `🌐 *Idioma:* ${lang === 'es' ? '🇪🇸 Español' : '🇺🇸 English'}\n\n`;

        if (allSynonyms.length > 0) {
            msg += `🔄 *Sinónimos (${allSynonyms.length}):*\n`;
            msg += allSynonyms.slice(0, 15).map(s => `  • ${s}`).join('\n');
            msg += '\n\n';
        }

        if (allAntonyms.length > 0) {
            msg += `⚡ *Antónimos (${allAntonyms.length}):*\n`;
            msg += allAntonyms.slice(0, 10).map(a => `  • ${a}`).join('\n');
            msg += '\n';
        }

        msg += `\n━━━━━━━━━━━━━━━\n`;
        msg += `⪛✰ IKAIBOT - Sinónimos ✰⪜`;

        return msg;
    } catch {
        return null;
    }
}

function traducirCategoria(partOfSpeech) {
    const traducciones = {
        'noun': 'Sustantivo',
        'verb': 'Verbo',
        'adjective': 'Adjetivo',
        'adverb': 'Adverbio',
        'pronoun': 'Pronombre',
        'preposition': 'Preposición',
        'conjunction': 'Conjunción',
        'interjection': 'Interjección',
        'article': 'Artículo',
        'determiner': 'Determinante',
        'exclamation': 'Exclamación'
    };
    return traducciones[partOfSpeech.toLowerCase()] || partOfSpeech;
}

handler.help = ['definir <palabra>', 'diccionario <palabra>', 'sinonimos <palabra>'];
handler.tags = ['tools'];
handler.command = /^(definir|diccionario|define|sinonimos?|synonyms?|dict)$/i;

export default handler;
