# GitTasks

A local-first, no-server, markdown-based todo app.

Built with [Electron](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/).

## Download

Grab the latest installer from the
[Releases page](https://github.com/LinYibo/GitTasks/releases) — look for
`GitTasks Setup x.y.z.exe`.

### Windows SmartScreen warning

The installer is **not code-signed**, so the first time you run it Windows may
show "Windows protected your PC". This is expected, not an error.

Click **More info** → **Run anyway** to continue.

(Signing costs money and requires an organizational identity we don't maintain
for this hobby project. If you don't trust the download, verify the SHA-256
hash shown on the release against the file you downloaded.)

## Development

```bash
npm install
npm run dev          # start in dev mode with hot reload
npm run typecheck    # tsc --build
npm run test         # node --test
npm run build:win    # package a Windows installer into dist/
```

## License

MIT
