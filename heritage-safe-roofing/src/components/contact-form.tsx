"use client";

/**
 * The "book a free inspection" form. Checks the fields in the browser first
 * (so mistakes show beside the field, not in a pop-up), then sends them to
 * /api/contact. If sending fails, it says so and offers the phone number,
 * because a lost lead is worse than an ugly error.
 */
import { useState, type FormEvent } from "react";
import { business } from "@/lib/business";
import { CheckIcon, PhoneIcon } from "./icons";

type Fields = { name: string; phone: string; address: string; message: string };
type Errors = Partial<Record<keyof Fields, string>>;

const empty: Fields = { name: "", phone: "", address: "", message: "" };

function validate(f: Fields): Errors {
  const e: Errors = {};
  if (f.name.trim().length < 2) e.name = "Please enter your name.";
  const digits = f.phone.replace(/\D/g, "");
  if (digits.length < 10) e.phone = "Please enter a 10-digit phone number so we can call you back.";
  if (f.address.trim().length < 5) e.address = "Please enter the property address, so we know where the roof is.";
  return e;
}

export function ContactForm() {
  const [fields, setFields] = useState<Fields>(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  function update<K extends keyof Fields>(key: K, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const found = validate(fields);
    setErrors(found);
    const firstBad = (Object.keys(found) as (keyof Fields)[])[0];
    if (firstBad) {
      document.getElementById(`contact-${firstBad}`)?.focus();
      return;
    }
    setStatus("sending");
    try {
      const honeypot = (ev.currentTarget.elements.namedItem("company") as HTMLInputElement | null)?.value ?? "";
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...fields, company: honeypot }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("sent");
    } catch {
      setStatus("failed");
    }
  }

  if (status === "sent") {
    return (
      <div role="status" className="rounded-xl bg-white p-6 shadow-[0_18px_40px_-20px_rgb(11_28_56/0.35)] sm:p-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-500 text-navy-900">
          <CheckIcon className="h-6 w-6" />
        </span>
        <h3 className="mt-5 text-2xl font-bold">Thanks, {fields.name.trim().split(" ")[0]}. We've got it.</h3>
        <p className="mt-3 text-ink-soft">
          We'll call you at <strong className="text-ink">{fields.phone}</strong> to set up your free inspection. If
          it's urgent, you don't have to wait:
        </p>
        <a href={business.phoneHref} className="mt-5 inline-flex items-center gap-2 font-display text-lg font-bold text-navy-800 underline">
          <PhoneIcon className="h-5 w-5" /> {business.phoneDisplay}
        </a>
      </div>
    );
  }

  const inputBase =
    "mt-1.5 block w-full rounded-lg border bg-white px-3.5 py-3 text-base text-ink placeholder:text-ink-soft/80 transition-colors focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-gold-500";
  const border = (k: keyof Fields) => (errors[k] ? "border-red-700" : "border-navy-200 hover:border-navy-600 focus:border-navy-700");

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="rounded-xl bg-white p-5 shadow-[0_18px_40px_-20px_rgb(11_28_56/0.35)] sm:p-8"
      aria-describedby="form-note"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="font-semibold">
            Name
          </label>
          <input
            id="contact-name"
            name="name"
            autoComplete="name"
            value={fields.name}
            onChange={(e) => update("name", e.target.value)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
            className={`${inputBase} ${border("name")}`}
          />
          {errors.name && <p id="contact-name-error" className="mt-1.5 text-sm font-medium text-red-700">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="contact-phone" className="font-semibold">
            Phone
          </label>
          <input
            id="contact-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(954) 555-0123"
            value={fields.phone}
            onChange={(e) => update("phone", e.target.value)}
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "contact-phone-error" : undefined}
            className={`${inputBase} ${border("phone")}`}
          />
          {errors.phone && <p id="contact-phone-error" className="mt-1.5 text-sm font-medium text-red-700">{errors.phone}</p>}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="contact-address" className="font-semibold">
            Property address
          </label>
          <input
            id="contact-address"
            name="address"
            autoComplete="street-address"
            placeholder="Street, city"
            value={fields.address}
            onChange={(e) => update("address", e.target.value)}
            aria-invalid={!!errors.address}
            aria-describedby={errors.address ? "contact-address-error" : undefined}
            className={`${inputBase} ${border("address")}`}
          />
          {errors.address && <p id="contact-address-error" className="mt-1.5 text-sm font-medium text-red-700">{errors.address}</p>}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="contact-message" className="font-semibold">
            What's going on with your roof? <span className="font-normal text-ink-soft">(optional)</span>
          </label>
          <textarea
            id="contact-message"
            name="message"
            rows={4}
            placeholder="A leak over the kitchen, missing shingles after the storm, thinking about a new roof…"
            value={fields.message}
            onChange={(e) => update("message", e.target.value)}
            className={`${inputBase} ${border("message")} resize-y`}
          />
        </div>
        {/* Spam trap: invisible to people, irresistible to bots. */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="contact-company">Company</label>
          <input id="contact-company" name="company" tabIndex={-1} autoComplete="off" />
        </div>
      </div>

      {status === "failed" && (
        <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3.5 text-sm font-medium text-red-800">
          That didn't send, sorry. Please try again, or call us at{" "}
          <a href={business.phoneHref} className="font-bold underline">
            {business.phoneDisplay}
          </a>
          .
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-6 flex min-h-13 w-full items-center justify-center rounded-lg bg-navy-900 px-6 font-display text-lg font-bold text-white transition-colors hover:bg-navy-700 disabled:cursor-wait disabled:opacity-70"
      >
        {status === "sending" ? "Sending…" : "Request my free inspection"}
      </button>
      <p id="form-note" className="mt-3 text-center text-sm text-ink-soft">
        No obligation. We'll only use your details to contact you about your roof.
      </p>
    </form>
  );
}
