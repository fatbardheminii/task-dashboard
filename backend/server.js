const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3001;

// Configure CORS
const allowedOrigins = [
  "http://localhost:5173",
  "https://task-dashboard-frontend-swkv.onrender.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));

// Initialize PostgreSQL
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }, // Required for Vercel Postgres/Neon
});

// Create tables
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        image TEXT,
        description TEXT NOT NULL,
        location TEXT NOT NULL,
        status TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        content TEXT NOT NULL
      );
    `);
    console.log("Database tables created successfully");
  } catch (error) {
    console.error("Table creation error:", error);
    process.exit(1);
  }
})();

// GET /tasks/:id
app.get("/tasks/:id", async (req, res) => {
  const taskId = parseInt(req.params.id);
  if (isNaN(taskId)) {
    return res.status(400).json({ error: "Invalid task ID" });
  }
  try {
    const { rows } = await pool.query("SELECT * FROM tasks WHERE id = $1", [
      taskId,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json({
      ...rows[0],
      image: rows[0].image ? `data:image/jpeg;base64,${rows[0].image}` : null,
    });
  } catch (error) {
    console.error("Error fetching task:", error);
    res.status(500).json({ error: "Failed to fetch task" });
  }
});

// GET /tasks
app.get("/tasks", async (req, res) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Connection: "close",
  });
  try {
    const { rows } = await pool.query("SELECT * FROM tasks");
    const tasksWithImages = rows.map((task) => ({
      ...task,
      image: task.image ? `data:image/jpeg;base64,${task.image}` : null,
    }));
    res.json(tasksWithImages);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /tasks
app.post("/tasks", async (req, res) => {
  const { title, image, description, location, status } = req.body;
  if (!title || !description || !location.trim()) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (image && image.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: "Image size exceeds 5MB limit" });
  }
  if (image && !/^[A-Za-z0-9+/=]+$/.test(image)) {
    return res.status(400).json({ error: "Invalid base64 image data" });
  }
  try {
    const { rows } = await pool.query(
      "INSERT INTO tasks (title, image, description, location, status) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [title, image, description, location, status || "New Tasks"]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /tasks/:id/status
app.patch("/tasks/:id/status", async (req, res) => {
  const { status } = req.body;
  const taskId = parseInt(req.params.id);
  if (isNaN(taskId)) {
    return res.status(400).json({ error: "Invalid task ID" });
  }
  if (!status) {
    return res.status(400).json({ error: "Status field is required" });
  }
  const validStatuses = ["New Tasks", "In Progress", "Completed"];
  const normalizedStatus = validStatuses.find(
    (valid) => valid.toLowerCase() === status.toLowerCase()
  );
  if (!normalizedStatus) {
    return res.status(400).json({
      error: `Invalid status: '${status}'. Must be one of: ${validStatuses.join(
        ", "
      )}`,
    });
  }
  try {
    const { rowCount } = await pool.query(
      "UPDATE tasks SET status = $1 WHERE id = $2",
      [normalizedStatus, taskId]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json({ updated: rowCount });
  } catch (error) {
    console.error("Error updating task status:", error);
    res.status(500).json({ error: "Failed to update task status" });
  }
});

// PATCH /tasks/:id
app.patch("/tasks/:id", async (req, res) => {
  const taskId = parseInt(req.params.id);
  if (isNaN(taskId) || taskId <= 0) {
    return res.status(400).json({ error: "Invalid task ID" });
  }
  const allowedFields = ["title", "image", "description", "location", "status"];
  const fields = [];
  const values = [];
  const providedFields = Object.keys(req.body);
  const invalidFields = providedFields.filter(
    (field) => !allowedFields.includes(field)
  );
  if (invalidFields.length > 0) {
    return res
      .status(400)
      .json({ error: `Invalid fields: ${invalidFields.join(", ")}` });
  }
  let paramIndex = 1;
  for (const field of allowedFields) {
    if (req.body.hasOwnProperty(field)) {
      if (
        ["title", "description", "location"].includes(field) &&
        req.body[field] === ""
      ) {
        return res
          .status(400)
          .json({ error: `Empty value for ${field} is not allowed` });
      }
      fields.push(`${field} = $${paramIndex++}`);
      values.push(req.body[field] === null ? null : req.body[field]);
    }
  }
  if (fields.length === 0) {
    return res
      .status(400)
      .json({ error: "No valid fields provided to update" });
  }
  const updateQuery = `UPDATE tasks SET ${fields.join(
    ", "
  )} WHERE id = $${paramIndex}`;
  values.push(taskId);
  try {
    const { rows: checkRows } = await pool.query(
      "SELECT id, image FROM tasks WHERE id = $1",
      [taskId]
    );
    if (checkRows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    const { rowCount } = await pool.query(updateQuery, values);
    if (rowCount === 0) {
      return res.status(500).json({ error: "Task not found after update" });
    }
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
    console.error("Error updating task:", error);
    res.status(500).json({ error: "Failed to update task: " + error.message });
  }
});

// GET /tasks/:id/comments
app.get("/tasks/:id/comments", async (req, res) => {
  const taskId = parseInt(req.params.id);
  if (isNaN(taskId)) {
    return res.status(400).json({ error: "Invalid task ID" });
  }
  try {
    const { rows } = await pool.query(
      "SELECT * FROM comments WHERE task_id = $1",
      [taskId]
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// POST /comments
app.post("/comments", async (req, res) => {
  const { task_id, content } = req.body;
  const taskId = parseInt(task_id);
  if (isNaN(taskId)) {
    return res.status(400).json({ error: "Invalid task ID" });
  }
  try {
    const { rows } = await pool.query(
      "INSERT INTO comments (task_id, content) VALUES ($1, $2) RETURNING id",
      [taskId, content]
    );
    res.json({ id: rows[0].id });
  } catch (error) {
    console.error("Error inserting comment:", error);
    res.status(500).json({ error: "Failed to insert comment" });
  }
});

// DELETE /comments/:id
app.delete("/comments/:id", async (req, res) => {
  const commentId = parseInt(req.params.id);
  if (isNaN(commentId)) {
    return res.status(400).json({ error: "Invalid comment ID" });
  }
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM comments WHERE id = $1",
      [commentId]
    );
    res.json({ deleted: rowCount });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

// DELETE /tasks/:id
app.delete("/tasks/:id", async (req, res) => {
  const taskId = parseInt(req.params.id);
  if (isNaN(taskId)) {
    return res.status(400).json({ error: "Invalid task ID" });
  }
  try {
    const { rowCount } = await pool.query("DELETE FROM tasks WHERE id = $1", [
      taskId,
    ]);
    if (rowCount === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json({ deleted: rowCount });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// Handle server shutdown
process.on("SIGINT", async () => {
  try {
    await pool.end();
    console.log("Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("Error closing database:", error);
    process.exit(1);
  }
});

// Export for Vercel serverless
module.exports = app;
