import React, { useState, useEffect } from "react";
import axios from "axios";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import TaskModal from "./TaskModal";
import CreateTaskModal from "./CreateTaskModal";
import "./App.css";
import { FaTrashAlt, FaEdit } from "react-icons/fa";

// Standardize column IDs to match server status values
const COLUMNS = {
  NEW_TASKS: "New Tasks",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

function App() {
  const [tasks, setTasks] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/tasks?_=${Date.now()}`
      );
      setTasks((prevTasks) => {
        const updatedTasks = response.data.map((newTask) => {
          const existingTask = prevTasks.find((t) => t.id === newTask.id);
          if (
            existingTask &&
            (existingTask.title !== newTask.title ||
              existingTask.description !== newTask.description ||
              existingTask.location !== newTask.location ||
              (existingTask.image !== null &&
                existingTask.image !== newTask.image))
          ) {
            setError("Some changes may not have saved. Please try again.");
          }
          return existingTask ? { ...newTask, ...existingTask } : newTask;
        });
        return updatedTasks;
      });
    } catch (_err) {
      console.log(_err);
      setError("Failed to fetch tasks.");
    }
  };

  const updateTaskStatus = async (
    taskId,
    status,
    retryCount = 0,
    maxRetries = 2
  ) => {
    const payload = { status };
    try {
      await axios.patch(
        `${import.meta.env.VITE_BACKEND_URL}/tasks/${taskId}/status`,
        payload,
        { headers: { "Content-Type": "application/json" } }
      );
      return true;
    } catch (_err) {
      console.log(_err);
      if (retryCount < maxRetries && _err.response?.status !== 400) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return updateTaskStatus(taskId, status, retryCount + 1, maxRetries);
      }
      throw _err;
    }
  };

  const onDragEnd = async (result) => {
    if (!result.destination) {
      return;
    }
    const { source, destination } = result;
    if (source.droppableId !== destination.droppableId) {
      const task = tasks.find((t) => t.id === parseInt(result.draggableId));
      if (!task) {
        return;
      }
      const newStatus = destination.droppableId;
      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === task.id ? { ...t, status: newStatus } : t
        )
      );
      try {
        await updateTaskStatus(task.id, newStatus);
        await fetchTasks();
      } catch (_err) {
        console.log(_err);
        setError(
          `Failed to move task ${task.title || "Untitled"}. Please try again.`
        );
        await fetchTasks();
      }
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const response = await axios.delete(
        `${import.meta.env.VITE_BACKEND_URL}/tasks/${taskId}`
      );
      if (response.status === 200 || response.status === 204) {
        setTasks(tasks.filter((task) => task.id !== taskId));
        await fetchTasks();
      } else {
        setError("Failed to delete task.");
        await fetchTasks();
      }
    } catch (_err) {
      console.log(_err);
      setError("Failed to delete task.");
    }
  };

  const handleTaskUpdate = async (_updatedTask) => {
    if (!_updatedTask || typeof _updatedTask !== "object" || !_updatedTask.id) {
      setError("Invalid task update data received.");
      await fetchTasks();
      return;
    }
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === _updatedTask.id ? { ...task, ..._updatedTask } : task
      )
    );
    setError("");
    try {
      await fetchTasks();
    } catch (_err) {
      console.log(_err);
      setError("Failed to sync task updates.");
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Sector A</h1>
        <div>
          <button
            className="header-btn"
            onClick={() => {
              setTaskToEdit(null);
              setIsCreateModalOpen(true);
            }}
          >
            Create Task
          </button>
        </div>
      </header>
      {error && <p className="error-message">{error}</p>}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="task-sections">
          {Object.values(COLUMNS).map((status) => (
            <Droppable key={status} droppableId={status}>
              {(provided) => (
                <div
                  className="task-column"
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  <h2>{status}</h2>
                  <div className="task-list">
                    {tasks
                      .filter((task) => task.status === status)
                      .map((task, index) => (
                        <Draggable
                          key={task.id}
                          draggableId={String(task.id)}
                          index={index}
                        >
                          {(provided) => (
                            <div
                              className="task-card"
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => setSelectedTask(task)}
                            >
                              <span className="task-title">
                                <strong>{task.title || "Untitled"}</strong>
                              </span>
                              <div className="span-flex">
                                {task.image && (
                                  <span className="task-image-indicator">
                                    Img |
                                  </span>
                                )}
                                <span className="task-location">
                                  {task.location || "No location"}
                                </span>
                              </div>
                              <div className="icons-container">
                                <button
                                  className="edit-icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTaskToEdit(task);
                                    setIsCreateModalOpen(true);
                                  }}
                                >
                                  <FaEdit />
                                </button>
                                <button
                                  className="trash-icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteTask(task.id);
                                  }}
                                >
                                  <FaTrashAlt />
                                </button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
      {selectedTask && (
        <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
      {isCreateModalOpen && (
        <CreateTaskModal
          taskToEdit={taskToEdit}
          onClose={() => {
            setIsCreateModalOpen(false);
            setTaskToEdit(null);
          }}
          onTaskCreated={fetchTasks}
          onTaskUpdated={handleTaskUpdate}
        />
      )}
    </div>
  );
}

export default App;
