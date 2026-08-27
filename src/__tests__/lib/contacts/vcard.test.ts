import { toVCard, vCardFilename } from "@/lib/contacts/vcard";
import { makeContact } from "../../mocks/handlers";
import type { Address } from "@/lib/contacts/types";

function address(overrides: Partial<Address> = {}): Address {
  return {
    id: 1,
    type: "Work",
    street: "1 Market St",
    city: "San Francisco",
    state: "CA",
    postal_code: "94105",
    country: "USA",
    ...overrides,
  };
}

/** Unfold the CRLF-space continuations so a property can be asserted whole. */
function properties(vcard: string): string[] {
  return vcard.replace(/\r\n /g, "").trimEnd().split("\r\n");
}

describe("toVCard", () => {
  it("wraps the card and pins the version", () => {
    const lines = properties(toVCard(makeContact()));

    expect(lines[0]).toBe("BEGIN:VCARD");
    expect(lines[1]).toBe("VERSION:3.0");
    expect(lines.at(-1)).toBe("END:VCARD");
  });

  it("uses CRLF line endings, as the format requires", () => {
    expect(toVCard(makeContact())).toContain("\r\n");
    expect(toVCard(makeContact()).replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("writes the structured and formatted names", () => {
    const lines = properties(toVCard(makeContact()));

    expect(lines).toContain("N:Lovelace;Ada;;;");
    expect(lines).toContain("FN:Ada Lovelace");
  });

  it("exports every address with its own type", () => {
    const contact = makeContact({
      addresses: [
        address({ id: 1, type: "Work" }),
        address({ id: 2, type: "Home", street: null, city: "London", state: null, postal_code: null, country: "UK" }),
        address({ id: 3, type: "Other", city: "Berlin" }),
      ],
    });

    const lines = properties(toVCard(contact));

    expect(lines).toContain("ADR;TYPE=WORK:;;1 Market St;San Francisco;CA;94105;USA");
    expect(lines).toContain("ADR;TYPE=HOME:;;;London;;;UK");
    expect(lines.some((line) => line.startsWith("ADR;TYPE=OTHER:"))).toBe(true);
  });

  it("keeps two addresses of the same type", () => {
    const contact = makeContact({
      addresses: [address({ id: 1 }), address({ id: 2, city: "Oakland" })],
    });

    const adr = properties(toVCard(contact)).filter((line) => line.startsWith("ADR;"));
    expect(adr).toHaveLength(2);
  });

  it("omits the address block entirely when there are none", () => {
    const lines = properties(toVCard(makeContact({ addresses: [] })));
    expect(lines.some((line) => line.startsWith("ADR"))).toBe(false);
  });

  it("embeds the photo as base64 with its subtype", () => {
    const contact = makeContact({ photo: "data:image/jpeg;base64,QUJD" });
    expect(properties(toVCard(contact))).toContain("PHOTO;ENCODING=b;TYPE=JPEG:QUJD");
  });

  it("skips a photo it cannot parse rather than emitting a broken property", () => {
    const contact = makeContact({ photo: "https://example.com/ada.png" });
    expect(toVCard(contact)).not.toContain("PHOTO");
  });

  it("escapes the characters that are structural in a value", () => {
    const contact = makeContact({
      company: "Babbage, Lovelace; Ltd",
      notes: "line one\nline two",
    });

    const lines = properties(toVCard(contact));
    expect(lines).toContain("ORG:Babbage\\, Lovelace\\; Ltd");
    expect(lines).toContain("NOTE:line one\\nline two");
  });

  it("folds long lines and they unfold back to the original value", () => {
    const payload = "A".repeat(400);
    const contact = makeContact({ photo: `data:image/png;base64,${payload}` });

    const vcard = toVCard(contact);
    // Every physical line stays inside the 75-octet limit.
    for (const line of vcard.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(properties(vcard)).toContain(`PHOTO;ENCODING=b;TYPE=PNG:${payload}`);
  });

  it("leaves out the optional properties a contact does not have", () => {
    const bare = makeContact({
      phone: null,
      company: null,
      job_title: null,
      notes: null,
      photo: null,
      addresses: [],
    });

    const lines = properties(toVCard(bare));
    expect(lines.some((line) => line.startsWith("TEL"))).toBe(false);
    expect(lines.some((line) => line.startsWith("ORG"))).toBe(false);
    expect(lines.some((line) => line.startsWith("TITLE"))).toBe(false);
    expect(lines.some((line) => line.startsWith("NOTE"))).toBe(false);
  });
});

describe("vCardFilename", () => {
  it("slugs the contact's name", () => {
    expect(vCardFilename(makeContact())).toBe("ada-lovelace.vcf");
  });

  it("falls back to the id when the name has nothing sluggable", () => {
    const contact = makeContact({ first_name: "！", last_name: "？", id: 7 });
    expect(vCardFilename(contact)).toBe("contact-7.vcf");
  });
});
