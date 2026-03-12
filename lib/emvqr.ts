/**
 * EMVCo QR Code Builder for Ethiopian Merchant Payments
 * 
 * Generates EMVCo-compliant Merchant Presented QR Code payloads
 * compatible with Telebirr, CBE Mobile, and other EthSwitch participants.
 * 
 * Based on: EMVCo QR Code Specification for Payment Systems - Merchant Presented Mode
 * Adapted for: NBE / EthSwitch Interoperable QR Standard (Ethiopia)
 */

// ─── CRC-16/CCITT-FALSE Checksum ───────────────────────────────────
function crc16ccitt(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// ─── TLV Encoder ───────────────────────────────────────────────────
function tlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${tag}${len}${value}`;
}

// ─── Build Merchant Account Information (Tag 26-51) ────────────────
function buildMAI(
  tag: string, // "26" for Telebirr, "27" for CBE, etc.
  schemeId: string, // e.g. "ET.NBE.TELEBIRR" 
  accountNumber: string,
  merchantId?: string
): string {
  let mai = tlv("00", schemeId);
  mai += tlv("01", accountNumber);
  if (merchantId) {
    mai += tlv("02", merchantId);
  }
  return tlv(tag, mai);
}

// ─── Bank-to-Tag Mapping ───────────────────────────────────────────
export const BANK_EMV_CONFIG: Record<string, { tag: string; schemeId: string; label: string }> = {
  telebirr: { tag: "26", schemeId: "ET.NBE.TELEBIRR", label: "Telebirr" },
  cbe:      { tag: "27", schemeId: "ET.NBE.CBE",      label: "CBE" },
  cbebirr:  { tag: "28", schemeId: "ET.NBE.CBEBIRR",  label: "CBE Birr" },
  abyssinia:{ tag: "29", schemeId: "ET.NBE.BOA",       label: "Abyssinia" },
  dashen:   { tag: "30", schemeId: "ET.NBE.DASHEN",    label: "Dashen" },
};

// ─── Main Builder ──────────────────────────────────────────────────
export interface MerchantQROptions {
  bankKey: string;           // e.g. "telebirr", "cbe"
  accountNumber: string;     // The merchant's account/phone number
  merchantName: string;      // Restaurant name
  merchantCity?: string;     // Default: "Addis Ababa"
  amount?: number;           // Transaction amount (optional for static QR)
  merchantId?: string;       // Optional merchant registration ID
}

export function buildMerchantQR(opts: MerchantQROptions): string {
  const bankConfig = BANK_EMV_CONFIG[opts.bankKey];
  if (!bankConfig) {
    // Fallback: simple account-based QR
    return `${opts.accountNumber}`;
  }

  let payload = '';

  // Tag 00: Payload Format Indicator (Always "01")
  payload += tlv("00", "01");

  // Tag 01: Point of Initiation Method
  // "11" = Static (reusable), "12" = Dynamic (one-time with amount)
  payload += tlv("01", opts.amount ? "12" : "11");

  // Tag 26-51: Merchant Account Information
  payload += buildMAI(
    bankConfig.tag,
    bankConfig.schemeId, 
    opts.accountNumber,
    opts.merchantId
  );

  // Tag 52: Merchant Category Code (5812 = Eating Places / Restaurants)
  payload += tlv("52", "5812");

  // Tag 53: Transaction Currency (230 = ETB)
  payload += tlv("53", "230");

  // Tag 54: Transaction Amount (only for dynamic QR)
  if (opts.amount) {
    payload += tlv("54", opts.amount.toFixed(2));
  }

  // Tag 58: Country Code
  payload += tlv("58", "ET");

  // Tag 59: Merchant Name
  payload += tlv("59", opts.merchantName.slice(0, 25));

  // Tag 60: Merchant City
  payload += tlv("60", (opts.merchantCity || "Addis Ababa").slice(0, 15));

  // Tag 63: CRC — Must be calculated last
  // Append tag "63" and length "04" first, then compute CRC over the full string
  payload += "6304";
  const checksum = crc16ccitt(payload);
  payload += checksum;

  return payload;
}
