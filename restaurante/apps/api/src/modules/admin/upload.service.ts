import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

/** Onde as imagens ficam guardadas dentro do container. */
export const PASTA_DE_UPLOADS = process.env.UPLOADS_DIR ?? '/app/uploads';

/** Só imagem, e só formatos que todo navegador abre. */
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5 MB

/**
 * GUARDA AS FOTOS dos pratos.
 *
 * As imagens ficam num volume do Docker, na sua máquina — sem depender de
 * nenhum serviço externo, que é o que você pediu.
 *
 * ⚠️ PONTA SOLTA CONHECIDA: guardar arquivo no disco do servidor funciona bem
 * numa máquina só. Quando o sistema rodar em vários servidores ao mesmo tempo,
 * isso precisa virar um armazenamento de nuvem (S3, R2, Spaces) — e aí a troca
 * acontece só neste arquivo.
 */
@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  async salvarImagem(arquivo: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
  }) {
    if (!arquivo) throw new BadRequestException('Nenhum arquivo enviado.');

    if (!TIPOS_ACEITOS.includes(arquivo.mimetype)) {
      throw new BadRequestException(
        'Formato não aceito. Envie uma imagem JPG, PNG, WEBP ou GIF.',
      );
    }

    if (arquivo.size > TAMANHO_MAXIMO) {
      throw new BadRequestException('A imagem passa de 5 MB. Escolha uma menor.');
    }

    // Nome sorteado: evita colisão e impede adivinhar o arquivo de outro.
    const extensao = extname(arquivo.originalname).toLowerCase() || '.jpg';
    const nome = `${randomUUID()}${extensao}`;

    await mkdir(PASTA_DE_UPLOADS, { recursive: true });
    await writeFile(join(PASTA_DE_UPLOADS, nome), arquivo.buffer);

    this.logger.log(`Imagem guardada: ${nome} (${Math.round(arquivo.size / 1024)} KB)`);

    // O endereço público, servido pelo próprio backend.
    return { url: `/uploads/${nome}`, nome };
  }
}
