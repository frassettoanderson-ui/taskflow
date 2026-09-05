// PM2 — mantém o Emissor Fiscal no ar (rede interna, porta 8400).
// TZ fixado em Brasília para que dhEmi das notas saia no fuso correto.
module.exports = {
  apps: [
    {
      name: 'emissor-fiscal',
      script: '/usr/bin/php',
      args: '-S 127.0.0.1:8400 -t public',
      cwd: '/root/emissor-fiscal',
      interpreter: 'none',
      autorestart: true,
      max_restarts: 10,
      env: {
        TZ: 'America/Sao_Paulo',
      },
    },
  ],
};
