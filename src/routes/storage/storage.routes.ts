import { Router } from 'express';
import {
	checkS3,
	putS3TestObject,
	deleteS3Object,
	listS3Objects,
	generateUploadUrl,
	generateGetUrl
} from './storage.controller';
import { authenticate } from '../../middlewares/authentication.middleware';

const router = Router();

// S3 connectivity routes
router.get('/s3', checkS3);
router.get('/s3/files', listS3Objects);
router.patch('/s3', putS3TestObject);
router.delete('/s3', deleteS3Object);

// Presigned URL generation (protected)
router.post('/upload-url', authenticate, generateUploadUrl);
router.get('/get-url', authenticate, generateGetUrl);

export default router;
