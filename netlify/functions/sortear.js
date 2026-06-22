// netlify/functions/sortear.js
// Admin: sorteia um ganhador entre os participantes. Sorteio feito NO SERVIDOR.
const L = require('./_lib');

function senhaOk(enviada) {
  const a = Buffer.from(String(enviada || ''));
  const b = Buffer.from(String(process.env.ADMIN_PASSWORD || ''));
  if (a.length !== b.length) return false;
  return L.crypto.timingSafeEqual(a, b);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return L.json(405, { erro: 'Metodo nao permitido' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return L.json(400, { erro: 'Dados invalidos' }); }

  if (!senhaOk(payload.senha)) return L.json(401, { erro: 'Senha incorreta.' });

  const db = L.db();
  const { data, error } = await db
    .from('participantes').select('numero, nome, telefone, email');
  if (error) return L.json(500, { erro: 'Falha ao sortear.' });
  if (!data.length) return L.json(400, { erro: 'Nenhum participante para sortear.' });

  // Sorteio com aleatoriedade criptografica
  const idx = L.crypto.randomInt(0, data.length);
  const ganhador = data[idx];

  return L.json(200, { ok: true, total: data.length, ganhador });
};
