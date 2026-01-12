#!/bin/bash

# Combined hook script for TypeScript file editing
# Runs prettier, size check, and eslint, then returns combined feedback

# Wrapper to ensure we always output valid JSON and exit 0
output_json() {
    local message="$1"
    cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "$message"
  }
}
EOF
    exit 0
}

# Read JSON input from stdin and extract file path
if [ -t 0 ]; then
    # stdin is a terminal, use first argument
    FILE="$1"
else
    # stdin has data, parse JSON
    INPUT=$(cat)
    FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

    # Fallback to argument if jq failed or returned empty
    if [ -z "$FILE" ] || [ "$FILE" = "null" ]; then
        FILE="$1"
    fi
fi

if [ -z "$FILE" ]; then
    output_json "✅ Skipped (no file path provided)"
fi

if [ ! -f "$FILE" ]; then
    output_json "✅ Skipped (file not found: $FILE)"
fi

# Only process TypeScript files
if [[ ! "$FILE" =~ \.(ts|tsx)$ ]]; then
    output_json "✅ Skipped (not a TypeScript file)"
fi

FEEDBACK=""

# 1. Format with prettier (suppress output)
npx prettier --write "$FILE" > /dev/null 2>&1 || true

# 2. Check file size
WARN_LINES=400
MAX_LINES=500
lines=$(wc -l < "$FILE" 2>/dev/null || echo "0")

if [ "$lines" -gt "$MAX_LINES" ]; then
    FEEDBACK="❌ $FILE: $lines lines (exceeds $MAX_LINES limit). Please refactor to keep files manageable."
elif [ "$lines" -gt "$WARN_LINES" ]; then
    FEEDBACK="⚠️  $FILE: $lines lines (approaching $MAX_LINES line limit)."
else
    FEEDBACK="✅ $FILE: $lines lines"
fi

# 3. Run eslint
OUTPUT=$(npx eslint "$FILE" --format=compact 2>&1 || true)

# Count warnings and errors
WARNINGS=$(echo "$OUTPUT" | grep -c "warning" || echo "0")
ERRORS=$(echo "$OUTPUT" | grep -c "error" || echo "0")

if [ "$ERRORS" -gt 0 ]; then
    ISSUES=$(echo "$OUTPUT" | grep -E "(warning|error)" | head -3 | sed 's/^/  /')
    FEEDBACK="$FEEDBACK\n❌ eslint: $ERRORS error(s), $WARNINGS warning(s)\n$ISSUES"
elif [ "$WARNINGS" -gt 0 ]; then
    ISSUES=$(echo "$OUTPUT" | grep "warning" | head -3 | sed 's/^/  /')
    FEEDBACK="$FEEDBACK\n⚠️  eslint: $WARNINGS warning(s)\n$ISSUES"
else
    FEEDBACK="$FEEDBACK\n✅ eslint: no issues"
fi

# Output combined feedback - escape properly for JSON
ESCAPED=$(echo -e "$FEEDBACK" | sed 's/\\/\\\\/g' | sed 's/"/\\"/g' | sed ':a;N;$!ba;s/\n/\\n/g')

cat << EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "$ESCAPED"
  }
}
EOF

exit 0
