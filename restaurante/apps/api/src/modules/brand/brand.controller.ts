import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { Role } from '@prisma/client';
import { BrandService } from './brand.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { Roles } from '../../common/auth/roles.decorator';
import { OperationService } from '../operation/operation.service';
import { lerCanal } from '../operation/channel';

class PausarDto {
  @IsBoolean()
  paused: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reason?: string;
}

class PausarItemDto {
  @IsBoolean()
  paused: boolean;
}

@Controller('brands')
export class BrandController {
  constructor(
    private readonly brands: BrandService,
    private readonly operacao: OperationService,
  ) {}

  /** Lista as marcas com a situação de cada canal agora (aberto/pausado). */
  @Get()
  list() {
    return this.brands.listComSituacao();
  }

  /** Busca uma marca. Serve também como teste de isolamento entre tenants. */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.brands.findOne(id);
  }

  /** Horários e área de entrega da marca. */
  @Get(':id/regras')
  regras(@Param('id') id: string, @Query('canal') canal?: string) {
    return this.brands.regras(id, lerCanal(canal));
  }

  /** Criar marca: só dono e gerente. Operador leva 403. */
  @Post()
  @Roles(Role.OWNER, Role.MANAGER)
  create(@Body() dto: CreateBrandDto) {
    return this.brands.create(dto);
  }

  /**
   * PAUSAR A MARCA INTEIRA — o botão de emergência.
   * Tira o cardápio do ar na hora e recusa pedidos novos.
   */
  @Patch(':id/pausa')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER, Role.OPERATOR)
  async pausar(@Param('id') id: string, @Body() dto: PausarDto) {
    await this.brands.findOne(id); // confirma que a marca é deste tenant
    return this.operacao.pausarMarca(id, dto.paused, dto.reason);
  }

  /** Pausar um item do cardápio (ex.: acabou o camarão). */
  @Patch('itens/:itemId/pausa')
  @Roles(Role.OWNER, Role.MANAGER, Role.CASHIER, Role.OPERATOR)
  pausarItem(@Param('itemId') itemId: string, @Body() dto: PausarItemDto) {
    return this.operacao.pausarItem(itemId, dto.paused);
  }
}
