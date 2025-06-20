import React, { useState } from "react";
import axios from "axios";
import "./CreateTaskModal.css";

function CreateTaskModal({ onClose, onTaskCreated }) {
  const [title, setTitle] = useState("");
  const [image, setImage] = useState(null); // Base64 string or null
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result); // Full base64 string (e.g., data:image/jpeg;base64,...)
      };
      reader.readAsDataURL(file);
    } else {
      setImage(null); // Reset if no file selected
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault(); // Prevent default form submission behavior
    console.log("Submit triggered", { title, image, description, location });
    if (!title || !description || !location) {
      console.log("Missing required fields");
      return;
    }

    const taskData = {
      title,
      description,
      location,
      status: "New Tasks",
      image: image ? image.split(",")[1] : null, // Extract base64 data (remove prefix) or null
    };

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/tasks`,
        taskData,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      console.log("Task created response:", {
        status: response.status,
        data: response.data,
      });
      onTaskCreated();
      onClose();
    } catch (error) {
      console.error("Error creating task:", {
        message: error.message,
        response: error.response
          ? { status: error.response.status, data: error.response.data }
          : null,
        request: error.request ? error.request : null,
      });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); // Prevent newline in textarea
      handleSubmit();
    }
    // Shift+Enter allows newlines in textarea
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-button" onClick={onClose}>
          X
        </button>
        <h2>Create Task</h2>
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
