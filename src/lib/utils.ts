// Utility functions for the admin panel
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumberLocale(
  value: number,
  locale: "fa" | "en" = "fa"
): string {
  const formatter = new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US");
  return formatter.format(value);
}

export function formatCurrency(
  value: number,
  locale: "fa" | "en" = "fa"
): string {
  const formatted = formatNumberLocale(value, locale);
  // Suffix/prefix per locale
  return locale === "fa" ? `${formatted} تومان` : `${formatted} IRT`;
}
