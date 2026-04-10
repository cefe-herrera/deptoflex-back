"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const roles = [
        { id: 1, name: 'ADMIN', description: 'Administrador del sistema' },
        { id: 2, name: 'OPERATOR', description: 'Operador con acceso a gestión de propiedades' },
        { id: 3, name: 'USER', description: 'Usuario registrado sin rol de embajador' },
        { id: 4, name: 'AMBASSADOR', description: 'Embajador aprobado' },
    ];
    for (const role of roles) {
        await prisma.role.upsert({
            where: { name: role.name },
            update: { description: role.description },
            create: role,
        });
    }
    console.log('Roles seeded:', roles.map((r) => r.name).join(', '));
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=seed.js.map