import { Router } from 'express';
import { checkS3, putS3TestObject, deleteS3Object, listS3Objects } from './storage.controller';

const router = Router();

// S3 connectivity routes
router.get('/s3', checkS3);
router.get('/s3/files', listS3Objects);
router.patch('/s3', putS3TestObject);
router.delete('/s3', deleteS3Object);

export default router;
