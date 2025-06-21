import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "./TaskModal.css";
import { FaTrashAlt, FaTimes } from "react-icons/fa";

function TaskModal({ task, onClose }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");

  const fetchComments = useCallback(async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/tasks/${task.id}/comments`
      );
      setComments(response.data);
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  }, [task.id]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleCommentSubmit = async () => {
    if (!newComment.trim()) return;
    try {
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/comments`, {
        task_id: task.id,
        content: newComment,
      });
      setNewComment("");
      fetchComments();
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await axios.delete(
        `${import.meta.env.VITE_BACKEND_URL}/comments/${commentId}`
      );
      fetchComments();
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  const handleDeleteTask = async () => {
    try {
      await axios.delete(
        `${import.meta.env.VITE_BACKEND_URL}/tasks/${task.id}`
      );
      onClose();
      window.location.reload();
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content task-modal">
        <button className="close-button" onClick={onClose}>
          <FaTimes />
        </button>
        <button className="trash-icon" onClick={handleDeleteTask}>
          <FaTrashAlt />
        </button>
        <div className="task-details">
          <h2>{task.title}</h2>
          {task.image && <img src={task.image} alt={task.title} />}
          <p>
            <strong>Description:</strong> {task.description}
          </p>
          <p>
            <strong>Location:</strong> {task.location}
          </p>
          <div className="comment-section">
            <h3>Comments</h3>
            <div className="comments-list">
              {comments.map((comment) => (
                <div key={comment.id} className="comment">
                  <p>{comment.content}</p>
                  <button
                    className="comment-delete"
                    onClick={() => handleDeleteComment(comment.id)}
                  >
                    <FaTrashAlt />
                  </button>
                </div>
              ))}
            </div>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
            />
            <button onClick={handleCommentSubmit}>Submit Comment</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaskModal;
