module.exports = {
  apps: [{
    name: 'holytech-assina',
    script: 'src/server.js',
    cwd: '/var/www/holytech-assina',
    env: { NODE_ENV: 'production', TZ: 'America/Sao_Paulo', PORT: '3460' },
    max_memory_restart: '300M',
  }],
}
