import Answer from '../models/Answer.js';
import { createAppError } from '../utils/createAppError.js';
import { handleVote } from './voteService.js';


export const getAnswersByQuestionIdService = async (questionId) => {
    const answers = await Answer.find({ questionId }).populate('author', 'name');
    if (!answers || answers.length === 0) {
        throw createAppError('No answers found for this question', 404);
    }
    return answers;
}

export const createAnswerService = async (questionId, answerText, author) => {
    const answer = await Answer.create({ questionId, answerText, author });
    await answer.populate('author', 'name');
    return answer;
}

export const updateAnswerService = async (answerId, answerText, loggedInUser) => {
    const answer = await Answer.findById(answerId);

    if (!answer) {
        throw createAppError('Answer not found', 404);
    }
    if (!answer.author.equals(loggedInUser.id ?? loggedInUser._id) && !loggedInUser.isAdmin) {
        throw createAppError('You are not authorized to update this answer', 403);
    }
    answer.answerText = answerText;

    await answer.save();
    await answer.populate('author', 'name');
    return answer;
}

export const deleteAnswerService = async (answerId, loggedInUser) => {
    const answer = await Answer.findById(answerId);
    if (!answer) {
        throw createAppError('Answer not found', 404);
    }
    if (!answer.author.equals(loggedInUser.id ?? loggedInUser._id) && !loggedInUser.isAdmin) {
        throw createAppError('You are not authorized to delete this answer', 403);
    }
    await answer.deleteOne();
    return answer;
}

export const upvoteAnswerService = async (answerId, userId) => {
    const answer = await handleVote(Answer, answerId, userId, 'upvote');
    if (!answer) {
        throw createAppError('Failed to upvote the answer', 400);
    }
    return answer;
}

export const downvoteAnswerService = async (answerId, userId) => {
    const answer = await handleVote(Answer, answerId, userId, 'downvote');
    if (!answer) {
        throw createAppError('Failed to downvote the answer', 400);
    }
    return answer;
}