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

/** Infers registration flow from uploaded docs when personType is not yet persisted. */
export function inferPersonTypeFromDocuments(
  presentTypes: Iterable<AmbassadorDocumentType>,
): PersonType | null {
  const types = new Set(presentTypes);
  const hasAgency =
    types.has(AmbassadorDocumentType.CUIT_CERTIFICATE)
    || types.has(AmbassadorDocumentType.FOUNDING_DOCUMENT);
  const hasIndividual =
    types.has(AmbassadorDocumentType.DNI_FRONT)
    || types.has(AmbassadorDocumentType.DNI_BACK)
    || types.has(AmbassadorDocumentType.SELFIE);
  if (hasAgency) return PersonType.COMPANY;
  if (hasIndividual) return PersonType.INDIVIDUAL;
  return null;
}

export type RegistrationStage =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'REJECTED';

export function getRegistrationStage(profile: {
  status: string;
  isVerified: boolean;
  ambassadorRequestedAt: Date | null;
  personType: PersonType | null;
}, docCount: number): RegistrationStage {
  if (profile.status === 'SUSPENDED') return 'SUSPENDED';
  if (profile.status === 'REJECTED') return 'REJECTED';
  if (profile.status === 'ACTIVE' && profile.isVerified) return 'ACTIVE';
  if (profile.ambassadorRequestedAt && profile.status === 'PENDING') return 'SUBMITTED';
  if (docCount > 0 || profile.personType) return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

export function getEffectivePersonType(
  personType: PersonType | null | undefined,
  presentTypes: Iterable<AmbassadorDocumentType>,
): PersonType | null {
  return personType ?? inferPersonTypeFromDocuments(presentTypes);
}

export function getAmbassadorOperationalSummary(input: {
  status: string;
  isVerified: boolean;
  ambassadorRequestedAt: Date | null;
  personType: PersonType | null;
  documentationApprovedAt: Date | null;
  docTypes: AmbassadorDocumentType[];
  hasAmbassadorRole: boolean;
  agencyTeamMembersCount: number;
}) {
  const effectivePersonType = getEffectivePersonType(input.personType, input.docTypes);
  const docReview = getDocumentationReviewSummary(
    effectivePersonType,
    input.docTypes,
    input.documentationApprovedAt,
  );
  const registrationStage = getRegistrationStage(
    {
      status: input.status,
      isVerified: input.isVerified,
      ambassadorRequestedAt: input.ambassadorRequestedAt,
      personType: input.personType,
    },
    input.docTypes.length,
  );
  const personTypeConfirmed = !!input.personType;
  const personTypeInferred = !input.personType && !!effectivePersonType;

  const canOperateAsAmbassador =
    input.hasAmbassadorRole
    && input.status === 'ACTIVE'
    && input.isVerified;

  let operationalBlockReason: string | null = null;
  if (!canOperateAsAmbassador) {
    if (!input.hasAmbassadorRole && registrationStage === 'NOT_STARTED') {
      operationalBlockReason = 'Sin iniciar registro de embajador';
    } else if (!input.hasAmbassadorRole) {
      operationalBlockReason = 'Sin rol de embajador';
    } else if (input.status === 'PENDING') {
      operationalBlockReason = 'Cuenta pendiente de activación';
    } else if (input.status === 'SUSPENDED') {
      operationalBlockReason = 'Cuenta suspendida';
    } else if (input.status === 'REJECTED') {
      operationalBlockReason = 'Solicitud rechazada';
    } else if (!input.isVerified) {
      operationalBlockReason = 'Cuenta no verificada';
    }
  }

  return {
    effectivePersonType,
    personTypeConfirmed,
    personTypeInferred,
    registrationStage,
    canOperateAsAmbassador,
    operationalBlockReason,
    documentationReview: docReview,
    agencyTeamMembersCount: input.agencyTeamMembersCount,
  };
}
