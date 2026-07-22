import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ItemDoPedidoDto } from '../../order/dto/create-order.dto';

export class PedidoDeMesaDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'O carrinho está vazio.' })
  @ValidateNested({ each: true })
  @Type(() => ItemDoPedidoDto)
  itens: ItemDoPedidoDto[];

  /** nome de quem está pedindo (opcional — vira "Mesa 5" se vazio) */
  @IsOptional() @IsString() @MaxLength(80) nome?: string;

  @IsOptional() @IsString() @MaxLength(300) notes?: string;

  @IsOptional() @IsInt() @Min(1) @Max(50) pessoas?: number;
}

export class AbrirMesaDto {
  @IsInt() @Min(1) @Max(50) pessoas: number;
}

export class TaxaDeServicoDto {
  @IsBoolean() ligada: boolean;
}

export class PagarParteDto {
  /** valor desta parte, em centavos */
  @IsInt() @Min(1) amountCents: number;
}

export class DividirContaDto {
  /** em quantas partes iguais */
  @IsInt() @Min(2) @Max(20) partes: number;
}

export class FilaDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsString() @MinLength(8) @MaxLength(20) phone: string;
  @IsInt() @Min(1) @Max(30) guests: number;
}

export class ReservaDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsString() @MinLength(8) @MaxLength(20) phone: string;
  @IsInt() @Min(1) @Max(30) guests: number;

  @IsISO8601({}, { message: 'Data da reserva inválida.' })
  when: string;

  @IsOptional() @IsString() tableId?: string;
  @IsOptional() @IsString() @MaxLength(200) notes?: string;
}
