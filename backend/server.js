const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const app = express();

// CORS configuration
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://task-dashboard-frontend-swkv.onrender.com",
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));

// Database configuration
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

// Log database connection
pool.connect((err) => {
  if (err) console.error("DB connection error:", err.message);
  else console.log("DB connected");
});

// Initialize database tables
async function initDb() {
  try {
    const { rows } = await pool.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tasks')"
    );
    if (!rows[0].exists) {
      await pool.query(`
        CREATE TABLE tasks (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          image TEXT,
          description TEXT NOT NULL,
          location TEXT NOT NULL,
          status TEXT NOT NULL
        );
        CREATE TABLE comments (
          id SERIAL PRIMARY KEY,
          task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
          content TEXT NOT NULL
        );
      `);
      console.log("DB tables created");
    } else {
      console.log("DB tables already exist");
    }
  } catch (error) {
    console.error("Table creation error:", error.message);
  }
}
initDb().catch((err) => console.error("DB init failed:", err.message));

// GET /tasks/:id
app.get("/tasks/:id", async (req, res) => {
  const taskId = parseInt(req.params.id);
  if (isNaN(taskId)) return res.status(400).json({ error: "Invalid task ID" });
  try {
    const { rows } = await pool.query("SELECT * FROM tasks WHERE id = $1", [
      taskId,
    ]);
    if (rows.length === 0)
      return res.status(404).json({ error: "Task not found" });
    res.json({
      ...rows[0],
      image: rows[0].image ? `data:image/jpeg;base64,${rows[0].image}` : null,
    });
  } catch (error) {
    console.error("Error fetching task:", error.message);
    res.status(500).json({ error: "Failed to fetch task" });
  }
});

// GET /tasks
app.get("/tasks", async (req, res) => {
  res.set({ "Cache-Control": "no-store", Connection: "close" });
  try {
    const { rows } = await pool.query("SELECT * FROM tasks");
    res.json(
      rows.map((task) => ({
        ...task,
        image: task.image ? `data:image/jpeg;base64,${task.image}` : null,
      }))
    );
  } catch (error) {
    console.error("Error fetching tasks:", error.message);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// POST /tasks
app.post("/tasks", async (req, res) => {
  const { title, image, description, location, status } = req.body;
  if (!title || !description || !location.trim())
    return res.status(400).json({ error: "Missing required fields" });
  if (image && image.length > 5 * 1024 * 1024)
    return res.status(400).json({ error: "Image size exceeds 5MB" });
  if (image && !/^[A-Za-z0-9+/=]+$/.test(image))
    return res.status(400).json({ error: "Invalid base64 image" });
  try {
    const { rows } = await pool.query(
      "INSERT INTO tasks (title, image, description, location, status) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [title, image, description, location, status || "New Tasks"]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (error) {
    console.error("Error creating task:", error.message);
    res.status(500).json({ error: "Failed to create task" });
  }
});

// PATCH /tasks/:id/status
app.get("/tasks", async (req, res) => {
  res.set({ "Cache-Control": "no-store", Connection: "close" });
  try {
    const { rows } = await pool.query("SELECT * FROM tasks");
    res.json(
      rows.map((task) => ({
        ...task,
        image: task.image ? `data:image/jpeg;base64,${task.image}` : null,
      }))
    );
  } catch (error) {
    console.error("Error fetching tasks:", error.message);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// PATCH /tasks/:id/status
app.patch("/tasks/:id/status", async (req, res) => {
  const { status } = req.body,
    taskId = parseInt(req.params.id);
  if (isNaN(taskId)) return res.status(400).json({ error: "Invalid task ID" });
  if (!status) return res.status(400).json({ error: "Status required" });
  const validStatuses = ["New Tasks", "In Progress", "Completed"];
  const normalizedStatus = validStatuses.find(
    (v) => v.toLowerCase() === status.toLowerCase()
  );
  if (!normalizedStatus)
    return res.status(400).json({ error: `Invalid status: ${status}` });
  try {
    const { rowCount } = await pool.query(
      "UPDATE tasks SET status = $1 WHERE id = $2",
      [normalizedStatus, taskId]
    );
    if (rowCount === 0)
      return res.status(404).json({ error: "Task not found" });
    res.json({ updated: rowCount });
  } catch (error) {
    console.error("Error updating status:", error.message);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// PATCH /tasks/:id
app.patch("/tasks/:id", async (req, res) => {
  const taskId = parseInt(req.params.id);
  if (isNaN(taskId)) return res.status(400).json({ error: "Invalid task ID" });
  const allowedFields = ["title", "image", "description", "location", "status"];
  const fields = [],
    values = [];
  let paramIndex = 1;
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      if (
        ["title", "description", "location"].includes(field) &&
        req.body[field] === ""
      )
        return res.status(400).json({ error: `Empty ${field} not allowed` });
      fields.push(`${field} = $${paramIndex++}`);
      values.push(req.body[field]);
    }
  }
  if (fields.length === 0)
    return res.status(400).json({ error: "No valid fields" });
  try {
    const { rows: check } = await pool.query(
      "SELECT id FROM tasks WHERE id = $1",
      [taskId]
    );
    if (check.length === 0)
      return res.status(404).json({ error: "Task not found" });
    values.push(taskId);
    const { rowCount } = await pool.query(
      `UPDATE tasks SET ${fields.join(", ")} WHERE id = $${paramIndex}`,
      values
    );
    const { rows } = await pool.query("SELECT * FROM tasks WHERE id = $1", [
      taskId,
    ]);
    res.json({
      updated: rowCount,
      task: {
        ...rows[0],
        image: rows[0].image ? `data:image/jpeg;base64,${rows[0].image}` : null,
      },
    });
  } catch (error) {
    console.error("Error updating task:", error.message);
    res.status(500).json({ error: "Failed to update task" });
  }
});

// GET /tasks/:id/comments
app.get("/tasks/:id/comments", async (req, res) => {
  const taskId = parseInt(req.params.id);
  if (isNaN(taskId)) return res.status(400).json({ error: "Invalid task ID" });
  try {
    const { rows } = await pool.query(
      "SELECT * FROM comments WHERE task_id = $1",
      [taskId]
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching comments:", error.message);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// POST /comments
app.post("/comments", async (req, res) => {
  const { task_id, content } = req.body,
    taskId = parseInt(task_id);
  if (isNaN(taskId)) return res.status(400).json({ error: "Invalid task ID" });
  try {
    const { rows } = await pool.query(
      "INSERT INTO comments (task_id, content) VALUES ($1, $2) RETURNING id",
      [taskId, content]
    );
    res.json({ id: rows[0].id });
  } catch (error) {
    console.error("Error inserting comment:", error.message);
    res.status(500).json({ error: "Failed to insert comment" });
  }
});

// DELETE /comments/:id
app.delete("/comments/:id", async (req, res) => {
  const commentId = parseInt(req.params.id);
  if (isNaN(commentId))
    return res.status(400).json({ error: "Invalid comment ID" });
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM comments WHERE id = $1",
      [commentId]
    );
    res.json({ deleted: rowCount });
  } catch (error) {
    console.error("Error deleting comment:", error.message);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

// DELETE /tasks/:id
app.delete("/tasks/:id", async (req, res) => {
  const taskId = parseInt(req.params.id);
  if (isNaN(taskId)) return res.status(400).json({ error: "Invalid task ID" });
  try {
    const { rowCount } = await pool.query("DELETE FROM tasks WHERE id = $1", [
      taskId,
    ]);
    if (rowCount === 0)
      return res.status(404).json({ error: "Task not found" });
    res.json({ deleted: rowCount });
  } catch (error) {
    console.error("Error deleting task:", error.message);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err.message);
  res.status(500).json({ error: "Internal Server Error" });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));

module.exports = app;
