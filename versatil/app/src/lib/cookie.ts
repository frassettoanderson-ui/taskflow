// Cookie "secure" só quando o site está em HTTPS. Sem domínio (http://IP:porta) defina COOKIE_SECURE=false.
export const cookieSeguro = () => (process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production");
