import type { CSSProperties } from "react";
import { avatarHue, initials } from "@/lib/contacts/format";
import type { Contact } from "@/lib/contacts/types";

const SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
} as const;

const SHAPE = "inline-flex shrink-0 select-none items-center justify-center rounded-full";

/** The contact's photo, or an initials bubble tinted from their email. */
export default function ContactAvatar({
  contact,
  size = "md",
}: {
  contact: Pick<Contact, "first_name" | "last_name" | "email" | "photo">;
  size?: keyof typeof SIZES;
}) {
  // Decorative in every current usage: the contact's name is always rendered
  // next to it, so announcing the avatar too would just repeat that name.
  if (contact.photo) {
    return (
      /* A data: URL has nothing for next/image to fetch or optimise. */
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={contact.photo}
        alt=""
        aria-hidden="true"
        className={`${SHAPE} ${SIZES[size]} aspect-square object-cover ring-1 ring-hairline`}
      />
    );
  }

  const style = {
    "--avatar-hue": avatarHue(contact.email),
  } as CSSProperties;

  return (
    <span
      aria-hidden="true"
      style={style}
      className={`contact-avatar ${SHAPE} ${SIZES[size]} font-display font-semibold`}
    >
      {initials(contact)}
    </span>
  );
}
