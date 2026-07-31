// src/modules/webhook/dlqController.js
import { dlqQueue } from '../../queues/dlqQueue.js';
import { webhookQueue } from '../../queues/webhookQueue.js';

// ═══════════════════════════════════════════════
// GET ALL FAILED WEBHOOKS
// ═══════════════════════════════════════════════
export const getFailedWebhooks = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const start = (page - 1) * limit;
    const end   = start + limit - 1;

    // Get failed jobs from DLQ
    const jobs = await dlqQueue.getJobs(
      ['completed', 'waiting', 'active'],
      start,
      end
    );

    // Get total count
    const total = await dlqQueue.getJobCounts();

    // Format response
    const failedJobs = jobs.map(job => ({
      id:             job.id,
      originalJobId:  job.data.originalJobId,
      failedAt:       job.data.failedAt,
      attempts:       job.data.attempts,
      errorMessage:   job.data.errorMessage,
      errorName:      job.data.errorName,
      originalData:   job.data.originalData,
      createdAt:      new Date(job.timestamp).toISOString(),
    }));

    return res.status(200).json({
      success: true,
      data: {
        jobs:    failedJobs,
        total:   total.waiting + total.completed + total.active,
        page,
        limit,
        totalPages: Math.ceil((total.waiting + total.completed + total.active) / limit),
      }
    });

  } catch (error) {
    console.error('Failed to fetch DLQ jobs:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ═══════════════════════════════════════════════
// GET DLQ STATISTICS
// ═══════════════════════════════════════════════
export const getDLQStats = async (req, res) => {
  try {
    const counts = await dlqQueue.getJobCounts();

    return res.status(200).json({
      success: true,
      data: {
        total:     counts.waiting + counts.completed + counts.active + counts.failed,
        waiting:   counts.waiting,
        active:    counts.active,
        completed: counts.completed,
        failed:    counts.failed,
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ═══════════════════════════════════════════════
// GET SINGLE FAILED WEBHOOK DETAIL
// ═══════════════════════════════════════════════
export const getFailedWebhookDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await dlqQueue.getJob(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Failed webhook not found in DLQ'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id:             job.id,
        originalJobId:  job.data.originalJobId,
        failedAt:       job.data.failedAt,
        attempts:       job.data.attempts,
        errorMessage:   job.data.errorMessage,
        errorStack:     job.data.errorStack,
        errorName:      job.data.errorName,
        originalData:   job.data.originalData,
        createdAt:      new Date(job.timestamp).toISOString(),
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ═══════════════════════════════════════════════
// RETRY A SINGLE FAILED WEBHOOK
// ═══════════════════════════════════════════════
export const retryFailedWebhook = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await dlqQueue.getJob(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Failed webhook not found in DLQ'
      });
    }

    // Push original data back to main queue
    const newJob = await webhookQueue.add(
      'meta-webhook-payload',
      job.data.originalData,
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 }
      }
    );

    // Remove from DLQ after successful re-push
    await job.remove();

    console.log(`🔄 [DLQ] Retried job ${id}, new job ID: ${newJob.id}`);

    return res.status(200).json({
      success: true,
      message: 'Webhook retried successfully',
      data: {
        oldJobId: id,
        newJobId: newJob.id
      }
    });

  } catch (error) {
    console.error('Failed to retry DLQ job:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ═══════════════════════════════════════════════
// RETRY ALL FAILED WEBHOOKS
// ═══════════════════════════════════════════════
export const retryAllFailedWebhooks = async (req, res) => {
  try {
    const jobs = await dlqQueue.getJobs(['waiting', 'completed'], 0, -1);

    if (jobs.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No failed webhooks to retry',
        data: { retriedCount: 0 }
      });
    }

    let retriedCount = 0;
    const errors = [];

    for (const job of jobs) {
      try {
        await webhookQueue.add(
          'meta-webhook-payload',
          job.data.originalData,
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 }
          }
        );
        await job.remove();
        retriedCount++;
      } catch (err) {
        errors.push({ jobId: job.id, error: err.message });
      }
    }

    console.log(`🔄 [DLQ] Bulk retry: ${retriedCount} succeeded, ${errors.length} failed`);

    return res.status(200).json({
      success: true,
      message: `Retried ${retriedCount} webhooks`,
      data: {
        retriedCount,
        failedCount: errors.length,
        errors: errors.slice(0, 10), // return first 10 errors
      }
    });

  } catch (error) {
    console.error('Failed to bulk retry DLQ:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ═══════════════════════════════════════════════
// DELETE A SINGLE FAILED WEBHOOK
// ═══════════════════════════════════════════════
export const deleteFailedWebhook = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await dlqQueue.getJob(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Failed webhook not found'
      });
    }

    await job.remove();

    console.log(`🗑️ [DLQ] Deleted job ${id}`);

    return res.status(200).json({
      success: true,
      message: 'Failed webhook deleted from DLQ'
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ═══════════════════════════════════════════════
// CLEAR ALL FAILED WEBHOOKS
// ═══════════════════════════════════════════════
export const clearAllFailedWebhooks = async (req, res) => {
  try {
    // Get all jobs
    const jobs = await dlqQueue.getJobs(
      ['waiting', 'completed', 'active', 'failed'],
      0,
      -1
    );

    const totalCount = jobs.length;

    // Remove all
    await Promise.all(jobs.map(job => job.remove()));

    console.log(`🗑️ [DLQ] Cleared all ${totalCount} failed webhooks`);

    return res.status(200).json({
      success: true,
      message: `Cleared ${totalCount} failed webhooks`,
      data: { deletedCount: totalCount }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};