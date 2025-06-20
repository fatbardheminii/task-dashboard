import React, { useState, useEffect } from "react";
import axios from "axios";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import TaskModal from "./TaskModal";
import CreateTaskModal from "./CreateTaskModal";
import "./App.css";

function App() {
  const [tasks, setTasks] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    fetchTasks(); // Initial fetch
    const interval = setInterval(fetchTasks, 5000); // Poll every 5 seconds
    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/tasks`
      );
      setTasks(response.data);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.droppableId !== destination.droppableId) {
      const task = tasks.find((t) => t.id === parseInt(result.draggableId));
      try {
        await axios.patch(
          `${import.meta.env.VITE_BACKEND_URL}/tasks/${task.id}`,
          {
            status: destination.droppableId,
          }
        );
        fetchTasks(); // Refresh after drag
      } catch (error) {
        console.error("Error updating task status:", error);
      }
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const response = await axios.delete(
        `${import.meta.env.VITE_BACKEND_URL}/tasks/${taskId}`
      );
      console.log("Delete response:", response.data);
      if (response.status === 200 || response.status === 204) {
        setTasks(tasks.filter((task) => task.id !== taskId));
        fetchTasks(); // Ensure sync with server
      } else if (response.status === 404) {
        console.error("Task not found, refreshing tasks");
        fetchTasks();
      }
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Sector A</h1>
        <div>
          <button onClick={() => setIsCreateModalOpen(true)}>
            Create Task
          </button>
        </div>
      </header>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="task-sections">
          {["New Tasks", "In Progress", "Completed"].map((status) => (
            <Droppable key={status} droppableId={status}>
              {(provided) => (
                <div
                  className="task-column"
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                >
                  <h2>{status}</h2>
                  <div style={{ flex: 1, overflowY: "auto" }}>
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
                              onClick={() => setSelectedTask(task)} // Restore modal open on click
                            >
                              <span className="task-title">
                                <strong>{task.title}</strong>
                              </span>
                              {task.image && (
                                <img
                                  src={task.image}
                                  alt={task.title}
                                  className="task-image"
                                />
                              )}
                              <span className="task-location">
                                {task.location}
                              </span>
                              <button
                                className="trash-icon"
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent modal open on trash click
                                  handleDeleteTask(task.id);
                                }}
                              >
                                🗑️
                              </button>
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
          onClose={() => setIsCreateModalOpen(false)}
          onTaskCreated={fetchTasks}
        />
      )}
    </div>
  );
}

export default App;
