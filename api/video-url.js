const crypto = require('crypto');
const { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Variáveis de ambiente (configurar na Vercel):
// COURSE_PASSWORD_TURMA1, COURSE_PASSWORD_TURMA2
// R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
//
// Turma 1: arquivos sem prefixo (aula1-editada.mp4, aula2-parte1.mp4, etc.)
// Turma 2: arquivos com prefixo "t2-" (t2-aula1-editada.mp4, t2-aula2-parte1.mp4, etc.)
const TURMAS = {
  t1: { passwordEnv: 'COURSE_PASSWORD_TURMA1', videoPrefix: '' },
  t2: { passwordEnv: 'COURSE_PASSWORD_TURMA2', videoPrefix: 't2-' },
};

// Nomes possíveis dos arquivos no bucket (sem prefixo de turma)
const VIDEO_CANDIDATES = {
  'aula1': ['aula1-editada.mp4'],
  'aula2-p1': ['aula2-parte1.mp4', 'aula2-parte1(handbrake).mp4'],
  'aula2-p2': ['aula2-parte2.mp4', 'aula2-parte2(handbrake).mp4'],
  'aula3-p1': ['AULA3-PT1.mp4', 'aula3-pt1.mp4', 'aula3-parte1.mp4'],
  'aula3-p2': ['AULA3-PT2.mp4', 'aula3-pt2.mp4', 'aula3-parte2.mp4'],
  'aula3-p3': ['AULA3-PT3.mp4', 'aula3-pt3.mp4', 'aula3-parte3.mp4'],
  'aula3-p4': ['AULA3-PT4.mp4', 'aula3-pt4.mp4', 'aula3-parte4.mp4'],
  'aula4': ['aula4.mp4'],
};

const URL_TTL_SECONDS = 4 * 60 * 60; // link do vídeo vale 4h

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    return res.status(500).json({ ok: false, error: 'Servidor não configurado (R2)' });
  }

  const body = req.body || {};
  const turmaId = body.turma;

  // Valida turma
  if (!turmaId || !TURMAS[turmaId]) {
    return res.status(400).json({ ok: false, error: 'Turma inválida' });
  }

  const turmaConfig = TURMAS[turmaId];
  const expectedPassword = process.env[turmaConfig.passwordEnv];

  if (!expectedPassword) {
    return res.status(500).json({ ok: false, error: `Senha da ${turmaId} não configurada no servidor` });
  }

  // Valida senha da turma
  if (!safeEqual(body.password || '', expectedPassword)) {
    return res.status(401).json({ ok: false, error: 'Senha incorreta' });
  }

  // Sem "video": só confere a senha (usado ao entrar no curso)
  if (body.video === undefined || body.video === null || body.video === '') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true });
  }

  // Busca candidatos de arquivo para o vídeo solicitado
  const baseCandidates = Object.prototype.hasOwnProperty.call(VIDEO_CANDIDATES, body.video)
    ? VIDEO_CANDIDATES[body.video]
    : null;

  if (!baseCandidates) {
    return res.status(400).json({ ok: false, error: 'Vídeo inválido' });
  }

  // Aplica prefixo da turma aos nomes dos arquivos
  const candidates = baseCandidates.map(name => turmaConfig.videoPrefix + name);

  try {
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });

    // Qual dos nomes possíveis já foi enviado ao bucket?
    let key = null;
    for (const candidate of candidates) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: candidate }));
        key = candidate;
        break;
      } catch (err) {
        const status = err && err.$metadata && err.$metadata.httpStatusCode;
        const notFound = status === 404 || (err && (err.name === 'NotFound' || err.name === 'NoSuchKey'));
        if (!notFound) throw err;
      }
    }

    if (!key) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).json({ ok: false, error: 'not_found' });
    }

    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: key, ResponseContentType: 'video/mp4' }),
      { expiresIn: URL_TTL_SECONDS }
    );

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, url });
  } catch (err) {
    console.error('Erro ao gerar link do vídeo:', err.message);
    return res.status(500).json({ ok: false, error: 'Erro ao gerar link do vídeo' });
  }
};