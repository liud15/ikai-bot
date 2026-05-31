import { botTmpDir, formatBytes, getPathSpace } from '../lib/tmp.js'

let handler = async (m) => {
  const tmpSpace = getPathSpace(botTmpDir)
  const cwdSpace = getPathSpace(process.cwd())

  const text = [
    '*TMP check*',
    `TMPDIR: ${process.env.TMPDIR}`,
    `TEMP: ${process.env.TEMP}`,
    `Bot tmp: ${botTmpDir}`,
    `Tmp libre: ${formatBytes(tmpSpace.freeBytes)} / ${formatBytes(tmpSpace.totalBytes)}`,
    `Proyecto: ${process.cwd()}`,
    `Proyecto libre: ${formatBytes(cwdSpace.freeBytes)} / ${formatBytes(cwdSpace.totalBytes)}`
  ].join('\n')

  await m.reply(text)
}

handler.help = ['tmpcheck']
handler.tags = ['owner']
handler.command = ['tmpcheck', 'checktmp']
handler.owner = true

export default handler
