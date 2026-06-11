import { z } from 'zod';
import { emailRule, passwordRule } from '../utils/validationHelpers';

export const registerTenantSchema = z.object({
  tenantName: z.string().min(2, 'Tenant name must be at least 2 characters'),
  email: emailRule,
  password: passwordRule,
  phone: z.string().min(10, 'Phone must be at least 10 digits').optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
});
