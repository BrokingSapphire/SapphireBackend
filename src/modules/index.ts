import { Router } from 'express';
import signupRouter from './signup';
import loginRouter from './login';
import fundsRouter from './funds';
import fcmRouter from './firebaseCloudMessaging';
import webhookRouter from './webhooks';
import { db } from '@app/database';
import { OK } from '@app/utils/httpstatus';
import redisClient from '@app/services/redis.service';
import complianceRouter from './compliance';
import watchlistRouter from './watchlist';
import { jwtMiddleware } from '@app/utils/jwt';
import { sql } from 'kysely';
import { testPDFGeneration, testPDFGenerationFromDB } from '@app/services/pdf-generator';

const router = Router();

router.use('/auth/signup', signupRouter);
router.use('/auth/login', loginRouter);
router.use('/compliance', complianceRouter);
router.use('/fcm', fcmRouter);
router.use('/funds', jwtMiddleware, fundsRouter);
router.use('/watchlist', jwtMiddleware, watchlistRouter);
router.use('/webhook', webhookRouter);

router.get('/healthcheck', async (_req, res) => {
    await sql`SELECT 1;`.execute(db);
    await redisClient.ping();
    res.status(OK).json({ status: 'ok' });
});

// router.get('/test-pdf', async (_req, res) => {
//     try {
//         const result = await testPDFGeneration();

//         if (result.success) {
//             res.status(OK).json({
//                 success: true,
//                 message: 'PDF generated successfully! 🎉',
//                 data: {
//                     fileName: result.fileName,
//                     filePath: result.filePath,
//                     pages: result.pages,
//                     fieldsTotal: result.fieldsTotal,
//                     fieldsFilled: result.fieldsFilled,
//                     completionPercentage: result.fieldsTotal && result.fieldsFilled
//                         ? Math.round((result.fieldsFilled / result.fieldsTotal) * 100)
//                         : 0
//                 }
//             });
//         } else {
//             res.status(500).json({
//                 success: false,
//                 message: 'PDF generation failed',
//                 error: result.error
//             });
//         }
//     } catch (error: any) {
//         res.status(500).json({
//             success: false,
//             message: 'Test execution failed',
//             error: error.message
//         });
//     }
// });

// In your router file
router.get('/test-pdf/:email?', async (req, res) => {
    try {
        const email = req.params.email;

        let result;
        if (email) {
            // Test with real database data
            result = await testPDFGenerationFromDB(email);
        } else {
            // Test with hardcoded data
            result = await testPDFGeneration();
        }

        if (result.success) {
            res.status(OK).json({
                success: true,
                message: `PDF generated successfully! 🎉 ${email ? '(from database)' : '(hardcoded data)'}`,
                data: {
                    fileName: result.fileName,
                    filePath: result.filePath,
                    pages: result.pages,
                    fieldsTotal: result.fieldsTotal,
                    fieldsFilled: result.fieldsFilled,
                    completionPercentage:
                        result.fieldsTotal && result.fieldsFilled
                            ? Math.round((result.fieldsFilled / result.fieldsTotal) * 100)
                            : 0,
                },
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'PDF generation failed',
                error: result.error,
            });
        }
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Test execution failed',
            error: error.message,
        });
    }
});

export default router;
