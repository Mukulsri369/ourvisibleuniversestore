# Troubleshooting & Resolution Plan: Fixing GitHub "Permission Denied" in AI Studio (Active)

## Problem Overview

When attempting to push commits to GitHub directly from AI Studio, the operation failed with:
> `Failed to push commit to GitHub: permission denied. Please try again.`

This indicates that GitHub is rejecting the push operation due to missing write authorization on the connected GitHub App or OAuth grant for this repository.

---

## Action Items to Resolve Immediately

### Action 1: Grant Repository Access in GitHub Settings (Most Common Cause)

1. Open your browser and navigate directly to:
   **[https://github.com/settings/installations](https://github.com/settings/installations)**
2. Find the application for **Google AI Studio** / **Lovable** in the list.
3. Click **Configure**.
4. Check the **Repository access** section:
   - If set to **"Only select repositories"**, click the dropdown, search for your repository, and select it to grant access.
   - Alternatively, change it to **"All repositories"** so future projects and updates are never blocked.
5. Click **Save**.

---

### Action 2: Reconnect Your GitHub Account in AI Studio

If the token expired or lost write scopes:
1. In the AI Studio interface, open the GitHub connection menu (usually next to the push/export button or your avatar).
2. Click **Disconnect** or **Log out of GitHub**.
3. Click **Connect to GitHub** to initiate a clean OAuth connection.
4. When prompted by GitHub, ensure:
   - You authorize with the account that owns the repository (`mukul.sri.25`).
   - You grant permission to access repositories (Read and Write).
5. Once reconnected, click **Push changes to GitHub** again.

---

### Action 3: Verify Branch Protection Rules on Your GitHub Repository

If your GitHub repository has branch rules enabled:
1. Go to your repository on GitHub: `https://github.com/<your-username>/<your-repo-name>`
2. Go to **Settings** → **Branches**.
3. Under **Branch protection rules**, check if the default branch (`main` or `master`) has:
   - *"Require a pull request before merging"*
   - *"Restrict who can push to matching branches"*
4. If enabled, temporarily uncheck these restrictions or add your authorized app/account to the allowlist, then save.

---

### Fallback: Push Directly from Your Local Terminal

If you prefer to bypass web authorization completely and push via your terminal using your local SSH key or Personal Access Token:
```bash
# In your local project folder:
git fetch origin
git pull --rebase origin main
git push origin main
```

---

## Project Status

- **App Compilation**: Succeeded (`npm run build` passes with 0 errors).
- **Codebase Linting**: Succeeded (0 lint errors).
- **All Previous Features**: 5s landing card auto-rotation, 3s detail crossfade, `/admin/festival` curation dashboard, and 3-card mobile category rails are built and operational.
