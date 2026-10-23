# ViB

ViB is a browser-first desktop application with Vim-inspired keyboard navigation. Its visible surface is browser chrome—tabs, address/search, page controls, bookmarks, history, downloads, and browser settings—not a text editor. Chromium, bundled through Electron, renders sites. The upstream Vim checkout is the requested local source starting point; the browser engine is separate because Vim does not render modern web pages.

## Repository and release

The source is in the private repository [M-Umar-2017/ViB](https://github.com/M-Umar-2017/ViB), on the `ViB` default branch. The initial alpha packages are available in the [ViB 0.1.0 Alpha 1 prerelease](https://github.com/M-Umar-2017/ViB/releases/tag/v0.1.0-alpha.1). The upstream Vim checkout remains local as the source starting point; its push URL stays disabled.

## Run from source

Requires Node.js 20 or newer.

```sh
cd /home/ubuntu/ViB/vib-browser
npm install
npm start
```

Run syntax checks with `npm run check`.

## Package targets

```sh
npm run pack:linux          # Linux x64 AppImage
npm run pack:linux:arm64    # Linux ARM64 AppImage
npm run pack:win            # Windows x64 ZIP
npm run pack:win:arm64      # Windows ARM64 ZIP
```

Linux x64 and ARM64 AppImages and Windows x64 and ARM64 portable ZIPs are attached to the alpha release. The Windows ZIPs were cross-built and archive-integrity checked but require functional checks on Windows. The Windows NSIS installer target is not included in this prototype build.

## Working prototype scope

The initial application shell has an isolated browser chrome process and isolated Chromium page views, persistent cookies/site data for the regular profile, in-memory private tabs, HTTP/HTTPS navigation and configurable address-bar search, tab switching, back/forward/reload, page zoom, find-in-page, downloads, bookmarks and local history, a browser-style new-tab page, settings for search provider and clearing local data, plus Vim-inspired normal/insert navigation. Site permissions are denied by default. Private-tab visits and download-list entries are not persisted.

This is an early development build, not yet a full release or security audit. Remaining work is end-to-end testing of page navigation/history/download edge cases, accessible controls, Windows package/functional checks, and broader install verification. Keep development focused on expected browser behavior rather than unrelated utilities.

## Keyboard basics

| Key | Action |
| --- | --- |
| `j` / `k` | Scroll down / up |
| `h` / `l` | Back / forward |
| `r` | Reload |
| `o` | Focus address/search |
| `t` / `x` | New / close tab |
| `g t` / `g T` | Next / previous tab |
| `i` / `Escape` | Enter insert / return to normal mode |
| `/`, then `n` / `N` | Find / next / previous match |
| `:` | Browser command line |
| `?` | Show keyboard shortcuts |
| `+` / `-` | Zoom in / out |
| `Ctrl+L`, `Ctrl+T`, `Ctrl+W`, `Ctrl+F` | Address, new tab, close tab, find |
| `Ctrl+Shift+N` | New private tab |
