# ViB build checkpoint

## Repository and architecture

The source is in the private GitHub repository [M-Umar-2017/ViB](https://github.com/M-Umar-2017/ViB). It was pushed on branch `ViB`, which is also the default branch. The upstream `vim/vim` repository remains the local source starting point; the existing Vim editor has not been turned into the browser UI. Electron provides the desktop window and bundled Chromium renders pages.

## Working foundation

The Linux-first GUI has a tab strip, address/search bar, back/forward/reload, bookmarks, history, downloads, a dark browser-style new-tab page, regular/private profile separation, configurable search engines, zoom, find-in-page, basic settings and local-data clearing. Normal/insert mode keyboard controls are implemented; the page preload signals editable form focus without exposing Node or IPC to websites. Browser page permissions are denied by default, and private-tab visits and download-list entries are not persisted.

## Verification and packages

`npm install` completed and `npm run check` passed for the Electron main process, both preloads, and the UI code. Electron launched under Xvfb with Chromium's sandbox enabled. DevTools smoke tests confirmed browser chrome rendering, tab/private-tab creation, panel toggling, and address-field shortcut behavior. Linux x64 and ARM64 AppImages and Windows x64 and ARM64 portable ZIPs were uploaded to the private [ViB 0.1.0 Alpha 1 prerelease](https://github.com/M-Umar-2017/ViB/releases/tag/v0.1.0-alpha.1), along with SHA-256 checksums. Windows ZIPs were cross-built on Linux and archive-integrity checked, but no Windows runtime test or installer is included. These are early development assets, not a security-audited browser release.

## Next work

Verify the Linux packages in their target environments and the Windows ZIPs on Windows, then test page navigation, history, and downloads end-to-end. Continue focusing on browser essentials and avoid unrelated feature additions.
