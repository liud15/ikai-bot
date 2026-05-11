let handler = async (m, { text, usedPrefix, command, conn }) => {
    if (!text) {
        return m.reply(
            `🧮 *Calculadora Científica*\n\n` +
            `*Uso:*\n` +
            `${usedPrefix + command} <expresión>\n\n` +
            `*Operaciones básicas:*\n` +
            `${usedPrefix}calc 2 + 2\n` +
            `${usedPrefix}calc 15 * 3 - 7\n` +
            `${usedPrefix}calc (10 + 5) / 3\n` +
            `${usedPrefix}calc 2 ^ 10\n` +
            `${usedPrefix}calc 25 % 7\n\n` +
            `*Funciones científicas:*\n` +
            `${usedPrefix}calc sqrt(144)\n` +
            `${usedPrefix}calc sin(45)\n` +
            `${usedPrefix}calc cos(60)\n` +
            `${usedPrefix}calc tan(30)\n` +
            `${usedPrefix}calc log(100)\n` +
            `${usedPrefix}calc ln(2.718)\n` +
            `${usedPrefix}calc abs(-15)\n` +
            `${usedPrefix}calc ceil(4.3)\n` +
            `${usedPrefix}calc floor(4.7)\n` +
            `${usedPrefix}calc round(4.5)\n` +
            `${usedPrefix}calc factorial(5)\n\n` +
            `*Constantes:*\n` +
            `• PI = 3.14159...\n` +
            `• E = 2.71828...\n` +
            `• PHI = 1.61803... (Golden Ratio)\n\n` +
            `*Ejemplo avanzado:*\n` +
            `${usedPrefix}calc sin(45) * sqrt(16) + log(100)`
        );
    }

    try {
        const expresion = text.trim();
        const resultado = evaluarExpresion(expresion);

        if (resultado.error) {
            await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
            return m.reply(`❌ *Error de cálculo*\n\n${resultado.error}`);
        }

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });

        let msg = `🧮 *CALCULADORA CIENTÍFICA*\n\n`;
        msg += `📥 *Expresión:*\n${expresion}\n\n`;
        msg += `📊 *Resultado:*\n*${resultado.value}*\n`;

        // Info adicional si es relevante
        if (resultado.extra) {
            msg += `\n${resultado.extra}\n`;
        }

        msg += `\n━━━━━━━━━━━━━━━\n`;
        msg += `⪛✰ IKAIBOT - Calculadora ✰⪜`;

        return m.reply(msg);

    } catch (e) {
        console.error('[calc] Error:', e.message);
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
        return m.reply('⚠️ Error al procesar la expresión. Verifica la sintaxis.');
    }
};

function evaluarExpresion(expr) {
    try {
        // Guardar expresión original para mostrar
        let normalizada = expr;

        // ─── Reemplazar constantes ───
        normalizada = normalizada.replace(/\bPI\b/gi, String(Math.PI));
        normalizada = normalizada.replace(/\bE\b/g, String(Math.E));
        normalizada = normalizada.replace(/\bPHI\b/gi, String((1 + Math.sqrt(5)) / 2));
        normalizada = normalizada.replace(/\bINF(INITY)?\b/gi, 'Infinity');

        // ─── Reemplazar funciones ───
        // factorial(n)
        normalizada = normalizada.replace(/factorial\((\d+)\)/gi, (_, n) => {
            return String(factorial(parseInt(n)));
        });

        // cbrt
        normalizada = normalizada.replace(/cbrt\(/gi, 'Math.cbrt(');

        // sqrt  
        normalizada = normalizada.replace(/sqrt\(/gi, 'Math.sqrt(');

        // Funciones trigonométricas (convertir grados a radianes)
        normalizada = normalizada.replace(/sin\(([^)]+)\)/gi, (_, val) => {
            return `Math.sin((${val}) * Math.PI / 180)`;
        });
        normalizada = normalizada.replace(/cos\(([^)]+)\)/gi, (_, val) => {
            return `Math.cos((${val}) * Math.PI / 180)`;
        });
        normalizada = normalizada.replace(/tan\(([^)]+)\)/gi, (_, val) => {
            return `Math.tan((${val}) * Math.PI / 180)`;
        });

        // Funciones trigonométricas inversas (resultado en grados)
        normalizada = normalizada.replace(/asin\(([^)]+)\)/gi, (_, val) => {
            return `(Math.asin(${val}) * 180 / Math.PI)`;
        });
        normalizada = normalizada.replace(/acos\(([^)]+)\)/gi, (_, val) => {
            return `(Math.acos(${val}) * 180 / Math.PI)`;
        });
        normalizada = normalizada.replace(/atan\(([^)]+)\)/gi, (_, val) => {
            return `(Math.atan(${val}) * 180 / Math.PI)`;
        });

        // log (base 10)
        normalizada = normalizada.replace(/log10?\(/gi, 'Math.log10(');
        // ln (natural log)
        normalizada = normalizada.replace(/ln\(/gi, 'Math.log(');
        // log2
        normalizada = normalizada.replace(/log2\(/gi, 'Math.log2(');

        // abs, ceil, floor, round
        normalizada = normalizada.replace(/abs\(/gi, 'Math.abs(');
        normalizada = normalizada.replace(/ceil\(/gi, 'Math.ceil(');
        normalizada = normalizada.replace(/floor\(/gi, 'Math.floor(');
        normalizada = normalizada.replace(/round\(/gi, 'Math.round(');
        normalizada = normalizada.replace(/sign\(/gi, 'Math.sign(');
        normalizada = normalizada.replace(/trunc\(/gi, 'Math.trunc(');

        // pow y operador ^
        normalizada = normalizada.replace(/pow\(([^,]+),([^)]+)\)/gi, 'Math.pow($1,$2)');
        normalizada = normalizada.replace(/\^/g, '**');

        // ─── Validación de seguridad ───
        // Solo permitir: números, operadores, paréntesis, Math, punto, coma, espacios
        const sanitized = normalizada.replace(/Math\.\w+/g, '').replace(/Infinity/g, '');
        if (/[a-zA-Z_$]/.test(sanitized)) {
            return { error: 'Expresión contiene caracteres no permitidos. Usa solo números, operadores y funciones válidas.' };
        }

        // Verificar paréntesis balanceados
        let depth = 0;
        for (const ch of normalizada) {
            if (ch === '(') depth++;
            if (ch === ')') depth--;
            if (depth < 0) return { error: 'Paréntesis desbalanceados.' };
        }
        if (depth !== 0) return { error: 'Paréntesis desbalanceados.' };

        // ─── Evaluar ───
        // Usamos Function constructor en lugar de eval para aislamiento
        const fn = new Function(`"use strict"; return (${normalizada})`);
        let result = fn();

        if (typeof result !== 'number') {
            return { error: 'El resultado no es un número válido.' };
        }

        if (!isFinite(result) && !isNaN(result)) {
            return { value: '∞ (Infinito)', extra: '📌 El resultado tiende a infinito.' };
        }

        if (isNaN(result)) {
            return { error: 'Resultado indefinido (NaN). Verifica los valores ingresados.' };
        }

        // Formatear resultado
        let displayValue;
        let extra = '';

        if (Number.isInteger(result)) {
            displayValue = result.toLocaleString('es-ES');

            // Si es un número grande, mostrar también notación científica
            if (Math.abs(result) >= 1e10) {
                extra = `📐 *Notación científica:* ${result.toExponential(6)}`;
            }
        } else {
            // Redondear a 10 decimales máximo para evitar errores de punto flotante
            result = parseFloat(result.toPrecision(12));
            displayValue = result.toLocaleString('es-ES', { maximumFractionDigits: 10 });

            if (Math.abs(result) >= 1e10 || Math.abs(result) < 1e-6) {
                extra = `📐 *Notación científica:* ${result.toExponential(6)}`;
            }
        }

        return { value: displayValue, extra };

    } catch (e) {
        return { error: `Error de sintaxis: ${e.message}\n\n💡 Verifica la expresión e inténtalo de nuevo.` };
    }
}

function factorial(n) {
    if (n < 0) throw new Error('Factorial no definido para negativos');
    if (n > 170) throw new Error('Factorial demasiado grande (máx: 170)');
    if (n === 0 || n === 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) {
        result *= i;
    }
    return result;
}

handler.help = ['calc <expresión>', 'math <expresión>'];
handler.tags = ['tools'];
handler.command = /^(calc(uladora)?|math|calcular)$/i;

export default handler;
