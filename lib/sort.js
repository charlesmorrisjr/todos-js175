// Compare object titles alphabetically (case insensitive)
const compareByTitle = ((itemA, itemB) => {
  let titleA = itemA.title.toLowerCase();
  let titleB = itemB.title.toLowerCase();

  if (titleA < titleB) {
    return -1;
  } else if (titleA > titleB) {
    return 1;
  } else {
    return 0;
  }
});    

// Return the list of todo lists sorted by completion status and title.
const sortTodoLists = lists => {  
  let todoListsNotDone = (lists.filter(list => !list.isDone()) || []);
  let todoListsDone = (lists.filter(list => list.isDone()) || []);
  todoListsNotDone.sort(compareByTitle);
  todoListsDone.sort(compareByTitle);

  return [].concat(todoListsNotDone, todoListsDone);
};

// Return the list of todos in the todo list sorted by completion status and
// title.
const sortTodos = todoList => {
  let undone = todoList.todos.filter(todo => !todo.isDone());
  let done   = todoList.todos.filter(todo => todo.isDone());
  undone.sort(compareByTitle);
  done.sort(compareByTitle);
  return [].concat(undone, done);
};

module.exports = { sortTodoLists, sortTodos };