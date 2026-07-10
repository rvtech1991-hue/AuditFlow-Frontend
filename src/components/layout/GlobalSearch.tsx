import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRole } from "../../lib/RoleContext";
import { searchTasks } from "../../mock-data/tasks";

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const { role, user } = useRole();
  const navigate = useNavigate();
  const results = useMemo(() => searchTasks(role, user.email, query), [query, role, user.email]);
  const open = focused && query.trim().length > 0;

  return (
    <div className="global-search">
      <input
        className="search-box"
        placeholder="Search tasks or descriptions"
        aria-label="Global search"
        aria-expanded={open}
        aria-autocomplete="list"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 120)}
      />
      {open ? (
        <div className="search-results">
          {results.length ? (
            results.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => {
                  setQuery("");
                  navigate(`/tasks/${task.id}`);
                }}
              >
                <strong>{task.id}</strong>
                <span>{task.title}</span>
                <small>{task.description}</small>
                <small>{task.company} - {task.subCompany} - {task.assignee}</small>
              </button>
            ))
          ) : (
            <div className="search-empty">No scoped tasks match that search.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
