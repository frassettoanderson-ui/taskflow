import { IsHexColor, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateBrandDto {
  @IsString()
  @MinLength(2)
  name: string;

  /** Vira o endereço público do cardápio: /m/<slug> */
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'O slug só pode ter letras minúsculas, números e hífen.',
  })
  slug: string;

  @IsOptional()
  @IsHexColor({ message: 'A cor precisa estar no formato #RRGGBB.' })
  primaryColor?: string;
}
