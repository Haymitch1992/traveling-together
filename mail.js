const nodemailer = require('nodemailer');
const config = require('./config');

function smtpReady() {
  return !!(config.smtpUser && config.smtpPass);
}

function createTransport() {
  return nodemailer.createTransport({
    host: config.smtpHost || 'smtp.163.com',
    port: config.smtpPort || 465,
    secure: true,
    auth: { user: config.smtpUser, pass: config.smtpPass },
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendVerifyCode(email, code) {
  const transport = createTransport();
  await transport.sendMail({
    from: config.smtpFrom || config.smtpUser,
    to: email,
    subject: `结伴出行验证码：${code}`,
    text: `你的注册验证码是 ${code}，10 分钟内有效。若非本人操作请忽略本邮件。`,
    html: `<div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:24px;background:#FFFDF7;border-radius:16px;border:2px solid #EFE6D8">
      <h2 style="color:#4A4039;margin:0 0 8px">结伴出行 🐻</h2>
      <p style="color:#6E6255;font-size:14px">你的注册验证码是：</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#E76F51;background:#FAF5EA;border-radius:12px;text-align:center;padding:14px 0">${code}</div>
      <p style="color:#B9AE9F;font-size:12px;margin-top:16px">验证码 10 分钟内有效。若非本人操作，请忽略本邮件。</p>
    </div>`,
  });
}

function authorInbox() {
  return config.authorEmail || config.smtpFrom || config.smtpUser || 'wangzhiwei3306@163.com';
}

async function sendGuestbookMessage({ name, contact, content }) {
  const to = authorInbox();
  const safeName = escapeHtml(name);
  const safeContact = contact ? escapeHtml(contact) : '未填写';
  const safeContent = escapeHtml(content).replace(/\n/g, '<br>');
  const transport = createTransport();
  await transport.sendMail({
    from: config.smtpFrom || config.smtpUser,
    to,
    replyTo: contact || undefined,
    subject: `结伴出行留言 · ${name}`.slice(0, 80),
    text: [
      `来自留言板的新消息`,
      ``,
      `昵称：${name}`,
      `联系方式：${contact || '未填写'}`,
      ``,
      content,
    ].join('\n'),
    html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#FFFDF7;border-radius:16px;border:2px solid #EFE6D8">
      <h2 style="color:#4A4039;margin:0 0 4px">结伴出行 · 新留言</h2>
      <p style="color:#9A8468;font-size:13px;margin:0 0 18px">有人在留言板给你写信啦</p>
      <div style="background:#FAF5EA;border-radius:14px;padding:14px 16px;margin-bottom:14px">
        <div style="font-size:13px;color:#6E6255;margin-bottom:6px"><strong style="color:#4A4039">昵称</strong> · ${safeName}</div>
        <div style="font-size:13px;color:#6E6255"><strong style="color:#4A4039">联系方式</strong> · ${safeContact}</div>
      </div>
      <div style="font-size:15px;line-height:1.7;color:#4A4039;background:#fff;border:1px solid #EFE6D8;border-radius:14px;padding:16px">${safeContent}</div>
      <p style="color:#B9AE9F;font-size:12px;margin-top:16px">可直接回复本邮件联系对方（若对方填写了邮箱）。</p>
    </div>`,
  });
}

module.exports = { smtpReady, sendVerifyCode, sendGuestbookMessage, authorInbox };
