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



// Change a user's tag(Update the user with new tag)
export const changeUserTagService = async (userId, oldTagId, newTagId, tenantId) => {
    // 1. Check new tag exists under tenant
    const newTag = await prisma.tag.findFirst({
        where: {
            id: newTagId,
            tenantId: tenantId
        }
    });

    if (!newTag) {
        throw new Error('New tag not found');
    }

    // 2. Remove old tag mapping
    await prisma.userTagMapping.deleteMany({
        where: {
            userId: userId,
            tagId: oldTagId,
            tenantId: tenantId
        }
    });

    // 3. Check if new mapping already exists
    const existingMapping = await prisma.userTagMapping.findFirst({
        where: {
            userId: userId,
            tagId: newTagId,
            tenantId: tenantId
        }
    });

    if (existingMapping) {
        return {
            message: `User is already assigned to ${newTag.name}`,
            userId,
            tagId: newTagId,
            tagName: newTag.name
        };
    }

    // 4. Create new mapping
    await prisma.userTagMapping.create({
        data: {
            userId: userId,
            tagId: newTagId,
            tenantId: tenantId
        }
    });

    return {
        message: `User tag changed to ${newTag.name}`,
        userId,
        tagId: newTagId,
        tagName: newTag.name
    };
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