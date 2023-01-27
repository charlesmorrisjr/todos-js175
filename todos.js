const express = require("express");
const morgan = require("morgan");
const flash = require("express-flash");
const session = require("express-session");
const { body, validationResult } = require("express-validator");
const TodoList = require("./lib/todolist");
const Todo = require("./lib/todo");
const { sortTodoLists, sortTodos } = require("./lib/sort");
const store = require("connect-loki");

const app = express();
const host = "localhost";
const PORT = 3000;
const LokiStore = store(session);

app.set("views", "./views");
app.set("view engine", "pug");

app.use(morgan("common"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false}));

app.use(session({
  cookie: {
    httpOnly: true,
    maxAge: 31 * 24 * 60 * 60 * 1000, // 31 days in millseconds
    path: "/",
    secure: false,
  },
  name: "launch-school-todos-session-id",
  resave: false,
  saveUninitialized: true,
  secret: "this is not very secure",
  store: new LokiStore({}),
}));

app.use(flash());

// Set up persistent session data
app.use((req, res, next) => {
  let todoLists = [];
  if ("todoLists" in req.session) {
    req.session.todoLists.forEach(todoList => {
      todoLists.push(TodoList.makeTodoList(todoList));
    });
  }

  req.session.todoLists = todoLists;
  next();
});

app.use((req, res, next) => {
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

// Find a todo list with the indicated ID. Returns `undefined` if not found.
// Note that `todoListId` must be numeric.
const loadTodoList = (todoListId, todoLists) => {
  return todoLists.find(todoList => todoList.id === todoListId);
};

// Find a todo with the indicated ID in the indicated todo list. Returns
// `undefined` if not found. Note that both `todoListId` and `todoId` must be
// numeric.
const loadTodo = (todoListId, todoId, todoLists) => {
  let todoList = loadTodoList(todoListId, todoLists);
  if (!todoList) return undefined;

  return todoList.todos.find(todo => todo.id === todoId);
};

// Redirect start page
app.get("/", (req, res) => {
  res.redirect("/lists",);
});

// Render the list of todo lists
app.get("/lists", (req, res) => {
  res.render("lists", {
    todoLists: sortTodoLists(req.session.todoLists),
  });
});

// Create a new todo list
app.post("/lists",
  [
    body("todoListTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list title is required.")
      .isLength({ max: 100 })
      .withMessage("List title must be between 1 and 100 characters.")
      .custom((title, { req }) => {
        let todoLists = req.session.todoLists;
        let duplicate = todoLists.find(list => list.title === title);
        return duplicate === undefined;
      })
      .withMessage("List title must be unique."),
  ],
  (req, res) => {
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach(message => req.flash("error", message.msg));
      res.render("new-list", {
        flash: req.flash(),
        todoListTitle: req.body.todoListTitle,
      });
    } else {
      req.session.todoLists.push(new TodoList(req.body.todoListTitle));
      req.flash("success", "The todo list has been created.");
      res.redirect("/lists");
    }
  }
);

// Render new todo list page
app.get("/lists/new", (req, res) => {
  res.render("new-list");
});

// Render specific todo list
app.get("/lists/:todoListId", (req, res, next) => {
  let todoListId = Number(req.params.todoListId);
  let todoList = loadTodoList(todoListId, req.session.todoLists);
  if (todoList === undefined) {
    next(new Error("Not found."));
  } else {
    res.render("list", {
      todoList: todoList,
      todos: sortTodos(todoList),
    });
  }
});

// Show edit todo list name page
app.get("/lists/:todoListId/edit", (req, res, next) => {
  let todoListId = Number(req.params.todoListId);
  let todoList = loadTodoList(todoListId, req.session.todoLists);
  if (todoList === undefined) {
    next(new Error("Not found."));
  } else {
    res.render("edit-list", { todoList });
  }
});

// Edit todo list name page
app.post("/lists/:todoListId/edit",
  [
    body("todoListTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The list title is required.")
      .isLength({ max: 100 })
      .withMessage("List title must be between 1 and 100 characters.")
      .custom((title, { req }) => {
        let todoLists = req.session.todoLists;
        let duplicate = todoLists.find(list => list.title === title);
        return duplicate === undefined;
      })
      .withMessage("List title must be unique."),
  ],
  (req, res, next) => {
    let todoListId = Number(req.params.todoListId);
    let todoList = loadTodoList(todoListId, req.session.todoLists);
    if (!todoList) {
      next(new Error("Not found."));
    } else {
      let errors = validationResult(req);
      if (!errors.isEmpty()) {
        errors.array().forEach(message => req.flash("error", message.msg));
        
        res.render("edit-list", {
          flash: req.flash(),
          todoListTitle: req.body.todoListTitle,
          todoList: todoList,
        });
      } else {
        todoList.setTitle(req.body.todoListTitle);
        req.flash("success", "Todo list title edited successfully.")
        res.redirect(`/lists/${todoListId}`);
      }
    }
  }
);

// Edit todo list name
app.post("/lists/:todoListId/edit", (req, res, next) => {
  let todoListId = Number(req.params.todoListId);
  let todoList = loadTodoList(todoListId, req.session.todoLists);
  if (!todoList) {
    next(new Error("Not found."));
  } else {
    todoList.setTitle(req.body.todoListTitle);
    res.redirect(`/lists/${todoListId}`);
  }
});

// Delete todo list name
app.post("/lists/:todoListId/destroy", (req, res, next) => {
  let todoLists = req.session.todoLists;
  let todoListId = Number(req.params.todoListId);
  let index = todoLists.findIndex(todoList => todoList.id === todoListId);
  if (index === -1) {
    next(new Error("Not found."));
  } else {
    todoLists.splice(index, 1);
    
    req.flash("success", "Todo list deleted.");
    res.redirect("/lists");
  }
});

// Add new todo list item
app.post("/lists/:todoListId/todos",
  [
    body("todoTitle")
      .trim()
      .isLength({ min: 1 })
      .withMessage("The todo title is required.")
      .isLength({ max: 100 })
      .withMessage("Todo title must be between 1 and 100 characters.")
  ],
  (req, res, next) => {
    let todoListId = Number(req.params.todoListId);
    let todoList = loadTodoList(todoListId, req.session.todoLists);
    if (!todoList) {
      next(new Error("Not found."));
    } else {
      let errors = validationResult(req);
      if (!errors.isEmpty()) {
        errors.array().forEach(message => req.flash("error", message.msg));
        res.render("list", {
          flash: req.flash(),
          todoTitle: req.body.todoTitle,
          todoList: todoList,
          todos: sortTodos(todoList),
        });
      } else {
        let todoTitle = req.body.todoTitle;
        todoList.add(new Todo(todoTitle));
        req.flash("success", `"${todoTitle}" has been added to the list!`);
        res.redirect(`/lists/${todoListId}`);
      }
    }
  }
);

// Toggle todo list item check box
app.post("/lists/:todoListId/todos/:todoId/toggle", (req, res, next) => {
  let todoListId = Number(req.params.todoListId);
  let todoId = Number(req.params.todoId);
  let todo = loadTodo(todoListId, todoId, req.session.todoLists);
  if (!todo) {
    next(new Error("Not found."));
  } else {
    if (todo.isDone()) {
      todo.markUndone();
      req.flash("success", `"${todo.title}" has been marked as NOT done!`);
    } else {
      todo.markDone();
      req.flash("success", `"${todo.title}" has been marked as done!`);
    }
    res.redirect(`/lists/${todoListId}`);
  }
});

// Remove todo list item
app.post("/lists/:todoListId/todos/:todoId/destroy", (req, res, next) => {
  let todoListId = Number(req.params.todoListId);
  let todoId = Number(req.params.todoId);
  let todoList = loadTodoList(todoListId, req.session.todoLists);
  if (!todoList) {
    next(new Error("Not found."));
  } else {
    let todo = loadTodo(todoListId, todoId, req.session.todoLists);
    if (!todo) {
      next(new Error("Not found."));
    } else {
      todoList.removeAt(todoList.findIndexOf(todo));
      req.flash("success", `"${todo.title}" has been removed!`);
      res.redirect(`/lists/${todoListId}`);
    }
  }
});

// Check all items' check boxes on todo list
app.post("/lists/:todoListId/complete_all", (req, res, next) => {
  let todoListId = Number(req.params.todoListId);
  let todoList = loadTodoList(todoListId, req.session.todoLists);
  if (!todoList) {
    next(new Error("Not found."));
  } else {
    todoList.markAllDone();
    req.flash("success", "All todo items have been marked as done.")
    res.redirect(`/lists/${todoListId}`);
  }
});

// Error handler
app.use((err, req, res, _next) => {
  console.log(err);
  res.status(404).send(err.message);
});

// Listener
app.listen(PORT, host, () => {
  console.log(`Todos is listening on port ${PORT} of ${host}!`);
});