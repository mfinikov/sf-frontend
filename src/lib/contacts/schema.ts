import { z } from "zod";
import { PHOTO_ACCEPT, photoProblem } from "./photo";
import { ADDRESS_TYPES } from "./types";
import type {
  Address,
  AddressInput,
  ContactInput,
  ContactTextField,
  RawAddress,
  RawContactValues,
} from "./types";

/** The API's ceiling on how many addresses one contact may hold. */
export const MAX_ADDRESSES = 20;

/** The parts of an address, and the suffix of each input's form name. */
export const ADDRESS_PARTS = [
  "type",
  "street",
  "city",
  "state",
  "postal_code",
  "country",
] as const satisfies readonly (keyof AddressInput)[];

/** `address_city`, `address_postal_code`, … — repeated once per row. */
export function addressInputName(part: keyof AddressInput): string {
  return `address_${part}`;
}

/** An address the user started but left completely blank is not an address. */
function hasAnyPart(address: RawAddress): boolean {
  return ADDRESS_PARTS.filter((part) => part !== "type").some((part) =>
    address[part]?.trim(),
  );
}

/** Turn stored addresses back into the strings the form controls expect. */
export function toRawAddresses(addresses: readonly Address[]): RawAddress[] {
  return addresses.map((address) => ({
    type: address.type,
    street: address.street ?? "",
    city: address.city ?? "",
    state: address.state ?? "",
    postal_code: address.postal_code ?? "",
    country: address.country ?? "",
  }));
}

/**
 * Client/server-shared validation for the contact form.
 *
 * The rules mirror the API's Pydantic models (`ContactCreate` / `ContactReplace`)
 * so the user sees a mistake before a round trip — the API stays the authority,
 * and anything it rejects anyway is surfaced by `toFieldErrors` in `./api.ts`.
 */

/** Optional text: trimmed, and blank becomes `null` (the API clears the field). */
function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .transform((value) => value || null)
    .nullable()
    .default(null);
}

function requiredText(max: number, label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);
}

/** A data URL from the photo picker, re-checked against the API's own limits. */
const photo = z
  .string()
  .trim()
  .transform((value) => value || null)
  .nullable()
  .default(null)
  .superRefine((value, ctx) => {
    if (value === null) return;
    const problem = photoProblem(value);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });

export const addressInputSchema = z.object({
  type: z.enum(ADDRESS_TYPES),
  street: optionalText(300, "Street address"),
  city: optionalText(120, "City"),
  state: optionalText(120, "State"),
  postal_code: optionalText(20, "Postal code"),
  country: optionalText(120, "Country"),
}) satisfies z.ZodType<AddressInput, unknown>;

/**
 * Blank rows are dropped rather than reported: adding a row and changing your
 * mind is not a mistake, and the API rejects an address with nothing in it.
 */
const addresses = z.preprocess(
  (value) => (Array.isArray(value) ? value.filter(hasAnyPart) : value),
  z
    .array(addressInputSchema)
    .max(MAX_ADDRESSES, `A contact can have at most ${MAX_ADDRESSES} addresses`),
);

export const contactInputSchema = z.object({
  first_name: requiredText(100, "First name"),
  last_name: requiredText(100, "Last name"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(320, "Email must be 320 characters or fewer")
    .pipe(z.email("Enter a valid email address"))
    .transform((value) => value.toLowerCase()),
  phone: optionalText(40, "Phone"),
  photo,
  company: optionalText(200, "Company"),
  job_title: optionalText(200, "Job title"),
  addresses,
  notes: z
    .string()
    .trim()
    .transform((value) => value || null)
    .nullable()
    .default(null),
}) satisfies z.ZodType<ContactInput, unknown>;

export type ContactFormValues = z.input<typeof contactInputSchema>;

/** Collapse a ZodError into one message per field, keyed by input name. */
export function zodFieldErrors(
  error: z.ZodError,
): Partial<Record<keyof ContactInput, string>> {
  const fieldErrors: Partial<Record<keyof ContactInput, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key !== "string" || key in fieldErrors) continue;

    // Address issues arrive as ["addresses", 2, "city"] — say which row it is,
    // since they all collapse onto the one message slot.
    const row = typeof issue.path[1] === "number" ? `Address ${issue.path[1] + 1}: ` : "";
    fieldErrors[key as keyof ContactInput] = `${row}${issue.message}`;
  }
  return fieldErrors;
}

/* ------------------------------------------------------------------ */
/* Form metadata — one source of truth for the fields and their limits */
/* ------------------------------------------------------------------ */

/** A field that submits one value under its own name. */
export interface ContactTextFieldSpec {
  name: ContactTextField;
  label: string;
  type?: "text" | "email" | "tel" | "textarea" | "photo";
  required?: boolean;
  /** Cap for text controls. Omitted for controls that are not free text. */
  maxLength?: number;
  placeholder?: string;
  autoComplete?: string;
  /** `accept` list for the photo control. */
  accept?: string;
  /** Column span inside the section grid. */
  wide?: boolean;
}

/** The repeatable address list, which submits many inputs rather than one. */
export interface ContactAddressesFieldSpec {
  name: "addresses";
  label: string;
  type: "addresses";
  wide?: boolean;
}

export type ContactFieldSpec = ContactTextFieldSpec | ContactAddressesFieldSpec;

export interface ContactFieldGroup {
  title: string;
  description: string;
  fields: ContactFieldSpec[];
}

export const CONTACT_FIELD_GROUPS: ContactFieldGroup[] = [
  {
    title: "Photo",
    description: "Shown as a circular avatar. Square images crop best.",
    fields: [
      {
        name: "photo",
        label: "Profile photo",
        type: "photo",
        accept: PHOTO_ACCEPT,
        wide: true,
      },
    ],
  },
  {
    title: "Identity",
    description: "First name, last name, and email are required.",
    fields: [
      {
        name: "first_name",
        label: "First name",
        required: true,
        maxLength: 100,
        placeholder: "Ada",
        autoComplete: "given-name",
      },
      {
        name: "last_name",
        label: "Last name",
        required: true,
        maxLength: 100,
        placeholder: "Lovelace",
        autoComplete: "family-name",
      },
      {
        name: "email",
        label: "Email",
        type: "email",
        required: true,
        maxLength: 320,
        placeholder: "ada@example.com",
        autoComplete: "email",
      },
      {
        name: "phone",
        label: "Phone",
        type: "tel",
        maxLength: 40,
        placeholder: "+1-415-555-0101",
        autoComplete: "tel",
      },
    ],
  },
  {
    title: "Work",
    description: "Where they work and what they do.",
    fields: [
      {
        name: "company",
        label: "Company",
        maxLength: 200,
        placeholder: "Analytical Engines",
        autoComplete: "organization",
      },
      {
        name: "job_title",
        label: "Job title",
        maxLength: 200,
        placeholder: "Mathematician",
        autoComplete: "organization-title",
      },
    ],
  },
  {
    title: "Addresses",
    description: "Home, work, or anywhere else — add as many as you need.",
    fields: [
      {
        name: "addresses",
        label: "Addresses",
        type: "addresses",
        wide: true,
      },
    ],
  },
  {
    title: "Notes",
    description: "Anything worth remembering. No length limit.",
    fields: [
      {
        name: "notes",
        label: "Notes",
        type: "textarea",
        maxLength: 10_000,
        placeholder: "Met at the SF hackathon.",
        wide: true,
      },
    ],
  },
];

export const CONTACT_FIELDS: ContactFieldSpec[] = CONTACT_FIELD_GROUPS.flatMap(
  (group) => group.fields,
);

/** The fields that submit as a single value, i.e. everything but the addresses. */
export const CONTACT_TEXT_FIELDS: ContactTextFieldSpec[] = CONTACT_FIELDS.filter(
  (field): field is ContactTextFieldSpec => field.type !== "addresses",
);

/**
 * Read the submitted addresses back out of the form.
 *
 * Each part is one repeated input, so the rows are the columns zipped together
 * by index — plain form encoding, no JSON smuggled through a hidden field.
 */
function formDataToAddresses(formData: FormData): RawAddress[] {
  const columns = ADDRESS_PARTS.map((part) =>
    formData.getAll(addressInputName(part)).map(String),
  );
  const rowCount = Math.max(0, ...columns.map((column) => column.length));

  return Array.from({ length: rowCount }, (_, row) =>
    Object.fromEntries(
      ADDRESS_PARTS.map((part, column) => [part, columns[column][row] ?? ""]),
    ),
  ) as RawAddress[];
}

/** Pull the contact out of a submitted form, still as raw strings. */
export function formDataToValues(formData: FormData): RawContactValues {
  const text = Object.fromEntries(
    CONTACT_TEXT_FIELDS.map((field) => [
      field.name,
      String(formData.get(field.name) ?? ""),
    ]),
  ) as Record<ContactTextField, string>;

  return { ...text, addresses: formDataToAddresses(formData) };
}
