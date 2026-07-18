import { Router } from 'express';
import {
	checkS3,
	putS3TestObject,
	deleteS3Object,
	listS3Objects,
	generateUploadUrl,
	generateGetUrl
} from './storage.controller';
import { authenticate } from '../../services/authentication/middleware/express/authentication.middleware';
import {
	completeStorageDemoUpload,
	createStorageDemoUploadIntent,
	deleteStorageDemoAsset,
	listStorageDemoPresets,
	resolveStorageDemoUrls,
} from './storage-demo.controller';

const router = Router();

// S3 connectivity routes
router.get('/s3', checkS3);
router.get('/s3/files', listS3Objects);
router.patch('/s3', putS3TestObject);
router.delete('/s3', deleteS3Object);

// Presigned URL generation (protected)
router.post('/upload-url', authenticate, generateUploadUrl);
router.get('/get-url', authenticate, generateGetUrl);

// Intent-based StorageService demonstration APIs (authenticated and user-isolated).
router.get('/demo/presets', authenticate, listStorageDemoPresets);
router.post('/demo/upload-intents', authenticate, createStorageDemoUploadIntent);
router.post('/demo/upload-intents/:uploadId/complete', authenticate, completeStorageDemoUpload);
router.get('/demo/assets', authenticate, resolveStorageDemoUrls);
router.delete('/demo/assets/:assetId', authenticate, deleteStorageDemoAsset);

export default router;
