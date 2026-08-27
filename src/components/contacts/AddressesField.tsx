"use client";

import { useId, useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { ADDRESS_TYPES, type AddressType, type RawAddress } from "@/lib/contacts/types";
import { MAX_ADDRESSES, addressInputName } from "@/lib/contacts/schema";

const CONTROL =
  "w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary focus:bg-input";

const EMPTY: RawAddress = {
  type: "Home",
  street: "",
  city: "",
  state: "",
  postal_code: "",
  country: "",
};

/** A row needs a key that survives reordering, and the index does not. */
interface Row extends RawAddress {
  key: number;
}

function toRows(addresses: readonly RawAddress[]): Row[] {
  return addresses.map((address, index) => ({ ...address, key: index }));
}

/**
 * The repeatable address list.
 *
 * Every part submits under a repeated name (`address_city`, …), so the whole
 * collection travels as ordinary form encoding and `formDataToValues` zips the
 * columns back into rows. The inputs are uncontrolled — React only owns which
 * rows exist, which keeps typing out of the render path.
 */
export default function AddressesField({
  defaultValue,
  error,
}: {
  defaultValue: readonly RawAddress[];
  error?: string;
}) {
  const groupId = useId();
  const [rows, setRows] = useState<Row[]>(() => toRows(defaultValue));
  const [nextKey, setNextKey] = useState(defaultValue.length);

  const errorId = `${groupId}-error`;
  const atLimit = rows.length >= MAX_ADDRESSES;

  function addRow() {
    setRows((current) => [...current, { ...EMPTY, key: nextKey }]);
    setNextKey((key) => key + 1);
  }

  function removeRow(key: number) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  return (
    <div className="space-y-3" aria-describedby={error ? errorId : undefined}>
      {rows.length === 0 ? (
        <p className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-4 text-[13px] text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          No addresses yet.
        </p>
      ) : null}

      {rows.map((row, index) => (
        <fieldset
          key={row.key}
          className="space-y-3 rounded-lg border border-border bg-card/40 p-3"
        >
          <legend className="sr-only">Address {index + 1}</legend>

          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor={`${groupId}-type-${row.key}`}>
              Address {index + 1} type
            </label>
            <select
              id={`${groupId}-type-${row.key}`}
              name={addressInputName("type")}
              defaultValue={row.type}
              className={`${CONTROL} w-auto`}
            >
              {ADDRESS_TYPES.map((type: AddressType) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => removeRow(row.key)}
              className="ml-auto inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              Remove
              <span className="sr-only"> address {index + 1}</span>
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Part
              id={`${groupId}-street-${row.key}`}
              part="street"
              label={`Address ${index + 1} street`}
              placeholder="1 Market St, Suite 400"
              autoComplete="street-address"
              maxLength={300}
              defaultValue={row.street}
              wide
            />
            <Part
              id={`${groupId}-city-${row.key}`}
              part="city"
              label={`Address ${index + 1} city`}
              placeholder="San Francisco"
              autoComplete="address-level2"
              maxLength={120}
              defaultValue={row.city}
            />
            <Part
              id={`${groupId}-state-${row.key}`}
              part="state"
              label={`Address ${index + 1} state or region`}
              placeholder="CA"
              autoComplete="address-level1"
              maxLength={120}
              defaultValue={row.state}
            />
            <Part
              id={`${groupId}-postal-${row.key}`}
              part="postal_code"
              label={`Address ${index + 1} postal code`}
              placeholder="94105"
              autoComplete="postal-code"
              maxLength={20}
              defaultValue={row.postal_code}
            />
            <Part
              id={`${groupId}-country-${row.key}`}
              part="country"
              label={`Address ${index + 1} country`}
              placeholder="USA"
              autoComplete="country-name"
              maxLength={120}
              defaultValue={row.country}
            />
          </div>
        </fieldset>
      ))}

      {error ? (
        <p id={errorId} role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={addRow}
        disabled={atLimit}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
      >
        <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        Add address
      </button>

      {atLimit ? (
        <p className="text-[12px] text-muted-foreground">
          That is the maximum of {MAX_ADDRESSES} addresses.
        </p>
      ) : null}
    </div>
  );
}

/** One labelled part of an address. The label is visually hidden — the row's
 *  placeholder and position carry the meaning, and the grid stays compact. */
function Part({
  id,
  part,
  label,
  defaultValue,
  placeholder,
  autoComplete,
  maxLength,
  wide,
}: {
  id: string;
  part: Parameters<typeof addressInputName>[0];
  label: string;
  defaultValue: string;
  placeholder: string;
  autoComplete: string;
  maxLength: number;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={addressInputName(part)}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        className={CONTROL}
      />
    </div>
  );
}
