import { getUser, msToText, getRealJid, FAMILY_DAILY_CD } from '../src/lib/family-utils.js'

let handler = async (m, { conn }) => {
    const senderJid = getRealJid(m.sender)
    const me = getUser(senderJid)

    const elapsed = Date.now() - me.lastFamilyClaim
    const remaining = FAMILY_DAILY_CD - elapsed
    if (remaining > 0) return m.reply(`Ya cobraste el bono familiar.\nVuelve en *${msToText(remaining)}*.`)

    const base = 180
    const partnerBonus = me.marry ? 220 : 0
    const childBonus = Math.min(300, me.children.length * 70)
    const parentBonus = Math.min(180, me.parents.length * 90)
    const total = base + partnerBonus + childBonus + parentBonus

    me.coin += total
    me.lastFamilyClaim = Date.now()

    return m.reply(
        `*Bono Familiar Reclamado*\n\n` +
        `• Base: ${base}\n` +
        `• Bono pareja: ${partnerBonus}\n` +
        `• Bono hijos: ${childBonus}\n` +
        `• Bono padres: ${parentBonus}\n\n` +
        `> _Total: +${total} coins_\n` +
        `> _Wallet: ${me.coin}_`
    )
}

handler.help = ['familydaily']
handler.tags = ['economy']
handler.command = ['familydaily', 'famdaily']
handler.group = true

export default handler
