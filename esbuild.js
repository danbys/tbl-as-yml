import * as esbuild from 'esbuild';
import pkg from './package.json' assert { type: 'json' };

esbuild.build({
    entryPoints: ['index.js'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    outfile: `${pkg.name}-${pkg.version}.js`,
    sourcemap: 'inline',
    minify: true, // Minify the output
    define: { 'process.env.NODE_ENV': '"production"' }
}).catch(() => process.exit(1))