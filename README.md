<p align="center">
  <img src="vib-browser/vib-logo.png" alt="ViB" width="250">
</p>

<h1 align="center">ViB — Vim-inspired Browser</h1>

<p align="center">A keyboard-first desktop web browser with Vim-inspired navigation.</p>

## What is ViB?

ViB is a browser-first desktop application: its main interface is tabs, an address/search bar, navigation controls, and web pages—not a text editor. It brings Vim-style modal keyboard navigation to desktop browsing. Electron provides the desktop shell and bundled Chromium renders modern websites; Vim itself is not being used as a web rendering engine.

This is an early alpha prototype, not yet a complete production browser or a security-audited release. The ViB application source lives in [`vib-browser/`](vib-browser/); this repository retains the upstream Vim source history as requested.

## Get ViB 0.1.0 Alpha 1

Download assets from the private [ViB 0.1.0 Alpha 1 prerelease](https://github.com/M-Umar-2017/ViB/releases/tag/v0.1.0-alpha.1):

| Platform | Package |
| --- | --- |
| Linux x64 | [AppImage](https://github.com/M-Umar-2017/ViB/releases/download/v0.1.0-alpha.1/ViB-0.1.0.AppImage) |
| Linux ARM64 | [AppImage](https://github.com/M-Umar-2017/ViB/releases/download/v0.1.0-alpha.1/ViB-0.1.0-arm64.AppImage) |
| Windows x64 | [Portable ZIP](https://github.com/M-Umar-2017/ViB/releases/download/v0.1.0-alpha.1/ViB-0.1.0-win.zip) |
| Windows ARM64 | [Portable ZIP](https://github.com/M-Umar-2017/ViB/releases/download/v0.1.0-alpha.1/ViB-0.1.0-arm64-win.zip) |
| Checksums | [SHA256SUMS.txt](https://github.com/M-Umar-2017/ViB/releases/download/v0.1.0-alpha.1/SHA256SUMS.txt) |

To run an AppImage on Linux, download it, make it executable, and launch it:

```sh
chmod +x ViB-0.1.0.AppImage
./ViB-0.1.0.AppImage
```

For Windows, extract the ZIP and launch `ViB.exe`. The Windows ZIPs were cross-built and archive-integrity checked on Linux; they have not yet been functionally tested on Windows. No Windows installer is included.

## Current features

- Tabbed browsing, address/search, back/forward, reload, and a browser-style new-tab page.
- Configurable search provider, bookmarks, local history, downloads, page zoom, and find-in-page.
- Regular and private tabs, basic settings, and local browsing-data clearing.
- Vim-inspired normal/insert modes, page scrolling, tab and navigation shortcuts.
- Browser page permissions are denied by default; private visits and private download-list entries are not persisted.

The prototype still needs broader navigation/download edge-case testing, target-platform install/runtime checks, accessibility review, and a security audit. Treat alpha packages accordingly.

## Build from source

Requires Node.js 20 or newer. From the browser app directory:

```sh
cd vib-browser
npm install
npm start
npm run check
```

Package commands:

```sh
npm run pack:linux          # Linux x64 AppImage
npm run pack:linux:arm64    # Linux ARM64 AppImage
npm run pack:win            # Windows x64 ZIP
npm run pack:win:arm64      # Windows ARM64 ZIP
```

See [`vib-browser/README.md`](vib-browser/README.md) for the app's keyboard reference and implementation notes, and [`vib-browser/STATUS.md`](vib-browser/STATUS.md) for the current build checkpoint. Existing Vim copyright, licensing, and upstream notices remain in the repository; see `LICENSE` and the relevant source-file headers.
