let handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text) return m.reply(`⚠️ Formato incorrecto.\n\nUso correcto:\n*${usedPrefix + command}* NombreDelPack|TuNombre\n\nEjemplo:\n*${usedPrefix + command}* Mis Stickers|Juan\n\n*Nota:* Si solo quieres poner autor, pon el | al principio: *${usedPrefix + command}* |Juan`);

  // Dividimos el texto por | o • y quitamos espacios a los lados
  let [packname, ...authorParts] = text.split(/\||•/).map(v => v.trim());
  let author = authorParts.join(' | '); // Por si el autor tiene pipes en su nombre

  if (!packname) packname = '';
  if (!author) author = '';

  let user = global.db.data.users[m.sender];
  
  // Guardamos en la base de datos del usuario
  user.text1 = packname;
  user.text2 = author;

  m.reply(`✅ *Marca de agua configurada correctamente.*\n\n📦 *Pack:* ${packname || 'Sin nombre'}\n👤 *Autor:* ${author || 'Sin nombre'}\n\n✨ A partir de ahora, todos los stickers que crees con *${usedPrefix}s* llevarán estos nombres automáticamente. Si deseas cambiarlo en el futuro, solo vuelve a usar este comando.`);
};

handler.help = ['setsticker <pack>|<autor>'];
handler.tags = ['sticker'];
handler.command = ['setsticker', 'configurarsticker', 'setwm'];

export default handler;
