
import Question from '../models/Question.js';
import Answer from '../models/Answer.js';
import Tag from '../models/Tag.js';
import { createAppError } from '../utils/createAppError.js';
import { handleVote } from './voteService.js';

export const getAllQuestionsService = async () => {
    const questions = await Question.find().populate('author', 'name').populate('tags', 'name');

    if (!questions || questions.length === 0) {
        throw createAppError('No questions found', 404);
    }

    for (const question of questions) {
        question.answerCount = await Answer.countDocuments({ questionId: question._id });
    }

    return questions;

}

export const getQuestionByIdService = async (id) => {
    const question = await Question.findById(id)
    if (!question) {
        throw createAppError('Question not found', 404);
    }
    question.views += 1;
    await question.save();

    await question.populate('author', 'name');
    await question.populate('tags', 'name');

    const answers = await Answer.find({ questionId: question._id }).populate('author', 'name');
    question.answers = answers;

    return question;
}

export const createQuestionService = async (title, description, tags, author) => {
    const tagNames = tags.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean);

    const tagIds = await Promise.all(
        tagNames.map(async (name) => {
            const tag = await Tag.findOneAndUpdate(
                { name },
                { $setOnInsert: { name } },
                { upsert: true, new: true }
            );
            return tag._id;
        })
    );

    const question = await Question.create({ title, description, tags: tagIds, author });

    await question.populate('author', 'name');
    await question.populate('tags', 'name');

    return question;
}

export const updateQuestionService = async (id, title, description, tags, loggedInUser) => {
    const question = await Question.findById(id);

    if (!question) {
        throw createAppError('Question not found', 404);
    }
    if (!question.author.equals(loggedInUser.id ?? loggedInUser._id) && !loggedInUser.isAdmin) {
        throw createAppError('You are not authorized to update this question', 403);
    }
    const tagNames = tags.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean);

    const tagIds = await Promise.all(
        tagNames.map(async (name) => {
            const tag = await Tag.findOneAndUpdate(
                { name },
                { $setOnInsert: { name } },
                { upsert: true, new: true }
            );
            return tag._id;
        })
    );

    question.title = title;
    question.description = description;
    question.tags = tagIds;
    await question.save();

    await question.populate('author', 'name');
    await question.populate('tags', 'name');

    return question;
}

export const deleteQuestionService = async (id, loggedInUser) => {
    const question = await Question.findById(id);
    if (!question) {
        throw createAppError('Question not found', 404);
    }
    if (!question.author.equals(loggedInUser.id ?? loggedInUser._id) && !loggedInUser.isAdmin) {
        throw createAppError('You are not authorized to delete this question', 403);
    }
    await Answer.deleteMany({ questionId: question._id });
    await question.deleteOne();
    return question;
}

export const upvoteQuestionService = async (questionId, userId) => {
    const question = await handleVote(Question, questionId, userId, 'upvote');
    if (!question) {
        throw createAppError('Failed to upvote question', 400);
    }
    return question;
}

export const downvoteQuestionService = async (questionId, userId) => {
    const question = await handleVote(Question, questionId, userId, 'downvote');
    if (!question) {
        throw createAppError('Failed to downvote question', 400);
    }
    return question;
}