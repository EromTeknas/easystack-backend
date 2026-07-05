export class InvoiceNumberGenerator {
  static generate(prefix = "INV"): string {
    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${prefix}-${timestamp}-${randomPart}`;
  }
}