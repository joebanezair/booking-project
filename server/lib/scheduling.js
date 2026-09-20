import { randomBytes } from "node:crypto";
import Booking from "../models/Booking.js";

const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const activeStatuses = ["pending", "confirmed", "in_progress"];

function safeTimezone(value) {
  const timezone = String(value || "Asia/Manila");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return "Asia/Manila";
  }
}

function localParts(date, timezone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimezone(timezone),
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
  return {
    day: weekdayMap[parts.weekday],
    dateKey: parts.year + "-" + parts.month + "-" + parts.day,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    label: parts.month + "/" + parts.day + "/" + parts.year + " " + parts.hour + ":" + parts.minute
  };
}

function timeToMinutes(value) {
  const [hour, minute] = String(value || "00:00").split(":").map(Number);
  return hour * 60 + minute;
}

function workingDay(business, day) {
  const hours = Array.isArray(business?.workingHours) ? business.workingHours : [];
  return hours.find(item => Number(item.day) === Number(day)) || null;
}

function bookingEnd(booking) {
  if (booking.bookingEndsAt) return new Date(booking.bookingEndsAt);
  const minutes = Number(booking.serviceDurationMinutes || 60) + Number(booking.bufferMinutes || 0);
  return new Date(new Date(booking.bookingDate).getTime() + minutes * 60000);
}

export function makeBookingReference() {
  return "BF-" + new Date().getUTCFullYear() + "-" + randomBytes(3).toString("hex").toUpperCase();
}

export function serviceWindow(service = {}) {
  return {
    durationMinutes: Math.max(5, Number(service.durationMinutes || 60)),
    bufferMinutes: Math.max(0, Number(service.bufferMinutes || 0)),
    capacity: Math.max(1, Number(service.capacity || 1))
  };
}

export function calculateBookingEndsAt(start, service = {}) {
  const { durationMinutes } = serviceWindow(service);
  return new Date(new Date(start).getTime() + durationMinutes * 60000);
}

function calculateBlockedEnd(start, service = {}) {
  const { durationMinutes, bufferMinutes } = serviceWindow(service);
  return new Date(new Date(start).getTime() + (durationMinutes + bufferMinutes) * 60000);
}

function basicWindowError({ business, service, start, now = new Date() }) {
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return "Please choose a valid booking date and time.";
  const leadMinutes = Math.max(0, Number(business?.leadTimeMinutes ?? 60));
  if (startDate.getTime() < now.getTime() + leadMinutes * 60000) {
    return leadMinutes
      ? "This booking is too soon. Please choose a later available time."
      : "Please choose a future booking time.";
  }

  const maxAdvanceDays = Math.max(1, Number(business?.maxAdvanceDays ?? 60));
  if (startDate.getTime() > now.getTime() + maxAdvanceDays * 86400000) {
    return "This booking is too far in advance. Please choose an earlier date.";
  }

  const timezone = safeTimezone(business?.timezone);
  const startLocal = localParts(startDate, timezone);
  const serviceEnd = calculateBookingEndsAt(startDate, service);
  const endLocal = localParts(serviceEnd, timezone);

  if ((business?.blackoutDates || []).includes(startLocal.dateKey)) {
    return "This business is unavailable on the selected date.";
  }

  const hours = workingDay(business, startLocal.day);
  if (!hours?.enabled) return "This business is closed at the selected time.";

  const opening = timeToMinutes(hours.start);
  const closing = timeToMinutes(hours.end);
  if (startLocal.dateKey !== endLocal.dateKey || startLocal.minutes < opening || endLocal.minutes > closing) {
    return "The selected time is outside this business's working hours.";
  }

  return null;
}

async function overlappingBookings({ ownerId, start, blockedEnd, excludeBookingId }) {
  const filter = {
    user: ownerId,
    status: { $in: activeStatuses },
    bookingDate: { $lt: blockedEnd, $gt: new Date(new Date(start).getTime() - 86400000) }
  };
  if (excludeBookingId) filter._id = { $ne: excludeBookingId };
  const candidates = await Booking.find(filter)
    .select("bookingDate bookingEndsAt serviceDurationMinutes bufferMinutes")
    .lean();
  return candidates.filter(existing =>
    new Date(existing.bookingDate) < blockedEnd && bookingEnd(existing) > new Date(start)
  );
}

export async function validateBookingWindow({ business, service, ownerId, start, excludeBookingId = null }) {
  const error = basicWindowError({ business, service, start });
  if (error) return error;
  const blockedEnd = calculateBlockedEnd(start, service);
  const overlaps = await overlappingBookings({ ownerId, start, blockedEnd, excludeBookingId });
  const { capacity } = serviceWindow(service);
  if (overlaps.length >= capacity) return "That time slot is no longer available. Please choose another time.";
  return null;
}

export async function getAvailableSlots({ business, service, ownerId, dateKey }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))) return [];
  const timezone = safeTimezone(business?.timezone);
  const [year, month, day] = dateKey.split("-").map(Number);
  const interval = Math.max(5, Number(business?.slotIntervalMinutes || 30));
  const approximateStart = Date.UTC(year, month - 1, day) - 14 * 3600000;
  const approximateEnd = Date.UTC(year, month - 1, day + 1) + 14 * 3600000;
  const { capacity } = serviceWindow(service);

  const candidates = await Booking.find({
    user: ownerId,
    status: { $in: activeStatuses },
    bookingDate: {
      $gte: new Date(approximateStart - 86400000),
      $lt: new Date(approximateEnd + 86400000)
    }
  }).select("bookingDate bookingEndsAt serviceDurationMinutes bufferMinutes").lean();

  const slots = [];
  const now = new Date();
  for (let ms = approximateStart; ms <= approximateEnd; ms += interval * 60000) {
    const start = new Date(ms);
    const local = localParts(start, timezone);
    if (local.dateKey !== dateKey) continue;
    if (local.minutes % interval !== 0) continue;
    if (basicWindowError({ business, service, start, now })) continue;

    const blockedEnd = calculateBlockedEnd(start, service);
    const overlaps = candidates.filter(existing =>
      new Date(existing.bookingDate) < blockedEnd && bookingEnd(existing) > start
    );
    if (overlaps.length >= capacity) continue;

    slots.push({
      value: start.toISOString(),
      label: new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit"
      }).format(start)
    });
  }

  return slots.slice(0, 96);
}

export function bookingLocalDateKey(date, timezone) {
  return localParts(new Date(date), timezone).dateKey;
}
