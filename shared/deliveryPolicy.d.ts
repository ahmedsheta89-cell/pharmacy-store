export type DeliveryZone={id:string;name:string;fee_cents:number;eta_min:number;eta_max:number;free_from_cents:number|null};
export type DeliveryPolicy={version:string;enabled:boolean;zones:DeliveryZone[]};
export const EMPTY_DELIVERY_POLICY:DeliveryPolicy;
export function validateDeliveryPolicy(input:unknown):Omit<DeliveryPolicy,'version'>;
export function deliveryQuote(policy:DeliveryPolicy,zoneId:string,subtotalCents:number):{fee_cents:number|null;total_cents:number;zone:DeliveryZone|null};
