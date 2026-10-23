const { app, BrowserWindow, WebContentsView, ipcMain, session, shell } = require("electron")
const path = require("node:path")

const tabs = new Map()
const configuredSessions = new WeakSet()
const downloadRecords = new Map()
let windowRef
let activeId = null
let nextId = 1
let nextDownloadId = 1
const { pathToFileURL } = require("node:url")
let mode = "normal"
let uiInsertOverride = false
let browserBounds = { x: 0, y: 98, width: 1200, height: 700 }
let panelOpen = false
const newTabFile = path.join(__dirname, "ui", "newtab.html")
const internalNewTabUrl = pathToFileURL(newTabFile).href

function safeTarget(raw) {
  const value = String(raw ?? "").trim()
  if (!value) return "about:blank"
  if (/^(javascript|data|vbscript):/i.test(value)) throw new Error("That address scheme is not allowed")
  if (/^about:blank$/i.test(value)) return "about:blank"
  const looksLikeHost = /^(localhost(?::\d+)?|(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?|[^\s/]+\.[^\s/]+)(?:\/.*)?$/i.test(value)
  let candidate = value
  if (looksLikeHost && !/^https?:\/\//i.test(value)) candidate = `https://${value}`
  else if (!/^[a-z][a-z\d+.-]*:/i.test(value)) return `https://duckduckgo.com/?q=${encodeURIComponent(value)}`
  const parsed = new URL(candidate)
  if (!["http:", "https:", "about:"].includes(parsed.protocol)) throw new Error("Only web addresses are supported")
  return parsed.href
}

function isAllowedPageUrl(value) {
  if (value === internalNewTabUrl) return true
  try {
    return ["http:", "https:", "about:"].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

function loadTarget(contents, target) {
  const loading = target === "about:blank" ? contents.loadFile(newTabFile) : contents.loadURL(target)
  loading.catch(() => {})
}

function activeTab() {
  return tabs.get(activeId)
}

function tabSummary(tab) {
  const contents = tab.view.webContents
  return {
    id: tab.id,
    title: tab.title || "New tab",
    url: contents.getURL() === internalNewTabUrl ? "about:blank" : contents.getURL() || "about:blank",
    loading: contents.isLoading(),
    canGoBack: contents.navigationHistory.canGoBack(),
    canGoForward: contents.navigationHistory.canGoForward(),
    zoom: contents.getZoomFactor(),
    active: tab.id === activeId,
    private: tab.private
  }
}

function sendTabs() {
  if (!windowRef || windowRef.isDestroyed()) return
  windowRef.webContents.send("tabs-updated", {
    activeId,
    mode,
    tabs: [...tabs.values()].map(tabSummary)
  })
  const tab = activeTab()
  if (tab) windowRef.webContents.send("active-page", tabSummary(tab))
}

function sendDownloads() {
  if (windowRef && !windowRef.isDestroyed()) {
    windowRef.webContents.send("downloads-updated", [...downloadRecords.values()].sort((a, b) => b.startedAt - a.startedAt))
  }
}

function configureSession(ses, isPrivate = false) {
  if (configuredSessions.has(ses)) return
  configuredSessions.add(ses)
  ses.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  ses.setPermissionCheckHandler(() => false)
  ses.on("will-download", (_event, item) => {
    const id = nextDownloadId++
    const record = {
      id,
      filename: item.getFilename(),
      path: item.getSavePath(),
      url: item.getURL(),
      private: isPrivate,
      state: "progressing",
      received: item.getReceivedBytes(),
      total: item.getTotalBytes(),
      startedAt: Date.now()
    }
    downloadRecords.set(id, record)
    const update = () => {
      record.filename = item.getFilename()
      record.path = item.getSavePath()
      record.received = item.getReceivedBytes()
      record.total = item.getTotalBytes()
      sendDownloads()
    }
    item.on("updated", update)
    item.once("done", (_doneEvent, state) => {
      record.state = state
      record.path = item.getSavePath()
      record.received = item.getReceivedBytes()
      record.total = item.getTotalBytes()
      sendDownloads()
    })
    sendDownloads()
  })
}

function setBrowserBounds(bounds) {
  if (!windowRef || windowRef.isDestroyed()) return
  const x = Math.max(0, Math.round(Number(bounds.x) || 0))
  const y = Math.max(0, Math.round(Number(bounds.y) || 0))
  const width = Math.max(0, Math.round(Number(bounds.width) || 0))
  const height = Math.max(0, Math.round(Number(bounds.height) || 0))
  browserBounds = { x, y, width, height }
  for (const tab of tabs.values()) tab.view.setBounds(browserBounds)
}

function setPanelVisibility(open) {
  panelOpen = Boolean(open)
  for (const tab of tabs.values()) tab.view.setVisible(tab.id === activeId && !panelOpen)
}

function setActive(id) {
  if (!tabs.has(id)) return
  activeId = id
  uiInsertOverride = false
  mode = activeTab().pageEditing ? "insert" : "normal"
  for (const tab of tabs.values()) tab.view.setVisible(tab.id === activeId && !panelOpen)
  activeTab().view.setBounds(browserBounds)
  sendTabs()
}

function createTab(raw = "about:blank", options = {}) {
  const id = nextId++
  const isPrivate = Boolean(options.private)
  const partition = isPrivate ? `vib-private-${id}` : "persist:vib-profile"
  const ses = session.fromPartition(partition)
  configureSession(ses, isPrivate)
  const view = new WebContentsView({
    webPreferences: {
      session: ses,
      preload: path.join(__dirname, "page-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })
  const tab = { id, view, title: "New tab", private: isPrivate, findTerm: "", pageEditing: false }
  tabs.set(id, tab)
  windowRef.contentView.addChildView(view)
  view.setBounds(browserBounds)
  view.setVisible(false)

  const contents = view.webContents
  contents.setWindowOpenHandler(({ url }) => {
    try {
      createTab(url)
    } catch (error) {
      windowRef.webContents.send("browser-error", error.message)
    }
    return { action: "deny" }
  })

  contents.on("will-navigate", (event, url) => {
    if (!isAllowedPageUrl(url)) event.preventDefault()
  })

  contents.on("will-redirect", (event, url) => {
    if (!isAllowedPageUrl(url)) event.preventDefault()
  })

  const notify = () => {
    if (tabs.has(id)) sendTabs()
  }
  contents.on("did-start-loading", notify)
  contents.on("did-stop-loading", notify)
  contents.on("did-navigate", notify)
  contents.on("did-navigate-in-page", notify)
  contents.on("page-title-updated", (_event, title) => {
    tab.title = title || "New tab"
    notify()
  })
  contents.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && tabs.has(id)) windowRef.webContents.send("page-load-error", { id, url, description })
  })
  contents.on("render-process-gone", (_event, details) => {
    if (windowRef && !windowRef.isDestroyed()) windowRef.webContents.send("browser-error", `Page process stopped: ${details.reason}`)
  })
  contents.on("before-input-event", (event, input) => routePageInput(event, input))

  if (options.activate !== false) setActive(id)
  try {
    loadTarget(contents, safeTarget(raw))
  } catch (error) {
    windowRef.webContents.send("browser-error", error.message)
    loadTarget(contents, "about:blank")
  }
  return id
}

function closeTab(id = activeId) {
  const tab = tabs.get(id)
  if (!tab) return
  const oldIds = [...tabs.keys()]
  const oldIndex = oldIds.indexOf(id)
  const wasActive = id === activeId
  tabs.delete(id)
  windowRef.contentView.removeChildView(tab.view)
  tab.view.webContents.close()
  if (tabs.size === 0) {
    createTab("about:blank")
    return
  }
  if (wasActive) {
    const remainingIds = [...tabs.keys()]
    setActive(remainingIds[Math.min(oldIndex, remainingIds.length - 1)])
  } else {
    sendTabs()
  }
}

function navigate(raw, id = activeId) {
  const tab = tabs.get(id)
  if (!tab) return
  try {
    loadTarget(tab.view.webContents, safeTarget(raw))
    uiInsertOverride = false
    mode = "normal"
    sendTabs()
  } catch (error) {
    windowRef.webContents.send("browser-error", error.message)
  }
}

function routeShortcut(action, data) {
  if (windowRef && !windowRef.isDestroyed()) windowRef.webContents.send("shortcut", action, data)
}

function routePageInput(event, input) {
  if (input.type !== "keyDown") return
  const key = String(input.key || "")
  const lower = key.toLowerCase()
  const mod = input.control || input.meta
  if (mod) {
    if (input.shift && lower === "n") {
      event.preventDefault()
      routeShortcut("private-tab")
      return
    }
    const actionMap = {
      l: "focus-address",
      t: "new-tab",
      w: "close-tab",
      r: "reload",
      f: "find",
      d: "bookmark",
      "0": "zoom-reset",
      "+": "zoom-in",
      "=": "zoom-in",
      "-": "zoom-out"
    }
    let action = actionMap[lower]
    if (lower === "tab") action = input.shift ? "previous-tab" : "next-tab"
    if (action) {
      event.preventDefault()
      routeShortcut(action)
      return
    }
  }
  if (key === "Escape" && mode === "insert") {
    event.preventDefault()
    uiInsertOverride = false
    mode = "normal"
    routeShortcut("mode-normal")
    return
  }
  if (mode === "normal" && key !== "Tab") {
    event.preventDefault()
    routeShortcut("vim-key", { key, shift: Boolean(input.shift) })
  }
}

function createWindow() {
  windowRef = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 850,
    minHeight: 600,
    backgroundColor: "#111318",
    title: "ViB",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  windowRef.removeMenu()
  windowRef.loadFile(path.join(__dirname, "ui", "index.html"))
  windowRef.once("ready-to-show", () => {
    windowRef.show()
    createTab("about:blank")
    sendTabs()
  })
  windowRef.on("resize", () => windowRef.webContents.send("measure-browser-area"))
  windowRef.on("closed", () => {
    windowRef = null
    tabs.clear()
    activeId = null
  })
}

function registerIpc() {
  ipcMain.handle("bootstrap", () => ({ mode, tabs: [...tabs.values()].map(tabSummary), activeId, downloads: [...downloadRecords.values()] }))
  ipcMain.on("set-browser-bounds", (event, bounds) => {
    if (windowRef && event.sender === windowRef.webContents) setBrowserBounds(bounds)
  })
  ipcMain.on("navigate", (event, value) => {
    if (windowRef && event.sender === windowRef.webContents) navigate(value)
  })
  ipcMain.on("new-tab", (event, value) => {
    if (windowRef && event.sender === windowRef.webContents) createTab(value || "about:blank")
  })
  ipcMain.on("new-private-tab", event => {
    if (windowRef && event.sender === windowRef.webContents) createTab("about:blank", { private: true })
  })
  ipcMain.on("close-tab", (event, id) => {
    if (windowRef && event.sender === windowRef.webContents) closeTab(Number(id) || activeId)
  })
  ipcMain.on("activate-tab", (event, id) => {
    if (windowRef && event.sender === windowRef.webContents) setActive(Number(id))
  })
  ipcMain.on("browser-command", (event, command) => {
    if (!windowRef || event.sender !== windowRef.webContents) return
    const tab = activeTab()
    if (!tab) return
    const contents = tab.view.webContents
    if (command === "back" && contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack()
    if (command === "forward" && contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward()
    if (command === "reload") contents.reload()
    if (command === "stop") contents.stop()
    if (command === "focus-page") contents.focus()
    if (command === "zoom-in") contents.setZoomFactor(Math.min(3, contents.getZoomFactor() + 0.1))
    if (command === "zoom-out") contents.setZoomFactor(Math.max(0.5, contents.getZoomFactor() - 0.1))
    if (command === "zoom-reset") contents.setZoomFactor(1)
    if (command === "scroll-down") contents.executeJavaScript("window.scrollBy({top: 180, behavior: 'smooth'})")
    if (command === "scroll-up") contents.executeJavaScript("window.scrollBy({top: -180, behavior: 'smooth'})")
    if (command === "top") contents.executeJavaScript("window.scrollTo({top: 0, behavior: 'smooth'})")
    if (command === "bottom") contents.executeJavaScript("window.scrollTo({top: document.documentElement.scrollHeight, behavior: 'smooth'})")
    if (command === "find-next" && tab.findTerm) contents.findInPage(tab.findTerm)
    if (command === "find-previous" && tab.findTerm) contents.findInPage(tab.findTerm, { findNext: false })
    if (command.startsWith("zoom-")) sendTabs()
  })
  ipcMain.on("find-text", (event, query) => {
    if (!windowRef || event.sender !== windowRef.webContents) return
    const tab = activeTab()
    if (!tab) return
    tab.findTerm = String(query || "")
    if (tab.findTerm) tab.view.webContents.findInPage(tab.findTerm)
    else tab.view.webContents.stopFindInPage("clearSelection")
  })
  ipcMain.on("page-input-mode", (event, editing) => {
    const tab = [...tabs.values()].find(item => item.view.webContents === event.sender)
    if (!tab) return
    tab.pageEditing = Boolean(editing)
    if (tab.id === activeId && !uiInsertOverride) {
      mode = tab.pageEditing ? "insert" : "normal"
      routeShortcut("page-mode", mode)
    }
  })
  ipcMain.on("set-mode", (event, nextMode) => {
    if (windowRef && event.sender === windowRef.webContents && ["normal", "insert"].includes(nextMode)) {
      uiInsertOverride = nextMode === "insert"
      mode = nextMode
      sendTabs()
    }
  })
  ipcMain.on("panel-open", (event, open) => {
    if (windowRef && event.sender === windowRef.webContents) setPanelVisibility(open)
  })
  ipcMain.on("focus-page", event => {
    if (windowRef && event.sender === windowRef.webContents && activeTab()) {
      uiInsertOverride = false
      activeTab().view.webContents.focus()
    }
  })
  ipcMain.on("clear-site-data", async event => {
    if (!windowRef || event.sender !== windowRef.webContents) return
    const ses = session.fromPartition("persist:vib-profile")
    await ses.clearStorageData()
    await ses.clearCache()
    routeShortcut("site-data-cleared")
  })
  ipcMain.on("open-download", async (event, id) => {
    if (!windowRef || event.sender !== windowRef.webContents) return
    const record = downloadRecords.get(Number(id))
    if (!record || record.state !== "completed" || !record.path) return
    const error = await shell.openPath(record.path)
    if (error) windowRef.webContents.send("browser-error", error)
  })
  ipcMain.on("remove-download", (event, id) => {
    if (!windowRef || event.sender !== windowRef.webContents) return
    downloadRecords.delete(Number(id))
    sendDownloads()
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.whenReady().then(() => {
    app.setName("ViB")
    registerIpc()
    createWindow()
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
  app.on("window-all-closed", () => app.quit())
}
