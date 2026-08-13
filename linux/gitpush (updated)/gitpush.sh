#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Help function
show_help() {
    echo "🚀 Git Auto-Push Script"
    echo ""
    echo "Usage: gitpush \"commit message\" [branch] [options]"
    echo "       gitpush \"\" [branch]              # Update last commit (keep same message)"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -p, --pull     Pull latest changes before pushing"
    echo "  -f, --force    Force push (use with caution!)"
    echo "  -a, --amend    Amend the last commit"
    echo "  --main         Force push to 'main' branch (don't convert to master)"
    echo ""
    echo "Examples:"
    echo "  gitpush \"Fix bug\"                # Push to current branch"
    echo "  gitpush \"Feature\" master         # Push to master"
    echo "  gitpush \"Update\" main            # Push to master (converts main→master)"
    echo "  gitpush \"Update\" main --main     # Push to main (keeps as main)"
    echo "  gitpush \"\"                       # Reuse last commit message, push to current branch"
    echo "  gitpush \"\" --main                # Reuse last commit message, push to main"
    echo "  gitpush \"Hotfix\" -f              # Force push to current branch"
}

# Parse arguments
commit_msg=""
branch=""
pull=false
force=false
amend=false
reuse=false
force_main=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -p|--pull)
            pull=true
            shift
            ;;
        -f|--force)
            force=true
            shift
            ;;
        -a|--amend)
            amend=true
            shift
            ;;
        --main)
            force_main=true
            shift
            ;;
        *)
            if [ -z "$commit_msg" ] && [ -z "$branch" ]; then
                commit_msg="$1"
            elif [ -z "$branch" ]; then
                branch="$1"
            fi
            shift
            ;;
    esac
done

# Check if empty string means reuse commit
if [ "$commit_msg" = "" ]; then
    reuse=true
    echo -e "${YELLOW}🔄 Reusing last commit message (-C HEAD)${NC}"
fi

# Get current branch if not specified
if [ -z "$branch" ]; then
    branch=$(git branch --show-current 2>/dev/null)
    if [ -z "$branch" ]; then
        echo -e "${RED}❌ Error: Not in a git repository${NC}"
        exit 1
    fi
fi

# Convert "main" to "master" if master exists (unless --main flag is used)
if [ "$branch" = "main" ] && [ "$force_main" = false ]; then
    if git show-ref --verify --quiet refs/heads/master; then
        branch="master"
        echo -e "${YELLOW}🔄 Converting 'main' to 'master' branch${NC}"
    fi
elif [ "$branch" = "main" ] && [ "$force_main" = true ]; then
    echo -e "${BLUE}✅ Keeping 'main' branch (--main flag used)${NC}"
fi

# Check if branch exists
if ! git show-ref --verify --quiet refs/heads/"$branch"; then
    echo -e "${RED}❌ Error: Branch '$branch' does not exist${NC}"
    echo "Available branches:"
    git branch
    exit 1
fi

# Ensure we're on the right branch
if [ "$(git branch --show-current)" != "$branch" ]; then
    echo -e "${BLUE}🔄 Switching to branch: $branch${NC}"
    git checkout "$branch" || exit 1
fi

# Pull latest changes if requested
if [ "$pull" = true ]; then
    echo -e "${BLUE}📥 Pulling latest changes from origin/$branch...${NC}"
    git pull origin "$branch" || exit 1
fi

# Add all changes
echo -e "${BLUE}📝 Adding all changes...${NC}"
git add .

# Commit

if [ "$amend" = true ]; then
    echo -e "${BLUE}💬 Amending last commit...${NC}"

    if [ -n "$commit_msg" ]; then
        git commit --amend -m "$commit_msg"
    else
        git commit --amend --no-edit
    fi

elif [ "$reuse" = true ]; then
    echo -e "${BLUE}💬 Updating last commit (keeping message)...${NC}"
    git commit --amend --no-edit

else
    echo -e "${BLUE}💬 Committing with message: \"$commit_msg\"${NC}"
    git commit -m "$commit_msg"
fi

# Check if commit was successful
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Commit failed${NC}"
    exit 1
fi

# Amend rewrites history, so use force-with-lease while pushing
if [ "$amend" = true ] || [ "$reuse" = true ]; then
    force=true
fi

# Push to remote
echo -e "${BLUE}🚀 Pushing to origin/$branch...${NC}"
if [ "$force" = true ]; then
    git push --force-with-lease origin "$branch"
else
    git push origin "$branch"
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Successfully pushed to $branch!${NC}"
    
    # Get commit hash
    commit_hash=$(git rev-parse --short HEAD)
    echo -e "${GREEN}📌 Commit: $commit_hash${NC}"
else
    echo -e "${RED}❌ Push failed. Try:${NC}"
    echo "  1. Check your internet connection"
    echo "  2. Pull latest changes: git pull origin $branch"
    echo "  3. Resolve conflicts and try again"
    echo "  4. Use -f flag for force push (if you know what you're doing)"
    exit 1
fi


