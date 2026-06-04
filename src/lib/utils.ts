import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TEMP_PASSWORD_ADJECTIVES = [
  "Bright", "Strong", "Brave", "Grace", "Faith",
  "Hope",   "Light",  "Bold",  "Pure",  "Firm",
];

export function generateTempPassword(): string {
  const adj = TEMP_PASSWORD_ADJECTIVES[
    Math.floor(Math.random() * TEMP_PASSWORD_ADJECTIVES.length)
  ];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${adj}#${num}`;
}
