# Financeiro Igreja

Sistema financeiro de igreja — Node + Express + PostgreSQL.
Entradas (dízimos, ofertas), saídas (despesas), contas/caixas e balancete mensal.
Login próprio. Preparado para rodar sob subpasta no hub de ferramentas (`/igreja`).

## Rodar local

```bash
cd igreja
npm install
cp .env.example .env        # ajuste DATABASE_URL e SESSION_SECRET

# criar o banco e tabelas (precisa do PostgreSQL local)
psql "$DATABASE_URL" -f schema.sql

# criar o primeiro usuario admin + categorias/conta padrao
node criar-usuario.js "Anderson" admin@igreja.com minhasenha

npm start                   # http://localhost:3002
```

## Estrutura

```
server.js        Express + sessao + montagem sob BASE_PATH
db.js            Pool do PostgreSQL
schema.sql       Tabelas
routes/          APIs (auth, categorias, contas, lancamentos, relatorios)
public/          Front (login.html, index.html, css, js)
criar-usuario.js Cria admin + dados iniciais
```

## Deploy na VPS (sob o hub, subpasta /igreja)

1. Banco dedicado:
   ```bash
   sudo -u postgres psql -c "CREATE DATABASE db_igreja;"
   sudo -u postgres psql -c "CREATE USER igreja_user WITH PASSWORD 'senha_forte';"
   sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE db_igreja TO igreja_user;"
   ```
2. Subir o codigo para `/var/www/igreja`, `npm install --production`, criar `.env`
   com `PORT=3002`, `BASE_PATH=/igreja` e a `DATABASE_URL`.
3. `psql ... -f schema.sql` e `node criar-usuario.js ...`
4. PM2: `pm2 start server.js --name igreja && pm2 save`
5. nginx (server block do dominio do hub):
   ```nginx
   location /igreja/ {
       proxy_pass http://127.0.0.1:3002/igreja/;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```
```
