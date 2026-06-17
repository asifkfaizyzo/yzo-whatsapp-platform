import prisma from '../../config/prisma.js';



// Create a tag for tenant
export const createTag = async (name, priority, tenantId, color, description) => {
    return await prisma.tag.create({
        data: {
            name,
            priority,
            tenantId,
            description
        }
    });
};

// Get all tags for tenant
export const getTagsByTenant = async (tenantId) => {
    return await prisma.tag.findMany({
        where: { tenantId },
        include: {
            userTags: {
                include: { user: true }
            }
        },
        orderBy: { priority: 'asc' }
    });
};

// Map user to tag (UserTagMapping)
export const mapUserToTag = async (userId, tagId, tenantId) => {
    return await prisma.userTagMapping.create({
        data: {
            userId,
            tagId,
            tenantId
        }
    });
};

// Remove user from tag
export const removeUserFromTag = async (userId, tagId) => {
    return await prisma.userTagMapping.deleteMany({
        where: {
            userId,
            tagId
        }
    });
};

// Get users by tag ID
export const getUsersByTagId = async (tagId, tenantId) => {
    const mappings = await prisma.userTagMapping.findMany({
        where: {
            tagId,
            tenantId
        },
        include: {
            user: true
        }
    });
    return mappings.map(m => m.user);
};


// Check if user is already mapped to this tag
export const checkUserTagMapping = async (userId, tagId) => {
    return await prisma.userTagMapping.findUnique({
        where: {
            userId_tagId: {
                userId: userId,
                tagId: tagId
            }
        }
    });
};

// Check if user is mapped to ANY other tag
export const checkUserOtherTags = async (userId, tenantId) => {
    return await prisma.userTagMapping.findMany({
        where: {
            userId: userId,
            tenantId: tenantId
        },
        include: {
            tag: true
        }
    });
};