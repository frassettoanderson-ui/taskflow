import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DeliveryAreaKind, Role, SalesChannel } from '@prisma/client';
import { CatalogAdminService } from './catalog-admin.service';
import { EstruturaAdminService } from './estrutura-admin.service';
import { OperacaoAdminService } from './operacao-admin.service';
import { UsuariosAdminService } from './usuarios-admin.service';
import { UploadService } from './upload.service';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RequestContext } from '../../common/tenant/tenant-context.service';
import { lerCanal } from '../operation/channel';

/** Cadastrar é coisa de dono e gerente. */
const GESTAO = [Role.OWNER, Role.MANAGER];

@Controller('admin')
export class AdminController {
  constructor(
    private readonly catalogo: CatalogAdminService,
    private readonly estrutura: EstruturaAdminService,
    private readonly operacao: OperacaoAdminService,
    private readonly usuarios: UsuariosAdminService,
    private readonly upload: UploadService,
  ) {}

  // ---------------------------------------------------------------- FOTOS ---

  /** Sobe a foto de um prato e devolve o endereço dela. */
  @Post('upload')
  @Roles(...GESTAO)
  @UseInterceptors(FileInterceptor('arquivo'))
  async enviarImagem(@UploadedFile() arquivo: any) {
    return this.upload.salvarImagem(arquivo);
  }

  // ---------------------------------------------------------------- MARCA ---

  @Post('marcas')
  @Roles(...GESTAO)
  criarMarca(
    @Body()
    dto: { name: string; slug?: string; primaryColor?: string; description?: string; logoUrl?: string },
  ) {
    return this.catalogo.criarMarca(dto);
  }

  @Patch('marcas/:id')
  @Roles(...GESTAO)
  atualizarMarca(@Param('id') id: string, @Body() dto: Record<string, any>) {
    return this.catalogo.atualizarMarca(id, dto);
  }

  // ------------------------------------------------------------- CARDÁPIO ---

  @Get('marcas/:brandId/cardapios')
  @Roles(...GESTAO)
  cardapios(@Param('brandId') brandId: string) {
    return this.catalogo.cardapiosDaMarca(brandId);
  }

  @Post('marcas/:brandId/cardapios')
  @Roles(...GESTAO)
  criarCardapio(@Param('brandId') brandId: string, @Body() dto: { canal: string; name?: string }) {
    return this.catalogo.criarCardapio(brandId, lerCanal(dto.canal), dto.name);
  }

  @Get('cardapios/:menuId')
  @Roles(...GESTAO)
  cardapio(@Param('menuId') menuId: string) {
    return this.catalogo.cardapioCompleto(menuId);
  }

  @Post('cardapios/copiar')
  @Roles(...GESTAO)
  copiarCardapio(
    @Body() dto: { origemMenuId: string; destinoMenuId: string; ajustePercentual: number },
  ) {
    return this.catalogo.copiarCardapio(dto);
  }

  // ------------------------------------------------------------ CATEGORIA ---

  @Post('cardapios/:menuId/categorias')
  @Roles(...GESTAO)
  criarCategoria(@Param('menuId') menuId: string, @Body() dto: { name: string }) {
    return this.catalogo.criarCategoria(menuId, dto.name);
  }

  @Patch('categorias/:id')
  @Roles(...GESTAO)
  atualizarCategoria(@Param('id') id: string, @Body() dto: { name?: string; active?: boolean }) {
    return this.catalogo.atualizarCategoria(id, dto);
  }

  @Patch('categorias/:id/mover')
  @Roles(...GESTAO)
  moverCategoria(@Param('id') id: string, @Body() dto: { direcao: 'cima' | 'baixo' }) {
    return this.catalogo.moverCategoria(id, dto.direcao);
  }

  @Delete('categorias/:id')
  @Roles(...GESTAO)
  apagarCategoria(@Param('id') id: string) {
    return this.catalogo.apagarCategoria(id);
  }

  // ----------------------------------------------------------------- ITEM ---

  @Post('itens')
  @Roles(...GESTAO)
  criarItem(
    @Body()
    dto: {
      categoryId: string;
      name: string;
      description?: string;
      priceCents: number;
      imageUrl?: string;
      stationId?: string;
    },
  ) {
    return this.catalogo.criarItem(dto);
  }

  @Patch('itens/:id')
  @Roles(...GESTAO)
  atualizarItem(@Param('id') id: string, @Body() dto: Record<string, any>) {
    return this.catalogo.atualizarItem(id, dto);
  }

  @Patch('itens/:id/mover')
  @Roles(...GESTAO)
  moverItem(@Param('id') id: string, @Body() dto: { direcao: 'cima' | 'baixo' }) {
    return this.catalogo.moverItem(id, dto.direcao);
  }

  @Post('itens/:id/duplicar')
  @Roles(...GESTAO)
  duplicarItem(@Param('id') id: string) {
    return this.catalogo.duplicarItem(id);
  }

  @Delete('itens/:id')
  @Roles(...GESTAO)
  apagarItem(@Param('id') id: string) {
    return this.catalogo.apagarItem(id);
  }

  // --------------------------------------------------------- COMPLEMENTOS ---

  @Post('grupos')
  @Roles(...GESTAO)
  criarGrupo(
    @Body() dto: { itemId: string; name: string; minSelect: number; maxSelect: number },
  ) {
    return this.catalogo.criarGrupo(dto);
  }

  @Patch('grupos/:id')
  @Roles(...GESTAO)
  atualizarGrupo(@Param('id') id: string, @Body() dto: Record<string, any>) {
    return this.catalogo.atualizarGrupo(id, dto);
  }

  @Delete('grupos/:id')
  @Roles(...GESTAO)
  apagarGrupo(@Param('id') id: string) {
    return this.catalogo.apagarGrupo(id);
  }

  @Post('opcoes')
  @Roles(...GESTAO)
  criarOpcao(@Body() dto: { groupId: string; name: string; priceDeltaCents: number }) {
    return this.catalogo.criarOpcao(dto);
  }

  @Patch('opcoes/:id')
  @Roles(...GESTAO)
  atualizarOpcao(@Param('id') id: string, @Body() dto: Record<string, any>) {
    return this.catalogo.atualizarOpcao(id, dto);
  }

  @Delete('opcoes/:id')
  @Roles(...GESTAO)
  apagarOpcao(@Param('id') id: string) {
    return this.catalogo.apagarOpcao(id);
  }

  // ------------------------------------------------------------- HORÁRIOS ---

  @Get('marcas/:brandId/horarios')
  @Roles(...GESTAO)
  horarios(@Param('brandId') brandId: string, @Query('canal') canal?: string) {
    return this.operacao.horarios(brandId, lerCanal(canal));
  }

  @Post('marcas/:brandId/horarios')
  @Roles(...GESTAO)
  salvarHorarios(
    @Param('brandId') brandId: string,
    @Body()
    dto: {
      canal?: string;
      semana: Array<{ weekday: number; faixas: Array<{ abre: string; fecha: string }> }>;
    },
  ) {
    return this.operacao.salvarHorarios(brandId, lerCanal(dto.canal), dto.semana);
  }

  @Post('marcas/:brandId/horarios/todo-dia')
  @Roles(...GESTAO)
  horarioTodoDia(
    @Param('brandId') brandId: string,
    @Body() dto: { canal?: string; abre: string; fecha: string },
  ) {
    return this.operacao.salvarHorarioIgualTodoDia(brandId, lerCanal(dto.canal), dto.abre, dto.fecha);
  }

  // ------------------------------------------------------ ÁREA DE ENTREGA ---

  @Get('marcas/:brandId/areas')
  @Roles(...GESTAO)
  areas(@Param('brandId') brandId: string) {
    return this.operacao.areas(brandId);
  }

  @Post('marcas/:brandId/areas')
  @Roles(...GESTAO)
  criarArea(
    @Param('brandId') brandId: string,
    @Body()
    dto: {
      kind: DeliveryAreaKind;
      districtName?: string;
      maxDistanceKm?: number;
      feeCents: number;
      minOrderCents?: number;
    },
  ) {
    return this.operacao.criarArea({ brandId, ...dto });
  }

  @Patch('areas/:id')
  @Roles(...GESTAO)
  atualizarArea(@Param('id') id: string, @Body() dto: Record<string, any>) {
    return this.operacao.atualizarArea(id, dto);
  }

  @Delete('areas/:id')
  @Roles(...GESTAO)
  apagarArea(@Param('id') id: string) {
    return this.operacao.apagarArea(id);
  }

  // -------------------------------------------------------------- CASHBACK ---

  @Get('marcas/:brandId/cashback')
  @Roles(...GESTAO)
  cashback(@Param('brandId') brandId: string) {
    return this.operacao.cashback(brandId);
  }

  @Post('marcas/:brandId/cashback')
  @Roles(...GESTAO)
  salvarCashback(@Param('brandId') brandId: string, @Body() dto: any) {
    return this.operacao.salvarCashback(brandId, dto);
  }

  // ------------------------------------------------------------- UNIDADES ---

  @Get('unidades')
  @Roles(...GESTAO)
  unidades() {
    return this.estrutura.listarUnidades();
  }

  @Post('unidades')
  @Roles(...GESTAO)
  criarUnidade(@Body() dto: any) {
    return this.estrutura.criarUnidade(dto);
  }

  @Patch('unidades/:id')
  @Roles(...GESTAO)
  atualizarUnidade(@Param('id') id: string, @Body() dto: any) {
    return this.estrutura.atualizarUnidade(id, dto);
  }

  @Post('unidades/:unitId/marcas/:brandId')
  @Roles(...GESTAO)
  vincularMarca(
    @Param('unitId') unitId: string,
    @Param('brandId') brandId: string,
    @Body() dto: { active?: boolean },
  ) {
    return this.estrutura.vincularMarca(unitId, brandId, dto?.active ?? true);
  }

  // ------------------------------------------------------------- ESTAÇÕES ---

  @Get('estacoes')
  @Roles(...GESTAO)
  estacoes(@Query('unidade') unidade?: string) {
    return this.estrutura.listarEstacoes(unidade || undefined);
  }

  @Post('estacoes')
  @Roles(...GESTAO)
  criarEstacao(@Body() dto: { unitId: string; name: string }) {
    return this.estrutura.criarEstacao(dto.unitId, dto.name);
  }

  @Patch('estacoes/:id')
  @Roles(...GESTAO)
  atualizarEstacao(@Param('id') id: string, @Body() dto: any) {
    return this.estrutura.atualizarEstacao(id, dto);
  }

  @Delete('estacoes/:id')
  @Roles(...GESTAO)
  apagarEstacao(@Param('id') id: string) {
    return this.estrutura.apagarEstacao(id);
  }

  // ---------------------------------------------------------------- MESAS ---

  @Get('mesas')
  @Roles(...GESTAO)
  mesas(@Query('unidade') unidade?: string) {
    return this.estrutura.listarMesas(unidade || undefined);
  }

  @Post('mesas')
  @Roles(...GESTAO)
  criarMesa(
    @Body() dto: { unitId: string; brandId: string; number: string; area?: string; seats?: number },
  ) {
    return this.estrutura.criarMesa(dto);
  }

  @Post('mesas/lote')
  @Roles(...GESTAO)
  criarMesasEmLote(
    @Body()
    dto: { unitId: string; brandId: string; de: number; ate: number; area?: string; seats?: number },
  ) {
    return this.estrutura.criarMesasEmLote(dto);
  }

  @Patch('mesas/:id')
  @Roles(...GESTAO)
  atualizarMesa(@Param('id') id: string, @Body() dto: any) {
    return this.estrutura.atualizarMesa(id, dto);
  }

  @Delete('mesas/:id')
  @Roles(...GESTAO)
  apagarMesa(@Param('id') id: string) {
    return this.estrutura.apagarMesa(id);
  }

  // ------------------------------------------------------------- USUÁRIOS ---

  @Get('usuarios')
  @Roles(...GESTAO)
  listarUsuarios() {
    return this.usuarios.listar();
  }

  @Get('papeis')
  @Roles(...GESTAO)
  papeis() {
    return this.usuarios.papeis();
  }

  @Post('usuarios')
  @Roles(Role.OWNER)
  criarUsuario(@Body() dto: { name: string; email: string; password: string; role: Role }) {
    return this.usuarios.criar(dto);
  }

  @Patch('usuarios/:id')
  @Roles(Role.OWNER)
  atualizarUsuario(@Param('id') id: string, @Body() dto: { name?: string; role?: Role }) {
    return this.usuarios.atualizar(id, dto);
  }

  @Patch('usuarios/:id/senha')
  @Roles(Role.OWNER)
  trocarSenha(@Param('id') id: string, @Body() dto: { password: string }) {
    return this.usuarios.trocarSenha(id, dto.password);
  }

  @Delete('usuarios/:id')
  @Roles(Role.OWNER)
  apagarUsuario(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.usuarios.apagar(id, user.userId);
  }
}
