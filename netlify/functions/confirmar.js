// netlify/functions/confirmar.js
// Etapa 2: valida o codigo, grava o participante e devolve o numero da sorte.
const L = require('./_lib');

const MAX_TENTATIVAS = 5;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return L.json(405, { erro: 'Metodo nao permitido' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return L.json(400, { erro: 'Dados invalidos' }); }

  const email = String(payload.email || '').trim();
  const emailNorm = L.normalizeEmail(email);
  const codigo = String(payload.codigo || '').trim();

  if (!/^\d{6}$/.test(codigo)) return L.json(400, { erro: 'Código deve ter 6 dígitos.' });

  const db = L.db();

  // Recupera OTP pendente
  const { data: otp } = await db
    .from('codigos_otp').select('*').eq('email_norm', emailNorm)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (!otp) return L.json(400, { erro: 'Nenhum código pendente. Solicite novamente.' });

  if (new Date(otp.expira_em) < new Date()) {
    await db.from('codigos_otp').delete().eq('id', otp.id);
    return L.json(400, { erro: 'Código expirado. Solicite um novo.' });
  }

  if (otp.tentativas >= MAX_TENTATIVAS) {
    await db.from('codigos_otp').delete().eq('id', otp.id);
    return L.json(429, { erro: 'Muitas tentativas. Solicite um novo código.' });
  }

  const hashTentado = L.hashCode(codigo, emailNorm);
  if (hashTentado !== otp.codigo_hash) {
    await db.from('codigos_otp').update({ tentativas: otp.tentativas + 1 }).eq('id', otp.id);
    return L.json(400, { erro: 'Código incorreto.', restantes: MAX_TENTATIVAS - otp.tentativas - 1 });
  }

  // Codigo OK. Dupla checagem de duplicado (corrida).
  const { data: existente } = await db
    .from('participantes').select('numero').eq('email_norm', emailNorm).maybeSingle();
  if (existente) {
    await db.from('codigos_otp').delete().eq('id', otp.id);
    return L.json(200, { ok: true, numero: existente.numero, jaCadastrado: true });
  }

  // Numero atomico via sequence
  const { data: numData, error: numErr } = await db.rpc('proximo_numero');
  if (numErr) return L.json(500, { erro: 'Falha ao gerar número. Tente novamente.' });
  const numero = numData;

  const { error: insErr } = await db.from('participantes').insert({
    numero, nome: otp.nome, telefone: otp.telefone,
    email: otp.email, email_norm: emailNorm, ip: otp.ip,
  });
  if (insErr) {
    // Se bateu na unique de email_norm por corrida, busca o existente
    const { data: again } = await db
      .from('participantes').select('numero').eq('email_norm', emailNorm).maybeSingle();
    if (again) {
      await db.from('codigos_otp').delete().eq('id', otp.id);
      return L.json(200, { ok: true, numero: again.numero, jaCadastrado: true });
    }
    return L.json(500, { erro: 'Falha ao concluir cadastro.' });
  }

  await db.from('codigos_otp').delete().eq('id', otp.id);
  return L.json(200, { ok: true, numero });
};
