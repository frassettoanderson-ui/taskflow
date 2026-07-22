import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SalaoService } from './salao.service';
import { PaymentService } from '../order/payment.service';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RequestContext } from '../../common/tenant/tenant-context.service';
import { Roles } from '../../common/auth/roles.decorator';
import {
  AbrirMesaDto,
  DividirContaDto,
  FilaDto,
  PagarParteDto,
  PedidoDeMesaDto,
  ReservaDto,
  TaxaDeServicoDto,
} from './dto/salao.dto';

/** Quem trabalha no salão. */
const EQUIPE_DO_SALAO = [Role.OWNER, Role.MANAGER, Role.CASHIER, Role.WAITER];

/**
 * Quem pode mexer em DINHEIRO.
 * Decisão do projeto: o garçom lança pedido e atende chamados, mas não fecha
 * conta nem recebe. É o motivo de existir o perfil Caixa.
 */
const QUEM_MEXE_COM_DINHEIRO = [Role.OWNER, Role.MANAGER, Role.CASHIER];

@Controller('salao')
export class SalaoController {
  constructor(
    private readonly salao: SalaoService,
    private readonly payments: PaymentService,
  ) {}

  // ---------------------------------------------------------------- mapa ---

  /** Mapa de mesas com o que está acontecendo em cada uma. */
  @Get('mesas')
  @Roles(...EQUIPE_DO_SALAO)
  mesas() {
    return this.salao.mapaDeMesas();
  }

  /** Abre a mesa (garçom sentando o cliente). */
  @Post('mesas/:tableId/abrir')
  @Roles(...EQUIPE_DO_SALAO)
  abrirMesa(
    @Param('tableId') tableId: string,
    @Body() dto: AbrirMesaDto,
    @CurrentUser() user: RequestContext,
  ) {
    return this.salao.abrirMesa(tableId, dto.pessoas, user.userId);
  }

  // ------------------------------------------------------------ chamados ---

  /** Chamados pendentes — a tela do garçom. */
  @Get('chamados')
  @Roles(...EQUIPE_DO_SALAO)
  chamados() {
    return this.salao.chamadosPendentes();
  }

  @Patch('chamados/:id/atender')
  @Roles(...EQUIPE_DO_SALAO)
  atender(@Param('id') id: string, @CurrentUser() user: RequestContext) {
    return this.salao.atenderChamado(id, user.userId);
  }

  // ------------------------------------------------------------- comanda ---

  @Get('comandas/:id')
  @Roles(...EQUIPE_DO_SALAO)
  comanda(@Param('id') id: string) {
    return this.salao.formatarComanda(id);
  }

  /** O GARÇOM lança uma rodada pela comanda digital. */
  @Post('mesas/:qrToken/pedido')
  @Roles(...EQUIPE_DO_SALAO)
  lancarPedido(
    @Param('qrToken') qrToken: string,
    @Body() dto: PedidoDeMesaDto,
    @CurrentUser() user: RequestContext,
  ) {
    return this.salao.pedirNaMesa(
      qrToken,
      { itens: dto.itens, nome: dto.nome, notes: dto.notes, pessoas: dto.pessoas },
      user.userId,
    );
  }

  // ---------------------------------------------------------------- conta ---

  /** Liga/desliga a taxa de serviço de 10%. */
  @Patch('comandas/:id/taxa')
  @Roles(...QUEM_MEXE_COM_DINHEIRO)
  taxa(@Param('id') id: string, @Body() dto: TaxaDeServicoDto) {
    return this.salao.alternarTaxaDeServico(id, dto.ligada);
  }

  /** Fecha a conta: não entram mais pedidos, só falta pagar. */
  @Post('comandas/:id/fechar')
  @Roles(...QUEM_MEXE_COM_DINHEIRO)
  fechar(@Param('id') id: string) {
    return this.salao.fecharConta(id);
  }

  /** Reabre (o cliente pediu mais uma coisa depois de fechar). */
  @Post('comandas/:id/reabrir')
  @Roles(...QUEM_MEXE_COM_DINHEIRO)
  reabrir(@Param('id') id: string) {
    return this.salao.reabrirConta(id);
  }

  /** Gera o Pix de UMA parte da conta (valor livre). */
  @Post('comandas/:id/pagamentos')
  @Roles(...QUEM_MEXE_COM_DINHEIRO)
  pagarParte(@Param('id') id: string, @Body() dto: PagarParteDto) {
    return this.payments.criarCobrancaDeSessao(id, dto.amountCents);
  }

  /**
   * Divide a conta em N partes iguais e gera um Pix para cada uma.
   * O último recebe a sobra dos centavos, para a soma fechar exata.
   */
  @Post('comandas/:id/dividir')
  @Roles(...QUEM_MEXE_COM_DINHEIRO)
  async dividir(@Param('id') id: string, @Body() dto: DividirContaDto) {
    const falta = await this.salao.faltaPagar(id);
    if (falta <= 0) return { cobrancas: [], faltaCents: 0 };

    const base = Math.floor(falta / dto.partes);
    const sobra = falta - base * dto.partes;

    const cobrancas: Array<Awaited<ReturnType<PaymentService['criarCobrancaDeSessao']>>> = [];
    for (let i = 0; i < dto.partes; i++) {
      const valor = i === dto.partes - 1 ? base + sobra : base;
      cobrancas.push(await this.payments.criarCobrancaDeSessao(id, valor));
    }

    return { cobrancas, faltaCents: falta };
  }

  // ------------------------------------------------------ fila e reservas ---

  @Get('fila')
  @Roles(...EQUIPE_DO_SALAO)
  fila() {
    return this.salao.listarFila();
  }

  @Post('fila')
  @Roles(...EQUIPE_DO_SALAO)
  async entrarNaFila(@Body() dto: FilaDto) {
    const mesas = await this.salao.mapaDeMesas();
    const unitId = await this.salao.unidadeDoSalao();
    return this.salao.entrarNaFila({ ...dto, unitId: unitId ?? mesas[0]?.id ?? '' });
  }

  @Patch('fila/:id')
  @Roles(...EQUIPE_DO_SALAO)
  mudarFila(@Param('id') id: string, @Body() dto: { status: 'CALLED' | 'SEATED' | 'GAVE_UP' }) {
    return this.salao.mudarFila(id, dto.status);
  }

  @Get('reservas')
  @Roles(...EQUIPE_DO_SALAO)
  reservas() {
    return this.salao.listarReservas();
  }

  @Post('reservas')
  @Roles(...EQUIPE_DO_SALAO)
  async criarReserva(@Body() dto: ReservaDto) {
    const unitId = await this.salao.unidadeDoSalao();
    return this.salao.criarReserva({ ...dto, unitId: unitId ?? '' });
  }

  @Patch('reservas/:id')
  @Roles(...EQUIPE_DO_SALAO)
  mudarReserva(
    @Param('id') id: string,
    @Body() dto: { status: 'SEATED' | 'CANCELED' | 'NO_SHOW' },
  ) {
    return this.salao.mudarReserva(id, dto.status);
  }
}
