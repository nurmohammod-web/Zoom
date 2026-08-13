"use client";

// Lightweight guest identity: a display name persisted in localStorage.
// No real auth — this name is sent to the API when creating/joining rooms.

const STORAGE_KEY = "zoom.guestName";

export function getGuestName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_KEY) ?? "";
}

export function setGuestName(name: string): void {
  if (typeof window === "undefined") return;
  const trimmed = name.trim();
  if (trimmed) {
    window.localStorage.setItem(STORAGE_KEY, trimmed);
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
