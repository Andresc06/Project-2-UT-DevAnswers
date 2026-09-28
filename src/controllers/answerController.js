import * as answerService from "../services/answerService.js";

export const getAnswersByQuestionId = async (req, res) => {
    const { questionId } = req.params;

    const answers = await answerService.getAnswersByQuestionIdService(questionId);

    res.status(200).json({
        success: true,
        message: "Answers retrieved successfully",
        data: answers
    });
}

export const createAnswer = async (req, res) => {
    const { answerText } = req.body;
    const author = req.user.id;
    const { questionId } = req.params;
    const newAnswer = await answerService.createAnswerService(questionId, answerText, author);

    res.status(201).json({
        success: true,
        message: "Answer created successfully",
        data: newAnswer
    }); 
}

export const updateAnswer = async (req, res) => {
    const { answerId } = req.params;
    const { answerText } = req.body;
    const updatedAnswer = await answerService.updateAnswerService(answerId, answerText, req.user);

    res.status(200).json({
        success: true,
        message: "Answer updated successfully",
        data: updatedAnswer
    });
}

export const deleteAnswer = async (req, res) => {
    const { answerId } = req.params;
    await answerService.deleteAnswerService(answerId, req.user);

    res.status(200).json({
        success: true,
        message: "Answer deleted successfully"
    });
}

export const upvoteAnswer = async (req, res) => {
    const { answerId } = req.params;
    const userId = req.user.id;
    const upvotedAnswer = await answerService.upvoteAnswerService(answerId, userId);

    res.status(200).json({
        success: true,
        message: "Answer upvoted successfully",
        data: upvotedAnswer
    }); 
}

export const downvoteAnswer = async (req, res) => {
    const { answerId } = req.params;
    const userId = req.user.id;
    const downvotedAnswer = await answerService.downvoteAnswerService(answerId, userId);

    res.status(200).json({
        success: true,
        message: "Answer downvoted successfully",
        data: downvotedAnswer
    }); 
}
