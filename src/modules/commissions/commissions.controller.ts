import { Controller, Get } from '@nestjs/common';
import { CommissionsService } from './commissions.service';

@Controller('commissions')
export class CommissionsController {
    constructor(private readonly commissionsService: CommissionsService) { }

    @Get()
    findAll() {
        return this.commissionsService.findAll();
    }
}
