#!/usr/bin/env node
const { spawn } = require('node:child_process')
const { createRequire } = require('node:module')
const path = require('node:path')

const requireFromRoot = createRequire(path.resolve(process.cwd(), 'package.json'))
let viteBinPath

try {
  viteBinPath = requireFromRoot.resolve('vite/bin/vite.js')
} catch (error) {
  console.error('\u274c  No se encontró la dependencia "vite" en node_modules.')
  console.error('    Ejecuta "npm install" para instalar las dependencias antes de usar este comando.')
  process.exit(1)
}

const args = process.argv.slice(2)

const child = spawn(process.execPath, [viteBinPath, ...args], {
  stdio: 'inherit',
  env: process.env
})

child.on('exit', code => {
  process.exit(code === null ? 0 : code)
})
