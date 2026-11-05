// backend/src/modules/tenant/users/tenant.users.controller.js (do not remove this comment)
import {
  createUserService,
  getUsersByTenantService,
  getUserByIdService,
  updateUserByIdService,
  deactivateUserByIdService,
  reactivateUserByIdService,
  deleteUserByIdService,
} from "./tenant.users.service.js";

export const createUser = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      return res.status(401).json({
        success: false,
        message: "Tenant not authenticated",
      });
    }

    const result = await createUserService(req.body, tenantId);

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUsersByTenant = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const result = await getUsersByTenantService(tenantId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant.id;
    const result = await getUserByIdService(id, tenantId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant.id;
    const data = req.body;
    const result = await updateUserByIdService(id, tenantId, data);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const deactivateUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant.id;
    const result = await deactivateUserByIdService(id, tenantId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const reactivateUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant.id;
    const result = await reactivateUserByIdService(id, tenantId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant.id;
    const result = await deleteUserByIdService(id, tenantId);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
