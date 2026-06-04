#!/usr/bin/env node
// Extract unique YouTube video IDs from a saved playlist page (either layout —
// see lib-extract.mjs) in playlist order, and write a numbered list to a
// markdown document.
//
// Usage: node scripts/extract-watch-ids.mjs [input.html] [output.md]

import { readFile, writeFile } from 'node:fs/promises'
import { extractEntries } from './lib-extract.mjs'

const input = process.argv[2] ?? 'run-regex.html'
const output = process.argv[3] ?? 'regex-output.md'

const html = await readFile(input, 'utf8')
const { ids } = extractEntries(html)

const lines = [
  `# Video ID extraction — ${input}`,
  '',
  `Unique IDs: ${ids.length}`,
  '',
  ...ids.map((id, i) => `${i + 1}. ${id}`),
  '',
]

await writeFile(output, lines.join('\n'), 'utf8')
console.log(`Wrote ${ids.length} unique IDs to ${output}`)
