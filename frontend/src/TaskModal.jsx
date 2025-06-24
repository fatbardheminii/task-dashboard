import React, { useState, useEffect } from "react";
import axios from "axios";
import "./TaskModal.css";
import { FaTimes } from "react-icons/fa";

function TaskModal({ task, onClose }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/tasks/${task.id}/comments`
        );
        setComments(response.data);
      } catch (err) {
        console.log(err);
      }
    };
    fetchComments();
  }, [task.id]);

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) {
      setError("Comment cannot be empty.");
      return;
    }
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/comments`,
        { task_id: task.id, content: newComment }
      );
      setComments([
        ...comments,
        { id: response.data.id, task_id: task.id, content: newComment },
      ]);
      setNewComment("");
      setError("");
    } catch (err) {
      console.log(err);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await axios.delete(
        `${import.meta.env.VITE_BACKEND_URL}/comments/${commentId}`
      );
      setComments(comments.filter((comment) => comment.id !== commentId));
      setError("");
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content task-modal">
        <button className="close-button" onClick={onClose}>
          <FaTimes />
        </button>
        <h2>{task.title}</h2>
        {error && <p className="error-message">{error}</p>}
        <p>
          <strong>Description:</strong> {task.description}
        </p>
        <p>
          <strong>Location:</strong> {task.location}
        </p>
        <p>
          <strong>Status:</strong> {task.status}
        </p>
        {task.image && (
          <div className="task-image">
            <img
              src={task.image}
              alt="Task Image"
              style={{ maxWidth: "100%", marginTop: "1rem" }}
            />
          </div>
        )}
        <h3>Comments</h3>
        <div className="comments-section">
          {comments.map((comment) => (
            <div key={comment.id} className="comment">
              <p>{comment.content}</p>
              <button
                className="delete-comment"
                onClick={() => handleDeleteComment(comment.id)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={handleAddComment}>
          <textarea
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
          <button type="submit">Add Comment</button>
        </form>
      </div>
    </div>
  );
}

export default TaskModal;
