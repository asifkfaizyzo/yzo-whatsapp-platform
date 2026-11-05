// backend/src/validations/whatsapp.schema.js (do not remove this comment)

import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Send Location Schema
// Used by: POST /tenant/whatsapp/send-location
// ─────────────────────────────────────────────────────────────

export const sendLocationSchema = z.object({
  body: z.object({
    // ── Who to send to ──────────────────────────────────────
    // WhatsApp phone number without + prefix
    // e.g. "919876543210"
    to: z
      .string({ required_error: "Recipient phone number is required" })
      .min(7, "Phone number too short")
      .max(15, "Phone number too long")
      .regex(/^\d+$/, "Phone number must contain only digits, no + or spaces"),

    // ── Core location ───────────────────────────────────────
    latitude: z
      .number({ required_error: "latitude is required" })
      .min(-90, "latitude must be >= -90")
      .max(90, "latitude must be <= 90"),

    longitude: z
      .number({ required_error: "longitude is required" })
      .min(-180, "longitude must be >= -180")
      .max(180, "longitude must be <= 180"),

    // ── Optional ────────────────────────────────────────────
    name: z.string().max(100, "name must not exceed 100 characters").optional(),

    address: z
      .string()
      .max(300, "address must not exceed 300 characters")
      .optional(),

    // ── Link to conversation ─────────────────────────────────
    conversationId: z.string().optional(),
  }),

  // No params or query needed for this route
  params: z.object({}).optional(),
  query: z.object({}).optional(),
  cookies: z.object({}).optional(),
});
// -------------------------------------------------------------
// Setup WhatsApp Schema
// Used by: POST /tenant/whatsapp/setup
// -------------------------------------------------------------
export const setupWhatsAppSchema = z.object({
  body: z.object({
    phoneNumberId: z
      .string({ required_error: "phoneNumberId is required" })
      .min(1),
    wabaId: z.string().optional().or(z.literal("")).nullable(),
    accessToken: z.string().optional().or(z.literal("")).nullable(),
    pin: z.string().optional().or(z.literal("")).nullable(),
  }),
});
