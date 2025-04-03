// src/controllers/compliance.controller.ts
import { Request, Response } from 'express';
import db  from './db.config';
import {
  PendingVerificationModel,
  CheckpointDetailModel,
  ComplianceStatus,
  ComplianceAction,
  VerificationStatus
} from './db.interface';

interface RequestWithSession extends Request {
    flash?: (type: string, message?: string) => string[] | void;
    session?: {
      officer?: { id: number; name: string };
      [key: string]: any;
    };
  }

  const complianceController = {
    /**
     * Display pending verifications dashboard
     */
    async renderDashboard(req: RequestWithSession, res: Response): Promise<void> {
      try {
        // Get all pending verifications
        const pendingVerifications = await db
          .selectFrom('signup_checkpoints')
          .leftJoin('user_name', 'user_name.id', 'signup_checkpoints.name')
          .leftJoin('phone_number', 'phone_number.id', 'signup_checkpoints.phone_id')
          .select([
            'signup_checkpoints.id as checkpoint_id',
            'signup_checkpoints.email',
            'signup_checkpoints.dob',
            'signup_checkpoints.created_at as submitted_at',
            'signup_checkpoints.compliance_status',
            'user_name.first_name',
            'user_name.last_name',
            'user_name.full_name',
            'phone_number.phone'
          ])
          .where(eb => eb.or([
            eb('signup_checkpoints.compliance_status', 'is', null),
            eb('signup_checkpoints.compliance_status', '=', 'pending' as ComplianceStatus)
          ]))
          .orderBy('signup_checkpoints.created_at', 'desc')
          .execute();

        res.render('compliance/dashboard', {
          pendingVerifications,
          officer: req.session?.officer || { name: 'Test Officer', id: 1 }
        });
      } catch (error) {
        console.error('Error rendering compliance dashboard:', error);
        res.status(500).send(`
          <h1>Error</h1>
          <p>Failed to load dashboard: ${(error as Error).message}</p>
          <a href="/compliance/dashboard">Try again</a>
        `);
      }
    },

    /**
     * Render verification details page
     */
    async renderVerificationDetails(req: RequestWithSession, res: Response): Promise<void> {
      try {
        const checkpointId = Number(req.params.checkpointId);

        // Get checkpoint with related information
        const checkpoint = await db
          .selectFrom('signup_checkpoints')
          .leftJoin('user_name', 'user_name.id', 'signup_checkpoints.name')
          .leftJoin('pan_number', 'pan_number.id', 'signup_checkpoints.pan_id')
          .leftJoin('aadhar_number', 'aadhar_number.id', 'signup_checkpoints.aadhaar_id')
          .leftJoin('phone_number', 'phone_number.id', 'signup_checkpoints.phone_id')
          .select([
            'signup_checkpoints.id as checkpoint_id',
            'signup_checkpoints.email',
            'signup_checkpoints.dob',
            'signup_checkpoints.marital_status',
            'signup_checkpoints.occupation',
            'signup_checkpoints.annual_income',
            'signup_checkpoints.trading_exp',
            'signup_checkpoints.is_politically_exposed',
            'signup_checkpoints.created_at as submitted_at',
            'user_name.first_name',
            'user_name.last_name',
            'user_name.full_name',
            'pan_number.pan',
            'aadhar_number.aadhar',
            'phone_number.phone'
          ])
          .where('signup_checkpoints.id', '=', checkpointId)
          .executeTakeFirst();

        if (!checkpoint) {
          return res.status(404).render('error', {
            message: 'Checkpoint not found'
          });
        }

        // Get PAN verification details
        const panVerification = checkpoint.pan
          ? await db
              .selectFrom('pan_verification_details')
              .innerJoin('pan_number', 'pan_number.id', 'pan_verification_details.pan_id')
              .select([
                'pan_verification_details.id',
                'pan_verification_details.pan_id',
                'pan_number.pan',
                'pan_verification_details.name_as_per_pan',
                'pan_verification_details.verification_method',
                'pan_verification_details.verification_status',
                'pan_verification_details.verification_timestamp',
                'pan_verification_details.created_at',
                'pan_verification_details.updated_at'
              ])
              .where('pan_number.pan', '=', checkpoint.pan)
              .executeTakeFirst()
          : undefined;

        // Get Aadhaar verification details
        const aadhaarVerification = checkpoint.aadhar
          ? await db
              .selectFrom('aadhaar_verification_details')
              .innerJoin('aadhar_number', 'aadhar_number.id', 'aadhaar_verification_details.aadhar_id')
              .select([
                'aadhaar_verification_details.id',
                'aadhaar_verification_details.aadhar_id',
                'aadhar_number.aadhar',
                'aadhaar_verification_details.name_as_per_aadhaar',
                'aadhaar_verification_details.address',
                'aadhaar_verification_details.gender',
                'aadhaar_verification_details.verification_method',
                'aadhaar_verification_details.verification_status',
                'aadhaar_verification_details.verification_timestamp',
                'aadhaar_verification_details.created_at',
                'aadhaar_verification_details.updated_at'
              ])
              .where('aadhar_number.aadhar', '=', checkpoint.aadhar)
              .executeTakeFirst()
          : undefined;

        // Get bank account details
        const bankAccounts = await db
          .selectFrom('bank_to_checkpoint')
          .innerJoin('bank_account', 'bank_account.id', 'bank_to_checkpoint.bank_account_id')
          .select([
            'bank_account.id as bank_id',
            'bank_account.account_no',
            'bank_account.micr_code',
            'bank_account.ifsc_code',
            'bank_account.account_holder_name',
            'bank_account.bank_name',
            'bank_account.verification_status',
            'bank_to_checkpoint.is_primary'
          ])
          .where('bank_to_checkpoint.checkpoint_id', '=', checkpointId)
          .execute();

        // Get bank validation details
        const bankValidations = await Promise.all(
          bankAccounts.map(async (account) => {
            const validation = await db
              .selectFrom('bank_validation_details')
              .select([
                'id',
                'bank_account_id',
                'validation_method',
                'validation_status',
                'validation_timestamp',
                'remarks',
                'created_at',
                'updated_at'
              ])
              .where('bank_account_id', '=', account.bank_id)
              .executeTakeFirst();

            return {
              ...account,
              validation
            };
          })
        );

        // Get nominee information
        const nominees = await db
          .selectFrom('nominees_to_checkpoint')
          .innerJoin('nominees', 'nominees.id', 'nominees_to_checkpoint.nominees_id')
          .innerJoin('user_name', 'user_name.id', 'nominees.name')
          .select([
            'nominees.id as nominee_id',
            'user_name.first_name',
            'user_name.last_name',
            'user_name.full_name',
            'nominees.relationship',
            'nominees.share'
          ])
          .where('nominees_to_checkpoint.checkpoint_id', '=', checkpointId)
          .execute();

        // Get previous verification history
        const verificationHistory = await db
          .selectFrom('compliance_history')
          .leftJoin('compliance_officers', 'compliance_officers.id', 'compliance_history.officer_id')
          .select([
            'compliance_history.id',
            'compliance_history.checkpoint_id',
            'compliance_history.action',
            'compliance_history.status',
            'compliance_history.notes',
            'compliance_history.reason',
            'compliance_history.created_at',
            'compliance_officers.name as officer_name'
          ])
          .where('compliance_history.checkpoint_id', '=', checkpointId)
          .orderBy('compliance_history.created_at', 'desc')
          .execute();

        res.render('compliance/verification', {
          checkpoint,
          panVerification,
          aadhaarVerification,
          bankAccounts: bankValidations,
          nominees,
          verificationHistory,
          officer: req.session?.officer || { name: 'Test Officer', id: 1 }
        });
      } catch (error) {
        console.error('Error rendering verification details:', error);
        res.status(500).render('error', {
          message: 'Failed to load verification details',
          error
        });
      }
    },

    /**
     * Approve user verification
     */
    async approveVerification(req: RequestWithSession, res: Response): Promise<void> {
      try {
        console.log('Approve verification called with params:', req.params);
        console.log('Request body:', req.body);

        const checkpointId = Number(req.params.checkpointId);
        const { notes } = req.body;
        const officerId = req.session?.officer?.id || 1; // Default test officer ID

        await db.transaction().execute(async (trx) => {
          // Update checkpoint compliance status
          await trx
            .updateTable('signup_checkpoints')
            .set({
              compliance_status: 'approved' as ComplianceStatus,
              updated_at: new Date()
            })
            .where('id', '=', checkpointId)
            .execute();

          // Record verification in history
          await trx
            .insertInto('compliance_history')
            .values({
              checkpoint_id: checkpointId,
              officer_id: officerId,
              action: 'approval' as ComplianceAction,
              status: 'approved' as ComplianceStatus,
              notes: notes || 'Application approved',
              created_at: new Date()
            })
            .execute();
        });

        if (req.flash) {
          req.flash('success', 'Verification approved successfully');
        }
        res.redirect('/compliance/dashboard');
      } catch (error) {
        console.error('Error approving verification:', error);
        if (req.flash) {
          req.flash('error', `Failed to approve: ${(error as Error).message}`);
        }
        res.redirect(`/compliance/verification/${req.params.checkpointId}`);
      }
    },

    /**
     * Reject user verification
     */
    async rejectVerification(req: RequestWithSession, res: Response): Promise<void> {
      try {
        const checkpointId = Number(req.params.checkpointId);
        const { reason, notes } = req.body;
        const officerId = req.session?.officer?.id || 1; // Default test officer ID

        if (!reason) {
          if (req.flash) {
            req.flash('error', 'Rejection reason is required');
          }
          return res.redirect(`/compliance/verification/${req.params.checkpointId}`);
        }

        await db.transaction().execute(async (trx) => {
          // Update checkpoint compliance status
          await trx
            .updateTable('signup_checkpoints')
            .set({
              compliance_status: 'rejected' as ComplianceStatus,
              updated_at: new Date()
            })
            .where('id', '=', checkpointId)
            .execute();

          // Record verification in history
          await trx
            .insertInto('compliance_history')
            .values({
              checkpoint_id: checkpointId,
              officer_id: officerId,
              action: 'rejection' as ComplianceAction,
              status: 'rejected' as ComplianceStatus,
              reason: reason,
              notes: notes || 'Application rejected',
              created_at: new Date()
            })
            .execute();
        });

        if (req.flash) {
          req.flash('success', 'Verification rejected successfully');
        }
        res.redirect('/compliance/dashboard');
      } catch (error) {
        console.error('Error rejecting verification:', error);
        if (req.flash) {
          req.flash('error', `Failed to reject: ${(error as Error).message}`);
        }
        res.redirect(`/compliance/verification/${req.params.checkpointId}`);
      }
    },

    /**
     * View verification history
     */
    async viewHistory(req: RequestWithSession, res: Response): Promise<void> {
      try {
        const checkpointId = Number(req.params.checkpointId);

        // Get checkpoint basic info
        const checkpoint = await db
          .selectFrom('signup_checkpoints')
          .leftJoin('user_name', 'user_name.id', 'signup_checkpoints.name')
          .select([
            'signup_checkpoints.id',
            'signup_checkpoints.email',
            'user_name.full_name'
          ])
          .where('signup_checkpoints.id', '=', checkpointId)
          .executeTakeFirst();

        if (!checkpoint) {
          return res.status(404).render('error', {
            message: 'Checkpoint not found'
          });
        }

        // Get all history records
        const history = await db
          .selectFrom('compliance_history')
          .leftJoin('compliance_officers', 'compliance_officers.id', 'compliance_history.officer_id')
          .select([
            'compliance_history.id',
            'compliance_history.action',
            'compliance_history.status',
            'compliance_history.reason',
            'compliance_history.notes',
            'compliance_history.created_at',
            'compliance_officers.name as officer_name'
          ])
          .where('compliance_history.checkpoint_id', '=', checkpointId)
          .orderBy('compliance_history.created_at', 'desc')
          .execute();

        res.render('compliance/history', {
          checkpoint,
          history
        });
      } catch (error) {
        console.error('Error viewing history:', error);
        res.status(500).render('error', {
          message: 'Failed to load verification history',
          error
        });
      }
    }
  };

  export default complianceController;