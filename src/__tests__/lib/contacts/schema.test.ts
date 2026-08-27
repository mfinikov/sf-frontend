import {
  CONTACT_FIELDS,
  MAX_ADDRESSES,
  addressInputName,
  contactInputSchema,
  formDataToValues,
  zodFieldErrors,
} from "@/lib/contacts/schema";
import type { ContactTextField, RawAddress } from "@/lib/contacts/types";

function address(overrides: Partial<RawAddress> = {}): RawAddress {
  return {
    type: "Home",
    street: "",
    city: "London",
    state: "",
    postal_code: "",
    country: "",
    ...overrides,
  };
}

type Overrides = Partial<Record<ContactTextField, string>> & {
  addresses?: RawAddress[];
};

function values(overrides: Overrides = {}) {
  return {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "Ada@Example.com",
    phone: "",
    photo: "",
    company: "",
    job_title: "",
    addresses: [] as RawAddress[],
    notes: "",
    ...overrides,
  };
}

describe("contactInputSchema", () => {
  it("lowercases the email and nulls out the blanks", () => {
    const parsed = contactInputSchema.parse(values());

    expect(parsed.email).toBe("ada@example.com");
    expect(parsed.phone).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it("trims what the user typed", () => {
    expect(contactInputSchema.parse(values({ company: "  Acme  " })).company).toBe(
      "Acme",
    );
  });

  it("requires the three fields the API requires", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: " ", last_name: "", email: "" }),
    );

    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name is required",
      last_name: "Last name is required",
      email: "Email is required",
    });
  });

  it("rejects a malformed email", () => {
    const result = contactInputSchema.safeParse(values({ email: "not-an-email" }));
    expect(zodFieldErrors(result.error!).email).toBe("Enter a valid email address");
  });

  it("enforces the API's length limits", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: "a".repeat(101), company: "c".repeat(201) }),
    );

    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name must be 100 characters or fewer",
      company: "Company must be 200 characters or fewer",
    });
  });
});

describe("addresses", () => {
  it("keeps every address, each with its own type", () => {
    const parsed = contactInputSchema.parse(
      values({
        addresses: [
          address({ type: "Work", street: "1 Market St", city: "San Francisco" }),
          address({ type: "Home", city: "London", country: "UK" }),
        ],
      }),
    );

    expect(parsed.addresses).toHaveLength(2);
    expect(parsed.addresses.map((entry) => entry.type)).toEqual(["Work", "Home"]);
    expect(parsed.addresses[0].street).toBe("1 Market St");
    // Blank parts become null, the same as every other optional field.
    expect(parsed.addresses[1].state).toBeNull();
  });

  it("allows two addresses of the same type", () => {
    const parsed = contactInputSchema.parse(
      values({
        addresses: [
          address({ type: "Work", city: "San Francisco" }),
          address({ type: "Work", city: "Oakland" }),
        ],
      }),
    );

    expect(parsed.addresses.map((entry) => entry.city)).toEqual([
      "San Francisco",
      "Oakland",
    ]);
  });

  it("drops a row the user added and left blank", () => {
    const parsed = contactInputSchema.parse(
      values({ addresses: [address({ city: "London" }), address({ city: "" })] }),
    );

    expect(parsed.addresses).toHaveLength(1);
  });

  it("rejects more addresses than the API accepts", () => {
    const result = contactInputSchema.safeParse(
      values({ addresses: Array.from({ length: MAX_ADDRESSES + 1 }, () => address()) }),
    );

    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!).addresses).toMatch(/at most 20/i);
  });

  it("names the offending row when one address is invalid", () => {
    const result = contactInputSchema.safeParse(
      values({
        addresses: [address(), address({ city: "x".repeat(121) })],
      }),
    );

    expect(zodFieldErrors(result.error!).addresses).toBe(
      "Address 2: City must be 120 characters or fewer",
    );
  });
});

describe("formDataToValues", () => {
  it("zips the repeated address inputs back into rows", () => {
    const formData = new FormData();
    for (const field of CONTACT_FIELDS) {
      if (field.type !== "addresses") formData.set(field.name, "");
    }

    for (const row of [
      { type: "Work", city: "San Francisco" },
      { type: "Home", city: "London" },
    ]) {
      formData.append(addressInputName("type"), row.type);
      formData.append(addressInputName("street"), "");
      formData.append(addressInputName("city"), row.city);
      formData.append(addressInputName("state"), "");
      formData.append(addressInputName("postal_code"), "");
      formData.append(addressInputName("country"), "");
    }

    const parsed = formDataToValues(formData);

    expect(parsed.addresses).toEqual([
      { type: "Work", street: "", city: "San Francisco", state: "", postal_code: "", country: "" },
      { type: "Home", street: "", city: "London", state: "", postal_code: "", country: "" },
    ]);
  });

  it("reports no addresses when none were submitted", () => {
    expect(formDataToValues(new FormData()).addresses).toEqual([]);
  });
});

describe("formDataToValues", () => {
  it("pulls every known field out, defaulting to an empty string", () => {
    const formData = new FormData();
    formData.set("first_name", "Grace");
    formData.set("email", "grace@example.com");
    formData.set("ignored", "nope");

    const extracted = formDataToValues(formData);

    expect(extracted.first_name).toBe("Grace");
    expect(extracted.last_name).toBe("");
    expect(Object.keys(extracted).sort()).toEqual(
      CONTACT_FIELDS.map((field) => field.name).sort(),
    );
  });
});

describe("photo", () => {
  const PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

  it("accepts a base64 image data URL", () => {
    const parsed = contactInputSchema.parse(values({ photo: PNG }));
    expect(parsed.photo).toBe(PNG);
  });

  it("treats an empty picker as no photo", () => {
    expect(contactInputSchema.parse(values()).photo).toBeNull();
  });

  it("rejects anything that is not a data URL", () => {
    const result = contactInputSchema.safeParse(
      values({ photo: "https://example.com/ada.png" }),
    );
    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!).photo).toMatch(/data URL/i);
  });

  it("rejects SVG, which can carry script", () => {
    const result = contactInputSchema.safeParse(
      values({ photo: "data:image/svg+xml;base64,PHN2Zy8+" }),
    );
    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!).photo).toMatch(/not a supported image type/i);
  });

  it("rejects an image over the API's size limit", () => {
    const oversized = `data:image/png;base64,${"A".repeat(2_000_000)}`;
    const result = contactInputSchema.safeParse(values({ photo: oversized }));

    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!).photo).toMatch(/KB or smaller/i);
  });
});
