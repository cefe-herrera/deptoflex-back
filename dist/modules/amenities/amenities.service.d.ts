import { PrismaService } from '../prisma/prisma.service';
import { CreateAmenityDto } from './dto/create-amenity.dto';
export declare class AmenitiesService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        category: import(".prisma/client").$Enums.AmenityCategory;
        icon: string | null;
    }[]>;
    create(dto: CreateAmenityDto): import(".prisma/client").Prisma.Prisma__AmenityClient<{
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        category: import(".prisma/client").$Enums.AmenityCategory;
        icon: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    update(id: string, dto: Partial<CreateAmenityDto>): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        updatedAt: Date;
        category: import(".prisma/client").$Enums.AmenityCategory;
        icon: string | null;
    }>;
    remove(id: string): Promise<void>;
}
