import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { Public } from '../../common/auth/public.decorator';
import { lerCanal } from '../operation/channel';

/**
 * Rotas do cardápio que o CLIENTE acessa — sem login e sem cadastro.
 */
@Controller('public')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /**
   * GET /api/public/menu/cantina-da-nona
   * GET /api/public/menu/cantina-da-nona?canal=salao
   */
  @Public()
  @Get('menu/:brandSlug')
  getMenu(@Param('brandSlug') brandSlug: string, @Query('canal') canal?: string) {
    return this.catalog.getPublicMenu(brandSlug, lerCanal(canal));
  }

  /** Horários de funcionamento e áreas de entrega da marca. */
  @Public()
  @Get('menu/:brandSlug/regras')
  getRegras(@Param('brandSlug') brandSlug: string, @Query('canal') canal?: string) {
    return this.catalog.getRegrasPublicas(brandSlug, lerCanal(canal));
  }
}
