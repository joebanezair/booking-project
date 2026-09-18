import Sale from "../models/Sale.js";

export async function syncSaleForBooking(booking, reason = "") {
  if (!booking) return null;

  if (booking.status === "completed") {
    const completedAt = booking.completedAt || new Date();
    return Sale.findOneAndUpdate(
      { booking: booking._id },
      {
        $set: {
          businessOwner: booking.user,
          business: booking.business || null,
          content: booking.content || null,
          serviceName: booking.service,
          saleAmount: Number(booking.servicePrice || 0),
          currency: String(booking.currency || "PHP").toUpperCase(),
          guestName: booking.guestName || "",
          guestEmail: booking.guestEmail || "",
          guestPhone: booking.guestPhone || "",
          locationLabel: booking.locationLabel || "",
          bookingDate: booking.bookingDate,
          completedAt,
          status: "recorded",
          voidedAt: null,
          voidReason: ""
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );
  }

  const existing = await Sale.findOne({ booking: booking._id });
  if (!existing || existing.status === "voided") return existing;

  existing.status = "voided";
  existing.voidedAt = new Date();
  existing.voidReason = reason || `Booking changed from completed to ${booking.status}.`;
  await existing.save();
  return existing;
}
