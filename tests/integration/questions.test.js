import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import '../setup.js';
import app from '../../src/app.js';
import User from '../../src/models/User.js';
import Question from '../../src/models/Question.js';
import Answer from '../../src/models/Answer.js';
import Tag from '../../src/models/Tag.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

let author;
let otherUser;
let admin;
let authorToken;
let otherUserToken;
let adminToken;

function signToken(user) {
    return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function createQuestionDoc(overrides = {}) {
    return Question.create({
        title: 'Sample question',
        description: 'Sample description',
        author: author._id,
        ...overrides,
    });
}

beforeAll(async () => {
    author = await User.create({ name: 'Author', email: 'author@example.com', password: 'hashed-password' });
    otherUser = await User.create({ name: 'Other User', email: 'other@example.com', password: 'hashed-password' });
    admin = await User.create({ name: 'Admin', email: 'admin@example.com', password: 'hashed-password', isAdmin: true });

    authorToken = signToken(author);
    otherUserToken = signToken(otherUser);
    adminToken = signToken(admin);
});

beforeEach(async () => {
    await Promise.all([Question.deleteMany({}), Answer.deleteMany({}), Tag.deleteMany({})]);
});

describe('Questions API', () => {
    describe('GET /api/questions', () => {
        it('returns 200 with all questions and their answer counts', async () => {
            const question = await createQuestionDoc();
            await Answer.create({ questionId: question._id, answerText: 'a1', author: author._id });

            const res = await request(app).get('/api/questions');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0].answerCount).toBe(1);
        });

        it('returns 404 when there are no questions', async () => {
            const res = await request(app).get('/api/questions');

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });

        it('includes the populated author name for each question', async () => {
            await createQuestionDoc();

            const res = await request(app).get('/api/questions');

            expect(res.body.data[0].author.name).toBe(author.name);
        });
    });

    describe('GET /api/questions/:id', () => {
        it('returns 200 with the question and increments views', async () => {
            const question = await createQuestionDoc({ views: 0 });

            const res = await request(app).get(`/api/questions/${question._id}`);

            expect(res.status).toBe(200);
            expect(res.body.data.views).toBe(1);
        });

        it('returns 404 for a non-existent question id', async () => {
            const missingId = new mongoose.Types.ObjectId().toString();

            const res = await request(app).get(`/api/questions/${missingId}`);

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });

        it('includes the question answers in the response', async () => {
            const question = await createQuestionDoc();
            await Answer.create({ questionId: question._id, answerText: 'a1', author: author._id });

            const res = await request(app).get(`/api/questions/${question._id}`);

            expect(res.body.data.answers).toHaveLength(1);
        });
    });

    describe('POST /api/questions', () => {
        it('returns 201 and creates the question when authenticated', async () => {
            const res = await request(app)
                .post('/api/questions')
                .set('Authorization', `Bearer ${authorToken}`)
                .send({ title: 'New question', description: 'New description', tags: 'javascript,nodejs' });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.title).toBe('New question');
            expect(res.body.data.tags.map((t) => t.name).sort()).toEqual(['javascript', 'nodejs']);
        });

        it('returns 401 when no token is provided', async () => {
            const res = await request(app)
                .post('/api/questions')
                .send({ title: 'New question', description: 'New description', tags: 'javascript' });

            expect(res.status).toBe(401);
        });

        it('reuses an existing tag instead of creating a duplicate', async () => {
            await Tag.create({ name: 'javascript' });

            await request(app)
                .post('/api/questions')
                .set('Authorization', `Bearer ${authorToken}`)
                .send({ title: 'New question', description: 'New description', tags: 'javascript' });

            expect(await Tag.countDocuments({ name: 'javascript' })).toBe(1);
        });
    });

    describe('PUT /api/questions/:id', () => {
        it('returns 200 and updates the question when the requester is the owner', async () => {
            const question = await createQuestionDoc();

            const res = await request(app)
                .put(`/api/questions/${question._id}`)
                .set('Authorization', `Bearer ${authorToken}`)
                .send({ title: 'Updated title', description: 'Updated description', tags: 'react' });

            expect(res.status).toBe(200);
            expect(res.body.data.title).toBe('Updated title');
        });

        it('returns 403 when a non-owner, non-admin tries to update', async () => {
            const question = await createQuestionDoc();

            const res = await request(app)
                .put(`/api/questions/${question._id}`)
                .set('Authorization', `Bearer ${otherUserToken}`)
                .send({ title: 'Hacked', description: 'Hacked', tags: 'x' });

            expect(res.status).toBe(403);
        });

        it('returns 404 when the question does not exist', async () => {
            const missingId = new mongoose.Types.ObjectId().toString();

            const res = await request(app)
                .put(`/api/questions/${missingId}`)
                .set('Authorization', `Bearer ${authorToken}`)
                .send({ title: 'x', description: 'y', tags: 'z' });

            expect(res.status).toBe(404);
        });
    });

    describe('DELETE /api/questions/:id', () => {
        it('returns 200 and deletes the question and its answers when the requester is the owner', async () => {
            const question = await createQuestionDoc();
            await Answer.create({ questionId: question._id, answerText: 'a1', author: author._id });

            const res = await request(app)
                .delete(`/api/questions/${question._id}`)
                .set('Authorization', `Bearer ${authorToken}`);

            expect(res.status).toBe(200);
            expect(await Question.findById(question._id)).toBeNull();
            expect(await Answer.countDocuments({ questionId: question._id })).toBe(0);
        });

        it('returns 403 when a non-owner, non-admin tries to delete', async () => {
            const question = await createQuestionDoc();

            const res = await request(app)
                .delete(`/api/questions/${question._id}`)
                .set('Authorization', `Bearer ${otherUserToken}`);

            expect(res.status).toBe(403);
        });

        it('allows an admin to delete a question they do not own', async () => {
            const question = await createQuestionDoc();

            const res = await request(app)
                .delete(`/api/questions/${question._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
        });
    });

    describe('POST /api/questions/:id/upvote', () => {
        it('returns 200 and increments voteCount', async () => {
            const question = await createQuestionDoc();

            const res = await request(app)
                .post(`/api/questions/${question._id}/upvote`)
                .set('Authorization', `Bearer ${otherUserToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.voteCount).toBe(1);
        });

        it('returns 401 when no token is provided', async () => {
            const question = await createQuestionDoc();

            const res = await request(app).post(`/api/questions/${question._id}/upvote`);

            expect(res.status).toBe(401);
        });

        it('does not change voteCount when the same user upvotes twice', async () => {
            const question = await createQuestionDoc();

            await request(app).post(`/api/questions/${question._id}/upvote`).set('Authorization', `Bearer ${otherUserToken}`);
            const res = await request(app).post(`/api/questions/${question._id}/upvote`).set('Authorization', `Bearer ${otherUserToken}`);

            expect(res.body.data.voteCount).toBe(1);
        });
    });

    describe('POST /api/questions/:id/downvote', () => {
        it('returns 200 and sets voteCount to -1', async () => {
            const question = await createQuestionDoc();

            const res = await request(app)
                .post(`/api/questions/${question._id}/downvote`)
                .set('Authorization', `Bearer ${otherUserToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.voteCount).toBe(-1);
        });

        it('returns 401 when no token is provided', async () => {
            const question = await createQuestionDoc();

            const res = await request(app).post(`/api/questions/${question._id}/downvote`);

            expect(res.status).toBe(401);
        });

        it('switches an existing upvote to a downvote', async () => {
            const question = await createQuestionDoc();

            await request(app).post(`/api/questions/${question._id}/upvote`).set('Authorization', `Bearer ${otherUserToken}`);
            const res = await request(app).post(`/api/questions/${question._id}/downvote`).set('Authorization', `Bearer ${otherUserToken}`);

            expect(res.body.data.voteCount).toBe(-1);
        });
    });

    describe('GET /api/questions/:questionId/answers', () => {
        it('returns 200 with all answers for the question', async () => {
            const question = await createQuestionDoc();
            await Answer.create({ questionId: question._id, answerText: 'a1', author: author._id });

            const res = await request(app).get(`/api/questions/${question._id}/answers`);

            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
        });

        it('returns 404 when the question has no answers', async () => {
            const question = await createQuestionDoc();

            const res = await request(app).get(`/api/questions/${question._id}/answers`);

            expect(res.status).toBe(404);
        });

        it('includes the populated author name for each answer', async () => {
            const question = await createQuestionDoc();
            await Answer.create({ questionId: question._id, answerText: 'a1', author: author._id });

            const res = await request(app).get(`/api/questions/${question._id}/answers`);

            expect(res.body.data[0].author.name).toBe(author.name);
        });
    });

    describe('POST /api/questions/:questionId/answers', () => {
        it('returns 201 and creates the answer when authenticated', async () => {
            const question = await createQuestionDoc();

            const res = await request(app)
                .post(`/api/questions/${question._id}/answers`)
                .set('Authorization', `Bearer ${authorToken}`)
                .send({ answerText: 'My answer' });

            expect(res.status).toBe(201);
            expect(res.body.data.answerText).toBe('My answer');
        });

        it('returns 401 when no token is provided', async () => {
            const question = await createQuestionDoc();

            const res = await request(app)
                .post(`/api/questions/${question._id}/answers`)
                .send({ answerText: 'My answer' });

            expect(res.status).toBe(401);
        });

        it('persists the answer referencing the correct question', async () => {
            const question = await createQuestionDoc();

            const res = await request(app)
                .post(`/api/questions/${question._id}/answers`)
                .set('Authorization', `Bearer ${authorToken}`)
                .send({ answerText: 'My answer' });

            const saved = await Answer.findById(res.body.data._id);
            expect(saved.questionId.toString()).toBe(question._id.toString());
        });
    });
});
