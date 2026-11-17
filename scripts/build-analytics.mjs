import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const root = new URL('../', import.meta.url);
await build({entryPoints:[fileURLToPath(new URL('src/analytics-rum.mjs',root))], outfile:fileURLToPath(new URL('dist/src/analytics-rum.bundle.mjs',root)), bundle:true, format:'esm', platform:'browser', target:'es2022', minify:true, legalComments:'linked'});
