# Git Worktree + Sparse-Checkout Command Reference

## Create a Worktree with Sparse-Checkout

```bash
# 1. Create worktree on a new branch
git worktree add .worktrees/<name> -b agent/<name>

# 2. Enter the worktree
cd .worktrees/<name>

# 3. Enable sparse-checkout in cone mode
git sparse-checkout init --cone

# 4. Set directories to include
git sparse-checkout set src/auth tests/auth

# 5. Verify what's checked out
git sparse-checkout list
ls -R
```

## Add More Directories Later

```bash
cd .worktrees/<name>
git sparse-checkout add src/models tests/models
```

## One-Liner: Clone with Sparse-Checkout (if no existing repo)

```bash
git clone --no-checkout --filter=blob:none <repo-url> .worktrees/<name>
cd .worktrees/<name>
git sparse-checkout init --cone
git sparse-checkout set <dirs>
git checkout main
```

## Manage Worktrees

```bash
# List all worktrees
git worktree list

# Remove a worktree
git worktree remove .worktrees/<name>

# Force remove (discard uncommitted changes)
git worktree remove --force .worktrees/<name>

# Clean stale metadata (after manual deletion)
git worktree prune

# Move a worktree
git worktree move .worktrees/<old> .worktrees/<new>
```

## Sparse-Checkout Operations

```bash
# View current patterns
git sparse-checkout list

# Replace all patterns
git sparse-checkout set --cone <dir1> <dir2>

# Add patterns (keep existing)
git sparse-checkout add <dir3>

# Reapply (if working tree is out of sync)
git sparse-checkout reapply

# Disable (check out everything)
git sparse-checkout disable

# Non-cone mode (for file-level patterns)
git sparse-checkot init --no-cone
git sparse-checkout set 'src/auth/login.py' 'tests/auth/*'
```

## Branch Management in Worktrees

```bash
# Create worktree on existing branch
git worktree add .worktrees/<name> feature/existing-branch

# Detached HEAD (explore a tag or commit)
git worktree add --detach .worktrees/<name> v1.0.0

# Check which branch a worktree is on
cd .worktrees/<name> && git branch

# Delete the branch after merging
git branch -d agent/<name>
```

## Blast Radius Discovery (Python)

```bash
# Find files that import the changed module
rg "from src\.auth\.login import|import src\.auth\.login" --files-with-matches -l

# Find test files related to the module
find tests -name "*login*" -o -name "*auth*"

# Trace transitive dependents (recursive)
# 1. Find direct dependents
rg "from src\.auth\.login import" -l > /tmp/deps.txt
# 2. For each dependent, find its dependents
while read f; do
    mod=$(echo $f | sed 's|/|.|g' | sed 's|\.py$||')
    rg "from $mod import|import $mod" -l
done < /tmp/deps.txt | sort -u
```

## Blast Radius Discovery (JavaScript/TypeScript)

```bash
# Find files that import from the changed file
rg "from ['\"].*login['\"]|require\(.*login" --files-with-matches -l

# Find test files
find . -name "*.test.*" -o -name "*.spec.*" | grep -E "login|auth"

# With tsconfig path aliases
rg "from ['\"]@/auth/login['\"]" --files-with-matches -l
```
