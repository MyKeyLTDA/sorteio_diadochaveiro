// netlify/functions/cadastrar.js
// Cadastro direto (sem OTP). Bloqueia se e-mail OU telefone ja existir.
const L = require('./_lib');

const MAX_POR_IP_HORA = 15; // limite simples anti-flood por IP/hora

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return L.json(405, { erro: 'Metodo nao permitido' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return L.json(400, { erro: 'Dados invalidos' }); }

  const nome = String(payload.nome || '').trim();
  const telefone = L.cleanPhone(payload.telefone);
  const telefoneNorm = L.normalizePhone(payload.telefone);
  const email = String(payload.email || '').trim();
  const emailNorm = L.normalizeEmail(email);
  const ip = L.clientIp(event);

  if (nome.length < 3) return L.json(400, { erro: 'Informe seu nome completo.' });
  if (telefoneNorm.length < 7) return L.json(400, { erro: 'Informe um telefone válido com código do país.' });
  if (!L.validEmail(email)) return L.json(400, { erro: 'Informe um e-mail válido.' });

  const db = L.db();

  // Duplicado por e-mail OU telefone
  const { data: dupEmail } = await db
    .from('participantes').select('numero').eq('email_norm', emailNorm).maybeSingle();
  if (dupEmail) return L.json(409, { erro: 'Este e-mail já está cadastrado.', jaCadastrado: true });

  const { data: dupTel } = await db
    .from('participantes').select('numero').eq('telefone_norm', telefoneNorm).maybeSingle();
  if (dupTel) return L.json(409, { erro: 'Este telefone já está cadastrado.', jaCadastrado: true });

  // Limite por IP na ultima hora
  if (ip) {
    const umaHora = new Date(Date.now() - 3600 * 1000).toISOString();
    const { count } = await db
      .from('participantes').select('id', { count: 'exact', head: true })
      .eq('ip', ip).gte('created_at', umaHora);
    if ((count || 0) >= MAX_POR_IP_HORA) {
      return L.json(429, { erro: 'Muitos cadastros deste dispositivo. Tente mais tarde.' });
    }
  }

  // Numero atomico
  const { data: numero, error: numErr } = await db.rpc('proximo_numero');
  if (numErr) return L.json(500, { erro: 'Falha ao gerar número. Tente novamente.' });

  const { error: insErr } = await db.from('participantes').insert({
    numero, nome, telefone, telefone_norm: telefoneNorm,
    email, email_norm: emailNorm, ip,
  });

  if (insErr) {
    // corrida: alguem gravou o mesmo email/telefone no intervalo -> unique violou
    if (insErr.code === '23505') {
      return L.json(409, { erro: 'Este e-mail ou telefone já está cadastrado.', jaCadastrado: true });
    }
    return L.json(500, { erro: 'Falha ao concluir cadastro.' });
  }

  return L.json(200, { ok: true, numero });
};
