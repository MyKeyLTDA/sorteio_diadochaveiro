// netlify/functions/historico.js
// Admin: lista os sorteios já realizados (para relatório). Exige senha (validada no servidor).
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
    .from('sorteios')
    .select('numero, nome, telefone, email, total, created_at')
    .order('created_at', { ascending: true });

  // Se a tabela ainda nao existir, devolve lista vazia em vez de erro 500.
  if (error) return L.json(200, { ok: true, total: 0, sorteios: [], aviso: 'Tabela de sorteios ainda nao criada.' });
  return L.json(200, { ok: true, total: data.length, sorteios: data });
};
