export type VisibilityFields = {
 owner_hidden?: boolean;
 public_visible?: boolean;
 content_review_status?: string;
 advertising_status?: string;
 prescription_status?: string;
};
// Showing never grants clinical review or advertising approval.
export function eligibleForDisplay(p: VisibilityFields): boolean {
 return p.content_review_status === 'reviewed' && p.advertising_status === 'approved' && ['non_prescription','not_medicine'].includes(p.prescription_status || '');
}
export function derivedVisibility(p: VisibilityFields): boolean { return p.owner_hidden !== true && eligibleForDisplay(p); }
export function visibilityLabel(p: VisibilityFields): string {
 if (p.owner_hidden === true) return 'مخفي يدويًا';
 return p.public_visible === true && eligibleForDisplay(p) ? 'ظاهر للعملاء' : 'مخفي لحين اعتماد المراجعة';
}
export function importVisibility(existing?: VisibilityFields) {
 return {owner_hidden:existing?.owner_hidden === true,public_visible:false,content_review_status:'unreviewed' as const,advertising_status:'unreviewed' as const,prescription_status:'unknown' as const};
}
