const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const fs = require("fs");
const path = require("path");
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

// Resolve database path
const dbPath = path.resolve(
  __dirname,
  process.env.RENDER ? "/data/tasks.db" : "tasks.db"
);

// Check database file permissions
try {
  if (fs.existsSync(dbPath)) {
    fs.accessSync(dbPath, fs.constants.W_OK);
    console.log("Database file is writable");
  } else {
    fs.writeFileSync(dbPath, "", { mode: 0o666 });
    console.log("Database file created");
  }
} catch (error) {
  console.error("Database file access error:", error);
  process.exit(1);
}

// Initialize database
let db;
try {
  db = new sqlite3.Database(
    dbPath,
    sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
    (err) => {
      if (err) {
        console.error("Database connection error:", err);
        process.exit(1);
      }
      console.log("Database connected successfully");
    }
  );

  // Apply PRAGMA settings
  db.run("PRAGMA journal_mode = WAL;", (err) => {
    if (err) console.error("PRAGMA journal_mode error:", err);
  });
  db.run("PRAGMA synchronous = NORMAL;", (err) => {
    if (err) console.error("PRAGMA synchronous error:", err);
  });

  // Check database integrity
  db.get("PRAGMA integrity_check;", (err, result) => {
    if (err || result.integrity_check !== "ok") {
      console.error("Database integrity check failed:", err || result);
      process.exit(1);
    }
    console.log("Database integrity check passed");
  });

  // Create tables
  db.serialize(() => {
    db.run(
      `CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        image TEXT,
        description TEXT NOT NULL,
        location TEXT NOT NULL,
        status TEXT NOT NULL
      )`,
      (err) => {
        if (err) {
          console.error("Table creation error (tasks):", err);
          process.exit(1);
        }
      }
    );
    db.run(
      `CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER,
        content TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )`,
      (err) => {
        if (err) {
          console.error("Table creation error (comments):", err);
          process.exit(1);
        }
      }
    );
  });
} catch (error) {
  console.error("Database initialization error:", error);
  process.exit(1);
}

// Debug endpoint to inspect task
app.get("/tasks/:id", (req, res) => {
  console.log(`GET /tasks/${req.params.id} - Fetching task`);
  const taskId = parseInt(req.params.id);
  if (isNaN(taskId)) {
    return res.status(400).json({ error: "Invalid task ID" });
  }
  db.get("SELECT * FROM tasks WHERE id = ?", [taskId], (err, row) => {
    if (err) {
      console.error("Error fetching task:", err);
      return res.status(500).json({ error: "Failed to fetch task" });
    }
    if (!row) {
      console.warn(`Task with ID ${taskId} not found`);
      return res.status(404).json({ error: "Task not found" });
    }
    console.log(`Task fetched:`, row);
    res.json({
      ...row,
      image: row.image ? `data:image/jpeg;base64,${row.image}` : null,
    });
  });
});

app.get("/tasks", (req, res) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Connection: "close",
  });
  db.all("SELECT * FROM tasks", [], (err, rows) => {
    if (err) {
      console.error("Error fetching tasks:", err);
      return res.status(500).json({ error: err.message });
    }
    const tasksWithImages = rows.map((task) => ({
      ...task,
      image: task.image ? `data:image/jpeg;base64,${task.image}` : null,
    }));
    res.json(tasksWithImages);
  });
});

app.post("/tasks", (req, res) => {
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

  db.run(
    "INSERT INTO tasks (title, image, description, location, status) VALUES (?, ?, ?, ?, ?)",
    [title, image, description, location, status || "New Tasks"],
    function (err) {
      if (err) {
        console.error("Error creating task:", err);
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID });
    }
  );
});

// Dedicated endpoint for status updates
app.patch("/tasks/:id/status", (req, res) => {
  let { status } = req.body;
  const taskId = parseInt(req.params.id);
  if (isNaN(taskId)) {
    return res.status(400).json({ error: "Invalid task ID" });
  }
  if (!status) {
    return res.status(400).json({ error: "Status field is required" });
  }

  status = status.trim();
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
  status = normalizedStatus;

  db.run(
    "UPDATE tasks SET status = ? WHERE id = ?",
    [status, taskId],
    function (err) {
      if (err) {
        console.error("Error updating task status:", err);
        return res.status(500).json({ error: "Failed to update task status" });
      }
      if (this.changes === 0) {
        console.warn(`Task with ID ${taskId} not found`);
        return res.status(404).json({ error: "Task not found" });
      }
      res.json({ updated: this.changes });
    }
  );
});

// General task update endpoint
app.patch("/tasks/:id", (req, res) => {
  console.log(`PATCH /tasks/${req.params.id} - Request body:`, req.body);
  const taskId = parseInt(req.params.id);
  if (isNaN(taskId) || taskId <= 0) {
    console.warn(`Invalid task ID: ${req.params.id}`);
    return res.status(400).json({ error: "Invalid task ID" });
  }

  const allowedFields = ["title", "image", "description", "location", "status"];
  const fields = [];
  const values = [];

  // Validate fields
  const providedFields = Object.keys(req.body);
  const invalidFields = providedFields.filter(
    (field) => !allowedFields.includes(field)
  );
  if (invalidFields.length > 0) {
    return res
      .status(400)
      .json({ error: `Invalid fields: ${invalidFields.join(", ")}` });
  }

  // Build update query
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
      fields.push(`${field} = ?`);
      values.push(req.body[field] === null ? null : req.body[field]);
    }
  }

  if (fields.length === 0) {
    return res
      .status(400)
      .json({ error: "No valid fields provided to update" });
  }

  const updateQuery = `UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`;
  values.push(taskId);

  console.log("PATCH /tasks/:id - Query:", updateQuery, "Values:", values);

  // Verify task exists
  db.get("SELECT id, image FROM tasks WHERE id = ?", [taskId], (err, row) => {
    if (err) {
      console.error("Error checking task existence:", err);
      return res
        .status(500)
        .json({ error: "Failed to verify task: " + err.message });
    }
    if (!row) {
      console.warn(`Task with ID ${taskId} not found`);
      return res.status(404).json({ error: "Task not found" });
    }

    // Log current image state
    console.log(
      `Current task image state: ${row.image ? "has image" : "no image"}`
    );

    // Execute update
    db.run(updateQuery, values, function (updateErr) {
      if (updateErr) {
        console.error("Error updating task:", updateErr);
        return res
          .status(500)
          .json({ error: "Failed to update task: " + updateErr.message });
      }

      // Fetch updated task
      db.get(
        "SELECT * FROM tasks WHERE id = ?",
        [taskId],
        (fetchErr, updatedTask) => {
          if (fetchErr) {
            console.error("Error fetching updated task:", fetchErr);
            return res
              .status(500)
              .json({
                error: "Failed to fetch updated task: " + fetchErr.message,
              });
          }
          if (!updatedTask) {
            console.error(`Task with ID ${taskId} not found after update`);
            return res
              .status(500)
              .json({ error: "Task not found after update" });
          }

          console.log("Updated task:", updatedTask);
          res.json({
            updated: this.changes,
            task: {
              ...updatedTask,
              image: updatedTask.image
                ? `data:image/jpeg;base64,${updatedTask.image}`
                : null,
            },
          });
        }
      );
    });
  });
});

app.get("/tasks/:id/comments", (req, res) => {
  const taskId = parseInt(req.params.id);
  if (isNaN(taskId)) {
    return res.status(400).json({ error: "Invalid task ID" });
  }
  db.all("SELECT * FROM comments WHERE task_id = ?", [taskId], (err, rows) => {
    if (err) {
      console.error("Error fetching comments:", err);
      return res.status(500).json({ error: "Failed to fetch comments" });
    }
    res.json(rows);
  });
});

app.post("/comments", (req, res) => {
  const { task_id, content } = req.body;
  const taskId = parseInt(task_id);
  if (isNaN(taskId)) {
    return res.status(400).json({ error: "Invalid task ID" });
  }
  db.run(
    "INSERT INTO comments (task_id, content) VALUES (?, ?)",
    [taskId, content],
    function (err) {
      if (err) {
        console.error("Error inserting comment:", err);
        return res.status(500).json({ error: "Failed to insert comment" });
      }
      res.json({ id: this.lastID });
    }
  );
});

app.delete("/comments/:id", (req, res) => {
  const commentId = parseInt(req.params.id);
  if (isNaN(commentId)) {
    return res.status(400).json({ error: "Invalid comment ID" });
  }
  db.run("DELETE FROM comments WHERE id = ?", [commentId], function (err) {
    if (err) {
      console.error("Error deleting comment:", err);
      return res.status(500).json({ error: "Failed to delete comment" });
    }
    res.json({ deleted: this.changes });
  });
});

app.delete("/tasks/:id", (req, res) => {
  const taskId = parseInt(req.params.id);
  if (isNaN(taskId)) {
    return res.status(400).json({ error: "Invalid task ID" });
  }
  db.run("DELETE FROM tasks WHERE id = ?", [taskId], function (err) {
    if (err) {
      console.error("Error deleting task:", err);
      return res.status(500).json({ error: "Failed to delete task" });
    }
    if (this.changes === 0) {
      console.warn(`Task with ID ${taskId} not found`);
      return res.status(404).json({ error: "Task not found" });
    }
    res.json({ deleted: this.changes });
  });
});

// Handle server shutdown
process.on("SIGINT", () => {
  db.close((err) => {
    if (err) {
      console.error("Error closing database:", err);
    }
    console.log("Database connection closed");
    process.exit(0);
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
