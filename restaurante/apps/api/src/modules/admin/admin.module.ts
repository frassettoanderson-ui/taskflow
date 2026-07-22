import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { CatalogAdminService } from './catalog-admin.service';
import { EstruturaAdminService } from './estrutura-admin.service';
import { OperacaoAdminService } from './operacao-admin.service';
import { UsuariosAdminService } from './usuarios-admin.service';
import { UploadService } from './upload.service';

/**
 * O CADASTRO — o que faltava para o sistema ser usado por um restaurante de
 * verdade, e não só pelos dados de exemplo.
 */
@Module({
  controllers: [AdminController],
  providers: [
    CatalogAdminService,
    EstruturaAdminService,
    OperacaoAdminService,
    UsuariosAdminService,
    UploadService,
  ],
  exports: [CatalogAdminService],
})
export class AdminModule {}
