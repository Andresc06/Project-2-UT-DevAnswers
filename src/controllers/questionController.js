import * as questionService from "../services/questionService.js";

export const getAllQuestions = async (req, res) => {
    const questions = await questionService.getAllQuestionsService();

    res.status(200).json({
        success: true,
        message: "Questions retrieved successfully",
        data: questions
    });
}

export const getQuestionById = async (req, res) => {
    const { id } = req.params;

    const question = await questionService.getQuestionByIdService(id);

    res.status(200).json({
        success: true,
        message: "Question retrieved successfully",
        data: question
    });
}

export const createQuestion = async (req, res) => {
    const { title, description, tags } = req.body;
    const author = req.user.id;
    const newQuestion = await questionService.createQuestionService(title, description, tags, author);

    res.status(201).json({
        success: true,
        message: "Question created successfully",
        data: newQuestion
    }); 
}

export const updateQuestion = async (req, res) => {
    const { id } = req.params;
    const { title, description, tags } = req.body;
    const updatedQuestion = await questionService.updateQuestionService(id, title, description, tags, req.user);

    res.status(200).json({
        success: true,
        message: "Question updated successfully",
        data: updatedQuestion
    });
}

export const deleteQuestion = async (req, res) => {
    const { id } = req.params;
    const deletedQuestion = await questionService.deleteQuestionService(id, req.user);

    res.status(200).json({
        success: true,
        message: "Question deleted successfully",
        data: deletedQuestion
    });
}

export const upvoteQuestion = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const upvotedQuestion = await questionService.upvoteQuestionService(id, userId);

    res.status(200).json({
        success: true,
        message: "Question upvoted successfully",
        data: upvotedQuestion
    }); 
}

export const downvoteQuestion = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const downvotedQuestion = await questionService.downvoteQuestionService(id, userId);

    res.status(200).json({
        success: true,
        message: "Question downvoted successfully",
        data: downvotedQuestion
    }); 
}
