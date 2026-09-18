const path = require('path');
const fs = require('fs');

const configPath = path.join(__dirname, 'config.json');
let config = { amapKey: '', amapSecurityCode: '', deepseekKey: '', deepseekModel: 'deepseek-chat',
  smtpHost: 'smtp.163.com', smtpPort: 465, smtpUser: '', smtpPass: '', smtpFrom: '',
  authorEmail: 'wangzhiwei3306@163.com' };
try {
  if (fs.existsSync(configPath)) {
    config = { ...config, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) };
  }
} catch (e) {
  console.error('config.json 解析失败，使用空配置:', e.message);
}

// 环境变量覆盖（容器部署时使用）
const ENV_MAP = {
  amapKey: 'AMAP_KEY',
  amapSecurityCode: 'AMAP_SECURITY_CODE',
  deepseekKey: 'DEEPSEEK_KEY',
  deepseekModel: 'DEEPSEEK_MODEL',
  smtpHost: 'SMTP_HOST',
  smtpPort: 'SMTP_PORT',
  smtpUser: 'SMTP_USER',
  smtpPass: 'SMTP_PASS',
  smtpFrom: 'SMTP_FROM',
  authorEmail: 'AUTHOR_EMAIL',
};
for (const [key, env] of Object.entries(ENV_MAP)) {
  if (process.env[env]) config[key] = key === 'smtpPort' ? Number(process.env[env]) : process.env[env];
}

module.exports = config;
