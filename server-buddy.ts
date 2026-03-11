/**
 * Charbot Buddy — statyczny serwer dla dist-buddy/ na porcie 5176
 * 1. npm run build:buddy
 * 2. npx tsx server-buddy.ts
 * 3. http://localhost:5176
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist-buddy');

const app = express();
app.use(express.static(distDir));
app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'buddy.html')));

app.listen(5176, () => {
  console.log('\n  Charbot Buddy → http://localhost:5176\n');
});
