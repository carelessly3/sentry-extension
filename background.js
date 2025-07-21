// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetch_issues") {
    // This function runs asynchronously and will call sendResponse when done.
    (async () => {
      const orgSlug = "";
      const sentryApiBase = "https://us.sentry.io/api/0";

      try {
        // Get the `session` cookie from sentry.io
        const cookie = await new Promise((resolve, reject) => {
          chrome.cookies.get(
            {
              url: "",
              name: "session",
            },
            (cookie) => {
              if (cookie) resolve(cookie);
              else
                reject(
                  new Error(
                    "Session cookie not found. Please make sure you're logged into Sentry."
                  )
                );
            }
          );
        });

        // Manually attach the cookie in the header
        const headers = {
          Cookie: `session=${cookie.value}`,
        };

        // Fetch all projects for the organization
        const projectsResponse = await fetch(
          `${sentryApiBase}/organizations/${orgSlug}/projects/`,
          { method: "GET", headers, credentials: "include" }
        );
        if (!projectsResponse.ok) {
          throw new Error(
            `Failed to fetch projects: ${projectsResponse.statusText}`
          );
        }
        const projects = await projectsResponse.json();
        
        let allIssues = [];
        let requests = [];

        // Loop through each project to fetch its issues
        for (const project of projects) {
          const issuesUrl = `${sentryApiBase}/organizations/${orgSlug}/issues/?project=${
            project.id
          }&query=is%3Aunresolved&statsPeriod=${request.statsPeriod ?? 30}d`;

          requests.push({
            fetchFn: () =>
              fetch(issuesUrl, {
                method: "GET",
                headers,
                credentials: "include",
              }),
          });
        }

        const batchSize = 25;

        const numOfBatches = Math.ceil(requests.length / batchSize);

        for (let batchIndex = 0; batchIndex < numOfBatches; batchIndex++) {
          const start = batchIndex * batchSize;
          const end = Math.min(start + batchSize, requests.length);
          const batch = requests.slice(start, end);

          await Promise.all(batch.map((r) => r.fetchFn())).then((responses) => {
            responses.forEach(async (response) => {
              if (response.ok) {
                const issues = await response.json();
                allIssues = allIssues.concat(issues);
              } else {
                console.warn(`Could not fetch issues :(`);
              }
            });
          });

          await new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve();
            }, 100);
          });
        }

        // Send the successful result back to the popup
        sendResponse({ issues: allIssues });
      } catch (error) {
        // Send any errors back to the popup to be displayed
        sendResponse({ error: error.message });
      }
    })();

    // Return true to indicate that you will send a response asynchronously.
    return true;
  }
});
