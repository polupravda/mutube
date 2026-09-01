#!/usr/bin/env node
// Build sub-collections for each collection in a Mutube backup JSON:
//   - Numberblocks & Wild Kratts -> by season (parsed from titles)
//   - Super Why & Dr. Binocs      -> by topic (keyword buckets)
// Idempotent: recomputed from videoIds + titles each run; sub-collection ids are
// derived from the name so they stay stable.
//
// Usage: node scripts/split-collections.mjs [library.json]   (defaults to mutube-library.json)

import { readFile, writeFile } from 'node:fs/promises'

const backupPath = process.argv[2] ?? 'mutube-library.json'

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// ---- season parsing ----
function seasonName(title) {
  const m = title.match(/S0*(\d+)\s*E/i) || title.match(/Season\s+(\d+)/i)
  return m ? `Season ${Number(m[1])}` : null
}

// ---- topic buckets (ordered; first keyword hit wins) ----
const DR_BINOCS = [
  ['Viruses & Diseases', ['virus', 'disease', 'corona', 'covid', 'pandemic', 'infect', 'ebola', 'zika', 'nipah', 'flu', 'bacteria', 'immune', 'vaccine', 'cancer', 'fever', 'plague', 'epidemic', 'malaria', 'allerg', 'ulcer', 'diabetes', 'syndrome']],
  ['Famous People', ['federer', 'sachin', 'tendulkar', 'ronaldo', 'mandela', 'usain bolt', 'helen keller', 'einstein', 'gandhi', 'newton the', 'messi', 'edison', 'tesla', 'lincoln', 'shakespeare', 'greatest scientist', 'kalam', 'da vinci']],
  ['Space & Universe', ['space', 'planet', 'solar', ' sun', 'moon', 'star', 'galaxy', 'universe', 'mars', 'jupiter', 'saturn', 'venus', 'comet', 'asteroid', 'eclipse', 'astronaut', 'rocket', 'satellite', 'black hole', 'white hole', 'meteor', 'orbit', 'gravity', 'nebula', 'cosmos']],
  ['Human Body & Health', ['body', 'brain', 'heart', 'blood', 'bone', 'muscle', 'lung', 'teeth', 'tooth', 'skin', 'digest', 'sleep', 'dream', 'hiccup', 'sneeze', 'organ', 'nervous', 'kidney', 'liver', ' eye', ' ear', 'hormone', 'puberty', 'dna', 'cell', 'vitamin', 'tongue', 'hair', 'stomach', 'cough', 'breath', 'fart', 'gassy', 'urine', 'sweat', 'smell', 'nail', 'acid', 'adhd', 'sugar', 'nose', 'burp', 'yawn', 'goosebump', 'fingerprint', 'belly']],
  ['Animals & Insects', ['animal', 'dinosaur', 'shark', 'snake', 'spider', 'insect', 'lion', 'tiger', 'elephant', ' dog', ' cat', 'bird', 'fish', 'whale', 'octopus', ' ant', ' bee', 'mosquito', 'extinct', ' bat', 'frog', 'dolphin', 'penguin', 'bear', 'wolf', 'crocodile', 'reptile', 'mammal', 'butterfly', 'kangaroo', 'giraffe', 'monkey', 'rhino', 'hippo', 'camel', 'horse', 'cheetah', 'leopard', 'lizard', 'stingray', 'predator', 'prehistoric', 'squid', 'jellyfish', 'turtle', 'eagle', 'owl', 'scorpion']],
  ['Survival & Safety', ['survive', 'survival', 'escape', 'safety', 'drown', 'elevator', 'attacked', 'attack', ' lost', 'rescue', 'quicksand', 'stranded', 'emergency', 'first aid']],
  ['Nature & Earth', ['volcano', 'earthquake', 'weather', ' rain', 'storm', 'tsunami', 'climate', 'pollution', 'ocean', 'river', 'mountain', 'forest', ' tree', 'plant', 'water cycle', 'hurricane', 'tornado', 'lightning', 'season', 'recycl', 'environment', 'glacier', 'desert', 'earth', 'fossil', 'rainbow', 'cloud', 'flood', 'drought', 'avalanche', 'wildfire', 'soil']],
  ['Physics & Forces', ['thermodynamic', 'newton', 'law of motion', 'absolute zero', 'friction', 'momentum', 'force', 'velocity', 'inertia', 'pressure', 'density', 'relativity', 'quantum']],
  ['Science & Inventions', ['invent', 'machine', 'electric', 'magnet', 'energy', ' light', 'sound', 'engine', 'robot', 'computer', 'internet', 'telephone', 'gadget', 'science', 'experiment', 'chemical', 'atom', ' fire', 'battery', 'laser', 'glass', 'plastic', 'how does', 'how do', 'how is', 'how are', 'what is', 'what are', 'why do', 'why is']],
  ['History & Civilizations', ['history', 'ancient', 'egypt', 'pyramid', ' war', 'king', 'queen', 'empire', 'civiliz', 'mummy', 'wonder', 'monument', 'castle', 'titanic', 'wall of china']],
]

const SUPER_WHY = [
  ['Holidays & Special Days', ['christmas', 'chanukah', 'hanukkah', 'halloween', 'nutcracker', 'thanksgiving', 'easter', 'night before', 'valentine', 'birthday', 'holiday', 'new year']],
  ['Classic Fairy Tales', ['cinderella', 'pigs', 'beanstalk', 'jack', 'red riding hood', 'goldilock', 'three bears', 'humpty', 'hare', 'tortoise', 'beauty and the beast', 'frog prince', 'princess pea', 'tom thumb', 'bo peep', 'grasshopper', 'rumpel', 'snow white', 'rapunzel', 'gingerbread', 'ugly duckling', 'emperor', 'cried wolf', 'mermaid', 'peter', 'aladdin', 'pinocchio', 'thumbelina', 'rooster', 'goose', 'elves', 'dish ran', 'billy goat', 'muffet', 'porridge', 'alice', 'wonderland', 'prince', 'pauper', 'rice cake', 'foolish wish', 'princess', 'king eddie', 'fairy', 'genie', 'dragon', 'troll', 'giant']],
  ['Letters & Reading', ['super readers', 'super reader', 'alphabet', ' letter', 'reading', 'book of', 'the cookbook', 'word play', 'story of', 'storybook', 'spelling', 'rhyme']],
  ['Mysteries & Rescues', ['mystery', 'missing', 'bandit', 'detective', 'find', 'lost', 'rescue', 'treasure', 'search', 'case of', 'whodunit', 'attack of']],
  ['Adventures & Quests', ['adventure', 'quest', 'journey', 'space', 'world', ' map', 'expedition', 'voyage', 'circus', 'carnival', 'around the', 'race', 'camping', 'obstacle', 'game', 'show', 'big slide', 'challenge']],
  ['Animal Friends', ['puppy', ' dog', ' cat ', 'caterpillar', 'butterfly', 'sheep', ' pig', 'wolf', 'croc', 'bird', 'bunny', 'kitten', 'woofster', 'porcupine', 'whale', 'frog', 'monster', 'munch']],
  ['Lessons & Friendship', ['teamwork', 'focus', 'plan', 'courage', 'friend', 'share', ' sad', 'grumpy', 'brave', 'help', 'learn', 'feeling', 'kind', 'manners', 'fear', 'bedtime', 'mud', 'happy']],
]

// Order matters: Minecraft before the generic "animation vs" catch-all.
const ALAN_BECKER = [
  ['Animation vs. Minecraft', ['minecraft']],
  ['Animator vs. Animation', ['animator vs']],
  ['Animation vs. Education', ['animation vs']],
]

const OCTONAUTS = [
  ['Specials & Songs', ['theme song', 'special', 'compilation', ' song']],
  ['Above & Beyond', ['above']],
  ['Creature Reports', ['octonaut']], // catch-all for the classic episodes
]

const PEG_CAT = [['Math Problems', ['problem']]] // everything else -> otherName

function bucketName(title, buckets) {
  const t = ` ${title.toLowerCase()} `
  for (const [name, kws] of buckets) {
    if (kws.some((k) => t.includes(k))) return name
  }
  return 'Other'
}

// ---- alphabetical (by an extracted key) ----
const ALPHA_RANGES = [
  ['A–E', 'A', 'E'],
  ['F–J', 'F', 'J'],
  ['K–O', 'K', 'O'],
  ['P–T', 'P', 'T'],
  ['U–Z', 'U', 'Z'],
]
// Xavier Riddle episodes name a historical figure in a few title formats
// ("...Secret Museum- I am <Name>- full episode", "...Museum- <Name>-", or a
// bare "<Name> and <Name>"). Strip the show prefix / lead-in and trailing
// descriptors to get the figure's name to alphabetize by.
function xavierName(title) {
  // Prefer the name after "I am <Name>" wherever it appears in the title.
  const m = title.match(/I [Aa]m\s+([^/|–—-]+)/)
  if (m) return m[1].trim() || null
  // Otherwise strip the show prefix / boilerplate and take what's left.
  const s = title
    .replace(/^.*secret museum\s*[-–—:]*\s*/i, '')
    .replace(/full episode/gi, '')
    .replace(/\s*[|/].*$/, '')
    .replace(/\s*[-–—].*$/, '')
    .trim()
  return s || null
}
function alphaBucket(key, ranges) {
  if (!key) return 'Other'
  const c = key[0].toUpperCase()
  const r = ranges.find(([, lo, hi]) => c >= lo && c <= hi)
  return r ? r[0] : 'Other'
}

// ---- strategies per collection name ----
const STRATEGY = {
  'Numberblocks': { kind: 'season' },
  'Wild Kratts': { kind: 'season' },
  'Wordgirl': { kind: 'season' },
  'Bitz & Bob': { kind: 'season' },
  'Super Why': { kind: 'topic', buckets: SUPER_WHY },
  'Dr. Binocs': { kind: 'topic', buckets: DR_BINOCS },
  'Alan Becker': { kind: 'topic', buckets: ALAN_BECKER },
  'Octonauts': { kind: 'topic', buckets: OCTONAUTS },
  'Peg + Cat': { kind: 'topic', buckets: PEG_CAT, otherName: 'Stories & Adventures' },
  'Xavier Riddle': { kind: 'alpha', extract: xavierName, ranges: ALPHA_RANGES },
  // No season/topic structure — split the playlist into N equal ordered parts.
  'Bluey': { kind: 'chunks', count: 3 },
}

// Order the sub-list names: seasons numerically; topic/alpha by their defined
// order with the catch-all ("Other"/Specials/etc.) last.
function orderNames(strat, names) {
  if (strat.kind === 'season') {
    return names.sort((a, b) => {
      const na = Number(a.match(/\d+/)?.[0] ?? 1e9)
      const nb = Number(b.match(/\d+/)?.[0] ?? 1e9)
      return na - nb
    })
  }
  const canonical =
    strat.kind === 'alpha'
      ? strat.ranges.map((r) => r[0])
      : strat.buckets.map((b) => b[0])
  const rank = (n) => {
    const i = canonical.indexOf(n)
    return i === -1 ? canonical.length : i // unknown (catch-all) -> last
  }
  return names.sort((a, b) => rank(a) - rank(b))
}

const data = JSON.parse(await readFile(backupPath, 'utf8'))
const title = (id) => data.videos[id]?.title ?? id

for (const col of data.collections) {
  const strat = STRATEGY[col.name]
  if (!strat) continue

  // Position-based split into N equal ordered parts.
  if (strat.kind === 'chunks') {
    const ids = col.videoIds
    const per = Math.ceil(ids.length / strat.count)
    col.subCollections = Array.from({ length: strat.count }, (_, i) => ({
      id: `${col.id}:part-${i + 1}`,
      name: `Part ${i + 1}`,
      videoIds: ids.slice(i * per, (i + 1) * per),
    })).filter((s) => s.videoIds.length > 0)
    console.log(`${col.name}: ${col.subCollections.length} parts -> ${col.subCollections.map((s) => `${s.name} (${s.videoIds.length})`).join(', ')}`)
    continue
  }

  const groups = new Map() // name -> videoIds[]
  for (const id of col.videoIds) {
    let name
    if (strat.kind === 'season') name = seasonName(title(id)) ?? 'Specials'
    else if (strat.kind === 'alpha') name = alphaBucket(strat.extract(title(id)), strat.ranges)
    else {
      name = bucketName(title(id), strat.buckets)
      if (name === 'Other' && strat.otherName) name = strat.otherName
    }
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name).push(id)
  }

  const ordered = orderNames(strat, [...groups.keys()])
  col.subCollections = ordered.map((name) => ({
    id: `${col.id}:${slug(name)}`,
    name,
    videoIds: groups.get(name),
  }))

  const dist = col.subCollections.map((s) => `${s.name} (${s.videoIds.length})`).join(', ')
  console.log(`${col.name}: ${col.subCollections.length} sub-lists -> ${dist}`)
}

await writeFile(backupPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
