import { access, readdir, writeFile } from 'node:fs/promises';

const root = 'visual-review';
const devices = (await readdir(root, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name);
let rows = '';
let markdown = '| Device / scene | Before | After |\n| --- | --- | --- |\n';
for (const device of devices) {
  for (const scene of ['title', 'dark', 'bright']) {
    const before = `${device}/${scene}-before.png`;
    const after = `${device}/${scene}-after.png`;
    try {
      await Promise.all([access(`${root}/${before}`), access(`${root}/${after}`)]);
    } catch {
      continue;
    }
    rows += `<tr><th>${device}<br>${scene}</th><td><a href="${before}"><img src="${before}"></a></td><td><a href="${after}"><img src="${after}"></a></td></tr>`;
    markdown += `| ${device} / ${scene} | ![Before](${before}) | ![After](${after}) |\n`;
  }
}
await writeFile(`${root}/index.html`, `<!doctype html><meta charset="utf-8"><title>Grain comparison</title><style>body{background:#181818;color:#eee;font:16px system-ui;margin:24px}table{width:100%;table-layout:fixed;border-collapse:collapse}th:first-child{width:150px}td,th{padding:8px;border:1px solid #444}img{width:100%;display:block}a{color:inherit}</style><h1>Grain before / after</h1><p>Fixed seed, camera, torch frame and brightness (100%). Click an image for full size. These are emulated viewports, not measurements of physical displays.</p><table><tr><th>Device / scene</th><th>Before</th><th>After</th></tr>${rows}</table>`);
await writeFile(`${root}/PR.md`, `Grain comparison: fixed scenes and brightness at 100%.\n\n${markdown}\nImage paths are relative to this artifact. For a PR description, upload the PNGs to GitHub and replace these paths with the attachment URLs.\n`);
console.log(`Review: ${root}/index.html`);
