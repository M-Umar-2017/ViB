# ViB build checkpoint

## Repository and architecture

The upstream `vim/vim` repository is cloned locally at `/home/ubuntu/ViB`. ViB's app source is in `vib-browser/`; the existing Vim editor has not been turned into the browser UI. Electron provides the desktop window and bundled Chromium renders pages. The user authorized creating a private GitHub repository named `ViB` and publishing the source and release assets; no public repository is intended.

## Working foundation

The Linux-first GUI has a tab strip, address/search bar, back/forward/reload, bookmarks, history, downloads, a dark browser-style new-tab page, regular/private profile separation, configurable search engines, zoom, find-in-page, basic settings and local-data clearing. Normal/insert mode keyboard controls are implemented; the page preload signals editable form focus without exposing Node or IPC to websites. Browser page permissions are denied by default, and private-tab visits and download-list entries are not persisted.

## Verification and packages

`npm install` completed and `npm run check` passed for the Electron main process, both preloads, and the UI code. Electron launched under Xvfb with Chromium's sandbox enabled. DevTools smoke tests confirmed browser chrome rendering, tab/private-tab creation, panel toggling, and keyboard focus of the address field. Linux x64 and ARM64 AppImages were generated locally. A Windows ARM64 ZIP was also generated; the NSIS installer attempt failed on this Linux ARM64 host, so portable ZIPs are the current Windows package format. Windows x64 packaging and target-platform testing remain pending. These are early development assets, not a security-audited browser release.

## Next work

Complete the Windows x64 ZIP and functional checks on Windows, verify Linux packages in their target environments, and test page navigation, history, and downloads end-to-end. Continue focusing on browser essentials and avoid unrelated feature additions.
