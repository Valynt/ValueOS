#!/bin/bash

# Canvas Architecture Migration Completion Script
# This script helps complete the gradual migration by uncommenting new code

echo "🚀 Canvas Architecture Migration Completion Script"
echo "=================================================="

# Function to uncomment migration code
uncomment_migration_code() {
    local file=$1
    echo "📝 Processing $file..."

    # Uncomment new state management calls
    sed -i 's|// newActions\.|newActions\.|g' "$file"

    # Comment out old state management calls
    sed -i 's|setSelectedCaseId(id);|// setSelectedCaseId(id); // OLD: Replaced by newActions.selectCaseAndReset|g' "$file"
    sed -i 's|setIsLoading(true);|// setIsLoading(true); // OLD: Replaced by newActions.setLoading|g' "$file"
    sed -i 's|setStreamingUpdate({|// setStreamingUpdate({ // OLD: Replaced by newActions.setStreamingUpdate|g' "$file"
    sed -i 's|setIsNewCaseModalOpen(true);|// setIsNewCaseModalOpen(true); // OLD: Replaced by newActions.openModal|g' "$file"

    echo "✅ Migration code uncommented in $file"
}

# Main migration files
MIGRATION_FILES=(
    "src/components/ChatCanvas/ChatCanvasLayout.tsx"
)

# Check if files exist
for file in "${MIGRATION_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ File not found: $file"
        exit 1
    fi
done

echo "🔍 Found migration files, proceeding with completion..."

# Process each file
for file in "${MIGRATION_FILES[@]}"; do
    uncomment_migration_code "$file"
done

echo ""
echo "✨ Migration completion steps:"
echo "1. ✅ Uncommented new state management calls"
echo "2. ✅ Commented out old state management calls"
echo "3. 🔄 Next: Remove old useState hooks"
echo "4. 🔄 Next: Update component rendering"
echo "5. 🔄 Next: Add service locator wrapper"

echo ""
echo "📋 Manual steps remaining:"
echo "- Remove individual useState hooks from ChatCanvasLayout.tsx"
echo "- Update component props to use new state"
echo "- Wrap app with ServiceProvider from AppWrapper.tsx"
echo "- Update tests to use new architecture"

echo ""
echo "🎯 Migration progress: Phase 1 nearly complete!"
echo "📖 See docs/architecture/MIGRATION_CHECKLIST.md for details"
