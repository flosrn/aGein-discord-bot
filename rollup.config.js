import { del } from '@kineticcafe/rollup-plugin-delete';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';

import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

function getFiles(dir) {
  return readdirSync(dir).reduce((files, file) => {
    const name = join(dir, file);
    const isDirectory = statSync(name).isDirectory();
    if (isDirectory) {
      return files.concat(getFiles(name));
    }
    return files.concat(name);
  }, []);
}

const inputs = getFiles('src')
  .filter(
    (file) =>
      typeof file === 'string' &&
      file.endsWith('.ts') &&
      !file.endsWith('.d.ts')
  )
  .reduce((acc, file) => {
    const name = relative('src', file).replace('.ts', '');
    acc[name] = file;
    return acc;
  }, {});

export default {
  input: inputs,
  output: {
    dir: 'dist',
    format: 'esm',
    preserveModules: true,
    preserveModulesRoot: 'src',
    sourcemap: false
  },
  plugins: [
    del({ targets: 'dist/*' }),
    resolve({ preferBuiltins: true }),
    commonjs(),
    typescript({
      sourceMap: false,
      tsconfig: './tsconfig.json',
      outputToFilesystem: true,
      noEmitOnError: false
    }),
    copy({
      targets: [
        { src: 'src/config.json', dest: 'dist' } // Copie config.json vers dist
      ]
    })
  ],
  external: ['discord.js', 'dotenv', 'zod', 'node:*', /.*\.json$/]
};
