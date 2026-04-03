import {
  Controller, Get, Patch, Delete, Body, Param, ParseUUIDPipe, ParseIntPipe, Query,
  Post, HttpCode, HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) { }

  @Get('me')
  getMe(@CurrentUser() user: CurrentUserPayload) {
    return this.usersService.findOne(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user.id, dto);
  }

  @Get()
  @Roles('ADMIN', 'OPERATOR')
  findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.usersService.findAll(+page, +limit);
  }

  @Get(':id')
  @Roles('ADMIN', 'OPERATOR')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.softDelete(id);
  }

  @Post(':id/roles')
  @Roles('ADMIN')
  assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('roleId', ParseIntPipe) roleId: number,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.usersService.assignRole(id, roleId, user.id);
  }

  @Delete(':id/roles/:roleId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseIntPipe) roleId: number,
  ) {
    return this.usersService.removeRole(id, roleId);
  }
}
