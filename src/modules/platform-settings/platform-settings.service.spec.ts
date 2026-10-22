import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PlatformSettingsService } from './platform-settings.service';

function build({
  envDefault = false,
  row = null as null | { value: unknown },
} = {}) {
  const prisma = {
    platformSetting: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          row && { ...row, updatedAt: new Date(), updatedBy: null },
        ),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const config = { get: jest.fn().mockReturnValue(envDefault) };
  const ambassadorAccess = {
    assertCanOperateAsAmbassador: jest
      .fn()
      .mockResolvedValue({ profileId: 'p1' }),
  };
  const audit = { log: jest.fn() };
  const service = new PlatformSettingsService(
    prisma as never,
    config as never,
    ambassadorAccess as never,
    audit as never,
  );
  return { service, prisma, ambassadorAccess };
}

const user = { id: 'u1', email: 'a@b.c', roles: ['USER'] };

describe('PlatformSettingsService', () => {
  it('usa el default del env cuando no hay override', async () => {
    const { service } = build({ envDefault: true });
    await expect(service.getBookingPolicy()).resolves.toMatchObject({
      requireApprovedAmbassador: true,
      source: 'env',
    });
  });

  it('el override del admin gana sobre el env', async () => {
    const { service } = build({ envDefault: true, row: { value: false } });
    await expect(service.getBookingPolicy()).resolves.toMatchObject({
      requireApprovedAmbassador: false,
      source: 'admin',
    });
  });

  it('con la política desactivada deja reservar a cualquiera', async () => {
    const { service, ambassadorAccess } = build();
    await expect(
      service.assertCanCreateBookings(undefined),
    ).resolves.toBeUndefined();
    expect(
      ambassadorAccess.assertCanOperateAsAmbassador,
    ).not.toHaveBeenCalled();
  });

  it('con la política activa exige sesión', async () => {
    const { service } = build({ envDefault: true });
    await expect(
      service.assertCanCreateBookings(undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('con la política activa rechaza a quien no es embajador aprobado', async () => {
    const { service, ambassadorAccess } = build({ envDefault: true });
    ambassadorAccess.assertCanOperateAsAmbassador.mockRejectedValue(
      new ForbiddenException('x'),
    );
    await expect(service.assertCanCreateBookings(user)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.getBookingAccess(user)).resolves.toMatchObject({
      canCreateBookings: false,
    });
  });

  it('con la política activa deja pasar a staff y embajadores aprobados', async () => {
    const { service, ambassadorAccess } = build({ envDefault: true });
    await expect(
      service.assertCanCreateBookings({ ...user, roles: ['OPERATOR'] }),
    ).resolves.toBeUndefined();
    expect(
      ambassadorAccess.assertCanOperateAsAmbassador,
    ).not.toHaveBeenCalled();
    await expect(
      service.assertCanCreateBookings(user),
    ).resolves.toBeUndefined();
  });

  it('null borra el override', async () => {
    const { service, prisma } = build({ row: { value: true } });
    await service.setBookingPolicy(null, 'admin1');
    expect(prisma.platformSetting.deleteMany).toHaveBeenCalled();
    expect(prisma.platformSetting.upsert).not.toHaveBeenCalled();
  });
});
