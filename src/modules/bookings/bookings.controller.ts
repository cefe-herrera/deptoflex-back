import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { BookingsService } from './bookings.service';

@Controller('bookings')
export class BookingsController {
    constructor(private readonly bookingsService: BookingsService) { }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.bookingsService.findOne(id);
    }
}
