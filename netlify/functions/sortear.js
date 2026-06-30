// netlify/functions/sortear.js
// Admin: sorteia um ganhador entre os participantes. Sorteio feito NO SERVIDOR.
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

  let corpo;
  try { corpo = JSON.parse(evento.body || '{}'); }
  catch { return utilitarios.json(400, { erro: 'Dados invalidos' }); }

  if (!senhaConfere(corpo.senha)) return utilitarios.json(401, { erro: 'Senha incorreta.' });

  const banco = utilitarios.db();
  // Protege contra resultado/data ausentes antes de acessar .length (evita destructuring de undefined).
  const resultado = await banco
    .from('participantes').select('numero, nome, telefone, email');
  const { data: participantes, error: erro } = resultado || {};
  if (erro) return utilitarios.json(500, { erro: 'Falha ao sortear.' });
  if (!participantes || !participantes.length) return utilitarios.json(400, { erro: 'Nenhum participante para sortear.' });

  // Sorteio com aleatoriedade criptografica
  const indice = utilitarios.crypto.randomInt(0, participantes.length);
  const ganhador = participantes[indice];

  // Registra o sorteio (historico para relatorio). Se a tabela 'sorteios' ainda nao
  // existir, o sorteio NAO quebra — apenas nao grava (registrado: false).
  let registrado = false;
  const { error: erroRegistro } = await banco.from('sorteios').insert({
    numero: ganhador.numero,
    nome: ganhador.nome,
    telefone: ganhador.telefone,
    email: ganhador.email,
    total: participantes.length,
  });
  if (!erroRegistro) registrado = true;

  return utilitarios.json(200, { ok: true, total: participantes.length, ganhador, registrado });
};
