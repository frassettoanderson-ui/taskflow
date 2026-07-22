import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ConsentType,
  CourierPayModel,
  DispatchStatus,
  EntryStatus,
  EntryType,
  Role,
  StockMovementType,
  SupplyUnit,
} from '@prisma/client';
import { ReportService } from './report.service';
import { StockService } from './stock.service';
import { FinanceService } from './finance.service';
import { DeliveryService } from './delivery.service';
import { LgpdService } from './lgpd.service';
import { Roles } from '../../common/auth/roles.decorator';
import { lerCanal } from '../operation/channel';

/** Bastidores é coisa de dono e gerente. */
const GESTAO = [Role.OWNER, Role.MANAGER];
/** O caixa também precisa ver entregas e contas do dia. */
const GESTAO_E_CAIXA = [Role.OWNER, Role.MANAGER, Role.CASHIER];

@Controller('gestao')
export class GestaoController {
  constructor(
    private readonly relatorios: ReportService,
    private readonly estoque: StockService,
    private readonly financeiro: FinanceService,
    private readonly entregas: DeliveryService,
    private readonly lgpd: LgpdService,
  ) {}

  // ------------------------------------------------------- RELATÓRIOS ------

  @Get('relatorios')
  @Roles(...GESTAO)
  painel(
    @Query('de') de?: string,
    @Query('ate') ate?: string,
    @Query('marca') marca?: string,
    @Query('unidade') unidade?: string,
    @Query('canal') canal?: string,
  ) {
    return this.relatorios.painel({
      de,
      ate,
      brandId: marca || undefined,
      unitId: unidade || undefined,
      channel: canal ? lerCanal(canal) : undefined,
    });
  }

  // ---------------------------------------------------------- ESTOQUE ------

  @Get('insumos')
  @Roles(...GESTAO)
  insumos() {
    return this.estoque.listarInsumos();
  }

  @Post('insumos')
  @Roles(...GESTAO)
  criarInsumo(
    @Body()
    dto: {
      name: string;
      measure: SupplyUnit;
      costPerUnitCents: number;
      stockQty?: number;
      minStockQty?: number;
    },
  ) {
    return this.estoque.criarInsumo(dto);
  }

  @Patch('insumos/:id')
  @Roles(...GESTAO)
  atualizarInsumo(@Param('id') id: string, @Body() dto: any) {
    return this.estoque.atualizarInsumo(id, dto);
  }

  /** Entrada de compra, perda ou acerto de inventário. */
  @Post('insumos/:id/movimento')
  @Roles(...GESTAO)
  movimentar(
    @Param('id') id: string,
    @Body() dto: { type: StockMovementType; quantity: number; unitCostCents?: number; note?: string },
  ) {
    return this.estoque.movimentar({ supplyId: id, ...dto });
  }

  @Get('insumos/:id/extrato')
  @Roles(...GESTAO)
  extratoDoInsumo(@Param('id') id: string) {
    return this.estoque.extrato(id);
  }

  @Get('alertas-estoque')
  @Roles(...GESTAO_E_CAIXA)
  alertas() {
    return this.estoque.alertas();
  }

  // --------------------------------------------------- FICHA TÉCNICA ------

  @Get('ficha/:itemId')
  @Roles(...GESTAO)
  ficha(@Param('itemId') itemId: string) {
    return this.estoque.fichaTecnica(itemId);
  }

  @Post('ficha/:itemId')
  @Roles(...GESTAO)
  definirLinha(
    @Param('itemId') itemId: string,
    @Body() dto: { supplyId: string; quantity: number; wastePercent?: number },
  ) {
    return this.estoque.definirLinhaDaFicha({ itemId, ...dto });
  }

  @Delete('ficha/linha/:id')
  @Roles(...GESTAO)
  removerLinha(@Param('id') id: string) {
    return this.estoque.removerLinhaDaFicha(id);
  }

  @Get('rentabilidade')
  @Roles(...GESTAO)
  rentabilidade(@Query('marca') marca?: string) {
    return this.estoque.rentabilidade(marca || undefined);
  }

  // ------------------------------------------------------- FINANCEIRO ------

  @Get('financeiro/lancamentos')
  @Roles(...GESTAO)
  lancamentos(
    @Query('tipo') tipo?: string,
    @Query('status') status?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
  ) {
    return this.financeiro.listarLancamentos({
      type: (tipo as EntryType) || undefined,
      status: (status as EntryStatus) || undefined,
      de,
      ate,
    });
  }

  @Post('financeiro/lancamentos')
  @Roles(...GESTAO)
  criarLancamento(
    @Body()
    dto: {
      type: EntryType;
      category: string;
      description: string;
      amountCents: number;
      dueDate: string;
      party?: string;
      brandId?: string;
    },
  ) {
    return this.financeiro.criarLancamento(dto);
  }

  @Patch('financeiro/lancamentos/:id/quitar')
  @Roles(...GESTAO)
  quitar(@Param('id') id: string) {
    return this.financeiro.quitar(id);
  }

  @Get('financeiro/resumo')
  @Roles(...GESTAO)
  resumoDeContas() {
    return this.financeiro.resumoDeContas();
  }

  @Get('financeiro/dre')
  @Roles(...GESTAO)
  dre(@Query('de') de?: string, @Query('ate') ate?: string, @Query('marca') marca?: string) {
    return this.financeiro.dre({ de, ate, brandId: marca || undefined });
  }

  // ------------------------------------------------------ ENTREGADORES -----

  @Get('entregadores')
  @Roles(...GESTAO_E_CAIXA)
  entregadores() {
    return this.entregas.listarEntregadores();
  }

  @Post('entregadores')
  @Roles(...GESTAO)
  criarEntregador(
    @Body()
    dto: { name: string; phone: string; vehicle?: string; payModel?: CourierPayModel; fixedPayCents?: number },
  ) {
    return this.entregas.criarEntregador(dto);
  }

  @Patch('entregadores/:id')
  @Roles(...GESTAO)
  atualizarEntregador(@Param('id') id: string, @Body() dto: any) {
    return this.entregas.atualizarEntregador(id, dto);
  }

  @Get('entregas')
  @Roles(...GESTAO_E_CAIXA)
  corridas(@Query('status') status?: string) {
    return this.entregas.listarCorridas((status as DispatchStatus) || undefined);
  }

  @Get('entregas/sem-entregador')
  @Roles(...GESTAO_E_CAIXA)
  semEntregador() {
    return this.entregas.pedidosSemEntregador();
  }

  /** Atribuir um pedido a um motoboy. */
  @Post('entregas/atribuir')
  @Roles(...GESTAO_E_CAIXA)
  atribuir(@Body() dto: { orderId: string; courierId: string }) {
    return this.entregas.atribuir(dto.orderId, dto.courierId);
  }

  /**
   * POOL DA REDE: o sistema escolhe sozinho o entregador mais perto e mais
   * livre, incluindo os de outros restaurantes que aceitam corridas da rede.
   */
  @Post('entregas/pool')
  @Roles(...GESTAO_E_CAIXA)
  despacharPeloPool(@Body() dto: { orderId: string }) {
    return this.entregas.despacharPeloPool(dto.orderId);
  }

  @Patch('entregas/:id/status')
  @Roles(...GESTAO_E_CAIXA)
  mudarStatusDaEntrega(@Param('id') id: string, @Body() dto: { status: DispatchStatus }) {
    return this.entregas.mudarStatus(id, dto.status);
  }

  // ------------------------------------------------------------ ACERTOS ----

  @Get('acertos')
  @Roles(...GESTAO)
  acertos() {
    return this.entregas.listarAcertos();
  }

  @Post('acertos/motoboy')
  @Roles(...GESTAO)
  acertoMotoboy(@Body() dto: { courierId: string; de: string; ate: string }) {
    return this.entregas.fecharAcertoDeEntregador(dto.courierId, dto.de, dto.ate);
  }

  @Post('acertos/garcom')
  @Roles(...GESTAO)
  acertoGarcom(@Body() dto: { userId: string; de: string; ate: string; percentualDaTaxa?: number }) {
    return this.entregas.fecharAcertoDeGarcom(dto.userId, dto.de, dto.ate, dto.percentualDaTaxa);
  }

  @Patch('acertos/:id/pagar')
  @Roles(...GESTAO)
  pagarAcerto(@Param('id') id: string) {
    return this.entregas.pagarAcerto(id);
  }

  // --------------------------------------------------------------- LGPD ----

  @Get('lgpd/:customerId/exportar')
  @Roles(...GESTAO)
  exportar(@Param('customerId') customerId: string) {
    return this.lgpd.exportar(customerId);
  }

  @Post('lgpd/:customerId/anonimizar')
  @Roles(...GESTAO)
  anonimizar(@Param('customerId') customerId: string, @Body() dto: { motivo?: string }) {
    return this.lgpd.anonimizar(customerId, dto?.motivo);
  }

  @Get('lgpd/:customerId/consentimentos')
  @Roles(...GESTAO)
  consentimentos(@Param('customerId') customerId: string) {
    return this.lgpd.historico(customerId);
  }

  @Post('lgpd/:customerId/consentimento')
  @Roles(...GESTAO)
  registrarConsentimento(
    @Param('customerId') customerId: string,
    @Body() dto: { type: ConsentType; granted: boolean; source?: string },
  ) {
    return this.lgpd.registrarConsentimento({
      customerId,
      type: dto.type,
      granted: dto.granted,
      source: dto.source ?? 'painel',
    });
  }
}
