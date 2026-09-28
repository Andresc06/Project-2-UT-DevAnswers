import express from 'express';
import authenticate from '../middleware/authHandler.js';
import { updateAnswer, deleteAnswer, upvoteAnswer, downvoteAnswer } from '../controllers/answerController.js';

const router = express.Router();

router.put('/:answerId', authenticate, updateAnswer);
router.delete('/:answerId', authenticate, deleteAnswer);
router.post('/:answerId/upvote', authenticate, upvoteAnswer);
router.post('/:answerId/downvote', authenticate, downvoteAnswer);

export default router;

