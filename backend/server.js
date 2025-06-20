const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const fs = require("fs");
const app = express();
const port = process.env.PORT || 3001;

// Configure CORS for local development and production
const allowedOrigins = [
  "http://localhost:5173", // Local development
  "https://task-dashboard-frontend-swkv.onrender.com", // Your frontend URL on Render
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true, // Allow credentials if needed
  })
);
app.use(express.json({ limit: "10mb" }));

// Check if database file is writable
const dbPath = "./tasks.db";
try {
  if (fs.existsSync(dbPath)) {
    fs.accessSync(dbPath, fs.constants.W_OK);
    console.log("Database file is writable.");
  } else {
    console.log("Database file does not exist, will be created.");
  }
} catch (error) {
  console.error("Database file access error:", error.message);
  process.exit(1);
}

// Initialize database with error handling
let db;
try {
  db = new sqlite3.Database(
    dbPath,
    sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
    (err) => {
      if (err) {
        console.error("Failed to connect to SQLite database:", err.message);
        process.exit(1);
      }
      console.log("Connected to the SQLite database.");
    }
  );

  // Ensure tables are created
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
          console.error("Error creating tasks table:", err.message);
          process.exit(1);
        }
        console.log("Tasks table ready.");
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
          console.error("Error creating comments table:", err.message);
          process.exit(1);
        }
        console.log("Comments table ready.");
      }
    );
  });
} catch (error) {
  console.error("Database initialization error:", error.message);
  process.exit(1);
}

app.get("/tasks", (req, res) => {
  db.all("SELECT * FROM tasks", [], (err, rows) => {
    if (err) {
      console.error("Error fetching tasks:", err.message);
      return res.status(500).json({ error: err.message });
    }
    console.log("Fetched tasks:", rows.length);
    const tasksWithImages = rows.map((task) => ({
      ...task,
      image: task.image ? `data:image/jpeg;base64,${task.image}` : null,
    }));
    res.json(tasksWithImages);
  });
});

app.post("/tasks", (req, res) => {
  const { title, image, description, location, status } = req.body;
  console.log("Received POST /tasks request with data:", {
    title,
    image: image ? `${image.slice(0, 30)}...` : null,
    description,
    location,
    status,
  });
  if (!title || !description || !location.trim()) {
    console.log("Missing required fields, returning 400");
    return res.status(400).json({ error: "Missing required fields" });
  }

  db.run(
    "INSERT INTO tasks (title, image, description, location, status) VALUES (?, ?, ?, ?, ?)",
    [title, image, description, location, status || "New Tasks"],
    function (err) {
      if (err) {
        console.error("Insert error:", err.message);
        return res.status(500).json({ error: err.message });
      }
      console.log("Task inserted with ID:", this.lastID);
      res.status(201).json({ id: this.lastID });
    }
  );
});

app.patch("/tasks/:id", (req, res) => {
  const { status } = req.body;
  console.log(`Received PATCH /tasks/${req.params.id} with status:`, status);
  db.run(
    "UPDATE tasks SET status = ? WHERE id = ?",
    [status, req.params.id],
    function (err) {
      if (err) {
        console.error("Update error:", err.message);
        return res.status(500).json({ error: err.message });
      }
      console.log("Task updated, changes:", this.changes);
      res.json({ updated: this.changes });
    }
  );
});

app.get("/tasks/:id/comments", (req, res) => {
  db.all(
    "SELECT * FROM comments WHERE task_id = ?",
    [req.params.id],
    (err, rows) => {
      if (err) {
        console.error("Error fetching comments:", err.message);
        return res.status(500).json({ error: err.message });
      }
      console.log("Fetched comments for task", req.params.id, ":", rows.length);
      res.json(rows);
    }
  );
});

app.post("/comments", (req, res) => {
  const { task_id, content } = req.body;
  console.log("Received POST /comments with data:", { task_id, content });
  db.run(
    "INSERT INTO comments (task_id, content) VALUES (?, ?)",
    [task_id, content],
    function (err) {
      if (err) {
        console.error("Comment insert error:", err.message);
        return res.status(500).json({ error: err.message });
      }
      console.log("Comment inserted with ID:", this.lastID);
      res.json({ id: this.lastID });
    }
  );
});

app.delete("/comments/:id", (req, res) => {
  console.log(`Received DELETE /comments/${req.params.id}`);
  db.run("DELETE FROM comments WHERE id = ?", [req.params.id], function (err) {
    if (err) {
      console.error("Comment delete error:", err.message);
      return res.status(500).json({ error: err.message });
    }
    console.log("Comment deleted, changes:", this.changes);
    res.json({ deleted: this.changes });
  });
});

app.delete("/tasks/:id", (req, res) => {
  console.log(`Received DELETE /tasks/${req.params.id}`);
  db.run("DELETE FROM tasks WHERE id = ?", [req.params.id], function (err) {
    if (err) {
      console.error("Delete error:", err.message);
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      console.log("No task found with ID:", req.params.id);
      return res.status(404).json({ error: "Task not found" });
    }
    console.log("Task deleted with ID:", req.params.id);
    res.json({ deleted: this.changes });
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
