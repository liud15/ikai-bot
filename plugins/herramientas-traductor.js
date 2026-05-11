import fetch from 'node-fetch';

let handler = async (m, { text, usedPrefix, command, conn }) => {
    if (!text) {
        return m.reply(
            `🌐 *Traductor*\n\n` +
            `*Uso:*\n` +
            `${usedPrefix + command} <idioma> <texto>\n\n` +
            `*Ejemplos:*\n` +
            `${usedPrefix}traducir en Hello, how are you?\n` +
            `${usedPrefix}traducir es Bonjour le monde\n` +
            `${usedPrefix}traducir ja Hola mundo\n` +
            `${usedPrefix}traducir fr I love programming\n\n` +
            `*También puedes responder a un mensaje:*\n` +
            `${usedPrefix}traducir en\n\n` +
            `*Idiomas populares:*\n` +
            `🇪🇸 es — Español\n` +
            `🇺🇸 en — English\n` +
            `🇫🇷 fr — Français\n` +
            `🇩🇪 de — Deutsch\n` +
            `🇮🇹 it — Italiano\n` +
            `🇵🇹 pt — Português\n` +
            `🇯🇵 ja — 日本語\n` +
            `🇰🇷 ko — 한국어\n` +
            `🇨🇳 zh — 中文\n` +
            `🇷🇺 ru — Русский\n` +
            `🇸🇦 ar — العربية`
        );
    }

    // Parsear idioma destino y texto
    const args = text.trim().split(/\s+/);
    let targetLang = args[0]?.toLowerCase();
    let textoTraducir = args.slice(1).join(' ');

    // Si no hay texto después del idioma, buscar en mensaje citado
    if (!textoTraducir && m.quoted?.text) {
        textoTraducir = m.quoted.text;
    }

    // Validar idioma destino
    const idiomasValidos = [
        'af', 'sq', 'am', 'ar', 'hy', 'az', 'eu', 'be', 'bn', 'bs', 'bg', 'ca',
        'ceb', 'zh', 'co', 'hr', 'cs', 'da', 'nl', 'en', 'eo', 'et', 'fi', 'fr',
        'fy', 'gl', 'ka', 'de', 'el', 'gu', 'ht', 'ha', 'haw', 'he', 'hi', 'hmn',
        'hu', 'is', 'ig', 'id', 'ga', 'it', 'ja', 'jv', 'kn', 'kk', 'km', 'rw',
        'ko', 'ku', 'ky', 'lo', 'la', 'lv', 'lt', 'lb', 'mk', 'mg', 'ms', 'ml',
        'mt', 'mi', 'mr', 'mn', 'my', 'ne', 'no', 'ny', 'or', 'ps', 'fa', 'pl',
        'pt', 'pa', 'ro', 'ru', 'sm', 'gd', 'sr', 'st', 'sn', 'sd', 'si', 'sk',
        'sl', 'so', 'es', 'su', 'sw', 'sv', 'tl', 'tg', 'ta', 'tt', 'te', 'th',
        'tr', 'tk', 'uk', 'ur', 'ug', 'uz', 'vi', 'cy', 'xh', 'yi', 'yo', 'zu'
    ];

    if (!idiomasValidos.includes(targetLang)) {
        // Tal vez el usuario no puso idioma, traducir todo a español por defecto
        textoTraducir = text.trim();
        if (m.quoted?.text) textoTraducir = m.quoted.text;
        targetLang = 'es';
    }

    if (!textoTraducir) {
        return m.reply(`❌ Proporciona un texto para traducir o responde a un mensaje.\n\n*Uso:* ${usedPrefix + command} <idioma> <texto>`);
    }

    // Limitar longitud
    if (textoTraducir.length > 2000) {
        return m.reply('❌ El texto es demasiado largo. Máximo 2000 caracteres.');
    }

    await conn.sendMessage(m.chat, { react: { text: '🌐', key: m.key } });

    try {
        const traduccion = await traducirTexto(textoTraducir, targetLang);

        if (!traduccion) {
            await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
            return m.reply('❌ No se pudo traducir el texto. Inténtalo más tarde.');
        }

        const bandera = obtenerBandera(targetLang);
        const nombreIdioma = obtenerNombreIdioma(targetLang);

        let msg = `🌐 *TRADUCTOR*\n\n`;
        msg += `📥 *Original:*\n${textoTraducir}\n\n`;
        msg += `${bandera} *${nombreIdioma}:*\n${traduccion}\n\n`;
        msg += `━━━━━━━━━━━━━━━\n`;
        msg += `⪛✰ IKAIBOT - Traductor ✰⪜`;

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
        return m.reply(msg);

    } catch (e) {
        console.error('[traductor] Error:', e.message);
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
        return m.reply('⚠️ Error al traducir. Inténtalo más tarde.');
    }
};

async function traducirTexto(text, targetLang) {
    try {
        // Usar Google Translate vía endpoint público
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36'
            },
            timeout: 15000
        });

        if (!res.ok) return null;

        const data = await res.json();

        if (!data || !data[0]) return null;

        // Concatenar todas las partes traducidas
        let traduccion = '';
        for (const parte of data[0]) {
            if (parte[0]) traduccion += parte[0];
        }

        return traduccion || null;
    } catch {
        return null;
    }
}

function obtenerBandera(lang) {
    const banderas = {
        'es': '🇪🇸', 'en': '🇺🇸', 'fr': '🇫🇷', 'de': '🇩🇪', 'it': '🇮🇹',
        'pt': '🇵🇹', 'ja': '🇯🇵', 'ko': '🇰🇷', 'zh': '🇨🇳', 'ru': '🇷🇺',
        'ar': '🇸🇦', 'hi': '🇮🇳', 'tr': '🇹🇷', 'nl': '🇳🇱', 'pl': '🇵🇱',
        'sv': '🇸🇪', 'da': '🇩🇰', 'no': '🇳🇴', 'fi': '🇫🇮', 'el': '🇬🇷',
        'th': '🇹🇭', 'vi': '🇻🇳', 'id': '🇮🇩', 'ms': '🇲🇾', 'tl': '🇵🇭',
        'uk': '🇺🇦', 'cs': '🇨🇿', 'ro': '🇷🇴', 'hu': '🇭🇺', 'he': '🇮🇱'
    };
    return banderas[lang] || '🏳️';
}

function obtenerNombreIdioma(lang) {
    const nombres = {
        'es': 'Español', 'en': 'English', 'fr': 'Français', 'de': 'Deutsch',
        'it': 'Italiano', 'pt': 'Português', 'ja': '日本語', 'ko': '한국어',
        'zh': '中文', 'ru': 'Русский', 'ar': 'العربية', 'hi': 'हिन्दी',
        'tr': 'Türkçe', 'nl': 'Nederlands', 'pl': 'Polski', 'sv': 'Svenska',
        'da': 'Dansk', 'no': 'Norsk', 'fi': 'Suomi', 'el': 'Ελληνικά',
        'th': 'ไทย', 'vi': 'Tiếng Việt', 'id': 'Bahasa Indonesia',
        'ms': 'Bahasa Melayu', 'tl': 'Filipino', 'uk': 'Українська',
        'cs': 'Čeština', 'ro': 'Română', 'hu': 'Magyar', 'he': 'עברית',
        'la': 'Latinum', 'eo': 'Esperanto'
    };
    return nombres[lang] || lang.toUpperCase();
}

handler.help = ['traducir <idioma> <texto>', 'tr <idioma> <texto>'];
handler.tags = ['tools'];
handler.command = /^(traducir|translate|tr|trad)$/i;

export default handler;
