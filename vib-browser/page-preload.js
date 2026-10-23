const { ipcRenderer } = require("electron")

function isEditable(element) {
  if (!(element instanceof HTMLElement)) return false
  if (element.isContentEditable) return true
  if (!["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName)) return false
  return !element.disabled && !element.readOnly && element.type !== "button" && element.type !== "submit" && element.type !== "reset"
}

function reportFocus() {
  ipcRenderer.send("page-input-mode", isEditable(document.activeElement))
}

document.addEventListener("focusin", event => {
  ipcRenderer.send("page-input-mode", isEditable(event.target))
}, true)

document.addEventListener("focusout", () => {
  setTimeout(reportFocus, 0)
}, true)
