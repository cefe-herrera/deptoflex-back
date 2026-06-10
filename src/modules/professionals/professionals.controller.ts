import {
  Controller, Get, Patch, Post, Body, Param, ParseUUIDPipe, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ProfessionalsService } from './professionals.service';
import { UpdateProfessionalDto, AdminUpdateProfessionalDto } from './dto/update-professional.dto';
import { RequestAmbassadorDto } from './dto/request-ambassador.dto';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { MediaService } from '../media/media.service';
import { PresignUploadDto } from '../media/dto/presign-upload.dto';
import { ConfirmUploadDto } from '../media/dto/confirm-upload.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';

@ApiTags('Professionals')
@ApiBearerAuth('access-token')
@Controller('professionals')
export class ProfessionalsController {
  constructor(
    private professionalsService: ProfessionalsService,
    private mediaService: MediaService,
  ) { }

  @Get('me')
  @ApiOperation({
    summary: 'Obtener mi perfil profesional',
    description: 'Devuelve el perfil profesional asociado al usuario autenticado (datos, estado de verificación, comisiones, etc.).',
  })
  getMe(@CurrentUser() user: CurrentUserPayload) {
    return this.professionalsService.findByUserId(user.id);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Actualizar mi perfil profesional',
    description: 'Permite al profesional editar sus propios datos (bio, contacto, especialidades, etc.).',
  })
  updateMe(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateProfessionalDto) {
    return this.professionalsService.update(user.id, dto);
  }

  @Get()
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Listar profesionales',
    description: 'Devuelve los perfiles profesionales paginados. Solo ADMIN/OPERATOR.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.professionalsService.findAll(+page, +limit);
  }

  @Get(':id')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Obtener un profesional por ID',
    description: 'Devuelve el detalle de un perfil profesional. Solo ADMIN/OPERATOR.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.professionalsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Actualizar profesional (admin)',
    description: 'Permite a un ADMIN modificar campos sensibles del perfil profesional (estado, comisiones, etc.).',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  adminUpdate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminUpdateProfessionalDto) {
    return this.professionalsService.adminUpdate(id, dto);
  }

  @Post('me/request-ambassador')
  @ApiOperation({
    summary: 'Solicitar rol de embajador',
    description: 'El profesional envía sus datos (nombre, DNI, contacto, ubicación, tipo de persona) y solicita ser promovido a embajador. Los datos quedan persistidos en su perfil y la solicitud queda PENDING de aprobación por un ADMIN.',
  })
  requestAmbassador(@CurrentUser() user: CurrentUserPayload, @Body() dto: RequestAmbassadorDto) {
    return this.professionalsService.requestAmbassador(user.id, dto);
  }

  @Post('me/avatar/presign')
  @ApiOperation({
    summary: 'Presign de subida de mi avatar',
    description: 'Genera una URL prefirmada (S3) para que el frontend suba directamente el avatar del profesional autenticado.',
  })
  presignMyAvatar(@CurrentUser() user: CurrentUserPayload, @Body() dto: PresignUploadDto) {
    return this.professionalsService.getProfileIdByUserId(user.id).then((profileId) =>
      this.mediaService.presignForProfessional(profileId, dto, user.id),
    );
  }

  @Post('me/avatar/confirm')
  @ApiOperation({
    summary: 'Confirmar subida de mi avatar',
    description: 'Confirma que el avatar fue subido a S3 y lo asocia al perfil profesional del usuario autenticado.',
  })
  confirmMyAvatar(@CurrentUser() user: CurrentUserPayload, @Body() dto: ConfirmUploadDto) {
    return this.professionalsService.getProfileIdByUserId(user.id).then((profileId) =>
      this.mediaService.confirmAvatarForProfessional(profileId, dto),
    );
  }

  @Post(':id/avatar/presign')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Presign de avatar de un profesional (admin)',
    description: 'Genera una URL prefirmada para subir el avatar de cualquier profesional. Solo ADMIN/OPERATOR.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  presignAvatar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: PresignUploadDto,
  ) {
    return this.mediaService.presignForProfessional(id, dto, user.id);
  }

  @Post(':id/avatar/confirm')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({
    summary: 'Confirmar avatar de un profesional (admin)',
    description: 'Confirma la subida del avatar y lo asocia al perfil indicado. Solo ADMIN/OPERATOR.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  confirmAvatar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ConfirmUploadDto) {
    return this.mediaService.confirmAvatarForProfessional(id, dto);
  }

  @Post(':id/verify')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Verificar profesional',
    description: 'Marca al profesional como verificado, habilitándolo para operar. Solo ADMIN.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  verify(@Param('id', ParseUUIDPipe) id: string) {
    return this.professionalsService.verify(id);
  }

  @Post(':id/reject')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Rechazar profesional',
    description: 'Rechaza la solicitud de verificación del profesional. Solo ADMIN.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  reject(@Param('id', ParseUUIDPipe) id: string) {
    return this.professionalsService.reject(id);
  }

  @Post(':id/suspend')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Suspender profesional',
    description: 'Suspende al profesional impidiéndole operar hasta nueva orden. Solo ADMIN.',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  suspend(@Param('id', ParseUUIDPipe) id: string) {
    return this.professionalsService.suspend(id);
  }
}
