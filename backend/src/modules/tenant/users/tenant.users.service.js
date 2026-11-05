// backend/src/modules/tenant/users/tenant.users.service.js (do not remove this comment)
import bcrypt from "bcrypt";
import prisma from "../../../config/prisma.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../../auth/jwt.service.js";
import { saveRefreshToken } from "../../auth/refreshToken.service.js";
import { checkLimitAccess } from "../../../lib/plan.limits.js";

export const createUserService = async (data, tenantId) => {
  const { name, email, password } = data;

  if (!name || !email || !password) {
    throw new Error("Name, email and password are required");
  }

  const limitCheck = await checkLimitAccess(tenantId, "maxAgents");
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.message);
  }
  console.log(data);

  if (!tenantId) {
    throw new Error("Tenant ID is required");
  }
  console.log("checking emails");

  const [emailExistsInTenant, emailExistsInUser, emailExistsInSuperAdmin] =
    await Promise.all([
      prisma.tenant.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { email } }),
      prisma.superAdmin.findUnique({ where: { email } }),
    ]);

  if (emailExistsInTenant || emailExistsInUser || emailExistsInSuperAdmin) {
    throw new Error("Email is already registered on the platform");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  console.log("creating user");

  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, tenantId, isActive: true },
  });

  const accessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    tenantId: user.tenantId,
    type: "USER",
  });

  const refreshToken = generateRefreshToken({
    id: user.id,
    tenantId: user.tenantId,
    type: "USER",
  });

  await saveRefreshToken({ token: refreshToken, userId: user.id });

  const { password: _, ...safeUser } = user;
  console.log("return response");

  return {
    message: "User created successfully",
    user: {
      id: safeUser.id,
      name: safeUser.name,
      email: safeUser.email,
      tenantId: safeUser.tenantId,
      type: "USER",
    },
    accessToken,
    refreshToken,
  };
};

export const getUsersByTenantService = async (tenantId) => {
  if (!tenantId) {
    throw new Error("Tenant ID is required");
  }

  const users = await prisma.user.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      tenantId: true,
      createdAt: true,
      updatedAt: true,
      assignedContacts: { select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const usersWithCount = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    isActive: user.isActive,
    tenantId: user.tenantId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    assignedContactCount: user.assignedContacts.length,
  }));

  return {
    message: "Users fetched successfully",
    count: users.length,
    users,
  };
};

export const getUserByIdService = async (userId, tenantId) => {
  if (!userId) throw new Error("User ID is required");
  if (!tenantId) throw new Error("Tenant ID is required");

  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      tenantId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) throw new Error("User not found");

  return { message: "User fetched successfully", user };
};

export const updateUserByIdService = async (userId, tenantId, data) => {
  if (!userId) throw new Error("User ID is required");
  if (!tenantId) throw new Error("Tenant ID is required");

  const existingUser = await prisma.user.findFirst({
    where: { id: userId, tenantId },
  });

  if (!existingUser) throw new Error("User not found");

  const updateData = {};

  if (data.name) updateData.name = data.name;

  if (data.email) {
    const emailExists = await prisma.user.findFirst({
      where: { email: data.email, id: { not: userId } },
    });
    if (emailExists) throw new Error("Email already in use");
    updateData.email = data.email;
  }

  if (typeof data.isActive === "boolean") {
    if (data.isActive === true && !existingUser.isActive) {
      const limitCheck = await checkLimitAccess(tenantId, "maxAgents");
      if (!limitCheck.allowed) throw new Error(limitCheck.message);
    }
    updateData.isActive = data.isActive;
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error("No valid fields to update");
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      tenantId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return { message: "User updated successfully", user: updatedUser };
};

export const deactivateUserByIdService = async (userId, tenantId) => {
  if (!userId) throw new Error("User ID is required");
  if (!tenantId) throw new Error("Tenant ID is required");

  const existingUser = await prisma.user.findFirst({
    where: { id: userId, tenantId },
  });

  if (!existingUser) throw new Error("User not found");
  if (!existingUser.isActive) throw new Error("User is already deactivated");

  const deactivatedUser = await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      tenantId: true,
      updatedAt: true,
    },
  });

  await prisma.refreshToken.deleteMany({ where: { userId } });

  return { message: "User deactivated successfully", user: deactivatedUser };
};

export const reactivateUserByIdService = async (userId, tenantId) => {
  if (!userId) throw new Error("User ID is required");
  if (!tenantId) throw new Error("Tenant ID is required");

  const limitCheck = await checkLimitAccess(tenantId, "maxAgents");
  if (!limitCheck.allowed) throw new Error(limitCheck.message);

  const existingUser = await prisma.user.findFirst({
    where: { id: userId, tenantId },
  });

  if (!existingUser) throw new Error("User not found");
  if (existingUser.isActive) throw new Error("User is already active");

  const reactivatedUser = await prisma.user.update({
    where: { id: userId },
    data: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      tenantId: true,
      updatedAt: true,
    },
  });

  return { message: "User reactivated successfully", user: reactivatedUser };
};

export const deleteUserByIdService = async (userId, tenantId) => {
  if (!userId) throw new Error("User ID is required");
  if (!tenantId) throw new Error("Tenant ID is required");

  const existingUser = await prisma.user.findFirst({
    where: { id: userId, tenantId },
  });

  if (!existingUser) throw new Error("User not found");

  await prisma.$transaction(async (tx) => {
    await tx.userTagMapping.deleteMany({ where: { userId } });
    await tx.ticket.updateMany({ where: { userId }, data: { userId: null } });
    await tx.ticketMessage.updateMany({
      where: { userId },
      data: { userId: null },
    });
    await tx.contact.updateMany({
      where: { assignedTo: userId },
      data: { assignedTo: null, assignedAt: null },
    });
    await tx.conversation.updateMany({
      where: { assignedTo: userId },
      data: { assignedTo: null },
    });
    await tx.refreshToken.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });

  return { message: "User deleted successfully" };
};
