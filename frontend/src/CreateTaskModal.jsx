import React, { useState } from "react";
import axios from "axios";
import "./CreateTaskModal.css";

function CreateTaskModal({ onClose, onTaskCreated }) {
  const [title, setTitle] = useState("");
  const [image, setImage] = useState(null);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState(""); // New state for error message

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setImage(null);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    // Frontend validation
    if (!title.trim() || !description.trim() || !location.trim()) {
      setError("All required fields (*) must be filled out.");
      return;
    }

    const taskData = {
      title,
      description,
      location,
      status: "New Tasks",
      image: image ? image.split(",")[1] : null,
    };

    try {
      await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/tasks`,
        taskData,
        { headers: { "Content-Type": "application/json" } }
      );
      onTaskCreated();
      onClose();
    } catch (error) {
      console.error("Error creating task:", {
        message: error.message,
        response: error.response
          ? { status: error.response.status, data: error.response.data }
          : null,
        request: error.request || null,
      });
      setError("Failed to create task. Please try again.");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-button" onClick={onClose}>
          X
        </button>
        <h2>Create Task</h2>

        {/* Error message block */}
        {error && <p className="error-message">{error}</p>}

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Target name *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input type="file" accept="image/*" onChange={handleImageChange} />
          <textarea
            placeholder="Target description *"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <input
            type="text"
            placeholder="Target location *"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <div className="modal-buttons">
            <button type="submit">Create Task</button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateTaskModal;
