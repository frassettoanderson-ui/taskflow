import { Controller, Get, Param } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { Public } from '../../common/auth/public.decorator';

/**
 * Rotas do cardápio que o CLIENTE acessa — sem login e sem cadastro.
 */
@Controller('public')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /** GET /api/public/menu/cantina-da-nona */
  @Public()
  @Get('menu/:brandSlug')
  getMenu(@Param('brandSlug') brandSlug: string) {
    return this.catalog.getPublicMenu(brandSlug);
  }
}
