import { Router } from 'express';
import { DeliveryContentController } from '../controllers/delivery-content.controller';

const router = Router();

// GET /v1/content/:blueprintSlug - Fetch singleton content or collection list
router.get('/:blueprintSlug', DeliveryContentController.getContent);

// GET /v1/content/:blueprintSlug/:entrySlug - Fetch specific entry from collection
router.get('/:blueprintSlug/:entrySlug', DeliveryContentController.getEntry);

export default router;
