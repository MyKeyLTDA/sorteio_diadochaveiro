// netlify/functions/historico.js
// Admin: lista os sorteios já realizados (para relatório). Exige senha (validada no servidor).
const utilitarios = require('./_lib');

function senhaConfere(senhaEnviada) {
  const bufferEnviada = Buffer.from(String(senhaEnviada || ''));
  const bufferEsperada = Buffer.from(String(process.env.ADMIN_PASSWORD || ''));
  if (bufferEnviada.length !== bufferEsperada.length) return false;
  return utilitarios.crypto.timingSafeEqual(bufferEnviada, bufferEsperada);
}

// exports.handler é o nome exigido pelas Netlify Functions (não pode ser traduzido).
exports.handler = async (evento) => {
  if (evento.httpMethod !== 'POST') return utilitarios.json(405, { erro: 'Metodo nao permitido' });

  let corpoRequisicao;
  try { corpoRequisicao = JSON.parse(evento.body || '{}'); }
  catch { return utilitarios.json(400, { erro: 'Dados invalidos' }); }

  if (!senhaConfere(corpoRequisicao.senha)) return utilitarios.json(401, { erro: 'Senha incorreta.' });

  const bancoDados = utilitarios.db();
  const { data: sorteios, error: erro } = await bancoDados
    .from('sorteios')
    .select('numero, nome, telefone, email, total, created_at')
    .order('created_at', { ascending: true });

  // Se a tabela ainda nao existir, devolve lista vazia em vez de erro 500.
  if (erro) return utilitarios.json(200, { ok: true, total: 0, sorteios: [], aviso: 'Tabela de sorteios ainda nao criada.' });
  const lista = sorteios || [];
  return utilitarios.json(200, { ok: true, total: lista.length, sorteios: lista });
};
