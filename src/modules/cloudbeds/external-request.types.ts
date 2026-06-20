/**
 * Contexto opcional para auditar quién disparó una request externa.
 * Se propaga desde el controller → service → provider.
 */
export interface ExternalRequestLogContext {
  userId?: string;
  /** UUID local de Property (no el widget_property de Cloudbeds). */
  propertyId?: string;
  ipAddress?: string;
  userAgent?: string;
}
