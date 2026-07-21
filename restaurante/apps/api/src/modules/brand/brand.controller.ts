import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { BrandService } from './brand.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { Roles } from '../../common/auth/roles.decorator';

@Controller('brands')
export class BrandController {
  constructor(private readonly brands: BrandService) {}

  /** Lista as marcas — qualquer usuário logado do tenant pode ver. */
  @Get()
  list() {
    return this.brands.list();
  }

  /** Busca uma marca. Serve também como teste de isolamento entre tenants. */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.brands.findOne(id);
  }

  /** Criar marca: só dono e gerente. Operador leva 403. */
  @Post()
  @Roles(Role.OWNER, Role.MANAGER)
  create(@Body() dto: CreateBrandDto) {
    return this.brands.create(dto);
  }
}
