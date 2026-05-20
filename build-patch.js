import fs from 'fs'
import path from 'path'

function patchTsconfig(filePath) {
  if (!fs.existsSync(filePath)) {
    return false
  }

  let content = fs.readFileSync(filePath, 'utf-8')
  const originalContent = content

  // Replace deprecated options with new ones
  content = content.replace(
    /"importsNotUsedAsValues":\s*"error"/g,
    '"verbatimModuleSyntax": true'
  )
  
  // Remove preserveValueImports if it exists
  content = content.replace(/,?\s*"preserveValueImports":\s*true/g, '')

  // Ensure ignoreDeprecations is set
  if (!content.includes('"ignoreDeprecations"')) {
    content = content.replace(
      /"target":\s*"esnext"/g,
      '"target": "esnext",\n\t\t"ignoreDeprecations": "5.0"'
    )
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content)
    return true
  }
  return false
}

// Patch .svelte-kit/tsconfig.json
const svelteKitDir = '.svelte-kit'
if (!fs.existsSync(svelteKitDir)) {
  fs.mkdirSync(svelteKitDir)
}

const tsconfigPath = path.join(svelteKitDir, 'tsconfig.json')

// Create a default tsconfig if it doesn't exist
if (!fs.existsSync(tsconfigPath)) {
  const defaultConfig = {
    compilerOptions: {
      paths: {
        '$root': ['..'],
        '$root/*': ['../*'],
        '$lib': ['../src/lib'],
        '$lib/*': ['../src/lib/*']
      },
      rootDirs: ['..', './types'],
      verbatimModuleSyntax: true,
      isolatedModules: true,
      lib: ['esnext', 'DOM', 'DOM.Iterable'],
      moduleResolution: 'node',
      module: 'esnext',
      noEmit: true,
      target: 'esnext',
      ignoreDeprecations: '5.0'
    },
    include: [
      'ambient.d.ts',
      './types/**/$types.d.ts',
      '../vite.config.js',
      '../vite.config.ts',
      '../src/**/*.js',
      '../src/**/*.ts',
      '../src/**/*.svelte',
      '../tests/**/*.js',
      '../tests/**/*.ts',
      '../tests/**/*.svelte'
    ],
    exclude: [
      '../node_modules/**',
      './[!ambient.d.ts]**',
      '../src/service-worker.js',
      '../src/service-worker.ts',
      '../src/service-worker.d.ts'
    ]
  }
  fs.writeFileSync(tsconfigPath, JSON.stringify(defaultConfig, null, 2))
} else if (patchTsconfig(tsconfigPath)) {
  console.log('✓ Patched .svelte-kit/tsconfig.json to fix deprecated TypeScript options')
}

// Also patch @sveltejs/kit's tsconfig in node_modules
const kitTsconfigPaths = [
  'node_modules/.pnpm/@sveltejs+kit@*/node_modules/@sveltejs/kit/tsconfig.json',
  'node_modules/@sveltejs/kit/tsconfig.json'
]

for (const pattern of kitTsconfigPaths) {
  // Simple glob matching
  const baseDir = 'node_modules/.pnpm'
  if (fs.existsSync(baseDir)) {
    const entries = fs.readdirSync(baseDir)
    const kitEntry = entries.find(e => e.startsWith('@sveltejs+kit@'))
    if (kitEntry) {
      const kitPath = path.join(baseDir, kitEntry, 'node_modules/@sveltejs/kit/tsconfig.json')
      if (patchTsconfig(kitPath)) {
        console.log('✓ Patched @sveltejs/kit tsconfig.json')
      }
    }
  }
}

// Patch svelte-preprocess to ignore TypeScript deprecation warnings
const sveltePreprocessDir = 'node_modules/.pnpm'
if (fs.existsSync(sveltePreprocessDir)) {
  const entries = fs.readdirSync(sveltePreprocessDir)
  const preprocessEntry = entries.find(e => e.includes('svelte-preprocess'))
  if (preprocessEntry) {
    const tsPath = path.join(sveltePreprocessDir, preprocessEntry, 'node_modules/svelte-preprocess/dist/transformers/typescript.js')
    if (fs.existsSync(tsPath)) {
      let content = fs.readFileSync(tsPath, 'utf-8')
      // Replace hasError check to ignore TS5102 deprecation warnings
      if (!content.includes('PATCHED')) {
        // Find and patch the line that checks for errors
        content = content.replace(
          /const hasError = diagnostics\.some\(\(d\) => d\.category === typescript_1\.default\.DiagnosticCategory\.Error\);/,
          `const hasError = diagnostics.some((d) => {
            if (d.category === typescript_1.default.DiagnosticCategory.Error) {
              // PATCHED: Ignore TS5102 deprecation errors
              const code = d.code;
              if (code === 5102) return false;
              return true;
            }
            return false;
          });`
        )
        fs.writeFileSync(tsPath, content)
        console.log('✓ Patched svelte-preprocess to ignore TS5102 deprecation errors')
      }
    }
  }
}

