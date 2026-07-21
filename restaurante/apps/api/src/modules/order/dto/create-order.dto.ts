import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class ItemDoPedidoDto {
  @IsString()
  itemId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  /** ids dos complementos escolhidos */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modifierIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;
}

export class CreateOrderDto {
  @IsString()
  @MinLength(2, { message: 'Informe o nome de quem vai receber.' })
  @MaxLength(120)
  customerName: string;

  @IsString()
  @MinLength(8, { message: 'Informe um telefone com DDD.' })
  @MaxLength(20)
  customerPhone: string;

  @IsOptional() @IsString() @MaxLength(160) addressStreet?: string;
  @IsOptional() @IsString() @MaxLength(20) addressNumber?: string;
  @IsOptional() @IsString() @MaxLength(80) addressDistrict?: string;
  @IsOptional() @IsString() @MaxLength(80) addressCity?: string;
  @IsOptional() @IsString() @MaxLength(200) addressNote?: string;

  /** Agendamento: quando o cliente quer receber. Vazio = "para agora". */
  @IsOptional()
  @IsISO8601({}, { message: 'Data do agendamento inválida.' })
  scheduledFor?: string;

  @IsOptional() @IsString() @MaxLength(300) notes?: string;

  @IsEnum(PaymentMethod, { message: 'Forma de pagamento inválida.' })
  paymentMethod: PaymentMethod;

  @IsArray()
  @ArrayMinSize(1, { message: 'O carrinho está vazio.' })
  @ValidateNested({ each: true })
  @Type(() => ItemDoPedidoDto)
  items: ItemDoPedidoDto[];
}
