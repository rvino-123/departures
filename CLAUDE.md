# Development process

Every new feature, fix, or tech change follows this loop. Each step ends on its completion criterion before the next starts.

1. **Branch.** Start from an up-to-date `main` and create a new branch named for the change (`feat/…`, `fix/…`, `chore/…`). Done when you're on the new branch.
2. **Plan.** Ask the user whether they want to plan the change first, whatever mode the session is in. If yes, write the plan and get their approval before touching code. Done when the user has approved a plan or declined planning.
3. **Build.** Implement the change. Done when `npm run lint`, `npm test` and `npm run build` all pass.
4. **Review.** Straight after building, launch subagents in parallel to review the diff against `main` (correctness bugs; whether it matches the plan). Fix what they confirm. Done when every finding is fixed or reported to the user as deliberately left.
5. **Test link.** Start the dev server (`npm run dev`, in the background) and give the user the local URL. The app is served under the `/departures/` base path, so the link is `http://localhost:5173/departures/` (use the port Vite actually prints). Done when the user has a working link.
6. **Commit.** Once the user approves the change, write a commit message and commit. Then ask whether to push or whether they have more to add. Push only when they say so.
