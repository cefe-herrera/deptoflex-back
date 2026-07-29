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

export function countAmbassadorsWithIncompleteDocs(
  profiles: Array<{
    personType: PersonType | null;
    ambassadorDocuments: Array<{ documentType: AmbassadorDocumentType }>;
  }>,
): number {
  return profiles.filter(
    (profile) =>
      !isAmbassadorDocumentationComplete(
        profile.personType,
        profile.ambassadorDocuments.map((doc) => doc.documentType),
      ),
  ).length;
}

export function getDocumentationReviewSummary(
  personType: PersonType | null | undefined,
  presentTypes: Iterable<AmbassadorDocumentType>,
  documentationApprovedAt: Date | null | undefined,
) {
  const missingDocTypes = getMissingAmbassadorDocTypes(personType, presentTypes);
  const documentationComplete = missingDocTypes.length === 0;
  return {
    documentationComplete,
    missingDocTypes,
    documentationApproved: documentationComplete && !!documentationApprovedAt,
    documentationPendingReview: documentationComplete && !documentationApprovedAt,
  };
}
