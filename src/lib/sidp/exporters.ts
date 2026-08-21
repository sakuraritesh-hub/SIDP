import * as XLSX from "xlsx";
import type { SidpDocument } from "./schema";

export type ExportFormatId = "json" | "xml" | "csv" | "xlsx" | "tally-xml" | "erp-xml" | "rest-json";

export interface ExportFormatDef {
  id: ExportFormatId;
  label: string;
  description: string;
}

export const EXPORT_FORMATS: ExportFormatDef[] = [
  { id: "json", label: "Universal JSON", description: "Master schema, all fields" },
  { id: "xml", label: "Generic XML", description: "Flat element-per-field XML" },
  { id: "csv", label: "CSV (line items)", description: "One row per item, header columns repeated" },
  { id: "xlsx", label: "XLSX workbook", description: "Header, Items and Totals sheets" },
  { id: "tally-xml", label: "Tally XML", description: "Tally Prime purchase voucher import" },
  { id: "erp-xml", label: "Generic ERP XML", description: "Mapped via field-mapping template" },
  { id: "rest-json", label: "REST API payload", description: "POST body for downstream systems" },
];

function esc(val: unknown): string {
  if (val == null) return "";
  return String(val).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function csvCell(val: unknown): string {
  if (val == null) return "";
  const s = String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function timestamp() {
  return new Date().toISOString().slice(0, 10);
}

export interface ExportResult {
  blob: Blob;
  filename: string;
}

// -- Universal JSON — the full schema, all fields, nothing dropped --
function buildUniversalJson(docs: SidpDocument[]): ExportResult {
  const payload = {
    exported_at: new Date().toISOString(),
    document_count: docs.length,
    documents: docs.map((d) => ({
      id: d.id,
      file_name: d.file_name,
      status: d.status,
      overall_confidence: d.overall_confidence,
      doc_type: d.doc_type,
      extracted: d.extracted,
      validation: d.validation,
      rate_changes: d.rate_changes,
    })),
  };
  return {
    blob: new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    filename: `SIDP-universal-${timestamp()}.json`,
  };
}

// -- Generic XML — one element per field, flat and literal --
function buildGenericXml(docs: SidpDocument[]): ExportResult {
  const docsXml = docs
    .map((d) => {
      const h = d.extracted?.header;
      const itemsXml = (d.extracted?.items || [])
        .map(
          (item) => `      <Item>
        <ItemName>${esc(item.item_name)}</ItemName>
        <ItemCode>${esc(item.item_code)}</ItemCode>
        <HsnSac>${esc(item.hsn_sac)}</HsnSac>
        <Uom>${esc(item.uom)}</Uom>
        <Quantity>${esc(item.quantity)}</Quantity>
        <Rate>${esc(item.rate)}</Rate>
        <TaxableAmount>${esc(item.taxable_amount)}</TaxableAmount>
        <LineTotal>${esc(item.line_total)}</LineTotal>
      </Item>`,
        )
        .join("\n");
      return `  <Document>
    <Id>${esc(d.id)}</Id>
    <FileName>${esc(d.file_name)}</FileName>
    <DocType>${esc(d.doc_type)}</DocType>
    <Status>${esc(d.status)}</Status>
    <SupplierName>${esc(h?.supplier_name)}</SupplierName>
    <SupplierGstin>${esc(h?.supplier_gstin)}</SupplierGstin>
    <InvoiceNumber>${esc(h?.invoice_number)}</InvoiceNumber>
    <InvoiceDate>${esc(h?.invoice_date)}</InvoiceDate>
    <PoNumber>${esc(h?.po_number)}</PoNumber>
    <GrandTotal>${esc(d.extracted?.totals.grand_total)}</GrandTotal>
    <Items>
${itemsXml}
    </Items>
  </Document>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<Documents>\n${docsXml}\n</Documents>`;
  return { blob: new Blob([xml], { type: "application/xml" }), filename: `SIDP-generic-${timestamp()}.xml` };
}

// -- CSV — one row per line item, header columns repeated on every row --
function buildCsv(docs: SidpDocument[]): ExportResult {
  const headers = [
    "Invoice No.",
    "Invoice Date",
    "Supplier",
    "GSTIN",
    "PO No.",
    "Item",
    "HSN/SAC",
    "UOM",
    "Qty",
    "Rate",
    "Taxable",
    "CGST",
    "SGST",
    "IGST",
    "Line Total",
    "Grand Total",
  ];
  const rows: string[] = [headers.join(",")];

  docs.forEach((d) => {
    const h = d.extracted?.header;
    const items = d.extracted?.items || [];
    const base = [h?.invoice_number, h?.invoice_date, h?.supplier_name, h?.supplier_gstin, h?.po_number];
    if (items.length === 0) {
      rows.push([...base, "", "", "", "", "", "", "", "", "", d.extracted?.totals.grand_total].map(csvCell).join(","));
      return;
    }
    items.forEach((item) => {
      rows.push(
        [
          ...base,
          item.item_name,
          item.hsn_sac,
          item.uom,
          item.quantity,
          item.rate,
          item.taxable_amount,
          item.cgst_amount,
          item.sgst_amount,
          item.igst_amount,
          item.line_total,
          d.extracted?.totals.grand_total,
        ]
          .map(csvCell)
          .join(","),
      );
    });
  });

  return { blob: new Blob([rows.join("\n")], { type: "text/csv" }), filename: `SIDP-lineitems-${timestamp()}.csv` };
}

// -- XLSX workbook — Header, Items, and Totals sheets --
function buildXlsx(docs: SidpDocument[]): ExportResult {
  const headerRows = docs.map((d) => ({
    "Invoice No.": d.invoice_number,
    "Invoice Date": d.invoice_date,
    Supplier: d.supplier_name,
    GSTIN: d.supplier_gstin,
    "PO No.": d.po_number,
    "Grand Total": d.grand_total,
    Confidence: d.overall_confidence,
    Status: d.status,
  }));

  const itemRows = docs.flatMap((d) =>
    (d.extracted?.items || []).map((item) => ({
      "Invoice No.": d.invoice_number,
      Supplier: d.supplier_name,
      Item: item.item_name,
      "HSN/SAC": item.hsn_sac,
      UOM: item.uom,
      Qty: item.quantity,
      Rate: item.rate,
      Taxable: item.taxable_amount,
      "Line Total": item.line_total,
    })),
  );

  const totalsRows = docs
    .filter((d) => d.extracted?.totals)
    .map((d) => ({
      "Invoice No.": d.invoice_number,
      Supplier: d.supplier_name,
      "Total Taxable": d.extracted!.totals.total_taxable,
      CGST: d.extracted!.totals.cgst,
      SGST: d.extracted!.totals.sgst,
      IGST: d.extracted!.totals.igst,
      Cess: d.extracted!.totals.cess,
      Freight: d.extracted!.totals.freight,
      Insurance: d.extracted!.totals.insurance,
      Discount: d.extracted!.totals.discount,
      "Round Off": d.extracted!.totals.round_off,
      "Grand Total": d.extracted!.totals.grand_total,
    }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(headerRows), "Header");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemRows), "Items");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(totalsRows), "Totals");

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return {
    blob: new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename: `SIDP-export-${timestamp()}.xlsx`,
  };
}

// -- Tally XML — Tally Prime "Import Data" voucher format for purchase vouchers.
// This is a best-effort starting template based on Tally's commonly-documented
// XML voucher import schema. Ledger names, the purchase-ledger name, and the
// credit/debit polarity below are reasonable defaults but WILL need
// adjustment to match your actual Tally ledger names and configuration
// before a real import — verify against a test company before using on
// live books.
function buildTallyXml(docs: SidpDocument[], companyName: string): ExportResult {
  const tallyDate = (iso: string | null) => (iso ? iso.replace(/-/g, "") : "");

  const vouchers = docs
    .map((d) => {
      const h = d.extracted?.header;
      const t = d.extracted?.totals;
      if (!h || !t) return "";

      const ledgerEntries: string[] = [];

      // Party ledger — credited for the full invoice value (standard purchase entry).
      ledgerEntries.push(`        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${esc(h.supplier_name)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
          <AMOUNT>-${esc(t.grand_total)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`);

      // Purchase ledger — debited for the taxable value.
      if (t.total_taxable != null) {
        ledgerEntries.push(`        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>Purchase Account</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${esc(t.total_taxable)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`);
      }

      // Tax ledgers — debited for each tax component present.
      [
        ["CGST", t.cgst],
        ["SGST", t.sgst],
        ["IGST", t.igst],
      ].forEach(([name, amount]) => {
        if (amount != null && Number(amount) !== 0) {
          ledgerEntries.push(`        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${name}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
          <AMOUNT>${esc(amount)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`);
        }
      });

      return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="Purchase" ACTION="Create">
          <DATE>${tallyDate(h.invoice_date)}</DATE>
          <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${esc(h.invoice_number)}</VOUCHERNUMBER>
          <PARTYLEDGERNAME>${esc(h.supplier_name)}</PARTYLEDGERNAME>
          <NARRATION>Imported from SIDP — ${esc(d.file_name)}</NARRATION>
${ledgerEntries.join("\n")}
        </VOUCHER>
      </TALLYMESSAGE>`;
    })
    .filter(Boolean)
    .join("\n");

  const xml = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${esc(companyName)}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${vouchers}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  return { blob: new Blob([xml], { type: "application/xml" }), filename: `SIDP-tally-${timestamp()}.xml` };
}

// -- Generic ERP XML — a fixed default field mapping (PascalCase, ERP-ish
// tag names). NOTE: there's no field-mapping editor built yet — this is
// one fixed shape, not actually configurable per-ERP the way the label
// implies. Treat it as a starting template to adapt per target system.
function buildErpXml(docs: SidpDocument[]): ExportResult {
  const docsXml = docs
    .map((d) => {
      const h = d.extracted?.header;
      const t = d.extracted?.totals;
      const linesXml = (d.extracted?.items || [])
        .map(
          (item) => `        <Line>
          <PartNumber>${esc(item.item_code)}</PartNumber>
          <Description>${esc(item.item_name)}</Description>
          <TaxCode>${esc(item.hsn_sac)}</TaxCode>
          <UnitOfMeasure>${esc(item.uom)}</UnitOfMeasure>
          <Quantity>${esc(item.quantity)}</Quantity>
          <UnitPrice>${esc(item.rate)}</UnitPrice>
          <ExtendedPrice>${esc(item.line_total)}</ExtendedPrice>
        </Line>`,
        )
        .join("\n");
      return `    <PurchaseDocument>
      <DocumentNumber>${esc(h?.invoice_number)}</DocumentNumber>
      <DocumentDate>${esc(h?.invoice_date)}</DocumentDate>
      <VendorName>${esc(h?.supplier_name)}</VendorName>
      <VendorTaxId>${esc(h?.supplier_gstin)}</VendorTaxId>
      <PurchaseOrderRef>${esc(h?.po_number)}</PurchaseOrderRef>
      <LineItems>
${linesXml}
      </LineItems>
      <DocumentTotal>${esc(t?.grand_total)}</DocumentTotal>
    </PurchaseDocument>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<ERPImport>\n  <PurchaseDocuments>\n${docsXml}\n  </PurchaseDocuments>\n</ERPImport>`;
  return { blob: new Blob([xml], { type: "application/xml" }), filename: `SIDP-erp-${timestamp()}.xml` };
}

// -- REST API payload — a JSON body shaped for a webhook/downstream POST.
// NOTE: this only produces the payload for download/inspection — there's
// no target URL configured anywhere, so nothing is actually sent over the
// network. Wire it into a real endpoint (fetch/POST) once you have one.
function buildRestPayload(docs: SidpDocument[]): ExportResult {
  const payload = {
    event: "documents.exported",
    exported_at: new Date().toISOString(),
    documents: docs.map((d) => ({
      external_id: d.id,
      status: d.status,
      supplier: d.extracted?.header.supplier_name ?? null,
      invoice_number: d.extracted?.header.invoice_number ?? null,
      invoice_date: d.extracted?.header.invoice_date ?? null,
      currency: d.extracted?.currency ?? "INR",
      total: d.extracted?.totals.grand_total ?? null,
      line_items: (d.extracted?.items || []).map((i) => ({
        sku: i.item_code,
        description: i.item_name,
        quantity: i.quantity,
        unit_price: i.rate,
        amount: i.line_total,
      })),
    })),
  };
  return {
    blob: new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    filename: `SIDP-rest-payload-${timestamp()}.json`,
  };
}

export function buildExport(formatId: ExportFormatId, docs: SidpDocument[], options: { tallyCompanyName?: string }): ExportResult {
  switch (formatId) {
    case "json":
      return buildUniversalJson(docs);
    case "xml":
      return buildGenericXml(docs);
    case "csv":
      return buildCsv(docs);
    case "xlsx":
      return buildXlsx(docs);
    case "tally-xml":
      return buildTallyXml(docs, options.tallyCompanyName || "Company");
    case "erp-xml":
      return buildErpXml(docs);
    case "rest-json":
      return buildRestPayload(docs);
  }
}

export function downloadExport(result: ExportResult) {
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
