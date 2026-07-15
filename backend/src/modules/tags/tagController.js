import * as tagService from './tagCrudService.js';
import prisma from '../../config/prisma.js';

export const createTag = async (req, res, next) => {
    try {
        const { name, priority, description } = req.body;
        console.log(name);
        console.log(priority);
        console.log(description);

       const tenantId = req.tenant.id;
        console.log(tenantId);
        

        
        // Check if tenantId exists
        if (!tenantId) {
            return res.status(400).json({ 
                success: false, 
                message: "Tenant ID is missing" 
            });
        }

        const tag = await tagService.createTag(name, priority, tenantId, description);
        
        res.status(201).json({
            success: true,
            message: "Tag created",
            data: tag
        });
    } catch (error) {
        next(error);
        error: error.message;
    }
};

export const getTags = async (req, res, next) => {
    try {
        const tenantId = req.tenantId;
        const tags = await tagService.getTagsByTenant(tenantId);
        
        res.status(200).json({
            success: true,
            data: tags
        });
    } catch (error) {
        next(error);
    }
};


// "Assign a user to handle this tag" ← ONLY THIS ONE CHANGED
export const assignUserToTag = async (req, res, next) => {
    try {
        const { tagId } = req.params;
        const { userId } = req.body;
        const tenantId = req.tenant.id;

        // 1. Check if user is already assigned to this tag
        const existingMapping = await tagService.checkUserTagMapping(userId, tagId);

        if (existingMapping) {
            return res.status(200).json({
                success: true,
                message: "User is already assigned to this tag"
            });
        }

        // 2. Check if user is assigned to another tag
        const otherTags = await tagService.checkUserOtherTags(userId, tenantId);

        if (otherTags.length > 0) {
            const tagNames = otherTags.map(t => t.tag.name).join(', ');
            return res.status(200).json({
                success: true,
                message: `User is already assigned to another tag: ${tagNames}`
            });
        }

        // 3. Assign user to tag
        await tagService.mapUserToTag(userId, tagId, tenantId);

        // 4. Get tag name for response
        const tag = await prisma.tag.findFirst({
            where: { id: tagId, tenantId }
        });
        if (!tag) {
            return res.status(404).json({ success: false, message: "Tag not found" });
        }

        return res.status(200).json({
            success: true,
            message: `User ${userId} assigned to ${tag.name} tag`,
            data: {
                userId: userId,
                tagId: tagId,
                tagName: tag.name
            }
        });

    } catch (error) {
        next(error);
    }
};



//Change user tag to newTag
export const changeUserTag = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { oldTagId, newTagId } = req.body;
        const tenantId = req.tenant.id;

        const result = await tagService.changeUserTagService(
            userId,
            oldTagId,
            newTagId,
            tenantId
        );

        return res.status(200).json({
            success: true,
            message: result.message,
            data: {
                userId: result.userId,
                tagId: result.tagId,
                tagName: result.tagName
            }
        });
    } catch (error) {
        next(error);
    }
};