import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useRole } from "../../lib/RoleContext";
import { searchTasks } from "../../services/tasks";

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const { role, user } = useRole();
  const navigate = useNavigate();

  // Debounce so we don't fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const searchQuery = useQuery({
    queryKey: ["tasks", "search", role, user.email, debouncedQuery],
    queryFn: () => searchTasks(role, user.email, debouncedQuery),
    enabled: debouncedQuery.trim().length > 0,
  });
  const results = searchQuery.data ?? [];
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
        // Clicking a result is a mousedown-then-click on a *different* element than the input,
        // which natively shifts focus off the input before the click fires - that would trigger
        // onBlur and could unmount this dropdown (and the button being clicked) before the click
        // ever lands. preventDefault on mousedown stops that focus shift entirely, so the input
        // never blurs mid-click and the result's onClick always gets to fire.
        <div className="search-results" onMouseDown={(event) => event.preventDefault()}>
          {results.length ? (
            <>
              <div className="search-results-count">{results.length} result{results.length === 1 ? "" : "s"}</div>
              {results.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    setQuery("");
                    navigate(`/tasks/${task.id}`);
                  }}
                >
                  <span className="search-result-icon" aria-hidden="true"><i className="ti ti-checkbox" /></span>
                  <span className="search-result-text">
                    <strong>{task.taskNumber}</strong>
                    <span>{task.title}</span>
                  </span>
                </button>
              ))}
            </>
          ) : (
            <div className="search-empty"><i className="ti ti-search-off" />No scoped tasks match that search.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
