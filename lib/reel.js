// Reels: junta capa + notícias + slide final num vídeo vertical 1080x1920 (com transição) usando o ffmpeg.
const fs = require('fs'), os = require('os'), path = require('path');
const { execFile } = require('child_process');
const FFMPEG = require('ffmpeg-static');

const TRANS = 0.4;   // segundos de transição entre slides
function roda(args) {
  return new Promise((ok, erro) => execFile(FFMPEG, args, { maxBuffer: 1 << 26, timeout: 240000 }, (e, so, se) => e ? erro(new Error('ffmpeg: ' + String(se).slice(-600))) : ok()));
}
// quadros = [{ jpg: Buffer 1080x1920, dur: segundos }]
async function montaVideo(quadros) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-'));
  const args = ['-y'];
  quadros.forEach((q, i) => { const f = path.join(dir, i + '.jpg'); fs.writeFileSync(f, q.jpg); args.push('-loop', '1', '-t', String(q.dur), '-i', f); });
  const musica = path.join(__dirname, 'musica.mp3');
  const temMusica = fs.existsSync(musica);
  if (temMusica) args.push('-i', musica); else args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
  let filtro = quadros.map((q, i) => '[' + i + ':v]scale=1080:1920,setsar=1,fps=30,format=yuv420p[v' + i + ']').join(';');
  let ant = 'v0', t = quadros[0].dur;
  for (let i = 1; i < quadros.length; i++) {
    const off = (t - TRANS).toFixed(2);
    filtro += ';[' + ant + '][v' + i + ']xfade=transition=slideleft:duration=' + TRANS + ':offset=' + off + '[x' + i + ']';
    ant = 'x' + i; t = t + quadros[i].dur - TRANS;
  }
  const total = t.toFixed(2), a = quadros.length;
  filtro += ';[' + a + ':a]atrim=0:' + total + ',afade=t=out:st=' + Math.max(0, t - 1.5).toFixed(2) + ':d=1.5[aud]';
  const saida = path.join(dir, 'reel.mp4');
  args.push('-filter_complex', filtro, '-map', '[' + ant + ']', '-map', '[aud]', '-t', total,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', saida);
  await roda(args);
  const buf = fs.readFileSync(saida);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  return buf;
}
module.exports = { montaVideo };
