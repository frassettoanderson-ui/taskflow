module.exports = {
  apps: [{
    name: "l3salvados",
    cwd: "/var/www/l3salvados",
    script: "node_modules/next/dist/bin/next",
    args: "start -p 3230 -H 127.0.0.1",
    env: { NODE_ENV: "production", TZ: "America/Sao_Paulo" },
    max_memory_restart: "700M",
  }],
};
