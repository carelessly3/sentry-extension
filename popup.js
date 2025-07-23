// fill env variables
const config = {
  orgSlug: "",
  cookieUrl: "",
};

document.getElementById("users").addEventListener("change", () => {
  const userSelect = document.getElementById("users");
  renderIssues(userSelect.value);
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
async function renderIssues(user) {
  const grouped = JSON.parse(localStorage.getItem("issues"));

  const container = document.getElementById("issues");

  container.innerHTML = ""; // Clear the "loading" message

  if (!grouped || Object.keys(grouped).length === 0) {
    container.innerText = "No unresolved issues found.";
    return;
  }

  const userSelect = document.getElementById("users");

  const sortedAssignees = Object.keys(grouped).sort();

  if (userSelect.options.length == 1) {
    for (const user of sortedAssignees) {
      userSelect.innerHTML += `<option value=${user}>${user}</option>`;
    }
  }

  for (const assignee of sortedAssignees) {
    if (user && assignee != user) {
      continue;
    }
    const issues = grouped[assignee];
    const section = document.createElement("div");
    section.innerHTML = `<h3>${assignee} (${issues.length})</h3>`;
    const list = document.createElement("ul");
    list.style.margin = "0";
    list.style.paddingLeft = "20px";

    issues.forEach((issue) => {
      const el = document.createElement("li");
      const issueButton = document.createElement("a");

      issueButton.textContent = `[${issue.project.name}] - ${issue.title}`;
      el.onclick = () => {
        chrome.tabs.create({ url: issue.permalink, active: false });
      };

      el.appendChild(issueButton);
      list.appendChild(el);
    });
    section.appendChild(list);
    container.appendChild(section);
  }
}

document.getElementById("reload").addEventListener("click", async () => {
  localStorage.removeItem("issues");
  const userSelect = document.getElementById("users");
  userSelect.innerHTML = `<option value="">All Users</option>`;
  const inputDays = document.getElementById("inputDays");
  main({ inputDays });
});

function main({ inputDays }) {
  localStorage.setItem("inputDaysCache", inputDays.value);

  const issuesContainer = document.getElementById("issues");

  issuesContainer.innerText = "Fetching issues, please wait...";

  let issues = localStorage.getItem("issues");

  if (issues) {
    renderIssues();
  } else {
    chrome.runtime.sendMessage(
      {
        action: "fetch_issues",
        statsPeriod: inputDays.value,
        orgSlug: config.orgSlug,
        cookieUrl: config.cookieUrl,
      },
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

        localStorage.setItem(
          "issues",
          JSON.stringify(groupByAssignee(response.issues))
        );
        renderIssues();
      }
    );
  }
}

const inputDaysCache = localStorage.getItem("inputDaysCache");

const inputDays = document.getElementById("inputDays");

if (inputDaysCache) {
  inputDays.value = inputDaysCache;
}

main({ inputDays });
