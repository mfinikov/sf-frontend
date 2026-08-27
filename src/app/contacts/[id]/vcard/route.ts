import { notFound } from "next/navigation";
import { getContact } from "@/lib/contacts/api";
import { toVCard, vCardFilename } from "@/lib/contacts/vcard";

/**
 * `GET /contacts/[id]/vcard` — the contact as a downloadable `.vcf`.
 *
 * A route handler rather than a server action: the browser needs a plain URL it
 * can navigate to for the download, and the file is built on the server so the
 * photo never has to be re-encoded in the client.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number.parseInt((await params).id, 10);
  if (!Number.isInteger(id) || id < 1) notFound();

  const contact = await getContact(id);
  if (!contact) notFound();

  return new Response(toVCard(contact), {
    headers: {
      "content-type": "text/vcard; charset=utf-8",
      "content-disposition": `attachment; filename="${vCardFilename(contact)}"`,
      "cache-control": "no-store",
    },
  });
}
