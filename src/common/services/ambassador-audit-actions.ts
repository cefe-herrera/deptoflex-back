/**
 * Acciones de auditoría del flujo de embajador (solicitud, documentación,
 * aprobación/rechazo/suspensión). Se registran vía AuditService sobre
 * entityType='ProfessionalProfile' para poder reconstruir, desde el admin,
 * qué pasó con una solicitud aunque nunca haya llegado a completarse.
 */
export const AMBASSADOR_AUDIT_ACTIONS = {
  DOCUMENT_UPLOAD_CONFIRMED: 'AMBASSADOR_DOCUMENT_UPLOAD_CONFIRMED',
  DOCUMENT_UPLOAD_FAILED: 'AMBASSADOR_DOCUMENT_UPLOAD_FAILED',
  REQUEST_SUBMITTED: 'AMBASSADOR_REQUEST_SUBMITTED',
  REQUEST_FAILED: 'AMBASSADOR_REQUEST_FAILED',
  REQUEST_APPROVED: 'AMBASSADOR_REQUEST_APPROVED',
  REQUEST_REJECTED: 'AMBASSADOR_REQUEST_REJECTED',
  REQUEST_SUSPENDED: 'AMBASSADOR_REQUEST_SUSPENDED',
} as const;

export type AmbassadorAuditAction =
  typeof AMBASSADOR_AUDIT_ACTIONS[keyof typeof AMBASSADOR_AUDIT_ACTIONS];

const ACTION_LABELS: Record<string, string> = {
  [AMBASSADOR_AUDIT_ACTIONS.DOCUMENT_UPLOAD_CONFIRMED]: 'Documento subido y confirmado',
  [AMBASSADOR_AUDIT_ACTIONS.DOCUMENT_UPLOAD_FAILED]: 'Intento de subida de documento fallido',
  [AMBASSADOR_AUDIT_ACTIONS.REQUEST_SUBMITTED]: 'Solicitud de embajador enviada',
  [AMBASSADOR_AUDIT_ACTIONS.REQUEST_FAILED]: 'Intento de envío de solicitud fallido',
  [AMBASSADOR_AUDIT_ACTIONS.REQUEST_APPROVED]: 'Solicitud aprobada',
  [AMBASSADOR_AUDIT_ACTIONS.REQUEST_REJECTED]: 'Solicitud rechazada',
  [AMBASSADOR_AUDIT_ACTIONS.REQUEST_SUSPENDED]: 'Embajador suspendido',
};

export function labelForAmbassadorAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export const AMBASSADOR_DOCUMENT_TYPE_LABELS: Record<string, string> = {
  DNI_FRONT: 'Frente del DNI',
  DNI_BACK: 'Dorso del DNI',
  SELFIE: 'Selfie',
  CUIT_CERTIFICATE: 'Constancia de CUIT',
  FOUNDING_DOCUMENT: 'Documento constitutivo',
};
