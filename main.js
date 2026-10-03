// Modules to control application life and create native browser window
const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')
const { pathToFileURL } = require('node:url')

function assertLocalEditor(event) {
  if (event.senderFrame?.url !== pathToFileURL(path.join(__dirname, 'index.html')).href) {
    throw new Error('Project file operations are only available to the local editor.')
  }
}

ipcMain.handle('project-file:save', async (event, { name, content } = {}) => {
  assertLocalEditor(event)
  if (typeof content !== 'string' || content.length > 512 * 1024 * 1024) {
    throw new Error('Project file must be valid text smaller than 512 MB.')
  }
  const safeName = String(name || 'Untitled').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Untitled'
  const result = await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender), {
    defaultPath: path.join(app.getPath('documents'), `${safeName}.bba.json`),
    filters: [{ name: 'Bare Bones Animator Project', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePath) return { canceled: true }
  await fs.writeFile(result.filePath, content, { encoding: 'utf8', flag: 'w' })
  return { canceled: false, filePath: result.filePath }
})

ipcMain.handle('project-file:open', async event => {
  assertLocalEditor(event)
  const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    properties: ['openFile'],
    filters: [{ name: 'Bare Bones Animator Project', extensions: ['json'] }]
  })
  if (result.canceled || !result.filePaths[0]) return { canceled: true }
  const filePath = result.filePaths[0]
  const stats = await fs.stat(filePath)
  if (!stats.isFile() || stats.size > 512 * 1024 * 1024) {
    throw new Error('Project file must be a regular file smaller than 512 MB.')
  }
  return { canceled: false, content: await fs.readFile(filePath, 'utf8'), filePath }
})

function createWindow () {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
