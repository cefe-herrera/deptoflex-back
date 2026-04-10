import { AmenitiesService } from './amenities.service';
import { CreateAmenityDto } from './dto/create-amenity.dto';
export declare class AmenitiesController {
    private amenitiesService;
    constructor(amenitiesService: AmenitiesService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        category: import(".prisma/client").$Enums.AmenityCategory;
        icon: string | null;
    }[]>;
    create(dto: CreateAmenityDto): import(".prisma/client").Prisma.Prisma__AmenityClient<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        category: import(".prisma/client").$Enums.AmenityCategory;
        icon: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    update(id: string, dto: Partial<CreateAmenityDto>): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        category: import(".prisma/client").$Enums.AmenityCategory;
        icon: string | null;
    }>;
    remove(id: string): Promise<void>;
}
