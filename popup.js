/*
This script is responsible for fetching issues from Sentry and displaying them in a list.
*/

// Fetch issues from Sentry and display them in the popup
document.getElementById("fetchBtn").addEventListener("click", async () => {
  const inputDays = document.getElementById("inputDays");
  main({ inputDays });
});

// Group issues by assignee and project
function groupByAssignee(issues) {
  const grouped = {};
  for (const issue of issues) {
    // Use optional chaining for safety
    const assignee = issue.assignedTo?.email || "Unassigned";
    if (!grouped[assignee]) {
      grouped[assignee] = [];
    }
    grouped[assignee].push(issue);
  }
  return grouped;
}

// Render issues in the popup
function renderIssues(grouped) {
  const container = document.getElementById("issues");
  container.innerHTML = ""; // Clear the "loading" message

  if (Object.keys(grouped).length === 0) {
    container.innerText = "No unresolved issues found.";
    return;
  }

  // Sort assignees alphabetically for consistent order
  const sortedAssignees = Object.keys(grouped).sort();

  for (const assignee of sortedAssignees) {
    const issues = grouped[assignee];
    const section = document.createElement("div");
    section.innerHTML = `<h3>${assignee} (${issues.length})</h3>`;
    const list = document.createElement("ul");
    list.style.margin = "0";
    list.style.paddingLeft = "20px";

    issues.forEach((issue) => {
      const el = document.createElement("li");
      const a = document.createElement("a");

      a.href = issue.permalink;
      a.target = "_blank";
      a.textContent = `[${issue.project.name}] ${issue.title}`; // this ensures HTML is escaped

      el.appendChild(a);
      list.appendChild(el);
    });
    section.appendChild(list);
    container.appendChild(section);
  }
}

// Clear the data from localStorage
document.getElementById("clearCache").addEventListener("click", async () => {
  localStorage.removeItem("issues");
  renderIssues([]);
});

function main({ inputDays }) {
  const issuesContainer = document.getElementById("issues");

  issuesContainer.innerText = "Fetching issues, please wait...";

  let issues = localStorage.getItem("issues");

  if (issues) {
    renderIssues(JSON.parse(issues));
  } else {
    chrome.runtime.sendMessage(
      { action: "fetch_issues", statsPeriod: inputDays.value },
      (response) => {
        // Handle any messaging errors
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          issuesContainer.innerText =
            "Error: " + chrome.runtime.lastError.message;
          return;
        }

        // Handle errors returned from the background script's fetch
        if (response.error) {
          console.error(response);
          issuesContainer.innerText = "Error: " + response.error;
          return;
        }

        const grouped = groupByAssignee(response.issues);
        localStorage.setItem("issues", JSON.stringify(grouped));
        renderIssues(grouped);
      }
    );
  }
}
