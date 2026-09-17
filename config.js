const path = require('path');
const fs = require('fs');

const configPath = path.join(__dirname, 'config.json');
let config = { amapKey: '', amapSecurityCode: '', deepseekKey: '', deepseekModel: 'deepseek-chat',
  smtpHost: 'smtp.163.com', smtpPort: 465, smtpUser: '', smtpPass: '', smtpFrom: '' };
try {
  if (fs.existsSync(configPath)) {
    config = { ...config, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) };
  }
} catch (e) {
  console.error('config.json 解析失败，使用空配置:', e.message);
}

module.exports = config;
