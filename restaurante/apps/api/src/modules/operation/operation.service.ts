import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DeliveryAreaKind, SalesChannel } from '@prisma/client';
import { TenantPrismaService } from '../../common/tenant/tenant-prisma.service';
import { MAP_PROVIDER, MapProvider } from '../../adapters/map/map.port';
import { distanciaEmKm } from '../../adapters/map/fake-map.provider';
import { lerRegras } from '../order/pricing';

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export interface SituacaoDaMarca {
  /** dá para pedir agora? */
  aberto: boolean;
  /** "pausada" | "fora do horário" | "sem horário cadastrado" | null */
  motivo: string | null;
  /** ex.: "Hoje das 11:00 às 23:00" */
  horarioDeHoje: string | null;
}

export interface ResultadoDoFrete {
  feeCents: number;
  /** como o valor foi obtido, para mostrar na tela */
  descricao: string;
  areaId: string | null;
  distanciaKm: number | null;
}

/** Endereço que o cliente digitou. */
export interface EnderecoDoCliente {
  street?: string;
  number?: string;
  district?: string;
  city?: string;
}

function hhmm(minutos: number) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function semAcento(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * As REGRAS DE OPERAÇÃO de cada marca: está aberta? entrega aqui? quanto custa?
 *
 * Tudo é por MARCA e por CANAL — a mesma marca pode estar aberta no balcão e
 * fechada no delivery.
 */
@Injectable()
export class OperationService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    @Inject(MAP_PROVIDER) private readonly mapa: MapProvider,
  ) {}

  // =========================================================================
  //  Está aberta agora?
  // =========================================================================

  /**
   * ⚠️ Data e hora: usamos o relógio LOCAL do servidor, que roda em
   * America/Sao_Paulo (definido no docker-compose). Nunca UTC — senão, das 21h
   * à meia-noite, o sistema acharia que já é o dia seguinte e usaria o horário
   * errado da semana.
   */
  async situacao(
    brand: { id: string; paused: boolean; pausedReason?: string | null },
    channel: SalesChannel,
    agora = new Date(),
  ): Promise<SituacaoDaMarca> {
    if (brand.paused) {
      return {
        aberto: false,
        motivo: brand.pausedReason?.trim() || 'Pausada no momento',
        horarioDeHoje: null,
      };
    }

    const diaDaSemana = agora.getDay();
    const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

    const horarios = await this.tenantPrisma.db.openingHour.findMany({
      where: { brandId: brand.id, channel, weekday: diaDaSemana },
      orderBy: { opensAtMinutes: 'asc' },
    });

    if (horarios.length === 0) {
      return {
        aberto: false,
        motivo: `Fechado ${DIAS[diaDaSemana] === 'domingo' ? 'aos domingos' : `às ${DIAS[diaDaSemana]}s`}`,
        horarioDeHoje: null,
      };
    }

    const aberto = horarios.some(
      (h) => minutosAgora >= h.opensAtMinutes && minutosAgora <= h.closesAtMinutes,
    );

    const texto = horarios
      .map((h) => `${hhmm(h.opensAtMinutes)} às ${hhmm(h.closesAtMinutes)}`)
      .join(' e ');

    return {
      aberto,
      motivo: aberto ? null : `Fora do horário — hoje das ${texto}`,
      horarioDeHoje: `Hoje das ${texto}`,
    };
  }

  /** Recusa o pedido se a marca não estiver aceitando agora. */
  async exigirAberto(
    brand: { id: string; name: string; paused: boolean; pausedReason?: string | null },
    channel: SalesChannel,
  ) {
    const s = await this.situacao(brand, channel);
    if (!s.aberto) {
      throw new BadRequestException(`${brand.name} não está aceitando pedidos: ${s.motivo}.`);
    }
  }

  /** Horários da semana, para mostrar na tela. */
  async horariosDaSemana(brandId: string, channel: SalesChannel) {
    const horarios = await this.tenantPrisma.db.openingHour.findMany({
      where: { brandId, channel },
      orderBy: [{ weekday: 'asc' }, { opensAtMinutes: 'asc' }],
    });

    return DIAS.map((nome, dia) => {
      const doDia = horarios.filter((h) => h.weekday === dia);
      return {
        weekday: dia,
        dia: nome,
        fechado: doDia.length === 0,
        faixas: doDia.map((h) => `${hhmm(h.opensAtMinutes)} às ${hhmm(h.closesAtMinutes)}`),
      };
    });
  }

  // =========================================================================
  //  Entrega aqui? Quanto custa?
  // =========================================================================

  /** As regras de área de uma marca, para mostrar na tela. */
  async areasDeEntrega(brandId: string, channel: SalesChannel = SalesChannel.DELIVERY) {
    return this.tenantPrisma.db.deliveryArea.findMany({
      where: { brandId, channel, active: true },
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  /**
   * Calcula o frete e, de quebra, decide se a marca entrega naquele endereço.
   *
   * Dois modos, conforme a marca cadastrou:
   *   - POR BAIRRO: procura o bairro na lista. Não achou = não entrega.
   *   - POR RAIO: descobre a distância até a cozinha e encontra a faixa de km.
   *
   * Se a marca não cadastrou área nenhuma, cai no valor fixo de configuração —
   * é o que mantém as marcas antigas funcionando.
   */
  async calcularFrete(
    brandId: string,
    channel: SalesChannel,
    endereco: EnderecoDoCliente,
    subtotalCents: number,
  ): Promise<ResultadoDoFrete> {
    // Canal sem entrega (salão, balcão) não tem frete.
    if (channel !== SalesChannel.DELIVERY) {
      return { feeCents: 0, descricao: 'Sem entrega neste canal', areaId: null, distanciaKm: null };
    }

    const areas = await this.areasDeEntrega(brandId, channel);

    if (areas.length === 0) {
      const regras = lerRegras();
      return {
        feeCents: regras.taxaEntregaCents,
        descricao: 'Taxa padrão',
        areaId: null,
        distanciaKm: null,
      };
    }

    // ---- 1) por bairro ----
    const porBairro = areas.filter((a) => a.kind === DeliveryAreaKind.DISTRICT);
    if (porBairro.length > 0 && endereco.district) {
      const alvo = semAcento(endereco.district);
      const achou = porBairro.find((a) => a.districtName && semAcento(a.districtName) === alvo);

      if (achou) {
        this.conferirPedidoMinimo(achou.minOrderCents, subtotalCents, `o bairro ${achou.districtName}`);
        return {
          feeCents: achou.feeCents,
          descricao: `Bairro ${achou.districtName}`,
          areaId: achou.id,
          distanciaKm: null,
        };
      }
    }

    // ---- 2) por raio ----
    const porRaio = areas
      .filter((a) => a.kind === DeliveryAreaKind.RADIUS && a.maxDistanceKm != null)
      .sort((a, b) => (a.maxDistanceKm ?? 0) - (b.maxDistanceKm ?? 0));

    if (porRaio.length > 0) {
      const origem = await this.coordenadaDaCozinha(brandId);
      if (!origem) {
        throw new BadRequestException(
          'Esta marca ainda não tem a localização da cozinha cadastrada.',
        );
      }

      const destino = await this.mapa.geocode({
        street: endereco.street ?? '',
        number: endereco.number,
        district: endereco.district,
        city: endereco.city ?? '',
        state: 'SC',
      });

      if (!destino) {
        throw new BadRequestException(
          'Não consegui localizar o seu endereço para calcular a entrega. Confira o bairro.',
        );
      }

      const km = distanciaEmKm(origem, destino);
      const faixa = porRaio.find((a) => km <= (a.maxDistanceKm ?? 0));

      if (faixa) {
        this.conferirPedidoMinimo(faixa.minOrderCents, subtotalCents, 'essa distância');
        return {
          feeCents: faixa.feeCents,
          descricao: `${km.toFixed(1)} km — faixa até ${faixa.maxDistanceKm} km`,
          areaId: faixa.id,
          distanciaKm: Number(km.toFixed(2)),
        };
      }

      const maior = porRaio[porRaio.length - 1];
      throw new BadRequestException(
        `Seu endereço está a ${km.toFixed(1)} km e esta marca entrega até ${maior.maxDistanceKm} km.`,
      );
    }

    // Cadastrou só bairros e o do cliente não está na lista.
    const lista = porBairro.map((a) => a.districtName).filter(Boolean).join(', ');
    throw new BadRequestException(
      `Ainda não entregamos no bairro "${endereco.district ?? '—'}". Bairros atendidos: ${lista}.`,
    );
  }

  private conferirPedidoMinimo(minimo: number, subtotal: number, onde: string) {
    if (minimo > 0 && subtotal < minimo) {
      throw new BadRequestException(
        `Para ${onde} o pedido mínimo é ${(minimo / 100).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })}.`,
      );
    }
  }

  /** De onde sai a entrega: a cozinha (unidade) onde a marca opera. */
  private async coordenadaDaCozinha(brandId: string) {
    const vinculo = await this.tenantPrisma.db.brandUnit.findFirst({
      where: { brandId, active: true },
      include: { unit: true },
      orderBy: { createdAt: 'asc' },
    });

    const u = vinculo?.unit;
    if (!u?.latitude || !u?.longitude) return null;
    return { lat: u.latitude, lng: u.longitude };
  }

  // =========================================================================
  //  Pausar
  // =========================================================================

  /** Liga/desliga a marca inteira. */
  async pausarMarca(brandId: string, pausar: boolean, motivo?: string) {
    return this.tenantPrisma.db.brand.update({
      where: { id: brandId },
      data: { paused: pausar, pausedReason: pausar ? (motivo ?? null) : null },
      select: { id: true, name: true, paused: true, pausedReason: true },
    });
  }

  /** Liga/desliga um item do cardápio. */
  async pausarItem(itemId: string, pausar: boolean) {
    return this.tenantPrisma.db.item.update({
      where: { id: itemId },
      data: { active: !pausar },
      select: { id: true, name: true, active: true },
    });
  }
}
