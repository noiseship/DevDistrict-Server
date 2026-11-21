import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const directory = resolve('dist');
let html = readFileSync(resolve(directory, 'index.html'), 'utf8');
const pattern = /<script\b[^>]*src="\.\/(assets\/[^" ]+\.js)"[^>]*><\/script>/g;
const matches = [...html.matchAll(pattern)];
if (matches.length !== 1) throw Error('Expected one application bundle');
const path = matches[0][1];
const bytes = readFileSync(resolve(directory, path));
const integrity = 'sha384-' + createHash('sha384').update(bytes).digest('base64');
html = html.replace(pattern, '');
// Classic script runs after the DOM. Integrity rejects incomplete/altered bytes.
const tag = '<script src="/runtime-config.js"></script><script id="application-bundle" src="./' + path + '" integrity="' + integrity + '" crossorigin="anonymous" onerror="window.applicationLoadFailed()"></script>';
html = html.replace('</body>', () => tag + '</body>');
writeFileSync(resolve(directory, 'index.html'), html);
