// admin-web/src/validations/superAdmin.validation.js
import { z } from 'zod';
import { emailRule, passwordRule } from '../utils/validationHelpers';

// SuperAdmin Creation
export const createSuperAdminSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: emailRule,
  password: passwordRule,
});

// Tenant profile updates by SuperAdmin
export const updateTenantByAdminSchema = z.object({
  tenantName: z.string().min(2, 'Tenant name must be at least 2 characters').optional().or(z.literal('')),
  email: emailRule.optional().or(z.literal('')),
  phone: z.string().min(10, 'Phone must be at least 10 digits').optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
});
