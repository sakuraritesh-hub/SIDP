// Universal document schema — mirrors the Apps Script backend's shape exactly.
// This is the contract between the AI extraction engine and every UI surface.

export const DOC_TYPES = [
  "purchase_invoice",
  "sales_invoice",
  "delivery_challan",
  "purchase_order",
  "proforma_invoice",
  "debit_note",
  "credit_note",
  "packing_list",
  "transport_lr",
  "eway_bill",
  "payment_receipt",
  "quotation",
  "other",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  purchase_invoice: "Purchase Invoice",
  sales_invoice: "Sales Invoice",
  delivery_challan: "Delivery Challan",
  purchase_order: "Purchase Order",
  proforma_invoice: "Proforma Invoice",
  debit_note: "Debit Note",
  credit_note: "Credit Note",
  packing_list: "Packing List",
  transport_lr: "Transport LR",
  eway_bill: "E-Way Bill",
  payment_receipt: "Payment Receipt",
  quotation: "Quotation",
  other: "Other",
};

export const DOC_STATUSES = [
  "uploaded",
  "processing",
  "review",
  "approved",
  "exported",
  "failed",
] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export interface DocumentHeader {
  supplier_name: string | null;
  supplier_address: string | null;
  supplier_gstin: string | null;
  supplier_pan: string | null;
  buyer_name: string | null;
  buyer_gstin: string | null;
  buyer_address: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  po_number: string | null;
  po_date: string | null;
  challan_number: string | null;
  vehicle_number: string | null;
  transporter_name: string | null;
  lr_number: string | null;
  eway_bill_number: string | null;
  payment_terms: string | null;
  bank_details: string | null;
  remarks: string | null;
  currency: string | null;
}

export interface LineItem {
  line_number: number | null;
  item_code: string | null;
  item_name: string | null;
  item_description: string | null;
  hsn_sac: string | null;
  batch_number: string | null;
  serial_number: string | null;
  brand: string | null;
  make: string | null;
  model: string | null;
  uom: string | null;
  quantity: number | null;
  free_quantity: number | null;
  rate: number | null;
  discount: number | null;
  taxable_amount: number | null;
  cgst_percent: number | null;
  cgst_amount: number | null;
  sgst_percent: number | null;
  sgst_amount: number | null;
  igst_percent: number | null;
  igst_amount: number | null;
  cess: number | null;
  line_total: number | null;
}

export interface DocumentTotals {
  total_taxable: number | null;
  cgst: number | null;
  sgst: number | null;
  igst: number | null;
  cess: number | null;
  freight: number | null;
  insurance: number | null;
  discount: number | null;
  round_off: number | null;
  grand_total: number | null;
}

export interface DetectedHeader {
  source: string;
  mapped_to: string;
  confidence: number;
}

export interface Correction {
  field: string;
  from: string;
  to: string;
  reason: string;
}

export interface UniversalDocument {
  doc_type: DocType;
  doc_type_confidence: number; // 0-100
  header: DocumentHeader;
  items: LineItem[];
  totals: DocumentTotals;
  detected_headers: DetectedHeader[];
  corrections: Correction[];
  notes: string[];
  currency: string;
}

export const EMPTY_HEADER: DocumentHeader = {
  supplier_name: null,
  supplier_address: null,
  supplier_gstin: null,
  supplier_pan: null,
  buyer_name: null,
  buyer_gstin: null,
  buyer_address: null,
  invoice_number: null,
  invoice_date: null,
  po_number: null,
  po_date: null,
  challan_number: null,
  vehicle_number: null,
  transporter_name: null,
  lr_number: null,
  eway_bill_number: null,
  payment_terms: null,
  bank_details: null,
  remarks: null,
  currency: null,
};

export const EMPTY_TOTALS: DocumentTotals = {
  total_taxable: null,
  cgst: null,
  sgst: null,
  igst: null,
  cess: null,
  freight: null,
  insurance: null,
  discount: null,
  round_off: null,
  grand_total: null,
};

export const EMPTY_ITEM: LineItem = {
  line_number: null,
  item_code: null,
  item_name: null,
  item_description: null,
  hsn_sac: null,
  batch_number: null,
  serial_number: null,
  brand: null,
  make: null,
  model: null,
  uom: null,
  quantity: null,
  free_quantity: null,
  rate: null,
  discount: null,
  taxable_amount: null,
  cgst_percent: null,
  cgst_amount: null,
  sgst_percent: null,
  sgst_amount: null,
  igst_percent: null,
  igst_amount: null,
  cess: null,
  line_total: null,
};

export const HEADER_LABELS: Record<keyof DocumentHeader, string> = {
  supplier_name: "Supplier",
  supplier_address: "Supplier Address",
  supplier_gstin: "Supplier GSTIN",
  supplier_pan: "Supplier PAN",
  buyer_name: "Buyer",
  buyer_gstin: "Buyer GSTIN",
  buyer_address: "Buyer Address",
  invoice_number: "Invoice No.",
  invoice_date: "Invoice Date",
  po_number: "PO No.",
  po_date: "PO Date",
  challan_number: "Challan No.",
  vehicle_number: "Vehicle No.",
  transporter_name: "Transporter",
  lr_number: "LR No.",
  eway_bill_number: "E-Way Bill No.",
  payment_terms: "Payment Terms",
  bank_details: "Bank Details",
  remarks: "Remarks",
  currency: "Currency",
};

export const TOTALS_LABELS: Record<keyof DocumentTotals, string> = {
  total_taxable: "Total Taxable",
  cgst: "CGST",
  sgst: "SGST",
  igst: "IGST",
  cess: "Cess",
  freight: "Freight",
  insurance: "Insurance",
  discount: "Discount",
  round_off: "Round Off",
  grand_total: "Grand Total",
};

export interface ItemColumn {
  key: keyof LineItem;
  label: string;
  numeric: boolean;
  width: number; // px, grid basis
}

export const ITEM_COLUMNS: ItemColumn[] = [
  { key: "line_number", label: "#", numeric: true, width: 40 },
  { key: "item_code", label: "Code", numeric: false, width: 90 },
  { key: "item_name", label: "Item", numeric: false, width: 220 },
  { key: "hsn_sac", label: "HSN/SAC", numeric: false, width: 90 },
  { key: "uom", label: "UOM", numeric: false, width: 70 },
  { key: "quantity", label: "Qty", numeric: true, width: 80 },
  { key: "rate", label: "Rate", numeric: true, width: 100 },
  { key: "discount", label: "Disc.", numeric: true, width: 90 },
  { key: "taxable_amount", label: "Taxable", numeric: true, width: 110 },
  { key: "cgst_amount", label: "CGST", numeric: true, width: 90 },
  { key: "sgst_amount", label: "SGST", numeric: true, width: 90 },
  { key: "igst_amount", label: "IGST", numeric: true, width: 90 },
  { key: "line_total", label: "Total", numeric: true, width: 120 },
];

export const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z1-9][A-Z\d]$/;
export const PAN_REGEX = /^[A-Z]{5}\d{4}[A-Z]$/;

// Standard field <- vendor header text variants.
// Backend injects/extends this per-vendor via learned `header_mappings`.
export const SYNONYMS: Record<string, string[]> = {
  quantity: ["qty", "nos", "pcs", "uqc", "units", "quantity"],
  item_name: ["material", "product", "particulars", "goods", "description", "item"],
  item_code: ["part no", "part no.", "sku", "article no", "article no.", "item code"],
  rate: ["rate", "price", "unit price", "mrp", "basic rate"],
  line_total: ["amount", "value", "net value", "gross value", "total"],
  discount: ["disc", "rebate", "scheme", "less"],
  hsn_sac: ["hsn", "sac", "hsn code", "hsn/sac"],
};

// -- Validation / confidence types shared with the review UI --

export type IssueSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  severity: IssueSeverity;
  field: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  score: number; // 0-100
}

export type FieldConfidenceMap = Record<string, number>; // field path -> 0-100

export interface RateChange {
  item_key: string;
  item_name: string;
  uom: string | null;
  previous_rate: number | null; // null = first purchase, nothing to compare against
  new_rate: number;
  change_percent: number | null; // null = first purchase
  previous_invoice_number: string | null;
}

// Matches CONFIG.RATE_CHANGE_ALERT_THRESHOLD_PERCENT in the backend — a
// change at or past this magnitude also triggers an email alert there.
export const RATE_ALERT_THRESHOLD_PERCENT = 10;

export interface EditHistoryEntry {
  field: string;
  from: unknown;
  to: unknown;
  edited_at: string;
  edited_by: string;
}

export interface SidpDocument {
  id: string;
  user_id: string;
  file_name: string;
  mime_type: string;
  drive_file_id: string;
  status: DocStatus;
  error_message: string | null;
  vendor_id: string | null;
  extracted: UniversalDocument | null;
  field_confidence: FieldConfidenceMap;
  validation: ValidationResult | null;
  rate_changes: RateChange[];
  edit_history: EditHistoryEntry[];
  overall_confidence: number | null;
  created_at: string;
  updated_at: string;
  // denormalized search columns
  doc_type: DocType | null;
  doc_type_confidence: number | null;
  invoice_number: string | null;
  invoice_date: string | null;
  supplier_name: string | null;
  supplier_gstin: string | null;
  po_number: string | null;
  challan_number: string | null;
  vehicle_number: string | null;
  grand_total: number | null;
  deleted_at: string | null;
}

export interface Vendor {
  id: string;
  user_id: string;
  supplier_name: string;
  supplier_gstin: string | null;
  supplier_address: string | null;
  header_mappings: Record<string, string>;
  common_items: string[];
  ocr_corrections: Record<string, string>;
  document_count: number;
  avg_confidence: number;
}

export function confidenceTier(score: number | null | undefined): "good" | "warn" | "bad" {
  if (score == null) return "bad";
  if (score >= 95) return "good";
  if (score >= 80) return "warn";
  return "bad";
}
