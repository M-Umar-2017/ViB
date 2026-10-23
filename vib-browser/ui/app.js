const address = document.getElementById("address")
const tabList = document.getElementById("tab-list")
const webArea = document.getElementById("web-area")
const modeBadge = document.getElementById("mode-badge")
const statusMessage = document.getElementById("status-message")
const pageLabel = document.getElementById("page-label")
const zoomLabel = document.getElementById("zoom-label")
const securityMark = document.getElementById("security-mark")
const bookmarkButton = document.getElementById("bookmark")
const commandRow = document.getElementById("command-row")
const commandPrefix = document.getElementById("command-prefix")
const commandInput = document.getElementById("command-input")
const commandHint = document.getElementById("command-hint")
const panel = document.getElementById("panel")
const panelTitle = document.getElementById("panel-title")
const panelBody = document.getElementById("panel-body")
const toast = document.getElementById("toast")

let tabs = []
let activeId = null
let activePage = { title: "New tab", url: "about:blank", private: false }
let currentMode = "normal"
let pendingG = false
let toastTimer
let historyItems = readStore("vib.history", [])
let bookmarks = readStore("vib.bookmarks", [])
let downloads = []
let searchProvider = localStorage.getItem("vib.searchProvider") || "DuckDuckGo"
let panelKind = ""
let findDebounce

function readStore(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null")
    return Array.isArray(value) ? value : fallback
  } catch {
    return fallback
  }
}

function saveStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function setMode(value, message, sync = true) {
  const changed = currentMode !== value
  currentMode = value
  modeBadge.textContent = value.toUpperCase()
  modeBadge.classList.toggle("insert", value === "insert")
  modeBadge.classList.toggle("private", Boolean(activePage.private))
  if (changed && sync) window.vib.setMode(value)
  if (message) showStatus(message)
}

function showStatus(message) {
  statusMessage.textContent = message
}

function showToast(message) {
  toast.textContent = message
  toast.classList.add("visible")
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2300)
}

function measureBrowserArea() {
  const rect = webArea.getBoundingClientRect()
  window.vib.setBrowserBounds({ x: rect.left, y: rect.top, width: rect.width, height: rect.height })
}

function drawTabs() {
  tabList.replaceChildren()
  for (const tab of tabs) {
    const item = document.createElement("div")
    item.className = `tab${tab.id === activeId ? " active" : ""}`
    item.setAttribute("role", "tab")
    item.setAttribute("aria-selected", String(tab.id === activeId))
    item.tabIndex = tab.id === activeId ? 0 : -1
    item.title = tab.url
    item.addEventListener("click", () => window.vib.activateTab(tab.id))
    item.addEventListener("auxclick", event => {
      if (event.button === 1) window.vib.closeTab(tab.id)
    })
    const title = document.createElement("span")
    title.className = "tab-title"
    title.textContent = tab.title || "New tab"
    item.append(title)
    if (tab.private) {
      const mark = document.createElement("span")
      mark.className = "tab-private-mark"
      mark.title = "Private tab"
      item.append(mark)
    }
    const close = document.createElement("button")
    close.className = "tab-close"
    close.type = "button"
    close.setAttribute("aria-label", `Close ${tab.title || "tab"}`)
    close.textContent = "×"
    close.addEventListener("click", event => {
      event.stopPropagation()
      window.vib.closeTab(tab.id)
    })
    item.append(close)
    tabList.append(item)
  }
  measureBrowserArea()
}

function updateAddress(page) {
  activePage = page
  const activeTab = tabs.find(tab => tab.id === activeId)
  if (activeTab) activePage.private = activeTab.private
  if (document.activeElement !== address) address.value = page.url === "about:blank" ? "" : page.url
  pageLabel.textContent = page.title || "New tab"
  securityMark.textContent = page.url.startsWith("https://") ? "●" : page.url.startsWith("http://") ? "!" : "○"
  securityMark.classList.toggle("insecure", page.url.startsWith("http://"))
  updateBookmarkButton()
  modeBadge.classList.toggle("private", Boolean(activePage.private))
  const tab = tabs.find(item => item.id === activeId)
  if (tab) {
    const percent = Math.round((tab.zoom || 1) * 100)
    zoomLabel.textContent = `${percent}%`
  }
  if (!activePage.private && page.url && page.url !== "about:blank" && /^https?:/.test(page.url)) addHistory(page.url, page.title)
}

function addHistory(url, title) {
  const existing = historyItems.find(item => item.url === url)
  const now = Date.now()
  if (existing) {
    existing.title = title || existing.title
    existing.visitedAt = now
    historyItems = [existing, ...historyItems.filter(item => item.url !== url)]
  } else {
    historyItems.unshift({ url, title: title || url, visitedAt: now })
  }
  historyItems = historyItems.slice(0, 1000)
  saveStore("vib.history", historyItems)
}

function isBookmarked(url = activePage.url) {
  return bookmarks.some(item => item.url === url)
}

function updateBookmarkButton() {
  const saved = isBookmarked()
  bookmarkButton.textContent = saved ? "★" : "☆"
  bookmarkButton.classList.toggle("saved", saved)
  bookmarkButton.title = saved ? "Remove bookmark" : "Bookmark this page"
}

function toggleBookmark(item = activePage) {
  if (!item.url || item.url === "about:blank" || !/^https?:/.test(item.url)) {
    showToast("Open a web page before saving a bookmark")
    return
  }
  if (isBookmarked(item.url)) {
    bookmarks = bookmarks.filter(bookmark => bookmark.url !== item.url)
    showToast("Bookmark removed")
  } else {
    bookmarks.unshift({ url: item.url, title: item.title || item.url, savedAt: Date.now() })
    showToast("Bookmark saved")
  }
  saveStore("vib.bookmarks", bookmarks)
  updateBookmarkButton()
  if (panelKind === "bookmarks") renderPanel("bookmarks")
}

function focusAddress() {
  closePanel()
  address.focus()
  address.select()
  setMode("insert", "Address and search")
}

function navigateAddress(value = address.value) {
  const text = String(value).trim()
  if (!text) return
  const looksAddress = /^(https?:\/\/|about:|localhost(?::\d+)?|(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?|[^\s/]+\.[^\s/]+)(?:\/.*)?$/i.test(text)
  const searchUrls = { DuckDuckGo: "https://duckduckgo.com/?q=", Google: "https://www.google.com/search?q=", Bing: "https://www.bing.com/search?q=" }
  const target = looksAddress ? text : `${searchUrls[searchProvider] || searchUrls.DuckDuckGo}${encodeURIComponent(text)}`
  window.vib.navigate(target)
  address.blur()
  setMode("normal", "Loading")
  window.vib.focusPage()
}

function nextTab(direction) {
  if (tabs.length < 2) return
  const index = tabs.findIndex(tab => tab.id === activeId)
  const target = tabs[(index + direction + tabs.length) % tabs.length]
  window.vib.activateTab(target.id)
}

function showCommand(prefix, hint = "Enter to run · Esc to cancel") {
  closePanel()
  commandPrefix.textContent = prefix
  commandHint.textContent = hint
  commandInput.value = ""
  commandRow.hidden = false
  commandInput.focus()
  setMode("insert")
  measureBrowserArea()
}

function closeCommand() {
  commandRow.hidden = true
  commandInput.value = ""
  setMode("normal")
  measureBrowserArea()
  window.vib.focusPage()
}

function executeCommand(value) {
  const command = value.trim()
  if (!command) return closeCommand()
  commandRow.hidden = true
  if (command.startsWith("/")) {
    window.vib.findText(command.slice(1))
    showStatus(command.slice(1) ? `Find: ${command.slice(1)}` : "Find in page")
    setMode("normal")
    measureBrowserArea()
    return
  }
  if (/^(q|quit)$/.test(command)) return window.vib.closeTab(activeId)
  if (/^(tabnew|t)$/.test(command)) return window.vib.newTab()
  if (/^open\s+/i.test(command)) return navigateAddress(command.replace(/^open\s+/i, ""))
  if (/^zoom\s+\d{2,3}%?$/i.test(command)) {
    const percentage = Number(command.match(/\d+/)[0])
    window.vib.command("zoom-reset")
    const steps = Math.round((percentage - 100) / 10)
    for (let index = 0; index < Math.abs(steps); index++) window.vib.command(steps > 0 ? "zoom-in" : "zoom-out")
    setMode("normal")
    measureBrowserArea()
    return
  }
  if (command === "help") return openPanel("help")
  if (command === "history") return openPanel("history")
  if (command === "bookmarks") return openPanel("bookmarks")
  if (command === "downloads") return openPanel("downloads")
  if (command === "private") return window.vib.newPrivateTab()
  if (command === "clear-history") {
    historyItems = []
    saveStore("vib.history", historyItems)
    setMode("normal")
    showToast("Local history cleared")
    return measureBrowserArea()
  }
  setMode("normal")
  showToast(`Unknown command: ${command}`)
  measureBrowserArea()
}

function handleVimKey(data) {
  const key = data?.key
  if (key === "g") {
    pendingG = true
    return
  }
  if (pendingG) {
    pendingG = false
    if (key === "t") return nextTab(1)
    if (key === "T") return nextTab(-1)
  }
  if (key === "i") return setMode("insert", "Insert mode · Esc to return")
  if (key === "j" || key === "ArrowDown") return window.vib.command("scroll-down")
  if (key === "k" || key === "ArrowUp") return window.vib.command("scroll-up")
  if (key === "h") return window.vib.command("back")
  if (key === "l") return window.vib.command("forward")
  if (key === "r") return window.vib.command("reload")
  if (key === "o") return focusAddress()
  if (key === "t") return window.vib.newTab()
  if (key === "x") return window.vib.closeTab(activeId)
  if (key === "/") return showCommand("/", "Find in page · updates as you type")
  if (key === ":") return showCommand(":", "help · history · bookmarks · downloads · tabnew · private · open URL · quit")
  if (key === "?") return openPanel("help")
  if (key === "n") return window.vib.command("find-next")
  if (key === "N") return window.vib.command("find-previous")
  if (key === "G") return window.vib.command("bottom")
  if (key === "Home") return window.vib.command("top")
  if (key === "End") return window.vib.command("bottom")
  if (key === "+" || key === "=") return window.vib.command("zoom-in")
  if (key === "-") return window.vib.command("zoom-out")
  if (key === "Escape") return setMode("normal")
}

function renderList(items, kind, filter = "") {
  const filtered = items.filter(item => `${item.title || item.filename || ""} ${item.url || item.filename || ""}`.toLowerCase().includes(filter.toLowerCase()))
  panelBody.replaceChildren()
  if (kind !== "downloads") {
    const search = document.createElement("input")
    search.className = "panel-search"
    search.type = "search"
    search.placeholder = `Search ${kind}…`
    search.setAttribute("aria-label", `Search ${kind}`)
    search.value = filter
    search.addEventListener("input", () => {
      const value = search.value
      renderList(items, kind, value)
      const replacement = panelBody.querySelector(".panel-search")
      replacement?.focus()
      replacement?.setSelectionRange(value.length, value.length)
    })
    panelBody.append(search)
  }
  if (!filtered.length) {
    const empty = document.createElement("div")
    empty.className = "empty-state"
    empty.textContent = kind === "history" ? "Pages you visit will appear here." : kind === "bookmarks" ? "Saved pages will appear here." : "No downloads yet."
    panelBody.append(empty)
    return
  }
  for (const item of filtered) {
    const row = document.createElement("div")
    row.className = "list-item"
    const copy = document.createElement("div")
    copy.className = "list-copy"
    const title = document.createElement("div")
    title.className = "list-title"
    title.textContent = item.title || item.filename || item.url || "Download"
    const url = document.createElement("div")
    url.className = "list-url"
    url.textContent = kind === "downloads" ? `${item.private ? "Private · " : ""}${item.state || "queued"}${item.total ? ` · ${Math.round(item.received / item.total * 100)}%` : ""} · ${item.filename || ""}` : item.url
    copy.append(title, url)
    row.append(copy)
    if (kind === "bookmarks" || kind === "downloads") {
      const remove = document.createElement("button")
      remove.className = "list-remove"
      remove.type = "button"
      remove.textContent = "×"
      remove.title = kind === "bookmarks" ? "Remove bookmark" : "Remove from list"
      remove.addEventListener("click", event => {
        event.stopPropagation()
        if (kind === "bookmarks") {
          bookmarks = bookmarks.filter(bookmark => bookmark.url !== item.url)
          saveStore("vib.bookmarks", bookmarks)
          renderPanel("bookmarks")
          updateBookmarkButton()
        } else {
          window.vib.removeDownload(item.id)
          downloads = downloads.filter(download => download.id !== item.id)
          renderPanel("downloads")
        }
      })
      row.append(remove)
    }
    row.addEventListener("click", () => {
      if (kind === "downloads") {
        if (item.state === "completed") window.vib.openDownload(item.id)
        return
      }
      if (item.url) {
        closePanel()
        window.vib.navigate(item.url)
        window.vib.focusPage()
      }
    })
    panelBody.append(row)
  }
}

function renderPanel(kind) {
  panelKind = kind
  const names = { history: "History", bookmarks: "Saved pages", downloads: "Downloads", help: "Keyboard shortcuts", menu: "Browser menu", settings: "Settings" }
  panelTitle.textContent = names[kind] || "ViB"
  panelBody.replaceChildren()
  if (["history", "bookmarks", "downloads"].includes(kind)) {
    const items = kind === "history" ? historyItems : kind === "bookmarks" ? bookmarks : downloads
    renderList(items, kind)
  } else if (kind === "help") {
    const entries = [["Scroll down / up", "j / k"], ["Back / forward", "h / l"], ["Reload", "r"], ["Address / search", "o"], ["New / close tab", "t / x"], ["Next / previous tab", "g t / g T"], ["Insert mode / normal mode", "i / Esc"], ["Find in page", "/, then n / N"], ["Browser command line", ":"], ["Zoom in / out", "+ / −"], ["New private tab", "Ctrl+Shift+N"], ["Browser shortcuts", "Ctrl+L / T / W / F"]]
    const grid = document.createElement("div")
    grid.className = "help-grid"
    for (const [label, keys] of entries) {
      const row = document.createElement("div")
      row.className = "help-row"
      const text = document.createElement("span")
      text.textContent = label
      const kbd = document.createElement("kbd")
      kbd.textContent = keys
      row.append(text, kbd)
      grid.append(row)
    }
    panelBody.append(grid)
  } else if (kind === "menu") {
    const grid = document.createElement("div")
    grid.className = "menu-grid"
    const choices = [["New tab", () => window.vib.newTab()], ["New private tab", () => window.vib.newPrivateTab()], ["History", () => openPanel("history")], ["Saved pages", () => openPanel("bookmarks")], ["Downloads", () => openPanel("downloads")], ["Settings", () => openPanel("settings")], ["Keyboard shortcuts", () => openPanel("help")]]
    for (const [label, action] of choices) {
      const button = document.createElement("button")
      button.className = "menu-item"
      button.type = "button"
      button.textContent = label
      button.addEventListener("click", action)
      grid.append(button)
    }
    panelBody.append(grid)
  } else if (kind === "settings") {
    const heading = document.createElement("p")
    heading.className = "settings-section"
    heading.textContent = "Search"
    const row = document.createElement("label")
    row.className = "setting-row"
    row.append(document.createTextNode("Search provider"))
    const select = document.createElement("select")
    for (const provider of ["DuckDuckGo", "Google", "Bing"]) {
      const option = document.createElement("option")
      option.value = provider
      option.textContent = provider
      option.selected = provider === searchProvider
      select.append(option)
    }
    select.addEventListener("change", () => {
      searchProvider = select.value
      localStorage.setItem("vib.searchProvider", searchProvider)
      showToast(`Search provider set to ${searchProvider}`)
    })
    row.append(select)
    const note = document.createElement("p")
    note.className = "panel-note"
    note.textContent = "Private tabs do not add visits to local history. Site permissions are denied by default. Regular-profile cookies and site data are stored on this device."
    const clear = document.createElement("button")
    clear.className = "panel-action danger"
    clear.type = "button"
    clear.textContent = "Clear local history"
    clear.addEventListener("click", () => {
      historyItems = []
      saveStore("vib.history", historyItems)
      showToast("Local history cleared")
    })
    const clearData = document.createElement("button")
    clearData.className = "panel-action danger"
    clearData.type = "button"
    clearData.textContent = "Clear cookies and site data"
    clearData.addEventListener("click", () => {
      if (window.confirm("Clear saved cookies, site storage, and cache for the regular profile? This will sign you out of websites.")) window.vib.clearSiteData()
    })
    panelBody.append(heading, row, note, clear, clearData)
  }
}

function openPanel(kind) {
  panel.hidden = false
  setMode("normal")
  window.vib.panelOpen(true)
  renderPanel(kind)
}

function closePanel() {
  if (panel.hidden) return
  panel.hidden = true
  panelKind = ""
  window.vib.panelOpen(false)
  setMode("normal")
  measureBrowserArea()
}

function applyShortcut(action, data) {
  if (action === "focus-address") return focusAddress()
  if (action === "private-tab") return window.vib.newPrivateTab()
  if (action === "site-data-cleared") return showToast("Cookies, site storage, and cache cleared")
  if (action === "new-tab") return window.vib.newTab()
  if (action === "close-tab") return window.vib.closeTab(activeId)
  if (action === "reload") return window.vib.command("reload")
  if (action === "find") return showCommand("/", "Find in page · updates as you type")
  if (action === "bookmark") return toggleBookmark()
  if (action === "next-tab") return nextTab(1)
  if (action === "previous-tab") return nextTab(-1)
  if (action === "zoom-in" || action === "zoom-out" || action === "zoom-reset") return window.vib.command(action)
  if (action === "page-mode") {
    const focusedInput = document.activeElement === address || document.activeElement === commandInput || panel.contains(document.activeElement) && document.activeElement.matches("input, select, textarea")
    if (!focusedInput) setMode(data, undefined, false)
    return
  }
  if (action === "mode-normal") {
    setMode("normal", "Normal mode")
    return
  }
  if (action === "vim-key") return handleVimKey(data)
}

window.vib.onTabs(payload => {
  tabs = payload.tabs
  activeId = payload.activeId
  drawTabs()
  const active = tabs.find(tab => tab.id === activeId)
  if (active) updateAddress(active)
  const focusedInput = document.activeElement === address || document.activeElement === commandInput || panel.contains(document.activeElement) && document.activeElement.matches("input, select, textarea")
  setMode(focusedInput ? "insert" : payload.mode, undefined, false)
})

window.vib.onActivePage(page => updateAddress(page))
window.vib.onShortcut(applyShortcut)
window.vib.onVimKey(handleVimKey)
window.vib.onBrowserError(message => showToast(message))
window.vib.onPageLoadError(data => showStatus(`Could not load page: ${data.description}`))
window.vib.onDownloads(items => {
  downloads = items
  if (panelKind === "downloads") renderPanel("downloads")
})
window.vib.onMeasure(measureBrowserArea)

window.vib.bootstrap().then(state => {
  tabs = state.tabs
  activeId = state.activeId
  downloads = state.downloads
  drawTabs()
  setMode(state.mode)
})

new ResizeObserver(measureBrowserArea).observe(webArea)
new ResizeObserver(measureBrowserArea).observe(document.querySelector(".app-shell"))
window.addEventListener("resize", measureBrowserArea)

address.addEventListener("focus", () => setMode("insert", "Address and search"))
address.addEventListener("blur", () => {
  if (document.activeElement !== commandInput) setMode("normal")
})
address.addEventListener("keydown", event => {
  if (event.key === "Enter") navigateAddress()
  if (event.key === "Escape") {
    address.blur()
    setMode("normal")
    window.vib.focusPage()
  }
})

commandInput.addEventListener("input", () => {
  if (commandPrefix.textContent === "/") {
    clearTimeout(findDebounce)
    const query = commandInput.value
    findDebounce = setTimeout(() => window.vib.findText(query), 90)
  }
})

commandInput.addEventListener("keydown", event => {
  if (event.key === "Enter") executeCommand(`${commandPrefix.textContent}${commandInput.value}`)
  if (event.key === "Escape") closeCommand()
})

document.addEventListener("keydown", event => {
  const mod = event.ctrlKey || event.metaKey
  if (mod) {
    const key = event.key.toLowerCase()
    if (key === "l") { event.preventDefault(); focusAddress(); return }
    if (key === "t") { event.preventDefault(); window.vib.newTab(); return }
    if (key === "w") { event.preventDefault(); window.vib.closeTab(activeId); return }
    if (key === "f") { event.preventDefault(); showCommand("/", "Find in page · updates as you type"); return }
    if (key === "d") { event.preventDefault(); toggleBookmark(); return }
    if (key === "r") { event.preventDefault(); window.vib.command("reload"); return }
    if (key === "Tab") { event.preventDefault(); nextTab(event.shiftKey ? -1 : 1); return }
    if (key === "+") { event.preventDefault(); window.vib.command("zoom-in"); return }
    if (key === "-") { event.preventDefault(); window.vib.command("zoom-out"); return }
    if (key === "0") { event.preventDefault(); window.vib.command("zoom-reset"); return }
    if (key === "n" && event.shiftKey) { event.preventDefault(); window.vib.newPrivateTab(); return }
  }
  if (event.key === "Escape" && !commandRow.hidden) {
    event.preventDefault()
    closeCommand()
  }
  if (event.key === "Escape" && !panel.hidden) {
    event.preventDefault()
    closePanel()
    window.vib.focusPage()
  }
  if (event.key === "Escape" && currentMode === "insert" && document.activeElement !== address && document.activeElement !== commandInput) {
    setMode("normal")
    window.vib.focusPage()
  }
  if (event.key === "F6") {
    event.preventDefault()
    focusAddress()
  }
})

for (const [id, command] of [["back", "back"], ["forward", "forward"], ["reload", "reload"]]) {
  document.getElementById(id).addEventListener("click", () => {
    window.vib.command(command)
    window.vib.focusPage()
  })
}

document.getElementById("new-tab").addEventListener("click", () => window.vib.newTab())
document.getElementById("private-tab").addEventListener("click", () => window.vib.newPrivateTab())
document.getElementById("history").addEventListener("click", () => openPanel("history"))
document.getElementById("bookmarks").addEventListener("click", () => openPanel("bookmarks"))
document.getElementById("downloads").addEventListener("click", () => openPanel("downloads"))
document.getElementById("menu").addEventListener("click", () => openPanel("menu"))
bookmarkButton.addEventListener("click", () => toggleBookmark())
document.getElementById("panel-close").addEventListener("click", () => closePanel())
panel.addEventListener("click", event => {
  if (event.target === panel) closePanel()
})

document.addEventListener("click", event => {
  if (event.target.closest(".tab")) return
  if (event.target.closest("button")) return
})

window.addEventListener("beforeunload", () => {
  saveStore("vib.history", historyItems)
  saveStore("vib.bookmarks", bookmarks)
})

setTimeout(measureBrowserArea, 80)
