import { AmbassadorDocumentType, PersonType } from '@prisma/client';

export function getRequiredAmbassadorDocTypes(
  personType: PersonType | null | undefined,
): AmbassadorDocumentType[] {
  return personType === PersonType.COMPANY
    ? [AmbassadorDocumentType.CUIT_CERTIFICATE, AmbassadorDocumentType.FOUNDING_DOCUMENT]
    : [
        AmbassadorDocumentType.DNI_FRONT,
        AmbassadorDocumentType.DNI_BACK,
        AmbassadorDocumentType.SELFIE,
      ];
}

export function getMissingAmbassadorDocTypes(
  personType: PersonType | null | undefined,
  presentTypes: Iterable<AmbassadorDocumentType>,
): AmbassadorDocumentType[] {
  const present = new Set(presentTypes);
  return getRequiredAmbassadorDocTypes(personType).filter((type) => !present.has(type));
}

export function isAmbassadorDocumentationComplete(
  personType: PersonType | null | undefined,
  presentTypes: Iterable<AmbassadorDocumentType>,
): boolean {
  return getMissingAmbassadorDocTypes(personType, presentTypes).length === 0;
}
