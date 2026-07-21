import { IsEmail, IsString, MinLength } from 'class-validator';

/** O que a tela de login manda para o backend. */
export class LoginDto {
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'A senha precisa ter pelo menos 6 caracteres.' })
  password: string;
}
