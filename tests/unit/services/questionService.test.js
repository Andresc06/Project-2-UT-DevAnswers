import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import '../../setup.js';
import User from '../../../src/models/User.js';
import Question from '../../../src/models/Question.js';
import Answer from '../../../src/models/Answer.js';
import Tag from '../../../src/models/Tag.js';
import {
    getAllQuestionsService,
    getQuestionByIdService,
    createQuestionService,
    updateQuestionService,
    deleteQuestionService,
    upvoteQuestionService,
    downvoteQuestionService,
} from '../../../src/services/questionService.js';

let userCounter = 0;

async function createUser(overrides = {}) {
    userCounter += 1;
    return User.create({
        name: `Test User ${userCounter}`,
        email: `user-${userCounter}-${Date.now()}@example.com`,
        password: 'hashed-password',
        ...overrides,
    });
}

async function createQuestionDoc(author, overrides = {}) {
    return Question.create({
        title: 'Sample question',
        description: 'Sample description',
        author: author._id,
        ...overrides,
    });
}

beforeEach(async () => {
    await Promise.all([
        Question.deleteMany({}),
        Answer.deleteMany({}),
        Tag.deleteMany({}),
        User.deleteMany({}),
    ]);
});

describe('questionService', () => {
    describe('getAllQuestionsService', () => {
        it('returns all questions with populated author, tags, and answerCount', async () => {
            const author = await createUser();
            const tag = await Tag.create({ name: 'javascript' });
            const question = await createQuestionDoc(author, { tags: [tag._id] });
            await Answer.create({ questionId: question._id, answerText: 'a1', author: author._id });
            await Answer.create({ questionId: question._id, answerText: 'a2', author: author._id });

            const questions = await getAllQuestionsService();

            expect(questions).toHaveLength(1);
            expect(questions[0].author.name).toBe(author.name);
            expect(questions[0].tags[0].name).toBe('javascript');
            expect(questions[0].answerCount).toBe(2);
        });

        it('throws a 404 AppError when there are no questions', async () => {
            await expect(getAllQuestionsService()).rejects.toMatchObject({ statusCode: 404 });
        });

        it('returns an answerCount of 0 for a question with no answers', async () => {
            const author = await createUser();
            await createQuestionDoc(author);

            const questions = await getAllQuestionsService();

            expect(questions[0].answerCount).toBe(0);
        });
    });

    describe('getQuestionByIdService', () => {
        it('returns the question with populated author/tags and attached answers, incrementing views', async () => {
            const author = await createUser();
            const tag = await Tag.create({ name: 'nodejs' });
            const question = await createQuestionDoc(author, { tags: [tag._id], views: 5 });
            await Answer.create({ questionId: question._id, answerText: 'a1', author: author._id });

            const result = await getQuestionByIdService(question._id.toString());

            expect(result.views).toBe(6);
            expect(result.author.name).toBe(author.name);
            expect(result.tags[0].name).toBe('nodejs');
            expect(result.answers).toHaveLength(1);
        });

        it('throws a 404 AppError for a non-existent question id', async () => {
            const missingId = new mongoose.Types.ObjectId().toString();

            await expect(getQuestionByIdService(missingId)).rejects.toMatchObject({ statusCode: 404 });
        });

        it('increments views by 1 on every call', async () => {
            const author = await createUser();
            const question = await createQuestionDoc(author);

            await getQuestionByIdService(question._id.toString());
            const result = await getQuestionByIdService(question._id.toString());

            expect(result.views).toBe(2);
        });
    });

    describe('createQuestionService', () => {
        it('creates a question and resolves comma-separated tags to existing/new tags', async () => {
            const author = await createUser();
            await Tag.create({ name: 'javascript' });

            const question = await createQuestionService('Title', 'Description', 'javascript, nodejs', author._id);

            expect(question.title).toBe('Title');
            expect(question.author.name).toBe(author.name);
            expect(question.tags.map((t) => t.name).sort()).toEqual(['javascript', 'nodejs']);
            expect(await Tag.countDocuments({})).toBe(2);
        });

        it('trims and lowercases tag names before resolving them', async () => {
            const author = await createUser();

            const question = await createQuestionService('Title', 'Description', ' JavaScript ,  NodeJS ', author._id);

            expect(question.tags.map((t) => t.name).sort()).toEqual(['javascript', 'nodejs']);
        });

        it('reuses an existing tag instead of creating a duplicate', async () => {
            const author = await createUser();
            const existingTag = await Tag.create({ name: 'javascript' });

            const question = await createQuestionService('Title', 'Description', 'javascript', author._id);

            expect(question.tags[0]._id.toString()).toBe(existingTag._id.toString());
            expect(await Tag.countDocuments({ name: 'javascript' })).toBe(1);
        });
    });

    describe('updateQuestionService', () => {
        it('updates title, description, and tags when the requester is the owner', async () => {
            const author = await createUser();
            const question = await createQuestionDoc(author);

            const updated = await updateQuestionService(
                question._id.toString(),
                'New title',
                'New description',
                'react',
                { id: author._id.toString(), isAdmin: false }
            );

            expect(updated.title).toBe('New title');
            expect(updated.tags[0].name).toBe('react');
        });

        it('allows an admin to update a question they do not own', async () => {
            const author = await createUser();
            const admin = await createUser({ isAdmin: true });
            const question = await createQuestionDoc(author);

            const updated = await updateQuestionService(
                question._id.toString(),
                'Admin edited title',
                'Admin edited description',
                'vue',
                { id: admin._id.toString(), isAdmin: true }
            );

            expect(updated.title).toBe('Admin edited title');
        });

        it('throws a 403 AppError when a non-owner, non-admin tries to update', async () => {
            const author = await createUser();
            const otherUser = await createUser();
            const question = await createQuestionDoc(author);

            await expect(
                updateQuestionService(question._id.toString(), 'x', 'y', 'z', { id: otherUser._id.toString(), isAdmin: false })
            ).rejects.toMatchObject({ statusCode: 403 });
        });

        it('throws a 404 AppError when the question does not exist', async () => {
            const author = await createUser();
            const missingId = new mongoose.Types.ObjectId().toString();

            await expect(
                updateQuestionService(missingId, 'x', 'y', 'z', { id: author._id.toString(), isAdmin: false })
            ).rejects.toMatchObject({ statusCode: 404 });
        });
    });

    describe('deleteQuestionService', () => {
        it('deletes the question and its answers when the requester is the owner', async () => {
            const author = await createUser();
            const question = await createQuestionDoc(author);
            await Answer.create({ questionId: question._id, answerText: 'a1', author: author._id });

            await deleteQuestionService(question._id.toString(), { id: author._id.toString(), isAdmin: false });

            expect(await Question.findById(question._id)).toBeNull();
            expect(await Answer.countDocuments({ questionId: question._id })).toBe(0);
        });

        it('allows an admin to delete a question they do not own', async () => {
            const author = await createUser();
            const admin = await createUser({ isAdmin: true });
            const question = await createQuestionDoc(author);

            await deleteQuestionService(question._id.toString(), { id: admin._id.toString(), isAdmin: true });

            expect(await Question.findById(question._id)).toBeNull();
        });

        it('throws a 403 AppError when a non-owner, non-admin tries to delete', async () => {
            const author = await createUser();
            const otherUser = await createUser();
            const question = await createQuestionDoc(author);

            await expect(
                deleteQuestionService(question._id.toString(), { id: otherUser._id.toString(), isAdmin: false })
            ).rejects.toMatchObject({ statusCode: 403 });
        });

        it('throws a 404 AppError when the question does not exist', async () => {
            const author = await createUser();
            const missingId = new mongoose.Types.ObjectId().toString();

            await expect(
                deleteQuestionService(missingId, { id: author._id.toString(), isAdmin: false })
            ).rejects.toMatchObject({ statusCode: 404 });
        });
    });

    describe('upvoteQuestionService', () => {
        it('upvotes a question and sets voteCount to 1', async () => {
            const author = await createUser();
            const voter = await createUser();
            const question = await createQuestionDoc(author);

            const result = await upvoteQuestionService(question._id.toString(), voter._id.toString());

            expect(result.voteCount).toBe(1);
            expect(result.upvotes.map(String)).toContain(voter._id.toString());
        });

        it('does not double count when the same user upvotes twice', async () => {
            const author = await createUser();
            const voter = await createUser();
            const question = await createQuestionDoc(author);

            await upvoteQuestionService(question._id.toString(), voter._id.toString());
            const result = await upvoteQuestionService(question._id.toString(), voter._id.toString());

            expect(result.voteCount).toBe(1);
        });

        // NOTE: handleVote() throws a plain Error("Document not found") before
        // upvoteQuestionService's own `if (!question)` 400 check can run, so the
        // documented 400 AppError is unreachable for a missing question. This
        // test documents the actual behavior rather than the intended one.
        it('rejects with the underlying "Document not found" error for a missing question, without a 400 statusCode', async () => {
            const voter = await createUser();
            const missingId = new mongoose.Types.ObjectId().toString();

            await expect(upvoteQuestionService(missingId, voter._id.toString())).rejects.toThrow('Document not found');
        });
    });

    describe('downvoteQuestionService', () => {
        it('downvotes a question and sets voteCount to -1', async () => {
            const author = await createUser();
            const voter = await createUser();
            const question = await createQuestionDoc(author);

            const result = await downvoteQuestionService(question._id.toString(), voter._id.toString());

            expect(result.voteCount).toBe(-1);
            expect(result.downvotes.map(String)).toContain(voter._id.toString());
        });

        it('switches an existing upvote to a downvote', async () => {
            const author = await createUser();
            const voter = await createUser();
            const question = await createQuestionDoc(author);

            await upvoteQuestionService(question._id.toString(), voter._id.toString());
            const result = await downvoteQuestionService(question._id.toString(), voter._id.toString());

            expect(result.voteCount).toBe(-1);
            expect(result.upvotes).toHaveLength(0);
        });

        // Same underlying handleVote() behavior as upvoteQuestionService above.
        it('rejects with the underlying "Document not found" error for a missing question, without a 400 statusCode', async () => {
            const voter = await createUser();
            const missingId = new mongoose.Types.ObjectId().toString();

            await expect(downvoteQuestionService(missingId, voter._id.toString())).rejects.toThrow('Document not found');
        });
    });
});
