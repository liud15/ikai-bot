import { readdirSync, existsSync, readFileSync, watch } from 'fs'
import { join, resolve } from 'path'
import { format } from 'util'
import syntaxerror from 'syntax-error'
import importFile from './import.js'
import Helper from './helper.js'

const __dirname = Helper.__dirname(import.meta)
const pluginFolder = Helper.__dirname(join(__dirname, '../plugins/index'))
const pluginFilter = filename => /\.(mc)?js$/.test(filename)


let watcher, plugins, pluginFolders = []
watcher = plugins = {}

function getFilesRecursive(dir) {
    let results = [];
    if (!existsSync(dir)) return results;
    const list = readdirSync(dir, { withFileTypes: true });
    for (const dirent of list) {
        if (dirent.name === 'node_modules' || dirent.name === '.git') continue;
        const res = join(dir, dirent.name);
        if (dirent.isDirectory()) {
            results = results.concat(getFilesRecursive(res));
        } else {
            results.push(res);
        }
    }
    return results;
}

async function filesInit(folderPath = pluginFolder, filterFn = pluginFilter, conn) {
    const folder = resolve(folderPath)
    if (folder in watcher) return
    pluginFolders.push(folder)

    const allFiles = getFilesRecursive(folder).map(f => {
        return f.replace(folder, '').replace(/^[\\\/]/, '').replace(/\\/g, '/');
    });

    await Promise.all(allFiles.filter(filterFn).map(async filename => {
        try {
            let file = globalThis.__filename(join(folder, filename))
            const module = await import(file)
            if (module) plugins[filename] = 'default' in module ? module.default : module
        } catch (e) {
            conn?.logger.error(e)
            delete plugins[filename]
        }
    }))


    const watching = watch(folder, { recursive: true }, reload.bind(null, conn, folder, filterFn))
    watching.on('close', () => deletePluginFolder(folder, true))
    watcher[folder] = watching

    return plugins
}

function deletePluginFolder(folder, isAlreadyClosed = false) {
    const resolved = resolve(folder)
    if (!(resolved in watcher)) return
    if (!isAlreadyClosed) watcher[resolved].close()
    delete watcher[resolved]
    pluginFolders.splice(pluginFolders.indexOf(resolved), 1)
}

async function reload(conn, folderPath = pluginFolder, filterFn = pluginFilter, _ev, filename) {
    if (!filename) return;
    filename = filename.replace(/\\/g, '/');
    if (filterFn(filename)) {
        let dir = globalThis.__filename(join(folderPath, filename), true)
        if (filename in plugins) {
            if (existsSync(dir)) conn.logger.info(` updated plugin - '${filename}'`)
            else {
                conn?.logger.warn(`deleted plugin - '${filename}'`)
                return delete plugins[filename]
            }
        } else conn?.logger.info(`new plugin - '${filename}'`)
        let err = syntaxerror(readFileSync(dir), filename, {
            sourceType: 'module',
            allowAwaitOutsideFunction: true
        })
        if (err) conn.logger.error(`syntax error while loading '${filename}'\n${format(err)}`)
        else try {
            const module = await importFile(globalThis.__filename(dir)).catch(console.error)
            if (module) plugins[filename] = module
        } catch (e) {
            conn?.logger.error(`error require plugin '${filename}\n${format(e)}'`)
        } finally {
            plugins = Object.fromEntries(Object.entries(plugins).sort(([a], [b]) => a.localeCompare(b)))
        }
    }
}

export { pluginFolder, pluginFilter, plugins, watcher, pluginFolders, filesInit, deletePluginFolder, reload }