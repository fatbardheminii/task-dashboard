import React, { useState } from "react";
import axios from "axios";
import "./CreateTaskModal.css";
import { FaTimes } from "react-icons/fa";

function CreateTaskModal({
  taskToEdit,
  onClose,
  onTaskCreated,
  onTaskUpdated,
}) {
  const [title, setTitle] = useState(taskToEdit ? taskToEdit.title : "");
  const [image, setImage] = useState(taskToEdit ? taskToEdit.image : null);
  const [description, setDescription] = useState(
    taskToEdit ? taskToEdit.description : ""
  );
  const [location, setLocation] = useState(
    taskToEdit ? taskToEdit.location : ""
  );
  const [error, setError] = useState("");

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Please upload a valid image file (e.g., JPEG, PNG).");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size exceeds 5MB limit.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        if (!base64String.startsWith("data:image/")) {
          setError("Invalid image format detected.");
          return;
        }
        setImage(base64String);
      };
      reader.onerror = () => {
        setError("Failed to read the image file.");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!title.trim() || !description.trim() || !location.trim()) {
      setError("All required fields (*) must be filled out.");
      return;
    }

    const taskData = {
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      status: taskToEdit ? taskToEdit.status : "New Tasks",
      image:
        image && image.startsWith("data:image") ? image.split(",")[1] : null,
    };

    try {
      if (taskToEdit) {
        const response = await axios.patch(
          `${import.meta.env.VITE_BACKEND_URL}/tasks/${taskToEdit.id}`,
          taskData,
          { headers: { "Content-Type": "application/json" } }
        );
        if (response.data.error) {
          throw new Error(response.data.error);
        }
        if (!response.data.task) {
          throw new Error("Invalid server response: task data missing");
        }
        if (response.data.task.image !== null && taskData.image === null) {
          throw new Error("Server failed to clear image");
        }
        onTaskUpdated(response.data.task);
      } else {
        await axios.post(
          `${import.meta.env.VITE_BACKEND_URL}/tasks`,
          taskData,
          { headers: { "Content-Type": "application/json" } }
        );
      }
      await onTaskCreated();
      onClose();
    } catch (_err) {
      console.log(_err);
      setError(
        `Failed to ${taskToEdit ? "update" : "create"} task: ${_err.message}`
      );
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
      <div className="modal-content create-task-modal">
        <button className="close-button" onClick={onClose}>
          <FaTimes />
        </button>
        <h2>{taskToEdit ? "Edit Task" : "Create Task"}</h2>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Target name *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {image && (
            <div className="image-preview">
              <img
                src={image}
                alt="Task Image Preview"
                style={{ maxWidth: "100%", marginBottom: "0.5rem" }}
                onError={() => setError("Image failed to load in preview.")}
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                style={{ marginBottom: "0.5rem", color: "red" }}
              >
                Remove Image
              </button>
            </div>
          )}
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
            <button type="submit">
              {taskToEdit ? "Update Task" : "Create Task"}
            </button>
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
