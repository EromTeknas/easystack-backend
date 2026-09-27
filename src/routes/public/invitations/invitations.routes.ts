import { Router } from "express";
import { getInvitationByToken } from "./invitations.controller";

const router = Router();

router.get("/:token", getInvitationByToken);

export default router;
