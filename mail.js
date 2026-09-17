const nodemailer = require('nodemailer');
const config = require('./config');

function smtpReady() {
  return !!(config.smtpUser && config.smtpPass);
}

async function sendVerifyCode(email, code) {
  const transport = nodemailer.createTransport({
    host: config.smtpHost || 'smtp.163.com',
    port: config.smtpPort || 465,
    secure: true,
    auth: { user: config.smtpUser, pass: config.smtpPass },
  });
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

module.exports = { smtpReady, sendVerifyCode };
