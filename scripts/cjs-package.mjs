// Marks dist/cjs as CommonJS so Node loads it with require() despite "type": "module".
import { writeFileSync } from 'node:fs';

writeFileSync(new URL('../dist/cjs/package.json', import.meta.url), '{"type": "commonjs"}\n');
