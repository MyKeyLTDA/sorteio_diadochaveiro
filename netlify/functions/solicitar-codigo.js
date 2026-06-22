// netlify/functions/solicitar-codigo.js
// Etapa 1 do cadastro: valida dados, checa duplicado, envia codigo por e-mail.
const L = require('./_lib');

const MAX_POR_IP_HORA = 8; // limite de solicitacoes por IP / hora

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return L.json(405, { erro: 'Metodo nao permitido' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return L.json(400, { erro: 'Dados invalidos' }); }

  const nome = String(payload.nome || '').trim();
  const telefone = L.cleanPhone(payload.telefone);
  const email = String(payload.email || '').trim();
  const emailNorm = L.normalizeEmail(email);
  const ip = L.clientIp(event);

  if (nome.length < 3) return L.json(400, { erro: 'Informe seu nome completo.' });
  if (telefone.replace(/\D/g, '').length < 7) return L.json(400, { erro: 'Informe um telefone valido com DDI.' });
  if (!L.validEmail(email)) return L.json(400, { erro: 'Informe um e-mail valido.' });

  const db = L.db();

  // Ja existe participante VERIFICADO com este e-mail?
  const { data: existente } = await db
    .from('participantes').select('numero').eq('email_norm', emailNorm).maybeSingle();
  if (existente) {
    return L.json(409, { erro: 'Este e-mail ja esta cadastrado.', jaCadastrado: true });
  }

  // Limite por IP na ultima hora
  if (ip) {
    const umaHora = new Date(Date.now() - 3600 * 1000).toISOString();
    const { count } = await db
      .from('codigos_otp').select('id', { count: 'exact', head: true })
      .eq('ip', ip).gte('created_at', umaHora);
    if ((count || 0) >= MAX_POR_IP_HORA) {
      return L.json(429, { erro: 'Muitas tentativas. Tente novamente mais tarde.' });
    }
  }

  // Gera codigo e guarda hash (expira em 10 min)
  const code = L.genCode();
  const codigoHash = L.hashCode(code, emailNorm);
  const expiraEm = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // remove OTPs antigos deste e-mail
  await db.from('codigos_otp').delete().eq('email_norm', emailNorm);

  const { error: insErr } = await db.from('codigos_otp').insert({
    email_norm: emailNorm, email, nome, telefone,
    codigo_hash: codigoHash, expira_em: expiraEm, ip,
  });
  if (insErr) return L.json(500, { erro: 'Falha ao registrar. Tente novamente.' });

  // Envia e-mail
  try {
    await L.mailer().sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Seu código — Sorteio Dia do Chaveiro MyKey',
      text: `Olá ${nome.split(' ')[0]}!\n\nSeu código de verificação é: ${code}\n\nEle expira em 10 minutos.\n\nMyKey Soluções`,
      html: `
        <div style="font-family:Segoe UI,Arial,sans-serif;background:#0f2747;padding:32px;color:#fff;border-radius:16px;max-width:480px;margin:auto">
          <p style="color:#ffa94d;letter-spacing:2px;font-size:12px;text-transform:uppercase;margin:0">Dia do Chaveiro</p>
          <h2 style="margin:8px 0 16px">Confirme seu cadastro</h2>
          <p style="color:#cfd8e8">Olá ${nome.split(' ')[0]}, use o código abaixo para concluir sua inscrição no sorteio:</p>
          <div style="background:#f7821b;color:#08182f;font-size:34px;font-weight:800;letter-spacing:6px;text-align:center;padding:18px;border-radius:12px;margin:18px 0">${code}</div>
          <p style="color:#8aa0c0;font-size:13px">O código expira em 10 minutos. Se você não solicitou, ignore este e-mail.</p>
          <p style="color:#8aa0c0;font-size:13px;margin-top:20px">MyKey Soluções</p>
        </div>`,
    });
  } catch (e) {
    return L.json(502, { erro: 'Não foi possível enviar o e-mail. Verifique o endereço.' });
  }

  return L.json(200, { ok: true, mensagem: 'Código enviado para seu e-mail.' });
};
