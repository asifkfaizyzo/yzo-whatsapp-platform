import prisma from '../../config/prisma.js';
import { 
  sendEnquiryConfirmationEmail, 
  sendEnquiryNotificationEmail 
} from '../auth/emailService.js';
import { validationResult } from 'express-validator';

// ── Public Enquiry Submission ──
export const submitEnquiry = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Validation failed', 
      errors: errors.array() 
    });
  }

  const { name, email, subject, message } = req.body;

  try {
    const enquiry = await prisma.enquiry.create({
      data: {
        name,
        email,
        subject: subject || null,
        message,
        status: 'new',
      },
    });

    // Send emails (non-blocking)
    sendEnquiryConfirmationEmail(email, name).catch(console.error);
    const adminEmail = process.env.EMAIL_USER || 'admin@sudoreply.com';
    sendEnquiryNotificationEmail(adminEmail, { name, email, subject, message }).catch(console.error);

    return res.status(201).json({ 
      success: true, 
      message: 'Enquiry submitted', 
      data: enquiry 
    });
  } catch (error) {
    console.error('❌ Submit enquiry error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to submit enquiry' 
    });
  }
};

// ── Admin: List Enquiries (Paginated, Searchable, Filterable) ──
export const getEnquiries = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const status = req.query.status;
  const search = req.query.search;

  const skip = (page - 1) * limit;

  // Build where conditions
  const where = {};
  if (status) {
    where.status = status;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  try {
    const [enquiries, total] = await Promise.all([
      prisma.enquiry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.enquiry.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.json({
      success: true,
      data: enquiries,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error('❌ Get enquiries error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch enquiries' 
    });
  }
};

// ── Admin: Get Single Enquiry ──
export const getEnquiry = async (req, res) => {
  const { id } = req.params;

  try {
    let enquiry = await prisma.enquiry.findUnique({
      where: { id },
    });

    if (!enquiry) {
      return res.status(404).json({ 
        success: false, 
        message: 'Enquiry not found' 
      });
    }

    // Auto update status to 'read' if currently 'new'
    if (enquiry.status === 'new') {
      enquiry = await prisma.enquiry.update({
        where: { id },
        data: { status: 'read' },
      });
    }

    return res.json({ 
      success: true, 
      data: enquiry 
    });
  } catch (error) {
    console.error('❌ Get single enquiry error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch enquiry details' 
    });
  }
};

// ── Admin: Update Status ──
export const updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['new', 'read', 'replied', 'closed'].includes(status)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid status' 
    });
  }

  try {
    const updated = await prisma.enquiry.update({
      where: { id },
      data: { status },
    });

    return res.json({ 
      success: true, 
      data: updated 
    });
  } catch (error) {
    console.error('❌ Update enquiry status error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to update status' 
    });
  }
};

// ── Admin: Delete Enquiry ──
export const deleteEnquiry = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.enquiry.delete({
      where: { id },
    });

    return res.json({ 
      success: true, 
      message: 'Enquiry deleted' 
    });
  } catch (error) {
    console.error('❌ Delete enquiry error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to delete enquiry' 
    });
  }
};
