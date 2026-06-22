// netlify/functions/_lib.js
// Utilidades compartilhadas entre as Functions.
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// ---- Supabase (service_role: NUNCA exposto ao navegador) ----
function db() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

// ---- SMTP do proprio dominio ----
function mailer() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE) === 'true', // true p/ porta 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ---- Normalizacao de e-mail (anti-duplicado) ----
// minusculo; para gmail/googlemail remove pontos e sufixo +tag
function normalizeEmail(raw) {
  const e = String(raw || '').trim().toLowerCase();
  const at = e.lastIndexOf('@');
  if (at < 0) return e;
  let local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.split('+')[0].replace(/\./g, '');
    return local + '@gmail.com';
  }
  // outros provedores: remove apenas a tag +
  local = local.split('+')[0];
  return local + '@' + domain;
}

function validEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));
}

// telefone internacional: mantem digitos e um eventual + inicial
function cleanPhone(raw) {
  let s = String(raw || '').trim().replace(/[^\d+]/g, '');
  if (s.includes('+')) s = '+' + s.replace(/\+/g, '');
  return s;
}

// ---- Codigo OTP ----
function genCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}
function hashCode(code, email) {
  return crypto.createHmac('sha256', process.env.OTP_SECRET || 'fallback')
    .update(code + '|' + email).digest('hex');
}

// ---- Respostas HTTP ----
function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function clientIp(event) {
  return (event.headers['x-nf-client-connection-ip']
    || event.headers['x-forwarded-for'] || '').split(',')[0].trim();
}

module.exports = {
  db, mailer, normalizeEmail, validEmail, cleanPhone,
  genCode, hashCode, json, clientIp, crypto,
};
