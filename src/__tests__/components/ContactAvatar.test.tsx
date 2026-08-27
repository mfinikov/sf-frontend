import React from "react";
import { render, screen } from "@testing-library/react";
import ContactAvatar from "@/components/contacts/ContactAvatar";
import { makeContact } from "../mocks/handlers";

const PHOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("ContactAvatar", () => {
  it("falls back to initials when the contact has no photo", () => {
    const { container } = render(<ContactAvatar contact={makeContact()} />);

    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders the photo as a circular image when one is set", () => {
    const { container } = render(
      <ContactAvatar contact={makeContact({ photo: PHOTO })} />,
    );

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", PHOTO);
    expect(image).toHaveClass("rounded-full", "object-cover");
    expect(screen.queryByText("AL")).not.toBeInTheDocument();
  });

  it("stays decorative — the name is always rendered alongside it", () => {
    const { container } = render(
      <ContactAvatar contact={makeContact({ photo: PHOTO })} />,
    );

    expect(container.querySelector("img")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("honours the requested size", () => {
    const { container } = render(
      <ContactAvatar contact={makeContact({ photo: PHOTO })} size="lg" />,
    );

    expect(container.querySelector("img")).toHaveClass("h-14", "w-14");
  });
});
