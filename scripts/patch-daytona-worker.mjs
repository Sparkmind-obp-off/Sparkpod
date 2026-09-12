import { readFile, writeFile } from 'node:fs/promises'
const file = new URL('../dist/_worker.js', import.meta.url)
let source = await readFile(file, 'utf8')
const needle = 'import("../ObjectStorage.js")'
if (!source.includes(needle)) throw new Error('Expected Daytona lazy import was not found; review SDK bundling before deploy.')
source = source.replaceAll(needle, 'Promise.reject(new Error("Object storage is unavailable in SparkPod v0.1"))')
await writeFile(file, source)
