#!/bin/bash

# Symlink Shared Types Script
# This script creates symlinks from shared/types.ts to frontend and backend

set -e

echo "🔗 Creating symlinks for shared types..."

# Get script directory (project root)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
SHARED_TYPES="$SCRIPT_DIR/shared/types.ts"

# Frontend symlink
FRONTEND_TYPES="$SCRIPT_DIR/frontend/src/types/shared.ts"
if [ -L "$FRONTEND_TYPES" ]; then
    echo "✅ Frontend symlink already exists"
elif [ -f "$FRONTEND_TYPES" ]; then
    echo "⚠️  Warning: $FRONTEND_TYPES exists as a regular file. Please remove it first."
else
    ln -s "$SHARED_TYPES" "$FRONTEND_TYPES"
    echo "✅ Created frontend symlink: $FRONTEND_TYPES → $SHARED_TYPES"
fi

# Backend symlink
BACKEND_TYPES="$SCRIPT_DIR/backend/src/types/shared.ts"
if [ -L "$BACKEND_TYPES" ]; then
    echo "✅ Backend symlink already exists"
elif [ -f "$BACKEND_TYPES" ]; then
    echo "⚠️  Warning: $BACKEND_TYPES exists as a regular file. Please remove it first."
else
    ln -s "$SHARED_TYPES" "$BACKEND_TYPES"
    echo "✅ Created backend symlink: $BACKEND_TYPES → $SHARED_TYPES"
fi

echo ""
echo "✅ Symlink setup complete!"
echo ""
echo "Verify with:"
echo "  ls -la $FRONTEND_TYPES"
echo "  ls -la $BACKEND_TYPES"
