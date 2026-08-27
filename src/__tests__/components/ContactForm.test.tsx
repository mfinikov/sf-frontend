import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactForm from "@/components/contacts/ContactForm";
import { makeContact } from "../mocks/handlers";
import type { FormState } from "@/lib/contacts/types";

function renderForm(action: jest.Mock, contact?: ReturnType<typeof makeContact>) {
  return render(
    <ContactForm
      action={action as never}
      contact={contact}
      submitLabel="Create contact"
      cancelHref="/contacts"
    />,
  );
}

describe("ContactForm", () => {
  it("renders every editable field", () => {
    renderForm(jest.fn());

    expect(screen.getByLabelText(/first name/i)).toBeRequired();
    expect(screen.getByLabelText(/last name/i)).toBeRequired();
    expect(screen.getByLabelText(/^email/i)).toBeRequired();
    expect(screen.getByLabelText(/phone/i)).not.toBeRequired();
    expect(screen.getByLabelText(/notes/i).tagName).toBe("TEXTAREA");
  });

  it("prefills from an existing contact", () => {
    renderForm(jest.fn(), makeContact());

    expect(screen.getByLabelText(/first name/i)).toHaveValue("Ada");
    expect(screen.getByLabelText(/^email/i)).toHaveValue("ada@example.com");
    // Nulls become empty inputs rather than the string "null".
    expect(screen.getByLabelText(/address 1 street/i)).toHaveValue("");
    expect(screen.getByLabelText(/address 1 city/i)).toHaveValue("San Francisco");
    expect(screen.getByLabelText(/address 1 type/i)).toHaveValue("Work");
  });

  it("starts an empty contact with no address rows", () => {
    renderForm(jest.fn());

    expect(screen.getByText(/no addresses yet/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/address 1 city/i)).not.toBeInTheDocument();
  });

  it("carries an existing photo through without touching the picker", async () => {
    const contact = makeContact({ photo: "data:image/png;base64,iVBORw0KGgo=" });
    const action = jest.fn<Promise<FormState>, [FormState, FormData]>(
      async () => ({ status: "idle" }),
    );
    render(
      <ContactForm
        action={action as never}
        contact={contact}
        submitLabel="Save changes"
        cancelHref="/contacts"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(action).toHaveBeenCalled());

    // The edit form does a full-replace PUT, so an untouched photo has to be
    // resubmitted or it would be silently cleared.
    expect(action.mock.calls[0][1].get("photo")).toBe(contact.photo);
  });

  it("submits the entered values to the action", async () => {
    const action = jest.fn<Promise<FormState>, [FormState, FormData]>(
      async () => ({ status: "idle" }),
    );
    renderForm(action);

    await userEvent.type(screen.getByLabelText(/first name/i), "Grace");
    await userEvent.type(screen.getByLabelText(/last name/i), "Hopper");
    await userEvent.type(screen.getByLabelText(/^email/i), "grace@example.com");
    await userEvent.click(screen.getByRole("button", { name: /create contact/i }));

    await waitFor(() => expect(action).toHaveBeenCalled());

    const formData = action.mock.calls[0][1];
    expect(formData.get("first_name")).toBe("Grace");
    expect(formData.get("email")).toBe("grace@example.com");
  });

  it("shows the summary and the per-field errors the action returns", async () => {
    const action = jest.fn(
      async (): Promise<FormState> => ({
        status: "error",
        message: "That email address is already taken.",
        fieldErrors: { email: "This email is already in use." },
        values: { first_name: "Grace" },
      }),
    );
    renderForm(action);

    await userEvent.click(screen.getByRole("button", { name: /create contact/i }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.map((node) => node.textContent)).toEqual(
      expect.arrayContaining([
        "That email address is already taken.",
        "This email is already in use.",
      ]),
    );
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("adds and removes address rows", async () => {
    const action = jest.fn<Promise<FormState>, [FormState, FormData]>(
      async () => ({ status: "idle" }),
    );
    renderForm(action);

    await userEvent.click(screen.getByRole("button", { name: /add address/i }));
    await userEvent.type(screen.getByLabelText(/address 1 city/i), "London");

    await userEvent.click(screen.getByRole("button", { name: /add address/i }));
    await userEvent.selectOptions(screen.getByLabelText(/address 2 type/i), "Work");
    await userEvent.type(screen.getByLabelText(/address 2 city/i), "San Francisco");

    await userEvent.type(screen.getByLabelText(/first name/i), "Grace");
    await userEvent.type(screen.getByLabelText(/last name/i), "Hopper");
    await userEvent.type(screen.getByLabelText(/^email/i), "grace@example.com");
    await userEvent.click(screen.getByRole("button", { name: /create contact/i }));

    await waitFor(() => expect(action).toHaveBeenCalled());

    const formData = action.mock.calls[0][1];
    expect(formData.getAll("address_city")).toEqual(["London", "San Francisco"]);
    expect(formData.getAll("address_type")).toEqual(["Home", "Work"]);
  });

  it("drops the right row when one is removed", async () => {
    const action = jest.fn<Promise<FormState>, [FormState, FormData]>(
      async () => ({ status: "idle" }),
    );
    renderForm(action);

    await userEvent.click(screen.getByRole("button", { name: /add address/i }));
    await userEvent.type(screen.getByLabelText(/address 1 city/i), "London");
    await userEvent.click(screen.getByRole("button", { name: /add address/i }));
    await userEvent.type(screen.getByLabelText(/address 2 city/i), "Oakland");

    await userEvent.click(
      screen.getByRole("button", { name: /remove address 1/i }),
    );

    await userEvent.type(screen.getByLabelText(/first name/i), "Grace");
    await userEvent.type(screen.getByLabelText(/last name/i), "Hopper");
    await userEvent.type(screen.getByLabelText(/^email/i), "grace@example.com");
    await userEvent.click(screen.getByRole("button", { name: /create contact/i }));

    await waitFor(() => expect(action).toHaveBeenCalled());
    expect(action.mock.calls[0][1].getAll("address_city")).toEqual(["Oakland"]);
  });

  it("links back out without submitting", () => {
    renderForm(jest.fn());
    expect(screen.getByRole("link", { name: /cancel/i })).toHaveAttribute(
      "href",
      "/contacts",
    );
  });
});
