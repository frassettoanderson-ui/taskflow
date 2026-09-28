export const urlFoto = (nome: string, miniatura = false) => `/api/img/${nome}${miniatura ? "-t" : ""}.webp`;
