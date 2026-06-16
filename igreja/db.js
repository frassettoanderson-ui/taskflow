const { Pool, types } = require('pg');

// DATE (OID 1082): devolve como texto 'YYYY-MM-DD' puro, sem conversão de fuso
// (evita o bug de "um dia antes" quando o servidor está em UTC).
types.setTypeParser(1082, (v) => v);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
