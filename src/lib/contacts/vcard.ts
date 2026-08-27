import type { Address, Contact } from "./types";

/**
 * vCard 3.0 serialisation.
 *
 * 3.0 rather than 4.0 because it is what Apple Contacts, Google Contacts, and
 * Outlook all import without complaint — the point of the export is that the
 * file opens on the phone of whoever you hand it to.
 */

/** vCard 3.0 has no `OTHER`, but every importer tolerates it. */
const ADDRESS_TYPES: Record<Address["type"], string> = {
  Home: "HOME",
  Work: "WORK",
  Other: "OTHER",
};

/** Escape the characters that are structural in a vCard value. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/**
 * Fold to 75 octets per RFC 2426, continuing with a leading space.
 *
 * The count is octets, not characters: a name with an accent in it would
 * otherwise fold a byte too late and corrupt the line.
 */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let current = "";
  let octets = 0;

  for (const character of line) {
    const size = encoder.encode(character).length;
    // 75 for the first line; continuations spend one octet on the leading space.
    const limit = chunks.length === 0 ? 75 : 74;

    if (octets + size > limit) {
      chunks.push(current);
      current = "";
      octets = 0;
    }
    current += character;
    octets += size;
  }
  chunks.push(current);

  return chunks.join("\r\n ");
}

/** `data:image/jpeg;base64,…` → the `ENCODING=b` property vCard 3.0 wants. */
function photoProperty(photo: string): string | null {
  const match = /^data:image\/([a-z]+);base64,(.+)$/i.exec(photo);
  if (!match) return null;

  const [, subtype, payload] = match;
  return `PHOTO;ENCODING=b;TYPE=${subtype.toUpperCase()}:${payload}`;
}

function addressProperty(address: Address): string {
  // ADR is: po-box ; extended ; street ; locality ; region ; postal ; country
  const parts = [
    "",
    "",
    address.street ?? "",
    address.city ?? "",
    address.state ?? "",
    address.postal_code ?? "",
    address.country ?? "",
  ].map(escapeText);

  return `ADR;TYPE=${ADDRESS_TYPES[address.type]}:${parts.join(";")}`;
}

/** Serialise one contact as a vCard 3.0 document. */
export function toVCard(contact: Contact): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escapeText(contact.last_name)};${escapeText(contact.first_name)};;;`,
    `FN:${escapeText(contact.full_name)}`,
    `EMAIL;TYPE=INTERNET:${escapeText(contact.email)}`,
  ];

  if (contact.phone) lines.push(`TEL;TYPE=CELL:${escapeText(contact.phone)}`);
  if (contact.company) lines.push(`ORG:${escapeText(contact.company)}`);
  if (contact.job_title) lines.push(`TITLE:${escapeText(contact.job_title)}`);

  // Every address is exported with its own type — the whole point of the
  // collection is that a contact is not limited to one.
  for (const address of contact.addresses) {
    lines.push(addressProperty(address));
  }

  if (contact.photo) {
    const photo = photoProperty(contact.photo);
    if (photo) lines.push(photo);
  }

  if (contact.notes) lines.push(`NOTE:${escapeText(contact.notes)}`);
  lines.push(`REV:${contact.updated_at}`);
  lines.push("END:VCARD");

  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/** `Ada Lovelace` → `ada-lovelace.vcf`, safe on every filesystem. */
export function vCardFilename(contact: Contact): string {
  const slug =
    contact.full_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `contact-${contact.id}`;

  return `${slug}.vcf`;
}
