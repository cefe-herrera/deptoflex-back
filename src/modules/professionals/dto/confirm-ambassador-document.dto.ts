import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ConfirmAmbassadorDocumentDto {
  @ApiProperty({ description: 'MediaFileId devuelto por el presign, ya subido al storage' })
  @IsUUID()
  mediaFileId: string;
}
