const crypto = require('crypto');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Variáveis de ambiente (configurar na Vercel):
// COURSE_PASSWORD, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
const VIDEO_KEY = 'aula1-editada.mp4';
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

  const { COURSE_PASSWORD, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!COURSE_PASSWORD || !R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    return res.status(500).json({ ok: false, error: 'Servidor não configurado' });
  }

  const password = (req.body && req.body.password) || '';
  if (!safeEqual(password, COURSE_PASSWORD)) {
    return res.status(401).json({ ok: false, error: 'Senha incorreta' });
  }

  try {
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });

    const url = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: VIDEO_KEY, ResponseContentType: 'video/mp4' }),
      { expiresIn: URL_TTL_SECONDS }
    );

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, url });
  } catch (err) {
    console.error('Erro ao gerar link do vídeo:', err.message);
    return res.status(500).json({ ok: false, error: 'Erro ao gerar link do vídeo' });
  }
};
