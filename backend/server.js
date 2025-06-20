const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" })); // Parse JSON bodies

const db = new sqlite3.Database("../tasks.db", (err) => {
  if (err) console.error("Database connection error:", err.message);
  console.log("Connected to the SQLite database.");
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    image TEXT, -- Store base64 string
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    status TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,
    content TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  )`);
});

app.get("/tasks", (req, res) => {
  db.all("SELECT * FROM tasks", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const tasksWithImages = rows.map((task) => ({
      ...task,
      image: task.image ? `data:image/jpeg;base64,${task.image}` : null, // Reconstruct base64 URL
    }));
    res.json(tasksWithImages);
  });
});

app.post("/tasks", (req, res) => {
  const { title, image, description, location, status } = req.body;

  console.log("Inserting task:", {
    title,
    image,
    description,
    location,
    status,
  });
  if (!title || !description || !location) {
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
      res.json({ id: this.lastID });
    }
  );
});

app.patch("/tasks/:id", (req, res) => {
  const { status } = req.body;
  db.run(
    "UPDATE tasks SET status = ? WHERE id = ?",
    [status, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    }
  );
});

app.get("/tasks/:id/comments", (req, res) => {
  db.all(
    "SELECT * FROM comments WHERE task_id = ?",
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

app.post("/comments", (req, res) => {
  const { task_id, content } = req.body;
  db.run(
    "INSERT INTO comments (task_id, content) VALUES (?, ?)",
    [task_id, content],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

app.delete("/comments/:id", (req, res) => {
  db.run("DELETE FROM comments WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

app.delete("/tasks/:id", (req, res) => {
  console.log(`Received DELETE request for /tasks/${req.params.id}`);
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
