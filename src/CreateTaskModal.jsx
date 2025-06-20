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

  const handleSubmit = async () => {
    console.log("Submit clicked", { title, image, description, location });
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
        "http://localhost:3001/tasks",
        taskData,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      console.log("Task created response:", response.data);
      onTaskCreated();
      onClose();
    } catch (error) {
      console.error(
        "Error creating task:",
        error.response ? error.response.data : error.message
      );
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-button" onClick={onClose}>
          X
        </button>
        <h2>Create Task</h2>
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
        />
        <input
          type="text"
          placeholder="Target location *"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <div className="modal-buttons">
          <button onClick={handleSubmit}>Create Task</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default CreateTaskModal;
