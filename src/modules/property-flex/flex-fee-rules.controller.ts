import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FlexFeeRuleKind } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { FlexFeeRulesService } from './flex-fee-rules.service';
import { CreateFlexFeeRuleDto, UpdateFlexFeeRuleDto } from './dto/flex-fee-rule.dto';

@ApiTags('Property Flex')
@ApiBearerAuth('access-token')
@Controller('flex-fee-rules')
export class FlexFeeRulesController {
  constructor(private feeRules: FlexFeeRulesService) {}

  @Get()
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({ summary: 'Listar reglas de depósito / comisión de ingreso' })
  @ApiQuery({ name: 'kind', required: false, enum: FlexFeeRuleKind })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  list(
    @Query('kind', new ParseEnumPipe(FlexFeeRuleKind, { optional: true })) kind?: FlexFeeRuleKind,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.feeRules.list(kind, activeOnly === 'true');
  }

  @Post()
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({ summary: 'Crear regla de depósito / comisión' })
  create(@Body() dto: CreateFlexFeeRuleDto) {
    return this.feeRules.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({ summary: 'Editar regla (afecta a todos los planes que la usan)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFlexFeeRuleDto) {
    return this.feeRules.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'OPERATOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar regla sin planes asociados' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.feeRules.remove(id);
  }
}
