import { Router } from 'express';
import { DeliveryContentController } from '../controllers/delivery-content.controller';

const router = Router();

router.get('/', DeliveryContentController.testConnection);

export default router;
