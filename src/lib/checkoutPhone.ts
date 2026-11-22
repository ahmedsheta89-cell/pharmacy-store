// Convert Arabic-Indic digits before applying the existing checkout format rules.
// Keep letters and unexpected punctuation so invalid input cannot become a valid number.
export function normalizeCheckoutPhone(value: string): string {
  return value.replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660)).replace(/[\s-]/g, "");
}
