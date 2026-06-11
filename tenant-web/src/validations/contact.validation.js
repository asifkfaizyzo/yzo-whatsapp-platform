import { z } from 'zod';

export const contactFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  countryCode: z.string().min(1, 'Required').regex(/^\+?\d+$/, 'Invalid code format'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').regex(/^\d+$/, 'Invalid digits'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  company: z.string().optional().or(z.literal('')),
  tag: z.enum(['Lead', 'Interested in pricing', 'Enterprise']),
});