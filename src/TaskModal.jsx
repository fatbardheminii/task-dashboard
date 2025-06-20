import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "./TaskModal.css";

function TaskModal({ task, onClose }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");

  const fetchComments = useCallback(async () => {
    try {
      const response = await axios.get(
        `http://localhost:3001/tasks/${task.id}/comments`
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
      await axios.post("http://localhost:3001/comments", {
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
      await axios.delete(`http://localhost:3001/comments/${commentId}`);
      fetchComments();
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  const handleDeleteTask = async () => {
    try {
      await axios.delete(`http://localhost:3001/tasks/${task.id}`);
      onClose(); // Close modal after deletion
      window.location.reload(); // Refresh page to update task list
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-button" onClick={onClose}>
          X
        </button>
        <button className="trash-icon" onClick={handleDeleteTask}>
          🗑️
        </button>
        <h2>{task.title}</h2>
        {task.image && (
          <img src={task.image} alt={task.title} style={{ maxWidth: "100%" }} />
        )}
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
                <button onClick={() => handleDeleteComment(comment.id)}>
                  Delete
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
  );
}

export default TaskModal;
