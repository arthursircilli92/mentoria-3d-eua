const crypto = require('crypto');
const { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Variáveis de ambiente (configurar na Vercel):
// COURSE_PASSWORD, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
//
// Só estes vídeos podem ser pedidos (id usado na página -> arquivo no bucket).
// Para publicar uma aula nova, basta enviar o arquivo com o nome abaixo para o bucket.
const VIDEOS = {
  'aula1': ['aula1-editada.mp4'],
  // A aula 2 aceita o nome limpo ou o nome que o HandBrake deixou no arquivo.
  'aula2-p1': ['aula2-parte1.mp4', 'aula2-parte1(handbrake).mp4'],
  'aula2-p2': ['aula2-parte2.mp4', 'aula2-parte2(handbrake).mp4'],
  'aula3': ['aula3.mp4'],
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

  const { COURSE_PASSWORD, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!COURSE_PASSWORD || !R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    return res.status(500).json({ ok: false, error: 'Servidor não configurado' });
  }

  const body = req.body || {};
  if (!safeEqual(body.password || '', COURSE_PASSWORD)) {
    return res.status(401).json({ ok: false, error: 'Senha incorreta' });
  }

  // Sem "video": só confere a senha (usado ao entrar no curso).
  if (body.video === undefined || body.video === null || body.video === '') {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true });
  }

  const candidates = Object.prototype.hasOwnProperty.call(VIDEOS, body.video) ? VIDEOS[body.video] : null;
  if (!candidates) {
    return res.status(400).json({ ok: false, error: 'Vídeo inválido' });
  }

  try {
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });

    // Qual dos nomes possíveis já foi enviado ao bucket? Se nenhum, a aula aparece como "Em breve".
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
