import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { ItemDoPedidoDto } from '../../order/dto/create-order.dto';

/**
 * Uma venda de balcão.
 *
 * É bem mais curta que o pedido de delivery: não tem endereço, não tem frete e
 * o pagamento acontece AGORA, na frente do caixa — não depois, por webhook.
 */
export class VendaPdvDto {
  @IsString()
  brandId: string;

  /**
   * Nome de quem está levando. Opcional: no balcão a fila anda, e obrigar o
   * caixa a digitar nome a cada café seria um jeito rápido de ninguém usar.
   * Vazio vira "Balcão".
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerName?: string;

  /**
   * Telefone, também opcional. Se vier, o cliente entra no CRM da marca e
   * ganha cashback quando o pedido for concluído — é o gancho para transformar
   * quem passou no balcão em cliente conhecido.
   */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  customerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;

  @IsEnum(PaymentMethod, { message: 'Forma de pagamento inválida.' })
  paymentMethod: PaymentMethod;

  /**
   * Só no dinheiro: quanto o cliente entregou, para o sistema calcular o troco.
   * Em centavos.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  receivedCents?: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'A venda está vazia.' })
  @ValidateNested({ each: true })
  @Type(() => ItemDoPedidoDto)
  items: ItemDoPedidoDto[];
}
