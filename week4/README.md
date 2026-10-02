# Week 4
# Git Workflow Practice — Branch, Merge, Fork & Pull Request

Hi! In this document, I'm going to walk you through the four most important things I did when practicing Git collaboration. I'll explain **what** each operation is, **why** we need it, and **exactly which commands I ran** (or which buttons I clicked on GitHub) to make it happen.

Think of this as a lab notebook — it records every step so you (or future-me) can reproduce it.

Here are the three repositories involved in this practice:

| Role | Repository URL |
|------|---------------|
| **Main Project (upstream)** | https://github.com/se-test-examples/git-examples |
| **Feature Branch** | https://github.com/se-test-examples/git-examples/tree/developGitBranch |
| **Forked Copy (by ccckmit)** | https://github.com/ccckmit/git-examples |

---

## 1. Creating a Branch

### What is a branch, and why do we need one?

Imagine you're writing an essay together with a friend. You both have the same draft. Now you want to try rewriting the introduction, but you don't want to mess up the current version in case your rewrite turns out badly. So you **make a photocopy** of the essay and start editing the copy. If your rewrite is great, you'll replace the original with your improved version. If it's terrible, you just throw away the copy — the original is untouched.

A **branch** in Git works exactly like that photocopy. It lets you work on new features, fix bugs, or experiment freely — all without touching the stable `main` branch. When you're happy with your changes, you can merge them back.

In our project, we created a branch called **`developGitBranch`** to develop new features separately from `main`.

### The commands I ran (step by step)

```bash
# Step 1: First, I downloaded (cloned) the entire project from GitHub to my computer.
# This gives me a local copy of all the code and its full history.
git clone https://github.com/se-test-examples/git-examples.git

# Step 2: I moved into the project folder so all future commands apply to this project.
cd git-examples

# Step 3: I created a brand-new branch called "developGitBranch" and switched to it.
# The "-b" flag means "create this branch AND switch to it immediately."
# At this point, the new branch is an exact copy of "main" — they share the same history.
git checkout -b developGitBranch

# Step 4: Now I'm on the new branch! I made some changes to the code.
# (For example, I edited a file, added a new file, etc.)
# ... edited some files here ...

# Step 5: I told Git to track all the changes I made.
# "git add ." means "stage ALL modified and new files for the next commit."
git add .

# Step 6: I saved my changes as a commit (a snapshot in Git's history).
# The -m flag lets me attach a short message describing what I changed.
git commit -m "Add new feature on developGitBranch"

# Step 7: Finally, I pushed (uploaded) the new branch to GitHub.
# The "-u" flag sets "origin/developGitBranch" as the default upstream,
# so next time I can just type "git push" without specifying the branch name.
git push -u origin developGitBranch
```

### What happened after running these commands?

After pushing, the new branch became visible on GitHub. You can see it here:
- 📌 https://github.com/se-test-examples/git-examples/commits/developGitBranch

At this point, the project has **two parallel timelines**: `main` (the stable version) and `developGitBranch` (where I'm building the new feature). Changes I make on `developGitBranch` do **not** affect `main` at all — they live in separate worlds until we decide to bring them together.

> **💡 You can also do this without the command line!**
> On GitHub's website:
> 1. Go to the repository page
> 2. Click the branch dropdown that says **"main"**
> 3. Type `developGitBranch` in the search box
> 4. GitHub will offer to **"Create branch: developGitBranch from main"** — click it!
>
> This does the exact same thing, but entirely through the web interface.

---

## 2. Merging Branches

### What is a merge, and why do we need one?

Remember the photocopy analogy from earlier? You rewrote the introduction on your copy, and it turned out great. Now it's time to **bring those improvements back into the original essay**. That's what merging is.

In Git terms, a **merge** takes all the commits (changes) from one branch and integrates them into another branch. In our case, after we finished developing the feature on `developGitBranch`, we merged it back into `main` so that `main` now includes the new feature.

### The commands I ran (step by step)

```bash
# Step 1: Switch back to the "main" branch.
# I need to be ON the branch that will RECEIVE the changes.
# Think of it as: "I'm standing on main, and I'm pulling changes from developGitBranch into here."
git checkout main

# Step 2: Make sure my local "main" is up to date with what's on GitHub.
# Other people might have pushed changes while I was working on my feature branch.
git pull origin main

# Step 3: Merge the development branch into main.
# This is the key command! Git will look at all the commits on developGitBranch
# that don't exist on main, and apply them here.
git merge developGitBranch

# Step 4: Push the updated "main" branch to GitHub so everyone can see the merged result.
git push origin main
```

### What actually happens during a merge?

When Git runs `git merge developGitBranch`, it does one of two things:

1. **Fast-forward merge** — If `main` hasn't changed since you created `developGitBranch`, Git simply moves the `main` pointer forward to the latest commit on `developGitBranch`. It's like fast-forwarding a video — no new commit is created, the history stays linear.

2. **Three-way merge** — If `main` HAS received new commits while you were working on your branch (for example, a teammate pushed something), Git creates a special **merge commit** that combines both sets of changes. This merge commit has two parents: the latest commit from `main` and the latest commit from `developGitBranch`.

Here's what the merge looks like visually:

```
Before merge:
main:              A --- B --- C
                          \
developGitBranch:          D --- E --- F

After merge (with merge commit M):
main:              A --- B --- C ----------- M
                          \                 /
developGitBranch:          D --- E --- F ---
```

You can see the merged result in the commit history here:
- 📌 https://github.com/se-test-examples/git-examples/commits/main/

> **💡 Pro tip:** It's often better to use `git merge --no-ff developGitBranch` (the `--no-ff` stands for "no fast-forward"). This **always** creates a merge commit, even when fast-forward is possible. Why? Because the merge commit acts as a historical marker — you can look at the commit history later and clearly see "a branch was merged here." Without it, the history looks flat, and you lose the context of which commits belonged to which feature.

> **💡 On GitHub**, merging is usually done through a **Pull Request** (explained in Section 4), which adds the benefit of code review before the merge happens.

---

## 3. Forking a Repository

### What is a fork, and why do we need one?

Let's say you find an amazing open-source project on GitHub, and you want to contribute. But here's the problem: **you don't have permission to push code directly** to the project's repository. You're a stranger — the project owners aren't going to give write access to just anyone!

So how do you contribute? You **fork** the project.

A **fork** is like making a personal photocopy of the entire project under **your own GitHub account**. You get your own complete copy — with all the code, all the branches, and all the commit history. You can do whatever you want with your copy: add features, fix bugs, break things — it won't affect the original project at all.

In our practice, the user **`ccckmit`** forked the main project `se-test-examples/git-examples` to create their own copy at `ccckmit/git-examples`.

### How I forked the project (on GitHub)

Forking is done entirely through GitHub's website — there's **no `git fork` command** in Git itself. Here's what I did:

1. **Logged in** to GitHub with the `ccckmit` account
2. **Navigated** to the original project: https://github.com/se-test-examples/git-examples
3. **Clicked the "Fork" button** in the upper-right corner of the page (it has a little fork icon 🍴)
4. **Selected the destination** — chose the `ccckmit` account as the owner of the forked copy
5. **Clicked "Create fork"** to confirm

And just like that, a brand-new repository was created:
- 📌 https://github.com/ccckmit/git-examples

If you visit that page, you'll see a small note at the top that says **"forked from se-test-examples/git-examples"** — GitHub always remembers where a fork came from.

### Working with the forked repository locally

After forking on GitHub, I needed to download the fork to my computer and set things up properly:

```bash
# Step 1: Clone MY forked copy (not the original!) to my computer.
git clone https://github.com/ccckmit/git-examples.git
cd git-examples

# Step 2: Add the ORIGINAL project as a second remote called "upstream."
# Why? Because I want to be able to pull in updates from the original project later.
# By default, "origin" points to my fork. Now "upstream" points to the original.
git remote add upstream https://github.com/se-test-examples/git-examples.git

# Step 3: Verify that both remotes are set up correctly.
git remote -v
# You should see output like this:
# origin    https://github.com/ccckmit/git-examples.git (fetch)
# origin    https://github.com/ccckmit/git-examples.git (push)
# upstream  https://github.com/se-test-examples/git-examples.git (fetch)
# upstream  https://github.com/se-test-examples/git-examples.git (push)

# Step 4: Now I can make changes, commit, and push to MY fork.
# These pushes go to "origin" (my fork), NOT to the original project.
git add .
git commit -m "Add my improvements in the forked repo"
git push origin main

# Bonus: If the original project gets updated and I want those updates in my fork:
git fetch upstream          # Download the latest changes from the original
git merge upstream/main     # Merge those changes into my local main branch
git push origin main        # Push the updated code to my fork on GitHub
```

### Why use two remotes (origin vs upstream)?

This is a common point of confusion, so let me clarify:

| Remote name | Points to | Purpose |
|-------------|-----------|---------|
| `origin` | `ccckmit/git-examples` (my fork) | Where I push my own changes |
| `upstream` | `se-test-examples/git-examples` (original) | Where I pull updates from the original project |

Think of it like this: `origin` is **my copy**, and `upstream` is **the source of truth**. I work on my copy, and occasionally sync it with the source.

---

## 4. Creating a Pull Request (PR)

### What is a Pull Request, and why do we need one?

You've been working on your branch (or your fork), and you've made some great changes. Now you want those changes to be included in the main project. But you can't just merge them yourself — someone needs to **review** your code first to make sure everything looks good.

A **Pull Request** (or PR) is basically you saying: *"Hey team, I've finished some work. Could you take a look at my changes and, if they're good, merge them into the main branch?"*

It's called a "pull" request because you're asking the project maintainer to **pull** your changes into their branch. It's not just a merge — it's a **conversation**. Teammates can:
- Read through your code changes line by line
- Leave comments and suggestions
- Ask you to fix things before approving
- Run automated tests to make sure nothing is broken

> **📝 Note:** "Pull Request" is GitHub's term. GitLab calls the same thing a **"Merge Request"** — different name, same concept.

### Scenario A: PR from a branch (within the same project)

This is what you do when you've been working on a feature branch (like `developGitBranch`) and want to merge it into `main` **within the same repository**.

Here's what I did on GitHub:

1. **Navigated** to the project: https://github.com/se-test-examples/git-examples
2. **Clicked** the **"Pull requests"** tab at the top of the page
3. **Clicked** the green **"New pull request"** button
4. **Set the comparison:**
   - **base** (the branch receiving changes): `main`
   - **compare** (the branch with my changes): `developGitBranch`
5. GitHub immediately shows a **diff** — a side-by-side comparison of what changed
6. **Clicked** **"Create pull request"**
7. **Wrote a title** (e.g., "Add new feature from developGitBranch") and a **description** explaining what I changed and why
8. **Submitted** the pull request
9. **Teammates reviewed** the code, left comments, and eventually approved
10. **Clicked** **"Merge pull request"** → **"Confirm merge"** to merge the changes into `main`

After merging, the feature branch is no longer needed, so I clicked **"Delete branch"** to keep things tidy.

### Scenario B: PR from a fork (cross-repository)

This is what you do when you've been working on a **forked copy** of the project and want to contribute your changes back to the original project. This is the standard way open-source contributions work.

Here's what user `ccckmit` did on GitHub:

1. **Made changes** on the forked repository (`ccckmit/git-examples`) and pushed them
2. **Navigated** to the fork: https://github.com/ccckmit/git-examples
3. **Noticed** a banner that says *"This branch is X commits ahead of se-test-examples:main"*
4. **Clicked** **"Contribute"** → **"Open pull request"**
5. GitHub redirected to the **original project's PR page**, with:
   - **base repository**: `se-test-examples/git-examples`, **base branch**: `main`
   - **head repository**: `ccckmit/git-examples`, **compare branch**: `main`
6. **Wrote a title and description** explaining the contribution
7. **Submitted** the pull request
8. The **maintainer** of `se-test-examples/git-examples` received a notification, reviewed the code, and decided whether to merge it

The key difference from Scenario A is that the PR goes **across repositories** — from the fork to the original project. This is how thousands of open-source contributions happen every day on GitHub.

---

## Which Git Workflow Does This Follow?

The approach we used in this practice follows the **GitHub Flow** — one of the three most popular Git workflows.

### The Three Major Git Workflows

According to [Ruan Yifeng's article on Git workflows](https://www.ruanyifeng.com/blog/2015/12/git-workflow.html), there are three widely used Git workflows. Let me explain each briefly so you can see how they differ:

#### 1️⃣ Git Flow (the most structured)

Git Flow uses **two long-lived branches**: `main` (for stable releases) and `develop` (for ongoing work). On top of that, it uses short-lived branches for features, releases, and hotfixes. It's powerful but **complex** — you're constantly juggling multiple branches.

**Best for:** Projects with scheduled version releases (like desktop software or mobile apps).

#### 2️⃣ GitHub Flow (the simplest) ← **This is what we used!**

GitHub Flow uses **only one long-lived branch**: `main`. Whenever you want to work on something, you create a short-lived feature branch, do your work, open a Pull Request, get it reviewed, and merge it back. That's it!

**Best for:** Projects with continuous deployment (like websites or web services).

#### 3️⃣ GitLab Flow (the middle ground)

GitLab Flow is a compromise between Git Flow and GitHub Flow. It uses `main` plus environment branches (like `pre-production` and `production`). Changes flow "downstream" — from development to staging to production.

**Best for:** Projects that need to support multiple deployment environments.

### How our workflow maps to GitHub Flow

Here's a visual summary of what we did:

```
main ─────●─────●─────●───────────────●─────●──── (always stable, always deployable)
            \                        /
             ●───●───●───●───●───●──●  developGitBranch
             (branch off)          (merge back via PR)
```

| Step | What GitHub Flow says | What we actually did |
|------|----------------------|---------------------|
| **1. Branch** | Create a branch off `main` | `git checkout -b developGitBranch` |
| **2. Commit** | Add commits to that branch | Made changes and committed on `developGitBranch` |
| **3. PR** | Open a Pull Request | Created a PR on GitHub for review |
| **4. Review** | Discuss and review the code | Teammates reviewed the code in the PR |
| **5. Merge** | Merge into `main` and deploy | Merged the PR into `main` |

### The Fork + PR Pattern (for open-source contribution)

Our practice also demonstrated the **Fork + Pull Request** pattern, which is GitHub's standard model for open-source contributions:

```
┌──────────────────────────────────────────────────────────┐
│  se-test-examples/git-examples  (the original project)   │
│                                                          │
│  main ─────●─────●─────●──────────●──── (updated!)       │
│                                   ↑                      │
│                            Merge the PR                  │
└────────────────────────────┬─────────────────────────────┘
                             │
                        Fork │ (click "Fork" on GitHub)
                             │
┌────────────────────────────▼─────────────────────────────┐
│  ccckmit/git-examples  (personal copy)                    │
│                                                          │
│  main ─────●─────●─────●─────●──── (my new commits)      │
│                               │                          │
│                          Open Pull Request                │
│                     (ask the original project to          │
│                      accept my changes)                   │
└──────────────────────────────────────────────────────────┘
```

**Why does this pattern exist?** Because in open-source projects, you typically don't have write access to the original repository. Forking gives you your own playground, and Pull Requests give you a way to propose changes to the original project. It's the foundation of how millions of developers collaborate on GitHub every day.

---

## Quick Reference: Comparing the Three Workflows

| | **Git Flow** | **GitHub Flow** | **GitLab Flow** |
|---|---|---|---|
| Long-lived branches | `main` + `develop` | `main` only | `main` + environment branches |
| Complexity | 🔴 High | 🟢 Low | 🟡 Medium |
| Merge method | Merge between multiple branches | PR from feature branch → `main` | PR with upstream-first principle |
| Best suited for | Versioned software releases | Continuous deployment | Multi-environment projects |
| Used by | Large enterprise teams | GitHub, startups, small teams | GitLab, mid-size teams |

---

## References

- [Git Workflow (Git 工作流程) — Ruan Yifeng](https://www.ruanyifeng.com/blog/2015/12/git-workflow.html) — Explains the three major Git workflows (Git Flow, GitHub Flow, GitLab Flow) in detail.
- [How Does Git Work? — ByteByteGo](https://bytebytego.com/guides/how-does-git-work/) — A visual guide to Git internals and common operations.
- [Understanding the GitHub Flow — GitHub Guides](https://guides.github.com/introduction/flow/) — GitHub's official explanation of the GitHub Flow workflow.


## AI Agent 
Claude Code
