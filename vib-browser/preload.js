const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("vib", {
  bootstrap: () => ipcRenderer.invoke("bootstrap"),
  setBrowserBounds: bounds => ipcRenderer.send("set-browser-bounds", bounds),
  navigate: value => ipcRenderer.send("navigate", value),
  newTab: value => ipcRenderer.send("new-tab", value),
  newPrivateTab: () => ipcRenderer.send("new-private-tab"),
  closeTab: id => ipcRenderer.send("close-tab", id),
  activateTab: id => ipcRenderer.send("activate-tab", id),
  command: name => ipcRenderer.send("browser-command", name),
  findText: value => ipcRenderer.send("find-text", value),
  setMode: value => ipcRenderer.send("set-mode", value),
  panelOpen: value => ipcRenderer.send("panel-open", value),
  focusPage: () => ipcRenderer.send("focus-page"),
  clearSiteData: () => ipcRenderer.send("clear-site-data"),
  openDownload: id => ipcRenderer.send("open-download", id),
  removeDownload: id => ipcRenderer.send("remove-download", id),
  onTabs: callback => ipcRenderer.on("tabs-updated", (_event, value) => callback(value)),
  onActivePage: callback => ipcRenderer.on("active-page", (_event, value) => callback(value)),
  onDownloads: callback => ipcRenderer.on("downloads-updated", (_event, value) => callback(value)),
  onShortcut: callback => ipcRenderer.on("shortcut", (_event, action, data) => callback(action, data)),
  onVimKey: callback => ipcRenderer.on("vim-key", (_event, data) => callback(data)),
  onBrowserError: callback => ipcRenderer.on("browser-error", (_event, message) => callback(message)),
  onPageLoadError: callback => ipcRenderer.on("page-load-error", (_event, data) => callback(data)),
  onMeasure: callback => ipcRenderer.on("measure-browser-area", callback)
})
