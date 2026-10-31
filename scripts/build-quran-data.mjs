import { mkdir, writeFile } from 'node:fs/promises';

const API = 'https://api.alquran.cloud/v1';
const OUT = new URL('../quran-data/', import.meta.url);

async function getJson(url) {
  const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`);
  const payload = await response.json();
  if (payload.code !== 200 || !payload.data) throw new Error(`Invalid API response from ${url}`);
  return payload.data;
}

const [metadata, quran] = await Promise.all([
  getJson(`${API}/surah`),
  getJson(`${API}/quran/quran-uthmani`)
]);
const surahs = quran.surahs;
if (!Array.isArray(metadata) || metadata.length !== 114) throw new Error('Surah index must contain exactly 114 surahs.');
if (!Array.isArray(surahs) || surahs.length !== 114) throw new Error('Quran edition must contain exactly 114 surahs.');

let totalAyahs = 0, expectedGlobalNumber = 1;
for (let i = 0; i < 114; i++) {
  const meta = metadata[i], surah = surahs[i];
  if (surah.number !== i + 1 || meta.number !== i + 1) throw new Error(`Surah order mismatch at ${i + 1}`);
  if (!Array.isArray(surah.ayahs) || surah.ayahs.length !== meta.numberOfAyahs) throw new Error(`Ayah count mismatch in surah ${i + 1}`);
  for (let j = 0; j < surah.ayahs.length; j++) {
    const ayah = surah.ayahs[j];
    if (!ayah.text || !ayah.text.trim()) throw new Error(`Empty Quran text at ${i + 1}:${j + 1}`);
    if (ayah.numberInSurah !== j + 1 || ayah.number !== expectedGlobalNumber++) throw new Error(`Ayah sequence mismatch at ${i + 1}:${j + 1}`);
  }
  totalAyahs += surah.ayahs.length;
}
if (totalAyahs !== 6236 || expectedGlobalNumber !== 6237) throw new Error(`Expected 6,236 ayahs, validated ${totalAyahs}`);

await mkdir(OUT, { recursive: true });
await writeFile(new URL('index.json', OUT), JSON.stringify(metadata, null, 2) + '\n', 'utf8');
for (const surah of surahs) {
  const normalized = { number: surah.number, name: surah.name, englishName: surah.englishName, englishNameTranslation: surah.englishNameTranslation, numberOfAyahs: surah.numberOfAyahs, revelationType: surah.revelationType, ayahs: surah.ayahs };
  await writeFile(new URL(String(surah.number).padStart(3, '0') + '.json', OUT), JSON.stringify(normalized) + '\n', 'utf8');
}
console.log(`Validated and generated 114 surahs and ${totalAyahs} ayahs.`);
