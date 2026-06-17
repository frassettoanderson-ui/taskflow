// PM2 ecosystem - GestorOA
// Uso: pm2 start ecosystem.config.js
// O frontend (web) e' buildado estaticamente e servido pelo Nginx;
// aqui rodamos apenas o backend (API + worker de filas embutido).
module.exports = {
  apps: [
    {
      name: 'gestoroa-api',
      cwd: __dirname + '/server',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '500M',
      out_file: '/var/log/gestoroa/api-out.log',
      error_file: '/var/log/gestoroa/api-err.log',
      time: true,
    },
  ],
};
